/**
 * Tests for Lambda Database Adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  LambdaDatabaseConnection,
  LambdaConnectionManager,
  getLambdaConnectionManager,
  resetLambdaConnectionManager,
  createLambdaDatabaseConfig
} from '../database-adapter';

// Mock the connection manager
vi.mock('../connection-manager', () => ({
  LambdaDbUtils: {
    initialize: vi.fn(),
    testConnection: vi.fn(),
    getStatus: vi.fn(),
    getInfo: vi.fn(),
    close: vi.fn()
  },
  executeQuery: vi.fn(),
  executeTransaction: vi.fn()
}));

describe('LambdaDatabaseConnection', () => {
  let connection: LambdaDatabaseConnection;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup default mock return values
    const { LambdaDbUtils } = await import('../connection-manager');
    (LambdaDbUtils.getStatus as any).mockReturnValue({
      totalCount: 2,
      idleCount: 1,
      waitingCount: 0
    });
    
    connection = new LambdaDatabaseConnection();
    
    // Setup environment variables
    process.env.RDS_HOST = 'test-rds.amazonaws.com';
    process.env.RDS_USERNAME = 'test_user';
    process.env.RDS_DATABASE = 'test_db';
    process.env.RDS_PASSWORD = 'test_pass';
  });

  afterEach(async () => {
    await connection.close();
  });

  describe('query', () => {
    it('should execute query successfully', async () => {
      const { LambdaDbUtils, executeQuery } = await import('../connection-manager');
      const mockResult = [{ id: 1, name: 'Test' }];
      (executeQuery as any).mockResolvedValue(mockResult);

      const result = await connection.query('SELECT * FROM test WHERE id = $1', [1]);

      expect(LambdaDbUtils.initialize).toHaveBeenCalled();
      expect(executeQuery).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
      expect(result).toEqual(mockResult);
    });

    it('should handle query errors', async () => {
      const { executeQuery } = await import('../connection-manager');
      (executeQuery as any).mockRejectedValue(new Error('Query failed'));

      await expect(connection.query('SELECT * FROM invalid')).rejects.toThrow('Lambda query failed: Query failed');
    });
  });

  describe('isConnected', () => {
    it('should return true when pool has connections', () => {
      expect(connection.isConnected()).toBe(true);
    });

    it('should return false when pool has no connections', async () => {
      const { LambdaDbUtils } = await import('../connection-manager');
      (LambdaDbUtils.getStatus as any).mockReturnValue({
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0
      });

      expect(connection.isConnected()).toBe(false);
    });
  });

  describe('close', () => {
    it('should close connection (no-op)', async () => {
      await connection.close();
      // Should not throw and should be a no-op
    });
  });
});

describe('LambdaConnectionManager', () => {
  let manager: LambdaConnectionManager;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mock return values
    const { LambdaDbUtils } = await import('../connection-manager');
    (LambdaDbUtils.getInfo as any).mockReturnValue({
      isInitialized: true,
      poolStatus: { totalCount: 2, idleCount: 1, waitingCount: 0 },
      environment: { host: 'test-host' }
    });
    
    manager = new LambdaConnectionManager();
    
    process.env.RDS_HOST = 'test-rds.amazonaws.com';
    process.env.RDS_USERNAME = 'test_user';
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('getConnection', () => {
    it('should return Lambda database connection', async () => {
      const connection = await manager.getConnection();
      expect(connection).toBeInstanceOf(LambdaDatabaseConnection);
    });
  });

  describe('getStatus', () => {
    it('should return connection info', () => {
      const status = manager.getStatus();
      expect(status).toMatchObject({
        isInitialized: true,
        poolStatus: expect.any(Object),
        environment: expect.any(Object)
      });
    });
  });
});

describe('Global Lambda Connection Manager', () => {
  afterEach(async () => {
    await resetLambdaConnectionManager();
  });

  describe('getLambdaConnectionManager', () => {
    it('should return singleton instance', () => {
      const manager1 = getLambdaConnectionManager();
      const manager2 = getLambdaConnectionManager();
      expect(manager1).toBe(manager2);
    });
  });
});

describe('createLambdaDatabaseConfig', () => {
  beforeEach(() => {
    // Clear environment
    delete process.env.RDS_HOST;
    delete process.env.RDS_USERNAME;
    delete process.env.RDS_DATABASE;
    delete process.env.RDS_PASSWORD;
    delete process.env.RDS_PORT;
    delete process.env.AWS_REGION;
    delete process.env.RDS_SSL;
    delete process.env.DB_MAX_CONNECTIONS;
    delete process.env.DB_CONNECTION_TIMEOUT;
    delete process.env.DB_MAX_RETRY_ATTEMPTS;
    delete process.env.DB_RETRY_DELAY;
  });

  it('should create config from environment variables', () => {
    process.env.RDS_HOST = 'test-rds.amazonaws.com';
    process.env.RDS_USERNAME = 'test_user';
    process.env.RDS_DATABASE = 'test_db';
    process.env.RDS_PASSWORD = 'test_pass';
    process.env.RDS_PORT = '5432';
    process.env.AWS_REGION = 'us-west-2';
    process.env.RDS_SSL = 'true';
    process.env.DB_MAX_CONNECTIONS = '5';
    process.env.DB_CONNECTION_TIMEOUT = '10000';
    process.env.DB_MAX_RETRY_ATTEMPTS = '5';
    process.env.DB_RETRY_DELAY = '2000';

    const config = createLambdaDatabaseConfig();

    expect(config).toEqual({
      type: 'aws-rds',
      host: 'test-rds.amazonaws.com',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_pass',
      region: 'us-west-2',
      ssl: true,
      maxConnections: 5,
      connectionTimeout: 10000,
      retryAttempts: 5,
      retryDelay: 2000
    });
  });

  it('should use default values', () => {
    process.env.RDS_HOST = 'test-host';
    process.env.RDS_USERNAME = 'test_user';

    const config = createLambdaDatabaseConfig();

    expect(config).toMatchObject({
      type: 'aws-rds',
      host: 'test-host',
      port: 5432,
      database: 'alpaca_herd',
      username: 'test_user',
      password: '',
      region: 'us-east-1',
      ssl: true,
      maxConnections: 2,
      connectionTimeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000
    });
  });

  it('should throw error for missing required variables', () => {
    expect(() => createLambdaDatabaseConfig()).toThrow(
      'Missing required Lambda database environment variables: RDS_HOST, RDS_USERNAME'
    );
  });

  it('should throw error for missing RDS_HOST only', () => {
    process.env.RDS_USERNAME = 'test_user';

    expect(() => createLambdaDatabaseConfig()).toThrow(
      'Missing required Lambda database environment variables: RDS_HOST'
    );
  });

  it('should throw error for missing RDS_USERNAME only', () => {
    process.env.RDS_HOST = 'test-host';

    expect(() => createLambdaDatabaseConfig()).toThrow(
      'Missing required Lambda database environment variables: RDS_USERNAME'
    );
  });

  it('should handle SSL configuration', () => {
    process.env.RDS_HOST = 'test-host';
    process.env.RDS_USERNAME = 'test_user';
    
    // Test SSL = false
    process.env.RDS_SSL = 'false';
    let config = createLambdaDatabaseConfig();
    expect(config.ssl).toBe(false);
    
    // Test SSL = true (default)
    delete process.env.RDS_SSL;
    config = createLambdaDatabaseConfig();
    expect(config.ssl).toBe(true);
  });
});