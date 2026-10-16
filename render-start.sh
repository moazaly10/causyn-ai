
#!/bin/sh
set -eu

echo "Starting CAUSYN AI Prediction API..."
cd /app/prediction
/opt/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
PREDICTION_PID=$!

echo "Starting CAUSYN AI Causal API and AMD Copilot..."
cd /app/causal
/opt/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 &
CAUSAL_PID=$!

cleanup() {
    kill "$PREDICTION_PID" "$CAUSAL_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Starting CAUSYN AI Frontend..."
cd /app/frontend

export PORT="${PORT:-10000}"
export HOSTNAME="0.0.0.0"

node server.js
