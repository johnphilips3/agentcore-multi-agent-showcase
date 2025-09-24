#!/bin/bash

# Debug script for AWS SAM deployment
# Provides real-time log streaming, error analysis, and debugging tools

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_STACK_NAME="alpaca-farm-mgmt-storage"
DEFAULT_REGION="us-east-1"

# Parse command line arguments
STACK_NAME="$DEFAULT_STACK_NAME"
REGION="$DEFAULT_REGION"
MODE="interactive"

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] [MODE]"
    echo ""
    echo "Debug AWS SAM Lambda deployment with real-time monitoring and analysis"
    echo ""
    echo "Modes:"
    echo "  interactive    Interactive debugging menu (default)"
    echo "  stream        Stream all logs in real-time"
    echo "  errors        Monitor errors only"
    echo "  performance   Monitor performance metrics"
    echo "  health        Continuous health monitoring"
    echo ""
    echo "Options:"
    echo "  -s, --stack STACK_NAME     CloudFormation stack name (default: $DEFAULT_STACK_NAME)"
    echo "  -r, --region REGION        AWS region (default: $DEFAULT_REGION)"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                         # Interactive debugging menu"
    echo "  $0 stream                  # Stream all logs"
    echo "  $0 errors                  # Monitor errors only"
    echo "  $0 performance             # Monitor performance"
    echo "  $0 health                  # Health monitoring"
}

# Parse command line options
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack)
            STACK_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        stream|errors|performance|health|interactive)
            MODE="$1"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Function to check if AWS CLI is configured
check_aws_config() {
    if ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
        echo -e "${RED}Error: AWS CLI not configured or invalid credentials${NC}"
        echo "Please run 'aws configure' or set AWS environment variables"
        exit 1
    fi
}

# Function to get Lambda function name from stack
get_lambda_function_name() {
    aws cloudformation describe-stack-resources \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'StackResources[?ResourceType==`AWS::Lambda::Function`].PhysicalResourceId' \
        --output text 2>/dev/null || echo ""
}

# Function to get API Gateway URL
get_api_gateway_url() {
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
        --output text 2>/dev/null || echo ""
}

# Function to format log message with enhanced colors and parsing
format_debug_message() {
    local timestamp="$1"
    local message="$2"
    
    # Format timestamp
    local formatted_time
    formatted_time=$(date -r "$((timestamp/1000))" '+%H:%M:%S')
    
    # Enhanced message parsing and coloring
    local colored_message="$message"
    
    # Error patterns
    if echo "$message" | grep -qi "error\|exception\|failed\|timeout\|500"; then
        colored_message="${RED}🔥 $message${NC}"
    # Warning patterns
    elif echo "$message" | grep -qi "warn\|warning\|deprecated\|slow"; then
        colored_message="${YELLOW}⚠️  $message${NC}"
    # Success patterns
    elif echo "$message" | grep -qi "success\|complete\|200\|201"; then
        colored_message="${GREEN}✅ $message${NC}"
    # Database patterns
    elif echo "$message" | grep -qi "database\|sql\|query\|connection"; then
        colored_message="${CYAN}🗄️  $message${NC}"
    # Request patterns
    elif echo "$message" | grep -qi "request\|response\|http\|api"; then
        colored_message="${BLUE}🌐 $message${NC}"
    # Performance patterns
    elif echo "$message" | grep -qi "duration\|memory\|performance\|ms"; then
        colored_message="${MAGENTA}⚡ $message${NC}"
    # Info patterns
    elif echo "$message" | grep -qi "info\|start\|init"; then
        colored_message="${GREEN}ℹ️  $message${NC}"
    # Debug patterns
    elif echo "$message" | grep -qi "debug"; then
        colored_message="${CYAN}🔍 $message${NC}"
    fi
    
    echo -e "${BLUE}[$formatted_time]${NC} $colored_message"
}

# Function to stream logs in real-time
stream_logs() {
    local log_group="$1"
    local filter_pattern="$2"
    
    echo -e "${BLUE}=== Real-time Log Stream (Press Ctrl+C to stop) ===${NC}"
    echo "Log Group: $log_group"
    if [ -n "$filter_pattern" ]; then
        echo "Filter: $filter_pattern"
    fi
    echo ""
    
    local start_time
    start_time=$(date -u +%s)000
    
    while true; do
        local end_time
        end_time=$(date -u +%s)000
        
        # Build command
        local cmd="aws logs filter-log-events --log-group-name '$log_group' --region '$REGION'"
        cmd="$cmd --start-time $start_time --end-time $end_time"
        
        if [ -n "$filter_pattern" ]; then
            cmd="$cmd --filter-pattern '$filter_pattern'"
        fi
        
        cmd="$cmd --query 'events[*].[timestamp,message]' --output text"
        
        # Get and format new logs
        eval "$cmd" 2>/dev/null | \
            while IFS=$'\t' read -r timestamp message; do
                if [ -n "$timestamp" ] && [ -n "$message" ]; then
                    format_debug_message "$timestamp" "$message"
                fi
            done
        
        start_time=$end_time
        sleep 1
    done
}

# Function to monitor errors only
monitor_errors() {
    local log_group="$1"
    
    echo -e "${RED}=== Error Monitoring (Press Ctrl+C to stop) ===${NC}"
    echo "Monitoring for errors, exceptions, and failures..."
    echo ""
    
    stream_logs "$log_group" "ERROR"
}

# Function to monitor performance
monitor_performance() {
    local function_name="$1"
    local log_group="$2"
    
    echo -e "${MAGENTA}=== Performance Monitoring ===${NC}"
    echo ""
    
    # Show current Lambda configuration
    echo -e "${BLUE}Lambda Configuration:${NC}"
    aws lambda get-function-configuration \
        --function-name "$function_name" \
        --region "$REGION" \
        --query '{MemorySize:MemorySize,Timeout:Timeout,Runtime:Runtime}' \
        --output table 2>/dev/null || echo "Failed to get function configuration"
    
    echo ""
    echo -e "${BLUE}Recent Performance Metrics (Last 5 minutes):${NC}"
    
    # Get CloudWatch metrics
    local start_time
    start_time=$(date -u -v-5M +%Y-%m-%dT%H:%M:%S)
    local end_time
    end_time=$(date -u +%Y-%m-%dT%H:%M:%S)
    
    # Duration metrics
    echo "Duration (ms):"
    aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Duration \
        --dimensions Name=FunctionName,Value="$function_name" \
        --start-time "$start_time" \
        --end-time "$end_time" \
        --period 300 \
        --statistics Average,Maximum \
        --region "$REGION" \
        --query 'Datapoints[*].[Timestamp,Average,Maximum]' \
        --output table 2>/dev/null || echo "No duration data available"
    
    echo ""
    echo "Memory Usage (MB):"
    aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name MemoryUtilization \
        --dimensions Name=FunctionName,Value="$function_name" \
        --start-time "$start_time" \
        --end-time "$end_time" \
        --period 300 \
        --statistics Average,Maximum \
        --region "$REGION" \
        --query 'Datapoints[*].[Timestamp,Average,Maximum]' \
        --output table 2>/dev/null || echo "No memory data available"
    
    echo ""
    echo -e "${BLUE}Streaming performance-related logs...${NC}"
    stream_logs "$log_group" "duration\\|memory\\|timeout\\|performance"
}

# Function to perform health monitoring
health_monitoring() {
    local api_url="$1"
    local log_group="$2"
    
    echo -e "${GREEN}=== Health Monitoring (Press Ctrl+C to stop) ===${NC}"
    echo "API URL: $api_url"
    echo ""
    
    local consecutive_failures=0
    local total_requests=0
    local successful_requests=0
    
    while true; do
        total_requests=$((total_requests + 1))
        
        # Test health endpoint
        local start_time
        start_time=$(date +%s.%N)
        
        if curl -s --max-time 10 "$api_url/health" >/dev/null 2>&1; then
            local end_time
            end_time=$(date +%s.%N)
            local duration
            duration=$(echo "$end_time - $start_time" | bc -l)
            
            successful_requests=$((successful_requests + 1))
            consecutive_failures=0
            
            local success_rate
            success_rate=$(echo "scale=1; $successful_requests * 100 / $total_requests" | bc -l)
            
            echo -e "${GREEN}✅ Health check OK${NC} (${duration}s) - Success rate: ${success_rate}%"
        else
            consecutive_failures=$((consecutive_failures + 1))
            
            local success_rate
            success_rate=$(echo "scale=1; $successful_requests * 100 / $total_requests" | bc -l)
            
            echo -e "${RED}❌ Health check FAILED${NC} - Consecutive failures: $consecutive_failures - Success rate: ${success_rate}%"
            
            # Show recent error logs if multiple failures
            if [ $consecutive_failures -ge 3 ]; then
                echo -e "${YELLOW}Recent error logs:${NC}"
                local recent_start
                recent_start=$(date -u -v-2M +%s)000
                
                aws logs filter-log-events \
                    --log-group-name "$log_group" \
                    --region "$REGION" \
                    --start-time "$recent_start" \
                    --filter-pattern "ERROR" \
                    --query 'events[-3:].message' \
                    --output text 2>/dev/null | \
                    while read -r message; do
                        if [ -n "$message" ]; then
                            echo "  $message"
                        fi
                    done
                echo ""
            fi
        fi
        
        sleep 10
    done
}

# Function to show interactive debugging menu
interactive_menu() {
    local function_name="$1"
    local log_group="$2"
    local api_url="$3"
    
    while true; do
        clear
        echo -e "${BLUE}=== AWS SAM Debug Console ===${NC}"
        echo "Stack: $STACK_NAME"
        echo "Function: $function_name"
        echo "Region: $REGION"
        if [ -n "$api_url" ]; then
            echo "API URL: $api_url"
        fi
        echo ""
        echo "Select debugging option:"
        echo "1) Stream all logs"
        echo "2) Monitor errors only"
        echo "3) Performance monitoring"
        echo "4) Health monitoring"
        echo "5) Test API endpoint"
        echo "6) Show recent errors"
        echo "7) Show function metrics"
        echo "8) Tail logs (last 20 lines)"
        echo "9) Search logs"
        echo "0) Exit"
        echo ""
        read -p "Enter choice [0-9]: " choice
        
        case $choice in
            1)
                stream_logs "$log_group"
                ;;
            2)
                monitor_errors "$log_group"
                ;;
            3)
                monitor_performance "$function_name" "$log_group"
                ;;
            4)
                if [ -n "$api_url" ]; then
                    health_monitoring "$api_url" "$log_group"
                else
                    echo -e "${RED}No API URL available${NC}"
                    read -p "Press Enter to continue..."
                fi
                ;;
            5)
                if [ -n "$api_url" ]; then
                    echo "Testing API endpoints..."
                    echo ""
                    echo "Health check:"
                    curl -s -w "Status: %{http_code}, Time: %{time_total}s\n" "$api_url/health" || echo "Failed"
                    echo ""
                    echo "API info:"
                    curl -s -w "Status: %{http_code}, Time: %{time_total}s\n" "$api_url/" || echo "Failed"
                else
                    echo -e "${RED}No API URL available${NC}"
                fi
                read -p "Press Enter to continue..."
                ;;
            6)
                echo "Recent errors (last 30 minutes):"
                local error_start
                error_start=$(date -u -v-30M +%s)000
                aws logs filter-log-events \
                    --log-group-name "$log_group" \
                    --region "$REGION" \
                    --start-time "$error_start" \
                    --filter-pattern "ERROR" \
                    --query 'events[*].message' \
                    --output text 2>/dev/null | tail -10
                read -p "Press Enter to continue..."
                ;;
            7)
                echo "Function metrics (last hour):"
                ./scripts/logs.sh -s "$STACK_NAME" -r "$REGION" -t 60 -n 10
                read -p "Press Enter to continue..."
                ;;
            8)
                echo "Recent logs:"
                ./scripts/logs.sh -s "$STACK_NAME" -r "$REGION" -n 20
                read -p "Press Enter to continue..."
                ;;
            9)
                read -p "Enter search pattern: " pattern
                if [ -n "$pattern" ]; then
                    echo "Searching for: $pattern"
                    ./scripts/logs.sh -s "$STACK_NAME" -r "$REGION" -g "$pattern" -n 20
                fi
                read -p "Press Enter to continue..."
                ;;
            0)
                echo "Exiting debug console..."
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid choice${NC}"
                read -p "Press Enter to continue..."
                ;;
        esac
    done
}

# Main execution
main() {
    check_aws_config
    
    # Get Lambda function name
    local function_name
    function_name=$(get_lambda_function_name)
    
    if [ -z "$function_name" ]; then
        echo -e "${RED}Error: No Lambda function found in stack '$STACK_NAME'${NC}"
        echo "Make sure the stack is deployed and contains a Lambda function"
        exit 1
    fi
    
    # Get log group and API URL
    local log_group="/aws/lambda/$function_name"
    local api_url
    api_url=$(get_api_gateway_url)
    
    # Execute based on mode
    case "$MODE" in
        stream)
            stream_logs "$log_group"
            ;;
        errors)
            monitor_errors "$log_group"
            ;;
        performance)
            monitor_performance "$function_name" "$log_group"
            ;;
        health)
            if [ -n "$api_url" ]; then
                health_monitoring "$api_url" "$log_group"
            else
                echo -e "${RED}Error: No API Gateway URL found for health monitoring${NC}"
                exit 1
            fi
            ;;
        interactive)
            interactive_menu "$function_name" "$log_group" "$api_url"
            ;;
        *)
            echo -e "${RED}Unknown mode: $MODE${NC}"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"