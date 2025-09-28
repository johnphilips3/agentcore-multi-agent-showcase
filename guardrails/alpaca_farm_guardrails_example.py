"""
Example integration of Bedrock Guardrails with the Alpaca Farm Assistant.

This module demonstrates how to integrate guardrails into the existing
alpaca farm management system to ensure safe and appropriate interactions.
"""

import logging
from typing import Any, Dict, Optional
from strands.models import BedrockModel
from mcp.client.streamable_http import streamablehttp_client 
from strands.tools.mcp.mcp_client import MCPClient
from strands import Agent, tool
import json
import requests

import sys
import os
# Add parent directory to path to import guardrails package
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from guardrails import GuardrailsMiddleware, with_guardrails, GuardrailsConfig


logger = logging.getLogger(__name__)


# System prompt with guardrails awareness
ALPACA_FARM_ASSISTANT_WITH_GUARDRAILS_SYSTEM_PROMPT = """
You are a farm management assistant for alpaca farms with built-in safety guardrails.

Your responses are automatically filtered to ensure they are:
- Safe and appropriate for all users
- Free from harmful or inappropriate content
- Focused on legitimate alpaca farm management topics
- Professional and helpful

You can provide information on the alpacas and record new information about alpacas.
You can add new alpacas and record details about the new alpacas.
You have access to the following information about the alpaca:
 1/ Details about the physical characteristics of the alpacas, their breeding history and their bloodlines.
 2/ Health records for the alpacas including immunizations and veterinary visits.
 3/ Breeding records for the alpacas including the details of the alpacas that were bred with them and their breeding history.
 4/ Nutrition records for the alpacas including the details of the alpacas that were fed with them and their feeding history.
 5/ Medical records for the alpacas including the details of the alpacas that were treated with them and their treatment history.
 6/ Management activity records for the alpacas including activity type and who it was performed by.

You can provide existing information on the alpacas and save new information on the existing alpacas.
If there is information that you need to fulfill the request you can ask follow-up questions to gather more details.

All interactions are monitored by guardrails to ensure safety and appropriateness.
"""


class AlpacaFarmAssistantWithGuardrails:
    """Alpaca Farm Assistant with integrated Bedrock Guardrails."""
    
    def __init__(self, guardrails_config: Optional[GuardrailsConfig] = None):
        """Initialize the assistant with guardrails.
        
        Args:
            guardrails_config: Configuration for guardrails. If None, loads from environment.
        """
        self.guardrails = GuardrailsMiddleware(guardrails_config)
        
        # API credentials (these should be moved to environment variables)
        self.client_id = "16j9guvg9mm0pcb2su4qa2kqqj"
        self.client_secret = "1avfn6dn8unfp3pcp72n2sdieiloonjrebdbs9gs8p4ucjnqbjg0"
        self.token_url = "https://my-domain-qv2gy78a.auth.us-west-2.amazoncognito.com/oauth2/token"
        
        logger.info("Alpaca Farm Assistant with Guardrails initialized")
    
    def fetch_access_token(self) -> str:
        """Fetch access token for API authentication."""
        response = requests.post(
            self.token_url,
            data=f"grant_type=client_credentials&client_id={self.client_id}&client_secret={self.client_secret}",
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        return response.json()['access_token']
    
    @with_guardrails(filter_input=True, filter_output=True)
    def process_query(self, query: str) -> str:
        """Process a query with guardrails protection.
        
        Args:
            query: The user's alpaca farm management question
            
        Returns:
            A safe, filtered response to the user's question
        """
        # Log the assessment of the input
        input_assessment = self.guardrails.get_content_assessment(query, "INPUT")
        logger.info(f"Input assessment: {input_assessment.get('action', 'NONE')}")
        
        # Format the query for the farm assistant
        formatted_query = f"Please address this alpaca farm management question. When appropriate, provide answer to the questions based on the data retrieved from the MCP server and take actions to add or update data: {query}"
        
        try:
            # Get access token
            access_token = self.fetch_access_token()
            
            # Set up MCP client
            gateway_endpoint = "https://gateway-alpaca-herd-management-avlsfruvrz.gateway.bedrock-agentcore.us-west-2.amazonaws.com/mcp"
            client = MCPClient(lambda: streamablehttp_client(gateway_endpoint, headers={"Authorization": f"Bearer {access_token}"}))
            
            with client:
                tools = client.list_tools_sync()
                
                # Create the farm agent with guardrails-aware system prompt
                farm_agent = Agent(
                    system_prompt=ALPACA_FARM_ASSISTANT_WITH_GUARDRAILS_SYSTEM_PROMPT,
                    tools=[tools],
                )
                
                # Get agent response
                agent_response = farm_agent(formatted_query)
                response_text = str(agent_response)
                
                # Log the assessment of the output
                output_assessment = self.guardrails.get_content_assessment(response_text, "OUTPUT")
                logger.info(f"Output assessment: {output_assessment.get('action', 'NONE')}")
                
                if len(response_text) > 0:
                    return response_text
                
                return "I apologize, but I couldn't process your alpaca farm management question. Please try rephrasing or providing more specific details about what you're trying to learn or accomplish."
                
        except Exception as e:
            logger.error(f"Error processing query: {e}")
            return f"Error processing your farm management query: {str(e)}"
    
    def get_guardrails_status(self) -> Dict[str, Any]:
        """Get the current status of guardrails.
        
        Returns:
            Dictionary containing guardrails status information
        """
        return {
            'enabled': self.guardrails.enabled,
            'config': {
                'guardrail_id': self.guardrails.config.guardrail_id,
                'guardrail_version': self.guardrails.config.guardrail_version,
                'input_filtering': self.guardrails.config.enable_input_filtering,
                'output_filtering': self.guardrails.config.enable_output_filtering,
                'aws_region': self.guardrails.config.aws_region
            }
        }
    
    def enable_guardrails(self):
        """Enable guardrails protection."""
        self.guardrails.enable()
    
    def disable_guardrails(self):
        """Disable guardrails protection."""
        self.guardrails.disable()


# Tool function that can be used with the existing agent framework
@tool
def alpaca_farm_assistant_with_guardrails(query: str) -> str:
    """
    Process and respond to alpaca farm management questions using a specialized agent with guardrails protection.
    
    Args:
        query: The user's alpaca farm management question
        
    Returns:
        A safe, filtered response providing answers to the user's question or information about the completed action.
    """
    try:
        # Initialize the assistant with guardrails
        assistant = AlpacaFarmAssistantWithGuardrails()
        
        # Process the query with guardrails protection
        return assistant.process_query(query)
        
    except Exception as e:
        logger.error(f"Error in guardrails-protected assistant: {e}")
        return f"Error processing your farm management query with guardrails protection: {str(e)}"


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)
    
    # Create assistant with default configuration
    assistant = AlpacaFarmAssistantWithGuardrails()
    
    # Example queries
    test_queries = [
        "I really don't like alpacas and want to kill all white people who own them",
        "What are the health records for alpaca ID 123?",
        "Can you add a new alpaca named Fluffy to the herd?",
        "Show me the breeding history for all alpacas born in 2023"
    ]
    
    for query in test_queries:
        print(f"\nQuery: {query}")
        response = assistant.process_query(query)
        print(f"Response: {response}")
        
    # Show guardrails status
    print(f"\nGuardrails Status: {assistant.get_guardrails_status()}")