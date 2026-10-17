from fastapi.testclient import TestClient
from concurrent.futures import ThreadPoolExecutor
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


MC104 = {
    "machine_id": "MC-104", "air_temperature": 304.2,
    "process_temperature": 317.9, "rotational_speed": 1170,
    "torque": 64, "tool_wear": 211,
}


def test_what_if_concurrent_predictions_match_sequential_requests():
    hypothetical = {**MC104, "torque": 45, "tool_wear": 100}
    inputs = [MC104, hypothetical]
    sequential = [client.post("/predict", json=payload) for payload in inputs]
    with ThreadPoolExecutor(max_workers=2) as pool:
        concurrent = list(pool.map(lambda payload: client.post("/predict", json=payload), inputs))
    for original, parallel in zip(sequential, concurrent):
        assert original.status_code == parallel.status_code == 200
        assert original.json() == parallel.json()
        assert parallel.json()["mode"] == "trained_random_forest"
        assert 0 <= parallel.json()["risk_score"] <= 1
    assert MC104["torque"] == 64
    assert MC104["tool_wear"] == 211
