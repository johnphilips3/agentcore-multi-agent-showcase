# Nova Sonic Web App

A modern web application for speech-to-speech AI interaction using Amazon Nova Sonic and AgentCore agents.

## 🚀 Quick Start

### 1. Setup (one time)
```bash
./setup.sh
```

### 2. Configure AWS credentials
```bash
aws configure
# OR set environment variables in backend/.env
```

### 3. Start the application
```bash
./start-app.sh
```

### 4. Open your browser
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## 📋 Prerequisites

- Python 3.11+
- Node.js 18+
- AWS CLI configured
- Access to Amazon Bedrock Nova Sonic

## 🎯 Features

- **Speech-to-Speech**: Real-time voice interaction with AI
- **AgentCore Integration**: Connect to deployed agents
- **Multi-Agent Support**: Route queries to specialized agents
- **Tool Integration**: Access alpaca farm data, order tracking, and more
- **Modern UI**: Responsive design with dark theme

## 🔧 Configuration

### AWS Setup
1. Configure AWS credentials
2. Ensure access to Bedrock Nova Sonic
3. Deploy agents to AgentCore (optional)

### Environment Variables
Copy `.env.example` files and configure:
- `backend/.env` - Server configuration
- `frontend/.env` - Client configuration

## 🛠️ Development

### Backend
```bash
cd backend
source .venv/bin/activate
uv run uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm start
```

### Testing
```bash
# Backend tests
cd backend && uv run pytest

# Frontend tests
cd frontend && npm test
```

## 📚 Architecture

- **Backend**: FastAPI + WebSocket + Nova Sonic
- **Frontend**: React + Tailwind CSS + Web Audio API
- **Integration**: AgentCore agents, MCP protocols
- **Cloud**: AWS Bedrock, Nova Sonic, AgentCore Runtime

## 🔍 Troubleshooting

### Common Issues
1. **Microphone access denied**: Check browser permissions
2. **No agents found**: Ensure AgentCore agents are deployed
3. **Audio not working**: Verify browser compatibility
4. **Connection errors**: Check AWS credentials and network

### Debug Mode
Set `DEBUG=true` in backend/.env for detailed logging.

## 📞 Support

For issues, check the troubleshooting guide or open an issue in the repository.
