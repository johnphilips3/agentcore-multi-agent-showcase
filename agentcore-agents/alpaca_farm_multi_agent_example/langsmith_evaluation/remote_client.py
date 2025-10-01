#!/usr/bin/env python3
"""
Remote Client for AgentCore Runtime

This module provides a client for calling the AgentCore runtime endpoint
deployed on AWS using the official boto3 bedrock-agentcore client.
"""

import asyncio
import json
import boto3
import uuid
from typing import Dict, Any, AsyncGenerator
from botocore.exceptions import ClientError, BotoCoreError
from runtime_config import RuntimeConfig


class AgentCoreRemoteClient:
    """Client for calling AgentCore runtime endpoints using boto3 bedrock-agentcore"""
    
    def __init__(self, config: RuntimeConfig):
        """
        Initialize the remote client
        
        Args:
            config: Runtime configuration with endpoint details
        """
        self.config = config
        
        if config.mode != 'remote':
            raise ValueError("RemoteClient requires 'remote' mode configuration")
        
        # Initialize boto3 session and bedrock-agentcore client
        if config.aws_access_key_id and config.aws_secret_access_key:
            self.aws_session = boto3.Session(
                aws_access_key_id=config.aws_access_key_id,
                aws_secret_access_key=config.aws_secret_access_key,
                region_name=config.aws_region
            )
        else:
            # Use default credential chain (IAM roles, etc.)
            self.aws_session = boto3.Session(region_name=config.aws_region)
        
        # Initialize the bedrock-agentcore client
        self.agentcore_client = self.aws_session.client('bedrock-agentcore')
        
        # Generate session ID if not provided
        if not config.session_id:
            self.session_id = str(uuid.uuid4())
        else:
            self.session_id = config.session_id
    
    async def __aenter__(self):
        """Async context manager entry"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        # No cleanup needed for boto3 client
        pass
    
    def _prepare_payload(self, payload: Dict[str, Any]) -> bytes:
        """
        Prepare payload for AgentCore runtime
        
        Args:
            payload: Request payload containing the prompt
            
        Returns:
            Encoded payload as bytes
        """
        return json.dumps(payload).encode('utf-8')
    
    async def invoke_agent_stream(self, payload: Dict[str, Any]) -> AsyncGenerator[str, None]:
        """
        Invoke the agent via AgentCore runtime streaming endpoint
        
        Args:
            payload: Request payload containing the prompt
            
        Yields:
            Response chunks from the agent
        """
        try:
            # Prepare the payload as binary data
            encoded_payload = self._prepare_payload(payload)
            
            # Use the agent ARN from endpoint URL or agent ID
            agent_runtime_arn = self.config.endpoint_url or f"arn:aws:bedrock-agentcore:{self.config.aws_region}:*:runtime/{self.config.agent_id}"
            
            # Call invoke_agent_runtime with streaming
            response = self.agentcore_client.invoke_agent_runtime(
                agentRuntimeArn=agent_runtime_arn,
                runtimeSessionId=self.session_id,
                payload=encoded_payload
            )
            
            # Process streaming response
            content_type = response.get("contentType", "")
            
            if "text/event-stream" in content_type:
                # Handle streaming response
                for line in response["response"].iter_lines(chunk_size=10):
                    if line:
                        line_str = line.decode("utf-8")
                        if line_str.startswith("data: "):
                            data = line_str[6:]  # Remove 'data: ' prefix
                            if data.strip() and data != "[DONE]":
                                yield data
                        elif line_str.strip() and not line_str.startswith(":"):
                            # Non-SSE formatted response
                            yield line_str
                            
            elif content_type == "application/json":
                # Handle standard JSON response
                content = []
                for chunk in response.get("response", []):
                    content.append(chunk.decode('utf-8'))
                
                if content:
                    full_response = ''.join(content)
                    try:
                        json_response = json.loads(full_response)
                        # Extract text content if it's structured
                        if isinstance(json_response, dict):
                            yield json_response.get('text', str(json_response))
                        else:
                            yield str(json_response)
                    except json.JSONDecodeError:
                        yield full_response
            else:
                # Handle other content types
                if "response" in response:
                    for chunk in response["response"]:
                        if isinstance(chunk, bytes):
                            yield chunk.decode('utf-8')
                        else:
                            yield str(chunk)
                else:
                    yield str(response)
                    
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            yield f"AWS ClientError ({error_code}): {error_message}"
            
        except BotoCoreError as e:
            yield f"AWS BotoCoreError: {str(e)}"
            
        except Exception as e:
            yield f"Error calling AgentCore runtime: {str(e)}"
    
    async def invoke_agent(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Invoke the agent via AgentCore runtime (non-streaming)
        
        Args:
            payload: Request payload containing the prompt
            
        Returns:
            Complete response from the agent
        """
        try:
            # Collect all streaming chunks into a single response
            response_chunks = []
            
            async for chunk in self.invoke_agent_stream(payload):
                response_chunks.append(chunk)
            
            # Combine all chunks
            full_response = "".join(response_chunks).strip()
            
            return {
                "response": full_response,
                "success": len(full_response) > 0,
                "session_id": self.session_id,
                "agent_runtime_arn": self.config.endpoint_url or f"arn:aws:bedrock-agentcore:{self.config.aws_region}:*:runtime/{self.config.agent_id}"
            }
                
        except Exception as e:
            return {
                "error": f"Error calling AgentCore runtime: {str(e)}",
                "success": False,
                "session_id": self.session_id
            }


async def test_remote_client():
    """Test function for the remote client"""
    try:
        config = RuntimeConfig.from_environment()
        
        if config.mode != 'remote':
            print("Set FARM_ASSISTANT_RUNTIME_MODE=remote to test remote client")
            return
        
        print(f"Testing AgentCore runtime client...")
        print(f"Agent ID: {config.agent_id}")
        print(f"Endpoint/ARN: {config.endpoint_url}")
        print(f"Region: {config.aws_region}")
        
        async with AgentCoreRemoteClient(config) as client:
            print("\nTesting remote agent call...")
            
            payload = {"prompt": "How many alpacas do we have?"}
            
            print("Streaming response:")
            chunk_count = 0
            async for chunk in client.invoke_agent_stream(payload):
                chunk_count += 1
                print(f"Chunk {chunk_count}: {chunk[:100]}{'...' if len(chunk) > 100 else ''}")
            
            print(f"\nReceived {chunk_count} chunks total")
            
            # Test non-streaming
            print("\nTesting non-streaming response:")
            result = await client.invoke_agent({"prompt": "What is 2+2?"})
            print(f"Result: {result}")
            
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_remote_client())