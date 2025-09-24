#!/bin/bash

# Cost Monitoring Script for Alpaca Farm Management Storage API
# This script monitors AWS costs and provides optimization recommendations

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

echo -e "${BLUE}💰 Alpaca Farm Management Storage - Cost Monitor${NC}"
echo "================================================"

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
}

# Function to get Lambda function metrics
get_lambda_metrics() {
    echo -e "\n${BLUE}Lambda Function Cost Analysis:${NC}"
    
    # Get function name from stack
    FUNCTION_NAME=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='AlpacaFarmApiFunction'].OutputValue" \
        --output text 2>/dev/null | cut -d':' -f7 || echo "")
    
    if [ -z "$FUNCTION_NAME" ]; then
        echo -e "${RED}❌ Could not retrieve Lambda function name${NC}"
        return 1
    fi
    
    echo -e "   Function: ${FUNCTION_NAME}"
    
    # Get current configuration
    FUNCTION_CONFIG=$(aws lambda get-function-configuration --function-name "$FUNCTION_NAME" --region "$REGION")
    MEMORY_SIZE=$(echo "$FUNCTION_CONFIG" | jq -r '.MemorySize')
    TIMEOUT=$(echo "$FUNCTION_CONFIG" | jq -r '.Timeout')
    
    echo -e "   Memory: ${MEMORY_SIZE} MB"
    echo -e "   Timeout: ${TIMEOUT} seconds"
    
    # Get metrics for the last 7 days
    END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
    START_TIME=$(date -u -v-7d +%Y-%m-%dT%H:%M:%S)
    
    echo -e "\n   ${BLUE}Metrics (Last 7 Days):${NC}"
    
    # Invocation count
    INVOCATIONS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --dimensions Name=FunctionName,Value="$FUNCTION_NAME" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
    
    echo -e "   📊 Total Invocations: ${INVOCATIONS}"
    
    # Duration metrics
    AVG_DURATION=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Duration \
        --dimensions Name=FunctionName,Value="$FUNCTION_NAME" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 86400 \
        --statistics Average \
        --region "$REGION" \
        --query 'Datapoints[].Average' \
        --output text 2>/dev/null | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}')
    
    echo -e "   ⏱️  Average Duration: ${AVG_DURATION} ms"
    
    # Error count
    ERRORS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Errors \
        --dimensions Name=FunctionName,Value="$FUNCTION_NAME" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
    
    echo -e "   ❌ Total Errors: ${ERRORS}"
    
    # Calculate estimated costs
    if [ "$INVOCATIONS" -gt 0 ] && [ "$(echo "$AVG_DURATION > 0" | bc -l 2>/dev/null || echo 0)" -eq 1 ]; then
        # Lambda pricing: $0.0000166667 per GB-second
        # Convert memory from MB to GB and duration from ms to seconds
        MEMORY_GB=$(echo "scale=6; $MEMORY_SIZE / 1024" | bc -l)
        DURATION_SEC=$(echo "scale=6; $AVG_DURATION / 1000" | bc -l)
        GB_SECONDS=$(echo "scale=6; $INVOCATIONS * $MEMORY_GB * $DURATION_SEC" | bc -l)
        COMPUTE_COST=$(echo "scale=4; $GB_SECONDS * 0.0000166667" | bc -l)
        
        # Request cost: $0.20 per 1M requests
        REQUEST_COST=$(echo "scale=4; $INVOCATIONS * 0.0000002" | bc -l)
        
        TOTAL_COST=$(echo "scale=4; $COMPUTE_COST + $REQUEST_COST" | bc -l)
        
        echo -e "\n   ${BLUE}Estimated Costs (7 days):${NC}"
        echo -e "   💰 Compute Cost: \$${COMPUTE_COST}"
        echo -e "   💰 Request Cost: \$${REQUEST_COST}"
        echo -e "   💰 Total Lambda Cost: \$${TOTAL_COST}"
        
        # Monthly projection
        MONTHLY_COST=$(echo "scale=2; $TOTAL_COST * 4.33" | bc -l)
        echo -e "   📈 Monthly Projection: \$${MONTHLY_COST}"
    else
        echo -e "   ${YELLOW}⚠️  No recent invocations or insufficient data for cost calculation${NC}"
    fi
}

# Function to get API Gateway metrics
get_api_gateway_metrics() {
    echo -e "\n${BLUE}API Gateway Cost Analysis:${NC}"
    
    # Get API Gateway URL and extract API ID
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='AlpacaFarmApiUrl'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$API_URL" ]; then
        echo -e "${RED}❌ Could not retrieve API Gateway URL${NC}"
        return 1
    fi
    
    API_ID=$(echo "$API_URL" | sed -n 's/.*https:\/\/\([^.]*\).*/\1/p')
    echo -e "   API ID: ${API_ID}"
    
    # Get metrics for the last 7 days
    END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
    START_TIME=$(date -u -v-7d +%Y-%m-%dT%H:%M:%S)
    
    echo -e "\n   ${BLUE}Metrics (Last 7 Days):${NC}"
    
    # API requests count
    API_REQUESTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApiGateway \
        --metric-name Count \
        --dimensions Name=ApiName,Value="$STACK_NAME-api" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
    
    echo -e "   📊 Total API Requests: ${API_REQUESTS}"
    
    # 4XX errors
    API_4XX=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApiGateway \
        --metric-name 4XXError \
        --dimensions Name=ApiName,Value="$STACK_NAME-api" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
    
    echo -e "   ⚠️  4XX Errors: ${API_4XX}"
    
    # 5XX errors
    API_5XX=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApiGateway \
        --metric-name 5XXError \
        --dimensions Name=ApiName,Value="$STACK_NAME-api" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
    
    echo -e "   ❌ 5XX Errors: ${API_5XX}"
    
    # Calculate API Gateway costs
    if [ "$API_REQUESTS" -gt 0 ]; then
        # API Gateway pricing: $3.50 per million API calls
        API_COST=$(echo "scale=4; $API_REQUESTS * 0.0000035" | bc -l)
        
        echo -e "\n   ${BLUE}Estimated Costs (7 days):${NC}"
        echo -e "   💰 API Gateway Cost: \$${API_COST}"
        
        # Monthly projection
        MONTHLY_API_COST=$(echo "scale=2; $API_COST * 4.33" | bc -l)
        echo -e "   📈 Monthly Projection: \$${MONTHLY_API_COST}"
    else
        echo -e "   ${YELLOW}⚠️  No recent API requests for cost calculation${NC}"
    fi
}

# Function to get CloudWatch Logs metrics
get_cloudwatch_metrics() {
    echo -e "\n${BLUE}CloudWatch Logs Cost Analysis:${NC}"
    
    LOG_GROUP="/aws/lambda/$STACK_NAME-api"
    
    if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$REGION" &> /dev/null; then
        LOG_INFO=$(aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$REGION" --query 'logGroups[0]')
        
        STORED_BYTES=$(echo "$LOG_INFO" | jq -r '.storedBytes // 0')
        RETENTION_DAYS=$(echo "$LOG_INFO" | jq -r '.retentionInDays // "Never expire"')
        
        echo -e "   Log Group: ${LOG_GROUP}"
        echo -e "   Stored Data: $(echo "scale=2; $STORED_BYTES / 1024 / 1024" | bc -l) MB"
        echo -e "   Retention: ${RETENTION_DAYS} days"
        
        # Calculate CloudWatch Logs costs
        if [ "$STORED_BYTES" -gt 0 ]; then
            # CloudWatch Logs pricing: $0.50 per GB ingested, $0.03 per GB stored per month
            STORED_GB=$(echo "scale=6; $STORED_BYTES / 1024 / 1024 / 1024" | bc -l)
            STORAGE_COST=$(echo "scale=4; $STORED_GB * 0.03" | bc -l)
            
            echo -e "\n   ${BLUE}Estimated Monthly Storage Cost:${NC}"
            echo -e "   💰 Log Storage: \$${STORAGE_COST}"
        else
            echo -e "   ${YELLOW}⚠️  No log data for cost calculation${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Log group not found${NC}"
    fi
}

# Function to provide cost optimization recommendations
cost_optimization_recommendations() {
    echo -e "\n${BLUE}Cost Optimization Recommendations:${NC}"
    echo "=================================="
    
    echo -e "\n${GREEN}✅ Current Optimizations:${NC}"
    echo "   • Reserved concurrency limits prevent cost spikes"
    echo "   • Short log retention reduces storage costs"
    echo "   • Minimal Lambda memory allocation"
    echo "   • API Gateway throttling prevents abuse"
    echo "   • No caching enabled (saves costs for low traffic)"
    
    echo -e "\n${YELLOW}🔧 Additional Optimizations:${NC}"
    echo "   • Monitor and right-size Lambda memory based on actual usage"
    echo "   • Consider provisioned concurrency only if cold starts are an issue"
    echo "   • Use CloudWatch Insights for log analysis instead of storing all logs"
    echo "   • Implement request caching if you have repeated requests"
    echo "   • Consider using Lambda@Edge for global distribution if needed"
    
    echo -e "\n${BLUE}📊 Monitoring Recommendations:${NC}"
    echo "   • Set up billing alerts for unexpected cost increases"
    echo "   • Review AWS Cost Explorer monthly"
    echo "   • Monitor Lambda duration to optimize memory allocation"
    echo "   • Track API Gateway request patterns for optimization"
    echo "   • Use AWS Trusted Advisor for cost optimization suggestions"
}

# Function to set up cost alerts
setup_cost_alerts() {
    echo -e "\n${BLUE}Setting up cost monitoring alerts...${NC}"
    
    # Create SNS topic for cost alerts (if it doesn't exist)
    TOPIC_NAME="alpaca-farm-cost-alerts"
    
    # Check if topic exists
    TOPIC_ARN=$(aws sns list-topics --region "$REGION" --query "Topics[?contains(TopicArn, '$TOPIC_NAME')].TopicArn" --output text 2>/dev/null || echo "")
    
    if [ -z "$TOPIC_ARN" ]; then
        echo -e "   Creating SNS topic for cost alerts..."
        TOPIC_ARN=$(aws sns create-topic --name "$TOPIC_NAME" --region "$REGION" --query 'TopicArn' --output text)
        echo -e "   ${GREEN}✅ Created SNS topic: $TOPIC_ARN${NC}"
    else
        echo -e "   ${GREEN}✅ SNS topic already exists: $TOPIC_ARN${NC}"
    fi
    
    # Create CloudWatch alarm for estimated charges
    ALARM_NAME="$STACK_NAME-estimated-charges"
    
    # Check if alarm exists
    if ! aws cloudwatch describe-alarms --alarm-names "$ALARM_NAME" --region "$REGION" &> /dev/null; then
        echo -e "   Creating cost alarm..."
        
        aws cloudwatch put-metric-alarm \
            --alarm-name "$ALARM_NAME" \
            --alarm-description "Alert when estimated charges exceed threshold" \
            --metric-name EstimatedCharges \
            --namespace AWS/Billing \
            --statistic Maximum \
            --period 86400 \
            --threshold 50 \
            --comparison-operator GreaterThanThreshold \
            --dimensions Name=Currency,Value=USD \
            --evaluation-periods 1 \
            --alarm-actions "$TOPIC_ARN" \
            --region us-east-1 2>/dev/null || echo "   ${YELLOW}⚠️  Could not create billing alarm (requires billing access)${NC}"
        
        echo -e "   ${GREEN}✅ Cost alarm created${NC}"
    else
        echo -e "   ${GREEN}✅ Cost alarm already exists${NC}"
    fi
    
    echo -e "\n   ${BLUE}To receive email alerts:${NC}"
    echo -e "   aws sns subscribe --topic-arn $TOPIC_ARN --protocol email --notification-endpoint your-email@example.com"
}

# Function to generate cost report
generate_cost_report() {
    echo -e "\n${BLUE}Generating cost report...${NC}"
    
    REPORT_FILE="cost-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Alpaca Farm Management Storage - Cost Report"
        echo "Generated: $(date)"
        echo "Stack: $STACK_NAME"
        echo "Region: $REGION"
        echo "=================================================="
        echo ""
        
        # Re-run cost analysis and capture output
        echo "Lambda Cost Analysis:"
        get_lambda_metrics 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
        echo ""
        
        echo "API Gateway Cost Analysis:"
        get_api_gateway_metrics 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
        echo ""
        
        echo "CloudWatch Logs Cost Analysis:"
        get_cloudwatch_metrics 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
        echo ""
        
        echo "Cost Optimization Recommendations:"
        cost_optimization_recommendations 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
        
    } > "$REPORT_FILE"
    
    echo -e "${GREEN}✅ Cost report saved to: $REPORT_FILE${NC}"
}

# Main execution
main() {
    check_aws_cli
    
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
        get_lambda_metrics
        get_api_gateway_metrics
        get_cloudwatch_metrics
        cost_optimization_recommendations
        
        echo -e "\n${BLUE}Setup cost alerts? (y/n):${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            setup_cost_alerts
        fi
        
        echo -e "\n${BLUE}Generate detailed report? (y/n):${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            generate_cost_report
        fi
    else
        echo -e "${YELLOW}⚠️  Stack '$STACK_NAME' not found. Deploy the stack first.${NC}"
    fi
    
    echo -e "\n${GREEN}💰 Cost monitoring completed!${NC}"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --report       Generate report only (no interactive mode)"
        echo "  --alerts       Set up cost alerts only"
        echo ""
        echo "This script monitors AWS costs for the Alpaca Farm Management"
        echo "Storage API and provides optimization recommendations."
        exit 0
        ;;
    --report)
        check_aws_cli
        if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
            generate_cost_report
        fi
        exit 0
        ;;
    --alerts)
        check_aws_cli
        setup_cost_alerts
        exit 0
        ;;
    *)
        main
        ;;
esac