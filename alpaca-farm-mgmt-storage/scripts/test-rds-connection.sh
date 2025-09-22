#!/bin/bash

# RDS Connection Test Script
# This script helps diagnose RDS connection issues

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
echo "RDS Connection Diagnostic Tool"
echo "=============================================="

# Check if RDS config is loaded
if [[ -z "$RDS_HOST" ]]; then
    log_error "RDS environment variables not found"
    log_info "Please run: source demo/alpaca-herd-aws-config.env"
    exit 1
fi

log_info "RDS Configuration:"
echo "  Host: $RDS_HOST"
echo "  Port: $RDS_PORT"
echo "  Database: $RDS_DATABASE"
echo "  Username: $RDS_USERNAME"
echo "  SSL: $RDS_SSL"
echo ""

# Test 1: Check if psql is available
log_info "Test 1: Checking PostgreSQL client availability..."
if command -v psql &> /dev/null; then
    log_success "psql is available: $(psql --version)"
else
    log_error "psql is not installed"
    log_info "Install with: brew install postgresql"
    exit 1
fi

# Test 2: Check AWS CLI and credentials
log_info "Test 2: Checking AWS CLI and credentials..."
if command -v aws &> /dev/null; then
    if aws sts get-caller-identity &> /dev/null; then
        log_success "AWS CLI is configured"
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        CURRENT_USER=$(aws sts get-caller-identity --query Arn --output text)
        echo "  Account: $ACCOUNT_ID"
        echo "  User: $CURRENT_USER"
    else
        log_warning "AWS CLI not configured properly"
    fi
else
    log_warning "AWS CLI not installed"
fi

# Test 3: Check RDS instance status
log_info "Test 3: Checking RDS instance status..."
if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    RDS_STATUS=$(aws rds describe-db-instances --db-instance-identifier $RDS_INSTANCE_ID --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null || echo "ERROR")
    if [[ "$RDS_STATUS" == "available" ]]; then
        log_success "RDS instance is available"
    elif [[ "$RDS_STATUS" == "ERROR" ]]; then
        log_error "Failed to get RDS status (check instance ID and permissions)"
    else
        log_warning "RDS instance status: $RDS_STATUS"
    fi
else
    log_warning "Skipping RDS status check (AWS CLI not available)"
fi

# Test 4: Check network connectivity
log_info "Test 4: Testing network connectivity..."
if command -v nc &> /dev/null; then
    if timeout 10 nc -z $RDS_HOST $RDS_PORT 2>/dev/null; then
        log_success "Network connection to $RDS_HOST:$RDS_PORT successful"
    else
        log_error "Cannot connect to $RDS_HOST:$RDS_PORT"
        log_info "This usually means:"
        log_info "  - Security group doesn't allow your IP"
        log_info "  - RDS instance is not publicly accessible"
        log_info "  - Network/firewall issues"
    fi
else
    log_warning "nc (netcat) not available, skipping network test"
fi

# Test 5: Check your public IP
log_info "Test 5: Checking your public IP..."
if command -v curl &> /dev/null; then
    MY_IP=$(curl -s --connect-timeout 5 https://checkip.amazonaws.com || echo "unknown")
    if [[ "$MY_IP" != "unknown" ]]; then
        log_info "Your public IP: $MY_IP"
        log_info "Make sure this IP is allowed in security group: $SECURITY_GROUP_ID"
    else
        log_warning "Could not determine public IP"
    fi
else
    log_warning "curl not available, cannot check public IP"
fi

# Test 6: Check security group rules
log_info "Test 6: Checking security group rules..."
if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    log_info "Security group rules for PostgreSQL (port 5432):"
    aws ec2 describe-security-groups --group-ids $SECURITY_GROUP_ID --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`]' --output table 2>/dev/null || log_warning "Could not retrieve security group rules"
else
    log_warning "Skipping security group check (AWS CLI not available)"
fi

# Test 7: Attempt PostgreSQL connection
log_info "Test 7: Testing PostgreSQL connection..."
export PGPASSWORD="$RDS_PASSWORD"
export PGCONNECT_TIMEOUT=10

if timeout 15 psql -h $RDS_HOST -p $RDS_PORT -U $RDS_USERNAME -d postgres -c "SELECT version();" 2>/dev/null; then
    log_success "PostgreSQL connection successful!"
elif timeout 15 psql -h $RDS_HOST -p $RDS_PORT -U $RDS_USERNAME -d $RDS_DATABASE -c "SELECT version();" 2>/dev/null; then
    log_success "PostgreSQL connection to target database successful!"
else
    log_error "PostgreSQL connection failed"
    log_info "Trying with SSL mode..."
    if timeout 15 psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=$RDS_DATABASE sslmode=require" -c "SELECT version();" 2>/dev/null; then
        log_success "PostgreSQL connection with SSL successful!"
    else
        log_error "PostgreSQL connection failed even with SSL"
        log_info "Common solutions:"
        log_info "  1. Add your IP to security group:"
        log_info "     aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 5432 --cidr \$(curl -s https://checkip.amazonaws.com)/32"
        log_info "  2. Check if RDS is publicly accessible"
        log_info "  3. Verify credentials are correct"
        log_info "  4. Check VPC and subnet configuration"
    fi
fi

echo ""
echo "=============================================="
echo "Diagnostic complete"
echo "=============================================="