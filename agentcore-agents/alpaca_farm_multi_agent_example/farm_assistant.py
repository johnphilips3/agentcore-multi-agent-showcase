#!/usr/bin/env python3
"""
# 🦙 Farm's Assistant Strands Agent

A specialized Strands agent that is the orchestrator to utilize sub-agents and tools at its disposal to answer a user query.

## What This Example Shows

"""

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands.models import BedrockModel
from strands import Agent
from strands_tools import file_read, file_write, editor
from language_assistant import language_assistant
from math_assistant import math_assistant
from no_expertise import general_assistant
from alpaca_farm_assistant import alpaca_farm_assistant


# Define a focused system prompt for file operations
FARM_ASSISTANT_SYSTEM_PROMPT = """
You are FarmAssist, a sophisticated alpaca farm management orchestrator designed to provide farm management guidance support across . Your role is to:

1. Analyze incoming farmer queries and determine the most appropriate specialized agent to handle them:
   - Alpaca Farm Management Mgmt Assistant: For collecting and reporting information about the alpaca herd 
   - Math Agent: For mathematical calculations, problems, and concepts
   - Language Agent: For translation and language-related queries
   - Computer Science Agent: For programming, algorithms, data structures, and code executio
   - General Assistant: For all other topics outside these specialized domains

2. Key Responsibilities:
   - Accurately classify farmer queries by subject area
   - Route requests to the appropriate specialized agent
   - Maintain context and coordinate multi-step problems
   - Ensure cohesive responses when multiple agents are needed

3. Decision Protocol:
   - If query involves alpaca herd management - 
   - If query involves calculations/numbers → Math Agent
   - If query involves translation → Language Agent
   - If query involves programming/coding/algorithms/computer science → Computer Science Agent
   - If query is outside these specialized areas → General Assistant
   - For complex queries, coordinate multiple agents as needed

Always confirm your understanding before routing to ensure accurate assistance.
"""

app = BedrockAgentCoreApp()

model_id = "global.anthropic.claude-sonnet-4-20250514-v1:0"
model = BedrockModel(
    model_id=model_id
)

# Create a farm management agent with selected tools
farm_agent = Agent(
    model=model,
    system_prompt=FARM_ASSISTANT_SYSTEM_PROMPT,
    callback_handler=None,
    tools=[alpaca_farm_assistant, math_assistant, language_assistant, general_assistant],
)


@app.entrypoint
async def strands_agent_bedrock(payload):
    """
    Invoke the agent with a payload
    """
    user_input = payload.get("prompt")
    farm_stream = farm_agent.stream_async(user_input)
    tool_name = None
    try:
        async for event in farm_stream:

            if (
                "current_tool_use" in event
                and event["current_tool_use"].get("name") != tool_name
            ):
                tool_name = event["current_tool_use"]["name"]
                yield f"\n\n🔧 Using tool: {tool_name}\n\n"

            if "data" in event:
                tool_name = None
                yield event["data"]
    except Exception as e:
        yield f"Error: {str(e)}"


if __name__ == "__main__":
    app.run()