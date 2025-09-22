#!/bin/bash

# AWS RDS Infrastructure Setup for Alpaca Herd Storage
# Creates complete RDS infrastructure including VPC, security groups, and database

set -e  # Exit on any error

# Configuration Variables
PROJECT_NAME="alpaca-herd"
ENVIRONMENT="${ENVIRONMENT:-production}"
AWS_REGION="${AWS_REGION:-us-east-1}"
DB_INSTANCE_CLASS="${DB_INSTANCE_CLASS:-db.t3.micro}"
DB_ALLOCATED_STORAGE="${DB_ALLOCATED_STORAGE:-20}"
DB_ENGINE_VERSION="${DB_ENGINE_VERSION:-17.6}"
DB_NAME="alpaca_herd"
DB_USERNAME="${DB_USERNAME:-alpaca_admin}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Generate resource names
generate_resource_names() {
    VPC_NAME="${PROJECT_NAME}-${ENVIRONMENT}-vpc"
    SUBNET_GROUP_NAME="${PROJECT_NAME}-${ENVIRONMENT}-subnet-group"
    SECURITY_GROUP_NAME="${PROJECT_NAME}-${ENVIRONMENT}-db-sg"
    PARAMETER_GROUP_NAME="${PROJECT_NAME}-${ENVIRONMENT}-params"
    DB_INSTANCE_ID="${PROJECT_NAME}-${ENVIRONMENT}-db"
    S3_BUCKET_NAME="${PROJECT_NAME}-${ENVIRONMENT}-backups-$(date +%s)"
    IAM_ROLE_NAME="${PROJECT_NAME}-${ENVIRONMENT}-rds-role"
}

# Create VPC and networking components
create_vpc() {
    log_info "Creating VPC and networking components..."
    
    # Create VPC
    VPC_ID=$(aws ec2 create-vpc \
        --cidr-block 10.0.0.0/16 \
        --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${VPC_NAME}},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query 'Vpc.VpcId' \
        --output text)
    
    log_success "Created VPC: ${VPC_ID}"
    
    # Enable DNS hostnames
    aws ec2 modify-vpc-attribute --vpc-id ${VPC_ID} --enable-dns-hostnames
    
    # Create Internet Gateway
    IGW_ID=$(aws ec2 create-internet-gateway \
        --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${VPC_NAME}-igw},{Key=Project,Value=${PROJECT_NAME}}]" \
        --query 'InternetGateway.InternetGatewayId' \
        --output text)
    
    # Attach Internet Gateway to VPC
    aws ec2 attach-internet-gateway --vpc-id ${VPC_ID} --internet-gateway-id ${IGW_ID}
    
    log_success "Created and attached Internet Gateway: ${IGW_ID}"
}

# Create subnets in different AZs
create_subnets() {
    log_info "Creating subnets in multiple availability zones..."
    
    # Get available AZs
    AZ1=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text)
    AZ2=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[1].ZoneName' --output text)
    
    # Create private subnet 1
    SUBNET1_ID=$(aws ec2 create-subnet \
        --vpc-id ${VPC_ID} \
        --cidr-block 10.0.1.0/24 \
        --availability-zone ${AZ1} \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${VPC_NAME}-private-1},{Key=Project,Value=${PROJECT_NAME}}]" \
        --query 'Subnet.SubnetId' \
        --output text)
    
    # Create private subnet 2
    SUBNET2_ID=$(aws ec2 create-subnet \
        --vpc-id ${VPC_ID} \
        --cidr-block 10.0.2.0/24 \
        --availability-zone ${AZ2} \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${VPC_NAME}-private-2},{Key=Project,Value=${PROJECT_NAME}}]" \
        --query 'Subnet.SubnetId' \
        --output text)
    
    log_success "Created subnets: ${SUBNET1_ID}, ${SUBNET2_ID}"
}

# Create security group for RDS
create_security_group() {
    log_info "Creating security group for RDS..."
    
    SECURITY_GROUP_ID=$(aws ec2 create-security-group \
        --group-name ${SECURITY_GROUP_NAME} \
        --description "Security group for ${PROJECT_NAME} RDS database" \
        --vpc-id ${VPC_ID} \
        --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${SECURITY_GROUP_NAME}},{Key=Project,Value=${PROJECT_NAME}}]" \
        --query 'GroupId' \
        --output text)
    
    # Allow PostgreSQL access from VPC
    aws ec2 authorize-security-group-ingress \
        --group-id ${SECURITY_GROUP_ID} \
        --protocol tcp \
        --port 5432 \
        --cidr 10.0.0.0/16
    
    # Allow HTTPS for RDS management
    aws ec2 authorize-security-group-ingress \
        --group-id ${SECURITY_GROUP_ID} \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0
    
    log_success "Created security group: ${SECURITY_GROUP_ID}"
}

# Create DB subnet group
create_db_subnet_group() {
    log_info "Creating DB subnet group..."
    
    aws rds create-db-subnet-group \
        --db-subnet-group-name ${SUBNET_GROUP_NAME} \
        --db-subnet-group-description "Subnet group for ${PROJECT_NAME} database" \
        --subnet-ids ${SUBNET1_ID} ${SUBNET2_ID} \
        --tags Key=Name,Value=${SUBNET_GROUP_NAME} Key=Project,Value=${PROJECT_NAME} Key=Environment,Value=${ENVIRONMENT}
    
    log_success "Created DB subnet group: ${SUBNET_GROUP_NAME}"
}

# Create DB parameter group
create_parameter_group() {
    log_info "Creating DB parameter group..."
    
    aws rds create-db-parameter-group \
        --db-parameter-group-name ${PARAMETER_GROUP_NAME} \
        --db-parameter-group-family postgres17 \
        --description "Parameter group for ${PROJECT_NAME} PostgreSQL database" \
        --tags Key=Name,Value=${PARAMETER_GROUP_NAME} Key=Project,Value=${PROJECT_NAME}
    
    # Set optimized parameters for alpaca herd storage
    aws rds modify-db-parameter-group \
        --db-parameter-group-name ${PARAMETER_GROUP_NAME} \
        --parameters "ParameterName=shared_preload_libraries,ParameterValue=pg_stat_statements,ApplyMethod=pending-reboot" \
                    "ParameterName=log_statement,ParameterValue=all,ApplyMethod=immediate" \
                    "ParameterName=log_min_duration_statement,ParameterValue=1000,ApplyMethod=immediate" \
                    "ParameterName=max_connections,ParameterValue=100,ApplyMethod=pending-reboot"
    
    log_success "Created parameter group: ${PARAMETER_GROUP_NAME}"
}

# Create S3 bucket for backups
create_s3_bucket() {
    log_info "Creating S3 bucket for database backups..."
    
    # Create S3 bucket
    if [ "${AWS_REGION}" = "us-east-1" ]; then
        aws s3api create-bucket --bucket ${S3_BUCKET_NAME}
    else
        aws s3api create-bucket \
            --bucket ${S3_BUCKET_NAME} \
            --create-bucket-configuration LocationConstraint=${AWS_REGION}
    fi
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket ${S3_BUCKET_NAME} \
        --versioning-configuration Status=Enabled
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption \
        --bucket ${S3_BUCKET_NAME} \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }'
    
    # Set lifecycle policy for backup retention
    aws s3api put-bucket-lifecycle-configuration \
        --bucket ${S3_BUCKET_NAME} \
        --lifecycle-configuration '{
            "Rules": [{
                "ID": "backup-lifecycle",
                "Status": "Enabled",
                "Filter": {"Prefix": "database-backups/"},
                "Transitions": [
                    {
                        "Days": 30,
                        "StorageClass": "STANDARD_IA"
                    },
                    {
                        "Days": 90,
                        "StorageClass": "GLACIER"
                    }
                ],
                "Expiration": {
                    "Days": 2555
                }
            }]
        }'
    
    # Add bucket tags
    aws s3api put-bucket-tagging \
        --bucket ${S3_BUCKET_NAME} \
        --tagging 'TagSet=[
            {Key=Name,Value='${S3_BUCKET_NAME}'},
            {Key=Project,Value='${PROJECT_NAME}'},
            {Key=Environment,Value='${ENVIRONMENT}'},
            {Key=Purpose,Value=DatabaseBackups}
        ]'
    
    log_success "Created S3 bucket: ${S3_BUCKET_NAME}"
}

# Create IAM role for RDS
create_iam_role() {
    log_info "Creating IAM role for RDS..."
    
    # Create trust policy
    cat > /tmp/rds-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "rds.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF
    
    # Create IAM role
    aws iam create-role \
        --role-name ${IAM_ROLE_NAME} \
        --assume-role-policy-document file:///tmp/rds-trust-policy.json \
        --description "IAM role for ${PROJECT_NAME} RDS instance" \
        --tags Key=Name,Value=${IAM_ROLE_NAME} Key=Project,Value=${PROJECT_NAME}
    
    # Create policy for S3 backup access
    cat > /tmp/rds-s3-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::${S3_BUCKET_NAME}",
                "arn:aws:s3:::${S3_BUCKET_NAME}/*"
            ]
        }
    ]
}
EOF
    
    # Create and attach policy
    aws iam create-policy \
        --policy-name ${IAM_ROLE_NAME}-s3-policy \
        --policy-document file:///tmp/rds-s3-policy.json \
        --description "S3 access policy for ${PROJECT_NAME} RDS backups"
    
    POLICY_ARN=$(aws iam list-policies \
        --query "Policies[?PolicyName=='${IAM_ROLE_NAME}-s3-policy'].Arn" \
        --output text)
    
    aws iam attach-role-policy \
        --role-name ${IAM_ROLE_NAME} \
        --policy-arn ${POLICY_ARN}
    
    # Clean up temp files
    rm -f /tmp/rds-trust-policy.json /tmp/rds-s3-policy.json
    
    log_success "Created IAM role: ${IAM_ROLE_NAME}"
}

# Generate secure password
generate_password() {
    if command -v openssl &> /dev/null; then
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    else
        DB_PASSWORD=$(date +%s | sha256sum | base64 | head -c 25)
    fi
    
    log_info "Generated secure database password"
}

# Create RDS instance
create_rds_instance() {
    log_info "Creating RDS PostgreSQL instance..."
    
    generate_password
    
    aws rds create-db-instance \
        --db-instance-identifier ${DB_INSTANCE_ID} \
        --db-instance-class ${DB_INSTANCE_CLASS} \
        --engine postgres \
        --engine-version ${DB_ENGINE_VERSION} \
        --master-username ${DB_USERNAME} \
        --master-user-password ${DB_PASSWORD} \
        --allocated-storage ${DB_ALLOCATED_STORAGE} \
        --storage-type gp2 \
        --storage-encrypted \
        --db-name ${DB_NAME} \
        --vpc-security-group-ids ${SECURITY_GROUP_ID} \
        --db-subnet-group-name ${SUBNET_GROUP_NAME} \
        --db-parameter-group-name ${PARAMETER_GROUP_NAME} \
        --backup-retention-period ${BACKUP_RETENTION_DAYS} \
        --preferred-backup-window "03:00-04:00" \
        --preferred-maintenance-window "sun:04:00-sun:05:00" \
        --auto-minor-version-upgrade \
        --multi-az \
        --publicly-accessible \
        --enable-performance-insights \
        --performance-insights-retention-period 7 \
        --deletion-protection \
        --tags Key=Name,Value=${DB_INSTANCE_ID} Key=Project,Value=${PROJECT_NAME} Key=Environment,Value=${ENVIRONMENT}
    
    log_success "RDS instance creation initiated: ${DB_INSTANCE_ID}"
    log_info "Database password: ${DB_PASSWORD}"
    log_warning "Please save the database password securely!"
}

# Wait for RDS instance to be available
wait_for_rds() {
    log_info "Waiting for RDS instance to become available..."
    
    aws rds wait db-instance-available --db-instance-identifier ${DB_INSTANCE_ID}
    
    # Get RDS endpoint
    RDS_ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier ${DB_INSTANCE_ID} \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    log_success "RDS instance is now available at: ${RDS_ENDPOINT}"
}

# Create database schema
create_database_schema() {
    log_info "Creating database schema for Alpaca Herd Storage..."
    
    # Create SQL schema file
    cat > /tmp/alpaca-schema.sql << 'EOF'
-- Alpaca Herd Storage Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Alpacas table
CREATE TABLE alpacas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100) UNIQUE,
    birth_date DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
    color VARCHAR(50),
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,2),
    micron_count DECIMAL(4,1),
    staple_length_mm DECIMAL(4,1),
    crimp VARCHAR(50),
    density VARCHAR(50),
    sire_id UUID REFERENCES alpacas(id),
    dam_id UUID REFERENCES alpacas(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Health records table
CREATE TABLE health_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alpaca_id UUID NOT NULL REFERENCES alpacas(id) ON DELETE CASCADE,
    record_type VARCHAR(20) CHECK (record_type IN ('vaccination', 'treatment', 'observation', 'checkup')),
    date DATE NOT NULL,
    description TEXT NOT NULL,
    veterinarian VARCHAR(255),
    next_due_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Breeding records table
CREATE TABLE breeding_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sire_id UUID NOT NULL REFERENCES alpacas(id),
    dam_id UUID NOT NULL REFERENCES alpacas(id),
    breeding_date DATE NOT NULL,
    expected_due_date DATE,
    actual_birth_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Management activities table
CREATE TABLE management_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_type VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    performer VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity participants (many-to-many relationship)
CREATE TABLE activity_participants (
    activity_id UUID REFERENCES management_activities(id) ON DELETE CASCADE,
    alpaca_id UUID REFERENCES alpacas(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, alpaca_id)
);

-- Indexes for performance
CREATE INDEX idx_alpacas_name ON alpacas(name);
CREATE INDEX idx_alpacas_registration ON alpacas(registration_number);
CREATE INDEX idx_alpacas_birth_date ON alpacas(birth_date);
CREATE INDEX idx_health_records_alpaca_date ON health_records(alpaca_id, date);
CREATE INDEX idx_health_records_type ON health_records(record_type);
CREATE INDEX idx_health_records_due_date ON health_records(next_due_date);
CREATE INDEX idx_breeding_records_parents ON breeding_records(sire_id, dam_id);
CREATE INDEX idx_breeding_records_date ON breeding_records(breeding_date);
CREATE INDEX idx_activities_date ON management_activities(date);
CREATE INDEX idx_activities_type ON management_activities(activity_type);

-- Update trigger for alpacas
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_alpacas_updated_at BEFORE UPDATE ON alpacas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data
INSERT INTO alpacas (name, registration_number, birth_date, gender, color, weight_kg) VALUES
('Luna', 'AH001', '2020-05-15', 'female', 'white', 65.5),
('Storm', 'AH002', '2019-03-22', 'male', 'brown', 75.2),
('Misty', 'AH003', '2021-07-10', 'female', 'gray', 58.3);

COMMIT;
EOF
    
    # Apply schema using psql if available
    if command -v psql &> /dev/null; then
        log_info "Applying database schema..."
        PGPASSWORD=${DB_PASSWORD} psql -h ${RDS_ENDPOINT} -U ${DB_USERNAME} -d ${DB_NAME} -f /tmp/alpaca-schema.sql
        log_success "Database schema applied successfully"
    else
        log_warning "psql not found. Schema file created at /tmp/alpaca-schema.sql"
        log_info "Apply manually with: psql -h ${RDS_ENDPOINT} -U ${DB_USERNAME} -d ${DB_NAME} -f /tmp/alpaca-schema.sql"
    fi
}

# Output configuration
output_configuration() {
    log_info "Generating configuration output..."
    
    cat > alpaca-herd-aws-config.env << EOF
# Alpaca Herd Storage AWS Configuration
# Generated on $(date)

# AWS Configuration
AWS_REGION=${AWS_REGION}

# RDS Configuration
RDS_INSTANCE_ID=${DB_INSTANCE_ID}
RDS_HOST=${RDS_ENDPOINT}
RDS_PORT=5432
RDS_DATABASE=${DB_NAME}
RDS_USERNAME=${DB_USERNAME}
RDS_PASSWORD=${DB_PASSWORD}
RDS_USE_IAM=false
RDS_SSL=true
RDS_MAX_CONNECTIONS=20

# S3 Configuration
S3_BACKUP_BUCKET=${S3_BUCKET_NAME}
S3_BACKUP_PREFIX=database-backups
S3_REGION=${AWS_REGION}
S3_ENCRYPTION=AES256
S3_STORAGE_CLASS=STANDARD

# CloudWatch Configuration
CLOUDWATCH_LOG_GROUP=/aws/alpaca-herd
CLOUDWATCH_LOG_STREAM=application
CLOUDWATCH_RETENTION_DAYS=30
CLOUDWATCH_ENABLE_METRICS=true
CLOUDWATCH_NAMESPACE=AlpacaHerd

# Infrastructure Details
VPC_ID=${VPC_ID}
SUBNET_GROUP_NAME=${SUBNET_GROUP_NAME}
SECURITY_GROUP_ID=${SECURITY_GROUP_ID}
PARAMETER_GROUP_NAME=${PARAMETER_GROUP_NAME}
IAM_ROLE_NAME=${IAM_ROLE_NAME}
EOF
    
    log_success "Configuration saved to: alpaca-herd-aws-config.env"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f /tmp/rds-trust-policy.json /tmp/rds-s3-policy.json /tmp/alpaca-schema.sql
}

# Main execution
main() {
    echo "============================================================================="
    echo "AWS RDS Infrastructure Setup for Alpaca Herd Storage"
    echo "============================================================================="
    echo
    
    check_prerequisites
    generate_resource_names
    
    log_info "Starting infrastructure creation with the following configuration:"
    echo "  Project: ${PROJECT_NAME}"
    echo "  Environment: ${ENVIRONMENT}"
    echo "  Region: ${AWS_REGION}"
    echo "  DB Instance Class: ${DB_INSTANCE_CLASS}"
    echo "  DB Storage: ${DB_ALLOCATED_STORAGE}GB"
    echo "  DB Engine Version: PostgreSQL ${DB_ENGINE_VERSION}"
    echo
    
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Setup cancelled by user"
        exit 0
    fi
    
    # Execute setup steps
    create_vpc
    create_subnets
    create_security_group
    create_db_subnet_group
    create_parameter_group
    create_s3_bucket
    create_iam_role
    create_rds_instance
    wait_for_rds
    create_database_schema
    output_configuration
    cleanup
    
    echo
    echo "============================================================================="
    log_success "Infrastructure setup completed successfully!"
    echo "============================================================================="
    echo
    echo "Next steps:"
    echo "1. Source the configuration: source alpaca-herd-aws-config.env"
    echo "2. Test the connection: node demo/aws-config-demo.js"
    echo "3. Start using the Alpaca Herd Storage system!"
    echo
    echo "Important: Save the database password securely!"
    echo "Database Password: ${DB_PASSWORD}"
    echo
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"