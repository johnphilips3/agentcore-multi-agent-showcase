# 🦙 Multi-Agent Farm Management System

A comprehensive repository containing intelligent farm management systems featuring multi-agent orchestration, AWS-based storage solutions, and interactive chat interfaces for specialized agricultural operations.

## 🏗️ Repository Structure

This repository is organized into several top-level directories, each serving a specific purpose in the overall farm management ecosystem. All components now include integrated AWS Bedrock Guardrails for content safety and moderation:

### 📁 **agentcore-agents/**
Collection of AI agents designed for deployment on Amazon Bedrock AgentCore Runtime. This directory contains specialized agents for farm management operations including herd tracking, mathematical calculations, and multilingual communication.

**Key Features:**
- Multi-agent orchestration system
- Specialized domain experts (alpaca management, calculations, translations)
- Built on AWS Bedrock AgentCore for enterprise-scale reliability
- Strands framework integration for sophisticated agent coordination
- **🛡️ Integrated Bedrock Guardrails**: Content safety and filtering for all agent interactions

**Technology Stack:**
- Python 3.11+
- AWS Bedrock AgentCore
- AWS Bedrock Guardrails
- Strands Agents Framework
- uv package manager

**Guardrails Integration:**
- Integrates with the top-level `guardrails/` directory
- Provides input/output content filtering
- Middleware for seamless integration with existing agents
- Configurable safety policies and content moderation

*See the README within this directory for detailed setup and deployment instructions.*

### 📁 **alpaca-farm-mgmt-storage/**
AWS SAM-based backend storage and API system for alpaca farm data management. Provides comprehensive database management, backup solutions, and RESTful API endpoints for farm operations.

**Key Features:**
- AWS RDS PostgreSQL database with connection pooling
- S3-based backup and lifecycle management
- CloudWatch monitoring and health checks
- RESTful API with comprehensive documentation
- IAM-based authentication and security
- Automated deployment with AWS SAM

**Technology Stack:**
- Node.js/TypeScript
- AWS SAM (Serverless Application Model)
- PostgreSQL on AWS RDS
- AWS S3 for backups
- AWS CloudWatch for monitoring

*See the README-AWS.md within this directory for detailed AWS configuration and deployment instructions.*

### 📁 **guardrails/**
Comprehensive AWS Bedrock Guardrails implementation providing content safety and moderation capabilities across all system components. This standalone package can be integrated into any Python application requiring content filtering.

**Key Features:**
- **GuardrailsConfig**: Environment-based configuration management
- **GuardrailsClient**: Direct interface to AWS Bedrock Guardrails API  
- **GuardrailsMiddleware**: Seamless integration middleware for existing applications
- **Decorator Support**: `@with_guardrails` for easy function-level protection
- **Content Filtering**: Input/output content safety screening
- **Real-time Monitoring**: Live guardrails status and intervention logging

**Technology Stack:**
- Python 3.11+
- AWS Bedrock Guardrails
- boto3 for AWS integration
- Configurable safety policies

**Integration Examples:**
- Streamlit chat interface protection
- Agent orchestration middleware
- API endpoint content filtering
- Standalone application integration

*See the README.md and SETUP_INSTRUCTIONS.md within this directory for detailed configuration and usage instructions.*

### 📁 **streamlit-chat/**
Interactive web-based chat interface for communicating with deployed AgentCore agents. Provides a user-friendly frontend for farm management operations through natural language interactions with built-in safety guardrails.

**Key Features:**
- Real-time chat interface with deployed agents
- Agent discovery and version management
- Multi-region AWS support
- Streaming responses with tool visibility
- Session management and conversation context
- Response formatting and raw output options
- **🛡️ Guardrails Integration**: Automatic content filtering and safety monitoring
- **Debug Support**: VS Code debugging configuration for development

**Technology Stack:**
- Python 3.11+
- Streamlit web framework
- AWS Bedrock AgentCore integration
- AWS Bedrock Guardrails integration
- boto3 for AWS services
- debugpy for development debugging

**Safety Features:**
- Automatic input content filtering before processing
- Output content moderation and safety checks
- Real-time guardrails status monitoring
- Configurable safety policies and thresholds

*See the README.md within this directory for detailed setup and usage instructions.*

## 🚀 Quick Start

### Prerequisites
- Python 3.11 or higher
- Node.js 18+ (for storage backend)
- [uv package manager](https://docs.astral.sh/uv/getting-started/installation/)
- AWS CLI configured with appropriate credentials
- Access to Amazon Bedrock AgentCore service

### Basic Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```

2. **Set up the chat interface (quickest way to get started):**
   ```bash
   cd streamlit-chat
   uv sync
   uv add debugpy  # For debugging support
   uv run streamlit run app.py
   ```

3. **Set up guardrails (for content safety):**
   ```bash
   cd guardrails
   # Set up guardrails (see SETUP_INSTRUCTIONS.md)
   export BEDROCK_GUARDRAIL_ID="your-guardrail-id"
   export AWS_REGION="us-west-2"
   python test_setup.py  # Test your configuration
   ```

4. **Deploy agents (for full functionality):**
   ```bash
   cd agentcore-agents/alpaca_farm_multi_agent_example
   uv sync --dev
   # Follow deployment instructions in the directory README
   ```

4. **Set up storage backend (for persistent data):**
   ```bash
   cd alpaca-farm-mgmt-storage
   npm install
   # Follow AWS configuration in README-AWS.md
   ```

## 🎯 System Architecture

The system follows a multi-tier architecture with integrated content safety:

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Streamlit Chat    │    │   AgentCore Agents   │    │  Storage Backend    │
│   (Frontend UI)     │◄──►│  (AI Orchestration)  │◄──►│   (Data & APIs)     │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   AWS Bedrock       │    │   Strands Agents     │    │   AWS RDS/S3        │
│   AgentCore         │    │   Framework          │    │   CloudWatch        │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
         │                           │                           │
         └─────────────┬─────────────┘                           │
                       ▼                                         │
              ┌─────────────────────┐                            │
              │  🛡️ Guardrails     │◄───────────────────────────┘
              │  (Content Safety)   │
              └─────────────────────┘
                       │
                       ▼
              ┌─────────────────────┐
              │  AWS Bedrock        │
              │  Guardrails         │
              └─────────────────────┘
```

## �️ Gueardrails & Safety Features

### **Content Safety & Moderation**
The system includes comprehensive content safety features powered by AWS Bedrock Guardrails:

**Location**: `guardrails/` (top-level directory)

**Key Components:**
- **GuardrailsConfig**: Environment-based configuration management
- **GuardrailsClient**: Direct interface to AWS Bedrock Guardrails API
- **GuardrailsMiddleware**: Seamless integration with existing agents and applications
- **Decorator Support**: `@with_guardrails` for easy function-level protection

**Features:**
- **Input Filtering**: Automatic screening of user queries before processing
- **Output Moderation**: Content safety checks on all agent responses
- **Configurable Policies**: Customizable safety thresholds and content categories
- **Real-time Monitoring**: Live guardrails status and intervention logging
- **Multiple Content Types**: Support for text, structured data, and complex objects

**Integration Examples:**
- **Streamlit Chat**: Automatic content filtering in the web interface
- **Agent Orchestration**: Middleware protection for multi-agent workflows
- **API Endpoints**: Decorator-based protection for individual functions

**Setup Requirements:**
1. Create a guardrail in AWS Bedrock console
2. Set environment variables (`BEDROCK_GUARDRAIL_ID`, `AWS_REGION`)
3. Configure AWS credentials with appropriate permissions
4. Import and apply middleware or decorators as needed

*See `guardrails/SETUP_INSTRUCTIONS.md` for detailed configuration steps.*

## 🔧 Core Features

### 🤖 **Intelligent Agent Orchestration**
- **Smart Query Routing**: Automatically directs questions to specialized agents
- **Domain Expertise**: Dedicated agents for herd management, calculations, translations
- **Real-time Streaming**: Instant responses for time-critical farm decisions
- **Multi-Agent Coordination**: Seamless collaboration between specialized agents
- **🛡️ Content Safety**: Integrated Bedrock Guardrails for input/output filtering
- **Configurable Policies**: Customizable safety thresholds and content moderation

### 🗄️ **Enterprise Data Management**
- **Scalable Storage**: AWS RDS PostgreSQL with connection pooling
- **Automated Backups**: S3-based backup with lifecycle management
- **Health Monitoring**: Real-time database and system health checks
- **Security**: IAM-based authentication and encrypted connections

### 🌐 **User-Friendly Interface**
- **Natural Language**: Chat-based interaction with farm management systems
- **Multi-Region Support**: Connect to agents deployed across AWS regions
- **Session Management**: Maintain conversation context and history
- **Tool Transparency**: Visibility into which agents and tools are being used
- **🛡️ Safety Monitoring**: Real-time guardrails status and content filtering
- **Debug Support**: Integrated VS Code debugging for development workflows

## 🔑 AWS Requirements

### Required Services
- **Amazon Bedrock AgentCore**: For agent deployment and runtime
- **Amazon Bedrock Guardrails**: For content safety and moderation
- **AWS RDS**: PostgreSQL database for farm data storage
- **AWS S3**: Backup storage and file management
- **AWS CloudWatch**: Monitoring and logging
- **AWS IAM**: Authentication and authorization

### Minimum Permissions
Your AWS user/role needs permissions for:
- `bedrock-agentcore-control:*` (agent management)
- `bedrock-agentcore:InvokeAgentRuntime` (agent execution)
- `bedrock:ApplyGuardrail` (guardrails content filtering)
- `bedrock:GetGuardrail` (guardrails configuration access)
- `rds:*` (database operations)
- `s3:*` (backup operations)
- `cloudwatch:*` (monitoring)

*Detailed permission policies are available in each directory's documentation.*

## 📊 Use Cases

### 🦙 **Alpaca Farm Management**
- Livestock tracking and health monitoring
- Breeding program management
- Feed cost calculations and optimization
- Veterinary record keeping

### 🌍 **Multi-Language Operations**
- International supplier communication
- Multilingual documentation management
- Global market analysis and reporting

### 📈 **Business Intelligence**
- Financial planning and cost analysis
- Performance metrics and KPI tracking
- Predictive analytics for farm operations

## 🧪 Development & Testing

Each directory contains its own testing framework:

- **agentcore-agents/**: LangSmith evaluation framework for agent performance
- **alpaca-farm-mgmt-storage/**: Comprehensive test suites with Vitest
- **streamlit-chat/**: Interactive testing through the web interface
- **guardrails/**: Dedicated test suites for content safety and filtering

### **Debug Support**
The repository includes comprehensive debugging support:

**VS Code Integration:**
- Pre-configured launch configurations in `.vscode/launch.json`
- Streamlit app debugging with breakpoint support
- Remote debugging capabilities for complex workflows

**Debugging Features:**
- **Streamlit Debug**: Direct debugging of the chat interface
- **Agent Debug**: Step-through debugging of agent orchestration
- **Guardrails Debug**: Content filtering and safety policy testing
- **Remote Attach**: Debug running applications without restart

**Quick Debug Setup:**
1. Install `debugpy` in your virtual environment: `uv add debugpy`
2. Open VS Code and go to Run and Debug (Ctrl+Shift+D)
3. Select "Debug Streamlit App" and press F5
4. Set breakpoints and interact with your application

*See `.vscode/launch.json` for all available debug configurations.*

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch for the relevant component
3. Follow the coding standards in each directory
4. Add tests for new functionality
5. Update documentation as needed
6. Submit a pull request

## 📚 Documentation

- **Individual READMEs**: Each directory contains detailed setup and usage instructions
- **API Documentation**: Available in `alpaca-farm-mgmt-storage/src/api/docs/`
- **Deployment Guides**: Step-by-step deployment instructions for each component
- **Configuration Examples**: Sample configurations and environment setups

## 🆘 Support & Troubleshooting

- Check individual directory READMEs for component-specific issues
- Verify AWS credentials and permissions are properly configured
- Ensure all prerequisites are installed and up-to-date
- Review CloudWatch logs for runtime issues

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for intelligent agricultural management** 🦙🌾