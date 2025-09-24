#!/bin/bash

# =============================================================================
# AWS SAM Deployment Script for Alpaca Farm Management Storage API
# =============================================================================
# This script deploys the Express.js API to AWS Lambda using SAM
# Requirements: 2.1, 2.4, 5.2
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${PURPLE}[STEP]${NC} $1"; }

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STACK_NAME="alpaca-farm-mgmt-storage"
REGION="${AWS_REGION:-us-east-1}"
STAGE="${STAGE:-dev}"
FORCE_DEPLOY="${FORCE_DEPLOY:-false}"

# Debug: Show environment variables (remove this in production)
log_info "Environment variables detected:"
echo "  RDS_HOST: ${RDS_HOST:-'(not set)'}"
echo "  RDS_PORT: ${RDS_PORT:-'(not set)'}"
echo "  RDS_DATABASE: ${RDS_DATABASE:-'(not set)'}"
echo "  RDS_USERNAME: ${RDS_USERNAME:-'(not set)'}"
echo "  RDS_PASSWORD: ${RDS_PASSWORD:+'(set)' || '(not set)'}"
echo "  AWS_REGION: ${AWS_REGION:-'(not set)'}"
echo "  STAGE: ${STAGE:-'(not set)'}"
echo "  VPC_ID: ${VPC_ID:-'(not set - Lambda will run outside VPC)'}"
echo "  SUBNET_IDS: ${SUBNET_IDS:-'(not set)'}"
echo "  SECURITY_GROUP_IDS: ${SECURITY_GROUP_IDS:-'(not set)'}"
echo ""

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Deploy the Alpaca Farm Management Storage API to AWS Lambda using SAM"
    echo ""
    echo "Options:"
    echo "  -s, --stage STAGE          Deployment stage (dev, staging, prod) [default: dev]"
    echo "  -r, --region REGION        AWS region [default: us-east-1]"
    echo "  -f, --force                Skip confirmation prompts"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  RDS_HOST                   RDS PostgreSQL endpoint (required)"
    echo "  RDS_PORT                   RDS PostgreSQL port [default: 5432]"
    echo "  RDS_DATABASE               RDS database name [default: alpaca_herd]"
    echo "  RDS_USERNAME               RDS username (required)"
    echo "  RDS_PASSWORD               RDS password (required)"
    echo "  AWS_REGION                 AWS region [default: us-east-1]"
    echo "  STAGE                      Deployment stage [default: dev]"
    echo ""
    echo "VPC Configuration (optional):"
    echo "  VPC_ID                     VPC ID for Lambda deployment"
    echo "  SUBNET_IDS                 Comma-separated subnet IDs (required if VPC_ID set)"
    echo "  SECURITY_GROUP_IDS         Comma-separated security group IDs (optional)"
    echo ""
    echo "Examples:"
    echo "  ./scripts/test-env.sh      # Test environment variable setup"
    echo "  $0                         # Deploy to dev stage in us-east-1"
    echo "  $0 --stage prod            # Deploy to production stage"
    echo "  $0 --region us-west-2      # Deploy to us-west-2 region"
    echo "  $0 --force                 # Deploy without confirmation prompts"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stage)
            STAGE="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_DEPLOY="true"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Update stack name with stage
STACK_NAME="${STACK_NAME}-${STAGE}"

echo "🦙 Alpaca Farm Management Storage - AWS SAM Deployment"
echo "======================================================"
echo "Stage: ${STAGE}"
echo "Region: ${REGION}"
echo "Stack: ${STACK_NAME}"
echo "Deployment Mode: Command-line parameters"
echo ""

# Step 1: Validate prerequisites
log_step "1. Validating prerequisites..."

# Check if we're in the correct directory
if [[ ! -f "${PROJECT_ROOT}/template.yaml" ]]; then
    log_error "SAM template.yaml not found. Please run this script from the project root or scripts directory."
    exit 1
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

# Check SAM CLI
if ! command -v sam &> /dev/null; then
    log_error "SAM CLI not found. Please install SAM CLI first."
    echo "Install with: pip install aws-sam-cli"
    exit 1
fi

# Check Node.js and npm
if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_error "npm not found. Please install npm first."
    exit 1
fi

log_success "All prerequisites are installed"

# Step 2: Validate AWS credentials
log_step "2. Validating AWS credentials..."

if ! aws sts get-caller-identity --region "$REGION" &> /dev/null; then
    log_error "AWS credentials not configured or invalid."
    echo ""
    echo "Please configure AWS credentials using one of these methods:"
    echo "1. aws configure"
    echo "2. Set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
    echo "3. Use AWS profiles: aws configure --profile <profile-name>"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
CURRENT_USER=$(aws sts get-caller-identity --query Arn --output text --region "$REGION")

log_success "AWS credentials validated"
echo "  Account ID: ${ACCOUNT_ID}"
echo "  User/Role: ${CURRENT_USER}"
echo "  Region: ${REGION}"

# Step 3: Validate RDS configuration
log_step "3. Validating RDS configuration..."

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

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    log_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  ❌ $var"
    done
    echo ""
    echo "Please set the missing variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  export $var=your-value"
    done
    echo ""
    echo "💡 Tip: Run './scripts/test-env.sh' to check your environment setup"
    echo ""
    echo "Example setup:"
    echo "  export RDS_HOST=your-rds-endpoint.region.rds.amazonaws.com"
    echo "  export RDS_USERNAME=your-username"
    echo "  export RDS_PASSWORD=your-password"
    echo ""
    echo "Example VPC setup (optional):"
    echo "  export VPC_ID=vpc-12345678"
    echo "  export SUBNET_IDS=subnet-12345678,subnet-87654321"
    echo "  export SECURITY_GROUP_IDS=sg-12345678"
    exit 1
fi

log_success "RDS configuration validated"
echo "  Host: ${RDS_HOST}"
echo "  Port: ${RDS_PORT}"
echo "  Database: ${RDS_DATABASE}"
echo "  Username: ${RDS_USERNAME}"
echo "  Password: [HIDDEN]"

# Step 4: Install dependencies and build project
log_step "4. Installing dependencies and building project..."

cd "$PROJECT_ROOT"

# Install npm dependencies (including production dependencies for Lambda)
log_info "Installing npm dependencies..."
if ! npm install; then
    log_error "Failed to install npm dependencies"
    exit 1
fi

# Ensure production dependencies are available for Lambda
log_info "Verifying production dependencies..."
if [[ ! -d "node_modules/express" ]]; then
    log_error "Express module not found in node_modules"
    echo "Attempting to reinstall dependencies..."
    rm -rf node_modules package-lock.json
    npm install
fi

# Build TypeScript project
log_info "Building TypeScript project..."
if ! npm run build; then
    log_error "Failed to build TypeScript project"
    exit 1
fi

# Verify build output
if [[ ! -d "dist" ]]; then
    log_error "Build output directory 'dist' not found"
    exit 1
fi

if [[ ! -f "dist/lambda/handler.js" ]]; then
    log_error "Lambda handler not found in build output"
    echo "Expected: dist/lambda/handler.js"
    exit 1
fi

log_success "Project built successfully"

# Step 5: Validate SAM template
log_step "5. Validating SAM template..."

if ! sam validate --region "$REGION"; then
    log_error "SAM template validation failed"
    exit 1
fi

log_success "SAM template is valid"

# Step 6: Build SAM application
log_step "6. Building SAM application..."

if ! sam build; then
    log_error "SAM build failed"
    exit 1
fi

log_success "SAM application built successfully"

# Step 7: Deploy SAM application
log_step "7. Deploying SAM application..."

# Prepare parameter overrides - include both cost optimization and RDS parameters
PARAMETER_OVERRIDES=(
    "Stage=${STAGE}"
    "RDSHost=${RDS_HOST}"
    "RDSPort=${RDS_PORT}"
    "RDSDatabase=${RDS_DATABASE}"
    "RDSUsername=${RDS_USERNAME}"
    "RDSPassword=${RDS_PASSWORD}"
)

# Add VPC parameters if provided
if [[ -n "$VPC_ID" ]]; then
    PARAMETER_OVERRIDES+=("VpcId=${VPC_ID}")
    log_info "VPC configuration detected - Lambda will run in VPC: ${VPC_ID}"
fi

if [[ -n "$SUBNET_IDS" ]]; then
    PARAMETER_OVERRIDES+=("SubnetIds=${SUBNET_IDS}")
    log_info "Subnet configuration: ${SUBNET_IDS}"
fi

if [[ -n "$SECURITY_GROUP_IDS" ]]; then
    PARAMETER_OVERRIDES+=("SecurityGroupIds=${SECURITY_GROUP_IDS}")
    log_info "Security group configuration: ${SECURITY_GROUP_IDS}"
fi

# Add cost optimization parameters based on stage
case "$STAGE" in
    "dev")
        PARAMETER_OVERRIDES+=(
            "LambdaMemorySize=512"
            "LambdaTimeout=30"
            "ReservedConcurrency=3"
            "LogRetentionDays=3"
        )
        ;;
    "staging")
        PARAMETER_OVERRIDES+=(
            "LambdaMemorySize=512"
            "LambdaTimeout=30"
            "ReservedConcurrency=5"
            "LogRetentionDays=7"
        )
        ;;
    "prod")
        PARAMETER_OVERRIDES+=(
            "LambdaMemorySize=1024"
            "LambdaTimeout=60"
            "ReservedConcurrency=10"
            "LogRetentionDays=30"
        )
        ;;
    *)
        # Default to dev settings
        PARAMETER_OVERRIDES+=(
            "LambdaMemorySize=512"
            "LambdaTimeout=30"
            "ReservedConcurrency=3"
            "LogRetentionDays=7"
        )
        ;;
esac

# Convert array to space-separated string
PARAM_STRING=""
for param in "${PARAMETER_OVERRIDES[@]}"; do
    PARAM_STRING="${PARAM_STRING} ${param}"
done

log_info "Deploying with parameters:"
for param in "${PARAMETER_OVERRIDES[@]}"; do
    if [[ "$param" == *"Password"* ]]; then
        echo "  ${param%=*}=[HIDDEN]"
    else
        echo "  ${param}"
    fi
done

# Deploy with SAM - use command-line parameters instead of config-env to ensure RDS params are used
DEPLOY_ARGS=(
    --region "$REGION"
    --stack-name "$STACK_NAME"
    --capabilities CAPABILITY_NAMED_IAM
    --resolve-s3
    --s3-prefix "alpaca-farm-mgmt-storage"
    --parameter-overrides $PARAM_STRING
    --no-fail-on-empty-changeset
)

# Add confirmation flag based on force setting
if [[ "$FORCE_DEPLOY" == "true" ]]; then
    DEPLOY_ARGS+=(--no-confirm-changeset)
else
    DEPLOY_ARGS+=(--confirm-changeset)
fi

if ! sam deploy "${DEPLOY_ARGS[@]}"; then
    log_error "SAM deployment failed"
    exit 1
fi

log_success "SAM application deployed successfully"

# Step 8: Capture and display outputs
log_step "8. Retrieving deployment outputs..."

# Get stack outputs
STACK_OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs' \
    --output json 2>/dev/null || echo "[]")

if [[ "$STACK_OUTPUTS" == "[]" ]]; then
    log_warning "No stack outputs found"
else
    log_success "Stack outputs retrieved"
fi

# Extract API Gateway URL and Function ARN
API_URL=$(echo "$STACK_OUTPUTS" | jq -r '.[] | select(.OutputKey=="AlpacaFarmApiUrl") | .OutputValue' 2>/dev/null || echo "")
FUNCTION_ARN=$(echo "$STACK_OUTPUTS" | jq -r '.[] | select(.OutputKey=="AlpacaFarmApiFunction") | .OutputValue' 2>/dev/null || echo "")

# Step 9: Set reserved concurrency for cost control
log_step "9. Setting reserved concurrency for cost control..."

if [[ -n "$FUNCTION_ARN" ]]; then
    FUNCTION_NAME=$(echo "$FUNCTION_ARN" | cut -d':' -f7)
    
    # Get the reserved concurrency value from parameters
    RESERVED_CONCURRENCY_VALUE=""
    case "$STAGE" in
        "dev")
            RESERVED_CONCURRENCY_VALUE="3"
            ;;
        "staging")
            RESERVED_CONCURRENCY_VALUE="5"
            ;;
        "prod")
            RESERVED_CONCURRENCY_VALUE="10"
            ;;
        *)
            RESERVED_CONCURRENCY_VALUE="3"
            ;;
    esac
    
    log_info "Setting reserved concurrency to ${RESERVED_CONCURRENCY_VALUE} for function ${FUNCTION_NAME}..."
    
    if aws lambda put-reserved-concurrency-limit \
        --function-name "$FUNCTION_NAME" \
        --reserved-concurrency-limit "$RESERVED_CONCURRENCY_VALUE" \
        --region "$REGION" &> /dev/null; then
        log_success "Reserved concurrency set successfully"
    else
        log_warning "Failed to set reserved concurrency (this may require additional IAM permissions)"
    fi
else
    log_warning "Function ARN not found, skipping reserved concurrency setup"
fi

# Step 10: Validate deployment
log_step "10. Validating deployment..."

if [[ -n "$API_URL" ]]; then
    log_info "Testing API Gateway endpoint..."
    
    # Test health endpoint with timeout
    if curl -s --max-time 30 "${API_URL}health" > /dev/null 2>&1; then
        log_success "API Gateway endpoint is responding"
    else
        log_warning "API Gateway endpoint test failed (this may be normal if the database connection is not ready)"
    fi
else
    log_warning "API Gateway URL not found in stack outputs"
fi

# Check Lambda function status
if [[ -n "$FUNCTION_ARN" ]]; then
    FUNCTION_NAME=$(echo "$FUNCTION_ARN" | cut -d':' -f7)
    FUNCTION_STATE=$(aws lambda get-function \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION" \
        --query 'Configuration.State' \
        --output text 2>/dev/null || echo "Unknown")
    
    if [[ "$FUNCTION_STATE" == "Active" ]]; then
        log_success "Lambda function is active"
    else
        log_warning "Lambda function state: $FUNCTION_STATE"
    fi
fi

# Step 11: Display deployment summary
echo ""
echo "🎉 Deployment Complete!"
echo "======================="
echo ""

if [[ -n "$API_URL" ]]; then
    echo "📡 API Gateway URL:"
    echo "   ${API_URL}"
    echo ""
    echo "🔗 Example API calls:"
    echo "   Health check:    curl ${API_URL}health"
    echo "   List alpacas:    curl ${API_URL}api/alpacas"
    echo "   API docs:        curl ${API_URL}api-docs"
    echo ""
fi

if [[ -n "$FUNCTION_ARN" ]]; then
    echo "⚡ Lambda Function:"
    echo "   ARN: ${FUNCTION_ARN}"
    echo ""
fi

echo "📊 Stack Information:"
echo "   Stack Name: ${STACK_NAME}"
echo "   Region: ${REGION}"
echo "   Stage: ${STAGE}"
echo ""

echo "🔧 Management Commands:"
echo "   View logs:       ./scripts/logs.sh"
echo "   Check status:    ./scripts/status.sh"
echo "   Test endpoints:  ./scripts/test-deployed.sh"
echo "   Destroy stack:   ./scripts/destroy.sh"
echo ""

echo "💡 Next Steps:"
echo "1. Test the API endpoints using the URLs above"
echo "2. Check CloudWatch logs if you encounter any issues"
echo "3. Use the management scripts for ongoing operations"
echo ""

log_success "Deployment completed successfully!"

# Save deployment info to file for other scripts
DEPLOYMENT_INFO_FILE="${PROJECT_ROOT}/.deployment-info"
cat > "$DEPLOYMENT_INFO_FILE" << EOF
# Deployment Information
# Generated by deploy.sh on $(date)
STACK_NAME=${STACK_NAME}
REGION=${REGION}
STAGE=${STAGE}
API_URL=${API_URL}
FUNCTION_ARN=${FUNCTION_ARN}
DEPLOYMENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

log_info "Deployment information saved to .deployment-info"

exit 0