# Bedrock Guardrails for Alpaca Farm Multi-Agent Example

This directory contains the implementation of Amazon Bedrock Guardrails for the Alpaca Farm Multi-Agent Example. The guardrails provide content filtering and safety measures to ensure appropriate and safe interactions with the alpaca farm management system.

## Overview

The guardrails implementation consists of several key components:

- **GuardrailsConfig**: Configuration management for guardrail settings
- **GuardrailsClient**: Low-level client for interacting with Bedrock Guardrails API
- **GuardrailsMiddleware**: Middleware for integrating guardrails into agent workflows
- **AlpacaFarmAssistantWithGuardrails**: Example integration with the existing farm assistant

## Features

- **Input Filtering**: Automatically filters user inputs to prevent harmful or inappropriate content
- **Output Filtering**: Ensures agent responses are safe and appropriate
- **Configurable Policies**: Support for content policies, topic policies, word filters, and PII detection
- **Detailed Assessments**: Provides detailed information about why content was filtered
- **Decorator Support**: Easy integration with existing functions using the `@with_guardrails` decorator
- **Environment Configuration**: Flexible configuration via environment variables

## Setup

### Prerequisites

1. **AWS Account**: You need an AWS account with access to Amazon Bedrock
2. **Bedrock Guardrail**: Create a guardrail in the AWS Bedrock console
3. **AWS Credentials**: Configure AWS credentials (via AWS CLI, IAM roles, or environment variables)
4. **Python Dependencies**: Install required packages (see requirements below)

### Installation

1. **Install Dependencies**:
   ```bash
   pip install boto3 botocore
   ```

2. **Quick Setup (Recommended)**:
   Use the setup helper to automatically configure your environment:
   ```bash
   python guardrails/setup_helper.py
   ```
   
   This will:
   - Check your AWS credentials
   - List available guardrails
   - Test guardrail functionality
   - Generate environment configuration

3. **Manual Setup**:
   
   a. **Create Guardrail in AWS**:
   - Go to the AWS Bedrock console
   - Navigate to Guardrails
   - Create a new guardrail with your desired policies
   - Note the Guardrail ID for configuration

   b. **Configure Environment Variables**:
   ```bash
   export BEDROCK_GUARDRAIL_ID="your-guardrail-id"
   export BEDROCK_GUARDRAIL_VERSION="DRAFT"
   export AWS_REGION="us-west-2"
   export GUARDRAIL_INPUT_FILTERING="true"
   export GUARDRAIL_OUTPUT_FILTERING="true"
   ```

4. **AWS Credentials**:
   Ensure your AWS credentials are configured with permissions for:
   - `bedrock:ListGuardrails`
   - `bedrock:ApplyGuardrail`
   - Access to your specific guardrail resource

## Usage

### Basic Usage

```python
from guardrails import GuardrailsClient, GuardrailsConfig

# Create configuration
config = GuardrailsConfig.from_environment()

# Initialize client
client = GuardrailsClient(config)

# Check if content is safe
is_safe = client.is_content_safe("Hello, how are the alpacas today?")

# Get filtered content
filtered = client.get_filtered_content("Some potentially harmful content")

# Get detailed assessment
assessment = client.get_assessment_details("Content to assess")
```

### Middleware Integration

```python
from guardrails import GuardrailsMiddleware

# Initialize middleware
middleware = GuardrailsMiddleware()

# Filter input content
safe_input = middleware.filter_input("User input content")

# Filter output content
safe_output = middleware.filter_output("Agent response content")
```

### Decorator Usage

```python
from guardrails import with_guardrails

@with_guardrails(filter_input=True, filter_output=True)
def my_agent_function(query: str) -> str:
    # Your agent logic here
    return "Agent response"
```

### Integration with Existing Assistant

```python
from guardrails.alpaca_farm_guardrails_example import AlpacaFarmAssistantWithGuardrails

# Create assistant with guardrails
assistant = AlpacaFarmAssistantWithGuardrails()

# Process queries safely
response = assistant.process_query("What are the health records for alpaca ID 123?")

# Check guardrails status
status = assistant.get_guardrails_status()
```

## Configuration Options

### GuardrailsConfig Parameters

- **guardrail_id**: Your Bedrock guardrail identifier (required)
- **guardrail_version**: Version of the guardrail ("DRAFT" or version number)
- **aws_region**: AWS region where the guardrail is deployed
- **enable_input_filtering**: Enable/disable input content filtering
- **enable_output_filtering**: Enable/disable output content filtering
- **output_scope**: "INTERVENTIONS" (minimal) or "FULL" (detailed debugging)
- **content_filter_strength**: "LOW", "MEDIUM", or "HIGH"

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BEDROCK_GUARDRAIL_ID` | Guardrail identifier | Required |
| `BEDROCK_GUARDRAIL_VERSION` | Guardrail version | "DRAFT" |
| `AWS_REGION` | AWS region | "us-west-2" |
| `GUARDRAIL_INPUT_FILTERING` | Enable input filtering | "true" |
| `GUARDRAIL_OUTPUT_FILTERING` | Enable output filtering | "true" |
| `GUARDRAIL_OUTPUT_SCOPE` | Output detail level | "INTERVENTIONS" |
| `GUARDRAIL_FILTER_STRENGTH` | Filter strength | "MEDIUM" |

## Guardrail Policies

The implementation supports all Bedrock Guardrail policy types:

### Content Policies
- **Hate Speech**: Filters content promoting hate or discrimination
- **Insults**: Blocks insulting or demeaning language
- **Sexual Content**: Filters sexually explicit content
- **Violence**: Blocks violent or graphic content
- **Misconduct**: Prevents discussion of illegal activities
- **Prompt Attacks**: Protects against prompt injection attempts

### Topic Policies
- Custom topic restrictions
- Domain-specific content filtering

### Word Policies
- Custom word filtering
- Managed word lists (profanity, etc.)

### Sensitive Information Policies
- PII detection and masking
- Custom regex patterns
- Credit card numbers, SSNs, etc.

## Error Handling

The implementation includes comprehensive error handling:

- **Network Errors**: Graceful handling of API connectivity issues
- **Authentication Errors**: Clear error messages for credential problems
- **Configuration Errors**: Validation of configuration parameters
- **Fail-Safe Behavior**: Conservative approach when guardrails can't be evaluated

## Logging

The implementation uses Python's logging module:

```python
import logging

# Enable debug logging for detailed information
logging.basicConfig(level=logging.DEBUG)

# Or configure specific logger
logger = logging.getLogger('guardrails')
logger.setLevel(logging.INFO)
```

## Performance Considerations

- **Caching**: Consider implementing response caching for repeated content
- **Async Operations**: For high-throughput applications, consider async implementations
- **Batch Processing**: Use batch operations when processing multiple content items
- **Regional Deployment**: Deploy guardrails in the same region as your application

## Security Best Practices

1. **Credential Management**: Use IAM roles or AWS credentials, never hardcode secrets
2. **Least Privilege**: Grant minimal required permissions for guardrail access
3. **Monitoring**: Monitor guardrail usage and costs
4. **Regular Updates**: Keep guardrail policies updated based on new requirements
5. **Testing**: Regularly test guardrail effectiveness with various content types

## Troubleshooting

### Common Issues

1. **"Guardrail not found"**: Verify the guardrail ID and region
2. **"Access denied"**: Check AWS credentials and IAM permissions
3. **"Guardrail was enabled but input is in incorrect format"**: 
   - Ensure you're using a real guardrail ID (not a placeholder like "default-guardrail")
   - Verify the guardrail exists and is in READY status
   - Check that the guardrail version is correct ("DRAFT" or a specific version number)
4. **"Invalid content format"**: Ensure content is properly formatted as text
5. **High latency**: Consider regional deployment and caching strategies

### Debug Mode

Enable detailed logging and use "FULL" output scope for debugging:

```python
config = GuardrailsConfig(
    guardrail_id="your-id",
    output_scope="FULL"  # Provides detailed assessment information
)
```

## Examples

See `alpaca_farm_guardrails_example.py` for a complete integration example with the existing alpaca farm assistant.

## Contributing

When contributing to the guardrails implementation:

1. Follow existing code style and patterns
2. Add comprehensive error handling
3. Include logging for debugging
4. Update documentation for new features
5. Test with various content types and edge cases

## License

This implementation follows the same license as the parent project.