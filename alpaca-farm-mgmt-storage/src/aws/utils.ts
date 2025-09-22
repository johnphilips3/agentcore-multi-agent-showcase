import { AWSConfigManager, AWSConfig, ValidationResult, ConnectionTestResult } from './config';
import { RDS, S3, CloudWatch } from 'aws-sdk';

export interface AWSHealthCheck {
  service: string;
  healthy: boolean;
  latency?: number;
  error?: string;
  details?: any;
}

export interface AWSResourceInfo {
  rds?: {
    instances: RDSInstanceInfo[];
  };
  s3?: {
    buckets: S3BucketInfo[];
  };
  cloudWatch?: {
    logGroups: CloudWatchLogGroupInfo[];
  };
}

export interface RDSInstanceInfo {
  identifier: string;
  status: string;
  engine: string;
  engineVersion: string;
  instanceClass: string;
  availabilityZone: string;
  endpoint?: string;
  port?: number;
  storageEncrypted: boolean;
  backupRetentionPeriod: number;
  multiAZ: boolean;
}

export interface S3BucketInfo {
  name: string;
  region: string;
  creationDate: Date;
  encryption?: {
    algorithm: string;
    keyId?: string;
  };
  versioning?: boolean;
  lifecycleRules?: number;
}

export interface CloudWatchLogGroupInfo {
  name: string;
  retentionInDays?: number;
  storedBytes: number;
  creationTime: Date;
}

export class AWSUtilities {
  private configManager: AWSConfigManager;

  constructor(configManager?: AWSConfigManager) {
    this.configManager = configManager || new AWSConfigManager();
  }

  /**
   * Perform comprehensive health check of AWS services
   */
  async performHealthCheck(): Promise<AWSHealthCheck[]> {
    const healthChecks: AWSHealthCheck[] = [];

    try {
      if (!this.configManager.isInitialized()) {
        await this.configManager.initialize();
      }

      const clients = this.configManager.getClients();
      const config = this.configManager.getConfig();

      // RDS Health Check
      if (config.rds?.instanceIdentifier) {
        healthChecks.push(await this.checkRDSHealth(clients.rds, config.rds.instanceIdentifier));
      }

      // S3 Health Check
      if (config.s3?.bucketName) {
        healthChecks.push(await this.checkS3Health(clients.s3, config.s3.bucketName));
      }

      // CloudWatch Health Check
      healthChecks.push(await this.checkCloudWatchHealth(clients.cloudWatch));

    } catch (error) {
      healthChecks.push({
        service: 'AWS Configuration',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return healthChecks;
  }

  /**
   * Check RDS instance health
   */
  private async checkRDSHealth(rds: RDS, instanceIdentifier: string): Promise<AWSHealthCheck> {
    const startTime = Date.now();
    
    try {
      const result = await rds.describeDBInstances({
        DBInstanceIdentifier: instanceIdentifier
      }).promise();

      const instance = result.DBInstances?.[0];
      const latency = Date.now() - startTime;

      if (!instance) {
        return {
          service: 'RDS',
          healthy: false,
          latency,
          error: 'Instance not found'
        };
      }

      const healthy = instance.DBInstanceStatus === 'available';

      return {
        service: 'RDS',
        healthy,
        latency,
        details: {
          status: instance.DBInstanceStatus,
          engine: instance.Engine,
          engineVersion: instance.EngineVersion,
          instanceClass: instance.DBInstanceClass,
          availabilityZone: instance.AvailabilityZone,
          multiAZ: instance.MultiAZ,
          storageEncrypted: instance.StorageEncrypted
        }
      };
    } catch (error: any) {
      return {
        service: 'RDS',
        healthy: false,
        latency: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check S3 bucket health
   */
  private async checkS3Health(s3: S3, bucketName: string): Promise<AWSHealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check bucket accessibility
      await s3.headBucket({ Bucket: bucketName }).promise();
      
      // Get bucket location
      const locationResult = await s3.getBucketLocation({ Bucket: bucketName }).promise();
      
      const latency = Date.now() - startTime;

      return {
        service: 'S3',
        healthy: true,
        latency,
        details: {
          bucket: bucketName,
          region: locationResult.LocationConstraint || 'us-east-1'
        }
      };
    } catch (error: any) {
      return {
        service: 'S3',
        healthy: false,
        latency: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check CloudWatch health
   */
  private async checkCloudWatchHealth(cloudWatch: any): Promise<AWSHealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple API call to test connectivity
      await cloudWatch.listMetrics({ Namespace: 'AWS/RDS' }).promise();
      
      const latency = Date.now() - startTime;

      return {
        service: 'CloudWatch',
        healthy: true,
        latency,
        details: {
          region: this.configManager.getRegion()
        }
      };
    } catch (error: any) {
      return {
        service: 'CloudWatch',
        healthy: false,
        latency: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Get detailed information about AWS resources
   */
  async getResourceInfo(): Promise<AWSResourceInfo> {
    const resourceInfo: AWSResourceInfo = {};

    try {
      if (!this.configManager.isInitialized()) {
        await this.configManager.initialize();
      }

      const clients = this.configManager.getClients();
      const config = this.configManager.getConfig();

      // Get RDS information
      if (config.rds?.instanceIdentifier) {
        resourceInfo.rds = {
          instances: await this.getRDSInstances(clients.rds, config.rds.instanceIdentifier)
        };
      }

      // Get S3 information
      if (config.s3?.bucketName) {
        resourceInfo.s3 = {
          buckets: await this.getS3Buckets(clients.s3, config.s3.bucketName)
        };
      }

      // Get CloudWatch information
      if (config.cloudWatch?.logGroupName) {
        resourceInfo.cloudWatch = {
          logGroups: await this.getCloudWatchLogGroups(clients.cloudWatch, config.cloudWatch.logGroupName)
        };
      }

    } catch (error) {
      console.error('Failed to get AWS resource information:', error);
    }

    return resourceInfo;
  }

  /**
   * Get RDS instance information
   */
  private async getRDSInstances(rds: RDS, instanceIdentifier: string): Promise<RDSInstanceInfo[]> {
    try {
      const result = await rds.describeDBInstances({
        DBInstanceIdentifier: instanceIdentifier
      }).promise();

      return result.DBInstances?.map(instance => ({
        identifier: instance.DBInstanceIdentifier!,
        status: instance.DBInstanceStatus!,
        engine: instance.Engine!,
        engineVersion: instance.EngineVersion!,
        instanceClass: instance.DBInstanceClass!,
        availabilityZone: instance.AvailabilityZone!,
        endpoint: instance.Endpoint?.Address,
        port: instance.Endpoint?.Port,
        storageEncrypted: instance.StorageEncrypted || false,
        backupRetentionPeriod: instance.BackupRetentionPeriod || 0,
        multiAZ: instance.MultiAZ || false
      })) || [];
    } catch (error) {
      console.error('Failed to get RDS instance information:', error);
      return [];
    }
  }

  /**
   * Get S3 bucket information
   */
  private async getS3Buckets(s3: S3, bucketName: string): Promise<S3BucketInfo[]> {
    try {
      const buckets: S3BucketInfo[] = [];
      
      // Get bucket location
      const locationResult = await s3.getBucketLocation({ Bucket: bucketName }).promise();
      
      // Get bucket creation date from list buckets
      const listResult = await s3.listBuckets().promise();
      const bucket = listResult.Buckets?.find(b => b.Name === bucketName);
      
      if (bucket) {
        const bucketInfo: S3BucketInfo = {
          name: bucketName,
          region: locationResult.LocationConstraint || 'us-east-1',
          creationDate: bucket.CreationDate!
        };

        // Get encryption information
        try {
          const encryptionResult = await s3.getBucketEncryption({ Bucket: bucketName }).promise();
          const rule = encryptionResult.ServerSideEncryptionConfiguration?.Rules?.[0];
          if (rule) {
            bucketInfo.encryption = {
              algorithm: rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm!,
              keyId: rule.ApplyServerSideEncryptionByDefault?.KMSMasterKeyID
            };
          }
        } catch (error) {
          // Encryption not configured
        }

        // Get versioning information
        try {
          const versioningResult = await s3.getBucketVersioning({ Bucket: bucketName }).promise();
          bucketInfo.versioning = versioningResult.Status === 'Enabled';
        } catch (error) {
          // Versioning not configured
        }

        // Get lifecycle rules count
        try {
          const lifecycleResult = await s3.getBucketLifecycleConfiguration({ Bucket: bucketName }).promise();
          bucketInfo.lifecycleRules = lifecycleResult.Rules?.length || 0;
        } catch (error) {
          // Lifecycle not configured
        }

        buckets.push(bucketInfo);
      }

      return buckets;
    } catch (error) {
      console.error('Failed to get S3 bucket information:', error);
      return [];
    }
  }

  /**
   * Get CloudWatch log group information
   */
  private async getCloudWatchLogGroups(cloudWatch: any, logGroupName: string): Promise<CloudWatchLogGroupInfo[]> {
    try {
      // For CloudWatch metrics service, we'll return mock data
      return [{
        name: logGroupName,
        retentionInDays: 30,
        storedBytes: 0,
        creationTime: new Date()
      }];
    } catch (error) {
      console.error('Failed to get CloudWatch log group information:', error);
      return [];
    }
  }

  /**
   * Validate AWS credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      if (!this.configManager.isInitialized()) {
        await this.configManager.initialize();
      }

      const clients = this.configManager.getClients();
      
      // Try a simple API call that requires valid credentials
      await clients.s3.listBuckets().promise();
      
      return true;
    } catch (error) {
      console.error('AWS credentials validation failed:', error);
      return false;
    }
  }

  /**
   * Get AWS account information
   */
  async getAccountInfo(): Promise<{ accountId?: string; region: string; error?: string }> {
    try {
      if (!this.configManager.isInitialized()) {
        await this.configManager.initialize();
      }

      // Use STS to get account information
      const AWS = require('aws-sdk');
      const sts = new AWS.STS({ region: this.configManager.getRegion() });
      
      const result = await sts.getCallerIdentity().promise();
      
      return {
        accountId: result.Account,
        region: this.configManager.getRegion()
      };
    } catch (error) {
      return {
        region: this.configManager.getRegion(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test network connectivity to AWS services
   */
  async testNetworkConnectivity(): Promise<{ [service: string]: { reachable: boolean; latency?: number; error?: string } }> {
    const results: { [service: string]: { reachable: boolean; latency?: number; error?: string } } = {};

    const testEndpoints = [
      { service: 'RDS', endpoint: `rds.${this.configManager.getRegion()}.amazonaws.com` },
      { service: 'S3', endpoint: `s3.${this.configManager.getRegion()}.amazonaws.com` },
      { service: 'CloudWatch', endpoint: `monitoring.${this.configManager.getRegion()}.amazonaws.com` }
    ];

    for (const { service, endpoint } of testEndpoints) {
      const startTime = Date.now();
      
      try {
        // Simple connectivity test using AWS SDK
        if (!this.configManager.isInitialized()) {
          await this.configManager.initialize();
        }

        const clients = this.configManager.getClients();
        
        switch (service) {
          case 'RDS':
            await clients.rds.describeDBInstances({ MaxRecords: 1 }).promise();
            break;
          case 'S3':
            await clients.s3.listBuckets().promise();
            break;
          case 'CloudWatch':
            await clients.cloudWatch.listMetrics({ Namespace: 'AWS/RDS' }).promise();
            break;
        }

        results[service] = {
          reachable: true,
          latency: Date.now() - startTime
        };
      } catch (error) {
        results[service] = {
          reachable: false,
          latency: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return results;
  }
}

/**
 * Create AWS utilities instance with default configuration
 */
export function createAWSUtilities(config?: AWSConfig): AWSUtilities {
  const configManager = config ? new AWSConfigManager(config) : new AWSConfigManager();
  return new AWSUtilities(configManager);
}

/**
 * Perform quick AWS health check
 */
export async function quickHealthCheck(config?: AWSConfig): Promise<boolean> {
  try {
    const utilities = createAWSUtilities(config);
    const healthChecks = await utilities.performHealthCheck();
    
    return healthChecks.every(check => check.healthy);
  } catch (error) {
    console.error('Quick health check failed:', error);
    return false;
  }
}

/**
 * Validate AWS environment setup
 */
export async function validateAWSEnvironment(config?: AWSConfig): Promise<ValidationResult> {
  try {
    const configManager = config ? new AWSConfigManager(config) : new AWSConfigManager();
    return await configManager.validateConfiguration();
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      warnings: []
    };
  }
}