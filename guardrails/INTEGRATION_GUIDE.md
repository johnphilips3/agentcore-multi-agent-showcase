# Integration Guide: Adding Guardrails to Existing Alpaca Farm Assistant

This guide shows how to integrate Bedrock Guardrails into your existing alpaca farm assistant implementation.

## Quick Start

### 1. Environment Setup

First, set up your environment variables:

```bash
# Required: Your Bedrock Guardrail ID
export BEDROCK_GUARDRAIL_ID="your-guardrail-id-from-aws-console"

# Optional: Guardrail version (defaults to "DRAFT")
export BEDROCK_GUARDRAIL_VERSION="DRAFT"

# Optional: AWS region (defaults to "us-west-2")
export AWS_REGION="us-west-2"

# Optional: Enable/disable filtering (defaults to "true")
export GUARDRAIL_INPUT_FILTERING="true"
export GUARDRAIL_OUTPUT_FILTERING="true"
```

### 2. Simple Integration

The easiest way to add guardrails is using the decorator:

```python
from guardrails import with_guardrails

@with_guardrails(filter_input=True, filter_output=True)
@tool
def alpaca_farm_assistant(query: str) -> str:
    """Your existing alpaca farm assistant function with guardrails protection."""
    # Your existing implementation here
    return process_alpaca_query(query)
```

### 3. Advanced Integration

For more control, use the middleware directly:

```python
from guardrails import GuardrailsMiddleware

def alpaca_farm_assistant_with_guardrails(query: str) -> str:
    # Initialize guardrails
    guardrails = GuardrailsMiddleware()
    
    # Filter input
    safe_query = guardrails.filter_input(query)
    
    # Process with your existing logic
    response = your_existing_alpaca_assistant(safe_query)
    
    # Filter output
    safe_response = guardrails.filter_output(response)
    
    return safe_response
```

## Step-by-Step Integration

### Step 1: Create Guardrail in AWS

1. Go to AWS Bedrock Console
2. Navigate to Guardrails
3. Click "Create guardrail"
4. Configure your policies:
   - **Content filters**: Enable hate, insults, sexual, violence, misconduct
   - **Topic policies**: Add farm-specific topics if needed
   - **Word filters**: Add any custom blocked words
   - **Sensitive information**: Enable PII detection
5. Save and note the Guardrail ID

### Step 2: Modify Your Existing Code

Replace your existing `alpaca_farm_assistant.py` tool function:

```python
# Before (existing code)
@tool
def alpaca_farm_assistant(query: str) -> str:
    # Your existing implementation
    pass

# After (with guardrails)
from guardrails import with_guardrails

@with_guardrails(filter_input=True, filter_output=True)
@tool
def alpaca_farm_assistant(query: str) -> str:
    # Your existing implementation (unchanged)
    pass
```

### Step 3: Test the Integration

Run the test script to verify everything works:

```bash
cd agentcore-agents/alpaca_farm_multi_agent_example/guardrails
python test_guardrails.py
```

### Step 4: Monitor and Adjust

Monitor your guardrail usage in AWS CloudWatch and adjust policies as needed.

## Integration Options

### Option 1: Decorator (Recommended for Simple Cases)

```python
from guardrails import with_guardrails

@with_guardrails()
def my_function(input_text: str) -> str:
    return process_text(input_text)
```

**Pros**: Simple, minimal code changes
**Cons**: Less control over filtering behavior

### Option 2: Middleware (Recommended for Complex Cases)

```python
from guardrails import GuardrailsMiddleware

def my_function(input_text: str) -> str:
    middleware = GuardrailsMiddleware()
    
    # Custom logic before filtering
    preprocessed = preprocess(input_text)
    
    # Apply guardrails
    safe_input = middleware.filter_input(preprocessed)
    result = process_text(safe_input)
    safe_output = middleware.filter_output(result)
    
    # Custom logic after filtering
    return postprocess(safe_output)
```

**Pros**: Full control, custom logic integration
**Cons**: More code, more complex

### Option 3: Client Direct (For Advanced Use Cases)

```python
from guardrails import GuardrailsClient, GuardrailsConfig

def my_function(input_text: str) -> str:
    config = GuardrailsConfig.from_environment()
    client = GuardrailsClient(config)
    
    # Check safety
    if not client.is_content_safe(input_text):
        return "Content blocked by safety policies"
    
    # Get detailed assessment
    assessment = client.get_assessment_details(input_text)
    
    # Process based on assessment
    result = process_with_assessment(input_text, assessment)
    
    return result
```

**Pros**: Maximum control, detailed assessments
**Cons**: Most complex, requires understanding of API

## Configuration Examples

### Development Configuration

```python
from guardrails import GuardrailsConfig

config = GuardrailsConfig(
    guardrail_id="your-dev-guardrail-id",
    guardrail_version="DRAFT",
    enable_input_filtering=True,
    enable_output_filtering=True,
    output_scope="FULL"  # Detailed debugging info
)
```

### Production Configuration

```python
config = GuardrailsConfig(
    guardrail_id="your-prod-guardrail-id",
    guardrail_version="1",  # Specific version
    enable_input_filtering=True,
    enable_output_filtering=True,
    output_scope="INTERVENTIONS"  # Minimal output
)
```

## Error Handling

Always include proper error handling:

```python
from guardrails import GuardrailsMiddleware

def safe_alpaca_assistant(query: str) -> str:
    try:
        middleware = GuardrailsMiddleware()
        safe_query = middleware.filter_input(query)
        
        # Your processing logic
        result = process_alpaca_query(safe_query)
        
        safe_result = middleware.filter_output(result)
        return safe_result
        
    except Exception as e:
        logger.error(f"Guardrails error: {e}")
        return "I apologize, but I cannot process your request at this time due to safety restrictions."
```

## Performance Considerations

### Caching

For repeated content, consider caching guardrail results:

```python
from functools import lru_cache

@lru_cache(maxsize=1000)
def cached_safety_check(content: str) -> bool:
    return client.is_content_safe(content)
```

### Async Processing

For high-throughput applications:

```python
import asyncio
import aioboto3

class AsyncGuardrailsClient:
    async def is_content_safe_async(self, content: str) -> bool:
        # Async implementation
        pass
```

## Troubleshooting

### Common Issues

1. **"Guardrail not found"**
   - Check your `BEDROCK_GUARDRAIL_ID` environment variable
   - Verify the guardrail exists in the correct AWS region

2. **"Access denied"**
   - Ensure your AWS credentials have `bedrock:ApplyGuardrail` permission
   - Check IAM policies and roles

3. **High latency**
   - Consider caching for repeated content
   - Use appropriate AWS region
   - Implement async processing for high volume

4. **Content unexpectedly blocked**
   - Use `output_scope="FULL"` for detailed debugging
   - Review your guardrail policies in AWS console
   - Check assessment details for specific policy violations

### Debug Mode

Enable detailed logging:

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('guardrails')
```

Use full output scope for debugging:

```python
config = GuardrailsConfig(
    guardrail_id="your-id",
    output_scope="FULL"
)
```

## Best Practices

1. **Start Simple**: Begin with the decorator approach
2. **Test Thoroughly**: Use the test script to verify functionality
3. **Monitor Usage**: Track guardrail costs and performance in AWS
4. **Update Regularly**: Keep guardrail policies current
5. **Handle Errors Gracefully**: Always provide fallback responses
6. **Log Assessments**: Log guardrail decisions for analysis
7. **Use Appropriate Scope**: Use "INTERVENTIONS" in production, "FULL" for debugging

## Next Steps

1. Run the test suite: `python guardrails/test_guardrails.py`
2. Try the complete example: `python guardrails/alpaca_farm_guardrails_example.py`
3. Integrate with your existing assistant
4. Monitor and tune your guardrail policies
5. Consider implementing caching for better performance