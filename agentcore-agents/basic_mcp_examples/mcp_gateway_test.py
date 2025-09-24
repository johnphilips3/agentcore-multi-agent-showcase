import requests
import json

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

def list_tools(gateway_url, access_token):
  headers = {
      "Content-Type": "application/json",
      "Authorization": f"Bearer {access_token}"
  }

  payload = {
      "jsonrpc": "2.0",
      "id": "list-tools-request",
      "method": "tools/list"
  }

  response = requests.post(gateway_url, headers=headers, json=payload)
  return response.json()

# Example usage
gateway_url = "https://gateway-alpaca-herd-management-avlsfruvrz.gateway.bedrock-agentcore.us-west-2.amazonaws.com/mcp"
access_token = fetch_access_token(CLIENT_ID, CLIENT_SECRET, TOKEN_URL)
tools = list_tools(gateway_url, access_token)


client = MCPClient(lambda: streamablehttp_client(gatewayEndpoint,headers={"Authorization": f"Bearer {access_token}"}))


print(json.dumps(tools, indent=2))