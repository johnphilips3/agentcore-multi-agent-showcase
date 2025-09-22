import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RDSManager, createRDSManager, getRDSManager, resetRDSManager, RDSConnectionError } from '../rds';
import { AWSConfigManager } from '../config';

// Mock AWS SDK and pg
vi.mock('aws-sdk', () => ({
  RDS: vi.fn(() => ({
    describeDBInstances: vi.fn(() => ({
      promise: vi.fn().mockResolvedValue({
        DBInstances: [{
          DBInstanceIdentifier: 'test-instance',
          DBInstanceStatus: 'available',
          Engine: 'postgres',
          EngineVersion: '13.7',
          DBInstanceClass: 'db.t3.micro',
          AvailabilityZone: 'us-east-1a',
          Endpoint: {
            Address: 'test-instance.amazonaws.com',
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
    })),
    getAuthToken: vi.fn((params, callback) => {
      callback(null, 'mock-iam-token');
    })
  }))
}));

vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      release: vi.fn()
    }),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    end: vi.fn().mockResolvedValue(undefined)
  })),
  Client: vi.fn()
}));

describe('RDSManager', () => {
  let mockConfigManager: AWSConfigManager;
  let rdsManager: RDSManager;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    resetRDSManager();

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        region: 'us-east-1',
        rds: {
          instanceIdentifier: 'test-instance',
          host: 'test-instance.amazonaws.com',
          port: 5432,
          database: 'alpaca_herd',
          username: 'testuser',
          password: 'testpass',
          useIAM: false,
          ssl: true,
          maxConnections: 10,
          connectionTimeout: 10000
        }
      }),
      isInitialized: vi.fn().mockReturnValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      getClients: vi.fn().mockReturnValue({
        cloudWatch: {
          getMetricStatistics: vi.fn(() => ({
            promise: vi.fn().mockResolvedValue({
              Datapoints: [{
                Timestamp: new Date(),
                Average: 50.0
              }]
            })
          }))
        }
      })
    } as any;

    // Create a fresh RDS manager for each test
    rdsManager = new RDSManager(undefined, mockConfigManager);
  });

  afterEach(() => {
    resetRDSManager();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create RDS manager with provided config', () => {
      const config = {
        instanceIdentifier: 'custom-instance',
        host: 'custom-host.amazonaws.com',
        port: 5432,
        database: 'custom_db',
        username: 'custom_user',
        password: 'custom_pass',
        useIAM: false,
        ssl: true,
        maxConnections: 20,
        connectionTimeout: 15000,
        retryAttempts: 5,
        retryDelay: 2000,
        region: 'us-west-2'
      };

      const manager = new RDSManager(config, mockConfigManager);
      expect(manager.getConfig()).toEqual(config);
    });

    it('should load config from AWS config manager when no config provided', () => {
      const manager = new RDSManager(undefined, mockConfigManager);
      const config = manager.getConfig();

      expect(config.instanceIdentifier).toBe('test-instance');
      expect(config.host).toBe('test-instance.amazonaws.com');
      expect(config.database).toBe('alpaca_herd');
    });

    it('should throw error when RDS config not found in AWS config', () => {
      const mockConfigManagerNoRDS = {
        getConfig: vi.fn().mockReturnValue({
          region: 'us-east-1'
          // No rds config
        })
      } as any;

      expect(() => new RDSManager(undefined, mockConfigManagerNoRDS)).toThrow('RDS configuration not found in AWS config');
    });
  });

  describe('initialize', () => {
    it('should initialize RDS connection successfully', async () => {
      // Mock the private methods to avoid complex AWS SDK interactions
      vi.spyOn(rdsManager, 'getInstanceInfo').mockResolvedValue({
        identifier: 'test-instance',
        status: 'available',
        engine: 'postgres',
        engineVersion: '13.7',
        instanceClass: 'db.t3.micro',
        availabilityZone: 'us-east-1a',
        endpoint: {
          address: 'test-instance.amazonaws.com',
          port: 5432
        },
        storageEncrypted: true,
        backupRetentionPeriod: 7,
        multiAZ: false,
        performanceInsightsEnabled: false,
        monitoringInterval: 0,
        allocatedStorage: 20,
        storageType: 'gp2'
      });

      // Mock the private createConnectionPool method
      vi.spyOn(rdsManager as any, 'createConnectionPool').mockResolvedValue(undefined);
      vi.spyOn(rdsManager as any, 'startHealthMonitoring').mockImplementation(() => {});
      
      // Set the pool to simulate successful initialization
      (rdsManager as any).pool = { query: vi.fn() };

      await rdsManager.initialize();

      expect(rdsManager.isInitialized()).toBe(true);
    });

    it('should throw error when RDS instance not found', async () => {
      vi.spyOn(rdsManager, 'getInstanceInfo').mockResolvedValue(null);

      await expect(rdsManager.initialize()).rejects.toThrow("RDS instance 'test-instance' not found");
    });

    it('should throw error when RDS instance is not available', async () => {
      vi.spyOn(rdsManager, 'getInstanceInfo').mockResolvedValue({
        identifier: 'test-instance',
        status: 'stopped',
        engine: 'postgres',
        engineVersion: '13.7',
        instanceClass: 'db.t3.micro',
        availabilityZone: 'us-east-1a',
        storageEncrypted: false,
        backupRetentionPeriod: 0,
        multiAZ: false,
        performanceInsightsEnabled: false,
        monitoringInterval: 0,
        allocatedStorage: 0,
        storageType: 'gp2'
      });

      await expect(rdsManager.initialize()).rejects.toThrow("RDS instance 'test-instance' is not available (status: stopped)");
    });

    it('should use IAM authentication when configured', async () => {
      const config = {
        instanceIdentifier: 'test-instance',
        host: 'test-instance.amazonaws.com',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        useIAM: true,
        ssl: true,
        maxConnections: 10,
        connectionTimeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000,
        region: 'us-east-1'
      };

      const manager = new RDSManager(config, mockConfigManager);
      
      // Mock the methods to avoid actual AWS calls
      vi.spyOn(manager, 'getInstanceInfo').mockResolvedValue({
        identifier: 'test-instance',
        status: 'available',
        engine: 'postgres',
        engineVersion: '13.7',
        instanceClass: 'db.t3.micro',
        availabilityZone: 'us-east-1a',
        storageEncrypted: false,
        backupRetentionPeriod: 0,
        multiAZ: false,
        performanceInsightsEnabled: false,
        monitoringInterval: 0,
        allocatedStorage: 0,
        storageType: 'gp2'
      });
      vi.spyOn(manager as any, 'createConnectionPool').mockResolvedValue(undefined);
      vi.spyOn(manager as any, 'startHealthMonitoring').mockImplementation(() => {});
      
      // Set the pool to simulate successful initialization
      (manager as any).pool = { query: vi.fn() };

      await manager.initialize();

      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('getInstanceInfo', () => {
    it('should return RDS instance information', async () => {
      const instanceInfo = await rdsManager.getInstanceInfo();

      expect(instanceInfo).toEqual({
        identifier: 'test-instance',
        status: 'available',
        engine: 'postgres',
        engineVersion: '13.7',
        instanceClass: 'db.t3.micro',
        availabilityZone: 'us-east-1a',
        endpoint: {
          address: 'test-instance.amazonaws.com',
          port: 5432
        },
        storageEncrypted: true,
        backupRetentionPeriod: 7,
        multiAZ: false,
        performanceInsightsEnabled: false,
        monitoringInterval: 0,
        allocatedStorage: 20,
        storageType: 'gp2',
        iops: undefined
      });
    });

    it('should return null when instance not found', async () => {
      // Mock RDS to return empty instances
      const mockRDS = vi.mocked(rdsManager as any).rds;
      mockRDS.describeDBInstances = vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({ DBInstances: [] })
      }));

      const instanceInfo = await rdsManager.getInstanceInfo();

      expect(instanceInfo).toBeNull();
    });

    it('should handle RDS API errors', async () => {
      // Mock RDS to throw error
      const mockRDS = vi.mocked(rdsManager as any).rds;
      mockRDS.describeDBInstances = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('RDS API error'))
      }));
      
      await expect(rdsManager.getInstanceInfo()).rejects.toThrow('Failed to get RDS instance info: RDS API error');
    });
  });

  describe('query operations', () => {
    it('should execute queries successfully', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 1, name: 'test' }] })
      };

      vi.spyOn(rdsManager, 'getPool').mockReturnValue(mockPool as any);

      const result = await rdsManager.query('SELECT * FROM test');

      expect(result).toEqual([{ id: 1, name: 'test' }]);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test', []);
    });

    it('should handle query errors', async () => {
      const mockPool = {
        query: vi.fn().mockRejectedValue(new Error('Query error'))
      };

      vi.spyOn(rdsManager, 'getPool').mockReturnValue(mockPool as any);

      await expect(rdsManager.query('SELECT * FROM test')).rejects.toThrow('Query failed: Query error');
    });

    it('should throw error when not initialized', async () => {
      const uninitializedManager = new RDSManager(undefined, mockConfigManager);
      
      expect(() => uninitializedManager.getPool()).toThrow('RDS connection not initialized');
    });
  });

  describe('health check', () => {

    it('should perform health check successfully', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // Health check query
          .mockResolvedValueOnce({ rows: [{ total_connections: '5', active_connections: '2' }] }), // Stats query
        release: vi.fn()
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient)
      };

      vi.spyOn(rdsManager, 'getPool').mockReturnValue(mockPool as any);

      const healthStatus = await rdsManager.performHealthCheck();

      expect(healthStatus.healthy).toBe(true);
      expect(healthStatus.status).toBe('available');
      expect(healthStatus.connectionCount).toBe(5);
      expect(healthStatus.databaseConnections).toBe(2);
      expect(typeof healthStatus.latency).toBe('number');
    });

    it('should handle health check errors', async () => {
      const mockPool = {
        connect: vi.fn().mockRejectedValue(new Error('Connection failed'))
      };

      vi.spyOn(rdsManager, 'getPool').mockReturnValue(mockPool as any);

      const healthStatus = await rdsManager.performHealthCheck();

      expect(healthStatus.healthy).toBe(false);
      expect(healthStatus.status).toBe('error');
      expect(healthStatus.error).toBe('Connection failed');
    });

    it('should return unhealthy when instance not found', async () => {
      const mockRDS = {
        describeDBInstances: vi.fn(() => ({
          promise: vi.fn().mockResolvedValue({ DBInstances: [] })
        }))
      };

      const { RDS } = await import('aws-sdk');
      vi.mocked(RDS).mockImplementation(() => mockRDS as any);

      const manager = new RDSManager(undefined, mockConfigManager);
      await manager.initialize().catch(() => {}); // Initialize will fail, but we want to test health check

      const healthStatus = await manager.performHealthCheck();

      expect(healthStatus.healthy).toBe(false);
      expect(healthStatus.status).toBe('not-found');
      expect(healthStatus.error).toBe('RDS instance not found');
    });
  });

  describe('CloudWatch metrics', () => {

    it('should get CloudWatch metrics successfully', async () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const endTime = new Date('2023-01-01T01:00:00Z');

      const metrics = await rdsManager.getCloudWatchMetrics(startTime, endTime);

      expect(typeof metrics).toBe('object');
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
    });

    it('should handle CloudWatch API errors', async () => {
      // Mock the configManager.getClients to throw an error
      vi.mocked(mockConfigManager.getClients).mockImplementation(() => {
        throw new Error('CloudWatch error');
      });

      const startTime = new Date('2023-01-01T00:00:00Z');
      const endTime = new Date('2023-01-01T01:00:00Z');

      await expect(rdsManager.getCloudWatchMetrics(startTime, endTime))
        .rejects.toThrow('Failed to get CloudWatch metrics');
    });
  });

  describe('connection testing', () => {

    it('should test connection successfully', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
        release: vi.fn()
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient)
      };

      vi.spyOn(rdsManager, 'getPool').mockReturnValue(mockPool as any);

      const result = await rdsManager.testConnection();

      expect(result).toBe(true);
    });

    it('should retry connection on failure', async () => {
      const mockPool = {
        connect: vi.fn()
          .mockRejectedValueOnce(new Error('Connection failed'))
          .mockRejectedValueOnce(new Error('Connection failed'))
          .mockResolvedValueOnce({
            query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
            release: vi.fn()
          })
      };

      vi.spyOn(rdsManager, 'getPool').mockReturnValue(mockPool as any);

      const result = await rdsManager.testConnection();

      expect(result).toBe(true);
      expect(mockPool.connect).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retry attempts', async () => {
      const mockPool = {
        connect: vi.fn().mockRejectedValue(new Error('Connection failed'))
      };

      vi.spyOn(rdsManager, 'getPool').mockReturnValue(mockPool as any);

      await expect(rdsManager.testConnection()).rejects.toThrow('Connection failed after 3 attempts');
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const updates = {
        maxConnections: 20,
        connectionTimeout: 15000
      };

      rdsManager.updateConfig(updates);
      const config = rdsManager.getConfig();

      expect(config.maxConnections).toBe(20);
      expect(config.connectionTimeout).toBe(15000);
    });

    it('should return current configuration', () => {
      const config = rdsManager.getConfig();

      expect(config).toHaveProperty('instanceIdentifier');
      expect(config).toHaveProperty('host');
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('database');
    });
  });

  describe('cleanup', () => {
    it('should close connections and cleanup', async () => {
      const mockPool = {
        end: vi.fn().mockResolvedValue(undefined)
      };

      // Set the pool directly to simulate initialized state
      (rdsManager as any).pool = mockPool;

      await rdsManager.close();

      expect(mockPool.end).toHaveBeenCalled();
      expect(rdsManager.isInitialized()).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockPool = {
        end: vi.fn().mockRejectedValue(new Error('Cleanup error'))
      };

      // Set the pool directly to simulate initialized state
      (rdsManager as any).pool = mockPool;

      // Should not throw
      await expect(rdsManager.close()).resolves.toBeUndefined();
    });
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    resetRDSManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetRDSManager();
  });

  describe('createRDSManager', () => {
    it('should create RDS manager with custom config', () => {
      const config = {
        instanceIdentifier: 'custom-instance',
        maxConnections: 15
      };

      const manager = createRDSManager(config);
      const managerConfig = manager.getConfig();

      expect(managerConfig.instanceIdentifier).toBe('custom-instance');
      expect(managerConfig.maxConnections).toBe(15);
    });

    it('should create RDS manager with default config', () => {
      const manager = createRDSManager();
      expect(manager).toBeInstanceOf(RDSManager);
    });
  });

  describe('getRDSManager', () => {
    it('should return same instance for global manager', () => {
      const manager1 = getRDSManager();
      const manager2 = getRDSManager();

      expect(manager1).toBe(manager2);
    });

    it('should create new instance after reset', () => {
      const manager1 = getRDSManager();
      resetRDSManager();
      const manager2 = getRDSManager();

      expect(manager1).not.toBe(manager2);
    });
  });
});