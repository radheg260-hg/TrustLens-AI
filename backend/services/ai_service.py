import json
import os

from google import genai


# ==========================================================
# TRUSTLENS AI — GEMINI SERVICE
# Phase 3.2
#
# IMPORTANT:
# AI is an enhancement.
# TrustLens must continue working if Gemini fails.
# ==========================================================


GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY"
)

GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.1-flash-lite"
)


# ==========================================================
# CLIENT
# ==========================================================

client = None


if GEMINI_API_KEY:

    try:

        client = genai.Client(
            api_key=GEMINI_API_KEY
        )

    except Exception as error:

        print(
            "Gemini client initialization failed:",
            error
        )

        client = None


# ==========================================================
# SYSTEM PROMPT
# ==========================================================

FRAUD_ANALYSIS_PROMPT = """
You are the AI fraud-analysis component of TrustLens.

Your task is to analyze the meaning, context, and intent of
user-provided text. The text may come directly from a message
or may have been extracted from a screenshot using OCR.

You must distinguish between:

1. A legitimate message DELIVERING sensitive information.
Example:
"1234 is your OTP for login. Valid for 10 minutes."

2. A suspicious message REQUESTING sensitive information.
Example:
"Send me the OTP you just received."

Do not classify content as dangerous merely because words
such as OTP, password, bank, login, reward, or verification
appear.

Focus on intent and context.

Look for:
- requests to share OTPs, passwords, PINs, CVVs
- impersonation
- urgency or threats
- payment requests
- suspicious rewards
- account-blocking threats
- remote-access requests
- credential harvesting
- social engineering
- unusual pressure
- attempts to redirect users to suspicious websites
- impersonation of delivery companies, banks, government agencies or brands
- fake package or delivery problems
- requests to confirm addresses or personal information through unfamiliar links
- suspicious domains pretending to belong to known brands
- OCR text where a URL is partially damaged or separated by spaces

Return ONLY valid JSON.

Required format:

{
  "ai_available": true,
  "classification": "low" | "suspicious" | "high",
  "ai_score": 0,
  "confidence": 0,
  "summary": "",
  "reasons": [],
  "safety_advice": ""
}

Rules:
- ai_score must be an integer from 0 to 100.
- confidence must be an integer from 0 to 100.
- reasons must be an array of short strings.
- Never guarantee that something is completely safe.
- Use "low" for content that appears legitimate but still
  requires normal caution.
"""


# ==========================================================
# SAFE FALLBACK RESULT
# ==========================================================

def ai_unavailable_result(
    reason="AI analysis unavailable."
):

    return {
        "ai_available": False,
        "classification": None,
        "ai_score": None,
        "confidence": None,
        "summary": reason,
        "reasons": [],
        "safety_advice": ""
    }


# ==========================================================
# NORMALIZE AI RESPONSE
# ==========================================================

def normalize_ai_result(
    data
):

    if not isinstance(
        data,
        dict
    ):

        return ai_unavailable_result(
            "AI returned an invalid response."
        )


    classification = str(
        data.get(
            "classification",
            ""
        )
    ).strip().lower()


    if classification not in {
        "low",
        "suspicious",
        "high"
    }:

        classification = "suspicious"


    try:

        ai_score = int(
            data.get(
                "ai_score",
                50
            )
        )

    except (
        TypeError,
        ValueError
    ):

        ai_score = 50


    ai_score = max(
        0,
        min(
            ai_score,
            100
        )
    )


    try:

        confidence = int(
            data.get(
                "confidence",
                0
            )
        )

    except (
        TypeError,
        ValueError
    ):

        confidence = 0


    confidence = max(
        0,
        min(
            confidence,
            100
        )
    )


    reasons = data.get(
        "reasons",
        []
    )


    if not isinstance(
        reasons,
        list
    ):

        reasons = []


    reasons = [
        str(reason).strip()
        for reason in reasons
        if str(reason).strip()
    ]


    return {
        "ai_available": True,

        "classification":
            classification,

        "ai_score":
            ai_score,

        "confidence":
            confidence,

        "summary":
            str(
                data.get(
                    "summary",
                    ""
                )
            ).strip(),

        "reasons":
            reasons,

        "safety_advice":
            str(
                data.get(
                    "safety_advice",
                    ""
                )
            ).strip()
    }


# ==========================================================
# GEMINI FRAUD ANALYSIS
# ==========================================================

def analyze_message_with_ai(
    content,
    content_type="message"
):

    text = str(
        content or ""
    ).strip()


    if not text:

        return ai_unavailable_result(
            "No content was provided for AI analysis."
        )


    if not client:

        return ai_unavailable_result(
            "Gemini is not configured."
        )


    try:


        source_context = (
        "The following text was extracted from a screenshot using OCR. "
        "OCR may contain missing spaces, broken URLs, spelling errors, "
    "misread characters, or incomplete sentences. Infer intent carefully "
    "from the available evidence."
        if content_type == "screenshot"
        else
        "The following content was entered directly by the user."
)

        prompt = (
    FRAUD_ANALYSIS_PROMPT
    + "\n\nSOURCE CONTEXT:\n"
    + source_context
    + "\n\nCONTENT TO ANALYZE:\n"
    + text
)


        response = (
            client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt
            )
        )


        raw_text = str(
            response.text or ""
        ).strip()


        # Remove common Markdown JSON fences if Gemini
        # includes them despite the instruction.

        if raw_text.startswith(
            "```"
        ):

            raw_text = raw_text.replace(
                "```json",
                "",
                1
            )

            raw_text = raw_text.replace(
                "```",
                "",
                1
            )

            if raw_text.endswith(
                "```"
            ):

                raw_text = (
                    raw_text[:-3]
                )


            raw_text = (
                raw_text.strip()
            )


        parsed = json.loads(
            raw_text
        )


        return normalize_ai_result(
            parsed
        )


    except Exception as error:

        # CRITICAL:
        # AI failure must NEVER stop TrustLens.

        print(
            "Gemini AI unavailable:",
            error
        )


        return ai_unavailable_result(
            "AI enhancement is temporarily unavailable."
        )