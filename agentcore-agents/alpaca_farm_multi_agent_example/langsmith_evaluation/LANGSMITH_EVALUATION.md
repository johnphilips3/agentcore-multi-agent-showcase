# LangSmith Evaluation for Farm Assistant Agent

This directory contains a basic LangSmith evaluation setup for testing and monitoring the performance of your Farm Assistant Agent.

## 🎯 What This Evaluation Does

The evaluation framework tests your farm assistant's ability to:
- **Route queries correctly** to the appropriate specialized agent (alpaca management, math, language, general)
- **Provide accurate responses** for different types of farm management queries
- **Handle edge cases** and error scenarios gracefully
- **Maintain consistent performance** over time

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Install LangSmith (use python -m pip to ensure correct environment)
python -m pip install langsmith

# Or add to your requirements.txt and run:
pip install -r requirements.txt
```

### 2. Get LangSmith API Key
1. Visit [LangSmith](https://smith.langchain.com/)
2. Sign up/login and get your API key
3. Set it as an environment variable:
```bash
export LANGSMITH_API_KEY='your-api-key-here'
```

### 3. Run Evaluation
```bash
# Test async functionality first
python test_async_evaluation.py

# Run comprehensive async evaluation
python run_full_async_evaluation.py

# Or use the interactive runner
python run_evaluation.py

# Or run the evaluation directly
python langsmith_evaluation.py
```

## 📁 Files Overview

| File | Purpose |
|------|---------|
| `langsmith_evaluation.py` | **Main async evaluation logic** and LangSmith integration |
| `langsmith_config.py` | Configuration settings and test case definitions |
| `run_evaluation.py` | Simple CLI tool to run evaluations |
| `test_async_evaluation.py` | **Test async functionality** without full evaluation |
| `run_full_async_evaluation.py` | **Comprehensive async evaluation** runner |
| `simple_langsmith_test.py` | Basic LangSmith connectivity test |
| `test_langsmith_connection.py` | Connection verification utility |
| `LANGSMITH_EVALUATION.md` | This documentation file |

## ⚡ Async Functionality

The evaluation framework is **fully async** and supports:

- **Async agent integration** - Works with your streaming farm assistant agent
- **Concurrent evaluations** - Multiple test cases run efficiently 
- **Real-time streaming** - Captures tool usage and response chunks
- **Fallback mock agent** - Works even without full agent dependencies

### Running Async Evaluations

```bash
# Test basic async functionality
python test_async_evaluation.py

# Run comprehensive evaluation
python run_full_async_evaluation.py

# Use in your own async code
import asyncio
from langsmith_evaluation import FarmAssistantEvaluator

async def my_evaluation():
    evaluator = FarmAssistantEvaluator()
    results = await evaluator.run_evaluation()
    return results

# Run it
asyncio.run(my_evaluation())
```

## 🧪 Test Categories

The evaluation includes test cases for:

### Alpaca Management Queries
- Herd counting and inventory
- Adding new alpacas
- Health record management
- Breeding information updates

### Mathematical Calculations
- Feed cost calculations
- Percentage calculations
- Revenue calculations
- Area/measurement calculations

### Language Translation
- Basic translation requests
- Farm-specific terminology translation

### General Knowledge
- Weather queries
- General farming questions
- Non-specialized topics

## 📊 Evaluation Metrics

The framework measures:

1. **Success Rate** - Did the agent respond without errors?
2. **Tool Routing Accuracy** - Did it use the correct specialized agent?
3. **Response Completeness** - Is the response comprehensive?
4. **Response Quality** - Overall helpfulness and accuracy

## 🔧 Customization

### Adding New Test Cases
Edit `langsmith_config.py` and add to the `SAMPLE_TEST_CASES` dictionary:

```python
SAMPLE_TEST_CASES = {
    "alpaca_management": [
        "Your new test case here",
        # ... existing cases
    ]
}
```

### Custom Evaluation Criteria
Modify the `evaluate_response_quality` method in `langsmith_evaluation.py`:

```python
def evaluate_response_quality(self, run: Run, example: Example) -> Dict[str, Any]:
    # Add your custom evaluation logic here
    pass
```

### Different Agent Configurations
Update the import in `langsmith_evaluation.py` to test different agent configurations:

```python
# Test different agents or configurations
from your_custom_agent import custom_farm_agent
```

## 📈 Viewing Results

After running evaluations:

1. **LangSmith Dashboard**: Visit https://smith.langchain.com/ to see detailed results
2. **Console Output**: Basic results are printed to the terminal
3. **Experiment Tracking**: Each run creates a new experiment in LangSmith

## 🛠️ Troubleshooting

### Common Issues

**"LANGSMITH_API_KEY not found"**
```bash
export LANGSMITH_API_KEY='your-key-here'
# Verify it's set:
echo $LANGSMITH_API_KEY
```

**"langsmith module not found"**
```bash
pip install langsmith
```

**"Dataset already exists" errors**
- This is normal - the framework reuses existing datasets
- Delete the dataset in LangSmith UI if you want to recreate it

**Agent import errors**
- Make sure all your agent dependencies are installed
- Check that the farm_assistant.py file is in the same directory

## 🔄 Integration with CI/CD

You can integrate this evaluation into your CI/CD pipeline:

```bash
# In your CI script
export LANGSMITH_API_KEY=$LANGSMITH_API_KEY_SECRET
python run_evaluation.py
```

## 📚 Next Steps

Once you're comfortable with the basic setup:

1. **Add more sophisticated test cases** based on real farm scenarios
2. **Implement custom evaluators** for domain-specific metrics
3. **Set up automated evaluation runs** on agent updates
4. **Create performance benchmarks** and regression testing
5. **Add human evaluation workflows** for subjective quality assessment

## 🤝 Contributing

To improve the evaluation framework:
1. Add more diverse test cases
2. Implement additional evaluation metrics
3. Create specialized evaluators for different agent types
4. Add performance and latency testing

---

For more information about LangSmith, visit the [official documentation](https://docs.smith.langchain.com/).