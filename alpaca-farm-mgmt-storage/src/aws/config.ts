import * as AWS from 'aws-sdk';

export interface AWSConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  profile?: string;
  useInstanceProfile?: boolean;
  
  // RDS Configuration
  rds?: {
    instanceIdentifier?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    useIAM?: boolean;
    ssl?: boolean;
    maxConnections?: number;
    connectionTimeout?: number;
    enablePerformanceInsights?: boolean;
    backupRetentionPeriod?: number;
    preferredBackupWindow?: string;
    preferredMaintenanceWindow?: string;
  };
  
  // S3 Configuration
  s3?: {
    bucketName?: string;
    backupPrefix?: string;
    region?: string;
    serverSideEncryption?: 'AES256' | 'aws:kms';
    kmsKeyId?: string;
    storageClass?: 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
    lifecycleRules?: S3LifecycleRule[];
  };
  
  // CloudWatch Configuration
  cloudWatch?: {
    logGroupName?: string;
    logStreamName?: string;
    retentionInDays?: number;
    enableMetrics?: boolean;
    namespace?: string;
  };
}

export interface S3LifecycleRule {
  id: string;
  status: 'Enabled' | 'Disabled';
  prefix?: string;
  transitions?: {
    days: number;
    storageClass: 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
  }[];
  expiration?: {
    days: number;
  };
}

export interface AWSServiceClients {
  rds: AWS.RDS;
  s3: AWS.S3;
  cloudWatch: AWS.CloudWatch;
}

export class AWSConfigurationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'AWSConfigurationError';
  }
}

export class AWSConfigManager {
  private config: AWSConfig;
  private clients: AWSServiceClients | null = null;
  private isConfigured = false;

  constructor(config?: AWSConfig) {
    this.config = config || this.loadFromEnvironment();
  }

  /**
   * Load AWS configuration from environment variables
   */
  private loadFromEnvironment(): AWSConfig {
    const env = process.env;
    
    return {
      region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1',
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      sessionToken: env.AWS_SESSION_TOKEN,
      profile: env.AWS_PROFILE,
      useInstanceProfile: env.AWS_USE_INSTANCE_PROFILE === 'true',
      
      rds: {
        instanceIdentifier: env.RDS_INSTANCE_ID,
        host: env.RDS_HOST,
        port: parseInt(env.RDS_PORT || '5432'),
        database: env.RDS_DATABASE || 'alpaca_herd',
        username: env.RDS_USERNAME,
        password: env.RDS_PASSWORD,
        useIAM: env.RDS_USE_IAM === 'true',
        ssl: env.RDS_SSL !== 'false', // Default to true
        maxConnections: parseInt(env.RDS_MAX_CONNECTIONS || '10'),
        connectionTimeout: parseInt(env.RDS_CONNECTION_TIMEOUT || '10000'),
        enablePerformanceInsights: env.RDS_ENABLE_PERFORMANCE_INSIGHTS === 'true',
        backupRetentionPeriod: parseInt(env.RDS_BACKUP_RETENTION_DAYS || '7'),
        preferredBackupWindow: env.RDS_BACKUP_WINDOW || '03:00-04:00',
        preferredMaintenanceWindow: env.RDS_MAINTENANCE_WINDOW || 'sun:04:00-sun:05:00',
      },
      
      s3: {
        bucketName: env.S3_BACKUP_BUCKET,
        backupPrefix: env.S3_BACKUP_PREFIX || 'alpaca-herd-backups',
        region: env.S3_REGION || env.AWS_REGION || 'us-east-1',
        serverSideEncryption: (env.S3_ENCRYPTION as 'AES256' | 'aws:kms') || 'AES256',
        kmsKeyId: env.S3_KMS_KEY_ID,
        storageClass: (env.S3_STORAGE_CLASS as any) || 'STANDARD',
        lifecycleRules: this.parseS3LifecycleRules(env.S3_LIFECYCLE_RULES),
      },
      
      cloudWatch: {
        logGroupName: env.CLOUDWATCH_LOG_GROUP || '/aws/alpaca-herd',
        logStreamName: env.CLOUDWATCH_LOG_STREAM || 'application',
        retentionInDays: parseInt(env.CLOUDWATCH_RETENTION_DAYS || '30'),
        enableMetrics: env.CLOUDWATCH_ENABLE_METRICS !== 'false',
        namespace: env.CLOUDWATCH_NAMESPACE || 'AlpacaHerd',
      },
    };
  }

  /**
   * Parse S3 lifecycle rules from environment variable
   */
  private parseS3LifecycleRules(rulesJson?: string): S3LifecycleRule[] {
    if (!rulesJson) {
      // Default lifecycle rules
      return [
        {
          id: 'backup-lifecycle',
          status: 'Enabled',
          prefix: 'alpaca-herd-backups/',
          transitions: [
            { days: 30, storageClass: 'STANDARD_IA' },
            { days: 90, storageClass: 'GLACIER' },
            { days: 365, storageClass: 'DEEP_ARCHIVE' }
          ],
          expiration: { days: 2555 } // 7 years
        }
      ];
    }

    try {
      return JSON.parse(rulesJson);
    } catch (error) {
      console.warn('Failed to parse S3 lifecycle rules, using defaults:', error);
      // Return default rules on parse error
      return [
        {
          id: 'backup-lifecycle',
          status: 'Enabled',
          prefix: 'alpaca-herd-backups/',
          transitions: [
            { days: 30, storageClass: 'STANDARD_IA' },
            { days: 90, storageClass: 'GLACIER' },
            { days: 365, storageClass: 'DEEP_ARCHIVE' }
          ],
          expiration: { days: 2555 } // 7 years
        }
      ];
    }
  }

  /**
   * Initialize AWS SDK configuration
   */
  async initialize(): Promise<void> {
    try {
      // Configure AWS SDK
      const awsConfig: any = {
        region: this.config.region,
      };

      // Set credentials based on configuration
      if (this.config.useInstanceProfile) {
        // Use instance profile credentials (no explicit credentials needed)
        awsConfig.credentials = new AWS.EC2MetadataCredentials();
      } else if (this.config.profile) {
        // Use named profile
        awsConfig.credentials = new AWS.SharedIniFileCredentials({ profile: this.config.profile });
      } else if (this.config.accessKeyId && this.config.secretAccessKey) {
        // Use explicit credentials
        awsConfig.credentials = new AWS.Credentials({
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
          sessionToken: this.config.sessionToken,
        });
      }
      // If none specified, AWS SDK will use default credential chain

      // Update global AWS configuration
      AWS.config.update(awsConfig);

      // Initialize service clients
      this.clients = {
        rds: new AWS.RDS({ region: this.config.region }),
        s3: new AWS.S3({ region: this.config.s3?.region || this.config.region }),
        cloudWatch: new AWS.CloudWatch({ region: this.config.region }),
      };

      this.isConfigured = true;
    } catch (error) {
      throw new AWSConfigurationError(
        `Failed to initialize AWS configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get AWS service clients
   */
  getClients(): AWSServiceClients {
    if (!this.clients || !this.isConfigured) {
      throw new AWSConfigurationError('AWS configuration not initialized. Call initialize() first.');
    }
    return this.clients;
  }

  /**
   * Get current AWS configuration
   */
  getConfig(): AWSConfig {
    return { ...this.config };
  }

  /**
   * Update AWS configuration
   */
  updateConfig(updates: Partial<AWSConfig>): void {
    this.config = { ...this.config, ...updates };
    this.isConfigured = false; // Require re-initialization
  }

  /**
   * Validate AWS configuration
   */
  async validateConfiguration(): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      if (!this.isConfigured) {
        await this.initialize();
      }

      const clients = this.getClients();

      // Validate AWS credentials and region
      try {
        await clients.s3.headBucket({ Bucket: 'test-bucket-validation' }).promise();
      } catch (error: any) {
        if (error.code !== 'NotFound' && error.code !== 'Forbidden') {
          result.errors.push(`AWS credentials validation failed: ${error.message}`);
        }
      }

      // Validate RDS configuration
      if (this.config.rds?.instanceIdentifier) {
        try {
          await clients.rds.describeDBInstances({
            DBInstanceIdentifier: this.config.rds.instanceIdentifier
          }).promise();
        } catch (error: any) {
          if (error.code === 'DBInstanceNotFoundFault') {
            result.warnings.push(`RDS instance '${this.config.rds.instanceIdentifier}' not found`);
          } else {
            result.errors.push(`RDS validation failed: ${error.message}`);
          }
        }
      }

      // Validate S3 bucket
      if (this.config.s3?.bucketName) {
        try {
          await clients.s3.headBucket({ Bucket: this.config.s3.bucketName }).promise();
        } catch (error: any) {
          if (error.code === 'NotFound') {
            result.warnings.push(`S3 bucket '${this.config.s3.bucketName}' not found`);
          } else if (error.code === 'Forbidden') {
            result.warnings.push(`No access to S3 bucket '${this.config.s3.bucketName}'`);
          } else {
            result.errors.push(`S3 validation failed: ${error.message}`);
          }
        }
      }

      // Validate CloudWatch log group
      if (this.config.cloudWatch?.logGroupName) {
        try {
          await clients.cloudWatch.listMetrics({ Namespace: 'AWS/RDS' }).promise();
        } catch (error: any) {
          result.warnings.push(`CloudWatch validation failed: ${error.message}`);
        }
      }

      result.valid = result.errors.length === 0;
    } catch (error) {
      result.valid = false;
      result.errors.push(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Test AWS service connections
   */
  async testConnections(): Promise<ConnectionTestResult> {
    const result: ConnectionTestResult = {
      rds: { connected: false },
      s3: { connected: false },
      cloudWatch: { connected: false },
    };

    try {
      if (!this.isConfigured) {
        await this.initialize();
      }

      const clients = this.getClients();

      // Test RDS connection
      try {
        if (this.config.rds?.instanceIdentifier) {
          const rdsResult = await clients.rds.describeDBInstances({
            DBInstanceIdentifier: this.config.rds.instanceIdentifier
          }).promise();
          
          result.rds.connected = true;
          result.rds.status = rdsResult.DBInstances?.[0]?.DBInstanceStatus;
        } else {
          result.rds.connected = true;
          result.rds.message = 'No RDS instance configured';
        }
      } catch (error: any) {
        result.rds.error = error.message;
      }

      // Test S3 connection
      try {
        if (this.config.s3?.bucketName) {
          await clients.s3.headBucket({ Bucket: this.config.s3.bucketName }).promise();
          result.s3.connected = true;
        } else {
          result.s3.connected = true;
          result.s3.message = 'No S3 bucket configured';
        }
      } catch (error: any) {
        result.s3.error = error.message;
      }

      // Test CloudWatch connection
      try {
        await clients.cloudWatch.listMetrics({ Namespace: 'AWS/RDS' }).promise();
        result.cloudWatch.connected = true;
      } catch (error: any) {
        result.cloudWatch.error = error.message;
      }

    } catch (error) {
      // Global connection test failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.rds.error = errorMessage;
      result.s3.error = errorMessage;
      result.cloudWatch.error = errorMessage;
    }

    return result;
  }

  /**
   * Get AWS region information
   */
  getRegion(): string {
    return this.config.region;
  }

  /**
   * Check if AWS is properly configured
   */
  isInitialized(): boolean {
    return this.isConfigured && this.clients !== null;
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConnectionTestResult {
  rds: {
    connected: boolean;
    status?: string;
    error?: string;
    message?: string;
  };
  s3: {
    connected: boolean;
    error?: string;
    message?: string;
  };
  cloudWatch: {
    connected: boolean;
    error?: string;
    message?: string;
  };
}

// Global AWS configuration manager instance
let globalAWSConfigManager: AWSConfigManager | null = null;

/**
 * Get the global AWS configuration manager instance
 */
export function getAWSConfigManager(config?: AWSConfig): AWSConfigManager {
  if (!globalAWSConfigManager) {
    globalAWSConfigManager = new AWSConfigManager(config);
  }
  return globalAWSConfigManager;
}

/**
 * Reset the global AWS configuration manager
 */
export function resetAWSConfigManager(): void {
  globalAWSConfigManager = null;
}

/**
 * Create AWS configuration from environment variables
 */
export function createAWSConfigFromEnvironment(): AWSConfig {
  const manager = new AWSConfigManager();
  return manager.getConfig();
}