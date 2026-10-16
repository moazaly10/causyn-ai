
"""AMD-hosted LLM client for CAUSYN AI investigation reports."""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI


# The private .env file is in the causal-llm-api directory.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def generate_investigation_report(
    machine_id: str,
    prediction: dict,
    evidence: list[dict],
) -> str:
    """Generate a maintenance investigation report with an AMD-hosted LLM."""

    api_key = os.getenv("AMD_API_KEY")

    if not api_key:
        raise RuntimeError("AMD_API_KEY is missing from the .env file.")

    client = OpenAI(
        api_key=api_key,
        base_url=os.getenv(
            "AMD_BASE_URL",
            "https://developer.amd.com.cn/radeon/api/v1",
        ),
        timeout=60.0,
        max_retries=1,
    )

    model = os.getenv("AMD_MODEL", "DeepSeek-V4-Flash")

    # Supply only the measurements and results we actually have.
    investigation_data = {
        "machine_id": machine_id,
        "prediction": prediction,
        "sensor_evidence": evidence,
    }

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are CAUSYN AI, a predictive maintenance "
                    "investigation assistant. "
                    "Use only the supplied machine measurements, "
                    "prediction, and sensor evidence. "
                    "Write a concise report with these headings: "
                    "Risk Summary, Possible Contributing Factors, "
                    "Recommended Checks, and Limitations. "
                    "Explain technical findings in clear language. "
                    "Do not invent sensor readings, maintenance "
                    "history, or equipment failures. "
                    "Never claim a root cause has been proven. "
                    "Treat the ML risk score as uncalibrated. "
                    "Recommend engineer review before any action."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(investigation_data),
            },
        ],
        max_tokens=600,
    )

    report = response.choices[0].message.content

    if not report:
        raise RuntimeError("The LLM returned an empty report.")

    return report


def chat_with_engineer(
    machine_id: str,
    question: str,
    prediction: dict,
    evidence: list[dict],
    history: list[dict] | None = None,
) -> str:
    """Answer engineer questions using ML results and sensor evidence."""

    api_key = os.getenv("AMD_API_KEY")

    if not api_key:
        raise RuntimeError("AMD_API_KEY is missing.")

    client = OpenAI(
        api_key=api_key,
        base_url=os.getenv(
            "AMD_BASE_URL",
            "https://developer.amd.com.cn/radeon/api/v1",
        ),
        timeout=60.0,
        max_retries=1,
    )

    context = {
        "machine_id": machine_id,
        "prediction": prediction,
        "sensor_evidence": evidence,
    }

    messages = [
        {
            "role": "system",
            "content": (
                "You are CAUSYN AI, an industrial maintenance copilot. "
                "Answer the engineer's questions using the supplied "
                "machine context. Be clear, practical, and concise. "
                "The Random Forest score is uncalibrated and does not "
                "predict when a failure will occur. "
                "Sensor rules flag possible contributing factors; "
                "they do not prove root causes or explain exactly "
                "why the Random Forest made its prediction. "
                "Never invent measurements, historical records, "
                "or completed inspections. "
                "If evidence is missing, explain what would help. "
                "Suggest checks, not unsupervised maintenance actions. "
                "An engineer must verify findings before acting."
            ),
        },
        {
            "role": "system",
            "content": "Current machine context: " + json.dumps(context),
        },
    ]

    # Include a limited number of previous conversation messages.
    for message in (history or [])[-6:]:
        if (
            message.get("role") in ("user", "assistant")
            and isinstance(message.get("content"), str)
        ):
            messages.append({
                "role": message["role"],
                "content": message["content"][:2000],
            })

    messages.append({
        "role": "user",
        "content": question,
    })

    response = client.chat.completions.create(
        model=os.getenv("AMD_MODEL", "DeepSeek-V4-Flash"),
        messages=messages,
        max_tokens=700,
    )

    answer = response.choices[0].message.content

    if not answer:
        raise RuntimeError("AMD LLM returned an empty response.")

    return answer
