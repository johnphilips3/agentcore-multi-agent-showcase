import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Pool, Client } from 'pg';
import { RDS } from 'aws-sdk';
import {
  RDSManager,
  RDSConnectionError,
  createRDSManager,
  getRDSManager,
  resetRDSManager,
  RDSConnectionConfig,
  RDSInstanceInfo,
  RDSHealthStatus
} from '../rds';
import { AWSConfigManager } from '../config';

// Mock pg module
vi.mock('pg', () => ({
  Pool: vi.fn(),
  Client: vi.fn()
}));

// Mock AWS SDK
vi.mock('aws-sdk', () => ({
  RDS: vi.fn()
}));

// Mock config module
vi.mock('../config', () => ({
  getAWSConfigManager: vi.fn(),
  AWSConfigManager: vi.fn()
}));

describe('RDSManager', () => {
  let rdsManager: RDSManager;
  let mockRDS: any;
  let mockPool: any;
  let mockClient: any;
  let mockConfigManager: any;
  let mockConfig: RDSConnectionConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock RDS
    mockRDS = {
      describeDBInstances: vi.fn(),
      getAuthToken: vi.fn()
    };
    (RDS as any).mockImplementation(() => mockRDS);

    // Setup mock Pool
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
      end: vi.fn()
    };
    (Pool as any).mockImplementation(() => mockPool);

    // Setup mock config manager
    mockConfigManager = {
      getConfig: vi.fn(),
      isInitialized: vi.fn().mockReturnValue(true),
      initialize: vi.fn(),
      getClients: vi.fn().mockReturnValue({
        cloudWatch: {
          getMetricStatistics: vi.fn()
        }
      })
    };
    (AWSConfigManager as any).mockImplementation(() => mockConfigManager);

    // Default RDS config
    mockConfig = {
      instanceIdentifier: 'test-instance',
      host: 'test-host.rds.amazonaws.com',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_password',
      useIAM: false,
      ssl: true,
      maxConnections: 10,
      connectionTimeout: 10000,
      retryAttempts: 3,
      retryDelay: 1000,
      region: 'us-east-1'
    };

    mockConfigManager.getConfig.mockReturnValue({
      region: 'us-east-1',
      rds: mockConfig
    });

    resetRDSManager();
  });

  afterEach(() => {
    resetRDSManager();
  });

  describe('constructor', () => {
    it('should create instance with provided config', () => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
      
      expect(rdsManager.getConfig()).toEqual(mockConfig);
      expect(RDS).toHaveBeenCalledWith({ region: 'us-east-1' });
    });

    it('should load config from AWS config manager when not provided', () => {
      rdsManager = new RDSManager(undefined, mockConfigManager);
      
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
      expect(rdsManager.getConfig()).toEqual(expect.objectContaining({
        instanceIdentifier: 'test-instance',
        host: 'test-host.rds.amazonaws.com'
      }));
    });

    it('should throw error when RDS config not found in AWS config', () => {
      mockConfigManager.getConfig.mockReturnValue({ region: 'us-east-1' });
      
      expect(() => new RDSManager(undefined, mockConfigManager)).toThrow(RDSConnectionError);
      expect(() => new RDSManager(undefined, mockConfigManager)).toThrow('RDS configuration not found');
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
    });

    it('should initialize successfully with available RDS instance', async () => {
      mockRDS.describeDBInstances.mockReturnValue({
        promise: vi.fn().mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available',
          Engine: 'postgres',
          EngineVersion: '13.7',
          DBInstanceClass: 'db.t3.micro',
          AvailabilityZone: 'us-east-1a',
          Endpoint: {
            Address: 'test-host.rds.amazonaws.com',
            Port: 5432
          },
          StorageEncrypted: true,
          BackupRetentionPeriod: 7,
          MultiAZ: false,
          PerformanceInsightsEnabled: false,
          MonitoringInterval: 0,
          AllocatedStorage: 20,
          StorageType: 'gp2'
        }]
        })
      });
      mockClient.query.mockResolvedValue({ rows: [] });

      await rdsManager.initialize();

      expect(mockConfigManager.initialize).toHaveBeenCalled();
      expect(mockRDS.describeDBInstances).toHaveBeenCalledWith({
        DBInstanceIdentifier: 'test-instance'
      });
      expect(Pool).toHaveBeenCalledWith({
        host: 'test-host.rds.amazonaws.com',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
        ssl: {
          rejectUnauthorized: false,
          ca: undefined
        },
        max: 10,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        allowExitOnIdle: false,
        application_name: 'alpaca-herd-storage'
      });
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should throw error when RDS instance not found', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({ DBInstances: [] });

      await expect(rdsManager.initialize()).rejects.toThrow(RDSConnectionError);
      await expect(rdsManager.initialize()).rejects.toThrow("RDS instance 'test-instance' not found");
    });

    it('should throw error when RDS instance not available', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'stopped'
        }]
      });

      await expect(rdsManager.initialize()).rejects.toThrow(RDSConnectionError);
      await expect(rdsManager.initialize()).rejects.toThrow("RDS instance 'test-instance' is not available (status: stopped)");
    });

    it('should update config with endpoint when not provided', async () => {
      const configWithoutHost = { ...mockConfig, host: '', port: 0 };
      rdsManager = new RDSManager(configWithoutHost, mockConfigManager);

      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available',
          Endpoint: {
            Address: 'discovered-host.rds.amazonaws.com',
            Port: 5432
          }
        }]
      });
      mockClient.query.mockResolvedValue({ rows: [] });

      await rdsManager.initialize();

      const updatedConfig = rdsManager.getConfig();
      expect(updatedConfig.host).toBe('discovered-host.rds.amazonaws.com');
      expect(updatedConfig.port).toBe(5432);
    });

    it('should generate IAM token when useIAM is true', async () => {
      const iamConfig = { ...mockConfig, useIAM: true, password: undefined };
      rdsManager = new RDSManager(iamConfig, mockConfigManager);

      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available'
        }]
      });
      mockRDS.getAuthToken.mockImplementation((params, callback) => {
        callback(null, 'iam-auth-token');
      });
      mockClient.query.mockResolvedValue({ rows: [] });

      await rdsManager.initialize();

      expect(mockRDS.getAuthToken).toHaveBeenCalledWith({
        hostname: 'test-host.rds.amazonaws.com',
        port: 5432,
        username: 'test_user',
        region: 'us-east-1'
      }, expect.any(Function));
    });

    it('should handle IAM token generation failure', async () => {
      const iamConfig = { ...mockConfig, useIAM: true, password: undefined };
      rdsManager = new RDSManager(iamConfig, mockConfigManager);

      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available'
        }]
      });
      mockRDS.getAuthToken.mockImplementation((params, callback) => {
        callback(new Error('IAM token generation failed'));
      });

      await expect(rdsManager.initialize()).rejects.toThrow(RDSConnectionError);
      await expect(rdsManager.initialize()).rejects.toThrow('Failed to generate IAM token');
    });

    it('should configure SSL when ssl is false', async () => {
      const noSslConfig = { ...mockConfig, ssl: false };
      rdsManager = new RDSManager(noSslConfig, mockConfigManager);

      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available'
        }]
      });
      mockClient.query.mockResolvedValue({ rows: [] });

      await rdsManager.initialize();

      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        ssl: false
      }));
    });
  });

  describe('getInstanceInfo', () => {
    beforeEach(() => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
    });

    it('should return instance information', async () => {
      const mockInstance = {
        DBInstanceIdentifier: 'test-instance',
        DBInstanceStatus: 'available',
        Engine: 'postgres',
        EngineVersion: '13.7',
        DBInstanceClass: 'db.t3.micro',
        AvailabilityZone: 'us-east-1a',
        Endpoint: {
          Address: 'test-host.rds.amazonaws.com',
          Port: 5432
        },
        StorageEncrypted: true,
        BackupRetentionPeriod: 7,
        MultiAZ: false,
        PerformanceInsightsEnabled: false,
        MonitoringInterval: 0,
        AllocatedStorage: 20,
        StorageType: 'gp2',
        Iops: 1000
      };

      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [mockInstance]
      });

      const result = await rdsManager.getInstanceInfo();

      expect(result).toEqual({
        identifier: 'test-instance',
        status: 'available',
        engine: 'postgres',
        engineVersion: '13.7',
        instanceClass: 'db.t3.micro',
        availabilityZone: 'us-east-1a',
        endpoint: {
          address: 'test-host.rds.amazonaws.com',
          port: 5432
        },
        storageEncrypted: true,
        backupRetentionPeriod: 7,
        multiAZ: false,
        performanceInsightsEnabled: false,
        monitoringInterval: 0,
        allocatedStorage: 20,
        storageType: 'gp2',
        iops: 1000
      });
    });

    it('should return null when instance not found', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({ DBInstances: [] });

      const result = await rdsManager.getInstanceInfo();

      expect(result).toBeNull();
    });

    it('should handle missing optional fields', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available',
          Engine: 'postgres',
          EngineVersion: '13.7',
          DBInstanceClass: 'db.t3.micro',
          AvailabilityZone: 'us-east-1a'
          // Missing optional fields
        }]
      });

      const result = await rdsManager.getInstanceInfo();

      expect(result).toEqual({
        identifier: 'test-instance',
        status: 'available',
        engine: 'postgres',
        engineVersion: '13.7',
        instanceClass: 'db.t3.micro',
        availabilityZone: 'us-east-1a',
        endpoint: undefined,
        storageEncrypted: false,
        backupRetentionPeriod: 0,
        multiAZ: false,
        performanceInsightsEnabled: false,
        monitoringInterval: 0,
        allocatedStorage: 0,
        storageType: 'gp2',
        iops: undefined
      });
    });

    it('should throw RDSConnectionError on API failure', async () => {
      mockRDS.describeDBInstances.mockRejectedValue(new Error('API error'));

      await expect(rdsManager.getInstanceInfo()).rejects.toThrow(RDSConnectionError);
      await expect(rdsManager.getInstanceInfo()).rejects.toThrow('Failed to get RDS instance info');
    });
  });

  describe('getPool', () => {
    beforeEach(() => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
    });

    it('should return pool after initialization', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceIdentifier: 'test-instance', DBInstanceStatus: 'available' }]
      });
      mockClient.query.mockResolvedValue({ rows: [] });

      await rdsManager.initialize();
      const pool = rdsManager.getPool();

      expect(pool).toBe(mockPool);
    });

    it('should throw error when not initialized', () => {
      expect(() => rdsManager.getPool()).toThrow(RDSConnectionError);
      expect(() => rdsManager.getPool()).toThrow('RDS connection not initialized');
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceIdentifier: 'test-instance', DBInstanceStatus: 'available' }]
      });
      mockClient.query.mockResolvedValue({ rows: [] });
      await rdsManager.initialize();
    });

    it('should execute query successfully', async () => {
      const mockResult = { rows: [{ id: 1, name: 'test' }] };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await rdsManager.query('SELECT * FROM test', []);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test', []);
      expect(result).toEqual([{ id: 1, name: 'test' }]);
    });

    it('should execute query with parameters', async () => {
      const mockResult = { rows: [{ id: 1 }] };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await rdsManager.query('SELECT * FROM test WHERE id = $1', [1]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
      expect(result).toEqual([{ id: 1 }]);
    });

    it('should throw RDSConnectionError on query failure', async () => {
      mockPool.query.mockRejectedValue(new Error('Query failed'));

      await expect(rdsManager.query('SELECT 1')).rejects.toThrow(RDSConnectionError);
      await expect(rdsManager.query('SELECT 1')).rejects.toThrow('Query failed');
    });
  });

  describe('getClient', () => {
    beforeEach(async () => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceIdentifier: 'test-instance', DBInstanceStatus: 'available' }]
      });
      mockClient.query.mockResolvedValue({ rows: [] });
      await rdsManager.initialize();
    });

    it('should return client from pool', async () => {
      const client = await rdsManager.getClient();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });
  });

  describe('performHealthCheck', () => {
    beforeEach(async () => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceIdentifier: 'test-instance', DBInstanceStatus: 'available' }]
      });
      mockClient.query.mockResolvedValue({ rows: [] });
      await rdsManager.initialize();
    });

    it('should return healthy status when all checks pass', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available'
        }]
      });
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SELECT 1
        .mockResolvedValueOnce({ 
          rows: [{ total_connections: '5', active_connections: '2' }] 
        }); // Connection stats

      const result = await rdsManager.performHealthCheck();

      expect(result.healthy).toBe(true);
      expect(result.status).toBe('available');
      expect(result.latency).toBeGreaterThan(0);
      expect(result.connectionCount).toBe(5);
      expect(result.databaseConnections).toBe(2);
    });

    it('should return unhealthy status when instance not found', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({ DBInstances: [] });

      const result = await rdsManager.performHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('not-found');
      expect(result.error).toBe('RDS instance not found');
    });

    it('should return unhealthy status when instance not available', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'stopped'
        }]
      });

      const result = await rdsManager.performHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('stopped');
    });

    it('should handle database connection errors', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available'
        }]
      });
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await rdsManager.performHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('error');
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('getCloudWatchMetrics', () => {
    beforeEach(async () => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceIdentifier: 'test-instance', DBInstanceStatus: 'available' }]
      });
      mockClient.query.mockResolvedValue({ rows: [] });
      await rdsManager.initialize();
    });

    it('should retrieve CloudWatch metrics', async () => {
      const mockCloudWatch = mockConfigManager.getClients().cloudWatch;
      mockCloudWatch.getMetricStatistics.mockResolvedValue({
        Datapoints: [{
          Timestamp: new Date(),
          Average: 25.5
        }]
      });

      const startTime = new Date(Date.now() - 3600000);
      const endTime = new Date();
      const result = await rdsManager.getCloudWatchMetrics(startTime, endTime);

      expect(mockCloudWatch.getMetricStatistics).toHaveBeenCalledWith({
        Namespace: 'AWS/RDS',
        MetricName: 'CPUUtilization',
        Dimensions: [{
          Name: 'DBInstanceIdentifier',
          Value: 'test-instance'
        }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Average']
      });
      expect(result.CPUUtilization).toBe(25.5);
    });

    it('should handle missing metrics gracefully', async () => {
      const mockCloudWatch = mockConfigManager.getClients().cloudWatch;
      mockCloudWatch.getMetricStatistics.mockResolvedValue({ Datapoints: [] });

      const startTime = new Date(Date.now() - 3600000);
      const endTime = new Date();
      const result = await rdsManager.getCloudWatchMetrics(startTime, endTime);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle CloudWatch API errors', async () => {
      const mockCloudWatch = mockConfigManager.getClients().cloudWatch;
      mockCloudWatch.getMetricStatistics.mockRejectedValue(new Error('CloudWatch error'));

      const startTime = new Date(Date.now() - 3600000);
      const endTime = new Date();

      await expect(rdsManager.getCloudWatchMetrics(startTime, endTime))
        .rejects.toThrow(RDSConnectionError);
    });
  });

  describe('testConnection', () => {
    beforeEach(async () => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceIdentifier: 'test-instance', DBInstanceStatus: 'available' }]
      });
      mockClient.query.mockResolvedValue({ rows: [] });
      await rdsManager.initialize();
    });

    it('should return true on successful connection', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await rdsManager.testConnection();

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should retry on connection failure and eventually succeed', async () => {
      mockClient.query
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({ rows: [] });

      const result = await rdsManager.testConnection();

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retry attempts', async () => {
      mockClient.query.mockRejectedValue(new Error('Connection failed'));

      await expect(rdsManager.testConnection()).rejects.toThrow(RDSConnectionError);
      await expect(rdsManager.testConnection()).rejects.toThrow('Connection failed after 3 attempts');
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceIdentifier: 'test-instance', DBInstanceStatus: 'available' }]
      });
      mockClient.query.mockResolvedValue({ rows: [] });
      await rdsManager.initialize();
    });

    it('should close pool and stop health monitoring', async () => {
      mockPool.end.mockResolvedValue(undefined);

      await rdsManager.close();

      expect(mockPool.end).toHaveBeenCalled();
      expect(rdsManager.isInitialized()).toBe(false);
    });

    it('should handle pool close errors gracefully', async () => {
      mockPool.end.mockRejectedValue(new Error('Close failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await rdsManager.close();

      expect(consoleSpy).toHaveBeenCalledWith('Error closing connection pool:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('updateConfig', () => {
    beforeEach(() => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
    });

    it('should update configuration', () => {
      const updates = { host: 'new-host.rds.amazonaws.com', port: 3306 };
      
      rdsManager.updateConfig(updates);
      const updatedConfig = rdsManager.getConfig();

      expect(updatedConfig.host).toBe('new-host.rds.amazonaws.com');
      expect(updatedConfig.port).toBe(3306);
      expect(updatedConfig.database).toBe('test_db'); // Original value preserved
    });
  });

  describe('isInitialized', () => {
    beforeEach(() => {
      rdsManager = new RDSManager(mockConfig, mockConfigManager);
    });

    it('should return false before initialization', () => {
      expect(rdsManager.isInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      mockRDS.describeDBInstances.mockResolvedValue({
        DBInstances: [{ DBInstanceIdentifier: 'test-instance', DBInstanceStatus: 'available' }]
      });
      mockClient.query.mockResolvedValue({ rows: [] });

      await rdsManager.initialize();

      expect(rdsManager.isInitialized()).toBe(true);
    });
  });
});

describe('Global RDS Manager', () => {
  beforeEach(() => {
    resetRDSManager();
  });

  afterEach(() => {
    resetRDSManager();
  });

  describe('createRDSManager', () => {
    it('should create RDS manager with default configuration', () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          region: 'us-east-1',
          rds: {
            instanceIdentifier: 'test-instance',
            host: 'test-host',
            port: 5432,
            database: 'test_db',
            username: 'test_user'
          }
        })
      };
      (AWSConfigManager as any).mockImplementation(() => mockConfigManager);

      const manager = createRDSManager();

      expect(manager).toBeInstanceOf(RDSManager);
      expect(manager.getConfig()).toEqual(expect.objectContaining({
        instanceIdentifier: 'test-instance',
        host: 'test-host',
        port: 5432
      }));
    });

    it('should create RDS manager with custom configuration', () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          region: 'us-east-1',
          rds: {
            instanceIdentifier: 'default-instance',
            host: 'default-host'
          }
        })
      };
      (AWSConfigManager as any).mockImplementation(() => mockConfigManager);

      const customConfig = { host: 'custom-host', port: 3306 };
      const manager = createRDSManager(customConfig);

      expect(manager.getConfig().host).toBe('custom-host');
      expect(manager.getConfig().port).toBe(3306);
    });
  });

  describe('getRDSManager', () => {
    it('should return singleton instance', () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          region: 'us-east-1',
          rds: { instanceIdentifier: 'test-instance' }
        })
      };
      (AWSConfigManager as any).mockImplementation(() => mockConfigManager);

      const manager1 = getRDSManager();
      const manager2 = getRDSManager();

      expect(manager1).toBe(manager2);
    });
  });

  describe('resetRDSManager', () => {
    it('should reset global instance', () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          region: 'us-east-1',
          rds: { instanceIdentifier: 'test-instance' }
        })
      };
      (AWSConfigManager as any).mockImplementation(() => mockConfigManager);

      const manager1 = getRDSManager();
      resetRDSManager();
      const manager2 = getRDSManager();

      expect(manager1).not.toBe(manager2);
    });
  });
});

describe('RDSConnectionError', () => {
  it('should create error with message', () => {
    const error = new RDSConnectionError('Test error');

    expect(error.name).toBe('RDSConnectionError');
    expect(error.message).toBe('Test error');
    expect(error.cause).toBeUndefined();
  });

  it('should create error with cause', () => {
    const cause = new Error('Original error');
    const error = new RDSConnectionError('Test error', cause);

    expect(error.name).toBe('RDSConnectionError');
    expect(error.message).toBe('Test error');
    expect(error.cause).toBe(cause);
  });
});