"""
Configuration settings for Bedrock Guardrails.
"""

from dataclasses import dataclass
from typing import Optional
import os


@dataclass
class GuardrailsConfig:
    """Configuration for Bedrock Guardrails."""
    
    # Guardrail identifiers
    guardrail_id: str
    guardrail_version: str = "DRAFT"
    
    # AWS configuration
    aws_region: str = "us-west-2"
    
    # Guardrail behavior settings
    enable_input_filtering: bool = True
    enable_output_filtering: bool = True
    output_scope: str = "INTERVENTIONS"  # INTERVENTIONS or FULL
    
    # Content filtering thresholds
    content_filter_strength: str = "MEDIUM"  # LOW, MEDIUM, HIGH
    
    @classmethod
    def from_environment(cls) -> 'GuardrailsConfig':
        """Create configuration from environment variables."""
        return cls(
            guardrail_id=os.getenv('BEDROCK_GUARDRAIL_ID', 'default-guardrail'),
            guardrail_version=os.getenv('BEDROCK_GUARDRAIL_VERSION', 'DRAFT'),
            aws_region=os.getenv('AWS_REGION', 'us-west-2'),
            enable_input_filtering=os.getenv('GUARDRAIL_INPUT_FILTERING', 'true').lower() == 'true',
            enable_output_filtering=os.getenv('GUARDRAIL_OUTPUT_FILTERING', 'true').lower() == 'true',
            output_scope=os.getenv('GUARDRAIL_OUTPUT_SCOPE', 'INTERVENTIONS'),
            content_filter_strength=os.getenv('GUARDRAIL_FILTER_STRENGTH', 'MEDIUM')
        )
    
    def validate(self) -> None:
        """Validate configuration settings."""
        if not self.guardrail_id:
            raise ValueError("Guardrail ID is required")
        
        if self.output_scope not in ['INTERVENTIONS', 'FULL']:
            raise ValueError("Output scope must be 'INTERVENTIONS' or 'FULL'")
        
        if self.content_filter_strength not in ['LOW', 'MEDIUM', 'HIGH']:
            raise ValueError("Content filter strength must be 'LOW', 'MEDIUM', or 'HIGH'")