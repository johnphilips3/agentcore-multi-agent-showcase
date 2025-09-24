#!/bin/bash

# api-examples.sh - Manual API Testing Examples
# Provides curl commands for testing all API endpoints

set -euo pipefail

# Configuration
API_URL=${API_URL:-"http://localhost:3000/api/v1"}
VERBOSE=${VERBOSE:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS] [COMMAND]

Manual API testing examples with curl commands.

OPTIONS:
    -u, --url URL           API base URL (default: http://localhost:3000/api/v1)
    -v, --verbose           Show full curl commands
    -h, --help              Show this help message

COMMANDS:
    list                    Show all available API examples
    alpacas                 Show alpaca endpoint examples
    health                  Show health records endpoint examples
    breeding                Show breeding records endpoint examples
    activities              Show activities endpoint examples
    all                     Run all examples (default)

EXAMPLES:
    # Show all examples for local API
    $0

    # Show examples for deployed API
    $0 --url https://abc123.execute-api.us-east-1.amazonaws.com/Prod/api/v1

    # Show only alpaca examples
    $0 alpacas

    # Verbose output with full curl commands
    $0 --verbose

EOF
}

# Parse command line arguments
COMMAND="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            API_URL="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        list|alpacas|health|breeding|activities|all)
            COMMAND="$1"
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Execute curl command with optional verbose output
run_curl() {
    local description="$1"
    local curl_command="$2"
    
    echo
    log_info "$description"
    
    if [ "$VERBOSE" = true ]; then
        echo "Command: $curl_command"
        echo "Response:"
        eval "$curl_command" | jq . 2>/dev/null || eval "$curl_command"
    else
        echo "$curl_command"
    fi
}

# Alpaca endpoint examples
show_alpaca_examples() {
    log_info "=== ALPACA ENDPOINTS ==="
    
    # GET endpoints
    run_curl "List all alpacas" \
        "curl -s '$API_URL/alpacas'"
    
    run_curl "List alpacas with pagination" \
        "curl -s '$API_URL/alpacas?page=1&limit=5'"
    
    run_curl "List alpacas with filters" \
        "curl -s '$API_URL/alpacas?gender=female&color=white'"
    
    run_curl "Search alpacas" \
        "curl -s '$API_URL/alpacas/search?q=bella'"
    
    run_curl "Get specific alpaca (replace {id} with actual ID)" \
        "curl -s '$API_URL/alpacas/{id}'"
    
    run_curl "Get alpaca lineage (replace {id} with actual ID)" \
        "curl -s '$API_URL/alpacas/{id}/lineage?generations=3'"
    
    run_curl "Get alpaca offspring (replace {id} with actual ID)" \
        "curl -s '$API_URL/alpacas/{id}/offspring'"
    
    # POST endpoint
    run_curl "Create new alpaca" \
        "curl -s -X POST '$API_URL/alpacas' \\
        -H 'Content-Type: application/json' \\
        -d '{
            \"name\": \"Test Alpaca\",
            \"registrationNumber\": \"TEST-001\",
            \"gender\": \"female\",
            \"birthDate\": \"2020-05-15\",
            \"color\": \"white\",
            \"fiberQuality\": \"fine\"
        }'"
    
    # PUT endpoint
    run_curl "Update alpaca (replace {id} with actual ID)" \
        "curl -s -X PUT '$API_URL/alpacas/{id}' \\
        -H 'Content-Type: application/json' \\
        -d '{
            \"name\": \"Updated Alpaca Name\",
            \"color\": \"brown\"
        }'"
    
    # DELETE endpoint
    run_curl "Delete alpaca (replace {id} with actual ID)" \
        "curl -s -X DELETE '$API_URL/alpacas/{id}'"
}

# Health records endpoint examples
show_health_examples() {
    log_info "=== HEALTH RECORDS ENDPOINTS ==="
    
    # GET endpoints
    run_curl "List all health records" \
        "curl -s '$API_URL/health-records'"
    
    run_curl "List health records with filters" \
        "curl -s '$API_URL/health-records?recordType=vaccination&limit=10'"
    
    run_curl "Get overdue vaccinations" \
        "curl -s '$API_URL/health-records/overdue'"
    
    run_curl "Get specific health record (replace {id} with actual ID)" \
        "curl -s '$API_URL/health-records/{id}'"
    
    run_curl "Get health records for specific alpaca (replace {id} with actual alpaca ID)" \
        "curl -s '$API_URL/alpacas/{id}/health'"
    
    # POST endpoint
    run_curl "Create new health record" \
        "curl -s -X POST '$API_URL/health-records' \\
        -H 'Content-Type: application/json' \\
        -d '{
            \"alpacaId\": \"replace-with-actual-alpaca-id\",
            \"recordType\": \"vaccination\",
            \"date\": \"2024-01-15\",
            \"description\": \"Annual vaccination\",
            \"veterinarian\": \"Dr. Smith\",
            \"notes\": \"No adverse reactions\"
        }'"
    
    # PUT endpoint
    run_curl "Update health record (replace {id} with actual ID)" \
        "curl -s -X PUT '$API_URL/health-records/{id}' \\
        -H 'Content-Type: application/json' \\
        -d '{
            \"description\": \"Updated vaccination record\",
            \"notes\": \"Updated notes\"
        }'"
    
    # DELETE endpoint
    run_curl "Delete health record (replace {id} with actual ID)" \
        "curl -s -X DELETE '$API_URL/health-records/{id}'"
}

# Breeding records endpoint examples
show_breeding_examples() {
    log_info "=== BREEDING RECORDS ENDPOINTS ==="
    
    # GET endpoints
    run_curl "List all breeding records" \
        "curl -s '$API_URL/breeding-records'"
    
    run_curl "List breeding records with filters" \
        "curl -s '$API_URL/breeding-records?dateFrom=2023-01-01&dateTo=2023-12-31'"
    
    run_curl "Get specific breeding record (replace {id} with actual ID)" \
        "curl -s '$API_URL/breeding-records/{id}'"
    
    run_curl "Get breeding records for specific alpaca (replace {id} with actual alpaca ID)" \
        "curl -s '$API_URL/alpacas/{id}/breeding?role=both'"
    
    run_curl "Check breeding compatibility" \
        "curl -s -X POST '$API_URL/breeding-records/check' \\
        -H 'Content-Type: application/json' \\
        -d '{
            \"sireId\": \"replace-with-sire-id\",
            \"damId\": \"replace-with-dam-id\"
        }'"
    
    # POST endpoint
    run_curl "Create new breeding record" \
        "curl -s -X POST '$API_URL/breeding-records' \\
        -H 'Content-Type: application/json' \\
        -d '{
            \"sireId\": \"replace-with-sire-id\",
            \"damId\": \"replace-with-dam-id\",
            \"breedingDate\": \"2024-01-15\",
            \"expectedDueDate\": \"2024-12-15\",
            \"notes\": \"Planned breeding\"
        }'"
    
    # PUT endpoint
    run_curl "Update breeding record (replace {id} with actual ID)" \
        "curl -s -X PUT '$API_URL/breeding-records/{id}' \\
        -H 'Content-Type: application/json' \\
        -d '{
            \"actualBirthDate\": \"2024-12-10\",
            \"notes\": \"Successful breeding, healthy offspring\"
        }'"
    
    # DELETE endpoint
    run_curl "Delete breeding record (replace {id} with actual ID)" \
        "curl -s -X DELETE '$API_URL/breeding-records/{id}'"
}

# Activities endpoint examples
show_activities_examples() {
    log_info "=== ACTIVITIES ENDPOINTS ==="
    
    # GET endpoints
    run_curl "List all activities" \
        "curl -s '$API_URL/activities'"
    
    run_curl "List activities with filters" \
        "curl -s '$API_URL/activities?activityType=feeding&dateFrom=2024-01-01'"
    
    run_curl "Get specific activity (replace {id} with actual ID)" \
        "curl -s '$API_URL/activities/{id}'"
    
    run_curl "Get activities for specific alpaca (replace {id} with actual alpaca ID)" \
        "curl -s '$API_URL/alpacas/{id}/activities'"
    
    # POST endpoint
    run_curl "Create new activity" \
        "curl -s -X POST '$API_URL/activities' \\
        -H 'Content-Type: application/json' \\
        -d '{
            \"activityType\": \"feeding\",
            \"date\": \"2024-01-15\",
            \"description\": \"Morning feeding\",
            \"performedBy\": \"Farm Staff\",
            \"notes\": \"All animals fed properly\",
            \"alpacaIds\": [\"replace-with-actual-alpaca-ids\"]
        }'"
    
    # PUT endpoint
    run_curl "Update activity (replace {id} with actual ID)" \
        "curl -s -X PUT '$API_URL/activities/{id}' \\
        -H 'Content-Type: application/json' \\
        -d '{
            \"description\": \"Updated activity description\",
            \"notes\": \"Updated notes\"
        }'"
    
    # DELETE endpoint
    run_curl "Delete activity (replace {id} with actual ID)" \
        "curl -s -X DELETE '$API_URL/activities/{id}'"
}

# Show command list
show_command_list() {
    log_info "=== AVAILABLE API ENDPOINT CATEGORIES ==="
    echo
    echo "  alpacas     - Alpaca management endpoints"
    echo "  health      - Health records endpoints"
    echo "  breeding    - Breeding records endpoints"
    echo "  activities  - Management activities endpoints"
    echo "  all         - Show all examples"
    echo
    log_info "Use: $0 [category] to see specific examples"
    log_info "Use: $0 --verbose [category] to execute commands and see responses"
}

# Main execution
main() {
    log_info "API Testing Examples"
    log_info "Base URL: $API_URL"
    echo "===================="
    
    case "$COMMAND" in
        list)
            show_command_list
            ;;
        alpacas)
            show_alpaca_examples
            ;;
        health)
            show_health_examples
            ;;
        breeding)
            show_breeding_examples
            ;;
        activities)
            show_activities_examples
            ;;
        all)
            show_alpaca_examples
            show_health_examples
            show_breeding_examples
            show_activities_examples
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            usage
            exit 1
            ;;
    esac
    
    echo
    log_info "Note: Replace {id} placeholders with actual IDs from your data"
    log_info "Use --verbose flag to execute commands and see responses"
}

# Run main function
main "$@"