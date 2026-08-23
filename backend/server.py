from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
import re
import uuid
from pathlib import Path
from collections import Counter
from typing import List, Optional, Union
from datetime import datetime, timezone
from pydantic import BaseModel
import urllib.request
import urllib.error
import sqlite3
import random
import string

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Cloud Sync Database
DB_PATH = ROOT_DIR / "doughtime_cloud.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS vaults (
            sync_id TEXT PRIMARY KEY,
            sync_code TEXT UNIQUE,
            data_json TEXT NOT NULL,
            last_modified TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

# LLM API keys (Supports Gemini, OpenAI, or Emergent)
GEMINI_API_KEY = (
    os.environ.get("GEMINI_API_KEY") or
    os.environ.get("GOOGLE_API_KEY") or
    (os.environ.get("EMERGENT_LLM_KEY", "") if os.environ.get("EMERGENT_LLM_KEY", "").startswith("AIza") else "")
)
OPENAI_API_KEY = (
    os.environ.get("OPENAI_API_KEY") or
    (os.environ.get("EMERGENT_LLM_KEY", "") if os.environ.get("EMERGENT_LLM_KEY", "").startswith("sk-proj") else "")
)
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI()
api_router = APIRouter(prefix="/api")

@app.get("/")
async def app_root():
    return {
        "status": "ok",
        "message": "DoughTime backend & Cloud Sync is live!",
        "ai_status": "ready" if (GEMINI_API_KEY or OPENAI_API_KEY or EMERGENT_LLM_KEY) else "smart-fallback",
        "cloud_sync": "enabled",
        "docs": "/docs"
    }

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------- Models ----------

class ReceiptOCRRequest(BaseModel):
    image_base64: str

class ParsedTransaction(BaseModel):
    amount: Optional[float] = None
    merchant: Optional[str] = None
    date: Optional[str] = None
    category: Optional[str] = None
    account: Optional[str] = None
    note: Optional[str] = None
    raw: Optional[str] = None

class StatementOCRRequest(BaseModel):
    image_base64: Optional[str] = None
    text: Optional[str] = None

class StatementResponse(BaseModel):
    transactions: List[ParsedTransaction]

class InsightRequest(BaseModel):
    transactions: List[dict]
    currency: str = "RM"

class InsightResponse(BaseModel):
    summary: str
    tips: List[str]

# Cloud Sync Models
class SyncRegisterRequest(BaseModel):
    sync_id: Optional[str] = None
    sync_code: Optional[str] = None

class SyncRegisterResponse(BaseModel):
    sync_id: str
    sync_code: str
    is_new: bool = False

class VaultPushRequest(BaseModel):
    sync_id: str
    sync_code: Optional[str] = None
    accounts: List[dict] = []
    transactions: List[dict] = []
    wage_settings: Optional[dict] = None
    budget_settings: Optional[dict] = None
    last_modified: Optional[str] = None

class VaultMergeRequest(BaseModel):
    sync_id: str
    sync_code: Optional[str] = None
    accounts: List[dict] = []
    transactions: List[dict] = []
    wage_settings: Optional[dict] = None
    budget_settings: Optional[dict] = None
    last_modified: Optional[str] = None

class VaultDataResponse(BaseModel):
    success: bool
    sync_id: str
    sync_code: str
    accounts: List[dict] = []
    transactions: List[dict] = []
    wage_settings: Optional[dict] = None
    budget_settings: Optional[dict] = None
    last_modified: str
    message: Optional[str] = None

# ---------- Helpers ----------

def _extract_json(text: Optional[str]) -> Optional[Union[dict, list]]:
    if not text:
        return None
    text = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except Exception:
        for start_char, end_char in (("{", "}"), ("[", "]")):
            i = text.find(start_char)
            j = text.rfind(end_char)
            if i != -1 and j != -1 and j > i:
                try:
                    return json.loads(text[i : j + 1])
                except Exception:
                    continue
        return None

_cached_gemini_models: List[str] = []

def _get_available_gemini_models() -> List[str]:
    """Dynamically queries Google Gemini ModelService to discover active model names"""
    global _cached_gemini_models
    if _cached_gemini_models:
        return _cached_gemini_models
    
    if not GEMINI_API_KEY:
        return ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash-exp"]
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_API_KEY}"
    try:
        req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = data.get("models", [])
            valid = []
            for m in models:
                name = m.get("name", "").replace("models/", "")
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods:
                    valid.append(name)
            if valid:
                # Prioritize flash models for fast OCR
                valid.sort(key=lambda x: (0 if "flash" in x else 1, 0 if "3.6" in x else (1 if "2.5" in x else 2)))
                _cached_gemini_models = valid
                logger.info(f"Discovered active Gemini models: {_cached_gemini_models}")
                return _cached_gemini_models
    except Exception as e:
        logger.warning(f"Could not list Gemini models dynamically: {e}")
        
    _cached_gemini_models = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash-latest"]
    return _cached_gemini_models

async def _call_gemini_api(system: str, prompt: str, image_b64: Optional[str] = None) -> Optional[str]:
    """Calls Google Gemini Vision directly via REST API with dynamic model resolution"""
    if not GEMINI_API_KEY:
        return None
    
    models = _get_available_gemini_models()
    
    parts = []
    if image_b64 and len(image_b64) > 50:
        clean_b64 = image_b64.split(",")[-1].strip()
        parts.append({
            "inlineData": {
                "mimeType": "image/jpeg",
                "data": clean_b64
            }
        })
    parts.append({"text": f"{system}\n\n{prompt}"})
    
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
    }
    
    for model in models[:5]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                candidates = data.get("candidates", [])
                if candidates:
                    content = candidates[0].get("content", {})
                    resp_parts = content.get("parts", [])
                    if resp_parts:
                        logger.info(f"Gemini model {model} successfully extracted OCR result!")
                        return resp_parts[0].get("text", "")
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8") if he.fp else str(he)
            logger.warning(f"Gemini {model} HTTP error {he.code}: {err_body}")
        except Exception as e:
            logger.warning(f"Gemini {model} call error: {e}")
            
    return None

async def _call_openai_api(system: str, prompt: str, image_b64: Optional[str] = None) -> Optional[str]:
    """Calls OpenAI GPT-4o-mini directly via REST API"""
    if not OPENAI_API_KEY:
        return None
    
    url = "https://api.openai.com/v1/chat/completions"
    user_content = []
    if image_b64 and len(image_b64) > 50:
        clean_b64 = image_b64 if image_b64.startswith("data:") else f"data:image/jpeg;base64,{image_b64.split(',')[-1].strip()}"
        user_content.append({"type": "image_url", "image_url": {"url": clean_b64}})
    user_content.append({"type": "text", "text": prompt})
    
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content if (image_b64 and len(image_b64) > 50) else prompt}
        ],
        "response_format": {"type": "json_object"}
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
    except Exception as e:
        logger.error(f"OpenAI API call failed: {e}")
    return None

async def _call_emergent_api(system: str, prompt: str, image_b64: Optional[str] = None) -> Optional[str]:
    """Calls OpenAI-compatible Emergent / OpenRouter API endpoints via REST"""
    if not EMERGENT_LLM_KEY:
        return None
    
    endpoints = [
        "https://api.openai.com/v1/chat/completions",
        "https://api.emergentmethods.ai/v1/chat/completions",
        "https://openrouter.ai/api/v1/chat/completions"
    ]
    
    user_content = []
    if image_b64 and len(image_b64) > 50:
        clean_b64 = image_b64 if image_b64.startswith("data:") else f"data:image/jpeg;base64,{image_b64.split(',')[-1].strip()}"
        user_content.append({"type": "image_url", "image_url": {"url": clean_b64}})
    user_content.append({"type": "text", "text": prompt})
    
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content if (image_b64 and len(image_b64) > 50) else prompt}
        ],
        "response_format": {"type": "json_object"}
    }
    
    for url in endpoints:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {EMERGENT_LLM_KEY}"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "")
        except Exception:
            continue
    return None

async def _run_llm(system: str, user_text: str, image_b64: Optional[str] = None) -> Optional[str]:
    if GEMINI_API_KEY:
        result = await _call_gemini_api(system, user_text, image_b64)
        if result:
            return result
            
    if OPENAI_API_KEY:
        result = await _call_openai_api(system, user_text, image_b64)
        if result:
            return result
            
    if EMERGENT_LLM_KEY:
        result = await _call_emergent_api(system, user_text, image_b64)
        if result:
            return result
            
    return None

CATEGORIES = [
    "Makan", "Groceries", "Transport", "Petrol", "Tolls", "Telco",
    "Bills", "Subscriptions", "Shopping", "Health", "Entertainment", "Loan / Debt", "Investment", "Other",
]

# ---------- Routes ----------

@api_router.get("/")
async def root():
    return {"message": "Duit Manis API", "time": datetime.now(timezone.utc).isoformat()}

@api_router.get("/health")
async def health():
    return {"ok": True, "llm_configured": bool(GEMINI_API_KEY or OPENAI_API_KEY or EMERGENT_LLM_KEY)}

@api_router.post("/ocr/receipt", response_model=ParsedTransaction)
async def ocr_receipt(req: ReceiptOCRRequest):
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 required")

    system = (
        "You are an expert Malaysian receipt and payment OCR extractor. "
        "Extract the TRUE FINAL BILL TOTAL amount (e.g. 8.90 for McDonald's, NOT the 6% tax 0.50 line, NOT subtotal), "
        "the Merchant name (e.g. 'McDonald\'s', 'Gerbang Alaf Restaurants', 'FamilyMart', 'KFC', '99 Speedmart', 'Petronas', 'Touch \'n Go'), "
        "the date (YYYY-MM-DD), the appropriate category from " + str(CATEGORIES) + ", and account used. "
        "Return ONLY a JSON object."
    )
    prompt = (
        "Analyze this Malaysian receipt/screenshot carefully. Return JSON with fields:\n"
        "{\n"
        "  \"amount\": <number, total amount paid in MYR e.g. 8.90>,\n"
        "  \"merchant\": <string, clean business or restaurant name>,\n"
        "  \"date\": \"YYYY-MM-DD\",\n"
        "  \"category\": <one of " + str(CATEGORIES) + ">,\n"
        "  \"account\": <string, e.g. 'Touch n Go eWallet', 'MAE / Maybank', 'Credit Card', 'Cash Wallet'>,\n"
        "  \"note\": <short description of items bought>\n"
        "}"
    )

    try:
        text = await _run_llm(system, prompt, image_b64=req.image_base64)
        data = (_extract_json(text) if text else None) or {}
        if not isinstance(data, dict):
            data = {}
        
        amt = None
        if data.get("amount") is not None:
            try:
                amt = float(data.get("amount"))
            except Exception:
                amt = None

        return ParsedTransaction(
            amount=amt,
            merchant=data.get("merchant") or "Scanned Receipt",
            date=data.get("date", datetime.now().strftime("%Y-%m-%d")),
            category=data.get("category") if data.get("category") in CATEGORIES else "Makan",
            account=data.get("account", "Touch n Go eWallet"),
            note=data.get("note", "Scanned Receipt"),
            raw=text or "local-fallback",
        )
    except Exception as e:
        logger.warning(f"ocr_receipt error: {e}")
        return ParsedTransaction(
            amount=None,
            merchant="Scanned Receipt",
            date=datetime.now().strftime("%Y-%m-%d"),
            category="Makan",
            account="Touch n Go eWallet",
            note="Scanned Receipt",
            raw="error-fallback"
        )

@api_router.post("/ocr/statement", response_model=StatementResponse)
async def ocr_statement(req: StatementOCRRequest):
    if not req.image_base64 and not req.text:
        raise HTTPException(status_code=400, detail="Provide image_base64 or text")

    system = (
        "You are an expert Malaysian bank e-statement reader (Maybank, CIMB, Public Bank, RHB, Hong Leong). "
        "Extract every transaction line item from the statement table. "
        "Ignore statement summary / beginning balance / ending balance / account number rows. "
        "Return ONLY strict JSON in the format: {\"transactions\": [ { \"amount\": number, \"merchant\": string, \"date\": \"YYYY-MM-DD\", \"category\": string, \"note\": string } ]}"
    )
    prompt = (
        "Extract all individual transactions from this bank statement. "
        f"For each transaction, assign category from {CATEGORIES}. "
        "Amount should be a positive number for expenses. Return JSON object with 'transactions' array."
    )
    if req.text:
        prompt = f"Statement text:\n{req.text}\n\n{prompt}"

    try:
        text = await _run_llm(system, prompt, image_b64=req.image_base64)
        data = _extract_json(text) or {}
        rows = data.get("transactions", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
        txns: List[ParsedTransaction] = []
        for r in rows[:200]:
            if not isinstance(r, dict):
                continue
            try:
                amt = float(r.get("amount")) if r.get("amount") is not None else None
            except Exception:
                amt = None
            if amt and amt > 0:
                txns.append(ParsedTransaction(
                    amount=amt,
                    merchant=r.get("merchant") or "Bank Transaction",
                    date=r.get("date") or datetime.now().strftime("%Y-%m-%d"),
                    category=r.get("category") if r.get("category") in CATEGORIES else "Bills",
                    account=r.get("account") or "MAE / Maybank",
                    note=r.get("note") or r.get("merchant"),
                ))
        return StatementResponse(transactions=txns)
    except Exception as e:
        logger.exception(f"ocr_statement failed: {e}")
        return StatementResponse(transactions=[])

def _generate_heuristic_insights(txns: List[dict]) -> InsightResponse:
    amounts = [float(t.get("amount", 0) or 0) for t in txns if t.get("amount")]
    total = sum(amounts)
    categories = [t.get("category", "Other") for t in txns if t.get("category")]
    top_cat = Counter(categories).most_common(1)[0][0] if categories else "General"
    
    summary = f"You've logged {len(txns)} transactions totaling RM {total:.2f}. Your top spending category is {top_cat}!"
    tips = [
        f"Keep an eye on {top_cat} — setting a weekly budget can save you RM 50-100.",
        "Transfer a small fixed amount to your savings or investment account on payday.",
        "Review your e-wallet auto-reload thresholds to curb impulse spends.",
        "Keep scanning receipts immediately so no daily expenses slip through the cracks!"
    ]
    return InsightResponse(summary=summary, tips=tips)

@api_router.post("/insights", response_model=InsightResponse)
async def insights(req: InsightRequest):
    if not req.transactions:
        return InsightResponse(
            summary="No transactions logged yet! Track a few expenses to unlock personalized AI insights.",
            tips=[
                "Scan a receipt or tap + to log your daily coffee or makan expenses.",
                "Set your hourly wage rate to see purchases in working hours.",
                "Review your monthly budget progress on the Home screen."
            ]
        )

    system = (
        "You are a friendly Malaysian personal finance coach for DoughTime. "
        "Give actionable, culturally aware spending feedback in 1-2 friendly sentences and 3-4 bullet tips. "
        "Always express trade-offs in Malaysian Ringgit (RM). Return JSON: {\"summary\": \"...\", \"tips\": [\"...\", \"...\"]}"
    )
    prompt = f"Analyze these transactions:\n{json.dumps(req.transactions[:40])}"

    try:
        text = await _run_llm(system, prompt)
        data = _extract_json(text)
        if isinstance(data, dict) and "summary" in data and "tips" in data:
            return InsightResponse(summary=data["summary"], tips=data["tips"][:4])
    except Exception as e:
        logger.warning(f"insights error: {e}")

    return _generate_heuristic_insights(req.transactions)

# ---------- Cloud Sync Helpers & Routes ----------

def _normalize_sync_code(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    clean = re.sub(r"[^A-Za-z0-9]", "", code).upper()
    if clean.startswith("DT") and len(clean) >= 8:
        return f"DT-{clean[2:5]}-{clean[5:8]}"
    elif len(clean) == 6:
        return f"DT-{clean[0:3]}-{clean[3:6]}"
    return clean

def _generate_unique_sync_code(conn: sqlite3.Connection) -> str:
    chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    for _ in range(50):
        c1 = "".join(random.choices(chars, k=3))
        c2 = "".join(random.choices(chars, k=3))
        code = f"DT-{c1}-{c2}"
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM vaults WHERE sync_code = ?", (code,))
        if not cur.fetchone():
            return code
    return f"DT-{uuid.uuid4().hex[:6].upper()}"

def _fetch_vault_row(conn: sqlite3.Connection, query: str):
    cur = conn.cursor()
    norm_code = _normalize_sync_code(query)
    # Check by sync_id, sync_code, or normalized sync_code
    cur.execute(
        "SELECT sync_id, sync_code, data_json, last_modified, created_at FROM vaults WHERE sync_id = ? OR sync_code = ? OR sync_code = ?",
        (query, query, norm_code or query)
    )
    return cur.fetchone()

@api_router.post("/sync/register", response_model=SyncRegisterResponse)
async def sync_register(req: SyncRegisterRequest):
    conn = sqlite3.connect(DB_PATH)
    try:
        if req.sync_id or req.sync_code:
            row = _fetch_vault_row(conn, req.sync_id or req.sync_code or "")
            if row:
                return SyncRegisterResponse(sync_id=row[0], sync_code=row[1], is_new=False)
        
        # Create new registration
        new_sync_id = req.sync_id or str(uuid.uuid4())
        new_sync_code = _normalize_sync_code(req.sync_code) if req.sync_code else _generate_unique_sync_code(conn)
        now_iso = datetime.now(timezone.utc).isoformat()
        
        empty_data = json.dumps({
            "accounts": [],
            "transactions": [],
            "wage_settings": None,
            "budget_settings": None,
            "last_modified": now_iso
        })
        
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO vaults (sync_id, sync_code, data_json, last_modified, created_at) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(sync_id) DO UPDATE SET sync_code = excluded.sync_code",
            (new_sync_id, new_sync_code, empty_data, now_iso, now_iso)
        )
        conn.commit()
        return SyncRegisterResponse(sync_id=new_sync_id, sync_code=new_sync_code, is_new=True)
    finally:
        conn.close()

@api_router.post("/sync/push", response_model=VaultDataResponse)
async def sync_push(req: VaultPushRequest):
    if not req.sync_id:
        raise HTTPException(status_code=400, detail="sync_id is required")
        
    conn = sqlite3.connect(DB_PATH)
    try:
        now_iso = req.last_modified or datetime.now(timezone.utc).isoformat()
        row = _fetch_vault_row(conn, req.sync_id)
        
        sync_code = row[1] if row else (_normalize_sync_code(req.sync_code) or _generate_unique_sync_code(conn))
        
        vault_payload = {
            "accounts": req.accounts,
            "transactions": req.transactions,
            "wage_settings": req.wage_settings,
            "budget_settings": req.budget_settings,
            "last_modified": now_iso,
        }
        
        cur = conn.cursor()
        if row:
            cur.execute(
                "UPDATE vaults SET data_json = ?, last_modified = ? WHERE sync_id = ?",
                (json.dumps(vault_payload), now_iso, row[0])
            )
        else:
            cur.execute(
                "INSERT INTO vaults (sync_id, sync_code, data_json, last_modified, created_at) VALUES (?, ?, ?, ?, ?)",
                (req.sync_id, sync_code, json.dumps(vault_payload), now_iso, now_iso)
            )
        conn.commit()
        
        return VaultDataResponse(
            success=True,
            sync_id=req.sync_id,
            sync_code=sync_code,
            accounts=req.accounts,
            transactions=req.transactions,
            wage_settings=req.wage_settings,
            budget_settings=req.budget_settings,
            last_modified=now_iso,
            message="Cloud backup successful"
        )
    finally:
        conn.close()

@api_router.get("/sync/pull", response_model=VaultDataResponse)
async def sync_pull(sync_key: str):
    if not sync_key:
        raise HTTPException(status_code=400, detail="sync_key parameter is required")
        
    conn = sqlite3.connect(DB_PATH)
    try:
        row = _fetch_vault_row(conn, sync_key)
        if not row:
            raise HTTPException(status_code=404, detail="Sync vault not found. Please check your Sync Code.")
            
        sync_id, sync_code, data_json, last_modified, _ = row
        data = json.loads(data_json)
        
        return VaultDataResponse(
            success=True,
            sync_id=sync_id,
            sync_code=sync_code,
            accounts=data.get("accounts", []),
            transactions=data.get("transactions", []),
            wage_settings=data.get("wage_settings"),
            budget_settings=data.get("budget_settings"),
            last_modified=last_modified,
            message="Cloud restore successful"
        )
    finally:
        conn.close()

@api_router.post("/sync/merge", response_model=VaultDataResponse)
async def sync_merge(req: VaultMergeRequest):
    if not req.sync_id:
        raise HTTPException(status_code=400, detail="sync_id is required")
        
    conn = sqlite3.connect(DB_PATH)
    try:
        row = _fetch_vault_row(conn, req.sync_id)
        now_iso = req.last_modified or datetime.now(timezone.utc).isoformat()
        
        if not row:
            # First time sync: just push
            sync_code = _normalize_sync_code(req.sync_code) or _generate_unique_sync_code(conn)
            vault_payload = {
                "accounts": req.accounts,
                "transactions": req.transactions,
                "wage_settings": req.wage_settings,
                "budget_settings": req.budget_settings,
                "last_modified": now_iso,
            }
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO vaults (sync_id, sync_code, data_json, last_modified, created_at) VALUES (?, ?, ?, ?, ?)",
                (req.sync_id, sync_code, json.dumps(vault_payload), now_iso, now_iso)
            )
            conn.commit()
            return VaultDataResponse(
                success=True,
                sync_id=req.sync_id,
                sync_code=sync_code,
                accounts=req.accounts,
                transactions=req.transactions,
                wage_settings=req.wage_settings,
                budget_settings=req.budget_settings,
                last_modified=now_iso,
                message="Cloud vault created and merged"
            )
            
        sync_id, sync_code, data_json, cloud_last_mod, _ = row
        cloud_data = json.loads(data_json)
        
        # Smart transaction merge: union by transaction id, sort descending by date
        cloud_txns = {t.get("id"): t for t in cloud_data.get("transactions", []) if t.get("id")}
        for t in req.transactions:
            if t.get("id"):
                cloud_txns[t["id"]] = t
        merged_txns = sorted(list(cloud_txns.values()), key=lambda x: (x.get("date", ""), x.get("createdAt", "")), reverse=True)
        
        # Smart account merge: union by account id
        cloud_accs = {a.get("id"): a for a in cloud_data.get("accounts", []) if a.get("id")}
        for a in req.accounts:
            if a.get("id"):
                cloud_accs[a["id"]] = a
        merged_accs = list(cloud_accs.values())
        
        merged_wage = req.wage_settings or cloud_data.get("wage_settings")
        merged_budget = req.budget_settings or cloud_data.get("budget_settings")
        
        merged_payload = {
            "accounts": merged_accs,
            "transactions": merged_txns,
            "wage_settings": merged_wage,
            "budget_settings": merged_budget,
            "last_modified": now_iso,
        }
        
        cur = conn.cursor()
        cur.execute(
            "UPDATE vaults SET data_json = ?, last_modified = ? WHERE sync_id = ?",
            (json.dumps(merged_payload), now_iso, sync_id)
        )
        conn.commit()
        
        return VaultDataResponse(
            success=True,
            sync_id=sync_id,
            sync_code=sync_code,
            accounts=merged_accs,
            transactions=merged_txns,
            wage_settings=merged_wage,
            budget_settings=merged_budget,
            last_modified=now_iso,
            message="Merged with Cloud vault successfully"
        )
    finally:
        conn.close()

@api_router.post("/shortcut/add")
@api_router.get("/shortcut/add")
async def shortcut_quick_add(
    sync_code: str,
    amount: float,
    category: Optional[str] = "Makan",
    merchant: Optional[str] = "",
    note: Optional[str] = "",
    account_name: Optional[str] = None
):
    if not sync_code or amount <= 0:
        raise HTTPException(status_code=400, detail="Valid sync_code and positive amount are required")
        
    conn = sqlite3.connect(DB_PATH)
    try:
        row = _fetch_vault_row(conn, sync_code)
        if not row:
            raise HTTPException(status_code=404, detail=f"Sync Vault '{sync_code}' not found. Please check your Sync Code in DoughTime.")
            
        sync_id, actual_sync_code, data_json, _, _ = row
        data = json.loads(data_json)
        
        accounts = data.get("accounts", [])
        transactions = data.get("transactions", [])
        wage_settings = data.get("wage_settings") or {"hourlyRate": 25.96}
        budget_settings = data.get("budget_settings") or {}
        
        # Pick matching or default liquid account
        target_account = None
        if account_name:
            target_account = next((a for a in accounts if a.get("name", "").lower() == account_name.lower()), None)
        if not target_account:
            target_account = next((a for a in accounts if a.get("type") in ["bank", "ewallet", "cash"]), accounts[0] if accounts else None)
            
        target_acc_id = target_account.get("id") if target_account else None
        
        # Generate new transaction record
        now_dt = datetime.now()
        now_iso = now_dt.strftime("%Y-%m-%d")
        txn_id = f"txn_{uuid.uuid4().hex[:10]}"
        
        new_txn = {
            "id": txn_id,
            "amount": float(amount),
            "category": category or "Makan",
            "merchant": merchant or (category or "Quick Expense"),
            "date": now_iso,
            "accountId": target_acc_id,
            "note": note or "Added via iOS Back Tap Shortcut ⚡",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        
        transactions.insert(0, new_txn)
        
        # Update account balance if found
        if target_account:
            for acc in accounts:
                if acc.get("id") == target_acc_id:
                    acc["balance"] = round(acc.get("balance", 0) - float(amount), 2)
                    break
                    
        hourly_rate = float(wage_settings.get("hourlyRate") or 25.96)
        work_hours = round(float(amount) / (hourly_rate or 1), 1)
        
        # Update vault in DB
        now_utc_iso = datetime.now(timezone.utc).isoformat()
        updated_payload = {
            "accounts": accounts,
            "transactions": transactions,
            "wage_settings": wage_settings,
            "budget_settings": budget_settings,
            "last_modified": now_utc_iso
        }
        
        cur = conn.cursor()
        cur.execute(
            "UPDATE vaults SET data_json = ?, last_modified = ? WHERE sync_id = ?",
            (json.dumps(updated_payload), now_utc_iso, sync_id)
        )
        conn.commit()
        
        return {
            "success": True,
            "message": f"Recorded RM {amount:.2f} for {category}! ({work_hours} hrs of work 🍞)",
            "amount": amount,
            "category": category,
            "work_hours": f"{work_hours} hrs",
            "account": target_account.get("name") if target_account else "Default",
            "sync_code": actual_sync_code
        }
    finally:
        conn.close()

@api_router.get("/sync/status")
async def sync_status(sync_key: str):
    conn = sqlite3.connect(DB_PATH)
    try:
        row = _fetch_vault_row(conn, sync_key)
        if not row:
            return {"exists": False, "message": "Vault not found"}
        
        sync_id, sync_code, data_json, last_modified, created_at = row
        data = json.loads(data_json)
        return {
            "exists": True,
            "sync_id": sync_id,
            "sync_code": sync_code,
            "last_modified": last_modified,
            "created_at": created_at,
            "transaction_count": len(data.get("transactions", [])),
            "account_count": len(data.get("accounts", [])),
        }
    finally:
        conn.close()

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
