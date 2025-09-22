#!/bin/bash

# AWS RDS PostgreSQL Database Initialization Script
# This script follows AWS RDS best practices for database initialization
# Based on AWS RDS PostgreSQL documentation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration - RDS specific
RDS_HOST="${RDS_HOST}"
RDS_PORT="${RDS_PORT:-5432}"
RDS_DATABASE="${RDS_DATABASE}"
RDS_USERNAME="${RDS_USERNAME}"
RDS_PASSWORD="${RDS_PASSWORD}"
RDS_SSL="${RDS_SSL:-true}"
SEED_DATA="${SEED_DATA:-true}"
FORCE_RECREATE="${FORCE_RECREATE:-false}"

echo "=============================================="
echo "AWS RDS PostgreSQL Database Initialization"
echo "=============================================="

# Validate RDS configuration
validate_rds_config() {
    log_info "Validating RDS configuration..."
    
    if [[ -z "$RDS_HOST" ]]; then
        log_error "RDS_HOST is required"
        log_info "Please run: source demo/alpaca-herd-aws-config.env"
        exit 1
    fi
    
    if [[ -z "$RDS_DATABASE" ]]; then
        log_error "RDS_DATABASE is required"
        exit 1
    fi
    
    if [[ -z "$RDS_USERNAME" ]]; then
        log_error "RDS_USERNAME is required"
        exit 1
    fi
    
    if [[ -z "$RDS_PASSWORD" ]]; then
        log_error "RDS_PASSWORD is required"
        exit 1
    fi
    
    log_success "RDS configuration validated"
    log_info "Host: $RDS_HOST:$RDS_PORT"
    log_info "Database: $RDS_DATABASE"
    log_info "Username: $RDS_USERNAME"
    log_info "SSL: $RDS_SSL"
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v psql &> /dev/null; then
        log_error "psql is required but not installed"
        log_info "Install with: brew install postgresql"
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

# Build RDS connection string
build_rds_connection() {
    local database="$1"
    local conn_str="host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME"

    if [[ -n "$database" ]]; then
        conn_str="$conn_str dbname=$database"
    fi

    # Add SSL configuration
    if [[ "$RDS_SSL" == "true" ]]; then
        if [[ -f "$HOME/.postgresql/root.crt" ]]; then
            conn_str="$conn_str sslmode=verify-ca sslrootcert=$HOME/.postgresql/rds-ca-rsa2048-g1.pem"
            log_info "Using SSL with certificate verification"
        else
            conn_str="$conn_str sslmode=require"
            log_info "Using SSL without certificate verification"
            log_warning "For better security, run: ./scripts/setup-rds-ssl.sh"
        fi
    else
        conn_str="$conn_str sslmode=disable"
        log_warning "SSL is disabled - not recommended for production"
    fi
    
    echo "$conn_str"
}

# Test RDS connection
test_rds_connection() {
    log_info "Testing RDS connection..."
    
    # Set PostgreSQL environment variables for consistent behavior
    export PGPASSWORD="$RDS_PASSWORD"
    export PGCONNECT_TIMEOUT=15
    export PGHOST="$RDS_HOST"
    export PGPORT="$RDS_PORT"
    export PGUSER="$RDS_USERNAME"
    
    # Set SSL mode based on configuration
    if [[ "$RDS_SSL" == "true" ]]; then
        if [[ -f "$HOME/.postgresql/root.crt" ]]; then
            export PGSSLMODE=verify-ca
            export PGSSLROOTCERT="$HOME/.postgresql/rds-ca-rsa2048-g1.pem"
            log_info "Using SSL with certificate verification"
        else
            export PGSSLMODE=require
            log_info "Using SSL without certificate verification"
        fi
    else
        export PGSSLMODE=disable
        log_warning "SSL is disabled - not recommended for production"
    fi
    
    log_info "Connection parameters: $PGUSER@$PGHOST:$PGPORT (SSL: $PGSSLMODE)"
    
    # First, try to connect to the target database
    log_info "Testing connection to target database: $RDS_DATABASE"
    if timeout 15 psql -d "$RDS_DATABASE" -c "SELECT version();" > /dev/null 2>&1; then
        log_success "Connected to target database: $RDS_DATABASE"
        return 0
    fi
    
    # If target database doesn't exist, connect to default postgres database
    log_info "Target database not accessible, trying default postgres database..."
    if timeout 15 psql -d "postgres" -c "SELECT version();" > /dev/null 2>&1; then
        log_success "Connected to postgres database"
        return 0
    fi
    
    # Try without specifying database (RDS will use default)
    log_info "Trying connection without specifying database..."
    if timeout 15 psql -c "SELECT version();" > /dev/null 2>&1; then
        log_success "Connected to RDS instance"
        return 0
    fi
    
    # Show detailed error for debugging
    log_error "Failed to connect to RDS instance"
    log_info "Attempting connection with error details..."
    echo "Command: psql -h $PGHOST -p $PGPORT -U $PGUSER -d $RDS_DATABASE"

    psql -d "$RDS_DATABASE" -c "SELECT version();" 2>&1 | head -3
    
    log_error "Please check:"
    log_error "  - RDS instance is running and available"
    log_error "  - Security groups allow connections from your IP"
    log_error "  - Database credentials are correct"
    log_error "  - SSL configuration matches RDS requirements"
    exit 1
}

# Check if target database exists
check_database_exists() {
    log_info "Checking if database '$RDS_DATABASE' exists..."
    
    # Use environment variables set by test_rds_connection
    local db_exists=$(timeout 10 psql -d "postgres" -tAc "SELECT 1 FROM pg_database WHERE datname='$RDS_DATABASE';" 2>/dev/null || echo "")
    
    if [[ "$db_exists" == "1" ]]; then
        log_success "Database '$RDS_DATABASE' exists"
        return 0
    else
        log_warning "Database '$RDS_DATABASE' does not exist"
        return 1
    fi
}

# Create target database
create_target_database() {
    log_info "Creating database '$RDS_DATABASE'..."
    
    # Create database with proper encoding and collation
    local create_db_sql="
CREATE DATABASE \"$RDS_DATABASE\"
    WITH ENCODING='UTF8'
    LC_COLLATE='en_US.UTF-8'
    LC_CTYPE='en_US.UTF-8'
    TEMPLATE=template0;
"
    
    if timeout 15 psql -d "postgres" -c "$create_db_sql" 2>/dev/null; then
        log_success "Database '$RDS_DATABASE' created successfully"
    else
        log_error "Failed to create database '$RDS_DATABASE'"
        log_info "The database might already exist or you may not have CREATE DATABASE privileges"
        
        # Check if we can connect to the database anyway
        if timeout 10 psql -d "$RDS_DATABASE" -c "SELECT 1;" > /dev/null 2>&1; then
            log_success "Database '$RDS_DATABASE' is accessible"
        else
            exit 1
        fi
    fi
}

# Create database schema
create_schema() {
    log_info "Creating database schema..."
    
    # Use environment variables set by test_rds_connection
    # RDS-compatible schema with UUID support
    local schema_sql="
-- Enable UUID extension (available in RDS)
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";

-- Enable additional useful extensions
CREATE EXTENSION IF NOT EXISTS \"pg_stat_statements\";

-- Alpacas table with UUID primary keys
CREATE TABLE IF NOT EXISTS alpacas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100) UNIQUE,
    birth_date DATE NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')) NOT NULL,
    color VARCHAR(100) NOT NULL,
    weight DECIMAL(6,2),
    height DECIMAL(6,2),
    fiber_micron_count DECIMAL(4,1),
    fiber_staple_length DECIMAL(4,1),
    fiber_crimp VARCHAR(50),
    fiber_density VARCHAR(50),
    sire_id UUID REFERENCES alpacas(id),
    dam_id UUID REFERENCES alpacas(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Health records table
CREATE TABLE IF NOT EXISTS health_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alpaca_id UUID NOT NULL REFERENCES alpacas(id) ON DELETE CASCADE,
    record_type VARCHAR(20) CHECK (record_type IN ('vaccination', 'treatment', 'observation', 'checkup')) NOT NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    veterinarian VARCHAR(255),
    next_due_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Breeding records table
CREATE TABLE IF NOT EXISTS breeding_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sire_id UUID NOT NULL REFERENCES alpacas(id),
    dam_id UUID NOT NULL REFERENCES alpacas(id),
    breeding_date DATE NOT NULL,
    expected_due_date DATE,
    actual_birth_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Breeding offspring junction table
CREATE TABLE IF NOT EXISTS breeding_offspring (
    breeding_id UUID REFERENCES breeding_records(id) ON DELETE CASCADE,
    offspring_id UUID REFERENCES alpacas(id) ON DELETE CASCADE,
    PRIMARY KEY (breeding_id, offspring_id)
);

-- Management activities table
CREATE TABLE IF NOT EXISTS management_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_type VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity alpacas junction table
CREATE TABLE IF NOT EXISTS activity_alpacas (
    activity_id UUID REFERENCES management_activities(id) ON DELETE CASCADE,
    alpaca_id UUID REFERENCES alpacas(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, alpaca_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alpacas_registration ON alpacas(registration_number);
CREATE INDEX IF NOT EXISTS idx_alpacas_birth_date ON alpacas(birth_date);
CREATE INDEX IF NOT EXISTS idx_alpacas_parents ON alpacas(sire_id, dam_id);
CREATE INDEX IF NOT EXISTS idx_health_alpaca_date ON health_records(alpaca_id, date);
CREATE INDEX IF NOT EXISTS idx_health_due_date ON health_records(next_due_date);
CREATE INDEX IF NOT EXISTS idx_health_record_type ON health_records(record_type);
CREATE INDEX IF NOT EXISTS idx_breeding_parents ON breeding_records(sire_id, dam_id);
CREATE INDEX IF NOT EXISTS idx_breeding_date ON breeding_records(breeding_date);
CREATE INDEX IF NOT EXISTS idx_activities_date ON management_activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_type ON management_activities(activity_type);

-- Update trigger for alpacas table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
\$\$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_alpacas_updated_at ON alpacas;
CREATE TRIGGER update_alpacas_updated_at 
    BEFORE UPDATE ON alpacas
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to current user (RDS master user has these by default)
-- This ensures the schema is properly owned
ALTER TABLE alpacas OWNER TO CURRENT_USER;
ALTER TABLE health_records OWNER TO CURRENT_USER;
ALTER TABLE breeding_records OWNER TO CURRENT_USER;
ALTER TABLE breeding_offspring OWNER TO CURRENT_USER;
ALTER TABLE management_activities OWNER TO CURRENT_USER;
ALTER TABLE activity_alpacas OWNER TO CURRENT_USER;
"

    if [[ "$FORCE_RECREATE" == "true" ]]; then
        log_warning "Force recreate requested - dropping existing tables"
        local drop_sql="
DROP TABLE IF EXISTS activity_alpacas CASCADE;
DROP TABLE IF EXISTS breeding_offspring CASCADE;
DROP TABLE IF EXISTS management_activities CASCADE;
DROP TABLE IF EXISTS breeding_records CASCADE;
DROP TABLE IF EXISTS health_records CASCADE;
DROP TABLE IF EXISTS alpacas CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
"
        echo "$drop_sql" | psql -d "$RDS_DATABASE"
        log_success "Existing tables dropped"
    fi
    
    echo "$schema_sql" | psql -d "$RDS_DATABASE"
    log_success "Database schema created successfully"
}

# Seed test data
seed_test_data() {
    if [[ "$SEED_DATA" != "true" ]]; then
        log_info "Skipping test data seeding"
        return
    fi
    
    log_info "Seeding test data..."
    
    # Use environment variables set by test_rds_connection
    # RDS-compatible seed data using PostgreSQL stored procedure
    local seed_sql="
DO \$\$
DECLARE
    sire1_id UUID := uuid_generate_v4();
    dam1_id UUID := uuid_generate_v4();
    sire2_id UUID := uuid_generate_v4();
    dam2_id UUID := uuid_generate_v4();
    offspring1_id UUID := uuid_generate_v4();
    offspring2_id UUID := uuid_generate_v4();
    offspring3_id UUID := uuid_generate_v4();
    activity1_id UUID := uuid_generate_v4();
    activity2_id UUID := uuid_generate_v4();
    activity3_id UUID := uuid_generate_v4();
    activity4_id UUID := uuid_generate_v4();
    breeding1_id UUID;
    breeding2_id UUID;
    breeding3_id UUID;
BEGIN
    -- Insert parent alpacas
    INSERT INTO alpacas (id, name, registration_number, birth_date, gender, color, weight, height, fiber_micron_count, fiber_staple_length, fiber_crimp, fiber_density) VALUES
    (sire1_id, 'Thunder Mountain Zeus', 'AMR123456', '2018-05-15', 'male', 'Dark Brown', 185.5, 36.2, 22.5, 4.2, 'High', 'Dense'),
    (dam1_id, 'Moonbeam Serenity', 'AMR123457', '2019-03-22', 'female', 'Light Fawn', 145.8, 34.1, 20.8, 4.8, 'Medium', 'Medium'),
    (sire2_id, 'Storm Cloud Ranger', 'AMR123458', '2017-08-10', 'male', 'Medium Brown', 195.2, 37.5, 23.1, 4.0, 'High', 'Dense'),
    (dam2_id, 'Sunrise Melody', 'AMR123459', '2020-01-18', 'female', 'White', 138.4, 33.8, 19.5, 5.1, 'Low', 'Fine');

    -- Insert offspring alpacas
    INSERT INTO alpacas (id, name, registration_number, birth_date, gender, color, weight, height, sire_id, dam_id, fiber_micron_count, fiber_staple_length, fiber_crimp, fiber_density) VALUES
    (offspring1_id, 'Zeus Junior Champion', 'AMR123460', '2022-06-12', 'male', 'Medium Brown', 95.3, 28.5, sire1_id, dam1_id, 21.2, 4.5, 'Medium', 'Medium'),
    (offspring2_id, 'Serenity Star', 'AMR123461', '2023-04-08', 'female', 'Light Fawn', 78.2, 26.1, sire1_id, dam1_id, 20.1, 4.9, 'Medium', 'Fine'),
    (offspring3_id, 'Ranger Storm', 'AMR123462', '2023-09-25', 'male', 'Dark Brown', 82.7, 27.3, sire2_id, dam2_id, 22.8, 4.1, 'High', 'Dense');

    -- Insert health records
    INSERT INTO health_records (alpaca_id, record_type, date, description, veterinarian, next_due_date, notes) VALUES
    (sire1_id, 'vaccination', '2024-01-15', 'Annual CDT vaccination', 'Dr. Sarah Johnson', '2025-01-15', 'No adverse reactions observed'),
    (dam1_id, 'vaccination', '2024-01-15', 'Annual CDT vaccination', 'Dr. Sarah Johnson', '2025-01-15', 'Mild swelling at injection site'),
    (offspring1_id, 'checkup', '2024-02-20', 'Routine health examination', 'Dr. Mike Wilson', NULL, 'Excellent body condition, weight gain on track'),
    (offspring2_id, 'treatment', '2024-03-10', 'Treated for minor cut on leg', 'Dr. Sarah Johnson', NULL, 'Wound healing well, antibiotics administered'),
    (sire2_id, 'vaccination', '2024-01-20', 'Meningeal worm prevention', 'Dr. Mike Wilson', '2024-07-20', 'Part of routine prevention program');

    -- Insert breeding records and get their IDs
    INSERT INTO breeding_records (id, sire_id, dam_id, breeding_date, expected_due_date, actual_birth_date, notes) VALUES
    (uuid_generate_v4(), sire1_id, dam1_id, '2021-09-15', '2022-06-15', '2022-06-12', 'Successful breeding, healthy cria born')
    RETURNING id INTO breeding1_id;

    INSERT INTO breeding_records (id, sire_id, dam_id, breeding_date, expected_due_date, actual_birth_date, notes) VALUES
    (uuid_generate_v4(), sire1_id, dam1_id, '2022-07-20', '2023-04-20', '2023-04-08', 'Second successful breeding from this pair')
    RETURNING id INTO breeding2_id;

    INSERT INTO breeding_records (id, sire_id, dam_id, breeding_date, expected_due_date, actual_birth_date, notes) VALUES
    (uuid_generate_v4(), sire2_id, dam2_id, '2022-12-10', '2023-09-10', '2023-09-25', 'First breeding for this dam, excellent maternal instincts')
    RETURNING id INTO breeding3_id;

    -- Insert breeding offspring relationships
    INSERT INTO breeding_offspring (breeding_id, offspring_id) VALUES
    (breeding1_id, offspring1_id),
    (breeding2_id, offspring2_id),
    (breeding3_id, offspring3_id);

    -- Insert management activities
    INSERT INTO management_activities (id, activity_type, date, performed_by, description, notes) VALUES
    (activity1_id, 'shearing', '2024-05-15', 'John Smith', 'Annual shearing of adult alpacas', 'Excellent fiber quality this year, 8.2 lbs average'),
    (activity2_id, 'weighing', '2024-06-01', 'Mary Johnson', 'Monthly weight check for all animals', 'All animals maintaining healthy weight'),
    (activity3_id, 'feeding', '2024-07-10', 'John Smith', 'Supplemental grain feeding during dry spell', 'Increased nutrition due to poor pasture conditions'),
    (activity4_id, 'training', '2024-08-05', 'Sarah Wilson', 'Halter training for young alpacas', 'Zeus Junior and Serenity Star responding well to training');

    -- Insert activity-alpaca relationships
    INSERT INTO activity_alpacas (activity_id, alpaca_id) VALUES
    -- Shearing activity (adult alpacas only)
    (activity1_id, sire1_id), (activity1_id, dam1_id), (activity1_id, sire2_id), (activity1_id, dam2_id),
    -- Weighing activity (all alpacas)
    (activity2_id, sire1_id), (activity2_id, dam1_id), (activity2_id, sire2_id), (activity2_id, dam2_id), 
    (activity2_id, offspring1_id), (activity2_id, offspring2_id), (activity2_id, offspring3_id),
    -- Feeding activity (all alpacas)
    (activity3_id, sire1_id), (activity3_id, dam1_id), (activity3_id, sire2_id), (activity3_id, dam2_id), 
    (activity3_id, offspring1_id), (activity3_id, offspring2_id), (activity3_id, offspring3_id),
    -- Training activity (young alpacas only)
    (activity4_id, offspring1_id), (activity4_id, offspring2_id);

    RAISE NOTICE 'Test data seeded successfully';
END \$\$;
"

    echo "$seed_sql" | psql -d "$RDS_DATABASE"
    log_success "Test data seeded successfully"
}

# Verify database setup
verify_setup() {
    log_info "Verifying database setup..."
    
    # Use environment variables set by test_rds_connection
    local verify_sql="
SELECT 'Alpacas: ' || COUNT(*) FROM alpacas;
SELECT 'Health Records: ' || COUNT(*) FROM health_records;
SELECT 'Breeding Records: ' || COUNT(*) FROM breeding_records;
SELECT 'Management Activities: ' || COUNT(*) FROM management_activities;
SELECT 'Activity Associations: ' || COUNT(*) FROM activity_alpacas;
SELECT 'Breeding Offspring: ' || COUNT(*) FROM breeding_offspring;
"

    echo "$verify_sql" | psql -d "$RDS_DATABASE" -t
    log_success "Database verification completed"
}

# Show connection information
show_connection_info() {
    log_info "RDS Database Information:"
    echo "  Host: $RDS_HOST:$RDS_PORT"
    echo "  Database: $RDS_DATABASE"
    echo "  Username: $RDS_USERNAME"
    echo "  SSL: $RDS_SSL"
    echo ""
    echo "Connection command:"
    echo "  psql \"host=$RDS_HOST port=$RDS_PORT user=$RDS_USERNAME dbname=$RDS_DATABASE sslmode=require\""
    echo ""
    
    if [[ "$SEED_DATA" == "true" ]]; then
        log_info "Test data includes:"
        echo "  - 7 alpacas (4 parents, 3 offspring)"
        echo "  - 5 health records"
        echo "  - 3 breeding records with offspring relationships"
        echo "  - 4 management activities with alpaca associations"
    fi
}

# Main execution
main() {
    validate_rds_config
    check_dependencies
    test_rds_connection
    
    # Check if database exists, create if needed
    if ! check_database_exists; then
        create_target_database
    fi
    
    create_schema
    seed_test_data
    verify_setup
    
    log_success "RDS database initialization completed successfully!"
    show_connection_info
}

# Help function
show_help() {
    cat << EOF
AWS RDS PostgreSQL Database Initialization Script

Usage: $0 [OPTIONS]

This script initializes an AWS RDS PostgreSQL database following AWS best practices.
It connects using the RDS master user and creates the application schema.

ENVIRONMENT VARIABLES (Required):
    RDS_HOST        - RDS endpoint hostname
    RDS_PORT        - RDS port (default: 5432)
    RDS_DATABASE    - Target database name
    RDS_USERNAME    - RDS master username
    RDS_PASSWORD    - RDS master password
    RDS_SSL         - Enable SSL (default: true)

OPTIONS:
    --no-seed       Disable test data seeding
    --force         Force recreate existing tables
    --help          Show this help message

EXAMPLES:
    # Source RDS configuration and initialize
    source demo/alpaca-herd-aws-config.env
    $0

    # Initialize without test data
    SEED_DATA=false $0

    # Force recreate existing schema
    FORCE_RECREATE=true $0

PREREQUISITES:
    1. PostgreSQL client (psql) installed
    2. RDS instance running and accessible
    3. Security groups configured for your IP
    4. SSL certificates installed (run ./scripts/setup-rds-ssl.sh)

For SSL certificate setup, run:
    ./scripts/setup-rds-ssl.sh
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-seed)
            SEED_DATA="false"
            shift
            ;;
        --force)
            FORCE_RECREATE="true"
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main "$@"