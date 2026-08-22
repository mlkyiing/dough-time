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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

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
        "message": "DoughTime backend is live!",
        "ai_status": "ready" if (GEMINI_API_KEY or OPENAI_API_KEY or EMERGENT_LLM_KEY) else "smart-fallback",
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

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
