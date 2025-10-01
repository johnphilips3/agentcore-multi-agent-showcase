# Farm Assistant LangSmith Evaluation

This evaluation framework supports testing the Farm Assistant agent in both local and remote execution modes using LangSmith.

## Runtime Modes

### Local Mode (Default)
Runs the agent locally using the imported `farm_assistant` module.

### Remote Mode
Calls the AgentCore runtime endpoint deployed on AWS instead of running locally.

## Configuration

### Environment Variables

#### Required for all modes:
```bash
export LANGSMITH_API_KEY=your-langsmith-api-key
```

#### Runtime Mode Selection:
```bash
# For local execution (default)
export FARM_ASSISTANT_RUNTIME_MODE=local

# For remote execution
export FARM_ASSISTANT_RUNTIME_MODE=remote
```

#### Required for Remote Mode (choose one):

**Option 1 - Using Agent Runtime ARN:**
```bash
export AGENTCORE_ARN=arn:aws:bedrock-agentcore:us-west-2:339713026409:runtime/strandsagent-Dft6C798dZ
```

**Option 2 - Using Agent ID (ARN constructed automatically):**
```bash
export AGENTCORE_AGENT_ID=strandsagent-Dft6C798dZ
```

**Option 3 - Using HTTP Endpoint URL (legacy):**
```bash
export AGENTCORE_ENDPOINT_URL=https://your-agentcore-endpoint.amazonaws.com
```

#### Optional for Remote Mode:
```bash
export AGENTCORE_SESSION_ID=your-session-id
export AWS_REGION=us-west-2
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Example Configuration from .bedrock_agentcore.yaml

Based on your deployment configuration:

```bash
export FARM_ASSISTANT_RUNTIME_MODE=remote
export AGENTCORE_ARN=arn:aws:bedrock-agentcore:us-west-2:339713026409:runtime/strandsagent-Dft6C798dZ
export AWS_REGION=us-west-2
```

## Usage

### Running Evaluations

```bash
# Navigate to the evaluation directory
cd agentcore-agents/alpaca_farm_multi_agent_example/langsmith_evaluation

# Run the evaluation script
python run_evaluation.py
```

### Menu Options

1. **Run full evaluation suite** - Executes the complete LangSmith evaluation
2. **Interactive testing mode** - Test individual queries interactively
3. **Show configuration** - Display current configuration settings

### Direct Script Usage

```python
from langsmith_evaluation import FarmAssistantEvaluator
from runtime_config import RuntimeConfig
import asyncio

# Initialize with environment configuration
config = RuntimeConfig.from_environment()
evaluator = FarmAssistantEvaluator(runtime_config=config)

# Run evaluation
results = asyncio.run(evaluator.run_evaluation())
```

## Features

### Local Mode Features
- Direct agent execution
- Full streaming support
- Tool usage detection
- No network dependencies for agent execution

### Remote Mode Features
- Official boto3 bedrock-agentcore client integration
- Automatic AWS authentication and request signing
- Streaming response support via invoke_agent_runtime
- Session management with UUID generation
- Comprehensive error handling for AWS service errors

### Evaluation Features
- Automated dataset creation
- Response quality evaluation
- Tool usage validation
- Success rate tracking
- LangSmith integration for result visualization

## Troubleshooting

### Common Issues

#### Configuration Errors
```bash
# Check your configuration
python run_evaluation.py
# Choose option 3 to see current settings
```

#### Remote Mode Issues
1. **Agent runtime not found**: Verify the AGENTCORE_ARN or AGENTCORE_AGENT_ID is correct
2. **Authentication errors**: Check AWS credentials and IAM permissions for `bedrock-agentcore:InvokeAgentRuntime`
3. **Region mismatch**: Ensure AWS_REGION matches your agent deployment region
4. **Service errors**: Check CloudWatch logs for detailed error information

#### Local Mode Issues
1. **Import errors**: Ensure all dependencies are installed
2. **Agent initialization**: Check that the farm_assistant module loads correctly

### Debug Mode

For additional debugging, you can modify the evaluation scripts to include more verbose logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Dependencies

Required packages (see requirements.txt):
- `langsmith>=0.1.0` - LangSmith evaluation framework
- `boto3` - AWS SDK with bedrock-agentcore client
- `botocore` - AWS SDK core functionality
- `bedrock-agentcore` - AgentCore runtime integration
- `strands-agents` - Local agent execution

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LangSmith     │    │   Evaluator      │    │   Runtime       │
│   Framework     │◄───┤   Controller     │───►│   Selector      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                        ┌────────────────┼────────────────┐
                                        │                │                │
                                        ▼                ▼                ▼
                                ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                                │    Local     │ │   Remote     │ │    Mock      │
                                │   Agent      │ │   Client     │ │   Agent      │
                                └──────────────┘ └──────────────┘ └──────────────┘
```

## Results

Evaluation results are stored in LangSmith with experiment names that include the runtime mode:
- Local mode: `farm_assistant_local_eval_TIMESTAMP`
- Remote mode: `farm_assistant_remote_eval_TIMESTAMP`

This allows you to compare performance between local and remote execution modes directly in the LangSmith dashboard.