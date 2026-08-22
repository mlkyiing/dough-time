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
        "ai_status": "ready" if (GEMINI_API_KEY or OPENAI_API_KEY) else "smart-fallback",
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

async def _call_gemini_api(system: str, prompt: str, image_b64: Optional[str] = None) -> Optional[str]:
    """Calls Google Gemini 1.5 Flash directly via REST API"""
    if not GEMINI_API_KEY:
        return None
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    parts = []
    if image_b64:
        # Clean base64 header if present
        clean_b64 = image_b64.split(",")[-1].strip()
        parts.append({
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": clean_b64
            }
        })
    parts.append({"text": f"{system}\n\n{prompt}"})
    
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            candidates = data.get("candidates", [])
            if candidates:
                content = candidates[0].get("content", {})
                parts = content.get("parts", [])
                if parts:
                    return parts[0].get("text", "")
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
    return None

async def _call_openai_api(system: str, prompt: str, image_b64: Optional[str] = None) -> Optional[str]:
    """Calls OpenAI GPT-4o-mini directly via REST API"""
    if not OPENAI_API_KEY:
        return None
    
    url = "https://api.openai.com/v1/chat/completions"
    
    user_content = []
    if image_b64:
        clean_b64 = image_b64 if image_b64.startswith("data:") else f"data:image/jpeg;base64,{image_b64}"
        user_content.append({"type": "image_url", "image_url": {"url": clean_b64}})
    user_content.append({"type": "text", "text": prompt})
    
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content if image_b64 else prompt}
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
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
    except Exception as e:
        logger.error(f"OpenAI API call failed: {e}")
    return None

async def _call_emergent_api(system: str, prompt: str, image_b64: Optional[str] = None) -> Optional[str]:
    """Calls OpenAI-compatible Emergent API endpoint via REST"""
    if not EMERGENT_LLM_KEY:
        return None
    
    url = "https://api.openai.com/v1/chat/completions"
    user_content = []
    if image_b64:
        clean_b64 = image_b64 if image_b64.startswith("data:") else f"data:image/jpeg;base64,{image_b64}"
        user_content.append({"type": "image_url", "image_url": {"url": clean_b64}})
    user_content.append({"type": "text", "text": prompt})
    
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content if image_b64 else prompt}
        ],
        "response_format": {"type": "json_object"}
    }
    
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
    except Exception as e:
        logger.error(f"Emergent API call failed: {e}")
    return None

async def _run_llm(system: str, user_text: str, image_b64: Optional[str] = None) -> Optional[str]:
    # 1. Try Gemini
    if GEMINI_API_KEY:
        result = await _call_gemini_api(system, user_text, image_b64)
        if result:
            return result
            
    # 2. Try OpenAI
    if OPENAI_API_KEY:
        result = await _call_openai_api(system, user_text, image_b64)
        if result:
            return result
            
    # 3. Try Emergent Key
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
        "You are an OCR assistant for Malaysian payment receipts and e-wallet screenshots "
        "(Touch 'n Go eWallet, MAE, DuitNow Transfer, Maybank, GrabPay, Boost, Public Bank, CIMB, RHB, GXBank). "
        "Extract the transaction accurately. Look for fields like: Amount (e.g. RM 250.54), Beneficiary/Recipient/Merchant, "
        "Recipient Reference/Memo, and Transaction Date. Return ONLY strict JSON with no markdown formatting."
    )
    prompt = (
        "Extract the transaction from this Malaysian payment receipt/screenshot. Return JSON with fields: "
        "amount (number in MYR, e.g. 250.54, no currency symbol), "
        "merchant (string, e.g. recipient name, merchant name, or 'DuitNow - LEE KOK LEONG'), "
        f"date (YYYY-MM-DD), category (one of {CATEGORIES}), "
        "account (e.g. 'Touch n Go eWallet', 'MAE', 'Maybank', 'CIMB', 'GrabPay', 'Public Bank', 'Cash'), "
        "note (short string with reference/details like 'Top up car insurance'). If unknown, use null. Return JSON object only."
    )

    try:
        text = await _run_llm(system, prompt, image_b64=req.image_base64)
        data = (_extract_json(text) if text else None) or {}
        if not isinstance(data, dict):
            data = {}
        
        # Fallback if no LLM responded
        if not data and not text:
            data = {
                "amount": None,
                "merchant": "Payment Receipt",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "category": "Bills",
                "account": "Maybank",
                "note": "Scanned Receipt"
            }

        return ParsedTransaction(
            amount=(float(data.get("amount")) if data.get("amount") is not None else None),
            merchant=data.get("merchant", "Scanned Receipt"),
            date=data.get("date", datetime.now().strftime("%Y-%m-%d")),
            category=data.get("category") if data.get("category") in CATEGORIES else "Bills",
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
            category="Bills",
            account="Touch n Go eWallet",
            note="Scanned Receipt",
            raw="error-fallback"
        )

@api_router.post("/ocr/statement", response_model=StatementResponse)
async def ocr_statement(req: StatementOCRRequest):
    if not req.image_base64 and not req.text:
        raise HTTPException(status_code=400, detail="Provide image_base64 or text")

    system = (
        "You parse Malaysian bank e-statements. Return ONLY strict JSON, no prose. "
        "Return an object with key 'transactions' whose value is an array."
    )
    prompt = (
        "Extract every transaction row. For each, return "
        "{amount (positive number MYR, expenses positive), merchant (string), "
        f"date (YYYY-MM-DD), category (one of {CATEGORIES}), account (string), note (string)}}. "
        "Ignore balance-only lines. Return JSON: {\"transactions\": [...]}"
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
            txns.append(ParsedTransaction(
                amount=amt,
                merchant=r.get("merchant"),
                date=r.get("date"),
                category=r.get("category") if r.get("category") in CATEGORIES else None,
                account=r.get("account"),
                note=r.get("note"),
            ))
        return StatementResponse(transactions=txns)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("ocr_statement failed")
        raise HTTPException(status_code=500, detail=f"Statement parse failed: {e}")

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
            summary="No transactions yet. Log a few and I'll spot your spending vibes!",
            tips=[
                "Try logging every kopi and makan for 3 days to see patterns.",
                "Set a weekly budget for Makan — the biggest lever for most Malaysians.",
                "Automate: scan receipts right after paying so nothing slips.",
            ],
        )

    system = (
        "You are a warm, encouraging Malaysian personal finance coach. Speak in a "
        "friendly, cute tone (light use of local flavor, no cringe). Currency: MYR (RM). "
        "Return ONLY strict JSON."
    )
    sample = req.transactions[:120]
    prompt = (
        "Given these transactions, analyze spending habits and return JSON: "
        "{\"summary\": \"2-3 sentence overview\", \"tips\": [\"tip1\", \"tip2\", \"tip3\", \"tip4\"]}. "
        "Tips should be specific, actionable, and reference the actual data (categories, merchants, amounts in RM). "
        f"Transactions:\n{json.dumps(sample)}"
    )

    try:
        text = await _run_llm(system, prompt)
        data = _extract_json(text) or {}
        summary = data.get("summary") if isinstance(data, dict) else None
        tips = data.get("tips") if isinstance(data, dict) else None
        if not summary:
            return _generate_heuristic_insights(req.transactions)
        if not isinstance(tips, list) or not tips:
            tips = ["Keep logging daily — patterns emerge in a week!"]
        return InsightResponse(summary=summary, tips=[str(t) for t in tips][:6])
    except Exception as e:
        logger.warning(f"LLM insights fallback: {e}")
        return _generate_heuristic_insights(req.transactions)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
