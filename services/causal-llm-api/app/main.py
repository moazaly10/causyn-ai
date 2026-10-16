"""Day 1 hypothesis rules; LLM and what-if implementation scheduled for Day 3."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.investigation import investigate_sensors
import json
from urllib.request import Request, urlopen
from urllib.error import URLError
from fastapi import HTTPException
from app.llm_client import generate_investigation_report, chat_with_engineer

app = FastAPI(title="CAUSYN Causal LLM API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

class SensorInput(BaseModel):
    machine_id: str = Field(min_length=1, max_length=60)
    air_temperature: float = Field(ge=200, le=450)
    process_temperature: float = Field(ge=200, le=500)
    rotational_speed: float = Field(ge=0, le=10000)
    torque: float = Field(ge=0, le=300)
    tool_wear: float = Field(ge=0, le=500)

    
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(SensorInput):
    question: str = Field(min_length=1, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=6)


class Hypothesis(BaseModel):
    factor: str
    explanation: str
    suggested_action: str

class AnalysisResult(BaseModel):
    machine_id: str
    mode: str
    hypotheses: list[Hypothesis]
    disclaimer: str

@app.get("/health")
def health():
    return {"status":"ok", "mode":"rules_only"}

@app.post("/causal/analyze", response_model=AnalysisResult)
def analyze(data: SensorInput):
    hypotheses = []
    if data.tool_wear > 150:
        hypotheses.append(Hypothesis(factor="Elevated tool wear", explanation="Tool wear exceeds the demonstration threshold of 150 minutes and may contribute to equipment stress.", suggested_action="Inspect tool condition and maintenance history."))
    if data.process_temperature - data.air_temperature > 12:
        hypotheses.append(Hypothesis(factor="Large temperature differential", explanation="Process-to-air temperature difference exceeds the demonstration threshold of 12 K.", suggested_action="Check cooling system and temperature sensor calibration."))
    if data.torque > 55 and data.rotational_speed < 1400:
        hypotheses.append(Hypothesis(factor="High torque at low speed", explanation="This operating combination may warrant checking for mechanical load or friction.", suggested_action="Inspect drive train and load conditions."))
    return AnalysisResult(machine_id=data.machine_id, mode="rule_based_mock_no_llm", hypotheses=hypotheses, disclaimer="Rules generate unverified hypotheses, not validated causal effects. No LLM or AMD GPU is connected.")

@app.post("/investigation/evidence")
def investigate(data: SensorInput):
    evidence = investigate_sensors(data)

    return {
        "machine_id": data.machine_id,
        "mode": "rule_based_evidence",
        "evidence": [
            item.model_dump() for item in evidence
        ],
    }

@app.post("/agent/investigate")
def agent_investigate(data: SensorInput):
    """Combine trained ML predictions with sensor evidence and an AMD AI report."""

    import os

    # Step 1: Request the Random Forest prediction.
    # This URL can be configured separately for Docker.
    prediction_url = os.getenv(
        "PREDICTION_API_URL",
        "http://127.0.0.1:8000/predict",
    )

    request = Request(
        prediction_url,
        data=json.dumps(data.model_dump()).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            prediction = json.load(response)
    except (URLError, TimeoutError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Prediction API is unavailable.",
        ) from exc

    # Step 2: Collect sensor evidence.
    evidence = [
        item.model_dump()
        for item in investigate_sensors(data)
    ]

    # Step 3: Generate the AMD AI investigation report.
    try:
        report = generate_investigation_report(
            machine_id=data.machine_id,
            prediction=prediction,
            evidence=evidence,
        )

        return {
            "machine_id": data.machine_id,
            "prediction": prediction,
            "evidence": evidence,
            "llm_status": "success",
            "llm_report": report,
        }

    except Exception:
        # Keep the ML result available if the AMD service fails.
        return {
            "machine_id": data.machine_id,
            "prediction": prediction,
            "evidence": evidence,
            "llm_status": "error",
            "llm_report": None,
        }

    
@app.post("/agent/chat")
def agent_chat(data: ChatRequest):
    """Answer engineer questions using ML predictions and sensor evidence."""
    import os

    # Step 1: Get the machine's current sensor readings.
    sensor_data = data.model_dump(
        exclude={"question", "history"}
    )

    # Step 2: Request a trained Random Forest prediction.
    request = Request(
        os.getenv("PREDICTION_API_URL", "http://127.0.0.1:8000/predict"),
        data=json.dumps(sensor_data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=5) as response:
            prediction = json.load(response)
    except (URLError, TimeoutError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Prediction API unavailable. Check port 8000.",
        ) from exc

    # Step 3: Collect rule-based sensor evidence.
    evidence = [
        item.model_dump()
        for item in investigate_sensors(data)
    ]

    # Step 4: Ask the AMD-hosted LLM.
    try:
        answer = chat_with_engineer(
            machine_id=data.machine_id,
            question=data.question,
            prediction=prediction,
            evidence=evidence,
            history=[
                message.model_dump()
                for message in data.history
                if message.role in ("user", "assistant")
            ],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="AI Copilot is temporarily unavailable.",
        ) from exc

    # Step 5: Return the answer to the frontend.
    return {
        "machine_id": data.machine_id,
        "answer": answer,
        "prediction": prediction,
        "evidence": evidence,
        "mode": "amd_llm_copilot",
        "disclaimer": (
            "AI-generated suggestions are not confirmed diagnoses. "
            "An engineer must verify findings before maintenance."
        ),
    }


    try:
        with urlopen(request, timeout=5) as response:
            prediction = json.load(response)
    except (URLError, TimeoutError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Prediction API unavailable. Check port 8000.",
        ) from exc

    # Step 2: Investigate the same machine's sensor readings.
    evidence = investigate_sensors(data)

   
    # Step 3: Prepare evidence for the LLM.
    evidence_dicts = [
        item.model_dump() for item in evidence
    ]

    # Step 4: Request an AMD LLM investigation report.
    # If AMD is unavailable, retain the ML and rule-based results.
    try:
        llm_report = generate_investigation_report(
            machine_id=data.machine_id,
            prediction=prediction,
            evidence=evidence_dicts,
        )
        llm_status = "success"
    except Exception:
        llm_report = None
        llm_status = "unavailable"

    # Step 5: Combine the results.
    return {
        "machine_id": data.machine_id,
        "mode": "ml_llm_investigation" if llm_report else "ml_rules_fallback",
        "prediction": prediction,
        "evidence": evidence_dicts,
        "llm_status": llm_status,
        "llm_report": llm_report,
        "disclaimer": (
            "The ML risk estimate is uncalibrated. "
            "Investigation findings are hypotheses, not proven causes. "
            "An engineer must verify findings before maintenance."
        ),
    }
