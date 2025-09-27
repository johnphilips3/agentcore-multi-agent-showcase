# 🦙 Multi-Agent Farm Management System

A comprehensive repository containing intelligent farm management systems featuring multi-agent orchestration, AWS-based storage solutions, and interactive chat interfaces for specialized agricultural operations.

## 🏗️ Repository Structure

This repository is organized into several top-level directories, each serving a specific purpose in the overall farm management ecosystem:

### 📁 **agentcore-agents/**
Collection of AI agents designed for deployment on Amazon Bedrock AgentCore Runtime. This directory contains specialized agents for farm management operations including herd tracking, mathematical calculations, and multilingual communication.

**Key Features:**
- Multi-agent orchestration system
- Specialized domain experts (alpaca management, calculations, translations)
- Built on AWS Bedrock AgentCore for enterprise-scale reliability
- Strands framework integration for sophisticated agent coordination

**Technology Stack:**
- Python 3.11+
- AWS Bedrock AgentCore
- Strands Agents Framework
- uv package manager

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

### 📁 **streamlit-chat/**
Interactive web-based chat interface for communicating with deployed AgentCore agents. Provides a user-friendly frontend for farm management operations through natural language interactions.

**Key Features:**
- Real-time chat interface with deployed agents
- Agent discovery and version management
- Multi-region AWS support
- Streaming responses with tool visibility
- Session management and conversation context
- Response formatting and raw output options

**Technology Stack:**
- Python 3.11+
- Streamlit web framework
- AWS Bedrock AgentCore integration
- boto3 for AWS services

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
   uv run streamlit run app.py
   ```

3. **Deploy agents (for full functionality):**
   ```bash
   cd agentcore-agents
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

The system follows a multi-tier architecture:

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
```

## 🔧 Core Features

### 🤖 **Intelligent Agent Orchestration**
- **Smart Query Routing**: Automatically directs questions to specialized agents
- **Domain Expertise**: Dedicated agents for herd management, calculations, translations
- **Real-time Streaming**: Instant responses for time-critical farm decisions
- **Multi-Agent Coordination**: Seamless collaboration between specialized agents

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

## 🔑 AWS Requirements

### Required Services
- **Amazon Bedrock AgentCore**: For agent deployment and runtime
- **AWS RDS**: PostgreSQL database for farm data storage
- **AWS S3**: Backup storage and file management
- **AWS CloudWatch**: Monitoring and logging
- **AWS IAM**: Authentication and authorization

### Minimum Permissions
Your AWS user/role needs permissions for:
- `bedrock-agentcore-control:*` (agent management)
- `bedrock-agentcore:InvokeAgentRuntime` (agent execution)
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