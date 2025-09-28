#!/usr/bin/env python3
"""
Quick setup test script for Bedrock Guardrails.
This script helps diagnose configuration issues.
"""

import boto3
import os
import json
from botocore.exceptions import ClientError


def test_aws_connection():
    """Test basic AWS connectivity."""
    print("🔍 Testing AWS Connection...")
    
    try:
        # Test basic AWS connectivity
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()
        print(f"✅ AWS Connection successful")
        print(f"   Account: {identity.get('Account')}")
        print(f"   User/Role: {identity.get('Arn')}")
        return True
    except Exception as e:
        print(f"❌ AWS Connection failed: {e}")
        return False


def test_bedrock_access():
    """Test Bedrock service access."""
    print("\n🔍 Testing Bedrock Access...")
    
    try:
        region = os.getenv('AWS_REGION', 'us-west-2')
        bedrock = boto3.client('bedrock', region_name=region)
        
        # Try to list foundation models (this requires basic Bedrock access)
        response = bedrock.list_foundation_models()
        model_count = len(response.get('modelSummaries', []))
        print(f"✅ Bedrock access successful")
        print(f"   Region: {region}")
        print(f"   Available models: {model_count}")
        return True
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'AccessDeniedException':
            print(f"❌ Bedrock access denied. Check IAM permissions.")
        else:
            print(f"❌ Bedrock access failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Bedrock access failed: {e}")
        return False


def list_guardrails():
    """List available guardrails."""
    print("\n🔍 Listing Available Guardrails...")
    
    try:
        region = os.getenv('AWS_REGION', 'us-west-2')
        bedrock = boto3.client('bedrock', region_name=region)
        
        response = bedrock.list_guardrails()
        guardrails = response.get('guardrails', [])
        
        if not guardrails:
            print("⚠️  No guardrails found in your account")
            print("   You need to create a guardrail in the AWS Bedrock console first")
            return []
        
        print(f"✅ Found {len(guardrails)} guardrail(s):")
        for guardrail in guardrails:
            print(f"   ID: {guardrail['id']}")
            print(f"   Name: {guardrail['name']}")
            print(f"   Status: {guardrail['status']}")
            print(f"   Version: {guardrail['version']}")
            print()
        
        return guardrails
    except Exception as e:
        print(f"❌ Failed to list guardrails: {e}")
        return []


def test_guardrail_config():
    """Test current guardrail configuration."""
    print("\n🔍 Testing Current Guardrail Configuration...")
    
    guardrail_id = os.getenv('BEDROCK_GUARDRAIL_ID')
    guardrail_version = os.getenv('BEDROCK_GUARDRAIL_VERSION', 'DRAFT')
    region = os.getenv('AWS_REGION', 'us-west-2')
    
    print(f"Current configuration:")
    print(f"   BEDROCK_GUARDRAIL_ID: {guardrail_id}")
    print(f"   BEDROCK_GUARDRAIL_VERSION: {guardrail_version}")
    print(f"   AWS_REGION: {region}")
    
    if not guardrail_id or guardrail_id in ['default-guardrail', 'us.guardrail.v1']:
        print("❌ Invalid guardrail ID detected")
        print("   Please set BEDROCK_GUARDRAIL_ID to a real guardrail ID")
        return False
    
    # Try to get guardrail details
    try:
        bedrock = boto3.client('bedrock', region_name=region)
        response = bedrock.get_guardrail(
            guardrailIdentifier=guardrail_id,
            guardrailVersion=guardrail_version
        )
        
        print(f"✅ Guardrail found:")
        print(f"   Name: {response['name']}")
        print(f"   Status: {response['status']}")
        print(f"   Version: {response['version']}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            print(f"❌ Guardrail not found: {guardrail_id}")
            print("   Check that the guardrail ID is correct and exists in your account")
        else:
            print(f"❌ Error accessing guardrail: {e}")
        return False


def test_simple_guardrail_call():
    """Test a simple guardrail API call."""
    print("\n🔍 Testing Simple Guardrail API Call...")
    
    guardrail_id = os.getenv('BEDROCK_GUARDRAIL_ID')
    guardrail_version = os.getenv('BEDROCK_GUARDRAIL_VERSION', 'DRAFT')
    region = os.getenv('AWS_REGION', 'us-west-2')
    
    if not guardrail_id or guardrail_id in ['default-guardrail', 'us.guardrail.v1']:
        print("❌ Skipping API test - invalid guardrail ID")
        return False
    
    try:
        bedrock_runtime = boto3.client('bedrock-runtime', region_name=region)
        
        response = bedrock_runtime.apply_guardrail(
            guardrailIdentifier=guardrail_id,
            guardrailVersion=guardrail_version,
            source='INPUT',
            content=[{'text': {'text': 'Hello, this is a test message.'}}]
        )
        
        action = response.get('action', 'NONE')
        print(f"✅ Guardrail API call successful")
        print(f"   Action: {action}")
        print(f"   Usage: {response.get('usage', {})}")
        return True
        
    except Exception as e:
        print(f"❌ Guardrail API call failed: {e}")
        return False


def main():
    """Run all diagnostic tests."""
    print("🛡️  Bedrock Guardrails Setup Diagnostic")
    print("=" * 50)
    
    # Run tests in order
    tests = [
        test_aws_connection,
        test_bedrock_access,
        list_guardrails,
        test_guardrail_config,
        test_simple_guardrail_call
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            results.append(False)
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"   Passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All tests passed! Your setup looks good.")
    else:
        print("⚠️  Some tests failed. Please review the output above.")
        print("\n💡 Next Steps:")
        print("1. Create a guardrail in AWS Bedrock console if you haven't")
        print("2. Set the correct BEDROCK_GUARDRAIL_ID environment variable")
        print("3. Ensure your AWS credentials have the required permissions")
        print("4. Check the SETUP_INSTRUCTIONS.md file for detailed steps")


if __name__ == "__main__":
    main()