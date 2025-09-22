#!/usr/bin/env node

/**
 * AWS Database Configuration Demo (JavaScript Version)
 * 
 * This script demonstrates how to configure and use the AWS database configuration
 * for the alpaca herd storage system.
 */
require('dotenv').config()
console.log('🚀 AWS Database Configuration Demo\n');

async function runAWSConfigDemo() {
    try {
        // Check if AWS SDK is available
        let AWS;
        try {
            AWS = require('aws-sdk');
            console.log('✅ AWS SDK loaded successfully');
        } catch (error) {
            console.log('❌ AWS SDK not available. Run "npm install" to install dependencies.');
            return;
        }

        // 1. Display current environment configuration
        console.log('\n1. Current Environment Configuration:');
        console.log(`   - AWS_REGION: ${process.env.AWS_REGION || 'us-east-1 (default)'}`);
        console.log(`   - AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set'}`);
        console.log(`   - AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set'}`);
        console.log(`   - AWS_PROFILE: ${process.env.AWS_PROFILE || 'Not set'}`);

        // 2. Initialize AWS Configuration
        console.log('\n2. Initializing AWS Configuration...');

        // Enable config file loading for profiles
        process.env.AWS_SDK_LOAD_CONFIG = '1';

        const awsConfig = {
            region: process.env.AWS_REGION || 'us-east-1'
        };

        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            awsConfig.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
            awsConfig.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
            console.log('   ✅ Using explicit AWS credentials');
        } else if (process.env.AWS_PROFILE) {
            console.log(`   ✅ Using AWS profile: ${process.env.AWS_PROFILE}`);
            awsConfig.credentials = new AWS.SsoCredentials({ profile: process.env.AWS_PROFILE });
        } else {
            console.log('   ⚠️  No explicit credentials found, using default credential chain');
        }

        // Update AWS configuration
        AWS.config.update(awsConfig);
        console.log(`   ✅ AWS SDK configured for region: ${awsConfig.region}`);

        // Test credentials immediately
        console.log('\n2.1. Testing Credential Access...');
        try {
            const sts = new AWS.STS();
            const identity = await sts.getCallerIdentity().promise();
            console.log(`   ✅ Credentials working! Account: ${identity.Account}, User: ${identity.Arn}`);
        } catch (error) {
            console.log(`   ❌ Credential test failed: ${error.message}`);
            console.log('   💡 This explains why the service calls are failing');
        }

        // 3. Initialize AWS Service Clients
        console.log('\n3. Initializing AWS Service Clients...');
        const rds = new AWS.RDS({ region: awsConfig.region });
        const s3 = new AWS.S3({ region: awsConfig.region });
        const cloudWatch = new AWS.CloudWatch({ region: awsConfig.region });
        console.log('   ✅ RDS client initialized');
        console.log('   ✅ S3 client initialized');
        console.log('   ✅ CloudWatch client initialized');

        // 4. Display RDS Configuration
        console.log('\n4. RDS Database Configuration:');
        console.log(`   - Instance ID: ${process.env.RDS_INSTANCE_ID || 'Not configured'}`);
        console.log(`   - Host: ${process.env.RDS_HOST || 'Not configured'}`);
        console.log(`   - Port: ${process.env.RDS_PORT || '5432 (default)'}`);
        console.log(`   - Database: ${process.env.RDS_DATABASE || 'alpaca_herd (default)'}`);
        console.log(`   - Username: ${process.env.RDS_USERNAME || 'Not configured'}`);
        console.log(`   - Password: ${process.env.RDS_PASSWORD ? '✅ Set' : '❌ Not set'}`);
        console.log(`   - Use IAM: ${process.env.RDS_USE_IAM === 'true' ? 'Yes' : 'No'}`);
        console.log(`   - SSL: ${process.env.RDS_SSL !== 'false' ? 'Yes' : 'No'}`);
        console.log(`   - Max Connections: ${process.env.RDS_MAX_CONNECTIONS || '10 (default)'}`);

        // 5. Test RDS Connection (if configured)
        console.log('\n5. Testing RDS Connection...');
        if (process.env.RDS_INSTANCE_ID) {
            try {
                const result = await rds.describeDBInstances({
                    DBInstanceIdentifier: process.env.RDS_INSTANCE_ID
                }).promise();

                const instance = result.DBInstances[0];
                console.log(`   ✅ RDS Instance found: ${instance.DBInstanceIdentifier}`);
                console.log(`   - Status: ${instance.DBInstanceStatus}`);
                console.log(`   - Engine: ${instance.Engine} ${instance.EngineVersion}`);
                console.log(`   - Instance Class: ${instance.DBInstanceClass}`);
                console.log(`   - Endpoint: ${instance.Endpoint?.Address}:${instance.Endpoint?.Port}`);
                console.log(`   - Multi-AZ: ${instance.MultiAZ ? 'Yes' : 'No'}`);
                console.log(`   - Storage Encrypted: ${instance.StorageEncrypted ? 'Yes' : 'No'}`);
            } catch (error) {
                console.log(`   ❌ RDS Connection failed: ${error.message}`);
            }
        } else {
            console.log('   ⚠️  RDS_INSTANCE_ID not configured, skipping RDS test');
        }

        // 6. Display S3 Configuration
        console.log('\n6. S3 Backup Configuration:');
        console.log(`   - Bucket Name: ${process.env.S3_BACKUP_BUCKET || 'Not configured'}`);
        console.log(`   - Backup Prefix: ${process.env.S3_BACKUP_PREFIX || 'alpaca-herd-backups (default)'}`);
        console.log(`   - Region: ${process.env.S3_REGION || awsConfig.region + ' (default)'}`);
        console.log(`   - Encryption: ${process.env.S3_ENCRYPTION || 'AES256 (default)'}`);
        console.log(`   - Storage Class: ${process.env.S3_STORAGE_CLASS || 'STANDARD (default)'}`);

        // 7. Test S3 Connection (if configured)
        console.log('\n7. Testing S3 Connection...');
        if (process.env.S3_BACKUP_BUCKET) {
            try {
                await s3.headBucket({ Bucket: process.env.S3_BACKUP_BUCKET }).promise();
                console.log(`   ✅ S3 Bucket accessible: ${process.env.S3_BACKUP_BUCKET}`);

                // Try to list some objects
                const objects = await s3.listObjectsV2({
                    Bucket: process.env.S3_BACKUP_BUCKET,
                    MaxKeys: 5
                }).promise();
                console.log(`   - Objects in bucket: ${objects.KeyCount || 0}`);
            } catch (error) {
                console.log(`   ❌ S3 Connection failed: ${error.message}`);
            }
        } else {
            console.log('   ⚠️  S3_BACKUP_BUCKET not configured, skipping S3 test');
        }

        // 8. Display CloudWatch Configuration
        console.log('\n8. CloudWatch Configuration:');
        console.log(`   - Log Group: ${process.env.CLOUDWATCH_LOG_GROUP || '/aws/alpaca-herd (default)'}`);
        console.log(`   - Log Stream: ${process.env.CLOUDWATCH_LOG_STREAM || 'application (default)'}`);
        console.log(`   - Retention Days: ${process.env.CLOUDWATCH_RETENTION_DAYS || '30 (default)'}`);
        console.log(`   - Enable Metrics: ${process.env.CLOUDWATCH_ENABLE_METRICS !== 'false' ? 'Yes' : 'No'}`);
        console.log(`   - Namespace: ${process.env.CLOUDWATCH_NAMESPACE || 'AlpacaHerd (default)'}`);

        // 9. Test CloudWatch Connection
        console.log('\n9. Testing CloudWatch Connection...');
        try {
            const metrics = await cloudWatch.listMetrics({
                Namespace: 'AWS/RDS'
            }).promise();
            console.log('   ✅ CloudWatch accessible');
            console.log(`   - Available metrics: ${metrics.Metrics?.length || 0} found`);
        } catch (error) {
            console.log(`   ❌ CloudWatch Connection failed: ${error.message}`);
        }

        // 10. Connection Summary
        console.log('\n10. Connection Summary:');
        const hasCredentials = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE;
        const hasRDS = process.env.RDS_INSTANCE_ID && process.env.RDS_HOST;
        const hasS3 = process.env.S3_BACKUP_BUCKET;

        console.log(`   - AWS Credentials: ${hasCredentials ? '✅ Configured' : '❌ Missing'}`);
        console.log(`   - RDS Database: ${hasRDS ? '✅ Configured' : '❌ Missing'}`);
        console.log(`   - S3 Backups: ${hasS3 ? '✅ Configured' : '❌ Missing'}`);

        // 11. Sample Database Connection String
        console.log('\n11. Sample Database Connection String:');
        const dbHost = process.env.RDS_HOST || 'your-rds-instance.amazonaws.com';
        const dbPort = process.env.RDS_PORT || '5432';
        const dbName = process.env.RDS_DATABASE || 'alpaca_herd';
        const dbUser = process.env.RDS_USERNAME || 'your-username';
        console.log(`   postgresql://${dbUser}:PASSWORD@${dbHost}:${dbPort}/${dbName}?sslmode=require`);

        // 12. Next Steps
        console.log('\n12. Next Steps:');
        if (!hasCredentials) {
            console.log('   1. Set up AWS credentials (see examples/aws-setup-guide.js)');
        }
        if (!hasRDS) {
            console.log('   2. Configure RDS database connection');
        }
        if (!hasS3) {
            console.log('   3. Configure S3 backup bucket');
        }
        if (hasCredentials && hasRDS && hasS3) {
            console.log('   ✅ Your AWS configuration is complete!');
            console.log('   - You can now use the TypeScript AWS modules in your application');
            console.log('   - Import from: import { getAWSConfigManager, getRDSManager, getS3BackupManager } from "./src/aws"');
        }

        console.log('\n✅ AWS Configuration Demo completed successfully!');

    } catch (error) {
        console.error('\n❌ Demo failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the demo
runAWSConfigDemo().catch(console.error);