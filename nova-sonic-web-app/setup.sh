#!/bin/bash
set -e

# Nova Sonic Web App Setup Script
# This script sets up the complete Nova Sonic speech-to-speech system

echo "🎙️  Nova Sonic Web App Setup"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running from the correct directory
if [ ! -f "setup.sh" ]; then
    print_error "Please run this script from the nova-sonic-web-app directory"
    exit 1
fi

# Check prerequisites
print_status "Checking prerequisites..."

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
if python3 -c "import sys; exit(0 if sys.version_info >= (3, 11) else 1)"; then
    print_success "Python $PYTHON_VERSION found"
else
    print_error "Python 3.11 or higher required (found $PYTHON_VERSION)"
    exit 1
fi

# Check uv
if ! command -v uv &> /dev/null; then
    print_warning "uv not found, installing..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
    if ! command -v uv &> /dev/null; then
        print_error "Failed to install uv"
        exit 1
    fi
fi
print_success "uv package manager found"



# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed"
    exit 1
fi
print_success "npm found"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_warning "AWS CLI not found. You'll need it for AgentCore integration."
    print_status "Install from: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
else
    print_success "AWS CLI found"
fi

print_success "All prerequisites met!"
echo

# Setup backend
print_status "Setting up backend..."
cd backend

if [ ! -d ".venv" ]; then
    print_status "Creating Python virtual environment..."
    uv venv
fi

print_status "Installing backend dependencies..."
uv sync --all-groups

print_success "Backend setup complete"
cd ..
echo

# Setup frontend
print_status "Setting up frontend..."
cd frontend

print_status "Installing frontend dependencies..."
npm install

# Create Tailwind CSS configuration if it doesn't exist
if [ ! -f "tailwind.config.js" ]; then
    print_status "Setting up Tailwind CSS..."
    cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'amazon-ember': ['Amazon Ember', 'sans-serif'],
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
}
EOF
fi

# Create PostCSS configuration if it doesn't exist
if [ ! -f "postcss.config.js" ]; then
    print_status "Setting up PostCSS..."
    cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
fi

# Create basic index.js if it doesn't exist
if [ ! -f "src/index.js" ]; then
    print_status "Creating main index file..."
    cat > src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF
fi

# Create index.css if it doesn't exist
if [ ! -f "src/index.css" ]; then
    print_status "Creating index CSS..."
    cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
EOF
fi

print_success "Frontend setup complete"
cd ..
echo

# Create environment configuration
print_status "Setting up environment configuration..."

# Backend environment
cat > backend/.env.example << 'EOF'
# AWS Configuration
AWS_ACCESS_KEY_ID=your-access-key-here
AWS_SECRET_ACCESS_KEY=your-secret-key-here
AWS_DEFAULT_REGION=us-east-1

# Nova Sonic Configuration
NOVA_SONIC_MODEL_ID=amazon.nova-sonic-v1:0
NOVA_SONIC_VOICE_ID=matthew

# AgentCore Configuration (optional)
AGENTCORE_DEFAULT_REGION=us-east-1

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=False

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
EOF

# Frontend environment
cat > frontend/.env.example << 'EOF'
# Backend API URL (for production)
REACT_APP_API_URL=http://localhost:8000

# WebSocket URL (for production)
REACT_APP_WS_URL=ws://localhost:8000

# Feature flags
REACT_APP_ENABLE_DEBUG=false
EOF

print_success "Environment configuration created"
echo

# Create startup scripts
print_status "Creating startup scripts..."

# Backend start script
cat > start-backend.sh << 'EOF'
#!/bin/bash
cd backend
source .venv/bin/activate || uv venv && source .venv/bin/activate
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
EOF

# Frontend start script
cat > start-frontend.sh << 'EOF'
#!/bin/bash
cd frontend
npm start
EOF

# Combined start script
cat > start-app.sh << 'EOF'
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
EOF

# Make scripts executable
chmod +x start-backend.sh
chmod +x start-frontend.sh
chmod +x start-app.sh

print_success "Startup scripts created"
echo

# Create documentation
print_status "Creating documentation..."

cat > README.md << 'EOF'
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
EOF

print_success "Documentation created"
echo

# Final checks
print_status "Performing final checks..."

# Check if AWS credentials are configured
if aws sts get-caller-identity &> /dev/null; then
    print_success "AWS credentials are configured"
else
    print_warning "AWS credentials not configured. Run 'aws configure' to set them up."
fi

echo
print_success "🎉 Nova Sonic Web App setup complete!"
echo
echo "Next steps:"
echo "1. Configure AWS credentials if not done: aws configure"
echo "2. Start the application: ./start-app.sh"
echo "3. Open http://localhost:3000 in your browser"
echo
echo "For help, see README.md or run ./start-app.sh --help"
EOF