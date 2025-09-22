#!/bin/bash

# AWS RDS SSL Certificate Setup Script
# Downloads and configures AWS RDS root CA certificates for SSL connections

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
echo "AWS RDS SSL Certificate Setup"
echo "=============================================="

# Create certificates directory
CERT_DIR="$HOME/.postgresql"
mkdir -p "$CERT_DIR"

log_info "Setting up AWS RDS SSL certificates..."
log_info "Certificate directory: $CERT_DIR"

# Download AWS RDS root CA certificate bundle
log_info "Downloading AWS RDS root CA certificate bundle..."
curl -o "$CERT_DIR/rds-ca-2019-root.pem" https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem

# Download the newer certificate bundle (recommended for new connections)
log_info "Downloading AWS RDS root CA certificate bundle (2019)..."
curl -o "$CERT_DIR/rds-ca-rsa2048-g1.pem" https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Create a combined certificate file
log_info "Creating combined certificate bundle..."
cat "$CERT_DIR/rds-ca-2019-root.pem" "$CERT_DIR/rds-ca-rsa2048-g1.pem" > "$CERT_DIR/root.crt"

# Set proper permissions
chmod 600 "$CERT_DIR"/*.pem "$CERT_DIR/root.crt"

log_success "SSL certificates installed successfully!"
echo "Certificate files:"
echo "  - $CERT_DIR/rds-ca-2019-root.pem"
echo "  - $CERT_DIR/rds-ca-rsa2048-g1.pem"
echo "  - $CERT_DIR/root.crt (combined)"

# Test SSL connection
if [[ -n "$RDS_HOST" ]]; then
    log_info "Testing SSL connection to RDS..."
    
    export PGPASSWORD="$RDS_PASSWORD"
    
    # Test with different SSL modes
    log_info "Testing with sslmode=require..."
    if timeout 10 psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=$RDS_DATABASE sslmode=require" -c "SELECT version();" 2>/dev/null; then
        log_success "SSL connection successful with sslmode=require"
    else
        log_warning "sslmode=require failed, trying sslmode=verify-ca..."
        
        if timeout 10 psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=$RDS_DATABASE sslmode=verify-ca sslrootcert=$CERT_DIR/root.crt" -c "SELECT version();" 2>/dev/null; then
            log_success "SSL connection successful with certificate verification"
        else
            log_warning "Certificate verification failed, trying sslmode=verify-full..."
            
            if timeout 10 psql "host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=$RDS_DATABASE sslmode=verify-full sslrootcert=$CERT_DIR/root.crt" -c "SELECT version();" 2>/dev/null; then
                log_success "SSL connection successful with full verification"
            else
                log_error "All SSL connection attempts failed"
                log_info "Try connecting without SSL verification for debugging:"
                log_info "psql \"host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=$RDS_DATABASE sslmode=disable\""
            fi
        fi
    fi
else
    log_warning "RDS_HOST not set, skipping connection test"
    log_info "To test: source demo/alpaca-herd-aws-config.env && ./scripts/setup-rds-ssl.sh"
fi

echo ""
echo "=============================================="
echo "Setup complete!"
echo "=============================================="
echo ""
echo "You can now use these SSL modes with psql:"
echo "  sslmode=require          - Require SSL but don't verify certificate"
echo "  sslmode=verify-ca        - Verify certificate against CA"
echo "  sslmode=verify-full      - Full certificate verification"
echo ""
echo "Example connection:"
echo "psql \"host=\$RDS_HOST port=\$RDS_PORT user=\$RDS_USERNAME dbname=\$RDS_DATABASE sslmode=require\""