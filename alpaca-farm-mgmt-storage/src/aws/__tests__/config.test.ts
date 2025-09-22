import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as AWS from 'aws-sdk';
import {
  AWSConfigManager,
  AWSConfigurationError,
  getAWSConfigManager,
  resetAWSConfigManager,
  createAWSConfigFromEnvironment,
  ValidationResult,
  ConnectionTestResult,
  AWSConfig
} from '../config';

// Mock AWS SDK
vi.mock('aws-sdk', () => ({
  default: {
    config: {
      update: vi.fn()
    },
    RDS: vi.fn(),
    S3: vi.fn(),
    CloudWatch: vi.fn(),
    EC2MetadataCredentials: vi.fn(),
    SharedIniFileCredentials: vi.fn(),
    Credentials: vi.fn()
  },
  config: {
    update: vi.fn()
  },
  RDS: vi.fn(),
  S3: vi.fn(),
  CloudWatch: vi.fn(),
  EC2MetadataCredentials: vi.fn(),
  SharedIniFileCredentials: vi.fn(),
  Credentials: vi.fn()
}));

describe('AWSConfigManager', () => {
  let configManager: AWSConfigManager;
  let mockRDS: any;
  let mockS3: any;
  let mockCloudWatch: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Store original environment
    originalEnv = { ...process.env };
    
    // Setup mock AWS services
    mockRDS = {
      describeDBInstances: vi.fn(),
      getAuthToken: vi.fn()
    };
    mockS3 = {
      headBucket: vi.fn(),
      getBucketLocation: vi.fn(),
      listBuckets: vi.fn()
    };
    mockCloudWatch = {
      listMetrics: vi.fn()
    };

    // Mock AWS constructors
    (AWS.RDS as any).mockImplementation(() => mockRDS);
    (AWS.S3 as any).mockImplementation(() => mockS3);
    (AWS.CloudWatch as any).mockImplementation(() => mockCloudWatch);

    resetAWSConfigManager();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    resetAWSConfigManager();
  });

  describe('constructor', () => {
    it('should create instance with provided config', () => {
      const config: AWSConfig = {
        region: 'us-west-2',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      };

      configManager = new AWSConfigManager(config);
      
      expect(configManager.getConfig()).toEqual(expect.objectContaining(config));
    });

    it('should load config from environment when no config provided', () => {
      process.env.AWS_REGION = 'eu-west-1';
      process.env.AWS_ACCESS_KEY_ID = 'env-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'env-secret';
      process.env.RDS_HOST = 'test-rds-host';
      process.env.S3_BACKUP_BUCKET = 'test-bucket';

      configManager = new AWSConfigManager();
      const config = configManager.getConfig();

      expect(config.region).toBe('eu-west-1');
      expect(config.accessKeyId).toBe('env-key');
      expect(config.secretAccessKey).toBe('env-secret');
      expect(config.rds?.host).toBe('test-rds-host');
      expect(config.s3?.bucketName).toBe('test-bucket');
    });

    it('should use default values when environment variables are not set', () => {
      // Clear relevant environment variables
      delete process.env.AWS_REGION;
      delete process.env.AWS_DEFAULT_REGION;

      configManager = new AWSConfigManager();
      const config = configManager.getConfig();

      expect(config.region).toBe('us-east-1');
      expect(config.rds?.port).toBe(5432);
      expect(config.rds?.database).toBe('alpaca_herd');
      expect(config.rds?.ssl).toBe(true);
    });
  });

  describe('loadFromEnvironment', () => {
    it('should parse RDS configuration from environment', () => {
      process.env.RDS_INSTANCE_ID = 'test-instance';
      process.env.RDS_HOST = 'rds.example.com';
      process.env.RDS_PORT = '3306';
      process.env.RDS_DATABASE = 'test_db';
      process.env.RDS_USERNAME = 'test_user';
      process.env.RDS_PASSWORD = 'test_pass';
      process.env.RDS_USE_IAM = 'true';
      process.env.RDS_SSL = 'false';
      process.env.RDS_MAX_CONNECTIONS = '20';

      configManager = new AWSConfigManager();
      const config = configManager.getConfig();

      expect(config.rds).toEqual({
        instanceIdentifier: 'test-instance',
        host: 'rds.example.com',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
        useIAM: true,
        ssl: false,
        maxConnections: 20,
        connectionTimeout: 10000,
        enablePerformanceInsights: false,
        backupRetentionPeriod: 7,
        preferredBackupWindow: '03:00-04:00',
        preferredMaintenanceWindow: 'sun:04:00-sun:05:00'
      });
    });

    it('should parse S3 configuration from environment', () => {
      process.env.S3_BACKUP_BUCKET = 'my-backup-bucket';
      process.env.S3_BACKUP_PREFIX = 'custom-prefix';
      process.env.S3_REGION = 'us-west-1';
      process.env.S3_ENCRYPTION = 'aws:kms';
      process.env.S3_KMS_KEY_ID = 'test-key-id';
      process.env.S3_STORAGE_CLASS = 'GLACIER';

      configManager = new AWSConfigManager();
      const config = configManager.getConfig();

      expect(config.s3).toEqual({
        bucketName: 'my-backup-bucket',
        backupPrefix: 'custom-prefix',
        region: 'us-west-1',
        serverSideEncryption: 'aws:kms',
        kmsKeyId: 'test-key-id',
        storageClass: 'GLACIER',
        lifecycleRules: expect.any(Array)
      });
    });

    it('should parse CloudWatch configuration from environment', () => {
      process.env.CLOUDWATCH_LOG_GROUP = '/custom/log-group';
      process.env.CLOUDWATCH_LOG_STREAM = 'custom-stream';
      process.env.CLOUDWATCH_RETENTION_DAYS = '90';
      process.env.CLOUDWATCH_ENABLE_METRICS = 'false';
      process.env.CLOUDWATCH_NAMESPACE = 'CustomNamespace';

      configManager = new AWSConfigManager();
      const config = configManager.getConfig();

      expect(config.cloudWatch).toEqual({
        logGroupName: '/custom/log-group',
        logStreamName: 'custom-stream',
        retentionInDays: 90,
        enableMetrics: false,
        namespace: 'CustomNamespace'
      });
    });
  });

  describe('parseS3LifecycleRules', () => {
    it('should return default lifecycle rules when no JSON provided', () => {
      configManager = new AWSConfigManager();
      const config = configManager.getConfig();

      expect(config.s3?.lifecycleRules).toHaveLength(1);
      expect(config.s3?.lifecycleRules?.[0]).toEqual({
        id: 'backup-lifecycle',
        status: 'Enabled',
        prefix: 'alpaca-herd-backups/',
        transitions: [
          { days: 30, storageClass: 'STANDARD_IA' },
          { days: 90, storageClass: 'GLACIER' },
          { days: 365, storageClass: 'DEEP_ARCHIVE' }
        ],
        expiration: { days: 2555 }
      });
    });

    it('should parse valid JSON lifecycle rules', () => {
      const customRules = [
        {
          id: 'custom-rule',
          status: 'Enabled',
          prefix: 'custom-prefix/',
          transitions: [{ days: 60, storageClass: 'GLACIER' }],
          expiration: { days: 1000 }
        }
      ];

      process.env.S3_LIFECYCLE_RULES = JSON.stringify(customRules);

      configManager = new AWSConfigManager();
      const config = configManager.getConfig();

      expect(config.s3?.lifecycleRules).toEqual(customRules);
    });

    it('should return default rules when JSON parsing fails', () => {
      process.env.S3_LIFECYCLE_RULES = 'invalid-json';

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      configManager = new AWSConfigManager();
      const config = configManager.getConfig();

      expect(config.s3?.lifecycleRules).toHaveLength(1);
      expect(config.s3?.lifecycleRules?.[0].id).toBe('backup-lifecycle');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse S3 lifecycle rules, using defaults:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      configManager = new AWSConfigManager({
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      });
    });

    it('should initialize AWS SDK with explicit credentials', async () => {
      await configManager.initialize();

      expect(AWS.config.update).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: expect.any(Object)
      });
      expect(AWS.Credentials).toHaveBeenCalledWith({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        sessionToken: undefined
      });
    });

    it('should initialize AWS SDK with instance profile credentials', async () => {
      configManager.updateConfig({ useInstanceProfile: true });

      await configManager.initialize();

      expect(AWS.config.update).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: expect.any(Object)
      });
      expect(AWS.EC2MetadataCredentials).toHaveBeenCalled();
    });

    it('should initialize AWS SDK with named profile', async () => {
      configManager.updateConfig({ profile: 'test-profile' });

      await configManager.initialize();

      expect(AWS.config.update).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: expect.any(Object)
      });
      expect(AWS.SharedIniFileCredentials).toHaveBeenCalledWith({ profile: 'test-profile' });
    });

    it('should create service clients after initialization', async () => {
      await configManager.initialize();

      const clients = configManager.getClients();
      expect(clients.rds).toBeDefined();
      expect(clients.s3).toBeDefined();
      expect(clients.cloudWatch).toBeDefined();
    });

    it('should throw AWSConfigurationError on initialization failure', async () => {
      (AWS.config.update as any).mockImplementation(() => {
        throw new Error('AWS SDK error');
      });

      await expect(configManager.initialize()).rejects.toThrow(AWSConfigurationError);
      await expect(configManager.initialize()).rejects.toThrow('Failed to initialize AWS configuration');
    });
  });

  describe('getClients', () => {
    beforeEach(() => {
      configManager = new AWSConfigManager({ region: 'us-east-1' });
    });

    it('should return clients after initialization', async () => {
      await configManager.initialize();
      
      const clients = configManager.getClients();
      expect(clients.rds).toBeDefined();
      expect(clients.s3).toBeDefined();
      expect(clients.cloudWatch).toBeDefined();
    });

    it('should throw error when not initialized', () => {
      expect(() => configManager.getClients()).toThrow(AWSConfigurationError);
      expect(() => configManager.getClients()).toThrow('AWS configuration not initialized');
    });
  });

  describe('validateConfiguration', () => {
    beforeEach(() => {
      configManager = new AWSConfigManager({
        region: 'us-east-1',
        rds: { instanceIdentifier: 'test-instance' },
        s3: { bucketName: 'test-bucket' },
        cloudWatch: { logGroupName: '/test/log-group' }
      });
    });

    it('should return valid result when all services are accessible', async () => {
      mockS3.headBucket.mockReturnValue({
        promise: vi.fn().mockResolvedValue({})
      });
      mockRDS.describeDBInstances.mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          DBInstances: [{ DBInstanceStatus: 'available' }]
        })
      });
      mockCloudWatch.listMetrics.mockReturnValue({
        promise: vi.fn().mockResolvedValue({})
      });

      const result = await configManager.validateConfiguration();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle RDS instance not found as warning', async () => {
      mockS3.headBucket.mockReturnValue({
        promise: vi.fn().mockResolvedValue({})
      });
      mockRDS.describeDBInstances.mockReturnValue({
        promise: vi.fn().mockRejectedValue({ code: 'DBInstanceNotFoundFault' })
      });
      mockCloudWatch.listMetrics.mockReturnValue({
        promise: vi.fn().mockResolvedValue({})
      });

      const result = await configManager.validateConfiguration();

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("RDS instance 'test-instance' not found");
    });

    it('should handle S3 bucket not found as warning', async () => {
      mockS3.headBucket.mockRejectedValue({ code: 'NotFound' });
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceStatus: 'available' }]
      });
      mockCloudWatch.listMetrics.mockResolvedValue({});

      const result = await configManager.validateConfiguration();

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("S3 bucket 'test-bucket' not found");
    });

    it('should handle AWS credentials validation failure', async () => {
      mockS3.headBucket.mockRejectedValue({ code: 'InvalidAccessKeyId', message: 'Invalid credentials' });

      const result = await configManager.validateConfiguration();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AWS credentials validation failed: Invalid credentials');
    });

    it('should handle general validation errors', async () => {
      mockS3.headBucket.mockRejectedValue(new Error('Network error'));

      const result = await configManager.validateConfiguration();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration validation failed: Network error');
    });
  });

  describe('testConnections', () => {
    beforeEach(() => {
      configManager = new AWSConfigManager({
        region: 'us-east-1',
        rds: { instanceIdentifier: 'test-instance' },
        s3: { bucketName: 'test-bucket' }
      });
    });

    it('should return successful connection test results', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceStatus: 'available' }]
      });
      mockS3.headBucket.mockResolvedValue({});
      mockCloudWatch.listMetrics.mockResolvedValue({});

      const result = await configManager.testConnections();

      expect(result.rds.connected).toBe(true);
      expect(result.rds.status).toBe('available');
      expect(result.s3.connected).toBe(true);
      expect(result.cloudWatch.connected).toBe(true);
    });

    it('should handle RDS connection failure', async () => {
      mockRDS.describeDBInstances.mockRejectedValue(new Error('RDS connection failed'));
      mockS3.headBucket.mockResolvedValue({});
      mockCloudWatch.listMetrics.mockResolvedValue({});

      const result = await configManager.testConnections();

      expect(result.rds.connected).toBe(false);
      expect(result.rds.error).toBe('RDS connection failed');
      expect(result.s3.connected).toBe(true);
      expect(result.cloudWatch.connected).toBe(true);
    });

    it('should handle missing RDS configuration', async () => {
      configManager.updateConfig({ rds: {} });
      mockS3.headBucket.mockResolvedValue({});
      mockCloudWatch.listMetrics.mockResolvedValue({});

      const result = await configManager.testConnections();

      expect(result.rds.connected).toBe(true);
      expect(result.rds.message).toBe('No RDS instance configured');
    });

    it('should handle missing S3 configuration', async () => {
      configManager.updateConfig({ s3: {} });
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceStatus: 'available' }]
      });
      mockCloudWatch.listMetrics.mockResolvedValue({});

      const result = await configManager.testConnections();

      expect(result.s3.connected).toBe(true);
      expect(result.s3.message).toBe('No S3 bucket configured');
    });
  });

  describe('updateConfig', () => {
    beforeEach(() => {
      configManager = new AWSConfigManager({ region: 'us-east-1' });
    });

    it('should update configuration and require re-initialization', async () => {
      await configManager.initialize();
      expect(configManager.isInitialized()).toBe(true);

      configManager.updateConfig({ region: 'us-west-2' });

      expect(configManager.getConfig().region).toBe('us-west-2');
      expect(configManager.isInitialized()).toBe(false);
    });

    it('should merge configuration updates', () => {
      const originalConfig = configManager.getConfig();
      
      configManager.updateConfig({
        rds: { host: 'new-host', port: 3306 }
      });

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.region).toBe(originalConfig.region);
      expect(updatedConfig.rds?.host).toBe('new-host');
      expect(updatedConfig.rds?.port).toBe(3306);
    });
  });

  describe('getRegion', () => {
    it('should return configured region', () => {
      configManager = new AWSConfigManager({ region: 'eu-central-1' });
      expect(configManager.getRegion()).toBe('eu-central-1');
    });
  });

  describe('isInitialized', () => {
    beforeEach(() => {
      configManager = new AWSConfigManager({ region: 'us-east-1' });
    });

    it('should return false before initialization', () => {
      expect(configManager.isInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await configManager.initialize();
      expect(configManager.isInitialized()).toBe(true);
    });

    it('should return false after configuration update', async () => {
      await configManager.initialize();
      configManager.updateConfig({ region: 'us-west-2' });
      expect(configManager.isInitialized()).toBe(false);
    });
  });
});

describe('Global AWS Config Manager', () => {
  afterEach(() => {
    resetAWSConfigManager();
  });

  describe('getAWSConfigManager', () => {
    it('should return singleton instance', () => {
      const manager1 = getAWSConfigManager();
      const manager2 = getAWSConfigManager();
      
      expect(manager1).toBe(manager2);
    });

    it('should create new instance with provided config', () => {
      const config: AWSConfig = { region: 'us-west-2' };
      const manager = getAWSConfigManager(config);
      
      expect(manager.getConfig().region).toBe('us-west-2');
    });
  });

  describe('resetAWSConfigManager', () => {
    it('should reset global instance', () => {
      const manager1 = getAWSConfigManager();
      resetAWSConfigManager();
      const manager2 = getAWSConfigManager();
      
      expect(manager1).not.toBe(manager2);
    });
  });

  describe('createAWSConfigFromEnvironment', () => {
    it('should create config from environment variables', () => {
      process.env.AWS_REGION = 'ap-southeast-1';
      process.env.RDS_HOST = 'env-rds-host';
      
      const config = createAWSConfigFromEnvironment();
      
      expect(config.region).toBe('ap-southeast-1');
      expect(config.rds?.host).toBe('env-rds-host');
    });
  });
});

describe('AWSConfigurationError', () => {
  it('should create error with message', () => {
    const error = new AWSConfigurationError('Test error');
    
    expect(error.name).toBe('AWSConfigurationError');
    expect(error.message).toBe('Test error');
    expect(error.cause).toBeUndefined();
  });

  it('should create error with cause', () => {
    const cause = new Error('Original error');
    const error = new AWSConfigurationError('Test error', cause);
    
    expect(error.name).toBe('AWSConfigurationError');
    expect(error.message).toBe('Test error');
    expect(error.cause).toBe(cause);
  });
});