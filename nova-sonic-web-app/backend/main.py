#!/usr/bin/env python3
"""
Nova Sonic Web App Backend
A FastAPI server that integrates Amazon Nova Sonic with existing AgentCore agents
for speech-to-speech AI interactions.
"""

import asyncio
import base64
import json
import logging
import os
import uuid
from typing import Dict, List, Optional, Any

import boto3
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

from nova_sonic_manager import NovaSocketWebManager
from agent_integration import AgentCoreConnector
from tool_extensions import EnhancedToolProcessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Verify AWS credentials are loaded (for debugging)
logger.info(f"AWS_ACCESS_KEY_ID loaded: {'✓' if os.getenv('AWS_ACCESS_KEY_ID') else '✗'}")
logger.info(f"AWS_SECRET_ACCESS_KEY loaded: {'✓' if os.getenv('AWS_SECRET_ACCESS_KEY') else '✗'}")
logger.info(f"AWS_DEFAULT_REGION: {os.getenv('AWS_DEFAULT_REGION', 'not set')}")

# Initialize FastAPI app
app = FastAPI(
    title="Nova Sonic Web App",
    description="Speech-to-Speech AI Agent Interaction Platform",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for the React frontend (when built)
if os.path.exists("../frontend/build"):
    app.mount("/static", StaticFiles(directory="../frontend/build/static"), name="static")

# Global state management
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.nova_managers: Dict[str, NovaSocketWebManager] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.nova_managers:
            # Clean up Nova Sonic manager
            asyncio.create_task(self.nova_managers[client_id].cleanup())
            del self.nova_managers[client_id]
        logger.info(f"Client {client_id} disconnected")

    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            await websocket.send_text(json.dumps(message))

manager = ConnectionManager()

# Request/Response Models
class AgentListRequest(BaseModel):
    region: Optional[str] = "us-east-1"

class AgentResponse(BaseModel):
    agent_id: str
    name: str
    description: str
    version: str
    arn: str
    status: str

class StartSessionRequest(BaseModel):
    agent_arn: Optional[str] = None
    voice_id: Optional[str] = "matthew"
    tools_enabled: Optional[bool] = True

# API Routes
@app.get("/")
async def root():
    return {"message": "Nova Sonic Web App Backend", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": asyncio.get_event_loop().time()}

@app.get("/api/agents", response_model=List[AgentResponse])
async def list_agents(region: str = "us-east-1"):
    """List available AgentCore agents"""
    try:
        agent_connector = AgentCoreConnector(region)
        agents = await agent_connector.list_agents()
        return agents
    except Exception as e:
        logger.error(f"Error listing agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/agents/{agent_id}/versions")
async def list_agent_versions(agent_id: str, region: str = "us-east-1"):
    """List versions for a specific agent"""
    try:
        agent_connector = AgentCoreConnector(region)
        versions = await agent_connector.list_agent_versions(agent_id)
        return versions
    except Exception as e:
        logger.error(f"Error listing agent versions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint for real-time audio communication
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    logger.info(f"🔌 WebSocket connection attempt from client: {client_id}")
    logger.info(f"WebSocket headers: {dict(websocket.headers)}")
    
    # Check origin for WebSocket connections
    origin = websocket.headers.get("origin")
    logger.info(f"WebSocket origin: {origin}")
    
    if origin and origin not in ["http://localhost:3000", "http://127.0.0.1:3000"]:
        logger.warning(f"WebSocket connection rejected due to invalid origin: {origin}")
        await websocket.close(code=1008, reason="Invalid origin")
        return
    
    try:
        await manager.connect(websocket, client_id)
        logger.info(f"✅ WebSocket successfully connected for client: {client_id}")
    except Exception as e:
        logger.error(f"❌ Failed to connect WebSocket for client {client_id}: {e}")
        await websocket.close(code=1000, reason=f"Connection failed: {str(e)}")
        return
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            message_type = message.get("type")
            
            if message_type == "start_session":
                await handle_start_session(client_id, message, websocket)
            elif message_type == "audio_chunk":
                await handle_audio_chunk(client_id, message)
            elif message_type == "end_audio":
                await handle_end_audio(client_id)
            elif message_type == "stop_session":
                await handle_stop_session(client_id)
            else:
                await manager.send_personal_message(
                    {"type": "error", "message": f"Unknown message type: {message_type}"}, 
                    client_id
                )
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        await manager.send_personal_message(
            {"type": "error", "message": str(e)}, 
            client_id
        )
        manager.disconnect(client_id)

async def handle_start_session(client_id: str, message: dict, websocket: WebSocket):
    """Initialize a new Nova Sonic session"""
    try:
        agent_arn = message.get("agent_arn")
        voice_id = message.get("voice_id", "matthew")
        tools_enabled = message.get("tools_enabled", True)
        
        # Create Nova Sonic manager
        nova_manager = NovaSocketWebManager(
            client_id=client_id,
            websocket=websocket,
            agent_arn=agent_arn,
            voice_id=voice_id,
            tools_enabled=tools_enabled
        )
        
        # Initialize the session
        await nova_manager.initialize()
        manager.nova_managers[client_id] = nova_manager
        
        await manager.send_personal_message({
            "type": "session_started",
            "session_id": client_id,
            "voice_id": voice_id,
            "tools_enabled": tools_enabled
        }, client_id)
        
    except Exception as e:
        logger.error(f"Error starting session for {client_id}: {e}")
        await manager.send_personal_message({
            "type": "error",
            "message": f"Failed to start session: {str(e)}"
        }, client_id)

async def handle_audio_chunk(client_id: str, message: dict):
    """Process incoming audio chunk"""
    try:
        if client_id not in manager.nova_managers:
            await manager.send_personal_message({
                "type": "error",
                "message": "No active session found"
            }, client_id)
            return
        
        audio_data = message.get("audio_data")
        if not audio_data:
            return
        
        # Send base64 audio data directly to Nova Sonic
        nova_manager = manager.nova_managers[client_id]
        await nova_manager.process_audio_input(audio_data)
        
    except Exception as e:
        logger.error(f"Error processing audio chunk for {client_id}: {e}")
        await manager.send_personal_message({
            "type": "error",
            "message": f"Error processing audio: {str(e)}"
        }, client_id)

async def handle_end_audio(client_id: str):
    """Handle end of audio input"""
    try:
        if client_id in manager.nova_managers:
            nova_manager = manager.nova_managers[client_id]
            await nova_manager.end_audio_input()
            
    except Exception as e:
        logger.error(f"Error ending audio for {client_id}: {e}")

async def handle_stop_session(client_id: str):
    """Stop the Nova Sonic session"""
    try:
        if client_id in manager.nova_managers:
            nova_manager = manager.nova_managers[client_id]
            await nova_manager.cleanup()
            del manager.nova_managers[client_id]
            
        await manager.send_personal_message({
            "type": "session_stopped"
        }, client_id)
        
    except Exception as e:
        logger.error(f"Error stopping session for {client_id}: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )