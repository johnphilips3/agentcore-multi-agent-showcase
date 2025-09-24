#!/bin/bash

# =============================================================================
# AWS SAM Resource Cleanup Script for Alpaca Farm Management Storage API
# =============================================================================
# This script removes all SAM stack resources and validates cleanup
# Requirements: 2.2, 2.4
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
FORCE_DELETE="${FORCE_DELETE:-false}"

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Remove all AWS resources created by the Alpaca Farm Management Storage API deployment"
    echo ""
    echo "Options:"
    echo "  -s, --stage STAGE          Deployment stage to destroy (dev, staging, prod) [default: dev]"
    echo "  -r, --region REGION        AWS region [default: us-east-1]"
    echo "  -f, --force                Skip confirmation prompts and force deletion"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  AWS_REGION                 AWS region [default: us-east-1]"
    echo "  STAGE                      Deployment stage [default: dev]"
    echo "  FORCE_DELETE               Skip confirmations [default: false]"
    echo ""
    echo "Examples:"
    echo "  $0                         # Destroy dev stage resources in us-east-1"
    echo "  $0 --stage prod            # Destroy production stage resources"
    echo "  $0 --force                 # Destroy without confirmation prompts"
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
            FORCE_DELETE="true"
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

echo "🗑️  Alpaca Farm Management Storage - AWS Resource Cleanup"
echo "========================================================"
echo "Stage: ${STAGE}"
echo "Region: ${REGION}"
echo "Stack: ${STACK_NAME}"
echo "Force Delete: ${FORCE_DELETE}"
echo ""

# Step 1: Validate prerequisites
log_step "1. Validating prerequisites..."

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

# Step 3: Check if stack exists
log_step "3. Checking stack existence..."

STACK_EXISTS="false"
STACK_STATUS=""

if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
    STACK_EXISTS="true"
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "UNKNOWN")
    
    log_info "Stack found with status: ${STACK_STATUS}"
else
    log_warning "Stack '${STACK_NAME}' not found in region '${REGION}'"
    echo ""
    echo "Possible reasons:"
    echo "1. Stack was never deployed"
    echo "2. Stack was already deleted"
    echo "3. Wrong region or stage specified"
    echo "4. Different AWS account/credentials"
    echo ""
    
    if [[ "$FORCE_DELETE" != "true" ]]; then
        read -p "Continue with cleanup validation anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cleanup cancelled by user"
            exit 0
        fi
    fi
fi

# Step 4: Display resources to be deleted (if stack exists)
if [[ "$STACK_EXISTS" == "true" ]]; then
    log_step "4. Identifying resources to be deleted..."
    
    # Get stack resources
    STACK_RESOURCES=$(aws cloudformation list-stack-resources \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'StackResourceSummaries[].{Type:ResourceType,LogicalId:LogicalResourceId,PhysicalId:PhysicalResourceId,Status:ResourceStatus}' \
        --output table 2>/dev/null || echo "")
    
    if [[ -n "$STACK_RESOURCES" ]]; then
        echo ""
        echo "📋 Resources to be deleted:"
        echo "$STACK_RESOURCES"
        echo ""
        
        # Count resources
        RESOURCE_COUNT=$(aws cloudformation list-stack-resources \
            --stack-name "$STACK_NAME" \
            --region "$REGION" \
            --query 'length(StackResourceSummaries)' \
            --output text 2>/dev/null || echo "0")
        
        log_info "Total resources to delete: ${RESOURCE_COUNT}"
    else
        log_warning "Could not retrieve stack resources"
    fi
    
    # Get stack outputs for reference
    STACK_OUTPUTS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs' \
        --output json 2>/dev/null || echo "[]")
    
    API_URL=$(echo "$STACK_OUTPUTS" | jq -r '.[] | select(.OutputKey=="AlpacaFarmApiUrl") | .OutputValue' 2>/dev/null || echo "")
    FUNCTION_ARN=$(echo "$STACK_OUTPUTS" | jq -r '.[] | select(.OutputKey=="AlpacaFarmApiFunction") | .OutputValue' 2>/dev/null || echo "")
    
    if [[ -n "$API_URL" ]]; then
        echo "🔗 API Gateway URL to be removed: ${API_URL}"
    fi
    
    if [[ -n "$FUNCTION_ARN" ]]; then
        echo "⚡ Lambda Function to be removed: ${FUNCTION_ARN}"
    fi
    
    echo ""
else
    log_step "4. No stack found - will validate cleanup only"
fi

# Step 5: Confirmation prompt
if [[ "$FORCE_DELETE" != "true" ]]; then
    log_step "5. Confirmation required"
    
    echo "⚠️  WARNING: This action will permanently delete all resources!"
    echo ""
    echo "This will remove:"
    echo "• Lambda function and all its versions"
    echo "• API Gateway and all its configurations"
    echo "• CloudWatch log groups and all logs"
    echo "• IAM roles and policies created by SAM"
    echo "• All other resources in the CloudFormation stack"
    echo ""
    echo "❗ This action cannot be undone!"
    echo ""
    
    read -p "Are you sure you want to delete stack '${STACK_NAME}'? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled by user"
        exit 0
    fi
    
    echo ""
    read -p "Type 'DELETE' to confirm: " CONFIRM_DELETE
    if [[ "$CONFIRM_DELETE" != "DELETE" ]]; then
        log_info "Cleanup cancelled - confirmation text did not match"
        exit 0
    fi
    
    echo ""
    log_info "Proceeding with resource deletion..."
else
    log_step "5. Skipping confirmation (force mode enabled)"
fi

# Step 6: Delete the stack
if [[ "$STACK_EXISTS" == "true" ]]; then
    log_step "6. Deleting CloudFormation stack..."
    
    # Check if stack is in a deletable state
    if [[ "$STACK_STATUS" == *"IN_PROGRESS"* ]]; then
        log_error "Stack is currently in progress state: ${STACK_STATUS}"
        echo "Please wait for the current operation to complete before deleting."
        exit 1
    fi
    
    # Initiate stack deletion
    log_info "Initiating stack deletion..."
    if ! aws cloudformation delete-stack \
        --stack-name "$STACK_NAME" \
        --region "$REGION"; then
        log_error "Failed to initiate stack deletion"
        exit 1
    fi
    
    log_success "Stack deletion initiated"
    
    # Wait for deletion to complete
    log_info "Waiting for stack deletion to complete..."
    echo "This may take several minutes..."
    
    # Monitor deletion progress
    DELETION_START_TIME=$(date +%s)
    TIMEOUT_SECONDS=1800  # 30 minutes timeout
    
    while true; do
        CURRENT_TIME=$(date +%s)
        ELAPSED_TIME=$((CURRENT_TIME - DELETION_START_TIME))
        
        if [[ $ELAPSED_TIME -gt $TIMEOUT_SECONDS ]]; then
            log_error "Stack deletion timed out after 30 minutes"
            echo "Please check the AWS Console for the current status"
            exit 1
        fi
        
        # Check stack status
        CURRENT_STATUS=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region "$REGION" \
            --query 'Stacks[0].StackStatus' \
            --output text 2>/dev/null || echo "STACK_NOT_FOUND")
        
        if [[ "$CURRENT_STATUS" == "STACK_NOT_FOUND" ]]; then
            log_success "Stack deleted successfully"
            break
        elif [[ "$CURRENT_STATUS" == "DELETE_COMPLETE" ]]; then
            log_success "Stack deletion completed"
            break
        elif [[ "$CURRENT_STATUS" == "DELETE_FAILED" ]]; then
            log_error "Stack deletion failed"
            echo ""
            echo "Checking for deletion failures..."
            
            # Get failed resources
            FAILED_RESOURCES=$(aws cloudformation describe-stack-events \
                --stack-name "$STACK_NAME" \
                --region "$REGION" \
                --query 'StackEvents[?ResourceStatus==`DELETE_FAILED`].{Resource:LogicalResourceId,Reason:ResourceStatusReason}' \
                --output table 2>/dev/null || echo "Could not retrieve failure details")
            
            echo "$FAILED_RESOURCES"
            exit 1
        else
            # Show progress
            printf "."
            sleep 10
        fi
    done
    
    echo ""  # New line after progress dots
    
else
    log_step "6. No stack to delete"
fi

# Step 7: Validate cleanup
log_step "7. Validating cleanup completion..."

# Check if stack still exists
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
    REMAINING_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "UNKNOWN")
    
    log_warning "Stack still exists with status: ${REMAINING_STATUS}"
    
    if [[ "$REMAINING_STATUS" == "DELETE_FAILED" ]]; then
        log_error "Stack deletion failed - manual cleanup may be required"
        exit 1
    fi
else
    log_success "Stack successfully removed from CloudFormation"
fi

# Check for any remaining resources (best effort)
log_info "Checking for any remaining resources..."

# Check Lambda functions
LAMBDA_FUNCTIONS=$(aws lambda list-functions \
    --region "$REGION" \
    --query "Functions[?contains(FunctionName, 'alpaca-farm-mgmt-storage-${STAGE}')].FunctionName" \
    --output text 2>/dev/null || echo "")

if [[ -n "$LAMBDA_FUNCTIONS" && "$LAMBDA_FUNCTIONS" != "None" ]]; then
    log_warning "Found remaining Lambda functions: ${LAMBDA_FUNCTIONS}"
else
    log_success "No remaining Lambda functions found"
fi

# Check API Gateways
API_GATEWAYS=$(aws apigateway get-rest-apis \
    --region "$REGION" \
    --query "items[?contains(name, 'alpaca-farm-mgmt-storage-${STAGE}')].name" \
    --output text 2>/dev/null || echo "")

if [[ -n "$API_GATEWAYS" && "$API_GATEWAYS" != "None" ]]; then
    log_warning "Found remaining API Gateways: ${API_GATEWAYS}"
else
    log_success "No remaining API Gateways found"
fi

# Check CloudWatch Log Groups
LOG_GROUPS=$(aws logs describe-log-groups \
    --region "$REGION" \
    --log-group-name-prefix "/aws/lambda/alpaca-farm-mgmt-storage-${STAGE}" \
    --query "logGroups[].logGroupName" \
    --output text 2>/dev/null || echo "")

if [[ -n "$LOG_GROUPS" && "$LOG_GROUPS" != "None" ]]; then
    log_warning "Found remaining CloudWatch Log Groups: ${LOG_GROUPS}"
    echo "Note: Log groups may be retained for data retention purposes"
else
    log_success "No remaining CloudWatch Log Groups found"
fi

# Step 8: Clean up local deployment info
log_step "8. Cleaning up local deployment information..."

DEPLOYMENT_INFO_FILE="${PROJECT_ROOT}/.deployment-info"
if [[ -f "$DEPLOYMENT_INFO_FILE" ]]; then
    # Check if the deployment info matches the deleted stack
    if grep -q "STACK_NAME=${STACK_NAME}" "$DEPLOYMENT_INFO_FILE" 2>/dev/null; then
        rm -f "$DEPLOYMENT_INFO_FILE"
        log_success "Removed local deployment information file"
    else
        log_info "Keeping deployment info file (different stack)"
    fi
else
    log_info "No local deployment information file found"
fi

# Step 9: Display cleanup summary
echo ""
echo "🎉 Cleanup Complete!"
echo "==================="
echo ""

echo "📊 Cleanup Summary:"
echo "   Stack Name: ${STACK_NAME}"
echo "   Region: ${REGION}"
echo "   Stage: ${STAGE}"
echo ""

if [[ "$STACK_EXISTS" == "true" ]]; then
    echo "✅ Actions Completed:"
    echo "   • CloudFormation stack deleted"
    echo "   • Lambda function removed"
    echo "   • API Gateway removed"
    echo "   • IAM roles and policies removed"
    echo "   • CloudWatch resources cleaned up"
    echo "   • Local deployment info cleared"
else
    echo "✅ Validation Completed:"
    echo "   • Confirmed no stack exists"
    echo "   • Verified no remaining resources"
    echo "   • Local deployment info cleared"
fi

echo ""
echo "💡 Next Steps:"
echo "1. Verify in AWS Console that all resources are removed"
echo "2. Check your AWS bill to ensure no unexpected charges"
echo "3. Re-deploy using ./scripts/deploy.sh when needed"
echo ""

if [[ -n "$LOG_GROUPS" && "$LOG_GROUPS" != "None" ]]; then
    echo "⚠️  Note: Some CloudWatch Log Groups may still exist"
    echo "   These are typically retained for data retention purposes"
    echo "   You can manually delete them from the AWS Console if needed"
    echo ""
fi

log_success "Resource cleanup completed successfully!"

exit 0