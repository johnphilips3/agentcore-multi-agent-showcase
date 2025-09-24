#!/bin/bash

# test-local.sh - SAM Local Testing Script
# Tests the alpaca-farm-mgmt-storage API using SAM local environment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SAM_PORT=${SAM_PORT:-3000}
BASE_URL="http://localhost:${SAM_PORT}/api/v1"
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

Test the alpaca-farm-mgmt-storage API using SAM local environment.

OPTIONS:
    -p, --port PORT         SAM local port (default: 3000)
    -t, --timeout TIMEOUT   Request timeout in seconds (default: 30)
    -v, --verbose           Enable verbose output
    -h, --help              Show this help message
    --no-start              Don't start SAM local (assume it's already running)
    --health-only           Run only health check tests
    --api-only              Run only API endpoint tests

EXAMPLES:
    # Run all tests (starts SAM local automatically)
    $0

    # Run tests on custom port
    $0 --port 8080

    # Run only health checks
    $0 --health-only

    # Run tests assuming SAM local is already running
    $0 --no-start

    # Verbose output
    $0 --verbose

EOF
}

# Parse command line arguments
START_SAM=true
HEALTH_ONLY=false
API_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            SAM_PORT="$2"
            BASE_URL="http://localhost:${SAM_PORT}/api/v1"
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
        --no-start)
            START_SAM=false
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
    
    if ! command -v sam &> /dev/null; then
        missing_deps+=("sam")
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

# Build the project
build_project() {
    log_info "Building project..."
    
    cd "$PROJECT_ROOT"
    
    if [ ! -f "template.yaml" ]; then
        log_error "template.yaml not found. Please ensure you're in the correct directory."
        exit 1
    fi
    
    if ! sam build; then
        log_error "Failed to build SAM project"
        exit 1
    fi
    
    log_success "Project built successfully"
}

# Start SAM local API
start_sam_local() {
    if [ "$START_SAM" = false ]; then
        log_info "Skipping SAM local startup (--no-start specified)"
        return 0
    fi
    
    log_info "Starting SAM local API on port $SAM_PORT..."
    
    # Kill any existing SAM local processes
    pkill -f "sam local start-api" || true
    sleep 2
    
    # Start SAM local in background
    sam local start-api --port "$SAM_PORT" > /tmp/sam-local.log 2>&1 &
    SAM_PID=$!
    
    # Wait for SAM local to start
    log_info "Waiting for SAM local to start..."
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -s -f "http://localhost:${SAM_PORT}" > /dev/null 2>&1; then
            log_success "SAM local started successfully (PID: $SAM_PID)"
            return 0
        fi
        
        sleep 2
        ((attempts++))
        
        if [ $((attempts % 5)) -eq 0 ]; then
            log_info "Still waiting for SAM local... (attempt $attempts/$max_attempts)"
        fi
    done
    
    log_error "SAM local failed to start within $((max_attempts * 2)) seconds"
    log_error "Check the log file: /tmp/sam-local.log"
    exit 1
}

# Stop SAM local
stop_sam_local() {
    if [ "$START_SAM" = false ]; then
        return 0
    fi
    
    if [ -n "${SAM_PID:-}" ]; then
        log_info "Stopping SAM local (PID: $SAM_PID)..."
        kill "$SAM_PID" 2>/dev/null || true
        wait "$SAM_PID" 2>/dev/null || true
        log_success "SAM local stopped"
    fi
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
    response=$(curl "${curl_args[@]}" -X "$method" "$BASE_URL$endpoint")
    
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
    
    # Test database connectivity (by checking if we can list alpacas)
    if make_request "GET" "/alpacas?limit=1" "" "200"; then
        test_passed "Database connectivity test"
    else
        test_failed "Database connectivity test"
    fi
}

# API endpoint tests
run_api_tests() {
    log_info "Running API endpoint tests..."
    
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
    
    # Test Activities endpoints
    log_info "Testing Activities endpoints..."
    
    # GET /activities
    if make_request "GET" "/activities" "" "200"; then
        test_passed "GET /activities"
    else
        test_failed "GET /activities"
    fi
    
    # Test POST endpoints with sample data
    log_info "Testing POST endpoints..."
    
    # Create test alpaca
    local alpaca_data='{
        "name": "Test Alpaca Local",
        "registrationNumber": "TEST-LOCAL-001",
        "gender": "female",
        "birthDate": "2020-05-15",
        "color": "white",
        "fiberQuality": "fine"
    }'
    
    if make_request "POST" "/alpacas" "$alpaca_data" "201"; then
        test_passed "POST /alpacas (create alpaca)"
    else
        test_failed "POST /alpacas (create alpaca)"
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
}

# Performance tests
run_performance_tests() {
    log_info "Running basic performance tests..."
    
    local start_time
    local end_time
    local duration
    
    # Test response time for GET /alpacas
    start_time=$(date +%s%N)
    if make_request "GET" "/alpacas?limit=10" "" "200" > /dev/null; then
        end_time=$(date +%s%N)
        duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
        
        if [ $duration -lt 5000 ]; then # Less than 5 seconds
            test_passed "Response time test: ${duration}ms (< 5000ms)"
        else
            test_failed "Response time test: ${duration}ms (>= 5000ms)"
        fi
    else
        test_failed "Performance test - request failed"
    fi
}

# Main test runner
run_tests() {
    log_info "Starting local API tests..."
    log_info "Base URL: $BASE_URL"
    log_info "Timeout: ${TIMEOUT}s"
    
    if [ "$HEALTH_ONLY" = true ]; then
        run_health_tests
    elif [ "$API_ONLY" = true ]; then
        run_api_tests
        run_performance_tests
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

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    stop_sam_local
}

# Set up signal handlers
trap cleanup EXIT INT TERM

# Main execution
main() {
    log_info "SAM Local Testing Script"
    echo "=========================="
    
    check_dependencies
    build_project
    start_sam_local
    
    # Give SAM local a moment to fully initialize
    sleep 3
    
    run_tests
    print_summary
}

# Run main function
main "$@"