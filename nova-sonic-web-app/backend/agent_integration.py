"""
AgentCore Integration Connector
Integrates with existing AgentCore agents for Nova Sonic tool use
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, List, Optional, Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class AgentCoreConnector:
    """Connector to integrate with existing AgentCore agents"""
    
    def __init__(self, region: str = "us-west-2"):
        self.region = region
        self.control_client = None
        self.runtime_client = None
        
    def _get_control_client(self):
        """Get or create AgentCore control client"""
        if not self.control_client:
            self.control_client = boto3.client("bedrock-agentcore-control", region_name=self.region)
        return self.control_client
    
    def _get_runtime_client(self):
        """Get or create AgentCore runtime client"""
        if not self.runtime_client:
            self.runtime_client = boto3.client("bedrock-agentcore", region_name=self.region)
        return self.runtime_client

    async def list_agents(self) -> List[Dict]:
        """List available AgentCore agents"""
        try:
            client = self._get_control_client()
            
            # Run in executor to avoid blocking
            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: client.list_agent_runtimes(maxResults=100)
            )
            
            # Filter only READY agents
            ready_agents = [
                {
                    "agent_id": agent.get("agentRuntimeId", ""),
                    "name": agent.get("agentRuntimeName", "Unknown"),
                    "description": agent.get("description", ""),
                    "version": agent.get("agentRuntimeVersion", ""),
                    "arn": agent.get("agentRuntimeArn", ""),
                    "status": agent.get("status", "")
                }
                for agent in response.get("agentRuntimes", [])
                if agent.get("status") == "READY"
            ]
            
            # Sort by most recent update time
            ready_agents.sort(key=lambda x: x.get("name", ""), reverse=False)
            
            return ready_agents
            
        except ClientError as e:
            logger.error(f"AWS error listing agents: {e}")
            raise Exception(f"Failed to list agents: {e}")
        except Exception as e:
            logger.error(f"Error listing agents: {e}")
            raise

    async def list_agent_versions(self, agent_runtime_id: str) -> List[Dict]:
        """List versions for a specific agent"""
        try:
            client = self._get_control_client()
            
            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: client.list_agent_runtime_versions(agentRuntimeId=agent_runtime_id)
            )
            
            # Filter only READY versions
            ready_versions = [
                {
                    "version": version.get("agentRuntimeVersion", ""),
                    "arn": version.get("agentRuntimeArn", ""),
                    "description": version.get("description", ""),
                    "status": version.get("status", ""),
                    "updated_at": version.get("lastUpdatedAt", "")
                }
                for version in response.get("agentRuntimes", [])
                if version.get("status") == "READY"
            ]
            
            # Sort by most recent update time
            ready_versions.sort(
                key=lambda x: x.get("updated_at", ""), reverse=True
            )
            
            return ready_versions
            
        except ClientError as e:
            logger.error(f"AWS error listing agent versions: {e}")
            raise Exception(f"Failed to list agent versions: {e}")
        except Exception as e:
            logger.error(f"Error listing agent versions: {e}")
            raise

    async def query_agent(self, agent_arn: str, prompt: str, session_id: Optional[str] = None) -> str:
        """Query an AgentCore agent and return the response"""
        try:
            client = self._get_runtime_client()
            
            if not session_id:
                session_id = str(uuid.uuid4())
            
            # Prepare the payload
            payload = {"prompt": prompt}
            
            # Call the agent
            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: client.invoke_agent_runtime(
                    agentRuntimeArn=agent_arn,
                    qualifier="DEFAULT",
                    runtimeSessionId=session_id,
                    payload=json.dumps(payload)
                )
            )
            
            # Parse the response
            content_type = response.get("contentType", "")
            
            if "text/event-stream" in content_type:
                # Handle streaming response
                return await self._process_streaming_response(response)
            else:
                # Handle non-streaming response
                return await self._process_standard_response(response)
                
        except ClientError as e:
            logger.error(f"AWS error querying agent: {e}")
            raise Exception(f"Failed to query agent: {e}")
        except Exception as e:
            logger.error(f"Error querying agent: {e}")
            raise

    async def _process_streaming_response(self, response: Dict) -> str:
        """Process streaming response from AgentCore"""
        try:
            full_response = ""
            response_stream = response.get("response")
            
            if hasattr(response_stream, "iter_lines"):
                for line in response_stream.iter_lines(chunk_size=1):
                    if line:
                        line_str = line.decode("utf-8")
                        if line_str.startswith("data: "):
                            data = line_str[6:]  # Remove "data: " prefix
                            try:
                                json_data = json.loads(data)
                                text_content = self._extract_text_content(json_data)
                                if text_content:
                                    full_response += text_content
                            except json.JSONDecodeError:
                                # If not JSON, treat as plain text
                                full_response += data
            else:
                # Handle as bytes response
                content = response_stream.read()
                if isinstance(content, bytes):
                    content = content.decode("utf-8")
                full_response = content
            
            return full_response.strip()
            
        except Exception as e:
            logger.error(f"Error processing streaming response: {e}")
            return f"Error processing response: {str(e)}"

    async def _process_standard_response(self, response: Dict) -> str:
        """Process standard non-streaming response from AgentCore"""
        try:
            response_obj = response.get("response")
            
            if hasattr(response_obj, "read"):
                content = response_obj.read()
                if isinstance(content, bytes):
                    content = content.decode("utf-8")
                
                try:
                    json_data = json.loads(content)
                    return self._extract_text_content(json_data)
                except json.JSONDecodeError:
                    return content
                    
            elif isinstance(response_obj, dict):
                return self._extract_text_content(response_obj)
            else:
                return str(response_obj)
                
        except Exception as e:
            logger.error(f"Error processing standard response: {e}")
            return f"Error processing response: {str(e)}"

    def _extract_text_content(self, data: Any) -> str:
        """Extract text content from various response formats"""
        if isinstance(data, dict):
            # Handle format: {'role': 'assistant', 'content': [{'text': 'Hello!'}]}
            if "role" in data and "content" in data:
                content = data["content"]
                if isinstance(content, list) and len(content) > 0:
                    first_item = content[0]
                    if isinstance(first_item, dict) and "text" in first_item:
                        return str(first_item["text"])
                    else:
                        return str(first_item)
                elif isinstance(content, str):
                    return content
                else:
                    return str(content)
            
            # Handle other common formats
            for key in ["text", "content", "message", "response", "result"]:
                if key in data:
                    value = data[key]
                    if isinstance(value, str):
                        return value
                    else:
                        return str(value)
            
            # If it's a dict with unknown structure, convert to string
            return str(data)
        
        return str(data)

    async def get_agent_info(self, agent_arn: str) -> Dict:
        """Get detailed information about a specific agent"""
        try:
            # Extract agent runtime ID from ARN
            agent_id = agent_arn.split("/")[-1] if "/" in agent_arn else agent_arn
            
            client = self._get_control_client()
            
            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: client.get_agent_runtime(agentRuntimeId=agent_id)
            )
            
            agent_runtime = response.get("agentRuntime", {})
            
            return {
                "agent_id": agent_runtime.get("agentRuntimeId", ""),
                "name": agent_runtime.get("agentRuntimeName", "Unknown"),
                "description": agent_runtime.get("description", ""),
                "version": agent_runtime.get("agentRuntimeVersion", ""),
                "arn": agent_runtime.get("agentRuntimeArn", ""),
                "status": agent_runtime.get("status", ""),
                "created_at": agent_runtime.get("createdAt", ""),
                "updated_at": agent_runtime.get("lastUpdatedAt", ""),
                "model_id": agent_runtime.get("modelId", ""),
                "runtime_role_arn": agent_runtime.get("runtimeRoleArn", "")
            }
            
        except ClientError as e:
            logger.error(f"AWS error getting agent info: {e}")
            raise Exception(f"Failed to get agent info: {e}")
        except Exception as e:
            logger.error(f"Error getting agent info: {e}")
            raise

    async def test_connection(self) -> bool:
        """Test connection to AgentCore services"""
        try:
            # Try to list agents as a connection test
            agents = await self.list_agents()
            logger.info(f"AgentCore connection successful. Found {len(agents)} agents.")
            return True
        except Exception as e:
            logger.error(f"AgentCore connection test failed: {e}")
            return False

    def get_available_regions(self) -> List[str]:
        """Get list of available AWS regions for AgentCore"""
        # These are the common regions where Bedrock/AgentCore is available
        return [
            "us-east-1",
            "us-west-2", 
            "eu-west-1",
            "ap-southeast-1",
            "ap-northeast-1"
        ]