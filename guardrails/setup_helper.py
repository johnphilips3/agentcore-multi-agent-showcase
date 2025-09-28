#!/usr/bin/env python3
"""
Setup helper for Bedrock Guardrails.

This script helps users set up their environment for using Bedrock Guardrails.
"""

import os
import boto3
import json
from botocore.exceptions import ClientError, NoCredentialsError


def check_aws_credentials():
    """Check if AWS credentials are configured."""
    try:
        session = boto3.Session()
        credentials = session.get_credentials()
        if credentials:
            print("✓ AWS credentials are configured")
            return True
        else:
            print("✗ AWS credentials not found")
            return False
    except Exception as e:
        print(f"✗ Error checking AWS credentials: {e}")
        return False


def check_bedrock_access():
    """Check if user has access to Bedrock."""
    try:
        client = boto3.client('bedrock', region_name='us-west-2')
        # Try to list foundation models as a test
        response = client.list_foundation_models()
        print("✓ Bedrock access confirmed")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'AccessDeniedException':
            print("✗ Access denied to Bedrock. Check your IAM permissions.")
        else:
            print(f"✗ Bedrock access error: {e}")
        return False
    except NoCredentialsError:
        print("✗ No AWS credentials configured")
        return False
    except Exception as e:
        print(f"✗ Unexpected error checking Bedrock access: {e}")
        return False


def list_guardrails(region='us-west-2'):
    """List available guardrails."""
    try:
        client = boto3.client('bedrock', region_name=region)
        response = client.list_guardrails()
        
        guardrails = response.get('guardrails', [])
        if guardrails:
            print(f"✓ Found {len(guardrails)} guardrail(s) in {region}:")
            for guardrail in guardrails:
                print(f"  - ID: {guardrail['id']}")
                print(f"    Name: {guardrail.get('name', 'N/A')}")
                print(f"    Status: {guardrail.get('status', 'N/A')}")
                print(f"    Version: {guardrail.get('version', 'N/A')}")
                print()
            return guardrails
        else:
            print(f"✗ No guardrails found in {region}")
            return []
            
    except ClientError as e:
        print(f"✗ Error listing guardrails: {e}")
        return []


def test_guardrail(guardrail_id, region='us-west-2', version='DRAFT'):
    """Test a specific guardrail."""
    try:
        client = boto3.client('bedrock-runtime', region_name=region)
        
        test_content = "Hello, this is a test message."
        
        response = client.apply_guardrail(
            guardrailIdentifier=guardrail_id,
            guardrailVersion=version,
            source='INPUT',
            content=[{
                'text': {
                    'text': test_content
                }
            }]
        )
        
        action = response.get('action', 'UNKNOWN')
        print(f"✓ Guardrail test successful!")
        print(f"  Action: {action}")
        print(f"  Test content: '{test_content}'")
        
        if action == 'GUARDRAIL_INTERVENED':
            print(f"  Reason: {response.get('actionReason', 'N/A')}")
        
        return True
        
    except ClientError as e:
        print(f"✗ Guardrail test failed: {e}")
        return False


def generate_env_file(guardrail_id, region='us-west-2', version='DRAFT'):
    """Generate a .env file with the configuration."""
    env_content = f"""# Bedrock Guardrails Configuration
BEDROCK_GUARDRAIL_ID={guardrail_id}
BEDROCK_GUARDRAIL_VERSION={version}
AWS_REGION={region}
GUARDRAIL_INPUT_FILTERING=true
GUARDRAIL_OUTPUT_FILTERING=true
GUARDRAIL_OUTPUT_SCOPE=INTERVENTIONS
GUARDRAIL_FILTER_STRENGTH=MEDIUM
"""
    
    try:
        with open('.env', 'w') as f:
            f.write(env_content)
        print("✓ Generated .env file with guardrail configuration")
        print("  You can source this file or set these environment variables manually")
        return True
    except Exception as e:
        print(f"✗ Error generating .env file: {e}")
        return False


def main():
    """Main setup helper function."""
    print("🛡️  Bedrock Guardrails Setup Helper")
    print("=" * 50)
    
    # Step 1: Check AWS credentials
    print("\n1. Checking AWS credentials...")
    if not check_aws_credentials():
        print("\n❌ Please configure AWS credentials first:")
        print("   - Use 'aws configure' command")
        print("   - Or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables")
        print("   - Or use IAM roles if running on EC2/ECS/Lambda")
        return
    
    # Step 2: Check Bedrock access
    print("\n2. Checking Bedrock access...")
    if not check_bedrock_access():
        print("\n❌ Please ensure your AWS credentials have Bedrock permissions:")
        print("   - bedrock:ListFoundationModels")
        print("   - bedrock:ListGuardrails")
        print("   - bedrock:ApplyGuardrail")
        return
    
    # Step 3: List available guardrails
    print("\n3. Listing available guardrails...")
    regions_to_check = ['us-west-2', 'us-east-1', 'eu-west-1']
    
    all_guardrails = []
    for region in regions_to_check:
        print(f"\nChecking region: {region}")
        guardrails = list_guardrails(region)
        for guardrail in guardrails:
            guardrail['region'] = region
            all_guardrails.append(guardrail)
    
    if not all_guardrails:
        print("\n❌ No guardrails found in any region.")
        print("   Please create a guardrail in the AWS Bedrock console first:")
        print("   1. Go to AWS Bedrock console")
        print("   2. Navigate to Guardrails")
        print("   3. Click 'Create guardrail'")
        print("   4. Configure your policies and save")
        return
    
    # Step 4: Test guardrails
    print("\n4. Testing guardrails...")
    working_guardrails = []
    
    for guardrail in all_guardrails:
        guardrail_id = guardrail['id']
        region = guardrail['region']
        version = guardrail.get('version', 'DRAFT')
        
        print(f"\nTesting guardrail {guardrail_id} in {region}...")
        if test_guardrail(guardrail_id, region, version):
            working_guardrails.append(guardrail)
    
    if not working_guardrails:
        print("\n❌ No working guardrails found.")
        return
    
    # Step 5: Generate configuration
    print("\n5. Generating configuration...")
    
    # Use the first working guardrail
    selected_guardrail = working_guardrails[0]
    guardrail_id = selected_guardrail['id']
    region = selected_guardrail['region']
    version = selected_guardrail.get('version', 'DRAFT')
    
    print(f"\nUsing guardrail:")
    print(f"  ID: {guardrail_id}")
    print(f"  Region: {region}")
    print(f"  Version: {version}")
    
    # Generate .env file
    generate_env_file(guardrail_id, region, version)
    
    # Show export commands
    print(f"\n✓ Setup complete! You can now set these environment variables:")
    print(f"export BEDROCK_GUARDRAIL_ID={guardrail_id}")
    print(f"export AWS_REGION={region}")
    print(f"export BEDROCK_GUARDRAIL_VERSION={version}")
    
    print(f"\nOr source the generated .env file:")
    print(f"source .env")
    
    print(f"\n🎉 You can now run the test suite:")
    print(f"python test_guardrails.py")


if __name__ == "__main__":
    main()