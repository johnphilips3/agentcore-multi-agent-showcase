from strands.models import BedrockModel
from mcp.client.streamable_http import streamablehttp_client 
from strands.tools.mcp.mcp_client import MCPClient
from strands import Agent
import logging
import argparse
import os
import utils
import requests

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

#setting parameters
parser = argparse.ArgumentParser(
                    prog='strands_agent',
                    description='Test Strands Agent with MCP Gateway',
                    epilog='Input Parameters')

parser.add_argument('--gateway_id', help = "Gateway Id")

os.environ["STRANDS_TOOL_CONSOLE_MODE"] = "enabled"

#create boto3 session and client
(boto_session, agentcore_client) = utils.create_agentcore_client()

systemPrompt = """


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

if __name__ == "__main__":
    args = parser.parse_args()

    #Validations
    if args.gateway_id is None:
        raise Exception("Gateway Id is required")

    gatewayEndpoint="https://gateway-alpaca-herd-management-avlsfruvrz.gateway.bedrock-agentcore.us-west-2.amazonaws.com/mcp"
    print(f"Gateway Endpoint: {gatewayEndpoint}")

    access_token = fetch_access_token(CLIENT_ID, CLIENT_SECRET, TOKEN_URL)
    client = MCPClient(lambda: streamablehttp_client(gatewayEndpoint,headers={"Authorization": f"Bearer {access_token}"}))

    bedrockmodel = BedrockModel(
        model_id="us.anthropic.claude-3-5-sonnet-20240620-v1:0",
        temperature=0.7,
        streaming=True,
        boto_session=boto_session
    )

    # Configure the root strands logger
    logging.getLogger("strands").setLevel(logging.INFO)

    # Add a handler to see the logs
    logging.basicConfig(
        format="%(levelname)s | %(name)s | %(message)s", 
        handlers=[logging.StreamHandler()]
    )

    with client:
        tools = client.list_tools_sync()
        agent = Agent(model=bedrockmodel,tools=tools,system_prompt=systemPrompt)

        print("=" * 60)
        print("  WELCOME TO YOUR ALPACA FARM MANAGEMENT ASSISTANT  🗓️")
        print("=" * 60)
        print("✨ I can help you with:")
        print("   Providing information about your alpacas")
        print("   Collect new information about your alpacas") 
        print()
        print("🚪 Type 'exit' to quit anytime")
        print("=" * 60)
        print()

        # Run the agent in a loop for interactive conversation
        while True:
            try:
                user_input = input("👤 You: ").strip()

                if not user_input:
                    print("💭 Please enter a message or type 'exit' to quit")
                    continue

                if user_input.lower() in ["exit", "quit", "bye", "goodbye"]:
                    print()
                    print("=======================================")
                    print("👋 Thanks for using Alpaca Farm Manager Assistant!")
                    print("🎉 Have a great day ahead!")
                    print("=======================================")
                    break

                print("🤖 Alpacabot: ", end="")
                agent(user_input)
                print()

            except KeyboardInterrupt:
                print()
                print("=======================================")
                print("👋 Alpaca Farm Manager Assistant interrupted!")
                print("🎉 See you next time!")
                print("=======================================")
                break
            except Exception as e:
                print(f"❌ An error occurred: {str(e)}")
                print("💡 Please try again or type 'exit' to quit")
                print()
