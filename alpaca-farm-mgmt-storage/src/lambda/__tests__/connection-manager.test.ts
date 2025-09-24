/**
 * Tests for Lambda Connection Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { 
  LambdaDbUtils,
  initializeLambdaEnvironment,
  getDatabaseConnection,
  testConnection,
  executeQuery,
  executeTransaction,
  closeDatabasePool,
  getPoolStatus,
  getConnectionInfo
} from '../connection-manager';

// Mock pg Pool
vi.mock('pg');

describe('Lambda Connection Manager', () => {
  let mockPool: any;
  let mockClient: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    process.env.RDS_HOST = 'test-rds.amazonaws.com';
    process.env.RDS_PORT = '5432';
    process.env.RDS_DATABASE = 'test_db';
    process.env.RDS_USERNAME = 'test_user';
    process.env.RDS_PASSWORD = 'test_pass';
    process.env.AWS_REGION = 'us-east-1';
    
    // Mock PoolClient
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };
    
    // Mock Pool
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      totalCount: 2,
      idleCount: 1,
      waitingCount: 0
    };
    
    (Pool as any) = vi.fn().mockImplementation(() => mockPool);
  });

  afterEach(async () => {
    await closeDatabasePool();
    vi.resetModules();
  });

  describe('initializeLambdaEnvironment', () => {
    it('should initialize connection pool successfully', async () => {
      // Mock successful health check
      mockClient.query.mockResolvedValue({
        rows: [{
          current_time: new Date(),
          version: 'PostgreSQL 13.7',
          database: 'test_db'
        }]
      });

      await initializeLambdaEnvironment();

      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        host: 'test-rds.amazonaws.com',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_pass',
        ssl: { rejectUnauthorized: false },
        max: 2,
        min: 0
      }));
      
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT NOW() as current_time, version() as version, current_database() as database'
      );
    });

    it('should reuse existing pool if health check passes', async () => {
      // Mock successful health check
      mockClient.query.mockResolvedValue({
        rows: [{
          current_time: new Date(),
          version: 'PostgreSQL 13.7',
          database: 'test_db'
        }]
      });

      // Initialize first time
      await initializeLambdaEnvironment();
      const firstPoolCall = (Pool as any).mock.calls.length;

      // Initialize second time (should reuse)
      await initializeLambdaEnvironment();
      const secondPoolCall = (Pool as any).mock.calls.length;

      expect(secondPoolCall).toBe(firstPoolCall); // No new pool created
    });

    it('should retry on initialization failure', async () => {
      let attemptCount = 0;
      mockPool.connect.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Connection failed');
        }
        return Promise.resolve(mockClient);
      });

      mockClient.query.mockResolvedValue({
        rows: [{
          current_time: new Date(),
          version: 'PostgreSQL 13.7',
          database: 'test_db'
        }]
      });

      await initializeLambdaEnvironment();

      expect(attemptCount).toBe(3); // Should have retried
    });

    it('should fail after max retry attempts', async () => {
      mockPool.connect.mockRejectedValue(new Error('Persistent connection failure'));

      await expect(initializeLambdaEnvironment()).rejects.toThrow(
        'Failed to initialize database connection pool after 3 attempts'
      );
    });

    it('should validate required environment variables', async () => {
      delete process.env.RDS_HOST;

      await expect(initializeLambdaEnvironment()).rejects.toThrow(
        'Failed to initialize database connection pool after 3 attempts'
      );
    });
  });

  describe('getDatabaseConnection', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          current_time: new Date(),
          version: 'PostgreSQL 13.7',
          database: 'test_db'
        }]
      });
      await initializeLambdaEnvironment();
    });

    it('should return database connection', async () => {
      const connection = await getDatabaseConnection();
      expect(connection).toBe(mockClient);
      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should reinitialize on connection failure', async () => {
      // First call fails
      mockPool.connect.mockRejectedValueOnce(new Error('Connection lost'));
      // Second call (after reinit) succeeds
      mockPool.connect.mockResolvedValueOnce(mockClient);

      const connection = await getDatabaseConnection();
      expect(connection).toBe(mockClient);
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          current_time: new Date(),
          version: 'PostgreSQL 13.7',
          database: 'test_db'
        }]
      });
      await initializeLambdaEnvironment();
    });

    it('should execute query successfully', async () => {
      const mockResult = { rows: [{ id: 1, name: 'Test' }], rowCount: 1 };
      mockClient.query.mockResolvedValue(mockResult);

      const result = await executeQuery('SELECT * FROM test WHERE id = $1', [1]);

      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
      expect(result).toEqual([{ id: 1, name: 'Test' }]);
    });

    it('should retry on retryable errors', async () => {
      let attemptCount = 0;
      mockClient.query.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Connection timeout');
        }
        return Promise.resolve({ rows: [{ success: true }], rowCount: 1 });
      });

      const result = await executeQuery('SELECT 1');

      expect(attemptCount).toBe(3);
      expect(result).toEqual([{ success: true }]);
    });

    it('should not retry on non-retryable errors', async () => {
      // Reset mock call count
      mockClient.query.mockClear();
      mockClient.query.mockRejectedValue(new Error('syntax error at or near "INVALID"'));

      await expect(executeQuery('INVALID SQL')).rejects.toThrow('syntax error');
      expect(mockClient.query).toHaveBeenCalledTimes(1); // No retry
    });

    it('should fail after max retry attempts', async () => {
      mockClient.query.mockRejectedValue(new Error('Connection timeout'));

      await expect(executeQuery('SELECT 1')).rejects.toThrow(
        'Query failed after 3 attempts'
      );
    });
  });

  describe('executeTransaction', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          current_time: new Date(),
          version: 'PostgreSQL 13.7',
          database: 'test_db'
        }]
      });
      await initializeLambdaEnvironment();
    });

    it('should execute transaction successfully', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

      const result = await executeTransaction(async (client) => {
        await client.query('INSERT INTO test (name) VALUES ($1)', ['Test']);
        return { success: true };
      });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO test (name) VALUES ($1)', ['Test']);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result).toEqual({ success: true });
    });

    it('should rollback on transaction error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockRejectedValueOnce(new Error('Constraint violation')) // INSERT fails
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

      await expect(executeTransaction(async (client) => {
        await client.query('INSERT INTO test (name) VALUES ($1)', ['Test']);
        return { success: true };
      })).rejects.toThrow('Constraint violation');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('testConnection', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          current_time: new Date(),
          version: 'PostgreSQL 13.7',
          database: 'test_db'
        }]
      });
      await initializeLambdaEnvironment();
    });

    it('should test connection successfully', async () => {
      await testConnection();
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT NOW() as current_time, version() as version, current_database() as database'
      );
    });

    it('should timeout on slow health check', async () => {
      process.env.DB_CONNECTION_TIMEOUT = '100';
      
      mockClient.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(testConnection()).rejects.toThrow('Database health check failed: Health check timeout');
    });
  });

  describe('getPoolStatus and getConnectionInfo', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          current_time: new Date(),
          version: 'PostgreSQL 13.7',
          database: 'test_db'
        }]
      });
      await initializeLambdaEnvironment();
    });

    it('should return pool status', () => {
      const status = getPoolStatus();
      expect(status).toEqual({
        totalCount: 2,
        idleCount: 1,
        waitingCount: 0
      });
    });

    it('should return connection info', () => {
      const info = getConnectionInfo();
      expect(info).toMatchObject({
        isInitialized: true,
        poolStatus: {
          totalCount: 2,
          idleCount: 1,
          waitingCount: 0
        },
        environment: {
          host: 'test-rds.amazonaws.com',
          database: 'test_db',
          username: 'test_user',
          maxConnections: 2
        }
      });
    });
  });

  describe('LambdaDbUtils', () => {
    it('should provide all utility functions', () => {
      expect(LambdaDbUtils).toHaveProperty('initialize');
      expect(LambdaDbUtils).toHaveProperty('getConnection');
      expect(LambdaDbUtils).toHaveProperty('testConnection');
      expect(LambdaDbUtils).toHaveProperty('executeQuery');
      expect(LambdaDbUtils).toHaveProperty('executeTransaction');
      expect(LambdaDbUtils).toHaveProperty('close');
      expect(LambdaDbUtils).toHaveProperty('getStatus');
      expect(LambdaDbUtils).toHaveProperty('getInfo');
    });
  });
});