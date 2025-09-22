import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RDS, S3, CloudWatch } from 'aws-sdk';
import {
  AWSUtilities,
  createAWSUtilities,
  quickHealthCheck,
  validateAWSEnvironment,
  AWSHealthCheck,
  AWSResourceInfo,
  RDSInstanceInfo,
  S3BucketInfo,
  CloudWatchLogGroupInfo
} from '../utils';
import { AWSConfigManager, AWSConfig, ValidationResult } from '../config';

// Mock AWS SDK
vi.mock('aws-sdk', () => ({
  RDS: vi.fn(),
  S3: vi.fn(),
  CloudWatch: vi.fn(),
  STS: vi.fn()
}));

// Mock config module
vi.mock('../config', () => ({
  AWSConfigManager: vi.fn()
}));

describe('AWSUtilities', () => {
  let awsUtilities: AWSUtilities;
  let mockConfigManager: any;
  let mockRDS: any;
  let mockS3: any;
  let mockCloudWatch: any;
  let mockSTS: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock AWS services
    mockRDS = {
      describeDBInstances: vi.fn().mockReturnValue({
        promise: vi.fn()
      })
    };
    mockS3 = {
      headBucket: vi.fn().mockReturnValue({
        promise: vi.fn()
      }),
      getBucketLocation: vi.fn().mockReturnValue({
        promise: vi.fn()
      }),
      listBuckets: vi.fn().mockReturnValue({
        promise: vi.fn()
      }),
      getBucketEncryption: vi.fn().mockReturnValue({
        promise: vi.fn()
      }),
      getBucketVersioning: vi.fn().mockReturnValue({
        promise: vi.fn()
      }),
      getBucketLifecycleConfiguration: vi.fn().mockReturnValue({
        promise: vi.fn()
      })
    };
    mockCloudWatch = {
      listMetrics: vi.fn().mockReturnValue({
        promise: vi.fn()
      })
    };
    mockSTS = {
      getCallerIdentity: vi.fn().mockReturnValue({
        promise: vi.fn()
      })
    };

    // Mock AWS constructors
    (RDS as any).mockImplementation(() => mockRDS);
    (S3 as any).mockImplementation(() => mockS3);
    (CloudWatch as any).mockImplementation(() => mockCloudWatch);

    // Setup mock config manager
    mockConfigManager = {
      isInitialized: vi.fn().mockReturnValue(true),
      initialize: vi.fn(),
      getClients: vi.fn().mockReturnValue({
        rds: mockRDS,
        s3: mockS3,
        cloudWatch: mockCloudWatch
      }),
      getConfig: vi.fn().mockReturnValue({
        region: 'us-east-1',
        rds: { instanceIdentifier: 'test-instance' },
        s3: { bucketName: 'test-bucket' },
        cloudWatch: { logGroupName: '/test/log-group' }
      }),
      getRegion: vi.fn().mockReturnValue('us-east-1')
    };

    (AWSConfigManager as any).mockImplementation(() => mockConfigManager);
  });

  describe('constructor', () => {
    it('should create instance with provided config manager', () => {
      awsUtilities = new AWSUtilities(mockConfigManager);
      expect(awsUtilities).toBeInstanceOf(AWSUtilities);
    });

    it('should create instance with default config manager when not provided', () => {
      awsUtilities = new AWSUtilities();
      expect(AWSConfigManager).toHaveBeenCalled();
    });
  });

  describe('performHealthCheck', () => {
    beforeEach(() => {
      awsUtilities = new AWSUtilities(mockConfigManager);
    });

    it('should perform comprehensive health check successfully', async () => {
      // Mock successful RDS check
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available',
          Engine: 'postgres',
          EngineVersion: '13.7',
          DBInstanceClass: 'db.t3.micro',
          AvailabilityZone: 'us-east-1a',
          MultiAZ: false,
          StorageEncrypted: true
        }]
      });

      // Mock successful S3 check
      mockS3.headBucket.mockResolvedValue({});
      mockS3.getBucketLocation.mockResolvedValue({ LocationConstraint: 'us-east-1' });

      // Mock successful CloudWatch check
      mockCloudWatch.listMetrics.mockResolvedValue({});

      const result = await awsUtilities.performHealthCheck();

      expect(result).toHaveLength(3);
      
      const rdsCheck = result.find(check => check.service === 'RDS');
      expect(rdsCheck).toEqual({
        service: 'RDS',
        healthy: true,
        latency: expect.any(Number),
        details: {
          status: 'available',
          engine: 'postgres',
          engineVersion: '13.7',
          instanceClass: 'db.t3.micro',
          availabilityZone: 'us-east-1a',
          multiAZ: false,
          storageEncrypted: true
        }
      });

      const s3Check = result.find(check => check.service === 'S3');
      expect(s3Check).toEqual({
        service: 'S3',
        healthy: true,
        latency: expect.any(Number),
        details: {
          bucket: 'test-bucket',
          region: 'us-east-1'
        }
      });

      const cloudWatchCheck = result.find(check => check.service === 'CloudWatch');
      expect(cloudWatchCheck).toEqual({
        service: 'CloudWatch',
        healthy: true,
        latency: expect.any(Number),
        details: {
          region: 'us-east-1'
        }
      });
    });

    it('should handle RDS instance not found', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({ DBInstances: [] });
      mockS3.headBucket.mockResolvedValue({});
      mockS3.getBucketLocation.mockResolvedValue({});
      mockCloudWatch.listMetrics.mockResolvedValue({});

      const result = await awsUtilities.performHealthCheck();

      const rdsCheck = result.find(check => check.service === 'RDS');
      expect(rdsCheck?.healthy).toBe(false);
      expect(rdsCheck?.error).toBe('Instance not found');
    });

    it('should handle RDS instance not available', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'stopped',
          Engine: 'postgres',
          EngineVersion: '13.7',
          DBInstanceClass: 'db.t3.micro',
          AvailabilityZone: 'us-east-1a'
        }]
      });
      mockS3.headBucket.mockResolvedValue({});
      mockS3.getBucketLocation.mockResolvedValue({});
      mockCloudWatch.listMetrics.mockResolvedValue({});

      const result = await awsUtilities.performHealthCheck();

      const rdsCheck = result.find(check => check.service === 'RDS');
      expect(rdsCheck?.healthy).toBe(false);
    });

    it('should handle S3 access errors', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceStatus: 'available' }]
      });
      mockS3.headBucket.mockRejectedValue({ code: 'Forbidden', message: 'Access denied' });
      mockCloudWatch.listMetrics.mockResolvedValue({});

      const result = await awsUtilities.performHealthCheck();

      const s3Check = result.find(check => check.service === 'S3');
      expect(s3Check?.healthy).toBe(false);
      expect(s3Check?.error).toBe('Access denied');
    });

    it('should handle CloudWatch errors', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceStatus: 'available' }]
      });
      mockS3.headBucket.mockResolvedValue({});
      mockS3.getBucketLocation.mockResolvedValue({});
      mockCloudWatch.listMetrics.mockRejectedValue(new Error('CloudWatch error'));

      const result = await awsUtilities.performHealthCheck();

      const cloudWatchCheck = result.find(check => check.service === 'CloudWatch');
      expect(cloudWatchCheck?.healthy).toBe(false);
      expect(cloudWatchCheck?.error).toBe('CloudWatch error');
    });

    it('should handle AWS configuration initialization failure', async () => {
      mockConfigManager.isInitialized.mockReturnValue(false);
      mockConfigManager.initialize.mockRejectedValue(new Error('Config init failed'));

      const result = await awsUtilities.performHealthCheck();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        service: 'AWS Configuration',
        healthy: false,
        error: 'Config init failed'
      });
    });
  });

  describe('getResourceInfo', () => {
    beforeEach(() => {
      awsUtilities = new AWSUtilities(mockConfigManager);
    });

    it('should get comprehensive resource information', async () => {
      // Mock RDS instance info
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available',
          Engine: 'postgres',
          EngineVersion: '13.7',
          DBInstanceClass: 'db.t3.micro',
          AvailabilityZone: 'us-east-1a',
          Endpoint: { Address: 'test-host', Port: 5432 },
          StorageEncrypted: true,
          BackupRetentionPeriod: 7,
          MultiAZ: false
        }]
      });

      // Mock S3 bucket info
      mockS3.getBucketLocation.mockResolvedValue({ LocationConstraint: 'us-east-1' });
      mockS3.listBuckets.mockResolvedValue({
        Buckets: [{ Name: 'test-bucket', CreationDate: new Date('2023-01-01') }]
      });
      mockS3.getBucketEncryption.mockResolvedValue({
        ServerSideEncryptionConfiguration: {
          Rules: [{
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            }
          }]
        }
      });
      mockS3.getBucketVersioning.mockResolvedValue({ Status: 'Enabled' });
      mockS3.getBucketLifecycleConfiguration.mockResolvedValue({
        Rules: [{ ID: 'rule1' }, { ID: 'rule2' }]
      });

      const result = await awsUtilities.getResourceInfo();

      expect(result.rds?.instances).toHaveLength(1);
      expect(result.rds?.instances[0]).toEqual({
        identifier: 'test-instance',
        status: 'available',
        engine: 'postgres',
        engineVersion: '13.7',
        instanceClass: 'db.t3.micro',
        availabilityZone: 'us-east-1a',
        endpoint: 'test-host',
        port: 5432,
        storageEncrypted: true,
        backupRetentionPeriod: 7,
        multiAZ: false
      });

      expect(result.s3?.buckets).toHaveLength(1);
      expect(result.s3?.buckets[0]).toEqual({
        name: 'test-bucket',
        region: 'us-east-1',
        creationDate: new Date('2023-01-01'),
        encryption: {
          algorithm: 'AES256'
        },
        versioning: true,
        lifecycleRules: 2
      });

      expect(result.cloudWatch?.logGroups).toHaveLength(1);
      expect(result.cloudWatch?.logGroups[0]).toEqual({
        name: '/test/log-group',
        retentionInDays: 30,
        storedBytes: 0,
        creationTime: expect.any(Date)
      });
    });

    it('should handle missing RDS configuration', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        region: 'us-east-1',
        s3: { bucketName: 'test-bucket' }
      });

      const result = await awsUtilities.getResourceInfo();

      expect(result.rds).toBeUndefined();
    });

    it('should handle missing S3 configuration', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        region: 'us-east-1',
        rds: { instanceIdentifier: 'test-instance' }
      });

      const result = await awsUtilities.getResourceInfo();

      expect(result.s3).toBeUndefined();
    });

    it('should handle API errors gracefully', async () => {
      mockRDS.describeDBInstances.mockRejectedValue(new Error('RDS API error'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await awsUtilities.getResourceInfo();

      expect(result.rds?.instances).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get RDS instance information:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle S3 bucket encryption not configured', async () => {
      mockS3.getBucketLocation.mockResolvedValue({ LocationConstraint: 'us-east-1' });
      mockS3.listBuckets.mockResolvedValue({
        Buckets: [{ Name: 'test-bucket', CreationDate: new Date('2023-01-01') }]
      });
      mockS3.getBucketEncryption.mockRejectedValue(new Error('No encryption'));
      mockS3.getBucketVersioning.mockResolvedValue({});
      mockS3.getBucketLifecycleConfiguration.mockRejectedValue(new Error('No lifecycle'));

      const result = await awsUtilities.getResourceInfo();

      expect(result.s3?.buckets[0]).toEqual({
        name: 'test-bucket',
        region: 'us-east-1',
        creationDate: new Date('2023-01-01'),
        versioning: false,
        lifecycleRules: 0
      });
    });
  });

  describe('validateCredentials', () => {
    beforeEach(() => {
      awsUtilities = new AWSUtilities(mockConfigManager);
    });

    it('should return true for valid credentials', async () => {
      mockS3.listBuckets.mockResolvedValue({ Buckets: [] });

      const result = await awsUtilities.validateCredentials();

      expect(result).toBe(true);
      expect(mockS3.listBuckets).toHaveBeenCalled();
    });

    it('should return false for invalid credentials', async () => {
      mockS3.listBuckets.mockRejectedValue(new Error('Invalid credentials'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await awsUtilities.validateCredentials();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('AWS credentials validation failed:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should initialize config manager if not initialized', async () => {
      mockConfigManager.isInitialized.mockReturnValue(false);
      mockS3.listBuckets.mockResolvedValue({ Buckets: [] });

      const result = await awsUtilities.validateCredentials();

      expect(mockConfigManager.initialize).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('getAccountInfo', () => {
    beforeEach(() => {
      awsUtilities = new AWSUtilities(mockConfigManager);
      
      // Mock require for STS
      const mockRequire = vi.fn().mockReturnValue({
        STS: vi.fn().mockImplementation(() => mockSTS)
      });
      vi.stubGlobal('require', mockRequire);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return account information successfully', async () => {
      mockSTS.getCallerIdentity.mockReturnValue({
        promise: vi.fn().mockResolvedValue({ Account: '123456789012' })
      });

      const result = await awsUtilities.getAccountInfo();

      expect(result).toEqual({
        accountId: '123456789012',
        region: 'us-east-1'
      });
    });

    it('should handle STS API errors', async () => {
      mockSTS.getCallerIdentity.mockReturnValue({
        promise: vi.fn().mockRejectedValue(new Error('STS error'))
      });

      const result = await awsUtilities.getAccountInfo();

      expect(result).toEqual({
        region: 'us-east-1',
        error: 'STS error'
      });
    });

    it('should initialize config manager if not initialized', async () => {
      mockConfigManager.isInitialized.mockReturnValue(false);
      mockSTS.getCallerIdentity.mockReturnValue({
        promise: vi.fn().mockResolvedValue({ Account: '123456789012' })
      });

      const result = await awsUtilities.getAccountInfo();

      expect(mockConfigManager.initialize).toHaveBeenCalled();
      expect(result.accountId).toBe('123456789012');
    });
  });

  describe('testNetworkConnectivity', () => {
    beforeEach(() => {
      awsUtilities = new AWSUtilities(mockConfigManager);
    });

    it('should test connectivity to all AWS services', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({ DBInstances: [] });
      mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
      mockCloudWatch.listMetrics.mockResolvedValue({});

      const result = await awsUtilities.testNetworkConnectivity();

      expect(result.RDS).toEqual({
        reachable: true,
        latency: expect.any(Number)
      });
      expect(result.S3).toEqual({
        reachable: true,
        latency: expect.any(Number)
      });
      expect(result.CloudWatch).toEqual({
        reachable: true,
        latency: expect.any(Number)
      });
    });

    it('should handle service connectivity failures', async () => {
      mockRDS.describeDBInstances.mockRejectedValue(new Error('RDS unreachable'));
      mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
      mockCloudWatch.listMetrics.mockRejectedValue(new Error('CloudWatch unreachable'));

      const result = await awsUtilities.testNetworkConnectivity();

      expect(result.RDS).toEqual({
        reachable: false,
        latency: expect.any(Number),
        error: 'RDS unreachable'
      });
      expect(result.S3).toEqual({
        reachable: true,
        latency: expect.any(Number)
      });
      expect(result.CloudWatch).toEqual({
        reachable: false,
        latency: expect.any(Number),
        error: 'CloudWatch unreachable'
      });
    });

    it('should initialize config manager if not initialized', async () => {
      mockConfigManager.isInitialized.mockReturnValue(false);
      mockRDS.describeDBInstances.mockResolvedValue({ DBInstances: [] });
      mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
      mockCloudWatch.listMetrics.mockResolvedValue({});

      await awsUtilities.testNetworkConnectivity();

      expect(mockConfigManager.initialize).toHaveBeenCalled();
    });
  });
});

describe('Utility Functions', () => {
  let mockConfigManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = {
      isInitialized: vi.fn().mockReturnValue(true),
      initialize: vi.fn(),
      getClients: vi.fn().mockReturnValue({
        rds: { describeDBInstances: vi.fn().mockResolvedValue({ DBInstances: [{ DBInstanceStatus: 'available' }] }) },
        s3: { headBucket: vi.fn().mockResolvedValue({}), getBucketLocation: vi.fn().mockResolvedValue({}) },
        cloudWatch: { listMetrics: vi.fn().mockResolvedValue({}) }
      }),
      getConfig: vi.fn().mockReturnValue({
        region: 'us-east-1',
        rds: { instanceIdentifier: 'test-instance' },
        s3: { bucketName: 'test-bucket' },
        cloudWatch: { logGroupName: '/test/log-group' }
      }),
      getRegion: vi.fn().mockReturnValue('us-east-1'),
      validateConfiguration: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] })
    };

    (AWSConfigManager as any).mockImplementation(() => mockConfigManager);
  });

  describe('createAWSUtilities', () => {
    it('should create AWS utilities with provided config', () => {
      const config: AWSConfig = { region: 'us-west-2' };
      const utilities = createAWSUtilities(config);

      expect(utilities).toBeInstanceOf(AWSUtilities);
      expect(AWSConfigManager).toHaveBeenCalledWith(config);
    });

    it('should create AWS utilities with default config', () => {
      const utilities = createAWSUtilities();

      expect(utilities).toBeInstanceOf(AWSUtilities);
      expect(AWSConfigManager).toHaveBeenCalledWith();
    });
  });

  describe('quickHealthCheck', () => {
    it('should return true when all health checks pass', async () => {
      const result = await quickHealthCheck();

      expect(result).toBe(true);
    });

    it('should return false when any health check fails', async () => {
      const mockClients = mockConfigManager.getClients();
      mockClients.rds.describeDBInstances.mockResolvedValue({ DBInstances: [] }); // Instance not found

      const result = await quickHealthCheck();

      expect(result).toBe(false);
    });

    it('should return false on health check error', async () => {
      mockConfigManager.initialize.mockRejectedValue(new Error('Init failed'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await quickHealthCheck();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Quick health check failed:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should use provided config', async () => {
      const config: AWSConfig = { region: 'eu-west-1' };
      
      await quickHealthCheck(config);

      expect(AWSConfigManager).toHaveBeenCalledWith(config);
    });
  });

  describe('validateAWSEnvironment', () => {
    it('should return validation result from config manager', async () => {
      const expectedResult: ValidationResult = {
        valid: true,
        errors: [],
        warnings: ['Test warning']
      };
      mockConfigManager.validateConfiguration.mockResolvedValue(expectedResult);

      const result = await validateAWSEnvironment();

      expect(result).toEqual(expectedResult);
      expect(mockConfigManager.validateConfiguration).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      mockConfigManager.validateConfiguration.mockRejectedValue(new Error('Validation failed'));

      const result = await validateAWSEnvironment();

      expect(result).toEqual({
        valid: false,
        errors: ['Validation failed'],
        warnings: []
      });
    });

    it('should use provided config', async () => {
      const config: AWSConfig = { region: 'ap-southeast-1' };
      
      await validateAWSEnvironment(config);

      expect(AWSConfigManager).toHaveBeenCalledWith(config);
    });

    it('should handle unknown error types', async () => {
      mockConfigManager.validateConfiguration.mockRejectedValue('String error');

      const result = await validateAWSEnvironment();

      expect(result).toEqual({
        valid: false,
        errors: ['Unknown error'],
        warnings: []
      });
    });
  });
});