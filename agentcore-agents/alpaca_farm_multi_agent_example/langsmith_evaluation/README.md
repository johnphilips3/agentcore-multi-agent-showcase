# 🦙 LangSmith Evaluation for Farm Assistant Agent

This directory contains a complete async evaluation framework for testing your Farm Assistant Agent using LangSmith.

## 🚀 Quick Start

```bash
# Navigate to the evaluation directory
cd langsmith_evaluation

# Test async functionality
python test_async_evaluation.py

# Run comprehensive evaluation
python run_full_async_evaluation.py

# Interactive testing
python run_evaluation.py
```

## 📁 Files Overview

| File | Purpose |
|------|---------|
| `langsmith_evaluation.py` | Main async evaluation logic |
| `langsmith_config.py` | Configuration and test cases |
| `run_evaluation.py` | Interactive CLI tool |
| `run_full_async_evaluation.py` | Comprehensive evaluation |
| `test_async_evaluation.py` | Test async functionality |
| `test_langsmith_connection.py` | Connection verification |
| `setup_langsmith.sh` | Setup script |
| `LANGSMITH_EVALUATION.md` | Detailed documentation |
| `ASYNC_EVALUATION_SUMMARY.md` | Implementation summary |

## 🔧 Prerequisites

1. **LangSmith API Key**: Get from https://smith.langchain.com/
2. **Environment Variable**: `export LANGSMITH_API_KEY='your-key'`
3. **Dependencies**: `python -m pip install langsmith`

## 📊 What Gets Evaluated

- **Agent Routing**: Correct tool selection for different query types
- **Response Quality**: Completeness and accuracy of responses  
- **Success Rate**: Error handling and reliability
- **Performance**: Response times and efficiency

For detailed documentation, see `LANGSMITH_EVALUATION.md`