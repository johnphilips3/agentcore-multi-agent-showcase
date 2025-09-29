#!/bin/bash
cd backend
source .venv/bin/activate || uv venv && source .venv/bin/activate
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
