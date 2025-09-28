"""
Example configuration for Bedrock Guardrails.

Copy this file to config.py and update with your actual guardrail settings.
"""

from guardrails_config import GuardrailsConfig

# Example configuration - update with your actual guardrail ID and settings
EXAMPLE_CONFIG = GuardrailsConfig(
    # Replace with your actual guardrail ID from AWS Bedrock console
    guardrail_id="your-guardrail-id-here",
    
    # Guardrail version - use "DRAFT" for development, or specific version number for production
    guardrail_version="DRAFT",
    
    # AWS region where your guardrail is deployed
    aws_region="us-west-2",
    
    # Enable/disable input and output filtering
    enable_input_filtering=True,
    enable_output_filtering=True,
    
    # Output scope - "INTERVENTIONS" for minimal output, "FULL" for detailed debugging
    output_scope="INTERVENTIONS",
    
    # Content filter strength
    content_filter_strength="MEDIUM"
)

# Environment variable names for configuration
ENVIRONMENT_VARIABLES = {
    'BEDROCK_GUARDRAIL_ID': 'your-guardrail-id-here',
    'BEDROCK_GUARDRAIL_VERSION': 'DRAFT',
    'AWS_REGION': 'us-west-2',
    'GUARDRAIL_INPUT_FILTERING': 'true',
    'GUARDRAIL_OUTPUT_FILTERING': 'true',
    'GUARDRAIL_OUTPUT_SCOPE': 'INTERVENTIONS',
    'GUARDRAIL_FILTER_STRENGTH': 'MEDIUM'
}