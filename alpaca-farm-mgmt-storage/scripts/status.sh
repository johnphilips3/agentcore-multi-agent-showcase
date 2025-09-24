#!/bin/bash

# Status script for AWS SAM deployment
# Shows deployment status, stack resources, and basic health information
# Note: Uses macOS-compatible date commands

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_STACK_NAME="alpaca-farm-mgmt-storage"
DEFAULT_REGION="us-east-1"

# Parse command line arguments
STACK_NAME="${1:-$DEFAULT_STACK_NAME}"
REGION="${2:-$DEFAULT_REGION}"

echo -e "${BLUE}=== AWS SAM Deployment Status ===${NC}"
echo "Stack Name: $STACK_NAME"
echo "Region: $REGION"
echo ""

# Function to check if AWS CLI is configured
check_aws_config() {
    if ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
        echo -e "${RED}Error: AWS CLI not configured or invalid credentials${NC}"
        echo "Please run 'aws configure' or set AWS environment variables"
        exit 1
    fi
}

# Function to get stack status
get_stack_status() {
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")
    echo "$stack_status"
}

# Function to display stack information
show_stack_info() {
    local status="$1"
    
    case "$status" in
        "CREATE_COMPLETE"|"UPDATE_COMPLETE")
            echo -e "${GREEN}✓ Stack Status: $status${NC}"
            ;;
        "CREATE_IN_PROGRESS"|"UPDATE_IN_PROGRESS")
            echo -e "${YELLOW}⏳ Stack Status: $status${NC}"
            ;;
        "CREATE_FAILED"|"UPDATE_FAILED"|"ROLLBACK_COMPLETE"|"ROLLBACK_FAILED")
            echo -e "${RED}✗ Stack Status: $status${NC}"
            ;;
        "NOT_FOUND")
            echo -e "${RED}✗ Stack not found: $STACK_NAME${NC}"
            return 1
            ;;
        *)
            echo -e "${YELLOW}? Stack Status: $status${NC}"
            ;;
    esac
}

# Function to show stack resources
show_stack_resources() {
    echo -e "\n${BLUE}=== Stack Resources ===${NC}"
    
    aws cloudformation describe-stack-resources \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'StackResources[*].[ResourceType,LogicalResourceId,ResourceStatus,PhysicalResourceId]' \
        --output table 2>/dev/null || {
        echo -e "${RED}Failed to retrieve stack resources${NC}"
        return 1
    }
}

# Function to show stack outputs
show_stack_outputs() {
    echo -e "\n${BLUE}=== Stack Outputs ===${NC}"
    
    local outputs
    outputs=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs' \
        --output table 2>/dev/null)
    
    if [ -n "$outputs" ] && [ "$outputs" != "None" ]; then
        echo "$outputs"
        
        # Extract API Gateway URL if available
        local api_url
        api_url=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region "$REGION" \
            --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
            --output text 2>/dev/null)
        
        if [ -n "$api_url" ] && [ "$api_url" != "None" ]; then
            echo -e "\n${GREEN}API Gateway URL: $api_url${NC}"
        fi
    else
        echo "No outputs available"
    fi
}

# Function to show recent CloudWatch logs
show_recent_logs() {
    echo -e "\n${BLUE}=== Recent Lambda Logs (Last 10 minutes) ===${NC}"
    
    # Get Lambda function name from stack resources
    local function_name
    function_name=$(aws cloudformation describe-stack-resources \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'StackResources[?ResourceType==`AWS::Lambda::Function`].PhysicalResourceId' \
        --output text 2>/dev/null)
    
    if [ -n "$function_name" ] && [ "$function_name" != "None" ]; then
        local log_group="/aws/lambda/$function_name"
        
        # Check if log group exists
        if aws logs describe-log-groups \
            --log-group-name-prefix "$log_group" \
            --region "$REGION" \
            --query 'logGroups[0].logGroupName' \
            --output text >/dev/null 2>&1; then
            
            echo "Log Group: $log_group"
            echo ""
            
            # Get recent logs (last 10 minutes)
            local start_time
            start_time=$(date -u -v-10M +%s)000
            
            aws logs filter-log-events \
                --log-group-name "$log_group" \
                --region "$REGION" \
                --start-time "$start_time" \
                --query 'events[*].[timestamp,message]' \
                --output text 2>/dev/null | \
                head -20 | \
                while IFS=$'\t' read -r timestamp message; do
                    if [ -n "$timestamp" ]; then
                        local formatted_time
                        formatted_time=$(date -r "$((timestamp/1000))" '+%Y-%m-%d %H:%M:%S')
                        echo "[$formatted_time] $message"
                    fi
                done
        else
            echo "No log group found for function: $function_name"
        fi
    else
        echo "No Lambda function found in stack"
    fi
}

# Function to test API health
test_api_health() {
    echo -e "\n${BLUE}=== API Health Check ===${NC}"
    
    # Get API Gateway URL
    local api_url
    api_url=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
        --output text 2>/dev/null)
    
    if [ -n "$api_url" ] && [ "$api_url" != "None" ]; then
        echo "Testing: $api_url/health"
        
        # Test health endpoint with timeout
        if curl -s --max-time 10 "$api_url/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ API is responding${NC}"
        else
            echo -e "${RED}✗ API is not responding${NC}"
        fi
    else
        echo "No API Gateway URL found"
    fi
}

# Main execution
main() {
    check_aws_config
    
    local stack_status
    stack_status=$(get_stack_status)
    
    show_stack_info "$stack_status"
    
    if [ "$stack_status" != "NOT_FOUND" ]; then
        show_stack_resources
        show_stack_outputs
        show_recent_logs
        test_api_health
    else
        echo ""
        echo "To deploy the stack, run: ./scripts/deploy.sh"
    fi
    
    echo ""
    echo -e "${BLUE}=== Additional Commands ===${NC}"
    echo "View logs: ./scripts/logs.sh"
    echo "Debug mode: ./scripts/debug.sh"
    echo "Deploy: ./scripts/deploy.sh"
    echo "Destroy: ./scripts/destroy.sh"
}

# Show usage if help requested
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0 [STACK_NAME] [REGION]"
    echo ""
    echo "Shows AWS SAM deployment status and stack information"
    echo ""
    echo "Arguments:"
    echo "  STACK_NAME    CloudFormation stack name (default: $DEFAULT_STACK_NAME)"
    echo "  REGION        AWS region (default: $DEFAULT_REGION)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Use defaults"
    echo "  $0 my-stack                          # Custom stack name"
    echo "  $0 my-stack us-west-2               # Custom stack and region"
    exit 0
fi

main "$@"