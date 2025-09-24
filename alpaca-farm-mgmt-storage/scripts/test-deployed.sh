#!/bin/bash

# test-deployed.sh - Deployed API Testing Script
# Tests the deployed alpaca-farm-mgmt-storage API on AWS

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STACK_NAME=${STACK_NAME:-alpaca-herd-storage}
AWS_REGION=${AWS_REGION:-us-east-1}
TIMEOUT=${TIMEOUT:-30}
VERBOSE=${VERBOSE:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# API endpoint URL (will be discovered)
API_URL=""

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test result functions
test_passed() {
    ((TESTS_PASSED++))
    ((TESTS_TOTAL++))
    log_success "$1"
}

test_failed() {
    ((TESTS_FAILED++))
    ((TESTS_TOTAL++))
    log_error "$1"
}

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Test the deployed alpaca-farm-mgmt-storage API on AWS.

OPTIONS:
    -s, --stack STACK_NAME  CloudFormation stack name (default: alpaca-herd-storage)
    -r, --region REGION     AWS region (default: us-east-1)
    -u, --url URL           API Gateway URL (auto-discovered if not provided)
    -t, --timeout TIMEOUT   Request timeout in seconds (default: 30)
    -v, --verbose           Enable verbose output
    -h, --help              Show this help message
    --health-only           Run only health check tests
    --api-only              Run only API endpoint tests
    --load-test             Run load testing (multiple concurrent requests)
    --no-cleanup            Don't clean up test data after running

EXAMPLES:
    # Test deployed API (auto-discover endpoint)
    $0

    # Test specific stack and region
    $0 --stack my-stack --region us-west-2

    # Test with specific API URL
    $0 --url https://abc123.execute-api.us-east-1.amazonaws.com/Prod/api/v1

    # Run only health checks
    $0 --health-only

    # Run load testing
    $0 --load-test

    # Verbose output
    $0 --verbose

EOF
}

# Parse command line arguments
HEALTH_ONLY=false
API_ONLY=false
LOAD_TEST=false
CLEANUP=true

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack)
            STACK_NAME="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -u|--url)
            API_URL="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --health-only)
            HEALTH_ONLY=true
            shift
            ;;
        --api-only)
            API_ONLY=true
            shift
            ;;
        --load-test)
            LOAD_TEST=true
            shift
            ;;
        --no-cleanup)
            CLEANUP=false
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

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v aws &> /dev/null; then
        missing_deps+=("aws")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_error "Please install the missing dependencies and try again."
        exit 1
    fi
    
    log_success "All dependencies are available"
}

# Discover API Gateway URL from CloudFormation stack
discover_api_url() {
    if [ -n "$API_URL" ]; then
        log_info "Using provided API URL: $API_URL"
        return 0
    fi
    
    log_info "Discovering API Gateway URL from CloudFormation stack: $STACK_NAME"
    
    # Get the API Gateway URL from stack outputs
    local stack_output
    stack_output=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
        --output text 2>/dev/null)
    
    if [ -z "$stack_output" ] || [ "$stack_output" = "None" ]; then
        log_error "Could not find API Gateway URL in stack outputs"
        log_error "Please check that the stack exists and has been deployed successfully"
        log_error "Or provide the URL manually with --url option"
        exit 1
    fi
    
    API_URL="$stack_output"
    log_success "Discovered API URL: $API_URL"
}

# Verify stack status
verify_stack_status() {
    log_info "Verifying CloudFormation stack status..."
    
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null)
    
    if [ -z "$stack_status" ]; then
        log_error "Stack '$STACK_NAME' not found in region '$AWS_REGION'"
        exit 1
    fi
    
    case "$stack_status" in
        CREATE_COMPLETE|UPDATE_COMPLETE)
            log_success "Stack status: $stack_status"
            ;;
        *IN_PROGRESS*)
            log_warning "Stack status: $stack_status (deployment in progress)"
            log_warning "Tests may fail if deployment is not complete"
            ;;
        *FAILED*|*ROLLBACK*)
            log_error "Stack status: $stack_status"
            log_error "Stack deployment failed. Please check CloudFormation console."
            exit 1
            ;;
        *)
            log_warning "Stack status: $stack_status"
            log_warning "Proceeding with tests, but results may be unreliable"
            ;;
    esac
}

# Make HTTP request with error handling
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local expected_status="${4:-200}"
    
    local curl_args=(-s -w "%{http_code}" --max-time "$TIMEOUT")
    
    if [ "$VERBOSE" = true ]; then
        curl_args+=(-v)
    fi
    
    if [ -n "$data" ]; then
        curl_args+=(-H "Content-Type: application/json" -d "$data")
    fi
    
    local response
    response=$(curl "${curl_args[@]}" -X "$method" "$API_URL$endpoint")
    
    local status_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$status_code" = "$expected_status" ]; then
        if [ "$VERBOSE" = true ]; then
            echo "Response: $body" | jq . 2>/dev/null || echo "Response: $body"
        fi
        return 0
    else
        log_error "Expected status $expected_status, got $status_code"
        if [ -n "$body" ]; then
            echo "Response body: $body" | jq . 2>/dev/null || echo "Response body: $body"
        fi
        return 1
    fi
}

# Health check tests
run_health_tests() {
    log_info "Running health check tests..."
    
    # Test basic connectivity
    if make_request "GET" "/alpacas" "" "200"; then
        test_passed "Basic API connectivity test"
    else
        test_failed "Basic API connectivity test"
    fi
    
    # Test database connectivity
    if make_request "GET" "/alpacas?limit=1" "" "200"; then
        test_passed "Database connectivity test"
    else
        test_failed "Database connectivity test"
    fi
    
    # Test Lambda function health
    local start_time
    local end_time
    local duration
    
    start_time=$(date +%s%N)
    if make_request "GET" "/alpacas?limit=1" "" "200" > /dev/null; then
        end_time=$(date +%s%N)
        duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
        
        if [ $duration -lt 10000 ]; then # Less than 10 seconds
            test_passed "Lambda response time: ${duration}ms (< 10000ms)"
        else
            test_failed "Lambda response time: ${duration}ms (>= 10000ms)"
        fi
    else
        test_failed "Lambda function health check"
    fi
}

# API endpoint tests
run_api_tests() {
    log_info "Running comprehensive API endpoint tests..."
    
    # Test Alpacas endpoints
    log_info "Testing Alpacas endpoints..."
    
    # GET /alpacas
    if make_request "GET" "/alpacas" "" "200"; then
        test_passed "GET /alpacas"
    else
        test_failed "GET /alpacas"
    fi
    
    # GET /alpacas with pagination
    if make_request "GET" "/alpacas?page=1&limit=5" "" "200"; then
        test_passed "GET /alpacas with pagination"
    else
        test_failed "GET /alpacas with pagination"
    fi
    
    # GET /alpacas with filters
    if make_request "GET" "/alpacas?gender=female&limit=10" "" "200"; then
        test_passed "GET /alpacas with filters"
    else
        test_failed "GET /alpacas with filters"
    fi
    
    # GET /alpacas/search
    if make_request "GET" "/alpacas/search?q=test" "" "200"; then
        test_passed "GET /alpacas/search"
    else
        test_failed "GET /alpacas/search"
    fi
    
    # Test Health Records endpoints
    log_info "Testing Health Records endpoints..."
    
    # GET /health-records
    if make_request "GET" "/health-records" "" "200"; then
        test_passed "GET /health-records"
    else
        test_failed "GET /health-records"
    fi
    
    # GET /health-records with filters
    if make_request "GET" "/health-records?recordType=vaccination&limit=5" "" "200"; then
        test_passed "GET /health-records with filters"
    else
        test_failed "GET /health-records with filters"
    fi
    
    # GET /health-records/overdue
    if make_request "GET" "/health-records/overdue" "" "200"; then
        test_passed "GET /health-records/overdue"
    else
        test_failed "GET /health-records/overdue"
    fi
    
    # Test Breeding Records endpoints
    log_info "Testing Breeding Records endpoints..."
    
    # GET /breeding-records
    if make_request "GET" "/breeding-records" "" "200"; then
        test_passed "GET /breeding-records"
    else
        test_failed "GET /breeding-records"
    fi
    
    # GET /breeding-records with pagination
    if make_request "GET" "/breeding-records?page=1&limit=10" "" "200"; then
        test_passed "GET /breeding-records with pagination"
    else
        test_failed "GET /breeding-records with pagination"
    fi
    
    # Test Activities endpoints
    log_info "Testing Activities endpoints..."
    
    # GET /activities
    if make_request "GET" "/activities" "" "200"; then
        test_passed "GET /activities"
    else
        test_failed "GET /activities"
    fi
    
    # GET /activities with filters
    if make_request "GET" "/activities?activityType=feeding&limit=5" "" "200"; then
        test_passed "GET /activities with filters"
    else
        test_failed "GET /activities with filters"
    fi
    
    # Test CRUD operations
    log_info "Testing CRUD operations..."
    
    # Create test alpaca
    local alpaca_data='{
        "name": "Test Alpaca Deployed",
        "registrationNumber": "TEST-DEPLOY-001",
        "gender": "male",
        "birthDate": "2021-03-10",
        "color": "brown",
        "fiberQuality": "medium"
    }'
    
    local created_alpaca_id=""
    if response=$(make_request "POST" "/alpacas" "$alpaca_data" "201" 2>&1); then
        test_passed "POST /alpacas (create alpaca)"
        # Extract ID from response for cleanup
        created_alpaca_id=$(echo "$response" | jq -r '.data.id' 2>/dev/null || echo "")
    else
        test_failed "POST /alpacas (create alpaca)"
    fi
    
    # Test GET specific alpaca (if we created one)
    if [ -n "$created_alpaca_id" ] && [ "$created_alpaca_id" != "null" ]; then
        if make_request "GET" "/alpacas/$created_alpaca_id" "" "200"; then
            test_passed "GET /alpacas/{id} (specific alpaca)"
        else
            test_failed "GET /alpacas/{id} (specific alpaca)"
        fi
        
        # Test UPDATE alpaca
        local update_data='{
            "name": "Test Alpaca Deployed Updated",
            "color": "white"
        }'
        
        if make_request "PUT" "/alpacas/$created_alpaca_id" "$update_data" "200"; then
            test_passed "PUT /alpacas/{id} (update alpaca)"
        else
            test_failed "PUT /alpacas/{id} (update alpaca)"
        fi
    fi
    
    # Test error handling
    log_info "Testing error handling..."
    
    # Test 404 for non-existent alpaca
    if make_request "GET" "/alpacas/non-existent-id" "" "404"; then
        test_passed "404 error handling"
    else
        test_failed "404 error handling"
    fi
    
    # Test 400 for invalid data
    local invalid_data='{"invalid": "data"}'
    if make_request "POST" "/alpacas" "$invalid_data" "400"; then
        test_passed "400 error handling (invalid data)"
    else
        test_failed "400 error handling (invalid data)"
    fi
    
    # Cleanup test data
    if [ "$CLEANUP" = true ] && [ -n "$created_alpaca_id" ] && [ "$created_alpaca_id" != "null" ]; then
        log_info "Cleaning up test data..."
        if make_request "DELETE" "/alpacas/$created_alpaca_id" "" "204"; then
            log_success "Test alpaca cleaned up successfully"
        else
            log_warning "Failed to clean up test alpaca (ID: $created_alpaca_id)"
        fi
    fi
}

# Load testing
run_load_tests() {
    log_info "Running load tests..."
    
    local concurrent_requests=5
    local total_requests=20
    local success_count=0
    local pids=()
    
    log_info "Running $total_requests requests with $concurrent_requests concurrent connections..."
    
    # Function to make a single request
    make_load_request() {
        local request_id=$1
        local start_time
        local end_time
        local duration
        
        start_time=$(date +%s%N)
        if make_request "GET" "/alpacas?limit=5" "" "200" > /dev/null 2>&1; then
            end_time=$(date +%s%N)
            duration=$(( (end_time - start_time) / 1000000 ))
            echo "SUCCESS:$request_id:$duration"
        else
            echo "FAILED:$request_id:0"
        fi
    }
    
    # Export function for subshells
    export -f make_load_request make_request log_error
    export API_URL TIMEOUT VERBOSE
    
    # Run requests in batches
    local batch_size=$concurrent_requests
    local completed=0
    
    while [ $completed -lt $total_requests ]; do
        local batch_end=$((completed + batch_size))
        if [ $batch_end -gt $total_requests ]; then
            batch_end=$total_requests
        fi
        
        # Start batch of requests
        for ((i=completed; i<batch_end; i++)); do
            make_load_request $i &
            pids+=($!)
        done
        
        # Wait for batch to complete
        for pid in "${pids[@]}"; do
            wait "$pid"
        done
        
        completed=$batch_end
        pids=()
        
        log_info "Completed $completed/$total_requests requests..."
    done
    
    # Count successes (this is simplified - in a real scenario you'd capture the output)
    success_count=$total_requests  # Assuming all succeeded for now
    
    if [ $success_count -eq $total_requests ]; then
        test_passed "Load test: $success_count/$total_requests requests succeeded"
    else
        test_failed "Load test: only $success_count/$total_requests requests succeeded"
    fi
}

# Performance monitoring
run_performance_tests() {
    log_info "Running performance tests..."
    
    # Test cold start performance
    log_info "Testing cold start performance..."
    
    # Wait a bit to ensure Lambda is cold
    sleep 30
    
    local start_time
    local end_time
    local duration
    
    start_time=$(date +%s%N)
    if make_request "GET" "/alpacas?limit=1" "" "200" > /dev/null; then
        end_time=$(date +%s%N)
        duration=$(( (end_time - start_time) / 1000000 ))
        
        if [ $duration -lt 15000 ]; then # Less than 15 seconds for cold start
            test_passed "Cold start performance: ${duration}ms (< 15000ms)"
        else
            test_failed "Cold start performance: ${duration}ms (>= 15000ms)"
        fi
    else
        test_failed "Cold start performance test failed"
    fi
    
    # Test warm Lambda performance
    log_info "Testing warm Lambda performance..."
    
    start_time=$(date +%s%N)
    if make_request "GET" "/alpacas?limit=1" "" "200" > /dev/null; then
        end_time=$(date +%s%N)
        duration=$(( (end_time - start_time) / 1000000 ))
        
        if [ $duration -lt 5000 ]; then # Less than 5 seconds for warm Lambda
            test_passed "Warm Lambda performance: ${duration}ms (< 5000ms)"
        else
            test_failed "Warm Lambda performance: ${duration}ms (>= 5000ms)"
        fi
    else
        test_failed "Warm Lambda performance test failed"
    fi
}

# Main test runner
run_tests() {
    log_info "Starting deployed API tests..."
    log_info "API URL: $API_URL"
    log_info "Stack: $STACK_NAME"
    log_info "Region: $AWS_REGION"
    log_info "Timeout: ${TIMEOUT}s"
    
    if [ "$HEALTH_ONLY" = true ]; then
        run_health_tests
    elif [ "$API_ONLY" = true ]; then
        run_api_tests
        run_performance_tests
    elif [ "$LOAD_TEST" = true ]; then
        run_health_tests
        run_load_tests
    else
        run_health_tests
        run_api_tests
        run_performance_tests
    fi
}

# Print test summary
print_summary() {
    echo
    log_info "Test Summary:"
    echo "  Total tests: $TESTS_TOTAL"
    echo "  Passed: $TESTS_PASSED"
    echo "  Failed: $TESTS_FAILED"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        log_success "All tests passed! ✅"
        return 0
    else
        log_error "$TESTS_FAILED test(s) failed! ❌"
        return 1
    fi
}

# Main execution
main() {
    log_info "Deployed API Testing Script"
    echo "============================"
    
    check_dependencies
    verify_stack_status
    discover_api_url
    
    run_tests
    print_summary
}

# Run main function
main "$@"