"""
Test script for Bedrock Guardrails implementation.

This script demonstrates how to test the guardrails functionality
and provides examples of different content types.
"""

import logging
import os
from typing import List, Dict, Any

from guardrails_config import GuardrailsConfig
from guardrails_client import GuardrailsClient
from guardrails_middleware import GuardrailsMiddleware, with_guardrails


# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_configuration():
    """Test guardrails configuration."""
    print("=== Testing Configuration ===")
    
    try:
        # Test environment configuration
        config = GuardrailsConfig.from_environment()
        print(f"✓ Configuration loaded from environment")
        print(f"  Guardrail ID: {config.guardrail_id}")
        print(f"  Version: {config.guardrail_version}")
        print(f"  Region: {config.aws_region}")
        
        # Test validation
        config.validate()
        print("✓ Configuration validation passed")
        
    except Exception as e:
        print(f"✗ Configuration test failed: {e}")
        return False
    
    return True


def test_client_initialization():
    """Test guardrails client initialization."""
    print("\n=== Testing Client Initialization ===")
    
    try:
        config = GuardrailsConfig.from_environment()
        client = GuardrailsClient(config)
        print("✓ Guardrails client initialized successfully")
        return client
        
    except Exception as e:
        print(f"✗ Client initialization failed: {e}")
        return None


def test_content_safety(client: GuardrailsClient):
    """Test content safety evaluation."""
    print("\n=== Testing Content Safety ===")
    
    test_contents = [
        "Hello, how are the alpacas doing today?",
        "Can you show me the health records for alpaca ID 123?",
        "I want to add a new alpaca named Fluffy to the herd.",
        "What's the breeding history for our prize-winning alpacas?"
    ]
    
    for content in test_contents:
        try:
            is_safe = client.is_content_safe(content)
            status = "✓ SAFE" if is_safe else "⚠ FILTERED"
            print(f"  {status}: '{content[:50]}{'...' if len(content) > 50 else ''}'")
            
        except Exception as e:
            print(f"  ✗ ERROR: '{content[:50]}{'...' if len(content) > 50 else ''}' - {e}")


def test_detailed_assessment(client: GuardrailsClient):
    """Test detailed content assessment."""
    print("\n=== Testing Detailed Assessment ===")
    
    test_content = "Can you help me manage my alpaca farm records?"
    
    try:
        assessment = client.get_assessment_details(test_content)
        print(f"Content: '{test_content}'")
        print(f"Action: {assessment.get('action', 'UNKNOWN')}")
        print(f"Reason: {assessment.get('action_reason', 'None')}")
        
        # Print usage information if available
        usage = assessment.get('usage', {})
        if usage:
            print("Usage metrics:")
            for key, value in usage.items():
                if value > 0:
                    print(f"  {key}: {value}")
                    
    except Exception as e:
        print(f"✗ Assessment test failed: {e}")


def test_middleware():
    """Test guardrails middleware."""
    print("\n=== Testing Middleware ===")
    
    try:
        middleware = GuardrailsMiddleware()
        print("✓ Middleware initialized")
        
        # Test input filtering
        test_input = "What are the health records for my alpacas?"
        filtered_input = middleware.filter_input(test_input)
        print(f"✓ Input filtering: '{test_input}' -> '{filtered_input}'")
        
        # Test output filtering
        test_output = "Here are the health records for your alpacas..."
        filtered_output = middleware.filter_output(test_output)
        print(f"✓ Output filtering: '{test_output}' -> '{filtered_output}'")
        
        # Test enable/disable
        middleware.disable()
        print("✓ Middleware disabled")
        
        middleware.enable()
        print("✓ Middleware enabled")
        
    except Exception as e:
        print(f"✗ Middleware test failed: {e}")


@with_guardrails(filter_input=True, filter_output=True)
def test_decorator_function(query: str) -> str:
    """Test function with guardrails decorator."""
    return f"Processed query: {query}"


def test_decorator():
    """Test guardrails decorator."""
    print("\n=== Testing Decorator ===")
    
    try:
        test_query = "Show me information about alpaca breeding"
        result = test_decorator_function(test_query)
        print(f"✓ Decorator test: '{test_query}' -> '{result}'")
        
    except Exception as e:
        print(f"✗ Decorator test failed: {e}")


def test_environment_setup():
    """Test environment setup and provide guidance."""
    print("\n=== Environment Setup Check ===")
    
    required_vars = [
        'BEDROCK_GUARDRAIL_ID',
        'AWS_REGION'
    ]
    
    optional_vars = [
        'BEDROCK_GUARDRAIL_VERSION',
        'GUARDRAIL_INPUT_FILTERING',
        'GUARDRAIL_OUTPUT_FILTERING',
        'GUARDRAIL_OUTPUT_SCOPE',
        'GUARDRAIL_FILTER_STRENGTH'
    ]
    
    print("Required environment variables:")
    missing_required = False
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Check if it's a placeholder value
            if var == 'BEDROCK_GUARDRAIL_ID' and ('default' in value.lower() or 'your-' in value.lower() or 'example' in value.lower()):
                print(f"  ⚠ {var}: {value} (appears to be a placeholder - please set your actual guardrail ID)")
                missing_required = True
            else:
                print(f"  ✓ {var}: {value}")
        else:
            print(f"  ✗ {var}: Not set (REQUIRED)")
            missing_required = True
    
    print("\nOptional environment variables:")
    for var in optional_vars:
        value = os.getenv(var)
        if value:
            print(f"  ✓ {var}: {value}")
        else:
            print(f"  - {var}: Using default")
    
    # Check AWS credentials
    try:
        import boto3
        session = boto3.Session()
        credentials = session.get_credentials()
        if credentials:
            print("  ✓ AWS credentials: Available")
        else:
            print("  ✗ AWS credentials: Not found")
            missing_required = True
    except Exception as e:
        print(f"  ✗ AWS credentials check failed: {e}")
        missing_required = True
    
    if missing_required:
        print("\n⚠️  SETUP REQUIRED:")
        print("1. Create a guardrail in AWS Bedrock console")
        print("2. Set BEDROCK_GUARDRAIL_ID environment variable with your actual guardrail ID")
        print("3. Ensure AWS credentials are configured")
        print("4. Verify your AWS credentials have bedrock:ApplyGuardrail permissions")
        return False
    
    return True


def run_all_tests():
    """Run all guardrails tests."""
    print("🛡️  Bedrock Guardrails Test Suite")
    print("=" * 50)
    
    # Check environment setup first
    if not test_environment_setup():
        print("\n❌ Environment setup incomplete. Please complete the setup steps above before running tests.")
        return
    
    # Test configuration
    if not test_configuration():
        print("\n❌ Configuration test failed. Please check your environment variables.")
        return
    
    # Test client initialization
    client = test_client_initialization()
    if not client:
        print("\n❌ Client initialization failed. Please check your AWS credentials and guardrail configuration.")
        return
    
    # Run content tests
    test_content_safety(client)
    test_detailed_assessment(client)
    
    # Test middleware and decorator
    test_middleware()
    test_decorator()
    
    print("\n" + "=" * 50)
    print("🎉 Test suite completed!")
    print("\nNext steps:")
    print("1. Try the alpaca_farm_guardrails_example.py for a complete integration example")
    print("2. Monitor your guardrail usage in AWS CloudWatch")
    print("3. Adjust guardrail policies as needed in AWS Bedrock console")


if __name__ == "__main__":
    run_all_tests()