from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
BASE={"machine_id":"MC-1","air_temperature":298,"process_temperature":318,"rotational_speed":1200,"torque":65,"tool_wear":200}
def test_health():
    assert client.get("/health").status_code==200
def test_hypotheses():
    response=client.post("/causal/analyze",json=BASE)
    assert response.status_code==200
    assert len(response.json()["hypotheses"])==3
    assert response.json()["mode"]=="rule_based_mock_no_llm"
def test_invalid():
    assert client.post("/causal/analyze",json={**BASE,"rotational_speed":-5}).status_code==422
