#!/bin/bash

# Database Initialization and Seeding Script for Alpaca Herd Storage
# This script initializes the database schema and seeds test data

set -e  # Exit on any error

# Configuration - PostgreSQL Only
DB_TYPE="postgresql"
DB_NAME="${DB_NAME:-alpaca_herd}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-alpaca_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
SEED_DATA="${SEED_DATA:-true}"
FORCE_RECREATE="${FORCE_RECREATE:-false}"

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

# AWS RDS Configuration Detection
# If RDS environment variables are set, use them and switch to PostgreSQL
if [[ -n "$RDS_HOST" ]]; then
    log_info "AWS RDS environment detected, configuring for RDS..."
    DB_TYPE="postgresql"
    DB_HOST="${RDS_HOST}"
    DB_PORT="${RDS_PORT:-5432}"
    DB_NAME="${RDS_DATABASE:-alpaca_herd}"
    DB_USER="${RDS_USERNAME:-alpaca_admin}"
    DB_PASSWORD="${RDS_PASSWORD}"
    RDS_SSL="${RDS_SSL:-true}"
    RDS_USE_IAM="${RDS_USE_IAM:-false}"
    AWS_REGION="${AWS_REGION:-us-east-1}"
    
    log_info "RDS Configuration:"
    log_info "  Host: $DB_HOST"
    log_info "  Port: $DB_PORT"
    log_info "  Database: $DB_NAME"
    log_info "  User: $DB_USER"
    log_info "  SSL: $RDS_SSL"
    log_info "  IAM Auth: $RDS_USE_IAM"
    log_info "  DbPass: $DB_PASSWORD"
fi

# Help function
show_help() {
    cat << EOF
Database Initialization and Seeding Script

Usage: $0 [OPTIONS]

OPTIONS:
    -t, --type TYPE         Database type (postgresql only) [default: postgresql]
    -n, --name NAME         Database name [default: alpaca_herd.db]
    -h, --host HOST         Database host [default: localhost]
    -p, --port PORT         Database port [default: 5432]
    -u, --user USER         Database user [default: alpaca_user]
    -w, --password PASS     Database password
    -s, --seed              Enable test data seeding [default: true]
    --no-seed               Disable test data seeding
    -f, --force             Force recreate database
    --help                  Show this help message

EXAMPLES:
    # Initialize PostgreSQL database with test data
    $0

    # Initialize PostgreSQL database
    $0 -t postgresql -h localhost -u myuser -w mypass

    # Initialize without test data
    $0 --no-seed

    # Force recreate existing database
    $0 --force

ENVIRONMENT VARIABLES:
    DB_TYPE, DB_NAME, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, SEED_DATA, FORCE_RECREATE
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            DB_TYPE="$2"
            shift 2
            ;;
        -n|--name)
            DB_NAME="$2"
            shift 2
            ;;
        -h|--host)
            DB_HOST="$2"
            shift 2
            ;;
        -p|--port)
            DB_PORT="$2"
            shift 2
            ;;
        -u|--user)
            DB_USER="$2"
            shift 2
            ;;
        -w|--password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        -s|--seed)
            SEED_DATA="true"
            shift
            ;;
        --no-seed)
            SEED_DATA="false"
            shift
            ;;
        -f|--force)
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

# Validate database type
if [[ "$DB_TYPE" != "postgresql" ]]; then
    log_error "Invalid database type: $DB_TYPE. Must be 'postgresql'"
    exit 1
fi

log_info "Starting database initialization..."
log_info "Database type: $DB_TYPE"
log_info "Database name: $DB_NAME"

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    if [[ "$DB_TYPE" == "postgresql" ]]; then
        if ! command -v psql &> /dev/null; then
            log_error "psql is required but not installed"
            exit 1
        fi
    fi
    
    log_success "Dependencies check passed"
}

# Create database schema
create_schema() {
    log_info "Creating database schema..."
    
    local schema_sql="
-- Alpacas table
CREATE TABLE IF NOT EXISTS alpacas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    registration_number TEXT UNIQUE,
    birth_date DATE NOT NULL,
    gender TEXT CHECK (gender IN ('male', 'female')) NOT NULL,
    color TEXT NOT NULL,
    weight REAL,
    height REAL,
    fiber_micron_count REAL,
    fiber_staple_length REAL,
    fiber_crimp TEXT,
    fiber_density TEXT,
    sire_id TEXT REFERENCES alpacas(id),
    dam_id TEXT REFERENCES alpacas(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Health records table
CREATE TABLE IF NOT EXISTS health_records (
    id TEXT PRIMARY KEY,
    alpaca_id TEXT NOT NULL REFERENCES alpacas(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    veterinarian TEXT,
    next_due_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Breeding records table
CREATE TABLE IF NOT EXISTS breeding_records (
    id TEXT PRIMARY KEY,
    sire_id TEXT NOT NULL REFERENCES alpacas(id),
    dam_id TEXT NOT NULL REFERENCES alpacas(id),
    breeding_date DATE NOT NULL,
    expected_due_date DATE,
    actual_birth_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Breeding offspring junction table
CREATE TABLE IF NOT EXISTS breeding_offspring (
    breeding_id TEXT REFERENCES breeding_records(id) ON DELETE CASCADE,
    offspring_id TEXT REFERENCES alpacas(id) ON DELETE CASCADE,
    PRIMARY KEY (breeding_id, offspring_id)
);

-- Management activities table
CREATE TABLE IF NOT EXISTS management_activities (
    id TEXT PRIMARY KEY,
    activity_type TEXT NOT NULL,
    date DATE NOT NULL,
    performed_by TEXT NOT NULL,
    description TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Activity alpacas junction table
CREATE TABLE IF NOT EXISTS activity_alpacas (
    activity_id TEXT REFERENCES management_activities(id) ON DELETE CASCADE,
    alpaca_id TEXT REFERENCES alpacas(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, alpaca_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alpacas_registration ON alpacas(registration_number);
CREATE INDEX IF NOT EXISTS idx_alpacas_birth_date ON alpacas(birth_date);
CREATE INDEX IF NOT EXISTS idx_alpacas_parents ON alpacas(sire_id, dam_id);
CREATE INDEX IF NOT EXISTS idx_health_alpaca_date ON health_records(alpaca_id, date);
CREATE INDEX IF NOT EXISTS idx_health_due_date ON health_records(next_due_date);
CREATE INDEX IF NOT EXISTS idx_breeding_parents ON breeding_records(sire_id, dam_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON management_activities(date);
"

    execute_postgresql_schema "$schema_sql"
    
    log_success "Database schema created successfully"
}

# Execute schema for PostgreSQL
execute_postgresql_schema() {
    local schema_sql="$1"
    
    # Build connection string with RDS-specific options
    local conn_str="host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER password=$DB_PASSWORD"
    local psql_options=""
    # Set password
    #if [[ -n "$DB_PASSWORD" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
        echo "PGPASSWORD was exported"
    #fi
    
    # Add SSL options for RDS
    if [[ -n "$RDS_HOST" && "$RDS_SSL" == "true" ]]; then
        # Check if RDS SSL certificates are available
        if [[ -f "$HOME/.postgresql/rds-ca-rsa2048-g1.pem" ]]; then
            psql_options="sslmode=verify-ca $HOME/.postgresql/sslrootcert=rds-ca-rsa2048-g1.pem"
            conn_str="$conn_str sslrootcert= $HOME/.postgresql/rds-ca-rsa2048-g1.pem"
            log_info "Using SSL connection with certificate verification for RDS"
        else
            psql_options="sslmode=require"
            conn_str="$conn_str sslmode=require"
            log_info "Using SSL connection for RDS (no certificate verification)"
            log_warning "For better security, run: ./scripts/setup-rds-ssl.sh"
        fi
    fi
    
    # Handle RDS-specific database creation (RDS databases are pre-created)
    if [[ -n "$RDS_HOST" ]]; then
        log_info "Using existing RDS database: $DB_NAME"
        echo $conn_str
        # Test connection to RDS (try postgres database first, then target database)
        if ! psql $conn_str -c "SELECT 1" > /dev/null 2>&1; then
            log_error "Failed to connect to RDS database. Please check:"
            log_error "  - RDS instance is running and accessible"
            log_error "  - Security groups allow connections from your IP"
            log_error "  - Database credentials are correct"
            log_error "  - SSL configuration matches RDS requirements"
            exit 1
        fi
        
        log_success "Successfully connected to RDS database"
        
        # For RDS, we don't create/drop the database, just use the existing one
        if [[ "$FORCE_RECREATE" == "true" ]]; then
            log_warning "Force recreate requested - dropping all tables in RDS database"
            local drop_tables_sql="
DO \$\$ DECLARE
    r RECORD;
BEGIN
    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all sequences
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
    
    -- Drop all functions
    FOR r IN (SELECT proname, oidvectortypes(proargtypes) as argtypes FROM pg_proc INNER JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'public') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || '(' || r.argtypes || ') CASCADE';
    END LOOP;
END \$\$;
"
            echo "$drop_tables_sql" | psql $conn_str -d "$DB_NAME"
            log_success "Cleared existing RDS database objects"
        fi
    else
        # Standard PostgreSQL database creation for non-RDS
        if psql $conn_str -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
            if [[ "$FORCE_RECREATE" == "true" ]]; then
                log_warning "Dropping existing database: $DB_NAME"
                psql $conn_str -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\""
                psql $conn_str -d postgres -c "CREATE DATABASE \"$DB_NAME\""
            fi
        else
            log_info "Creating database: $DB_NAME"
            psql $conn_str -d postgres -c "CREATE DATABASE \"$DB_NAME\""
        fi
    fi
    
    # Execute schema with RDS-compatible modifications
    local rds_schema_sql="$schema_sql"
    
    # For RDS, enable UUID extension if not already enabled
    if [[ -n "$RDS_HOST" ]]; then
        rds_schema_sql="
-- Enable UUID extension for RDS
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";

-- Use UUID primary keys for RDS compatibility
$schema_sql"
        
        # Replace TEXT PRIMARY KEY with UUID for RDS
        rds_schema_sql=$(echo "$rds_schema_sql" | sed 's/id TEXT PRIMARY KEY/id UUID PRIMARY KEY DEFAULT uuid_generate_v4()/g')
        rds_schema_sql=$(echo "$rds_schema_sql" | sed 's/TEXT REFERENCES/UUID REFERENCES/g')
        rds_schema_sql=$(echo "$rds_schema_sql" | sed 's/DATETIME DEFAULT CURRENT_TIMESTAMP/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g')
    fi
    
    # Execute schema
    echo "$rds_schema_sql" | psql $conn_str -d "$DB_NAME"
}

# Generate UUID (compatible with both systems)
generate_uuid() {
    if [[ -n "$RDS_HOST" ]]; then
        # For RDS, we'll use PostgreSQL's uuid_generate_v4() function in SQL
        echo "uuid_generate_v4()"
    elif command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        # Fallback UUID generation
        python3 -c "import uuid; print(str(uuid.uuid4()))" 2>/dev/null || \
        node -e "console.log(require('crypto').randomUUID())" 2>/dev/null || \
        echo "$(date +%s)-$(shuf -i 1000-9999 -n 1)"
    fi
}

# Seed test data
seed_test_data() {
    if [[ "$SEED_DATA" != "true" ]]; then
        log_info "Skipping test data seeding"
        return
    fi
    
    log_info "Seeding test data..."
    
    # Generate UUIDs for test alpacas (RDS vs local handling)
    if [[ -n "$RDS_HOST" ]]; then
        # For RDS, we'll use PostgreSQL's uuid_generate_v4() directly in SQL
        local sire1_id="uuid_generate_v4()"
        local dam1_id="uuid_generate_v4()"
        local sire2_id="uuid_generate_v4()"
        local dam2_id="uuid_generate_v4()"
        local offspring1_id="uuid_generate_v4()"
        local offspring2_id="uuid_generate_v4()"
        local offspring3_id="uuid_generate_v4()"
    else
        # For local databases, generate UUIDs in shell
        local sire1_id=$(generate_uuid)
        local dam1_id=$(generate_uuid)
        local sire2_id=$(generate_uuid)
        local dam2_id=$(generate_uuid)
        local offspring1_id=$(generate_uuid)
        local offspring2_id=$(generate_uuid)
        local offspring3_id=$(generate_uuid)
    fi
    
    # Create RDS-compatible seed data
    if [[ -n "$RDS_HOST" ]]; then
        # For RDS with UUID primary keys, use a different approach
        local seed_sql="
-- Create temporary variables for RDS seeding
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

    -- Insert breeding records
    INSERT INTO breeding_records (sire_id, dam_id, breeding_date, expected_due_date, actual_birth_date, notes) VALUES
    (sire1_id, dam1_id, '2021-09-15', '2022-06-15', '2022-06-12', 'Successful breeding, healthy cria born'),
    (sire1_id, dam1_id, '2022-07-20', '2023-04-20', '2023-04-08', 'Second successful breeding from this pair'),
    (sire2_id, dam2_id, '2022-12-10', '2023-09-10', '2023-09-25', 'First breeding for this dam, excellent maternal instincts');

    -- Insert breeding offspring relationships
    INSERT INTO breeding_offspring (breeding_id, offspring_id) 
    SELECT br.id, offspring1_id FROM breeding_records br WHERE br.sire_id = sire1_id AND br.dam_id = dam1_id AND br.breeding_date = '2021-09-15';

    INSERT INTO breeding_offspring (breeding_id, offspring_id) 
    SELECT br.id, offspring2_id FROM breeding_records br WHERE br.sire_id = sire1_id AND br.dam_id = dam1_id AND br.breeding_date = '2022-07-20';

    INSERT INTO breeding_offspring (breeding_id, offspring_id) 
    SELECT br.id, offspring3_id FROM breeding_records br WHERE br.sire_id = sire2_id AND br.dam_id = dam2_id AND br.breeding_date = '2022-12-10';

    -- Insert management activities
    INSERT INTO management_activities (id, activity_type, date, performed_by, description, notes) VALUES
    (activity1_id, 'shearing', '2024-05-15', 'John Smith', 'Annual shearing of adult alpacas', 'Excellent fiber quality this year, 8.2 lbs average'),
    (activity2_id, 'weighing', '2024-06-01', 'Mary Johnson', 'Monthly weight check for all animals', 'All animals maintaining healthy weight'),
    (activity3_id, 'feeding', '2024-07-10', 'John Smith', 'Supplemental grain feeding during dry spell', 'Increased nutrition due to poor pasture conditions'),
    (activity4_id, 'training', '2024-08-05', 'Sarah Wilson', 'Halter training for young alpacas', 'Zeus Junior and Serenity Star responding well to training');

    -- Insert activity-alpaca relationships
    INSERT INTO activity_alpacas (activity_id, alpaca_id) VALUES
    (activity1_id, sire1_id), (activity1_id, dam1_id), (activity1_id, sire2_id), (activity1_id, dam2_id),
    (activity2_id, sire1_id), (activity2_id, dam1_id), (activity2_id, sire2_id), (activity2_id, dam2_id), (activity2_id, offspring1_id), (activity2_id, offspring2_id), (activity2_id, offspring3_id),
    (activity3_id, sire1_id), (activity3_id, dam1_id), (activity3_id, sire2_id), (activity3_id, dam2_id), (activity3_id, offspring1_id), (activity3_id, offspring2_id), (activity3_id, offspring3_id),
    (activity4_id, offspring1_id), (activity4_id, offspring2_id);
END \$\$;
"
    else
        # Original seed data for SQLite/local PostgreSQL
        local seed_sql="
-- Insert parent alpacas
INSERT INTO alpacas (id, name, registration_number, birth_date, gender, color, weight, height, fiber_micron_count, fiber_staple_length, fiber_crimp, fiber_density) VALUES
('$sire1_id', 'Thunder Mountain Zeus', 'AMR123456', '2018-05-15', 'male', 'Dark Brown', 185.5, 36.2, 22.5, 4.2, 'High', 'Dense'),
('$dam1_id', 'Moonbeam Serenity', 'AMR123457', '2019-03-22', 'female', 'Light Fawn', 145.8, 34.1, 20.8, 4.8, 'Medium', 'Medium'),
('$sire2_id', 'Storm Cloud Ranger', 'AMR123458', '2017-08-10', 'male', 'Medium Brown', 195.2, 37.5, 23.1, 4.0, 'High', 'Dense'),
('$dam2_id', 'Sunrise Melody', 'AMR123459', '2020-01-18', 'female', 'White', 138.4, 33.8, 19.5, 5.1, 'Low', 'Fine');

-- Insert offspring alpacas
INSERT INTO alpacas (id, name, registration_number, birth_date, gender, color, weight, height, sire_id, dam_id, fiber_micron_count, fiber_staple_length, fiber_crimp, fiber_density) VALUES
('$offspring1_id', 'Zeus Junior Champion', 'AMR123460', '2022-06-12', 'male', 'Medium Brown', 95.3, 28.5, '$sire1_id', '$dam1_id', 21.2, 4.5, 'Medium', 'Medium'),
('$offspring2_id', 'Serenity Star', 'AMR123461', '2023-04-08', 'female', 'Light Fawn', 78.2, 26.1, '$sire1_id', '$dam1_id', 20.1, 4.9, 'Medium', 'Fine'),
('$offspring3_id', 'Ranger Storm', 'AMR123462', '2023-09-25', 'male', 'Dark Brown', 82.7, 27.3, '$sire2_id', '$dam2_id', 22.8, 4.1, 'High', 'Dense');

-- Insert health records
INSERT INTO health_records (id, alpaca_id, record_type, date, description, veterinarian, next_due_date, notes) VALUES
('$(generate_uuid)', '$sire1_id', 'vaccination', '2024-01-15', 'Annual CDT vaccination', 'Dr. Sarah Johnson', '2025-01-15', 'No adverse reactions observed'),
('$(generate_uuid)', '$dam1_id', 'vaccination', '2024-01-15', 'Annual CDT vaccination', 'Dr. Sarah Johnson', '2025-01-15', 'Mild swelling at injection site'),
('$(generate_uuid)', '$offspring1_id', 'checkup', '2024-02-20', 'Routine health examination', 'Dr. Mike Wilson', NULL, 'Excellent body condition, weight gain on track'),
('$(generate_uuid)', '$offspring2_id', 'treatment', '2024-03-10', 'Treated for minor cut on leg', 'Dr. Sarah Johnson', NULL, 'Wound healing well, antibiotics administered'),
('$(generate_uuid)', '$sire2_id', 'vaccination', '2024-01-20', 'Meningeal worm prevention', 'Dr. Mike Wilson', '2024-07-20', 'Part of routine prevention program');

-- Insert breeding records
INSERT INTO breeding_records (id, sire_id, dam_id, breeding_date, expected_due_date, actual_birth_date, notes) VALUES
('$(generate_uuid)', '$sire1_id', '$dam1_id', '2021-09-15', '2022-06-15', '2022-06-12', 'Successful breeding, healthy cria born'),
('$(generate_uuid)', '$sire1_id', '$dam1_id', '2022-07-20', '2023-04-20', '2023-04-08', 'Second successful breeding from this pair'),
('$(generate_uuid)', '$sire2_id', '$dam2_id', '2022-12-10', '2023-09-10', '2023-09-25', 'First breeding for this dam, excellent maternal instincts');

-- Insert breeding offspring relationships
INSERT INTO breeding_offspring (breeding_id, offspring_id) 
SELECT br.id, '$offspring1_id' FROM breeding_records br WHERE br.sire_id = '$sire1_id' AND br.dam_id = '$dam1_id' AND br.breeding_date = '2021-09-15';

INSERT INTO breeding_offspring (breeding_id, offspring_id) 
SELECT br.id, '$offspring2_id' FROM breeding_records br WHERE br.sire_id = '$sire1_id' AND br.dam_id = '$dam1_id' AND br.breeding_date = '2022-07-20';

INSERT INTO breeding_offspring (breeding_id, offspring_id) 
SELECT br.id, '$offspring3_id' FROM breeding_records br WHERE br.sire_id = '$sire2_id' AND br.dam_id = '$dam2_id' AND br.breeding_date = '2022-12-10';

-- Insert management activities
INSERT INTO management_activities (id, activity_type, date, performed_by, description, notes) VALUES
('$(generate_uuid)', 'shearing', '2024-05-15', 'John Smith', 'Annual shearing of adult alpacas', 'Excellent fiber quality this year, 8.2 lbs average'),
('$(generate_uuid)', 'weighing', '2024-06-01', 'Mary Johnson', 'Monthly weight check for all animals', 'All animals maintaining healthy weight'),
('$(generate_uuid)', 'feeding', '2024-07-10', 'John Smith', 'Supplemental grain feeding during dry spell', 'Increased nutrition due to poor pasture conditions'),
('$(generate_uuid)', 'training', '2024-08-05', 'Sarah Wilson', 'Halter training for young alpacas', 'Zeus Junior and Serenity Star responding well to training');

-- Insert activity-alpaca relationships
INSERT INTO activity_alpacas (activity_id, alpaca_id)
SELECT ma.id, '$sire1_id' FROM management_activities ma WHERE ma.description LIKE '%shearing%';

INSERT INTO activity_alpacas (activity_id, alpaca_id)
SELECT ma.id, '$dam1_id' FROM management_activities ma WHERE ma.description LIKE '%shearing%';

INSERT INTO activity_alpacas (activity_id, alpaca_id)
SELECT ma.id, '$sire2_id' FROM management_activities ma WHERE ma.description LIKE '%shearing%';

INSERT INTO activity_alpacas (activity_id, alpaca_id)
SELECT ma.id, '$dam2_id' FROM management_activities ma WHERE ma.description LIKE '%shearing%';

-- Add all alpacas to weighing activity
INSERT INTO activity_alpacas (activity_id, alpaca_id)
SELECT ma.id, a.id FROM management_activities ma, alpacas a WHERE ma.description LIKE '%weight check%';

-- Add all alpacas to feeding activity
INSERT INTO activity_alpacas (activity_id, alpaca_id)
SELECT ma.id, a.id FROM management_activities ma, alpacas a WHERE ma.description LIKE '%grain feeding%';

-- Add young alpacas to training activity
INSERT INTO activity_alpacas (activity_id, alpaca_id)
SELECT ma.id, '$offspring1_id' FROM management_activities ma WHERE ma.description LIKE '%training%';

INSERT INTO activity_alpacas (activity_id, alpaca_id)
SELECT ma.id, '$offspring2_id' FROM management_activities ma WHERE ma.description LIKE '%training%';
"
    fi

    if [[ "$DB_TYPE" == "postgresql" ]]; then
        local conn_str="host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME"
        if [[ -n "$DB_PASSWORD" ]]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        
        # Add SSL options for RDS
        if [[ -n "$RDS_HOST" && "$RDS_SSL" == "true" ]]; then
            if [[ -f "$HOME/.postgresql/root.crt" ]]; then
                conn_str="$conn_str sslmode=verify-ca sslrootcert=$HOME/.postgresql/root.crt"
            else
                conn_str="$conn_str sslmode=require"
            fi
        fi
        
        echo "$seed_sql" | psql $conn_str
    fi
    
    log_success "Test data seeded successfully"
}

# Verify database setup
verify_setup() {
    log_info "Verifying database setup..."
    
    local verify_sql="
SELECT 'Alpacas: ' || COUNT(*) FROM alpacas;
SELECT 'Health Records: ' || COUNT(*) FROM health_records;
SELECT 'Breeding Records: ' || COUNT(*) FROM breeding_records;
SELECT 'Management Activities: ' || COUNT(*) FROM management_activities;
"

    if [[ "$DB_TYPE" == "postgresql" ]]; then
        local conn_str="host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME"
        if [[ -n "$DB_PASSWORD" ]]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        
        # Add SSL options for RDS
        if [[ -n "$RDS_HOST" && "$RDS_SSL" == "true" ]]; then
            if [[ -f "$HOME/.postgresql/root.crt" ]]; then
                conn_str="$conn_str sslmode=verify-ca sslrootcert=$HOME/.postgresql/root.crt"
            else
                conn_str="$conn_str sslmode=require"
            fi
        fi
        
        echo "$verify_sql" | psql $conn_str -t
    fi
    
    log_success "Database verification completed"
}

# Main execution
main() {
    log_info "=== Alpaca Herd Database Initialization ==="
    
    check_dependencies
    create_schema
    seed_test_data
    verify_setup
    
    log_success "Database initialization completed successfully!"
    
    if [[ "$DB_TYPE" == "sqlite" ]]; then
        log_info "SQLite database created at: $DB_NAME"
        log_info "You can connect using: sqlite3 $DB_NAME"
    elif [[ "$DB_TYPE" == "postgresql" ]]; then
        if [[ -n "$RDS_HOST" ]]; then
            log_info "AWS RDS PostgreSQL database '$DB_NAME' initialized on $DB_HOST:$DB_PORT"
            log_info "You can connect using: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
            if [[ "$RDS_SSL" == "true" ]]; then
                log_info "SSL connection required for RDS"
            fi
            log_info "AWS Region: $AWS_REGION"
            if [[ -n "$S3_BACKUP_BUCKET" ]]; then
                log_info "S3 Backup Bucket: $S3_BACKUP_BUCKET"
            fi
        else
            log_info "PostgreSQL database '$DB_NAME' created on $DB_HOST:$DB_PORT"
            log_info "You can connect using: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
        fi
    fi
    
    if [[ "$SEED_DATA" == "true" ]]; then
        log_info "Test data includes:"
        log_info "  - 7 alpacas (4 parents, 3 offspring)"
        log_info "  - 5 health records"
        log_info "  - 3 breeding records with offspring relationships"
        log_info "  - 4 management activities with alpaca associations"
    fi
}

# Run main function
main "$@"