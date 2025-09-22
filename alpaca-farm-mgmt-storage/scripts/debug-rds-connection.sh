#!/bin/bash

# Debug RDS Connection Script
# Tests various connection methods to identify the exact issue

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "=============================================="
echo "RDS Connection Debug Tool"
echo "=============================================="

# Check if RDS config is loaded
if [[ -z "$RDS_HOST" ]]; then
    log_error "RDS environment variables not found"
    log_info "Please run: source demo/alpaca-herd-aws-config.env"
    exit 1
fi

log_info "Testing connection to: $RDS_HOST:$RDS_PORT"
log_info "Database: $RDS_DATABASE"
log_info "Username: $RDS_USERNAME"
echo ""

export PGPASSWORD="$RDS_PASSWORD"
export PGCONNECT_TIMEOUT=10

# Test 1: Basic network connectivity
log_info "Test 1: Network connectivity"

# Try multiple methods for macOS compatibility
NETWORK_OK=false

# Method 1: nc (netcat) - most reliable on macOS
if command -v nc &> /dev/null; then
    log_info "Using nc (netcat) for connectivity test..."
    if timeout 5 nc -z "$RDS_HOST" "$RDS_PORT" 2>/dev/null; then
        log_success "Network connection successful (nc)"
        NETWORK_OK=true
    fi
fi

# Method 2: telnet (if available)
if [[ "$NETWORK_OK" == "false" ]] && command -v telnet &> /dev/null; then
    log_info "Using telnet for connectivity test..."
    if timeout 5 bash -c "echo 'quit' | telnet $RDS_HOST $RDS_PORT" 2>/dev/null | grep -q "Connected"; then
        log_success "Network connection successful (telnet)"
        NETWORK_OK=true
    fi
fi

# Method 3: bash built-in /dev/tcp (fallback)
if [[ "$NETWORK_OK" == "false" ]]; then
    log_info "Using bash /dev/tcp for connectivity test..."
    if timeout 5 bash -c "exec 3<>/dev/tcp/$RDS_HOST/$RDS_PORT && echo 'Connected' >&3" 2>/dev/null; then
        log_success "Network connection successful (bash)"
        NETWORK_OK=true
    fi
fi

# Method 4: curl (last resort)
if [[ "$NETWORK_OK" == "false" ]] && command -v curl &> /dev/null; then
    log_info "Using curl for connectivity test..."
    if timeout 5 curl -s --connect-timeout 3 "telnet://$RDS_HOST:$RDS_PORT" 2>/dev/null; then
        log_success "Network connection successful (curl)"
        NETWORK_OK=true
    fi
fi

if [[ "$NETWORK_OK" == "false" ]]; then
    log_error "Network connection failed with all methods"
    log_info "This indicates a network/firewall issue"
    log_info "Check:"
    log_info "  1. Security group allows your IP on port $RDS_PORT"
    log_info "  2. RDS instance is publicly accessible"
    log_info "  3. Your network/firewall allows outbound connections"
    
    # Don't exit, continue with other tests
    log_warning "Continuing with PostgreSQL connection tests..."
else
    log_success "Network connectivity confirmed"
fi

# Test 2: Try connecting without SSL
log_info "Test 2: PostgreSQL connection without SSL"
if timeout 10 psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=postgres sslmode=disable" -c "SELECT 1;" 2>/dev/null; then
    log_success "Connection without SSL successful"
    SSL_REQUIRED=false
else
    log_warning "Connection without SSL failed (SSL likely required)"
    SSL_REQUIRED=true
fi

# Test 3: Try with SSL required (no certificate verification)
log_info "Test 3: PostgreSQL connection with SSL (no verification)"
if timeout 10 psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME password=$RDS_PASSWORD dbname=postgres sslrootcert=rds-ca-rsa2048-g1.pem sslmode=require" -c "SELECT 1;" 2>/dev/null; then
    log_success "SSL connection (no verification) successful"
elif timeout 10 psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME password=$RDS_PASSWORD dbname=$RDS_DATABASE sslrootcert=rds-ca-rsa2048-g1.pem sslmode=require" -c "SELECT 1;" 2>/dev/null; then
    log_success "SSL connection to target database successful"
else
    log_error "SSL connection failed"
    
    # Try to get more detailed error
    log_info "Getting detailed error message..."
    psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=postgres sslmode=require" -c "SELECT 1;" 2>&1 | head -5
fi

# Test 4: Check if target database exists
log_info "Test 4: Checking if target database '$RDS_DATABASE' exists"
if timeout 10 psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=postgres sslmode=require" -c "SELECT 1 FROM pg_database WHERE datname='$RDS_DATABASE';" 2>/dev/null | grep -q "1"; then
    log_success "Target database '$RDS_DATABASE' exists"
    TARGET_DB_EXISTS=true
else
    log_warning "Target database '$RDS_DATABASE' does not exist"
    TARGET_DB_EXISTS=false
    
    # List available databases
    log_info "Available databases:"
    timeout 10 psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=postgres sslmode=require" -c "SELECT datname FROM pg_database WHERE datistemplate = false;" 2>/dev/null || log_error "Could not list databases"
fi

# Test 5: Try different SSL modes with certificates
if [[ -f "$HOME/.postgresql/root.crt" ]]; then
    log_info "Test 5: SSL with certificate verification"
    
    if timeout 10 psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=postgres sslmode=verify-ca sslrootcert=$HOME/.postgresql/root.crt" -c "SELECT 1;" 2>/dev/null; then
        log_success "SSL with certificate verification successful"
    else
        log_warning "SSL certificate verification failed"
    fi
else
    log_warning "Test 5: SSL certificates not found at $HOME/.postgresql/root.crt"
fi

# Test 6: Check RDS instance details
log_info "Test 6: RDS instance information"
if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    log_info "RDS instance details:"
    aws rds describe-db-instances --db-instance-identifier $RDS_INSTANCE_ID --query 'DBInstances[0].{Status:DBInstanceStatus,Engine:Engine,EngineVersion:EngineVersion,PubliclyAccessible:PubliclyAccessible,VpcId:DBSubnetGroup.VpcId}' --output table 2>/dev/null || log_warning "Could not get RDS details"
else
    log_warning "AWS CLI not available for RDS details"
fi

echo ""
echo "=============================================="
echo "Debug Summary"
echo "=============================================="

if [[ "$SSL_REQUIRED" == "false" ]]; then
    log_success "SSL is not required - you can connect without SSL"
    echo "Try: export RDS_SSL=false"
elif [[ "$TARGET_DB_EXISTS" == "false" ]]; then
    log_warning "Target database does not exist"
    echo "The init script should create it, but try connecting to 'postgres' database first"
    echo "Connection string: psql \"host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=postgres sslmode=require\""
else
    echo "Recommended connection string:"
    echo "psql \"host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=postgres sslmode=require\""
fi

echo ""
echo "If connection still fails, check:"
echo "1. RDS instance is in 'available' state"
echo "2. Security group allows your IP on port 5432"
echo "3. RDS is publicly accessible (if connecting from outside VPC)"
echo "4. Username/password are correct"