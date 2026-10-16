
"""Test the AMD LLM connection using a sample machine investigation."""

from app.llm_client import generate_investigation_report

prediction = {
    "risk_score": 0.78,
    "risk_level": "high",
    "mode": "trained_random_forest",
}

evidence = [
    {
        "factor": "Elevated tool wear",
        "observation": "Tool wear is 211 minutes.",
        "suggested_check": "Inspect tool condition.",
    },
    {
        "factor": "Large temperature differential",
        "observation": "Temperature difference is 13.7 K.",
        "suggested_check": "Check the cooling system.",
    },
    {
        "factor": "High torque at low speed",
        "observation": "Torque is 64 Nm at 1170 rpm.",
        "suggested_check": "Inspect the mechanical load.",
    },
]

print("Connecting to AMD Token Factory...")

report = generate_investigation_report(
    machine_id="MC-104",
    prediction=prediction,
    evidence=evidence,
)

print("\n=== CAUSYN AI LLM REPORT ===\n")
print(report)
