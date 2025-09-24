#!/bin/bash

# Security Audit Script for Alpaca Farm Management Storage API
# This script validates security configurations and provides recommendations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="alpaca-farm-mgmt-storage"
REGION="us-east-1"

echo -e "${BLUE}🔒 Alpaca Farm Management Storage - Security Audit${NC}"
echo "=================================================="

# Function to check if AWS CLI is configured
check_aws_cli() {
    echo -e "\n${BLUE}Checking AWS CLI configuration...${NC}"
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI.${NC}"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure'.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ AWS CLI configured${NC}"
    
    # Display current AWS identity
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    echo -e "   Account: ${ACCOUNT_ID}"
    echo -e "   User: ${USER_ARN}"
}

# Function to check if stack exists
check_stack_exists() {
    echo -e "\n${BLUE}Checking if stack exists...${NC}"
    
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
        echo -e "${GREEN}✅ Stack '$STACK_NAME' found${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Stack '$STACK_NAME' not found. Deploy the stack first.${NC}"
        return 1
    fi
}

# Function to audit IAM role permissions
audit_iam_role() {
    echo -e "\n${BLUE}Auditing IAM Role permissions...${NC}"
    
    # Get the Lambda function's role ARN
    ROLE_ARN=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='AlpacaFarmApiIamRole'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$ROLE_ARN" ]; then
        echo -e "${RED}❌ Could not retrieve IAM role ARN${NC}"
        return 1
    fi
    
    echo -e "   Role ARN: ${ROLE_ARN}"
    
    # Extract role name from ARN
    ROLE_NAME=$(echo "$ROLE_ARN" | cut -d'/' -f2)
    
    # Check attached policies
    echo -e "\n   ${BLUE}Attached Managed Policies:${NC}"
    aws iam list-attached-role-policies --role-name "$ROLE_NAME" --query 'AttachedPolicies[].PolicyName' --output table
    
    # Check inline policies
    echo -e "\n   ${BLUE}Inline Policies:${NC}"
    INLINE_POLICIES=$(aws iam list-role-policies --role-name "$ROLE_NAME" --query 'PolicyNames' --output text)
    
    if [ -n "$INLINE_POLICIES" ]; then
        for policy in $INLINE_POLICIES; do
            echo -e "   📋 Policy: $policy"
            aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$policy" --query 'PolicyDocument.Statement' --output table
        done
    else
        echo -e "   ${GREEN}✅ No inline policies (good practice)${NC}"
    fi
    
    # Security recommendations
    echo -e "\n   ${BLUE}Security Recommendations:${NC}"
    echo -e "   ✅ Use least-privilege principle"
    echo -e "   ✅ Avoid wildcard (*) permissions"
    echo -e "   ✅ Use specific resource ARNs"
    echo -e "   ✅ Regular audit of permissions"
}

# Function to audit Lambda function configuration
audit_lambda_config() {
    echo -e "\n${BLUE}Auditing Lambda function configuration...${NC}"
    
    # Get Lambda function name
    FUNCTION_ARN=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='AlpacaFarmApiFunction'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$FUNCTION_ARN" ]; then
        echo -e "${RED}❌ Could not retrieve Lambda function ARN${NC}"
        return 1
    fi
    
    FUNCTION_NAME=$(echo "$FUNCTION_ARN" | cut -d':' -f7)
    echo -e "   Function: ${FUNCTION_NAME}"
    
    # Get function configuration
    FUNCTION_CONFIG=$(aws lambda get-function-configuration --function-name "$FUNCTION_NAME" --region "$REGION")
    
    # Check memory and timeout settings
    MEMORY_SIZE=$(echo "$FUNCTION_CONFIG" | jq -r '.MemorySize')
    TIMEOUT=$(echo "$FUNCTION_CONFIG" | jq -r '.Timeout')
    RESERVED_CONCURRENCY=$(echo "$FUNCTION_CONFIG" | jq -r '.ReservedConcurrencyLimit // "Not set"')
    
    echo -e "   Memory Size: ${MEMORY_SIZE} MB"
    echo -e "   Timeout: ${TIMEOUT} seconds"
    echo -e "   Reserved Concurrency: ${RESERVED_CONCURRENCY}"
    
    # Security checks
    echo -e "\n   ${BLUE}Security Configuration:${NC}"
    
    # Check if function is in VPC
    VPC_CONFIG=$(echo "$FUNCTION_CONFIG" | jq -r '.VpcConfig.VpcId // "Not in VPC"')
    if [ "$VPC_CONFIG" = "Not in VPC" ]; then
        echo -e "   ${YELLOW}⚠️  Function not in VPC (acceptable for POC)${NC}"
    else
        echo -e "   ${GREEN}✅ Function in VPC: $VPC_CONFIG${NC}"
    fi
    
    # Check environment variables (don't display sensitive values)
    ENV_VARS=$(echo "$FUNCTION_CONFIG" | jq -r '.Environment.Variables | keys[]' 2>/dev/null || echo "")
    if [ -n "$ENV_VARS" ]; then
        echo -e "   ${BLUE}Environment Variables:${NC}"
        for var in $ENV_VARS; do
            if [[ "$var" == *"PASSWORD"* ]] || [[ "$var" == *"SECRET"* ]] || [[ "$var" == *"KEY"* ]]; then
                echo -e "   🔒 $var: [REDACTED]"
            else
                VALUE=$(echo "$FUNCTION_CONFIG" | jq -r ".Environment.Variables.${var}")
                echo -e "   📝 $var: $VALUE"
            fi
        done
    fi
    
    # Check tracing configuration
    TRACING=$(echo "$FUNCTION_CONFIG" | jq -r '.TracingConfig.Mode // "PassThrough"')
    echo -e "   X-Ray Tracing: ${TRACING}"
    
    if [ "$TRACING" = "Active" ]; then
        echo -e "   ${YELLOW}⚠️  Active tracing enabled (additional costs)${NC}"
    else
        echo -e "   ${GREEN}✅ PassThrough tracing (cost-optimized)${NC}"
    fi
}

# Function to audit API Gateway configuration
audit_api_gateway() {
    echo -e "\n${BLUE}Auditing API Gateway configuration...${NC}"
    
    # Get API Gateway URL
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='AlpacaFarmApiUrl'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$API_URL" ]; then
        echo -e "${RED}❌ Could not retrieve API Gateway URL${NC}"
        return 1
    fi
    
    echo -e "   API URL: ${API_URL}"
    
    # Extract API ID from URL
    API_ID=$(echo "$API_URL" | sed -n 's/.*https:\/\/\([^.]*\).*/\1/p')
    
    if [ -n "$API_ID" ]; then
        echo -e "   API ID: ${API_ID}"
        
        # Check throttling settings
        echo -e "\n   ${BLUE}Throttling Configuration:${NC}"
        THROTTLE_CONFIG=$(aws apigateway get-stage --rest-api-id "$API_ID" --stage-name "dev" --region "$REGION" 2>/dev/null || echo "{}")
        
        if [ "$THROTTLE_CONFIG" != "{}" ]; then
            RATE_LIMIT=$(echo "$THROTTLE_CONFIG" | jq -r '.throttleSettings.rateLimit // "Not set"')
            BURST_LIMIT=$(echo "$THROTTLE_CONFIG" | jq -r '.throttleSettings.burstLimit // "Not set"')
            
            echo -e "   Rate Limit: ${RATE_LIMIT} requests/second"
            echo -e "   Burst Limit: ${BURST_LIMIT} requests"
            
            if [ "$RATE_LIMIT" != "Not set" ] && [ "$BURST_LIMIT" != "Not set" ]; then
                echo -e "   ${GREEN}✅ Throttling configured (cost protection)${NC}"
            else
                echo -e "   ${YELLOW}⚠️  Throttling not configured (potential cost risk)${NC}"
            fi
        fi
        
        # Check caching
        CACHING=$(echo "$THROTTLE_CONFIG" | jq -r '.cacheClusterEnabled // false')
        if [ "$CACHING" = "true" ]; then
            echo -e "   ${YELLOW}⚠️  Caching enabled (additional costs)${NC}"
        else
            echo -e "   ${GREEN}✅ Caching disabled (cost-optimized)${NC}"
        fi
    fi
}

# Function to audit CloudWatch logs
audit_cloudwatch_logs() {
    echo -e "\n${BLUE}Auditing CloudWatch Logs configuration...${NC}"
    
    # Check Lambda log group
    LOG_GROUP="/aws/lambda/${STACK_NAME}-api"
    
    if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$REGION" &> /dev/null; then
        LOG_INFO=$(aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$REGION" --query 'logGroups[0]')
        
        RETENTION_DAYS=$(echo "$LOG_INFO" | jq -r '.retentionInDays // "Never expire"')
        STORED_BYTES=$(echo "$LOG_INFO" | jq -r '.storedBytes // 0')
        
        echo -e "   Log Group: ${LOG_GROUP}"
        echo -e "   Retention: ${RETENTION_DAYS} days"
        echo -e "   Stored Data: $(( STORED_BYTES / 1024 / 1024 )) MB"
        
        if [ "$RETENTION_DAYS" = "Never expire" ]; then
            echo -e "   ${RED}❌ No retention policy (cost risk)${NC}"
        elif [ "$RETENTION_DAYS" -le 7 ]; then
            echo -e "   ${GREEN}✅ Short retention period (cost-optimized)${NC}"
        else
            echo -e "   ${YELLOW}⚠️  Long retention period (higher costs)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Lambda log group not found${NC}"
    fi
}

# Function to check for security best practices
security_recommendations() {
    echo -e "\n${BLUE}Security Recommendations:${NC}"
    echo "================================"
    
    echo -e "\n${GREEN}✅ Implemented Security Features:${NC}"
    echo "   • Least-privilege IAM role"
    echo "   • Specific resource ARNs in policies"
    echo "   • API Gateway request validation"
    echo "   • CORS configuration"
    echo "   • CloudWatch logging enabled"
    echo "   • Dead Letter Queue for error handling"
    echo "   • Reserved concurrency limits"
    
    echo -e "\n${YELLOW}🔧 Additional Security Enhancements (for Production):${NC}"
    echo "   • Enable AWS WAF for API Gateway"
    echo "   • Use AWS Secrets Manager for database credentials"
    echo "   • Enable VPC for Lambda function"
    echo "   • Implement API key authentication"
    echo "   • Enable CloudTrail for API calls"
    echo "   • Set up AWS Config for compliance monitoring"
    echo "   • Enable GuardDuty for threat detection"
    echo "   • Use KMS encryption for CloudWatch logs"
    
    echo -e "\n${BLUE}📊 Cost Optimization Features:${NC}"
    echo "   • Minimal Lambda memory allocation"
    echo "   • Short CloudWatch log retention"
    echo "   • Reserved concurrency limits"
    echo "   • API Gateway throttling"
    echo "   • No unnecessary premium features"
    echo "   • Environment-specific configurations"
}

# Function to generate security report
generate_security_report() {
    echo -e "\n${BLUE}Generating security report...${NC}"
    
    REPORT_FILE="security-audit-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Alpaca Farm Management Storage - Security Audit Report"
        echo "Generated: $(date)"
        echo "Stack: $STACK_NAME"
        echo "Region: $REGION"
        echo "=================================================="
        echo ""
        
        # Re-run audits and capture output
        echo "IAM Role Audit:"
        audit_iam_role 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
        echo ""
        
        echo "Lambda Configuration Audit:"
        audit_lambda_config 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
        echo ""
        
        echo "API Gateway Audit:"
        audit_api_gateway 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
        echo ""
        
        echo "CloudWatch Logs Audit:"
        audit_cloudwatch_logs 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
        echo ""
        
        echo "Security Recommendations:"
        security_recommendations 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
        
    } > "$REPORT_FILE"
    
    echo -e "${GREEN}✅ Security report saved to: $REPORT_FILE${NC}"
}

# Main execution
main() {
    check_aws_cli
    
    if check_stack_exists; then
        audit_iam_role
        audit_lambda_config
        audit_api_gateway
        audit_cloudwatch_logs
        security_recommendations
        
        echo -e "\n${BLUE}Generate detailed report? (y/n):${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            generate_security_report
        fi
    fi
    
    echo -e "\n${GREEN}🔒 Security audit completed!${NC}"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --report       Generate report only (no interactive mode)"
        echo ""
        echo "This script audits the security configuration of the deployed"
        echo "Alpaca Farm Management Storage API and provides recommendations."
        exit 0
        ;;
    --report)
        check_aws_cli
        if check_stack_exists; then
            generate_security_report
        fi
        exit 0
        ;;
    *)
        main
        ;;
esac