#!/bin/bash

# =============================================================================
# AWS RDS Infrastructure Cleanup for Alpaca Herd Storage
# =============================================================================
# This script safely destroys the RDS infrastructure created by 
# create-rds-infrastructure.sh
# =============================================================================

set -e  # Exit on any error

# Configuration Variables
PROJECT_NAME="alpaca-herd"
ENVIRONMENT="${ENVIRONMENT:-production}"
AWS_REGION="${AWS_REGION:-us-east-1}"

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

# Generate resource names (same as creation script)
generate_resource_names() {
    VPC_NAME="${PROJECT_NAME}-${ENVIRONMENT}-vpc"
    SUBNET_GROUP_NAME="${PROJECT_NAME}-${ENVIRONMENT}-subnet-group"
    SECURITY_GROUP_NAME="${PROJECT_NAME}-${ENVIRONMENT}-db-sg"
    PARAMETER_GROUP_NAME="${PROJECT_NAME}-${ENVIRONMENT}-params"
    DB_INSTANCE_ID="${PROJECT_NAME}-${ENVIRONMENT}-db"
    IAM_ROLE_NAME="${PROJECT_NAME}-${ENVIRONMENT}-rds-role"
}

# Load configuration if available
load_config() {
    if [ -f "alpaca-herd-aws-config.env" ]; then
        log_info "Loading configuration from alpaca-herd-aws-config.env"
        source alpaca-herd-aws-config.env
        S3_BUCKET_NAME=${S3_BACKUP_BUCKET}
    else
        log_warning "Configuration file not found. Using default naming convention."
    fi
}

# Delete RDS instance
delete_rds_instance() {
    log_info "Deleting RDS instance..."
    
    if aws rds describe-db-instances --db-instance-identifier ${DB_INSTANCE_ID} &>/dev/null; then
        # Disable deletion protection first
        aws rds modify-db-instance \
            --db-instance-identifier ${DB_INSTANCE_ID} \
            --no-deletion-protection \
            --apply-immediately
        
        # Delete the instance (skip final snapshot for cleanup)
        aws rds delete-db-instance \
            --db-instance-identifier ${DB_INSTANCE_ID} \
            --skip-final-snapshot \
            --delete-automated-backups
        
        log_success "RDS instance deletion initiated"
        
        # Wait for deletion
        log_info "Waiting for RDS instance to be deleted..."
        aws rds wait db-instance-deleted --db-instance-identifier ${DB_INSTANCE_ID}
        log_success "RDS instance deleted"
    else
        log_warning "RDS instance ${DB_INSTANCE_ID} not found"
    fi
}

# Delete other AWS resources
delete_resources() {
    log_info "Deleting other AWS resources..."
    
    # Delete parameter group
    if aws rds describe-db-parameter-groups --db-parameter-group-name ${PARAMETER_GROUP_NAME} &>/dev/null; then
        aws rds delete-db-parameter-group --db-parameter-group-name ${PARAMETER_GROUP_NAME}
        log_success "Deleted parameter group: ${PARAMETER_GROUP_NAME}"
    fi
    
    # Delete subnet group
    if aws rds describe-db-subnet-groups --db-subnet-group-name ${SUBNET_GROUP_NAME} &>/dev/null; then
        aws rds delete-db-subnet-group --db-subnet-group-name ${SUBNET_GROUP_NAME}
        log_success "Deleted subnet group: ${SUBNET_GROUP_NAME}"
    fi
    
    # Delete S3 bucket (if specified)
    if [ ! -z "${S3_BUCKET_NAME}" ]; then
        if aws s3api head-bucket --bucket ${S3_BUCKET_NAME} &>/dev/null; then
            log_warning "Deleting S3 bucket and ALL its contents: ${S3_BUCKET_NAME}"
            aws s3 rm s3://${S3_BUCKET_NAME} --recursive
            aws s3api delete-bucket --bucket ${S3_BUCKET_NAME}
            log_success "Deleted S3 bucket: ${S3_BUCKET_NAME}"
        fi
    fi
    
    # Delete IAM role and policy
    if aws iam get-role --role-name ${IAM_ROLE_NAME} &>/dev/null; then
        # Detach policies
        POLICY_ARN=$(aws iam list-policies --query "Policies[?PolicyName=='${IAM_ROLE_NAME}-s3-policy'].Arn" --output text)
        if [ ! -z "${POLICY_ARN}" ]; then
            aws iam detach-role-policy --role-name ${IAM_ROLE_NAME} --policy-arn ${POLICY_ARN}
            aws iam delete-policy --policy-arn ${POLICY_ARN}
        fi
        aws iam delete-role --role-name ${IAM_ROLE_NAME}
        log_success "Deleted IAM role: ${IAM_ROLE_NAME}"
    fi
}

# Main execution
main() {
    echo "============================================================================="
    echo "AWS RDS Infrastructure Cleanup for Alpaca Herd Storage"
    echo "============================================================================="
    echo
    
    generate_resource_names
    load_config
    
    log_warning "This will DELETE the following resources:"
    echo "  - RDS Instance: ${DB_INSTANCE_ID}"
    echo "  - Parameter Group: ${PARAMETER_GROUP_NAME}"
    echo "  - Subnet Group: ${SUBNET_GROUP_NAME}"
    echo "  - IAM Role: ${IAM_ROLE_NAME}"
    if [ ! -z "${S3_BUCKET_NAME}" ]; then
        echo "  - S3 Bucket: ${S3_BUCKET_NAME} (and ALL contents)"
    fi
    echo
    log_error "THIS ACTION CANNOT BE UNDONE!"
    echo
    
    read -p "Are you sure you want to delete these resources? Type 'DELETE' to confirm: " -r
    echo
    if [[ ! $REPLY == "DELETE" ]]; then
        log_info "Cleanup cancelled by user"
        exit 0
    fi
    
    delete_rds_instance
    delete_resources
    
    echo
    echo "============================================================================="
    log_success "Infrastructure cleanup completed!"
    echo "============================================================================="
    echo
    log_info "Note: VPC, subnets, and security groups were not deleted for safety."
    log_info "Delete them manually if they are no longer needed."
}

# Run main function
main "$@"