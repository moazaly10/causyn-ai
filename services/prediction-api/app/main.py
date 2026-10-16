
"""CAUSYN AI prediction API powered by the trained AI4I model."""

from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Load the model trained on the AI4I 2020 dataset.
MODEL_PATH = Path(__file__).resolve().parent / "model.joblib"
model = joblib.load(MODEL_PATH)

FEATURES = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]

app = FastAPI(title="CAUSYN Prediction API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class SensorInput(BaseModel):
    machine_id: str = Field(min_length=1, max_length=60)
    air_temperature: float = Field(ge=200, le=450)
    process_temperature: float = Field(ge=200, le=500)
    rotational_speed: float = Field(ge=0, le=10000)
    torque: float = Field(ge=0, le=300)
    tool_wear: float = Field(ge=0, le=500)


class PredictionResult(BaseModel):
    machine_id: str
    risk_score: float
    risk_level: str
    predicted_failure: bool
    mode: str
    message: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "trained_random_forest",
        "model_loaded": True,
    }


@app.post("/predict", response_model=PredictionResult)
def predict(data: SensorInput):
    # Match the feature names and order used during training.
    input_df = pd.DataFrame(
        [[
            data.air_temperature,
            data.process_temperature,
            data.rotational_speed,
            data.torque,
            data.tool_wear,
        ]],
        columns=FEATURES,
    )

    # Estimated failure probability from the trained classifier.
    # This probability has not been calibrated.
    failure_index = list(model.classes_).index(1)
    score = float(model.predict_proba(input_df)[0][failure_index])

    # Demo display bands, not validated maintenance thresholds.
    level = (
        "high" if score >= 0.7
        else "medium" if score >= 0.4
        else "low"
    )

    return PredictionResult(
        machine_id=data.machine_id,
        risk_score=round(score, 3),
        risk_level=level,
        predicted_failure=bool(model.predict(input_df)[0]),
        mode="trained_random_forest",
        message=(
            "Random Forest prediction trained on AI4I 2020. "
            "Probability is uncalibrated; results are for demonstration."
        ),
    )
