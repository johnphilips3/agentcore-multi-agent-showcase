"""
Nova Sonic WebSocket Manager
Adapted from the original console implementation for web-based interaction
"""

import asyncio
import base64
import json
import logging
import uuid
import warnings
from typing import Dict, Optional

from aws_sdk_bedrock_runtime.client import BedrockRuntimeClient, InvokeModelWithBidirectionalStreamOperationInput
from aws_sdk_bedrock_runtime.models import InvokeModelWithBidirectionalStreamInputChunk, BidirectionalInputPayloadPart
from aws_sdk_bedrock_runtime.config import Config, HTTPAuthSchemeResolver, SigV4AuthScheme
from smithy_aws_core.credentials_resolvers.environment import EnvironmentCredentialsResolver

from tool_extensions import EnhancedToolProcessor

# Suppress warnings
warnings.filterwarnings("ignore")

logger = logging.getLogger(__name__)

class NovaSocketWebManager:
    """Web-adapted Nova Sonic streaming manager with WebSocket integration"""
    
    # Event templates (same as original but adapted for web use)
    START_SESSION_EVENT = '''{
        "event": {
            "sessionStart": {
                "inferenceConfiguration": {
                    "maxTokens": 1024,
                    "topP": 0.9,
                    "temperature": 0.7
                }
            }
        }
    }'''

    CONTENT_START_EVENT = '''{
        "event": {
            "contentStart": {
                "promptName": "%s",
                "contentName": "%s",
                "type": "AUDIO",
                "interactive": true,
                "role": "USER",
                "audioInputConfiguration": {
                    "mediaType": "audio/lpcm",
                    "sampleRateHertz": 16000,
                    "sampleSizeBits": 16,
                    "channelCount": 1,
                    "audioType": "SPEECH",
                    "encoding": "base64"
                }
            }
        }
    }'''

    AUDIO_EVENT_TEMPLATE = '''{
        "event": {
            "audioInput": {
                "promptName": "%s",
                "contentName": "%s",
                "content": "%s"
            }
        }
    }'''

    TEXT_CONTENT_START_EVENT = '''{
        "event": {
            "contentStart": {
                "promptName": "%s",
                "contentName": "%s",
                "type": "TEXT",
                "role": "%s",
                "interactive": false,
                "textInputConfiguration": {
                    "mediaType": "text/plain"
                }
            }
        }
    }'''

    TEXT_INPUT_EVENT = '''{
        "event": {
            "textInput": {
                "promptName": "%s",
                "contentName": "%s",
                "content": "%s"
            }
        }
    }'''

    TOOL_CONTENT_START_EVENT = '''{
        "event": {
            "contentStart": {
                "promptName": "%s",
                "contentName": "%s",
                "interactive": false,
                "type": "TOOL",
                "role": "TOOL",
                "toolResultInputConfiguration": {
                    "toolUseId": "%s",
                    "type": "TEXT",
                    "textInputConfiguration": {
                        "mediaType": "text/plain"
                    }
                }
            }
        }
    }'''

    CONTENT_END_EVENT = '''{
        "event": {
            "contentEnd": {
                "promptName": "%s",
                "contentName": "%s"
            }
        }
    }'''

    PROMPT_END_EVENT = '''{
        "event": {
            "promptEnd": {
                "promptName": "%s"
            }
        }
    }'''

    SESSION_END_EVENT = '''{
        "event": {
            "sessionEnd": {}
        }
    }'''

    def __init__(
        self, 
        client_id: str,
        websocket,
        agent_arn: Optional[str] = None,
        voice_id: str = "matthew",
        tools_enabled: bool = True,
        model_id: str = 'amazon.nova-sonic-v1:0',
        region: str = 'us-east-1'
    ):
        self.client_id = client_id
        self.websocket = websocket
        self.agent_arn = agent_arn
        self.voice_id = voice_id
        self.tools_enabled = tools_enabled
        self.model_id = model_id
        self.region = region
        
        # Session state
        self.prompt_name = str(uuid.uuid4())
        self.content_name = str(uuid.uuid4())
        self.audio_content_name = str(uuid.uuid4())
        
        # Tool processing
        self.tool_processor = EnhancedToolProcessor(agent_arn=agent_arn)
        self.pending_tool_tasks = {}
        
        # Stream management
        self.bedrock_client = None
        self.stream_response = None
        self.is_active = False
        self.response_task = None
        
        # Audio queues
        self.audio_input_queue = asyncio.Queue()
        self.audio_output_queue = asyncio.Queue()
        
        # Current tool processing state
        self.current_tool_use = None
        self.current_tool_id = None
        self.current_tool_name = None

    def _initialize_client(self):
        """Initialize the Bedrock client"""
        config = Config(
            endpoint_uri=f"https://bedrock-runtime.{self.region}.amazonaws.com",
            region=self.region,
            aws_credentials_identity_resolver=EnvironmentCredentialsResolver(),
            http_auth_scheme_resolver=HTTPAuthSchemeResolver(),
            http_auth_schemes={"aws.auth#sigv4": SigV4AuthScheme()}
        )
        self.bedrock_client = BedrockRuntimeClient(config=config)

    async def initialize(self):
        """Initialize the Nova Sonic session"""
        logger.info(f"🚀 Initializing Nova Sonic session:")
        logger.info(f"  Model ID: {self.model_id}")
        logger.info(f"  Region: {self.region}")
        logger.info(f"  Voice ID: {self.voice_id}")
        logger.info(f"  Client ID: {self.client_id}")
        
        if not self.bedrock_client:
            self._initialize_client()
        
        try:
            # Create the bidirectional stream
            logger.info(f"🔄 Creating bidirectional stream...")
            self.stream_response = await self.bedrock_client.invoke_model_with_bidirectional_stream(
                InvokeModelWithBidirectionalStreamOperationInput(model_id=self.model_id)
            )
            self.is_active = True
            
            # Create system prompt
            system_prompt = self._create_system_prompt()
            
            # Send initialization events - Nova Sonic requires SYSTEM role first
            logger.info(f"📤 Sending session start event...")
            await self._send_raw_event(self.START_SESSION_EVENT)
            await asyncio.sleep(0.2)
            
            logger.info(f"📤 Sending prompt start event...")
            await self._send_raw_event(self._create_prompt_start_event())
            await asyncio.sleep(0.2)
            
            # Send system prompt - REQUIRED by Nova Sonic
            logger.info(f"📤 Sending system prompt...")
            await self._send_raw_event(self.TEXT_CONTENT_START_EVENT % (self.prompt_name, self.content_name, "SYSTEM"))
            await asyncio.sleep(0.1)
            await self._send_raw_event(self.TEXT_INPUT_EVENT % (self.prompt_name, self.content_name, system_prompt))
            await asyncio.sleep(0.1)
            await self._send_raw_event(self.CONTENT_END_EVENT % (self.prompt_name, self.content_name))
            await asyncio.sleep(0.1)
            
            # Start response processing
            self.response_task = asyncio.create_task(self._process_responses())
            
            logger.info(f"Nova Sonic session initialized for client {self.client_id}")
            
        except Exception as e:
            self.is_active = False
            logger.error(f"Failed to initialize Nova Sonic session: {e}")
            raise

    def _create_system_prompt(self) -> str:
        """Create the system prompt with enhanced instructions"""
        base_prompt = (
            "You are a helpful AI assistant that can engage in natural spoken conversation. "
            "When reading numbers, IDs, or codes, please read each digit individually with pauses. "
            "For example, order #1234 should be read as 'order number one-two-three-four'."
        )
        
        if self.agent_arn:
            base_prompt += (
                f"\n\nYou have access to AgentCore agent {self.agent_arn} for specialized tasks. "
                "Use the appropriate tools to provide comprehensive assistance."
            )
        
        return base_prompt

    def _create_prompt_start_event(self) -> str:
        """Create the prompt start event with tool configuration"""
        # Get tool schemas from the enhanced tool processor
        tool_specs = self.tool_processor.get_tool_specifications()
        
        prompt_start_event = {
            "event": {
                "promptStart": {
                    "promptName": self.prompt_name,
                    "textOutputConfiguration": {
                        "mediaType": "text/plain"
                    },
                    "audioOutputConfiguration": {
                        "mediaType": "audio/lpcm",
                        "sampleRateHertz": 24000,
                        "sampleSizeBits": 16,
                        "channelCount": 1,
                        "voiceId": self.voice_id,
                        "encoding": "base64",
                        "audioType": "SPEECH"
                    },
                    "toolUseOutputConfiguration": {
                        "mediaType": "application/json"
                    },
                    "toolConfiguration": {
                        "tools": tool_specs
                    } if self.tools_enabled else {}
                }
            }
        }
        
        return json.dumps(prompt_start_event)

    async def _send_raw_event(self, event_json: str):
        """Send a raw event to the Bedrock stream"""
        if not self.stream_response or not self.is_active:
            return
        
        # Log the event being sent for debugging
        try:
            # Parse to validate JSON first
            parsed_event = json.loads(event_json)
            event_type = list(parsed_event.get('event', {}).keys())[0] if parsed_event.get('event') else 'unknown'
            logger.info(f"📤 Sending event: {event_type}")
            logger.debug(f"Event content: {event_json}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in event: {e}")
            logger.error(f"Event content: {event_json}")
            return
        
        event = InvokeModelWithBidirectionalStreamInputChunk(
            value=BidirectionalInputPayloadPart(bytes_=event_json.encode('utf-8'))
        )
        
        try:
            await self.stream_response.input_stream.send(event)
            logger.debug(f"✅ Event sent successfully: {event_type}")
        except Exception as e:
            logger.error(f"❌ Error sending event {event_type}: {e}")

    async def process_audio_input(self, audio_base64: str):
        """Process audio chunk directly and send to Nova Sonic"""
        if not self.is_active:
            return
            
        try:
            # Send audio content start event if this is the first chunk
            if not hasattr(self, '_audio_started'):
                await self._send_raw_event(
                    self.CONTENT_START_EVENT % (self.prompt_name, self.audio_content_name)
                )
                self._audio_started = True
            
            # Send audio event directly
            audio_event = self.AUDIO_EVENT_TEMPLATE % (
                self.prompt_name,
                self.audio_content_name,
                audio_base64
            )
            
            await self._send_raw_event(audio_event)
            logger.debug(f"Sent audio chunk of length: {len(audio_base64)}")
            
        except Exception as e:
            logger.error(f"Error processing audio input: {e}")


    async def end_audio_input(self):
        """Signal end of audio input"""
        if hasattr(self, '_audio_started') and self._audio_started:
            await self._send_raw_event(
                self.CONTENT_END_EVENT % (self.prompt_name, self.audio_content_name)
            )
            # Send prompt end event to trigger response
            await self._send_raw_event(
                self.PROMPT_END_EVENT % self.prompt_name
            )
            self._audio_started = False
            logger.info(f"Audio input ended for client {self.client_id}")

    async def _process_responses(self):
        """Process responses from Nova Sonic"""
        try:
            while self.is_active:
                try:
                    output = await self.stream_response.await_output()
                    result = await output[1].receive()
                    
                    if result.value and result.value.bytes_:
                        response_data = result.value.bytes_.decode('utf-8')
                        json_data = json.loads(response_data)
                        
                        await self._handle_response_event(json_data)
                        
                except StopAsyncIteration:
                    break
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {e}")
                except Exception as e:
                    logger.error(f"Error processing response: {e}")
                    
        except Exception as e:
            logger.error(f"Response processing error: {e}")
        finally:
            self.is_active = False

    async def _handle_response_event(self, json_data: dict):
        """Handle different types of response events"""
        if 'event' not in json_data:
            return
        
        event = json_data['event']
        
        if 'textOutput' in event:
            # Send transcript to client
            text_content = event['textOutput']['content']
            await self._send_to_client({
                "type": "transcript",
                "content": text_content,
                "role": event['textOutput'].get('role', 'assistant')
            })
            
        elif 'audioOutput' in event:
            # Send audio to client
            audio_content = event['audioOutput']['content']
            await self._send_to_client({
                "type": "audio_output",
                "audio_data": audio_content
            })
            
        elif 'toolUse' in event:
            # Handle tool usage
            self.current_tool_use = event['toolUse']
            self.current_tool_name = event['toolUse']['toolName']
            self.current_tool_id = event['toolUse']['toolUseId']
            
            await self._send_to_client({
                "type": "tool_use_started",
                "tool_name": self.current_tool_name,
                "tool_id": self.current_tool_id
            })
            
        elif 'contentEnd' in event and event.get('contentEnd', {}).get('type') == 'TOOL':
            # Process tool and send result
            if self.current_tool_use:
                await self._handle_tool_execution()
                
        elif 'completionEnd' in event:
            await self._send_to_client({
                "type": "completion_end"
            })

    async def _handle_tool_execution(self):
        """Execute tool and send result back"""
        if not self.current_tool_use:
            return
        
        try:
            # Create unique content name for tool response
            tool_content_name = str(uuid.uuid4())
            
            # Execute tool
            tool_result = await self.tool_processor.process_tool_async(
                self.current_tool_name, 
                self.current_tool_use
            )
            
            # Send tool result sequence
            await self._send_raw_event(
                self.TOOL_CONTENT_START_EVENT % (
                    self.prompt_name, 
                    tool_content_name, 
                    self.current_tool_id
                )
            )
            
            tool_result_event = {
                "event": {
                    "toolResult": {
                        "promptName": self.prompt_name,
                        "contentName": tool_content_name,
                        "content": json.dumps(tool_result) if isinstance(tool_result, dict) else str(tool_result)
                    }
                }
            }
            
            await self._send_raw_event(json.dumps(tool_result_event))
            await self._send_raw_event(
                self.CONTENT_END_EVENT % (self.prompt_name, tool_content_name)
            )
            
            # Notify client
            await self._send_to_client({
                "type": "tool_result",
                "tool_name": self.current_tool_name,
                "result": tool_result
            })
            
        except Exception as e:
            logger.error(f"Error executing tool {self.current_tool_name}: {e}")
            await self._send_to_client({
                "type": "tool_error",
                "tool_name": self.current_tool_name,
                "error": str(e)
            })
        finally:
            # Reset tool state
            self.current_tool_use = None
            self.current_tool_name = None
            self.current_tool_id = None

    async def _send_to_client(self, message: dict):
        """Send message to the WebSocket client"""
        try:
            await self.websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending message to client: {e}")

    async def cleanup(self):
        """Clean up resources"""
        self.is_active = False
        
        # Cancel pending tasks
        if self.response_task and not self.response_task.done():
            self.response_task.cancel()
        
        # Cancel tool tasks
        for task in self.pending_tool_tasks.values():
            task.cancel()
        
        # Send end events
        try:
            await self._send_raw_event(
                self.CONTENT_END_EVENT % (self.prompt_name, self.audio_content_name)
            )
            await self._send_raw_event(
                self.PROMPT_END_EVENT % self.prompt_name
            )
            await self._send_raw_event(self.SESSION_END_EVENT)
            
            if self.stream_response:
                await self.stream_response.input_stream.close()
                
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
        
        logger.info(f"Nova Sonic session cleaned up for client {self.client_id}")