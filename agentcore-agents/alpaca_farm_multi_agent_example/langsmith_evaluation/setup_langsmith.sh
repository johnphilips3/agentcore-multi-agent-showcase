#!/bin/bash

# LangSmith Evaluation Setup Script for Farm Assistant Agent

echo "🦙 Setting up LangSmith Evaluation for Farm Assistant Agent"
echo "============================================================"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

echo "✅ Python 3 found"

# Install LangSmith if not already installed
echo "📦 Installing LangSmith..."
pip install langsmith

if [ $? -eq 0 ]; then
    echo "✅ LangSmith installed successfully"
else
    echo "❌ Failed to install LangSmith"
    exit 1
fi

# Check if API key is set
if [ -z "$LANGSMITH_API_KEY" ]; then
    echo ""
    echo "⚠️  LANGSMITH_API_KEY environment variable is not set"
    echo ""
    echo "To get your API key:"
    echo "1. Visit https://smith.langchain.com/"
    echo "2. Sign up or log in"
    echo "3. Go to Settings > API Keys"
    echo "4. Create a new API key"
    echo ""
    echo "Then set it as an environment variable:"
    echo "export LANGSMITH_API_KEY='your-api-key-here'"
    echo ""
    echo "Or add it to your ~/.bashrc or ~/.zshrc file:"
    echo "echo 'export LANGSMITH_API_KEY=\"your-api-key-here\"' >> ~/.bashrc"
    echo ""
else
    echo "✅ LANGSMITH_API_KEY is set"
fi

# Check if other dependencies are available
echo ""
echo "🔍 Checking other dependencies..."

python3 -c "import langsmith" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ LangSmith Python package is working"
else
    echo "❌ LangSmith Python package not working properly"
fi

# Make the run script executable
chmod +x run_evaluation.py

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Set your LANGSMITH_API_KEY (if not already done)"
echo "2. Run the evaluation: python run_evaluation.py"
echo "3. Check the results in your LangSmith dashboard"
echo ""
echo "For more information, see LANGSMITH_EVALUATION.md"