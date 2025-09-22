#!/bin/bash

# Database Utilities for Alpaca Herd Storage
# Companion script for database management tasks

set -e

# Configuration
DB_TYPE="${DB_TYPE:-sqlite}"
DB_NAME="${DB_NAME:-alpaca_herd.db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-alpaca_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

# AWS RDS Configuration Detection
if [[ -n "$RDS_HOST" ]]; then
    DB_TYPE="postgresql"
    DB_HOST="${RDS_HOST}"
    DB_PORT="${RDS_PORT:-5432}"
    DB_NAME="${RDS_DATABASE:-alpaca_herd}"
    DB_USER="${RDS_USERNAME:-alpaca_admin}"
    DB_PASSWORD="${RDS_PASSWORD}"
    RDS_SSL="${RDS_SSL:-true}"
    RDS_USE_IAM="${RDS_USE_IAM:-false}"
    AWS_REGION="${AWS_REGION:-us-east-1}"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

show_help() {
    cat << EOF
Database Utilities for Alpaca Herd Storage

Usage: $0 COMMAND [OPTIONS]

COMMANDS:
    init                Initialize database with schema and test data
    reset               Reset database (drop and recreate)
    backup              Create database backup
    restore FILE        Restore database from backup
    query "SQL"         Execute SQL query
    shell               Open database shell
    status              Show database status and record counts
    clean               Remove test data only
    export              Export data to JSON
    import FILE         Import data from JSON

OPTIONS:
    -t, --type TYPE     Database type (sqlite|postgresql) [default: sqlite]
    -n, --name NAME     Database name [default: alpaca_herd.db]
    -h, --host HOST     Database host [default: localhost]
    -p, --port PORT     Database port [default: 5432]
    -u, --user USER     Database user [default: alpaca_user]
    -w, --password PASS Database password
    --help              Show this help message

EXAMPLES:
    # Initialize database
    $0 init

    # Reset PostgreSQL database
    $0 reset -t postgresql -h localhost -u myuser

    # Check database status
    $0 status

    # Create backup
    $0 backup

    # Open database shell
    $0 shell

    # Execute custom query
    $0 query "SELECT COUNT(*) FROM alpacas WHERE gender = 'male'"
EOF
}

# Parse command line arguments
COMMAND=""
SQL_QUERY=""
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        init|reset|backup|shell|status|clean|export)
            COMMAND="$1"
            shift
            ;;
        restore|import)
            COMMAND="$1"
            BACKUP_FILE="$2"
            shift 2
            ;;
        query)
            COMMAND="$1"
            SQL_QUERY="$2"
            shift 2
            ;;
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
        --help)
            show_help
            exit 0
            ;;
        *)
            if [[ -z "$COMMAND" ]]; then
                COMMAND="$1"
            else
                log_error "Unknown option: $1"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

if [[ -z "$COMMAND" ]]; then
    log_error "No command specified"
    show_help
    exit 1
fi

# Build connection parameters
build_connection() {
    if [[ "$DB_TYPE" == "sqlite" ]]; then
        echo "$DB_NAME"
    elif [[ "$DB_TYPE" == "postgresql" ]]; then
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
        
        echo "$conn_str"
    fi
}

# Execute SQL command
execute_sql() {
    local sql="$1"
    local conn=$(build_connection)
    
    if [[ "$DB_TYPE" == "sqlite" ]]; then
        echo "$sql" | sqlite3 "$conn"
    elif [[ "$DB_TYPE" == "postgresql" ]]; then
        echo "$sql" | psql $conn
    fi
}

# Initialize database
cmd_init() {
    log_info "Initializing database..."
    ./scripts/init-database.sh -t "$DB_TYPE" -n "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -u "$DB_USER" -w "$DB_PASSWORD"
}

# Reset database
cmd_reset() {
    log_warning "This will completely reset the database. All data will be lost!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Resetting database..."
        ./scripts/init-database.sh -t "$DB_TYPE" -n "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -u "$DB_USER" -w "$DB_PASSWORD" --force
    else
        log_info "Reset cancelled"
    fi
}

# Create backup
cmd_backup() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="backup_${DB_NAME}_${timestamp}"
    
    log_info "Creating backup..."
    
    if [[ "$DB_TYPE" == "sqlite" ]]; then
        backup_file="${backup_file}.db"
        cp "$DB_NAME" "$backup_file"
        log_success "Backup created: $backup_file"
    elif [[ "$DB_TYPE" == "postgresql" ]]; then
        backup_file="${backup_file}.sql"
        local conn_str="host=$DB_HOST port=$DB_PORT user=$DB_USER"
        if [[ -n "$DB_PASSWORD" ]]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        
        # Add SSL options for RDS
        local pg_dump_options=""
        if [[ -n "$RDS_HOST" && "$RDS_SSL" == "true" ]]; then
            pg_dump_options="--no-password"
            export PGSSLMODE=require
        fi
        
        pg_dump $conn_str $pg_dump_options "$DB_NAME" > "$backup_file"
        log_success "Backup created: $backup_file"
    fi
}

# Restore from backup
cmd_restore() {
    if [[ -z "$BACKUP_FILE" ]]; then
        log_error "Backup file not specified"
        exit 1
    fi
    
    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log_warning "This will restore the database from backup. Current data will be lost!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restoring from backup: $BACKUP_FILE"
        
        if [[ "$DB_TYPE" == "sqlite" ]]; then
            cp "$BACKUP_FILE" "$DB_NAME"
        elif [[ "$DB_TYPE" == "postgresql" ]]; then
            local conn_str="host=$DB_HOST port=$DB_PORT user=$DB_USER"
            if [[ -n "$DB_PASSWORD" ]]; then
                export PGPASSWORD="$DB_PASSWORD"
            fi
            
            # Add SSL options for RDS
            if [[ -n "$RDS_HOST" && "$RDS_SSL" == "true" ]]; then
                export PGSSLMODE=require
            fi
            
            if [[ -n "$RDS_HOST" ]]; then
                # For RDS, we can't drop/create the database, so we clear tables instead
                log_warning "RDS detected - clearing existing tables instead of dropping database"
                local clear_sql="
DO \$\$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END \$\$;
"
                echo "$clear_sql" | psql $conn_str -d "$DB_NAME"
                psql $conn_str -d "$DB_NAME" < "$BACKUP_FILE"
            else
                psql $conn_str -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\""
                psql $conn_str -d postgres -c "CREATE DATABASE \"$DB_NAME\""
                psql $conn_str -d "$DB_NAME" < "$BACKUP_FILE"
            fi
        fi
        
        log_success "Database restored successfully"
    else
        log_info "Restore cancelled"
    fi
}

# Execute query
cmd_query() {
    if [[ -z "$SQL_QUERY" ]]; then
        log_error "SQL query not specified"
        exit 1
    fi
    
    log_info "Executing query: $SQL_QUERY"
    execute_sql "$SQL_QUERY"
}

# Open database shell
cmd_shell() {
    log_info "Opening database shell..."
    
    if [[ "$DB_TYPE" == "sqlite" ]]; then
        sqlite3 "$DB_NAME"
    elif [[ "$DB_TYPE" == "postgresql" ]]; then
        local conn_str="host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME"
        if [[ -n "$DB_PASSWORD" ]]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        
        # Add SSL options for RDS
        if [[ -n "$RDS_HOST" && "$RDS_SSL" == "true" ]]; then
            conn_str="$conn_str sslmode=require"
            export PGSSLMODE=require
        fi
        
        psql $conn_str
    fi
}

# Show database status
cmd_status() {
    log_info "Database Status:"
    echo "=================="
    echo "Type: $DB_TYPE"
    echo "Name: $DB_NAME"
    
    if [[ "$DB_TYPE" == "sqlite" ]]; then
        if [[ -f "$DB_NAME" ]]; then
            echo "File: $DB_NAME"
            echo "Size: $(du -h "$DB_NAME" | cut -f1)"
        else
            echo "Status: Database file not found"
            return
        fi
    elif [[ "$DB_TYPE" == "postgresql" ]]; then
        echo "Host: $DB_HOST:$DB_PORT"
        echo "User: $DB_USER"
        if [[ -n "$RDS_HOST" ]]; then
            echo "Type: AWS RDS"
            echo "SSL: $RDS_SSL"
            echo "IAM Auth: $RDS_USE_IAM"
            echo "Region: $AWS_REGION"
            if [[ -n "$S3_BACKUP_BUCKET" ]]; then
                echo "S3 Backup Bucket: $S3_BACKUP_BUCKET"
            fi
        else
            echo "Type: Standard PostgreSQL"
        fi
    fi
    
    echo ""
    log_info "Record Counts:"
    
    local status_sql="
SELECT 'Alpacas: ' || COUNT(*) FROM alpacas;
SELECT 'Health Records: ' || COUNT(*) FROM health_records;
SELECT 'Breeding Records: ' || COUNT(*) FROM breeding_records;
SELECT 'Management Activities: ' || COUNT(*) FROM management_activities;
SELECT 'Activity Associations: ' || COUNT(*) FROM activity_alpacas;
SELECT 'Breeding Offspring: ' || COUNT(*) FROM breeding_offspring;
"
    
    execute_sql "$status_sql"
    
    echo ""
    log_info "Recent Activity:"
    local recent_sql="
SELECT 'Latest Health Record: ' || date FROM health_records ORDER BY date DESC LIMIT 1;
SELECT 'Latest Activity: ' || date FROM management_activities ORDER BY date DESC LIMIT 1;
"
    
    execute_sql "$recent_sql"
}

# Clean test data
cmd_clean() {
    log_warning "This will remove all test data from the database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning test data..."
        
        local clean_sql="
DELETE FROM activity_alpacas;
DELETE FROM breeding_offspring;
DELETE FROM management_activities;
DELETE FROM breeding_records;
DELETE FROM health_records;
DELETE FROM alpacas;
"
        
        execute_sql "$clean_sql"
        log_success "Test data cleaned successfully"
    else
        log_info "Clean cancelled"
    fi
}

# Export data to JSON
cmd_export() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local export_file="export_${DB_NAME}_${timestamp}.json"
    
    log_info "Exporting data to JSON..."
    
    # This is a simplified export - in a real implementation, you'd want proper JSON formatting
    local export_sql="
.mode json
.output $export_file
SELECT 'alpacas' as table_name, * FROM alpacas;
SELECT 'health_records' as table_name, * FROM health_records;
SELECT 'breeding_records' as table_name, * FROM breeding_records;
SELECT 'management_activities' as table_name, * FROM management_activities;
.output stdout
"
    
    if [[ "$DB_TYPE" == "sqlite" ]]; then
        echo "$export_sql" | sqlite3 "$DB_NAME"
        log_success "Data exported to: $export_file"
    else
        log_warning "JSON export currently only supported for SQLite"
    fi
}

# Import data from JSON
cmd_import() {
    if [[ -z "$BACKUP_FILE" ]]; then
        log_error "Import file not specified"
        exit 1
    fi
    
    log_warning "JSON import not yet implemented"
    log_info "Use 'restore' command for SQL backups"
}

# Execute command
case $COMMAND in
    init)
        cmd_init
        ;;
    reset)
        cmd_reset
        ;;
    backup)
        cmd_backup
        ;;
    restore)
        cmd_restore
        ;;
    query)
        cmd_query
        ;;
    shell)
        cmd_shell
        ;;
    status)
        cmd_status
        ;;
    clean)
        cmd_clean
        ;;
    export)
        cmd_export
        ;;
    import)
        cmd_import
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac