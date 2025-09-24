# Cost Optimization Configuration

This document outlines the cost optimization and security configurations implemented for the Alpaca Farm Management Storage API deployment.

## Cost Optimization Features

### 1. Lambda Function Optimization

#### Memory Configuration
- **Development**: 512 MB (minimal for testing)
- **Staging**: 512 MB (balanced for validation)
- **Production**: 1024 MB (optimized for performance)

**Rationale**: Lambda pricing is based on GB-seconds. Using minimal memory for POC environments reduces costs while maintaining adequate performance.

#### Timeout Configuration
- **Development**: 30 seconds
- **Staging**: 30 seconds  
- **Production**: 60 seconds

**Rationale**: Shorter timeouts prevent runaway functions and reduce costs from hanging requests.

#### Reserved Concurrency Limits
- **Development**: 3 concurrent executions
- **Staging**: 5 concurrent executions
- **Production**: 10 concurrent executions

**Rationale**: Prevents unexpected cost spikes from traffic surges while ensuring adequate capacity for expected load.

**Implementation**: Automatically set by the deploy.sh script after SAM deployment completes.

### 2. CloudWatch Log Optimization

#### Log Retention Periods
- **Development**: 3 days (minimal retention for active development)
- **Staging**: 7 days (sufficient for testing cycles)
- **Production**: 30 days (compliance and debugging needs)

**Rationale**: Shorter retention periods significantly reduce CloudWatch storage costs for POC environments.

#### Log Level Configuration
- **Development/Staging**: INFO level (detailed logging for debugging)
- **Production**: WARN level (reduced log volume)

### 3. API Gateway Cost Controls

#### Throttling Configuration
- **Rate Limit**: 100 requests/second
- **Burst Limit**: 200 requests

**Rationale**: Prevents unexpected API Gateway charges from traffic spikes while allowing normal POC usage.

#### Caching
- **Disabled**: No caching enabled to avoid additional charges for POC usage

### 4. Database Connection Optimization

#### Connection Pool Settings
- **Minimum Connections**: 1
- **Maximum Connections**: 5
- **Idle Timeout**: 30 seconds
- **Connection Timeout**: 10 seconds

**Rationale**: Optimized for Lambda's stateless nature while minimizing database connection overhead.

## Security Configurations

### 1. IAM Role with Least-Privilege Access

#### Lambda Execution Role Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:region:account:log-group:/aws/lambda/stack-name-*:*"
    },
    {
      "Effect": "Allow", 
      "Action": [
        "rds-db:connect"
      ],
      "Resource": "arn:aws:rds-db:region:account:dbuser:database/username"
    },
    {
      "Effect": "Allow",
      "Action": [
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage"
      ],
      "Resource": "arn:aws:sqs:region:account:stack-name-dlq"
    }
  ]
}
```

**Security Benefits**:
- Specific resource ARNs instead of wildcards
- Regional restrictions on X-Ray permissions
- SQS permissions limited to specific Dead Letter Queue
- No unnecessary permissions for S3, DynamoDB, or other services

### 2. API Gateway Security

#### Request Validation
- **Body Validation**: Enabled
- **Parameter Validation**: Enabled

#### CORS Configuration
- **Allowed Origins**: Configurable (currently `*` for POC)
- **Allowed Methods**: Limited to required HTTP methods
- **Allowed Headers**: Specific headers only

#### Gateway Response Configuration
- **DEFAULT_4XX**: CORS headers for client errors
- **DEFAULT_5XX**: CORS headers for server errors  
- **THROTTLED**: Custom throttling response with CORS headers

### 3. Dead Letter Queue

#### Configuration
- **Message Retention**: 4 days (cost-optimized)
- **Visibility Timeout**: 60 seconds

**Purpose**: Captures failed Lambda invocations for debugging without indefinite retention costs.

## Monitoring and Alerting

### Cost Monitoring Alarms

#### High Duration Alarm
- **Threshold**: 25 seconds (83% of timeout)
- **Purpose**: Alerts when functions are running close to timeout, indicating potential cost inefficiency

#### High Error Rate Alarm  
- **Threshold**: 5 errors in 10 minutes
- **Purpose**: Alerts on error spikes that could indicate issues requiring immediate attention

### Cost Optimization Recommendations

#### Daily Cost Monitoring
1. Monitor Lambda invocation counts and duration
2. Review CloudWatch log ingestion volumes
3. Check API Gateway request counts
4. Monitor RDS connection usage

#### Weekly Cost Review
1. Analyze CloudWatch metrics for optimization opportunities
2. Review log retention policies
3. Assess reserved concurrency utilization
4. Evaluate memory allocation efficiency

#### Monthly Cost Optimization
1. Right-size Lambda memory based on actual usage
2. Adjust log retention periods based on requirements
3. Review and optimize database connection pooling
4. Consider upgrading to provisioned concurrency if usage patterns justify it

## Environment-Specific Configurations

### Development Environment
- **Focus**: Minimal cost, adequate debugging capability
- **Lambda Memory**: 512 MB
- **Log Retention**: 3 days
- **Concurrency**: 3

### Staging Environment  
- **Focus**: Production-like testing with cost controls
- **Lambda Memory**: 512 MB
- **Log Retention**: 7 days
- **Concurrency**: 5

### Production Environment
- **Focus**: Performance with cost optimization
- **Lambda Memory**: 1024 MB (can be adjusted based on metrics)
- **Log Retention**: 30 days
- **Concurrency**: 10

## Cost Estimation

### Expected Monthly Costs (POC Usage)

#### Development Environment
- **Lambda**: ~$5-10/month (assuming 10,000 invocations)
- **API Gateway**: ~$3-5/month
- **CloudWatch Logs**: ~$1-2/month
- **Total**: ~$9-17/month

#### Production Environment (Light Usage)
- **Lambda**: ~$15-25/month (assuming 50,000 invocations)
- **API Gateway**: ~$10-15/month
- **CloudWatch Logs**: ~$5-8/month
- **Total**: ~$30-48/month

*Note: Costs exclude RDS database charges as that's shared infrastructure*

## Configuration Management

### Parameter Overrides
All cost optimization settings are configurable via SAM parameters:

```bash
# Deploy with custom cost settings
sam deploy --parameter-overrides \
  LambdaMemorySize=256 \
  LambdaTimeout=15 \
  ReservedConcurrency=2 \
  LogRetentionDays=1
```

### Environment-Specific Deployment
```bash
# Deploy to development with cost-optimized settings
sam deploy --config-env dev

# Deploy to production with performance-optimized settings  
sam deploy --config-env prod
```

This configuration provides a balance between cost optimization and functionality, suitable for POC usage while maintaining the ability to scale for production workloads.