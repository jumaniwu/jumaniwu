#!/usr/bin/env bash
# Starts both the FastAPI backend and Next.js frontend.
# Run from the repo root: ./start.sh

set -e
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== HFT Dashboard Startup ==="

# ── Backend ────────────────────────────────────────────────────────────────
echo "[1/3] Installing Python dependencies..."
cd "$REPO_ROOT/backend"
pip install -r requirements.txt -q

echo "[2/3] Starting FastAPI mock server on :8000..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "      Backend PID: $BACKEND_PID"

# ── Frontend ───────────────────────────────────────────────────────────────
echo "[3/3] Installing Node dependencies and starting Next.js on :3000..."
cd "$REPO_ROOT/dashboard"
npm install --silent
npm run dev &
FRONTEND_PID=$!
echo "      Frontend PID: $FRONTEND_PID"

echo ""
echo "=== READY ==="
echo "  Backend  → http://localhost:8000/health"
echo "  Frontend → http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both services."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
