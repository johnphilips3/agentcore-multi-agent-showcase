#!/bin/bash

# CloudWatch logs viewer for AWS SAM deployment
# Provides log viewing with filtering, search, and real-time streaming options

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_STACK_NAME="alpaca-farm-mgmt-storage"
DEFAULT_REGION="us-east-1"
DEFAULT_LINES=50

# Parse command line arguments
STACK_NAME="$DEFAULT_STACK_NAME"
REGION="$DEFAULT_REGION"
LINES="$DEFAULT_LINES"
FOLLOW=false
FILTER=""
LEVEL=""
START_TIME=""
END_TIME=""

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "View CloudWatch logs for AWS SAM Lambda function"
    echo ""
    echo "Options:"
    echo "  -s, --stack STACK_NAME     CloudFormation stack name (default: $DEFAULT_STACK_NAME)"
    echo "  -r, --region REGION        AWS region (default: $DEFAULT_REGION)"
    echo "  -n, --lines NUMBER         Number of lines to show (default: $DEFAULT_LINES)"
    echo "  -f, --follow              Follow logs in real-time"
    echo "  -l, --level LEVEL         Filter by log level (info, warn, error, debug)"
    echo "  -g, --grep PATTERN        Filter logs containing pattern"
    echo "  -t, --tail MINUTES        Show logs from last N minutes (default: 60)"
    echo "  --since DATETIME          Show logs since datetime (YYYY-MM-DD HH:MM:SS)"
    echo "  --until DATETIME          Show logs until datetime (YYYY-MM-DD HH:MM:SS)"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Show recent logs"
    echo "  $0 -f                                # Follow logs in real-time"
    echo "  $0 -l error                          # Show only error logs"
    echo "  $0 -g \"database\"                     # Show logs containing 'database'"
    echo "  $0 -t 30                             # Show logs from last 30 minutes"
    echo "  $0 --since \"2024-01-01 10:00:00\"     # Show logs since specific time"
    echo "  $0 -f -l error                       # Follow error logs only"
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
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -l|--level)
            LEVEL="$2"
            shift 2
            ;;
        -g|--grep)
            FILTER="$2"
            shift 2
            ;;
        -t|--tail)
            local minutes="$2"
            START_TIME=$(date -u -v-${minutes}M +%s)000
            shift 2
            ;;
        --since)
            # Try to parse the date - this is a simplified approach for common formats
            if [[ "$2" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
                # ISO format: 2024-01-01 or 2024-01-01T10:00:00
                START_TIME=$(date -u -j -f "%Y-%m-%d %H:%M:%S" "$2 00:00:00" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%S" "$2" +%s)000
            else
                # Fallback: assume it's a relative time like "1 hour ago"
                echo -e "${YELLOW}Warning: Complex date parsing not fully supported on macOS. Using current time minus 1 hour.${NC}"
                START_TIME=$(date -u -v-1H +%s)000
            fi
            shift 2
            ;;
        --until)
            # Try to parse the date - this is a simplified approach for common formats
            if [[ "$2" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
                # ISO format: 2024-01-01 or 2024-01-01T10:00:00
                END_TIME=$(date -u -j -f "%Y-%m-%d %H:%M:%S" "$2 23:59:59" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%S" "$2" +%s)000
            else
                # Fallback: use current time
                echo -e "${YELLOW}Warning: Complex date parsing not fully supported on macOS. Using current time.${NC}"
                END_TIME=$(date -u +%s)000
            fi
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
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

# Function to get log group name
get_log_group_name() {
    local function_name="$1"
    echo "/aws/lambda/$function_name"
}

# Function to check if log group exists
log_group_exists() {
    local log_group="$1"
    aws logs describe-log-groups \
        --log-group-name-prefix "$log_group" \
        --region "$REGION" \
        --query 'logGroups[0].logGroupName' \
        --output text >/dev/null 2>&1
}

# Function to format log message with colors
format_log_message() {
    local timestamp="$1"
    local message="$2"
    
    # Format timestamp
    local formatted_time
    formatted_time=$(date -r "$((timestamp/1000))" '+%Y-%m-%d %H:%M:%S')
    
    # Color code based on log level
    local colored_message="$message"
    if echo "$message" | grep -qi "error\|exception\|failed"; then
        colored_message="${RED}$message${NC}"
    elif echo "$message" | grep -qi "warn\|warning"; then
        colored_message="${YELLOW}$message${NC}"
    elif echo "$message" | grep -qi "info"; then
        colored_message="${GREEN}$message${NC}"
    elif echo "$message" | grep -qi "debug"; then
        colored_message="${CYAN}$message${NC}"
    fi
    
    echo -e "${BLUE}[$formatted_time]${NC} $colored_message"
}

# Function to build filter pattern
build_filter_pattern() {
    local pattern=""
    
    if [ -n "$LEVEL" ]; then
        case "$LEVEL" in
            error)
                pattern="ERROR"
                ;;
            warn|warning)
                pattern="WARN"
                ;;
            info)
                pattern="INFO"
                ;;
            debug)
                pattern="DEBUG"
                ;;
            *)
                echo -e "${YELLOW}Warning: Unknown log level '$LEVEL', ignoring filter${NC}" >&2
                ;;
        esac
    fi
    
    if [ -n "$FILTER" ]; then
        if [ -n "$pattern" ]; then
            pattern="[$pattern] $FILTER"
        else
            pattern="$FILTER"
        fi
    fi
    
    echo "$pattern"
}

# Function to view logs
view_logs() {
    local log_group="$1"
    local filter_pattern
    filter_pattern=$(build_filter_pattern)
    
    # Build AWS CLI command
    local cmd="aws logs filter-log-events --log-group-name '$log_group' --region '$REGION'"
    
    # Add time filters
    if [ -n "$START_TIME" ]; then
        cmd="$cmd --start-time $START_TIME"
    else
        # Default to last hour if no start time specified
        local default_start
        default_start=$(date -u -v-1H +%s)000
        cmd="$cmd --start-time $default_start"
    fi
    
    if [ -n "$END_TIME" ]; then
        cmd="$cmd --end-time $END_TIME"
    fi
    
    # Add filter pattern
    if [ -n "$filter_pattern" ]; then
        cmd="$cmd --filter-pattern '$filter_pattern'"
    fi
    
    # Add query and output format
    cmd="$cmd --query 'events[*].[timestamp,message]' --output text"
    
    echo -e "${BLUE}=== CloudWatch Logs ===${NC}"
    echo "Log Group: $log_group"
    if [ -n "$filter_pattern" ]; then
        echo "Filter: $filter_pattern"
    fi
    if [ -n "$START_TIME" ]; then
        echo "Start Time: $(date -r "$((START_TIME/1000))" '+%Y-%m-%d %H:%M:%S')"
    fi
    if [ -n "$END_TIME" ]; then
        echo "End Time: $(date -r "$((END_TIME/1000))" '+%Y-%m-%d %H:%M:%S')"
    fi
    echo ""
    
    # Execute command and format output
    eval "$cmd" 2>/dev/null | \
        tail -n "$LINES" | \
        while IFS=$'\t' read -r timestamp message; do
            if [ -n "$timestamp" ] && [ -n "$message" ]; then
                format_log_message "$timestamp" "$message"
            fi
        done
}

# Function to follow logs in real-time
follow_logs() {
    local log_group="$1"
    local filter_pattern
    filter_pattern=$(build_filter_pattern)
    
    echo -e "${BLUE}=== Following CloudWatch Logs (Press Ctrl+C to stop) ===${NC}"
    echo "Log Group: $log_group"
    if [ -n "$filter_pattern" ]; then
        echo "Filter: $filter_pattern"
    fi
    echo ""
    
    # Start from current time
    local start_time
    start_time=$(date -u +%s)000
    
    while true; do
        local end_time
        end_time=$(date -u +%s)000
        
        # Build command for this iteration
        local cmd="aws logs filter-log-events --log-group-name '$log_group' --region '$REGION'"
        cmd="$cmd --start-time $start_time --end-time $end_time"
        
        if [ -n "$filter_pattern" ]; then
            cmd="$cmd --filter-pattern '$filter_pattern'"
        fi
        
        cmd="$cmd --query 'events[*].[timestamp,message]' --output text"
        
        # Get new logs and format them
        eval "$cmd" 2>/dev/null | \
            while IFS=$'\t' read -r timestamp message; do
                if [ -n "$timestamp" ] && [ -n "$message" ]; then
                    format_log_message "$timestamp" "$message"
                fi
            done
        
        # Update start time for next iteration
        start_time=$end_time
        
        # Wait before next check
        sleep 2
    done
}

# Function to show log statistics
show_log_stats() {
    local log_group="$1"
    
    echo -e "\n${BLUE}=== Log Statistics (Last 24 hours) ===${NC}"
    
    local start_time
    start_time=$(date -u -v-24H +%s)000
    
    # Count total events
    local total_events
    total_events=$(aws logs filter-log-events \
        --log-group-name "$log_group" \
        --region "$REGION" \
        --start-time "$start_time" \
        --query 'length(events)' \
        --output text 2>/dev/null || echo "0")
    
    echo "Total Events: $total_events"
    
    # Count errors
    local error_events
    error_events=$(aws logs filter-log-events \
        --log-group-name "$log_group" \
        --region "$REGION" \
        --start-time "$start_time" \
        --filter-pattern "ERROR" \
        --query 'length(events)' \
        --output text 2>/dev/null || echo "0")
    
    echo -e "Error Events: ${RED}$error_events${NC}"
    
    # Count warnings
    local warn_events
    warn_events=$(aws logs filter-log-events \
        --log-group-name "$log_group" \
        --region "$REGION" \
        --start-time "$start_time" \
        --filter-pattern "WARN" \
        --query 'length(events)' \
        --output text 2>/dev/null || echo "0")
    
    echo -e "Warning Events: ${YELLOW}$warn_events${NC}"
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
    
    # Get log group name
    local log_group
    log_group=$(get_log_group_name "$function_name")
    
    # Check if log group exists
    if ! log_group_exists "$log_group"; then
        echo -e "${RED}Error: Log group '$log_group' not found${NC}"
        echo "The Lambda function may not have been invoked yet"
        exit 1
    fi
    
    # Show logs based on mode
    if [ "$FOLLOW" = true ]; then
        follow_logs "$log_group"
    else
        view_logs "$log_group"
        show_log_stats "$log_group"
    fi
}

main "$@"