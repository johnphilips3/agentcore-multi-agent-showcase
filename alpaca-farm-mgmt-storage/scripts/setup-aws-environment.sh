#!/bin/bash

# =============================================================================
# AWS Environment Setup Helper for Alpaca Herd Storage
# =============================================================================
# This script helps you prepare your environment for running the RDS setup
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

echo "🦙 Alpaca Herd Storage - AWS Environment Setup"
echo "=============================================="
echo

# Check AWS CLI
log_info "Checking AWS CLI installation..."
if ! command -v aws &> /dev/null; then
    log_warning "AWS CLI not found. Installing..."
    if command -v brew &> /dev/null; then
        brew install awscli
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y awscli
    elif command -v yum &> /dev/null; then
        sudo yum install -y awscli
    else
        echo "Please install AWS CLI manually: https://aws.amazon.com/cli/"
        exit 1
    fi
else
    log_success "AWS CLI is installed"
fi

# Check AWS configuration
log_info "Checking AWS configuration..."
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    CURRENT_REGION=$(aws configure get region)
    log_success "AWS CLI is configured"
    echo "  Account ID: ${ACCOUNT_ID}"
    echo "  Current Region: ${CURRENT_REGION}"
else
    log_warning "AWS CLI is not configured"
    echo
    echo "Please configure AWS CLI with one of these methods:"
    echo
    echo "Method 1: AWS Configure"
    echo "  aws configure"
    echo
    echo "Method 2: Environment Variables"
    echo "  export AWS_ACCESS_KEY_ID=your-key"
    echo "  export AWS_SECRET_ACCESS_KEY=your-secret"
    echo "  export AWS_DEFAULT_REGION=us-east-1"
    echo
    echo "Method 3: AWS Profile"
    echo "  aws configure --profile alpaca-herd"
    echo "  export AWS_PROFILE=alpaca-herd"
    echo
    exit 1
fi

# Check PostgreSQL client (optional)
log_info "Checking PostgreSQL client..."
if command -v psql &> /dev/null; then
    log_success "PostgreSQL client (psql) is available"
else
    log_warning "PostgreSQL client (psql) not found"
    echo "  Install with: brew install postgresql (macOS) or apt-get install postgresql-client (Ubuntu)"
    echo "  This is optional but recommended for database schema setup"
fi

echo
log_success "Environment setup complete!"
echo
echo "Next steps:"
echo "1. Run the RDS infrastructure setup:"
echo "   ./scripts/create-rds-infrastructure.sh"
echo
echo "2. Or customize the environment first:"
echo "   export ENVIRONMENT=development"
echo "   export DB_INSTANCE_CLASS=db.t3.micro"
echo "   export AWS_REGION=us-west-2"
echo "   ./scripts/create-rds-infrastructure.sh"
echo
echo "3. Test your setup:"
echo "   node demo/aws-config-demo.js"