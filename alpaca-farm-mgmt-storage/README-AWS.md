# AWS Database Configuration for Alpaca Herd Storage

This document explains how to configure and use the AWS database configuration system for the alpaca herd storage application.

## 🚀 Quick Start

1. **Set up environment variables:**
   ```bash
   export AWS_REGION=us-east-1
   export AWS_ACCESS_KEY_ID=your-access-key
   export AWS_SECRET_ACCESS_KEY=your-secret-key
   export RDS_HOST=your-rds-instance.amazonaws.com
   export RDS_USERNAME=your-username
   export RDS_PASSWORD=your-password
   export S3_BACKUP_BUCKET=your-backup-bucket
   ```

2. **Test your configuration:**
   ```bash
   node demo/aws-config-simple.js
   ```

3. **Use in your application:**
   ```typescript
   import { getAWSConfigManager, getRDSManager, getS3BackupManager } from './src/aws';
   
   // Initialize AWS services
   const awsConfig = getAWSConfigManager();
   await awsConfig.initialize();
   
   // Connect to RDS database
   const rdsManager = getRDSManager();
   await rdsManager.initialize();
   
   // Set up S3 backups
   const s3Manager = getS3BackupManager();
   await s3Manager.initialize();
   ```

## 📋 Features

### ✅ AWS Configuration Management
- **Environment-based configuration** - Load settings from environment variables
- **Multiple credential methods** - Support for access keys, profiles, and instance profiles
- **Service client initialization** - Automatic setup of RDS, S3, and CloudWatch clients
- **Configuration validation** - Verify AWS credentials and service access
- **Connection testing** - Test connectivity to all AWS services

### ✅ RDS Database Management
- **PostgreSQL connection pooling** - Efficient database connection management
- **SSL/TLS encryption** - Secure database connections by default
- **IAM database authentication** - Use IAM roles instead of passwords
- **Health monitoring** - Real-time database health checks
- **CloudWatch metrics** - Integration with AWS CloudWatch for monitoring
- **Connection retry logic** - Automatic retry on connection failures

### ✅ S3 Backup Storage
- **Automated backups** - Upload database backups to S3
- **Server-side encryption** - AES256 or KMS encryption for backup files
- **Lifecycle management** - Automatic transition to cheaper storage classes
- **Progress tracking** - Monitor upload/download progress
- **Integrity verification** - SHA256 checksum validation
- **Batch operations** - Efficient bulk backup operations

## 🔧 Configuration

### AWS Credentials
Choose one authentication method:

**Method 1: Access Keys**
```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

**Method 2: AWS Profile**
```bash
export AWS_PROFILE=my-profile
export AWS_REGION=us-east-1
```

**Method 3: Instance Profile (Recommended for Production)**
```bash
export AWS_USE_INSTANCE_PROFILE=true
export AWS_REGION=us-east-1
```

### RDS Database Configuration
```bash
# Required
export RDS_HOST=your-rds-instance.amazonaws.com
export RDS_USERNAME=your-username
export RDS_PASSWORD=your-password  # Optional with IAM auth

# Optional
export RDS_INSTANCE_ID=your-instance-id
export RDS_PORT=5432
export RDS_DATABASE=alpaca_herd
export RDS_USE_IAM=true  # Use IAM authentication
export RDS_SSL=true
export RDS_MAX_CONNECTIONS=20
export RDS_CONNECTION_TIMEOUT=10000
```

### S3 Backup Configuration
```bash
# Required
export S3_BACKUP_BUCKET=your-backup-bucket

# Optional
export S3_BACKUP_PREFIX=alpaca-herd-backups
export S3_REGION=us-east-1
export S3_ENCRYPTION=AES256
export S3_STORAGE_CLASS=STANDARD_IA
```

### CloudWatch Configuration
```bash
export CLOUDWATCH_LOG_GROUP=/aws/alpaca-herd
export CLOUDWATCH_LOG_STREAM=application
export CLOUDWATCH_RETENTION_DAYS=30
export CLOUDWATCH_ENABLE_METRICS=true
export CLOUDWATCH_NAMESPACE=AlpacaHerd
```

## 🔐 Required AWS Permissions

Your AWS user/role needs these permissions:

### RDS Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBInstances"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "rds-db:connect"
      ],
      "Resource": "arn:aws:rds-db:region:account:dbuser:db-instance-id/username"
    }
  ]
}
```

### S3 Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:PutBucketLifecycleConfiguration"
      ],
      "Resource": [
        "arn:aws:s3:::your-backup-bucket",
        "arn:aws:s3:::your-backup-bucket/*"
      ]
    }
  ]
}
```

### CloudWatch Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "cloudwatch:GetMetricStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

## 📖 Usage Examples

### Basic Database Connection
```typescript
import { getRDSManager } from './src/aws';

const rdsManager = getRDSManager();
await rdsManager.initialize();

// Get a database client
const client = await rdsManager.getClient();

try {
  // Execute queries
  const result = await client.query('SELECT * FROM alpacas LIMIT 10');
  console.log('Alpacas:', result.rows);
} finally {
  // Always release the client
  client.release();
}
```

### Database Backup to S3
```typescript
import { getS3BackupManager } from './src/aws';

const s3Manager = getS3BackupManager();
await s3Manager.initialize();

// Upload a backup
const backupInfo = await s3Manager.uploadBackup(
  '/path/to/backup.sql',
  {
    backupId: 'daily-backup-' + Date.now(),
    timestamp: new Date(),
    type: 'full',
    description: 'Daily full database backup'
  },
  (progress) => {
    console.log(`Upload progress: ${progress.percentage.toFixed(1)}%`);
  }
);

console.log('Backup uploaded:', backupInfo.key);
```

### Health Monitoring
```typescript
import { getRDSManager } from './src/aws';

const rdsManager = getRDSManager();
await rdsManager.initialize();

// Check database health
const health = await rdsManager.performHealthCheck();
console.log('Database healthy:', health.healthy);
console.log('Response time:', health.latency + 'ms');

// Get CloudWatch metrics
const endTime = new Date();
const startTime = new Date(endTime.getTime() - 3600000); // 1 hour ago
const metrics = await rdsManager.getCloudWatchMetrics(startTime, endTime);
console.log('CPU Utilization:', metrics.CPUUtilization);
```

## 🧪 Testing

Run the test suite:
```bash
npm test -- src/aws/__tests__
```

Run the configuration demo:
```bash
node demo/aws-config-simple.js
```

Run the setup guide:
```bash
node examples/aws-setup-guide.js
```

## 🔍 Troubleshooting

### Common Issues

**"AWS configuration not initialized"**
- Make sure to call `await awsConfig.initialize()` before using AWS services

**"Access denied" errors**
- Check your AWS credentials and IAM permissions
- Verify your user/role has the required permissions listed above

**"RDS instance not found"**
- Verify `RDS_INSTANCE_ID` and `RDS_HOST` are correct
- Check that the RDS instance exists in the specified region

**"S3 bucket not found"**
- Make sure the S3 bucket exists and you have access
- Verify the bucket is in the correct region

**Connection timeouts**
- Check security groups allow connections on the database port
- Verify network ACLs and VPC routing
- Ensure your application can reach AWS services

### Debug Mode

Enable debug logging:
```bash
export AWS_SDK_LOAD_CONFIG=1
export AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE=1
```

## 🏗️ Architecture

The AWS configuration system consists of three main components:

1. **AWSConfigManager** - Central configuration and service client management
2. **RDSManager** - Database connection pooling and health monitoring
3. **S3BackupManager** - Backup storage and lifecycle management

All components are designed to work together seamlessly and can be used independently as needed.

## 🔒 Security Best Practices

- ✅ Use IAM roles instead of access keys when possible
- ✅ Enable SSL/TLS for all database connections
- ✅ Use IAM database authentication for RDS
- ✅ Enable S3 server-side encryption
- ✅ Set up proper S3 lifecycle policies
- ✅ Use least-privilege IAM policies
- ✅ Enable CloudWatch monitoring and alerting
- ✅ Rotate credentials regularly
- ✅ Use VPC endpoints for private connectivity

## 📚 Additional Resources

- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [AWS SDK for JavaScript Documentation](https://docs.aws.amazon.com/sdk-for-javascript/)
- [IAM Database Authentication](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)

---

🦙 **Happy alpaca herding with AWS!** 🦙