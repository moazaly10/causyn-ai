from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)
BASE = {"machine_id":"MC-1","air_temperature":298,"process_temperature":310,"rotational_speed":1500,"torque":40,"tool_wear":20}
def test_health():
    assert client.get("/health").status_code == 200
def test_predict_trained_model():
    result = client.post("/predict", json=BASE)
    assert result.status_code == 200
    assert result.json()["mode"] == "trained_random_forest"
    assert 0 <= result.json()["risk_score"] <= 1
def test_invalid_sensor_rejected():
    assert client.post("/predict", json={**BASE, "tool_wear":-1}).status_code == 422
