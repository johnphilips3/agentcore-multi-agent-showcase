#!/usr/bin/env python3
"""
Runtime Configuration for Farm Assistant Evaluation

This module handles configuration for running evaluations against either:
1. Local agent execution (default)
2. AgentCore runtime endpoint deployed on AWS
"""

import os
from typing import Optional, Dict, Any
from dataclasses import dataclass


@dataclass
class RuntimeConfig:
    """Configuration for agent runtime execution"""
    
    # Runtime mode: 'local' or 'remote'
    mode: str = 'local'
    
    # Remote endpoint configuration
    endpoint_url: Optional[str] = None  # Can be ARN or HTTP endpoint
    agent_id: Optional[str] = None
    session_id: Optional[str] = None
    
    # AWS configuration for remote calls
    aws_region: Optional[str] = None
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    
    @classmethod
    def from_environment(cls) -> 'RuntimeConfig':
        """Create configuration from environment variables"""
        
        # Determine runtime mode
        mode = os.getenv('FARM_ASSISTANT_RUNTIME_MODE', 'local').lower()
        
        if mode not in ['local', 'remote']:
            raise ValueError(f"Invalid runtime mode: {mode}. Must be 'local' or 'remote'")
        
        config = cls(mode=mode)
        
        if mode == 'remote':
            # Remote execution configuration
            config.endpoint_url = os.getenv('AGENTCORE_ENDPOINT_URL') or os.getenv('AGENTCORE_ARN')
            config.agent_id = os.getenv('AGENTCORE_AGENT_ID')
            config.session_id = os.getenv('AGENTCORE_SESSION_ID')
            
            # AWS credentials (optional if using IAM roles)
            config.aws_region = os.getenv('AWS_REGION', 'us-west-2')
            config.aws_access_key_id = os.getenv('AWS_ACCESS_KEY_ID')
            config.aws_secret_access_key = os.getenv('AWS_SECRET_ACCESS_KEY')
            
            # Validate required remote configuration
            # Either endpoint_url (ARN) or agent_id is required
            if not config.endpoint_url and not config.agent_id:
                raise ValueError("Either AGENTCORE_ENDPOINT_URL/AGENTCORE_ARN or AGENTCORE_AGENT_ID is required for remote mode")
        
        return config
    
    def validate(self) -> bool:
        """Validate the configuration"""
        if self.mode == 'local':
            return True
        
        if self.mode == 'remote':
            return bool(self.endpoint_url or self.agent_id)
        
        return False
    
    def get_setup_instructions(self) -> str:
        """Get setup instructions for the current configuration"""
        if self.mode == 'local':
            return """
🏠 LOCAL MODE CONFIGURATION:
No additional setup required for local mode.
The evaluation will run against the local farm assistant agent.

To switch to remote mode, set:
export FARM_ASSISTANT_RUNTIME_MODE=remote
"""
        
        return f"""
☁️  REMOTE MODE CONFIGURATION:
Current settings:
  - Mode: {self.mode}
  - Endpoint: {self.endpoint_url or '❌ Not set'}
  - Agent ID: {self.agent_id or '❌ Not set'}
  - Session ID: {self.session_id or '❌ Not set (optional)'}
  - AWS Region: {self.aws_region}

Required environment variables for remote mode:
export FARM_ASSISTANT_RUNTIME_MODE=remote

Choose ONE of the following:
Option 1 - Using Agent Runtime ARN:
export AGENTCORE_ARN=<your-agent-runtime-arn>

Option 2 - Using Agent ID (ARN will be constructed):
export AGENTCORE_AGENT_ID=<your-agent-id>

Option 3 - Using HTTP Endpoint URL (legacy):
export AGENTCORE_ENDPOINT_URL=<your-agentcore-endpoint>

Optional environment variables:
export AGENTCORE_SESSION_ID=<session-id>
export AWS_REGION=<aws-region>
export AWS_ACCESS_KEY_ID=<your-access-key>
export AWS_SECRET_ACCESS_KEY=<your-secret-key>

Example from your .bedrock_agentcore.yaml:
export AGENTCORE_ARN=arn:aws:bedrock-agentcore:us-west-2:339713026409:runtime/strandsagent-Dft6C798dZ
# OR
export AGENTCORE_AGENT_ID=strandsagent-Dft6C798dZ
"""