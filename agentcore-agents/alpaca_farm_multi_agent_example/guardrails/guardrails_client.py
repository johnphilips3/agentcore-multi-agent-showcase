"""
Bedrock Guardrails client implementation.
"""

import boto3
import json
import logging
from typing import Dict, List, Optional, Any, Union
from botocore.exceptions import ClientError

from guardrails_config import GuardrailsConfig


logger = logging.getLogger(__name__)


class GuardrailsClient:
    """Client for interacting with Amazon Bedrock Guardrails."""
    
    def __init__(self, config: GuardrailsConfig):
        """Initialize the Guardrails client.
        
        Args:
            config: Guardrails configuration
        """
        self.config = config
        self.config.validate()
        
        # Initialize Bedrock Runtime client
        self.bedrock_runtime = boto3.client(
            'bedrock-runtime',
            region_name=config.aws_region
        )
        
        logger.info(f"Initialized Guardrails client for region {config.aws_region}")
    
    def apply_guardrail(
        self, 
        content: Union[str, List[str]], 
        source: str = "INPUT"
    ) -> Dict[str, Any]:
        """Apply guardrail to content.
        
        Args:
            content: Text content to evaluate (string or list of strings)
            source: Source type - "INPUT" or "OUTPUT"
            
        Returns:
            Guardrail evaluation response
            
        Raises:
            ClientError: If the API call fails
            ValueError: If parameters are invalid
        """
        if source not in ["INPUT", "OUTPUT"]:
            raise ValueError("Source must be 'INPUT' or 'OUTPUT'")
        
        # Convert content to the required format
        if isinstance(content, str):
            content_blocks = [{"text": {"text": content}}]
        elif isinstance(content, list):
            content_blocks = [{"text": {"text": text}} for text in content]
        else:
            raise ValueError("Content must be a string or list of strings")
        
        try:
            # Debug logging
            logger.debug(f"Applying guardrail with:")
            logger.debug(f"  guardrailIdentifier: {self.config.guardrail_id}")
            logger.debug(f"  guardrailVersion: {self.config.guardrail_version}")
            logger.debug(f"  source: {source}")
            logger.debug(f"  content: {content_blocks}")
            logger.debug(f"  outputScope: {self.config.output_scope}")
            
            response = self.bedrock_runtime.apply_guardrail(
                guardrailIdentifier=self.config.guardrail_id,
                guardrailVersion=self.config.guardrail_version,
                source=source,
                content=content_blocks,
                outputScope=self.config.output_scope
            )
            
            logger.debug(f"Guardrail applied successfully for {source}")
            return response
            
        except ClientError as e:
            logger.error(f"Failed to apply guardrail: {e}")
            logger.error(f"Request parameters were:")
            logger.error(f"  guardrailIdentifier: {self.config.guardrail_id}")
            logger.error(f"  guardrailVersion: {self.config.guardrail_version}")
            logger.error(f"  source: {source}")
            logger.error(f"  content: {content_blocks}")
            raise
    
    def is_content_safe(self, content: Union[str, List[str]], source: str = "INPUT") -> bool:
        """Check if content is safe according to guardrail policies.
        
        Args:
            content: Text content to evaluate
            source: Source type - "INPUT" or "OUTPUT"
            
        Returns:
            True if content is safe, False if guardrail intervened
        """
        try:
            response = self.apply_guardrail(content, source)
            return response.get('action', 'NONE') == 'NONE'
        except Exception as e:
            logger.error(f"Error checking content safety: {e}")
            # Fail safe - assume content is not safe if we can't evaluate it
            return False
    
    def get_filtered_content(self, content: Union[str, List[str]], source: str = "INPUT") -> List[str]:
        """Get filtered/sanitized content from guardrail.
        
        Args:
            content: Text content to filter
            source: Source type - "INPUT" or "OUTPUT"
            
        Returns:
            List of filtered text content
        """
        try:
            response = self.apply_guardrail(content, source)
            
            # Extract filtered content from outputs
            outputs = response.get('outputs', [])
            filtered_content = []
            
            for output in outputs:
                if 'text' in output:
                    filtered_content.append(output['text'])
            
            return filtered_content
            
        except Exception as e:
            logger.error(f"Error filtering content: {e}")
            # Return original content if filtering fails
            if isinstance(content, str):
                return [content]
            return content
    
    def get_assessment_details(self, content: Union[str, List[str]], source: str = "INPUT") -> Dict[str, Any]:
        """Get detailed assessment information from guardrail evaluation.
        
        Args:
            content: Text content to evaluate
            source: Source type - "INPUT" or "OUTPUT"
            
        Returns:
            Dictionary containing assessment details
        """
        try:
            response = self.apply_guardrail(content, source)
            
            assessment_summary = {
                'action': response.get('action', 'NONE'),
                'action_reason': response.get('actionReason', ''),
                'assessments': response.get('assessments', []),
                'usage': response.get('usage', {}),
                'guardrail_coverage': response.get('guardrailCoverage', {})
            }
            
            return assessment_summary
            
        except Exception as e:
            logger.error(f"Error getting assessment details: {e}")
            return {
                'action': 'ERROR',
                'action_reason': f'Failed to evaluate content: {str(e)}',
                'assessments': [],
                'usage': {},
                'guardrail_coverage': {}
            }