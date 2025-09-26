# 🦙 Alpaca Farm Multi-Agent Example

This directory contains the implementation files for the Alpaca Farm Multi-Agent architecture, where specialized agents work together under the coordination of a central farm management orchestrator.

## Core Agent Files

- [farm_assistant.py](farm_assistant.py) - The main orchestrator agent that routes farm management queries to specialized agents
- [alpaca_farm_assistant.py](alpaca_farm_assistant.py) - Specialized agent for alpaca herd management and farm operations
- [math_assistant.py](math_assistant.py) - Specialized agent for mathematical calculations (feed costs, measurements, etc.)
- [language_assistant.py](language_assistant.py) - Specialized agent for language translation tasks
- [no_expertise.py](no_expertise.py) - General assistant for queries outside specific domains

## 📊 LangSmith Evaluation

This project includes a comprehensive **async evaluation framework** using LangSmith:

- **Location**: [`langsmith_evaluation/`](langsmith_evaluation/) directory
- **Purpose**: Test and monitor farm assistant agent performance
- **Features**: Async evaluation, agent routing tests, response quality metrics
- **Quick Start**: `cd langsmith_evaluation && python test_async_evaluation.py`

See [`langsmith_evaluation/README.md`](langsmith_evaluation/README.md) for detailed setup instructions.

## Documentation

For detailed information about how this multi-agent architecture works, please see the [multi_agent_example.md](multi_agent_example.md) documentation file.
