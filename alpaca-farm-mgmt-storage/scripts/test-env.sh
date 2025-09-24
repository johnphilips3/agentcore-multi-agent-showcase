#!/bin/bash

# Simple script to test environment variable detection
# This helps debug issues with the deploy.sh script

echo "🔍 Environment Variable Test"
echo "============================"
echo ""

echo "Required RDS Variables:"
echo "  RDS_HOST: ${RDS_HOST:-'❌ NOT SET'}"
echo "  RDS_USERNAME: ${RDS_USERNAME:-'❌ NOT SET'}"
echo "  RDS_PASSWORD: ${RDS_PASSWORD:+'✅ SET' || '❌ NOT SET'}"
echo ""

echo "Optional Variables:"
echo "  RDS_PORT: ${RDS_PORT:-'5432 (default)'}"
echo "  RDS_DATABASE: ${RDS_DATABASE:-'alpaca_herd (default)'}"
echo "  AWS_REGION: ${AWS_REGION:-'us-east-1 (default)'}"
echo "  STAGE: ${STAGE:-'dev (default)'}"
echo ""
echo "VPC Variables (optional):"
echo "  VPC_ID: ${VPC_ID:-'(not set - Lambda runs outside VPC)'}"
echo "  SUBNET_IDS: ${SUBNET_IDS:-'(not set)'}"
echo "  SECURITY_GROUP_IDS: ${SECURITY_GROUP_IDS:-'(not set)'}"
echo ""

echo "AWS Configuration:"
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    echo "  ✅ AWS CLI configured"
    echo "  Account: $ACCOUNT_ID"
    echo "  User: $USER_ARN"
else
    echo "  ❌ AWS CLI not configured or credentials invalid"
fi
echo ""

echo "Environment Check:"
MISSING_VARS=()

if [[ -z "$RDS_HOST" ]]; then
    MISSING_VARS+=("RDS_HOST")
fi

if [[ -z "$RDS_USERNAME" ]]; then
    MISSING_VARS+=("RDS_USERNAME")
fi

if [[ -z "$RDS_PASSWORD" ]]; then
    MISSING_VARS+=("RDS_PASSWORD")
fi

if [[ ${#MISSING_VARS[@]} -eq 0 ]]; then
    echo "  ✅ All required environment variables are set"
    echo ""
    echo "You can now run:"
    echo "  ./scripts/deploy.sh"
else
    echo "  ❌ Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "    - $var"
    done
    echo ""
    echo "Please set the missing variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  export $var=your-value"
    done
fi

echo ""
echo "Example setup:"
echo "  export RDS_HOST=your-rds-endpoint.region.rds.amazonaws.com"
echo "  export RDS_USERNAME=your-username"
echo "  export RDS_PASSWORD=your-password"
echo "  export AWS_REGION=us-east-1"
echo "  export STAGE=dev"
echo ""
echo "Example VPC setup (optional, for enhanced security):"
echo "  export VPC_ID=vpc-12345678"
echo "  export SUBNET_IDS=subnet-12345678,subnet-87654321"
echo "  export SECURITY_GROUP_IDS=sg-12345678"