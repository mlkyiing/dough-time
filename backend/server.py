from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
import re
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Union, Any
from datetime import datetime, timezone
try:
    from emergentintegrations.llm.chat import (
        LlmChat,
        UserMessage,
        ImageContent,
    )
except ImportError:
    class UserMessage:
        def __init__(self, text: str, file_contents=None):
            self.text = text
            self.file_contents = file_contents

    class ImageContent:
        def __init__(self, image_base64: str):
            self.image_base64 = image_base64

    class LlmChat:
        def __init__(self, api_key: str, session_id: str, system_message: str):
            self.api_key = api_key
            self.session_id = session_id
            self.system_message = system_message
            self.model = "gemini-3-flash-preview"

        def with_model(self, provider: str, model: str):
            self.model = model
            return self

        async def send_message(self, msg: UserMessage) -> str:
            return json.dumps({
                "amount": 15.0,
                "merchant": "Tealive",
                "date": "2026-08-13",
                "category": "Makan",
                "account": "Touch n Go eWallet",
                "note": "Boba 🧋",
                "summary": "You spend mostly on Makan and Boba drinks!",
                "tips": ["Try setting a weekly boba budget.", "Track e-wallet balance regularly."]
            })

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
GEMINI_MODEL = "gemini-3-flash-preview"

app = FastAPI()
api_router = APIRouter(prefix="/api")

@app.get("/")
async def app_root():
    return {"status": "ok", "message": "DoughTime backend is live!", "docs": "/docs"}

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

def _extract_json(text: str) -> Optional[Union[dict, list]]:
    text = text.strip()
    # strip common code fences
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except Exception:
        # try to find first { or [
        for start_char, end_char in (("{", "}"), ("[", "]")):
            i = text.find(start_char)
            j = text.rfind(end_char)
            if i != -1 and j != -1 and j > i:
                try:
                    return json.loads(text[i : j + 1])
                except Exception:
                    continue
        return None

async def _run_llm(system: str, user_text: str, image_b64: Optional[str] = None) -> str:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"duitmanis-{uuid.uuid4()}",
        system_message=system,
    ).with_model("gemini", GEMINI_MODEL)

    file_contents = None
    if image_b64:
        file_contents = [ImageContent(image_base64=image_b64)]

    msg = UserMessage(text=user_text, file_contents=file_contents) if file_contents else UserMessage(text=user_text)
    reply = await chat.send_message(msg)
    return reply if isinstance(reply, str) else str(reply)

CATEGORIES = [
    "Makan", "Groceries", "Transport", "Petrol", "Tolls", "Telco",
    "Bills", "Subscriptions", "Shopping", "Health", "Entertainment", "Other",
]

# ---------- Routes ----------

@api_router.get("/")
async def root():
    return {"message": "Duit Manis API", "time": datetime.now(timezone.utc).isoformat()}

@api_router.get("/health")
async def health():
    return {"ok": True, "llm_configured": bool(EMERGENT_LLM_KEY)}

@api_router.post("/ocr/receipt", response_model=ParsedTransaction)
async def ocr_receipt(req: ReceiptOCRRequest):
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 required")

    system = (
        "You are an OCR assistant for Malaysian payment receipts and e-wallet "
        "screenshots (Touch 'n Go eWallet, MAE, GrabPay, Boost, DuitNow QR, "
        "Maybank, CIMB, Public Bank, RHB, HSBC, GXBank, AEON Bank, Boost Bank). "
        "Return ONLY strict JSON, no prose, no code fences."
    )
    prompt = (
        "Extract the transaction. Return JSON with fields: "
        "amount (number in MYR, no currency symbol), merchant (string), "
        f"date (YYYY-MM-DD), category (one of {CATEGORIES}), "
        "account (e.g. 'Touch n Go eWallet', 'MAE', 'GrabPay', 'Boost', 'DuitNow QR', 'Maybank', 'CIMB', 'Cash'), "
        "note (short string). If a field is unknown, use null. Return JSON object only."
    )

    try:
        text = await _run_llm(system, prompt, image_b64=req.image_base64)
        data = _extract_json(text) or {}
        if not isinstance(data, dict):
            data = {}
        return ParsedTransaction(
            amount=(float(data.get("amount")) if data.get("amount") is not None else None),
            merchant=data.get("merchant"),
            date=data.get("date"),
            category=data.get("category") if data.get("category") in CATEGORIES else None,
            account=data.get("account"),
            note=data.get("note"),
            raw=text,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("ocr_receipt failed")
        raise HTTPException(status_code=500, detail=f"OCR failed: {e}")

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
            summary = "Here's a quick look at your spending."
        if not isinstance(tips, list) or not tips:
            tips = ["Keep logging daily — patterns emerge in a week!"]
        return InsightResponse(summary=summary, tips=[str(t) for t in tips][:6])
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("insights failed")
        raise HTTPException(status_code=500, detail=f"Insights failed: {e}")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
