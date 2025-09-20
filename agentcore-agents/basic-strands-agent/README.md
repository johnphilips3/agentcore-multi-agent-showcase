# Basic strands agent streaming example 

An agent using the Strands SDK to demonstrate basic agent streaming that include two simple tools for math calculations and retrieving the weather.

## About Amazon Bedrock AgentCore

Amazon Bedrock AgentCore is a comprehensive service that enables you to deploy and operate highly effective AI agents securely at scale using any framework and model. AgentCore Runtime is a secure, serverless runtime purpose-built for deploying and scaling dynamic AI agents and tools using popular open-source frameworks like LangGraph, CrewAI, and Strands Agents.

## Prerequisites

- Python 3.11 or higher
- [uv package manager](https://docs.astral.sh/uv/getting-started/installation/)
- AWS CLI configured with appropriate credentials
- Access to Amazon Bedrock AgentCore service
- Deployed agents on Bedrock AgentCore Runtime

### Required AWS Permissions

Your AWS credentials need the following permissions:

- `bedrock-agentcore-control:ListAgentRuntimes`
- `bedrock-agentcore-control:ListAgentRuntimeVersions`
- `bedrock-agentcore:InvokeAgentRuntime`

## Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/johnphilips3/agentcore-multi-agent-showcase.git
   cd agentcore-agents/basic-strands-agent
   ```

2. **Install dependencies using uv**:

   ```bash
   uv sync
   ```

## (Optional) Deploy the Example Agent

1. **Install dev dependencies using uv** (recommended):

```bash
uv sync --dev
```

2. **Configure the agent**:

```bash
uv run agentcore configure -e agent.py
```

3. **Deploy to AgentCore Runtime**:

```bash
uv run agentcore launch
cd ..
```

## License

This project is licensed under the terms specified in the repository license file.

## Resources

- [Amazon Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock-agentcore/)
- [Bedrock AgentCore Samples](https://github.com/awslabs/amazon-bedrock-agentcore-samples/)
- [Streamlit Documentation](https://docs.streamlit.io/)
- [Strands Agents Framework](https://github.com/awslabs/strands-agents)
