# Scripts Directory

This directory contains scripts for managing the Alpaca Herd Storage database and AWS SAM deployment.

## Scripts

**Platform Compatibility**: All scripts are optimized for macOS (darwin) and use BSD-compatible date commands.

### AWS SAM Deployment Scripts

#### `test-env.sh`
Tests and validates environment variable configuration before deployment.

**Features:**
- Checks all required RDS environment variables
- Validates AWS CLI configuration and credentials
- Provides clear feedback on missing variables
- Shows example setup commands
- Helps troubleshoot deployment issues

**Usage:**
```bash
# Test environment setup
./scripts/test-env.sh
```

#### `deploy.sh`
Deploys the application to AWS using SAM (Serverless Application Model).

**Features:**
- Validates AWS credentials and configuration
- Builds TypeScript code and packages Lambda function
- Deploys CloudFormation stack with API Gateway and Lambda
- Outputs API Gateway endpoint URL
- Comprehensive error handling and rollback support
- Environment-specific cost optimization parameters
- Enhanced environment variable validation

**Usage:**
```bash
# Test environment first
./scripts/test-env.sh

# Deploy with default configuration
./scripts/deploy.sh

# Deploy to specific environment
./scripts/deploy.sh --stage prod

# Deploy to different region
./scripts/deploy.sh --region us-west-2

# Deploy without confirmation prompts
./scripts/deploy.sh --force

# Show help
./scripts/deploy.sh --help
```

#### `destroy.sh`
Removes all AWS resources created by the SAM deployment.

**Features:**
- Removes CloudFormation stack and all associated resources
- Confirmation prompts for safety
- Cleanup validation to ensure complete resource removal
- Handles stack dependencies and cleanup order

**Usage:**
```bash
# Destroy default stack
./scripts/destroy.sh

# Destroy specific environment
./scripts/destroy.sh staging

# Force destroy without confirmation
./scripts/destroy.sh --force
```

#### `status.sh`
Shows deployment status and stack information.

**Features:**
- Displays CloudFormation stack status and resources
- Shows API Gateway endpoint URL
- Lists recent CloudWatch logs (last 10 minutes)
- Performs basic API health check
- Provides quick access to other management commands

**Usage:**
```bash
# Show status for default stack
./scripts/status.sh

# Show status for specific stack and region
./scripts/status.sh my-stack us-west-2

# Show help
./scripts/status.sh --help
```

#### `logs.sh`
Views CloudWatch logs with filtering and search capabilities.

**Features:**
- Real-time log streaming with `--follow` option
- Filter by log level (info, warn, error, debug)
- Search logs with pattern matching
- Time-based filtering (last N minutes, specific date ranges)
- Colored output for better readability
- Log statistics and event counts

**Usage:**
```bash
# Show recent logs (last hour)
./scripts/logs.sh

# Follow logs in real-time
./scripts/logs.sh --follow

# Show only error logs
./scripts/logs.sh --level error

# Search for specific pattern
./scripts/logs.sh --grep "database"

# Show logs from last 30 minutes
./scripts/logs.sh --tail 30

# Show logs since specific time
./scripts/logs.sh --since "2024-01-01 10:00:00"

# Follow error logs only
./scripts/logs.sh --follow --level error

# Show help
./scripts/logs.sh --help
```

#### `debug.sh`
Advanced debugging and monitoring tool with multiple modes.

**Features:**
- Interactive debugging menu with multiple options
- Real-time log streaming with enhanced formatting
- Error-only monitoring mode
- Performance metrics and Lambda configuration display
- Continuous health monitoring with success rate tracking
- API endpoint testing with response times
- Log search and analysis tools

**Modes:**
- `interactive` - Interactive menu (default)
- `stream` - Stream all logs in real-time
- `errors` - Monitor errors only
- `performance` - Show performance metrics and monitoring
- `health` - Continuous API health monitoring

**Usage:**
```bash
# Interactive debugging menu
./scripts/debug.sh

# Stream all logs with enhanced formatting
./scripts/debug.sh stream

# Monitor errors only
./scripts/debug.sh errors

# Performance monitoring
./scripts/debug.sh performance

# Health monitoring
./scripts/debug.sh health

# Custom stack and region
./scripts/debug.sh --stack my-stack --region us-west-2 stream

# Show help
./scripts/debug.sh --help
```

#### `test-local.sh`
Comprehensive testing script for SAM local development environment.

**Features:**
- Automated SAM local startup and management
- Health check validation and database connectivity tests
- Complete API endpoint testing with CRUD operations
- Performance testing and response time validation
- Error handling verification (404, 400 responses)
- Automatic test data cleanup
- Detailed test reporting with pass/fail counts

**Usage:**
```bash
# Run all tests (starts SAM local automatically)
./scripts/test-local.sh

# Run tests on custom port
./scripts/test-local.sh --port 8080

# Run only health checks
./scripts/test-local.sh --health-only

# Run only API endpoint tests
./scripts/test-local.sh --api-only

# Run tests assuming SAM local is already running
./scripts/test-local.sh --no-start

# Verbose output with request/response details
./scripts/test-local.sh --verbose

# Custom timeout for requests
./scripts/test-local.sh --timeout 60

# Show help
./scripts/test-local.sh --help
```

#### `test-deployed.sh`
Comprehensive testing script for deployed AWS API Gateway endpoints.

**Features:**
- Automatic API Gateway URL discovery from CloudFormation stack
- CloudFormation stack status verification
- Health check validation and Lambda performance testing
- Complete API endpoint testing with CRUD operations
- Load testing with concurrent requests
- Cold start and warm Lambda performance measurement
- Error handling verification and response validation
- Automatic test data cleanup

**Usage:**
```bash
# Test deployed API (auto-discover endpoint)
./scripts/test-deployed.sh

# Test specific stack and region
./scripts/test-deployed.sh --stack my-stack --region us-west-2

# Test with specific API URL
./scripts/test-deployed.sh --url https://abc123.execute-api.us-east-1.amazonaws.com/Prod/api/v1

# Run only health checks
./scripts/test-deployed.sh --health-only

# Run only API endpoint tests
./scripts/test-deployed.sh --api-only

# Run load testing with concurrent requests
./scripts/test-deployed.sh --load-test

# Verbose output with request/response details
./scripts/test-deployed.sh --verbose

# Don't clean up test data after running
./scripts/test-deployed.sh --no-cleanup

# Custom timeout for requests
./scripts/test-deployed.sh --timeout 60

# Show help
./scripts/test-deployed.sh --help
```

#### `api-examples.sh`
Manual API testing examples with curl commands for all endpoints.

**Features:**
- Complete curl command examples for all API endpoints
- Support for both local and deployed API testing
- Organized by endpoint categories (alpacas, health, breeding, activities)
- Interactive mode to execute commands and see responses
- Template commands with placeholder replacement guidance

**Usage:**
```bash
# Show all API examples
./scripts/api-examples.sh

# Show examples for deployed API
./scripts/api-examples.sh --url https://abc123.execute-api.us-east-1.amazonaws.com/Prod/api/v1

# Show only alpaca endpoint examples
./scripts/api-examples.sh alpacas

# Show only health records examples
./scripts/api-examples.sh health

# Execute commands and see responses (interactive mode)
./scripts/api-examples.sh --verbose

# Execute specific category with responses
./scripts/api-examples.sh --verbose alpacas

# Show available categories
./scripts/api-examples.sh list

# Show help
./scripts/api-examples.sh --help
```

#### `security-audit.sh`
Comprehensive security audit and validation tool for deployed AWS resources.

**Features:**
- IAM role permissions audit with least-privilege validation
- Lambda function security configuration analysis
- API Gateway security settings review
- CloudWatch logs configuration audit
- Security recommendations and best practices
- Automated security report generation
- Compliance checking for cost optimization settings

**Usage:**
```bash
# Run interactive security audit
./scripts/security-audit.sh

# Generate security report only
./scripts/security-audit.sh --report

# Show help
./scripts/security-audit.sh --help
```

**Security Checks:**
- Validates least-privilege IAM policies
- Checks for wildcard permissions (security risk)
- Audits Lambda environment variables (redacts sensitive data)
- Reviews API Gateway throttling and CORS configuration
- Analyzes CloudWatch log retention policies
- Provides production security recommendations

#### `cost-monitor.sh`
AWS cost monitoring and optimization analysis tool.

**Features:**
- Lambda function cost analysis with usage metrics
- API Gateway cost tracking and projections
- CloudWatch logs cost estimation
- Monthly cost projections based on current usage
- Cost optimization recommendations
- Automated cost alert setup with SNS notifications
- Performance metrics correlation with costs

**Usage:**
```bash
# Run interactive cost monitoring
./scripts/cost-monitor.sh

# Generate cost report only
./scripts/cost-monitor.sh --report

# Set up cost alerts only
./scripts/cost-monitor.sh --alerts

# Show help
./scripts/cost-monitor.sh --help
```

**Cost Analysis:**
- Calculates Lambda costs based on invocations, memory, and duration
- Estimates API Gateway costs from request volumes
- Projects monthly costs from weekly usage patterns
- Identifies cost optimization opportunities
- Provides environment-specific cost breakdowns

### Database Management Scripts

#### `init-database.sh`
Initializes the database schema and optionally seeds test data.

**Features:**
- Supports both SQLite and PostgreSQL
- Creates complete database schema with indexes
- Seeds realistic test data for development
- Force recreate option for clean setup
- Comprehensive error handling and logging

**Usage:**
```bash
# Initialize SQLite database with test data (default)
./scripts/init-database.sh

# Initialize PostgreSQL database
./scripts/init-database.sh -t postgresql -h localhost -u myuser -w mypass

# Initialize without test data
./scripts/init-database.sh --no-seed

# Force recreate existing database
./scripts/init-database.sh --force

# Show help
./scripts/init-database.sh --help
```

### `db-utils.sh`
Comprehensive database management utilities.

**Features:**
- Database initialization and reset
- Backup and restore operations
- Interactive database shell
- Status monitoring and record counts
- Custom SQL query execution
- Test data management

**Usage:**
```bash
# Initialize database
./scripts/db-utils.sh init

# Check database status
./scripts/db-utils.sh status

# Create backup
./scripts/db-utils.sh backup

# Open database shell
./scripts/db-utils.sh shell

# Execute custom query
./scripts/db-utils.sh query "SELECT COUNT(*) FROM alpacas WHERE gender = 'male'"

# Reset database (with confirmation)
./scripts/db-utils.sh reset

# Show help
./scripts/db-utils.sh --help
```

## Test Data

When seeding is enabled, the scripts create:

### Alpacas (7 total)
- **4 Parent Alpacas**: 2 sires and 2 dams with complete registration and fiber quality data
- **3 Offspring**: Children with proper parent relationships and age-appropriate data

### Health Records (5 total)
- Vaccinations with due dates
- Routine checkups
- Medical treatments
- Veterinarian assignments

### Breeding Records (3 total)
- Parent-offspring relationships
- Breeding and birth dates
- Breeding notes and outcomes

### Management Activities (4 total)
- Shearing activities
- Weight monitoring
- Feeding programs
- Training sessions
- Proper alpaca associations

## Configuration

Both scripts support configuration via environment variables or command-line options:

```bash
# Environment variables
export DB_TYPE=postgresql
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=alpaca_user
export DB_PASSWORD=secure_password
export DB_NAME=alpaca_herd_prod

# Then run scripts
./scripts/init-database.sh
```

### AWS RDS Integration

The scripts automatically detect AWS RDS environment variables and configure themselves accordingly:

```bash
# Source RDS configuration (generated by create-rds-infrastructure.sh)
source alpaca-herd-aws-config.env

# Initialize RDS database (automatically detected)
./scripts/init-database.sh

# Or use db-utils with RDS
./scripts/db-utils.sh status
```

**RDS Environment Variables:**
- `RDS_HOST` - RDS endpoint (triggers RDS mode)
- `RDS_PORT` - Database port (default: 5432)
- `RDS_DATABASE` - Database name
- `RDS_USERNAME` - Database username
- `RDS_PASSWORD` - Database password
- `RDS_SSL` - Enable SSL (default: true)
- `RDS_USE_IAM` - Use IAM authentication (default: false)
- `AWS_REGION` - AWS region
- `S3_BACKUP_BUCKET` - S3 bucket for backups

**RDS-Specific Features:**
- Automatic SSL connection configuration
- UUID primary keys with PostgreSQL uuid-ossp extension
- RDS-compatible schema modifications
- Proper handling of RDS database constraints
- Integration with S3 backup bucket information

## Database Schema

The scripts create the following tables:

- `alpacas` - Core alpaca information with self-referencing parent relationships
- `health_records` - Medical records linked to alpacas
- `breeding_records` - Breeding information with parent references
- `breeding_offspring` - Junction table for breeding-offspring relationships
- `management_activities` - Farm management activities
- `activity_alpacas` - Junction table for activity-alpaca associations

All tables include proper indexes for performance and foreign key constraints for data integrity.

## Requirements

### SQLite
- `sqlite3` command-line tool

### PostgreSQL
- `psql` command-line tool
- `pg_dump` for backups
- Proper database user permissions

## Examples

### Quick Start (SQLite)
```bash
# Initialize with test data
./scripts/init-database.sh

# Check what was created
./scripts/db-utils.sh status

# Open database shell to explore
./scripts/db-utils.sh shell
```

### Production Setup (PostgreSQL)
```bash
# Initialize production database
./scripts/init-database.sh \
  -t postgresql \
  -h prod-db.example.com \
  -u alpaca_admin \
  -w $DB_PASSWORD \
  -n alpaca_herd_prod \
  --no-seed

# Create backup
./scripts/db-utils.sh backup \
  -t postgresql \
  -h prod-db.example.com \
  -u alpaca_admin \
  -n alpaca_herd_prod
```

### AWS RDS Setup
```bash
# Create RDS infrastructure
./scripts/create-rds-infrastructure.sh

# Source the generated configuration
source alpaca-herd-aws-config.env

# Initialize RDS database (automatically detects RDS)
./scripts/init-database.sh

# Check RDS status
./scripts/db-utils.sh status

# Create RDS backup
./scripts/db-utils.sh backup
```

### Development Workflow
```bash
# Reset database for clean testing
./scripts/db-utils.sh reset

# Run custom queries for debugging
./scripts/db-utils.sh query "
  SELECT a.name, COUNT(hr.id) as health_records 
  FROM alpacas a 
  LEFT JOIN health_records hr ON a.id = hr.alpaca_id 
  GROUP BY a.id, a.name
"

# Clean test data but keep schema
./scripts/db-utils.sh clean
```

## Error Handling

Both scripts include comprehensive error handling:

- Dependency checking (sqlite3, psql availability)
- Database connection validation
- SQL execution error reporting
- Backup file validation
- User confirmation for destructive operations

## AWS SAM Deployment Workflow

### Typical Deployment Process

1. **Deploy the application:**
   ```bash
   ./scripts/deploy.sh
   ```

2. **Check deployment status:**
   ```bash
   ./scripts/status.sh
   ```

3. **Test the deployed API:**
   ```bash
   ./scripts/test-deployed.sh
   ```

4. **Run security audit:**
   ```bash
   ./scripts/security-audit.sh
   ```

5. **Monitor costs and performance:**
   ```bash
   ./scripts/cost-monitor.sh
   ```

6. **Monitor logs during testing:**
   ```bash
   ./scripts/logs.sh --follow
   ```

7. **Debug issues if they arise:**
   ```bash
   ./scripts/debug.sh
   ```

8. **Clean up when done:**
   ```bash
   ./scripts/destroy.sh
   ```

### Security and Cost Optimization Workflow

1. **Post-deployment security validation:**
   ```bash
   # Run comprehensive security audit
   ./scripts/security-audit.sh
   
   # Generate security report for compliance
   ./scripts/security-audit.sh --report
   ```

2. **Cost monitoring setup:**
   ```bash
   # Analyze current costs and usage
   ./scripts/cost-monitor.sh
   
   # Set up automated cost alerts
   ./scripts/cost-monitor.sh --alerts
   
   # Subscribe to cost notifications
   aws sns subscribe \
     --topic-arn arn:aws:sns:us-east-1:ACCOUNT:alpaca-farm-cost-alerts \
     --protocol email \
     --notification-endpoint your-email@example.com
   ```

3. **Regular monitoring (weekly/monthly):**
   ```bash
   # Weekly cost review
   ./scripts/cost-monitor.sh --report
   
   # Monthly security audit
   ./scripts/security-audit.sh --report
   ```

### Local Development and Testing Workflow

1. **Test locally before deployment:**
   ```bash
   ./scripts/test-local.sh
   ```

2. **Deploy to AWS:**
   ```bash
   ./scripts/deploy.sh
   ```

3. **Test deployed version:**
   ```bash
   ./scripts/test-deployed.sh
   ```

4. **Compare local vs deployed performance:**
   ```bash
   # Local testing
   ./scripts/test-local.sh --verbose

   # Deployed testing
   ./scripts/test-deployed.sh --verbose
   ```

### Monitoring and Debugging Examples

#### Real-time Error Monitoring
```bash
# Monitor errors in real-time
./scripts/debug.sh errors

# Or use logs.sh for error filtering
./scripts/logs.sh --follow --level error
```

#### Performance Analysis
```bash
# Check Lambda performance metrics
./scripts/debug.sh performance

# Search for performance-related logs
./scripts/logs.sh --grep "duration\|memory\|timeout"
```

#### Health Monitoring
```bash
# Continuous health checks with success rate tracking
./scripts/debug.sh health

# Quick health check
./scripts/status.sh
```

#### Log Analysis
```bash
# Search for database-related issues
./scripts/logs.sh --grep "database\|connection\|sql"

# Show logs from when an issue started
./scripts/logs.sh --since "2024-01-01 14:30:00"

# Get last 100 log entries
./scripts/logs.sh --lines 100
```

### Testing Examples

#### Local Development Testing
```bash
# Quick health check during development
./scripts/test-local.sh --health-only

# Full API testing with verbose output
./scripts/test-local.sh --verbose

# Test on custom port (if SAM local is running elsewhere)
./scripts/test-local.sh --port 8080 --no-start

# Performance testing only
./scripts/test-local.sh --api-only
```

#### Deployed API Testing
```bash
# Quick deployment verification
./scripts/test-deployed.sh --health-only

# Full API testing
./scripts/test-deployed.sh

# Load testing for performance validation
./scripts/test-deployed.sh --load-test

# Test specific environment
./scripts/test-deployed.sh --stack alpaca-herd-staging --region us-west-2

# Test with manual URL (bypass auto-discovery)
./scripts/test-deployed.sh --url https://myapi.execute-api.us-east-1.amazonaws.com/Prod/api/v1
```

#### Continuous Integration Examples
```bash
# CI pipeline testing
./scripts/test-local.sh --health-only --timeout 30
if [ $? -eq 0 ]; then
    ./scripts/deploy.sh
    ./scripts/test-deployed.sh --health-only
fi

# Load testing for production readiness
./scripts/test-deployed.sh --load-test --no-cleanup
```

#### Debugging Workflow
```bash
# Test locally first
./scripts/test-local.sh --verbose

# Deploy and test
./scripts/deploy.sh
./scripts/test-deployed.sh --verbose

# If issues found, debug
./scripts/debug.sh errors
./scripts/logs.sh --level error --tail 60
```

#### Manual API Testing
```bash
# Get curl examples for all endpoints
./scripts/api-examples.sh

# Test specific endpoint category
./scripts/api-examples.sh alpacas --verbose

# Test with deployed API
./scripts/api-examples.sh --url https://myapi.execute-api.us-east-1.amazonaws.com/Prod/api/v1

# Interactive testing with responses
./scripts/api-examples.sh --verbose health
```

### AWS Configuration

The AWS SAM scripts require:

- AWS CLI configured with appropriate credentials
- SAM CLI installed
- Proper IAM permissions for CloudFormation, Lambda, API Gateway, and CloudWatch

**Required AWS Permissions:**
- `cloudformation:*` - For stack management
- `lambda:*` - For Lambda function management
- `apigateway:*` - For API Gateway management
- `logs:*` - For CloudWatch logs access
- `iam:CreateRole`, `iam:AttachRolePolicy` - For Lambda execution role

**Environment Variables:**
```bash
export AWS_REGION=us-east-1
export AWS_PROFILE=my-profile  # Optional: use specific AWS profile
```

## Security Notes

### Database Scripts
- PostgreSQL passwords can be provided via environment variables to avoid command-line exposure
- Scripts validate input parameters to prevent SQL injection
- Backup files are created with appropriate permissions
- Database connections use standard security practices

### AWS SAM Scripts
- AWS credentials should be configured securely using AWS CLI or IAM roles
- CloudWatch logs may contain sensitive information - ensure proper log retention policies
- API Gateway endpoints are public by default - implement authentication as needed
- Lambda functions have IAM roles with minimal required permissions