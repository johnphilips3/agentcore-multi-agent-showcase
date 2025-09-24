# AWS SAM Deployment Guide

This guide provides step-by-step instructions for deploying the Alpaca Farm Management Storage API to AWS using SAM (Serverless Application Model).

## Prerequisites

### Required Tools
- **AWS CLI v2**: [Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **SAM CLI**: [Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- **Node.js 18+**: [Download](https://nodejs.org/)
- **Docker**: [Installation Guide](https://docs.docker.com/get-docker/)

### AWS Account Setup
1. **AWS Account**: Active AWS account with appropriate permissions
2. **IAM Permissions**: Your AWS user/role needs permissions for:
   - Lambda functions
   - API Gateway
   - CloudFormation
   - IAM roles
   - CloudWatch logs
   - S3 (for deployment artifacts)

### Database Prerequisites
- **RDS PostgreSQL Instance**: Must be running and accessible
- **Database Schema**: Alpaca herd database should be initialized
- **Network Access**: Lambda needs network access to RDS (VPC configuration may be required)

### Cost Optimization Prerequisites
- **Billing Access**: For cost monitoring and alerts (optional)
- **CloudWatch Access**: For metrics and log monitoring
- **SNS Access**: For cost alert notifications (optional)

## Configuration

### 1. AWS Credentials Setup

Configure AWS credentials using one of these methods:

**Option A: AWS CLI Configure**
```bash
aws configure
```

**Option B: Environment Variables**
```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1
```

**Option C: AWS Profile**
```bash
export AWS_PROFILE=your-profile-name
```

### 2. VPC Configuration (Optional)

For enhanced security and database connectivity, you can deploy the Lambda function in a VPC:

**VPC Environment Variables**
```bash
export VPC_ID=vpc-12345678
export SUBNET_IDS=subnet-12345678,subnet-87654321
export SECURITY_GROUP_IDS=sg-12345678  # Optional - will create default if not provided
```

**VPC Requirements:**
- **Subnets**: Must have internet access (via NAT Gateway or Internet Gateway) for AWS API calls
- **Security Groups**: Must allow outbound HTTPS (443) and PostgreSQL (5432) traffic
- **RDS Access**: RDS security group must allow inbound connections from Lambda security group

### 2. Database Configuration

Set required environment variables for database connection:

```bash
export RDS_HOST=your-rds-endpoint.region.rds.amazonaws.com
export RDS_USERNAME=your-db-username
export RDS_PASSWORD=your-db-password
```

### 3. Environment Configuration

The deployment supports three environments: `dev`, `staging`, and `prod`. Configuration is managed in `deployment-config.json`.

**Default Environment**: `dev`

To deploy to a different environment:
```bash
export DEPLOY_ENV=staging  # or prod
```

## Deployment Steps

### Step 1: Prepare the Project

1. **Navigate to project directory**:
   ```bash
   cd alpaca-farm-mgmt-storage
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build TypeScript**:
   ```bash
   npm run build
   ```

### Step 2: Validate Configuration

1. **Check AWS credentials**:
   ```bash
   aws sts get-caller-identity
   ```

2. **Validate SAM template**:
   ```bash
   sam validate
   ```

3. **Test database connectivity** (optional):
   ```bash
   ./scripts/test-rds-connection.sh
   ```

### Step 3: Deploy Using Script

**Quick Deployment** (recommended):
```bash
./scripts/deploy.sh
```

**Deploy to Specific Environment**:
```bash
DEPLOY_ENV=staging ./scripts/deploy.sh
```

**Deploy with Custom Parameters**:
```bash
DEPLOY_ENV=prod RDS_HOST=prod-db.amazonaws.com ./scripts/deploy.sh
```

### Step 4: Manual Deployment (Alternative)

If you prefer manual deployment:

1. **Build the application**:
   ```bash
   sam build
   ```

2. **Deploy the stack**:
   ```bash
   sam deploy --guided
   ```

   Follow the prompts to configure:
   - Stack name
   - AWS region
   - Parameter values
   - Deployment preferences

## Post-Deployment

### 1. Verify Deployment

**Check deployment status**:
```bash
./scripts/status.sh
```

**Test API endpoints**:
```bash
./scripts/test-deployed.sh
```

### 2. Get API Gateway URL

The deployment script outputs the API Gateway URL. You can also retrieve it:

```bash
aws cloudformation describe-stacks \
  --stack-name alpaca-farm-mgmt-storage-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text
```

### 3. Test Basic Functionality

**Health Check**:
```bash
curl https://your-api-gateway-url/api/v1/health
```

**List Alpacas**:
```bash
curl https://your-api-gateway-url/api/v1/alpacas
```

## Environment Management

### Development Environment

**Purpose**: Local development and testing
**Configuration**: Minimal resources, short log retention
**Stack Name**: `alpaca-farm-mgmt-storage-dev`

```bash
# Deploy to dev (default)
./scripts/deploy.sh
```

### Staging Environment

**Purpose**: Pre-production testing
**Configuration**: Production-like settings with moderate resources
**Stack Name**: `alpaca-farm-mgmt-storage-staging`

```bash
# Deploy to staging
DEPLOY_ENV=staging ./scripts/deploy.sh
```

### Production Environment

**Purpose**: Live production workloads
**Configuration**: Optimized for performance and reliability
**Stack Name**: `alpaca-farm-mgmt-storage-prod`

```bash
# Deploy to production
DEPLOY_ENV=prod ./scripts/deploy.sh
```

## Configuration Customization

### Lambda Function Settings

Edit `deployment-config.json` to customize Lambda settings:

```json
{
  "environments": {
    "dev": {
      "lambda": {
        "memorySize": 512,        // Memory in MB
        "timeout": 30,            // Timeout in seconds
        "reservedConcurrency": 5  // Max concurrent executions
      }
    }
  }
}
```

### Database Connection Settings

```json
{
  "database": {
    "maxConnections": 5,  // Connection pool size
    "ssl": true,          // Enable SSL
    "port": 5432         // Database port
  }
}
```

**Note**: The Lambda function uses `DEPLOYMENT_REGION` instead of `AWS_REGION` to avoid conflicts with AWS reserved environment variables.

### API Gateway Settings

```json
{
  "apiGateway": {
    "corsEnabled": true,
    "throttling": {
      "burstLimit": 100,  // Burst capacity
      "rateLimit": 50     // Steady-state rate
    }
  }
}
```

## Monitoring and Logs

### CloudWatch Logs

**View logs using script**:
```bash
./scripts/logs.sh
```

**View logs manually**:
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/alpaca-farm"
```

### Real-time Debugging

**Stream logs in real-time**:
```bash
./scripts/debug.sh
```

### Performance Monitoring

**Check Lambda metrics**:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=alpaca-farm-mgmt-storage-dev-AlpacaFarmApi \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average
```

## Troubleshooting

### Common Issues

1. **Deployment Fails with Permission Errors**
   - Verify AWS credentials and IAM permissions
   - Check CloudFormation service role permissions

2. **Database Connection Errors**
   - Verify RDS endpoint and credentials
   - Check security groups and VPC configuration
   - Ensure Lambda has network access to RDS

3. **API Gateway 502/503 Errors**
   - Check Lambda function logs
   - Verify Lambda function is not timing out
   - Check database connectivity from Lambda

4. **Cold Start Performance Issues**
   - Consider increasing Lambda memory
   - Implement connection warming
   - Use provisioned concurrency for production

### Getting Help

1. **Check deployment logs**:
   ```bash
   ./scripts/logs.sh --error
   ```

2. **Debug specific issues**:
   ```bash
   ./scripts/debug.sh
   ```

3. **Validate configuration**:
   ```bash
   sam validate --lint
   ```

## Cleanup

### Remove Deployment

**Using script** (recommended):
```bash
./scripts/destroy.sh
```

**Manual cleanup**:
```bash
sam delete --stack-name alpaca-farm-mgmt-storage-dev
```

### Verify Cleanup

```bash
aws cloudformation describe-stacks --stack-name alpaca-farm-mgmt-storage-dev
```

Should return: `Stack with id alpaca-farm-mgmt-storage-dev does not exist`

## Security Considerations

### Implemented Security Features

The deployment includes several security optimizations:

1. **Least-Privilege IAM Role**
   - Specific resource ARNs instead of wildcards
   - Minimal permissions for RDS connectivity
   - Regional restrictions on X-Ray permissions

2. **API Gateway Security**
   - Request validation enabled
   - CORS properly configured
   - Throttling limits to prevent abuse
   - HTTPS enforced

3. **Lambda Security**
   - Explicit IAM role with minimal permissions
   - Dead Letter Queue for error handling
   - Environment-specific configurations

### Security Audit

Run the security audit script to validate configurations:

```bash
./scripts/security-audit.sh
```

This script will:
- Audit IAM role permissions
- Check Lambda security configuration
- Validate API Gateway settings
- Review CloudWatch log configurations
- Provide security recommendations

### Additional Security Recommendations

**For Production Environments**:
- Enable AWS WAF for API Gateway
- Use AWS Secrets Manager for database credentials
- Implement VPC configuration for Lambda
- Enable CloudTrail for API call logging
- Set up AWS Config for compliance monitoring
- Enable GuardDuty for threat detection

**Database Security**:
- Use SSL/TLS for database connections (enabled by default)
- Implement database user with minimal privileges
- Regular security updates for database engine

**API Security**:
- Implement authentication/authorization (API keys, Cognito, custom authorizers)
- Add request/response validation
- Monitor for suspicious activity patterns

## Cost Optimization

### Implemented Cost Optimizations

The deployment includes comprehensive cost optimization features:

1. **Lambda Function Optimization**
   - Parameterized memory allocation (512MB default)
   - Configurable timeout settings (30s default)
   - Reserved concurrency limits (5 for dev, 10 for prod)
   - PassThrough X-Ray tracing (minimal cost)

2. **CloudWatch Logs Optimization**
   - Environment-specific log retention (3-30 days)
   - Structured logging to reduce volume
   - No KMS encryption for POC (reduces costs)

3. **API Gateway Cost Controls**
   - Throttling configured (100 req/s rate, 200 burst)
   - Caching disabled for POC usage
   - Request validation to prevent unnecessary processing

4. **Monitoring and Alerting**
   - Cost monitoring alarms
   - Performance monitoring for optimization
   - Dead Letter Queue with short retention

### Cost Monitoring

Run the cost monitoring script to analyze current usage:

```bash
./scripts/cost-monitor.sh
```

This script provides:
- Lambda function cost analysis
- API Gateway usage metrics
- CloudWatch logs cost estimation
- Monthly cost projections
- Optimization recommendations

### Environment-Specific Cost Settings

**Development Environment** (cost-optimized):
```bash
# Minimal resources for testing
LambdaMemorySize=512
LambdaTimeout=30
ReservedConcurrency=3
LogRetentionDays=3
```

**Staging Environment** (balanced):
```bash
# Production-like with cost controls
LambdaMemorySize=512
LambdaTimeout=30
ReservedConcurrency=5
LogRetentionDays=7
```

**Production Environment** (performance-optimized):
```bash
# Optimized for performance with cost controls
LambdaMemorySize=1024
LambdaTimeout=60
ReservedConcurrency=10
LogRetentionDays=30
```

### Cost Optimization Strategies

1. **Right-sizing Lambda Memory**
   ```bash
   # Monitor actual memory usage
   aws logs filter-log-events \
     --log-group-name "/aws/lambda/alpaca-farm-mgmt-storage-dev-api" \
     --filter-pattern "[REPORT]" \
     --start-time 1640995200000
   ```

2. **Log Retention Management**
   ```bash
   # Adjust retention based on needs
   aws logs put-retention-policy \
     --log-group-name "/aws/lambda/alpaca-farm-mgmt-storage-dev-api" \
     --retention-in-days 7
   ```

3. **Reserved Concurrency Tuning**
   ```bash
   # Adjust based on traffic patterns
   aws lambda put-reserved-concurrency-limit \
     --function-name alpaca-farm-mgmt-storage-dev-api \
     --reserved-concurrent-executions 5
   ```

### Cost Alerts Setup

Set up automated cost monitoring:

```bash
# Set up cost alerts with email notifications
./scripts/cost-monitor.sh --alerts

# Subscribe to cost alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:alpaca-farm-cost-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

### Expected Costs

**Development Environment** (POC usage):
- Lambda: ~$5-10/month
- API Gateway: ~$3-5/month  
- CloudWatch Logs: ~$1-2/month
- **Total**: ~$9-17/month

**Production Environment** (light usage):
- Lambda: ~$15-25/month
- API Gateway: ~$10-15/month
- CloudWatch Logs: ~$5-8/month
- **Total**: ~$30-48/month

*Note: Costs exclude RDS database charges as that's shared infrastructure*

## Next Steps

1. **Set up CI/CD Pipeline**: Automate deployments using GitHub Actions or AWS CodePipeline
2. **Implement Monitoring**: Set up CloudWatch alarms and dashboards
3. **Add Authentication**: Implement API authentication using Cognito or custom authorizers
4. **Performance Optimization**: Monitor and optimize based on usage patterns
5. **Backup Strategy**: Implement automated database backups and disaster recovery

## Support

For issues and questions:
1. Check the [debugging guide](debugging-guide.md)
2. Review CloudWatch logs
3. Consult AWS SAM documentation
4. Check project repository issues