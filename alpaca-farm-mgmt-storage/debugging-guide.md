# AWS SAM Debugging Guide

This guide helps you troubleshoot common issues when deploying and running the Alpaca Farm Management Storage API on AWS Lambda.

## Quick Debugging Commands

### Essential Scripts
```bash
# Check deployment status
./scripts/status.sh

# View recent logs
./scripts/logs.sh

# Stream logs in real-time
./scripts/debug.sh

# Test deployed API
./scripts/test-deployed.sh

# Test local SAM API
./scripts/test-local.sh
```

## Common Issues and Solutions

### 1. Deployment Issues

#### Issue: SAM Build Fails
**Symptoms:**
- `sam build` command fails
- TypeScript compilation errors
- Missing dependencies

**Solutions:**
```bash
# Clean and rebuild
rm -rf .aws-sam dist node_modules
npm install
npm run build
sam build

# Check Node.js version
node --version  # Should be 18+

# Validate SAM template
sam validate --lint
```

#### Issue: CloudFormation Stack Creation Fails
**Symptoms:**
- Stack creation rollback
- IAM permission errors
- Resource limit exceeded

**Solutions:**
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name alpaca-farm-mgmt-storage-dev

# Verify IAM permissions
aws sts get-caller-identity
aws iam get-user

# Check service limits
aws service-quotas list-service-quotas \
  --service-code lambda
```

#### Issue: S3 Bucket Creation Fails
**Symptoms:**
- S3 bucket already exists error
- Access denied to S3

**Solutions:**
```bash
# Use existing bucket
sam deploy --s3-bucket your-existing-bucket

# Create bucket manually
aws s3 mb s3://your-unique-bucket-name

# Check S3 permissions
aws s3 ls
```

### 2. Lambda Function Issues

#### Issue: Lambda Function Timeout
**Symptoms:**
- 502 Bad Gateway errors
- Task timed out after X seconds
- Slow API responses

**Debugging Steps:**
```bash
# Check function configuration
aws lambda get-function-configuration \
  --function-name alpaca-farm-mgmt-storage-dev-AlpacaFarmApi

# View timeout logs
./scripts/logs.sh --filter "Task timed out"

# Monitor duration metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=alpaca-farm-mgmt-storage-dev-AlpacaFarmApi \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

**Solutions:**
- Increase Lambda timeout in `template.yaml`
- Optimize database queries
- Implement connection pooling
- Add database query timeouts

#### Issue: Lambda Cold Start Problems
**Symptoms:**
- First request very slow
- Intermittent timeouts
- Connection initialization errors

**Debugging:**
```bash
# Check cold start logs
./scripts/logs.sh --filter "INIT_START"

# Monitor init duration
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name InitDuration \
  --dimensions Name=FunctionName,Value=alpaca-farm-mgmt-storage-dev-AlpacaFarmApi \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

**Solutions:**
- Implement connection warming
- Use provisioned concurrency
- Optimize initialization code
- Reduce package size

#### Issue: Lambda Memory Issues
**Symptoms:**
- Out of memory errors
- Process exited before completing request
- Slow performance

**Debugging:**
```bash
# Check memory usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name MemoryUtilization \
  --dimensions Name=FunctionName,Value=alpaca-farm-mgmt-storage-dev-AlpacaFarmApi \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# View memory-related logs
./scripts/logs.sh --filter "Memory Size"
```

**Solutions:**
- Increase Lambda memory allocation
- Optimize memory usage in code
- Implement garbage collection
- Use streaming for large responses

### 3. Database Connection Issues

#### Issue: Database Connection Failures
**Symptoms:**
- Connection timeout errors
- Authentication failures
- SSL/TLS errors

**Debugging:**
```bash
# Test database connectivity
./scripts/test-rds-connection.sh

# Check database logs
./scripts/logs.sh --filter "database\|connection\|postgres"

# Verify environment variables
aws lambda get-function-configuration \
  --function-name alpaca-farm-mgmt-storage-dev-AlpacaFarmApi \
  --query 'Environment.Variables'
```

**Solutions:**
```bash
# Verify RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier your-db-instance

# Check security groups
aws ec2 describe-security-groups \
  --group-ids sg-xxxxxxxxx

# Test connection from Lambda VPC
# (if Lambda is in VPC)
```

#### Issue: Connection Pool Exhaustion
**Symptoms:**
- "Too many connections" errors
- Intermittent database errors
- Slow database responses

**Debugging:**
```bash
# Monitor active connections
./scripts/logs.sh --filter "connection pool\|max connections"

# Check database connection count
psql -h $RDS_HOST -U $RDS_USERNAME -d alpaca_herd \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

**Solutions:**
- Reduce connection pool size
- Implement connection cleanup
- Use connection multiplexing
- Monitor connection lifecycle

### 4. API Gateway Issues

#### Issue: API Gateway 502/503 Errors
**Symptoms:**
- Bad Gateway errors
- Service Unavailable errors
- Malformed Lambda response

**Debugging:**
```bash
# Check API Gateway logs
aws logs describe-log-groups \
  --log-group-name-prefix "API-Gateway-Execution-Logs"

# Test Lambda function directly
aws lambda invoke \
  --function-name alpaca-farm-mgmt-storage-dev-AlpacaFarmApi \
  --payload '{"httpMethod":"GET","path":"/api/v1/health"}' \
  response.json

cat response.json
```

**Solutions:**
- Verify Lambda response format
- Check Lambda function logs
- Validate API Gateway integration
- Test with simple Lambda response

#### Issue: CORS Errors
**Symptoms:**
- Cross-origin request blocked
- Missing CORS headers
- Preflight request failures

**Debugging:**
```bash
# Test CORS headers
curl -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS \
  https://your-api-gateway-url/api/v1/alpacas

# Check API Gateway CORS configuration
aws apigateway get-resource \
  --rest-api-id your-api-id \
  --resource-id your-resource-id
```

**Solutions:**
- Enable CORS in API Gateway
- Add CORS headers in Lambda response
- Configure preflight responses
- Verify allowed origins

### 5. Performance Issues

#### Issue: Slow API Responses
**Symptoms:**
- High response times
- Timeout errors
- Poor user experience

**Debugging:**
```bash
# Monitor API Gateway latency
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value=alpaca-farm-mgmt-storage-dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Profile database queries
./scripts/logs.sh --filter "query\|duration"

# Test individual endpoints
time curl https://your-api-gateway-url/api/v1/alpacas
```

**Solutions:**
- Optimize database queries
- Add database indexes
- Implement caching
- Use pagination
- Optimize Lambda memory

#### Issue: High Error Rates
**Symptoms:**
- Frequent 4xx/5xx errors
- Application crashes
- Data inconsistency

**Debugging:**
```bash
# Monitor error rates
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 4XXError \
  --dimensions Name=ApiName,Value=alpaca-farm-mgmt-storage-dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Analyze error patterns
./scripts/logs.sh --filter "ERROR\|error" --tail 100
```

## Advanced Debugging Techniques

### 1. Local Development Debugging

#### SAM Local API
```bash
# Start local API with debugging
sam local start-api --debug --log-file sam-local.log

# Test with local database
export RDS_HOST=localhost
export RDS_PORT=5432
sam local start-api
```

#### Lambda Function Testing
```bash
# Test specific Lambda function
sam local invoke AlpacaFarmApi \
  --event events/api-gateway-event.json \
  --debug

# Generate test events
sam local generate-event apigateway aws-proxy \
  --method GET \
  --path /api/v1/alpacas \
  > events/get-alpacas.json
```

### 2. Production Debugging

#### Enable X-Ray Tracing
```yaml
# In template.yaml
Globals:
  Function:
    Tracing: Active
```

```bash
# View X-Ray traces
aws xray get-trace-summaries \
  --time-range-type TimeRangeByStartTime \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S)
```

#### Enhanced Logging
```javascript
// Add structured logging
const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      requestId: context.awsRequestId,
      ...meta
    }));
  }
};
```

### 3. Database Debugging

#### Connection Monitoring
```sql
-- Monitor active connections
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  query
FROM pg_stat_activity 
WHERE state = 'active';

-- Check connection limits
SELECT setting FROM pg_settings WHERE name = 'max_connections';
```

#### Query Performance
```sql
-- Enable query logging (temporarily)
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;
SELECT pg_reload_conf();

-- View slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

## Monitoring and Alerting

### CloudWatch Alarms

#### Lambda Function Alarms
```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "Lambda-HighErrorRate" \
  --alarm-description "Lambda function error rate > 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=alpaca-farm-mgmt-storage-dev-AlpacaFarmApi

# High duration alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "Lambda-HighDuration" \
  --alarm-description "Lambda function duration > 25 seconds" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 25000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=alpaca-farm-mgmt-storage-dev-AlpacaFarmApi
```

#### API Gateway Alarms
```bash
# High latency alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "API-HighLatency" \
  --alarm-description "API Gateway latency > 10 seconds" \
  --metric-name Latency \
  --namespace AWS/ApiGateway \
  --statistic Average \
  --period 300 \
  --threshold 10000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ApiName,Value=alpaca-farm-mgmt-storage-dev
```

### Custom Metrics

#### Application Metrics
```javascript
// Custom CloudWatch metrics
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

const putMetric = async (metricName, value, unit = 'Count') => {
  await cloudwatch.putMetricData({
    Namespace: 'AlpacaFarm/Application',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date()
    }]
  }).promise();
};

// Usage
await putMetric('DatabaseConnections', connectionCount);
await putMetric('ApiRequests', 1);
```

## Troubleshooting Checklist

### Pre-Deployment
- [ ] AWS credentials configured
- [ ] Required environment variables set
- [ ] Database accessible and initialized
- [ ] SAM template validates successfully
- [ ] Dependencies installed and built

### Post-Deployment
- [ ] CloudFormation stack created successfully
- [ ] Lambda function deployed and configured
- [ ] API Gateway endpoints accessible
- [ ] Database connections working
- [ ] Basic API tests passing

### Performance
- [ ] Response times within acceptable limits
- [ ] Error rates below threshold
- [ ] Memory usage optimized
- [ ] Connection pooling configured
- [ ] Monitoring and alerting set up

## Getting Additional Help

### AWS Support Resources
- [AWS Lambda Troubleshooting](https://docs.aws.amazon.com/lambda/latest/dg/troubleshooting.html)
- [API Gateway Troubleshooting](https://docs.aws.amazon.com/apigateway/latest/developerguide/troubleshooting.html)
- [SAM CLI Troubleshooting](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/troubleshooting.html)

### Community Resources
- [AWS Developer Forums](https://forums.aws.amazon.com/)
- [Stack Overflow AWS Tags](https://stackoverflow.com/questions/tagged/amazon-web-services)
- [AWS re:Post](https://repost.aws/)

### Professional Support
- AWS Support Plans
- AWS Professional Services
- AWS Partner Network consultants

## Log Analysis Tips

### Useful Log Filters
```bash
# Error patterns
./scripts/logs.sh --filter "ERROR|WARN|Exception|timeout"

# Database issues
./scripts/logs.sh --filter "connection|database|postgres|sql"

# Performance issues
./scripts/logs.sh --filter "duration|timeout|memory|slow"

# Authentication issues
./scripts/logs.sh --filter "auth|unauthorized|forbidden|token"
```

### Log Parsing
```bash
# Extract error messages
./scripts/logs.sh --filter "ERROR" | jq -r '.message'

# Count error types
./scripts/logs.sh --filter "ERROR" | jq -r '.errorType' | sort | uniq -c

# Find slow requests
./scripts/logs.sh | jq 'select(.duration > 5000)'
```

Remember: Always check the most recent logs first, and use the debugging scripts provided for quick issue identification.