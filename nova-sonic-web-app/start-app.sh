#!/bin/bash
set -e

echo "🎙️  Starting Nova Sonic Web App"
echo "================================"

# Function to handle cleanup
cleanup() {
    echo -e "\n🛑 Shutting down Nova Sonic..."
    jobs -p | xargs -r kill
    exit 0
}
trap cleanup SIGINT SIGTERM

# Start backend
echo "🚀 Starting backend server..."
cd backend
source .venv/bin/activate || (uv venv && source .venv/bin/activate)
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 5

# Start frontend
echo "🌐 Starting frontend server..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo -e "\n✅ Nova Sonic is running!"
echo "📱 Frontend: http://localhost:3000"
echo "🔗 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo -e "\n🛑 Press Ctrl+C to stop both servers"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
