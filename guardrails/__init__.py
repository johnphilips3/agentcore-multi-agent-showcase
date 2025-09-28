"""
Guardrails package for Bedrock Guardrails integration.

This package provides middleware and client functionality for integrating
Amazon Bedrock Guardrails with agent interactions.
"""

from .guardrails_config import GuardrailsConfig
from .guardrails_client import GuardrailsClient
from .guardrails_middleware import GuardrailsMiddleware, with_guardrails

__all__ = [
    'GuardrailsConfig',
    'GuardrailsClient', 
    'GuardrailsMiddleware',
    'with_guardrails'
]