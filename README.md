# CAUSYN AI — Predict. Understand. Prevent.

Industrial predictive-maintenance hackathon project. **Day 1 foundation**, not a finished AI system.

## What works today

- Next.js dashboard with 8 **synthetic** machines and explicitly illustrative risk indicators.
- FastAPI prediction service with a **deterministic demo heuristic**, not a trained model.
- Separate FastAPI causal analysis service with **unverified rule-based hypotheses**, not an LLM or causal proof.
- Dashboard can call both APIs when they are running.
- Basic automated API tests and Docker Compose configuration.

## Windows / VS Code quick start

Prerequisites: Node.js 20+ (prefer 22 LTS), Python 3.11+, npm. Open this folder in VS Code. Open **three PowerShell terminals**.

**Terminal 1 — prediction API:**
```powershell
cd services/prediction-api
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — causal analysis API:**
```powershell
cd services/causal-llm-api
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001
```

**Terminal 3 — dashboard:**
```powershell
cd frontend
npm install
npm run dev
```

Open:
- Dashboard: http://localhost:3000
- Prediction API docs: http://localhost:8000/docs
- Causal API docs: http://localhost:8001/docs

Click a machine row, then **Run demo analysis**. If an API is offline, the dashboard displays a connection error.

## Tests

Run inside each Python service directory after installing requirements:
```powershell
.venv\Scripts\python.exe -m pytest -q
```

For frontend type checking:
```powershell
npm run lint
```

## Docker (optional on Day 1)

If Docker Desktop is installed, from the repository root:
```powershell
docker compose up --build
```

Note: Browser API calls use localhost ports 8000/8001. If deployed remotely, configure public API URLs at frontend build time and tighten CORS for the deployment domain.

## Architecture

```text
frontend/                     Next.js dashboard
services/prediction-api/      FastAPI, demo predictor (Day 2: trained AI4I model)
services/causal-llm-api/      FastAPI, rule hypotheses (Day 3: what-if + LLM provider)
infra/amd/                    AMD Developer Cloud deployment plan (Day 5)
evolus/                       Optional workflow integration plan (Day 4)
```

## Schedule

- Oct 12: foundation and local demo (this package)
- Oct 13: train and evaluate AI4I 2020 scikit-learn model
- Oct 14: causal graph, what-if, AMD-compatible vLLM client
- Oct 15: local maintenance workflows and optional Evolus
- Oct 16: AMD GPU/vLLM deployment if credits are available
- Oct 17: testing, Docker, GitHub, README and demo
- Oct 18: submit before official deadline

## Security and limitations

Never commit `.env`, tokens, API keys, model weights, or customer data. `.env.example` contains placeholders only. The displayed risk percentages are synthetic and do not represent model probabilities. The causal rules are engineering hypotheses, not experimentally verified effects. No AMD deployment, paid services, or Evolus calls are included in Day 1.
