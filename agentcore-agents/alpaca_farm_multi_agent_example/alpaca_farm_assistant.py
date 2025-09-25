from strands.models import BedrockModel
from mcp.client.streamable_http import streamablehttp_client 
from strands.tools.mcp.mcp_client import MCPClient
from strands import Agent, tool
from strands_tools import python_repl, shell, file_read, file_write, editor
import json
import requests

ALPACA_FARM_ASSISTANT_SYSTEM_PROMPT = """


   You are a farm management assistant for alpaca farms.
   You can provide information on the alpacas and record new information about alpacas.
   You can add new alpacas and record details about the new alpacas.
   You have access to the following information about the alpaca:
    1/ Details about the physical characteristics of the alpacas, their breeding history and their bloodlines.
    2/ Health records for the alpacas including immunizations and veternary visits.
    3/ Breeding records for the alpacas including the details of the alpacas that were bred with them and their breeding history.
    4/ Nutrition records for the alpacas including the details of the alpacas that were fed with them and their feeding history.
    5/ Medical records for the alpacas including the details of the alpacas that were treated with them and their treatment history.
    6/ Management activity records for the alpacas including activity type and who it was performed by.
   You can provided existing information on the alpacas and save new information on the existing alpacas.
   If there is information that you need to fulfil the request you can ask follow-up questions to gaither more details.
"""
CLIENT_ID = "16j9guvg9mm0pcb2su4qa2kqqj"
CLIENT_SECRET = "1avfn6dn8unfp3pcp72n2sdieiloonjrebdbs9gs8p4ucjnqbjg0"
TOKEN_URL = "https://my-domain-qv2gy78a.auth.us-west-2.amazoncognito.com/oauth2/token"

def fetch_access_token(client_id, client_secret, token_url):
  response = requests.post(
    token_url,
    data="grant_type=client_credentials&client_id={client_id}&client_secret={client_secret}".format(client_id=client_id, client_secret=client_secret),
    headers={'Content-Type': 'application/x-www-form-urlencoded'}
  )

  return response.json()['access_token']

@tool
def alpaca_farm_assistant(query: str) -> str:
    """
    Process and respond to alpaca farm management questions using a specialized agent with a mcp server that asssesses a data store that includes information on the herd.
    
    Args:
        query: The user's alpaca farm management question
        
    Returns:
        A detailed response providing answers to the users question or the information about the completed action.
    """
    # Format the query for the computer science agent with clear instructions
    formatted_query = f"Please address this alpaca farm management question. When appropriate, provide answer to the questions based on the data retrieve from the mpc server and take actions to add or update data: {query}"
    
    try:
        client_id = "16j9guvg9mm0pcb2su4qa2kqqj"
        client_secret = "1avfn6dn8unfp3pcp72n2sdieiloonjrebdbs9gs8p4ucjnqbjg0"
        token_url = "https://my-domain-qv2gy78a.auth.us-west-2.amazoncognito.com/oauth2/token"

        response = requests.post(
            token_url,
            data="grant_type=client_credentials&client_id={client_id}&client_secret={client_secret}".format(client_id=client_id, client_secret=client_secret),
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )


        access_token = fetch_access_token(CLIENT_ID, CLIENT_SECRET, TOKEN_URL)

        print("Routed to Alpaca Farm Assistant")
        # Create the computer science agent with relevant tools
        gatewayEndpoint="https://gateway-alpaca-herd-management-avlsfruvrz.gateway.bedrock-agentcore.us-west-2.amazonaws.com/mcp"
        print(f"Gateway Endpoint: {gatewayEndpoint}")

        client = MCPClient(lambda: streamablehttp_client(gatewayEndpoint,headers={"Authorization": f"Bearer {access_token}"}))

        with client:
            tools = client.list_tools_sync()
            # Create the computer science agent with relevant tools
            farm_agent = Agent(
                system_prompt=ALPACA_FARM_ASSISTANT_SYSTEM_PROMPT,
                tools=[tools],
            )
            agent_response = farm_agent(formatted_query)
            text_response = str(agent_response)

            if len(text_response) > 0:
                return text_response
            
            return "I apologize, but I couldn't process your alpaca farm management question. Please try rephrasing or providing more specific details about what you're trying to learn or accomplish."
    except Exception as e:
            # Return specific error message for computer science processing
            return f"Error processing your farm management query: {str(e)}"
            

