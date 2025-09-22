import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import sqlite3 from 'sqlite3';
import { Pool } from 'pg';
import { RDS } from 'aws-sdk';
import { 
  ConnectionManager, 
  SQLiteConnection, 
  PostgreSQLConnection,
  AWSRDSConnection,
  ConnectionError,
  createDatabaseConfig,
  getConnectionManager,
  resetConnectionManager,
  DatabaseConfig 
} from '../connection';

// Mock external dependencies
vi.mock('sqlite3');
vi.mock('pg');
vi.mock('aws-sdk');

describe('SQLiteConnection', () => {
  let connection: SQLiteConnection;
  let mockDatabase: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock sqlite3.Database
    mockDatabase = {
      run: vi.fn(),
      all: vi.fn(),
      close: vi.fn()
    };
    
    (sqlite3.Database as any) = vi.fn().mockImplementation((path, callback) => {
      // Simulate successful connection
      process.nextTick(() => callback(null));
      return mockDatabase;
    });

    const config: DatabaseConfig = {
      type: 'sqlite',
      database: ':memory:'
    };
    connection = new SQLiteConnection(config);
  });

  afterEach(async () => {
    if (connection.isConnected()) {
      await connection.close();
    }
  });

  describe('connect', () => {
    it('should connect to SQLite database successfully', async () => {
      await connection.connect();
      
      expect(sqlite3.Database).toHaveBeenCalledWith(':memory:', expect.any(Function));
      expect(connection.isConnected()).toBe(true);
      expect(mockDatabase.run).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      (sqlite3.Database as any) = vi.fn().mockImplementation((path, callback) => {
        process.nextTick(() => callback(error));
        return mockDatabase;
      });

      const badConfig: DatabaseConfig = {
        type: 'sqlite',
        database: '/invalid/path/database.db'
      };
      const badConnection = new SQLiteConnection(badConfig);
      
      await expect(badConnection.connect()).rejects.toThrow(ConnectionError);
      await expect(badConnection.connect()).rejects.toThrow('Failed to connect to SQLite database: Connection failed');
    });

    it('should use provided database path', async () => {
      (sqlite3.Database as any) = vi.fn().mockImplementation((path, callback) => {
        process.nextTick(() => callback(null));
        return mockDatabase;
      });

      const config: DatabaseConfig = {
        type: 'sqlite',
        database: './test.db'
      };
      const testConnection = new SQLiteConnection(config);
      
      await testConnection.connect();
      
      expect(sqlite3.Database).toHaveBeenCalledWith('./test.db', expect.any(Function));
      
      mockDatabase.close.mockImplementation((callback) => callback(null));
      await testConnection.close();
    });

    it('should use connection string if provided', async () => {
      (sqlite3.Database as any) = vi.fn().mockImplementation((path, callback) => {
        process.nextTick(() => callback(null));
        return mockDatabase;
      });

      const config: DatabaseConfig = {
        type: 'sqlite',
        connectionString: './custom.db'
      };
      const testConnection = new SQLiteConnection(config);
      
      await testConnection.connect();
      
      expect(sqlite3.Database).toHaveBeenCalledWith('./custom.db', expect.any(Function));
      
      mockDatabase.close.mockImplementation((callback) => callback(null));
      await testConnection.close();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await connection.connect();
    });

    it('should execute queries successfully', async () => {
      const mockRows = [{ id: 1, name: 'Test' }];
      mockDatabase.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      const result = await connection.query('SELECT * FROM test WHERE name = ?', ['Test']);
      
      expect(mockDatabase.all).toHaveBeenCalledWith('SELECT * FROM test WHERE name = ?', ['Test'], expect.any(Function));
      expect(result).toEqual(mockRows);
    });

    it('should handle query errors', async () => {
      const error = new Error('Query failed');
      mockDatabase.all.mockImplementation((sql, params, callback) => {
        callback(error, null);
      });

      await expect(connection.query('SELECT * FROM invalid')).rejects.toThrow(ConnectionError);
      await expect(connection.query('SELECT * FROM invalid')).rejects.toThrow('Query failed: Query failed');
    });

    it('should throw error when not connected', async () => {
      const disconnectedConnection = new SQLiteConnection({ type: 'sqlite', database: ':memory:' });
      
      await expect(disconnectedConnection.query('SELECT 1')).rejects.toThrow(ConnectionError);
      await expect(disconnectedConnection.query('SELECT 1')).rejects.toThrow('Database not connected');
    });

    it('should handle queries with no parameters', async () => {
      const mockRows = [{ count: 5 }];
      mockDatabase.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      const result = await connection.query('SELECT COUNT(*) as count FROM test');
      
      expect(mockDatabase.all).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM test', [], expect.any(Function));
      expect(result).toEqual(mockRows);
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await connection.connect();
    });

    it('should execute statements successfully', async () => {
      mockDatabase.run.mockImplementation(function(sql, params, callback) {
        // Simulate successful execution with changes and lastID
        this.changes = 1;
        this.lastID = 123;
        callback.call(this, null);
      });

      const result = await connection.execute('INSERT INTO test (name) VALUES (?)', ['Test Name']);
      
      expect(mockDatabase.run).toHaveBeenCalledWith('INSERT INTO test (name) VALUES (?)', ['Test Name'], expect.any(Function));
      expect(result).toEqual({ changes: 1, lastInsertRowid: 123 });
    });

    it('should handle execution errors', async () => {
      const error = new Error('Execution failed');
      mockDatabase.run.mockImplementation((sql, params, callback) => {
        callback(error);
      });

      await expect(connection.execute('INSERT INTO invalid VALUES (1)')).rejects.toThrow(ConnectionError);
      await expect(connection.execute('INSERT INTO invalid VALUES (1)')).rejects.toThrow('Execute failed: Execution failed');
    });

    it('should throw error when not connected', async () => {
      const disconnectedConnection = new SQLiteConnection({ type: 'sqlite', database: ':memory:' });
      
      await expect(disconnectedConnection.execute('INSERT INTO test VALUES (1)')).rejects.toThrow(ConnectionError);
      await expect(disconnectedConnection.execute('INSERT INTO test VALUES (1)')).rejects.toThrow('Database not connected');
    });

    it('should handle execute with no parameters', async () => {
      mockDatabase.run.mockImplementation(function(sql, params, callback) {
        this.changes = 0;
        this.lastID = undefined;
        callback.call(this, null);
      });

      const result = await connection.execute('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      
      expect(mockDatabase.run).toHaveBeenCalledWith('CREATE TABLE test (id INTEGER PRIMARY KEY)', [], expect.any(Function));
      expect(result).toEqual({ changes: 0, lastInsertRowid: undefined });
    });
  });

  describe('close', () => {
    it('should close connection successfully', async () => {
      await connection.connect();
      
      mockDatabase.close.mockImplementation((callback) => {
        callback(null);
      });

      await connection.close();
      
      expect(mockDatabase.close).toHaveBeenCalledWith(expect.any(Function));
      expect(connection.isConnected()).toBe(false);
    });

    it('should handle close errors', async () => {
      await connection.connect();
      
      const error = new Error('Close failed');
      mockDatabase.close.mockImplementation((callback) => {
        callback(error);
      });

      await expect(connection.close()).rejects.toThrow(ConnectionError);
      await expect(connection.close()).rejects.toThrow('Failed to close database: Close failed');
    });

    it('should handle close when not connected', async () => {
      await expect(connection.close()).resolves.not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(connection.isConnected()).toBe(false);
    });

    it('should return true after successful connection', async () => {
      await connection.connect();
      expect(connection.isConnected()).toBe(true);
    });

    it('should return false after closing', async () => {
      await connection.connect();
      
      mockDatabase.close.mockImplementation((callback) => {
        callback(null);
      });
      
      await connection.close();
      expect(connection.isConnected()).toBe(false);
    });
  });
});

describe('PostgreSQLConnection', () => {
  let connection: PostgreSQLConnection;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      release: vi.fn()
    };
    
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined)
    };
    
    (Pool as any) = vi.fn().mockImplementation(() => mockPool);

    const config: DatabaseConfig = {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_pass'
    };
    connection = new PostgreSQLConnection(config);
  });

  afterEach(async () => {
    if (connection.isConnected()) {
      await connection.close();
    }
  });

  describe('connect', () => {
    it('should connect to PostgreSQL database successfully', async () => {
      await connection.connect();
      
      expect(Pool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_pass',
        ssl: undefined,
        max: 10,
        connectionTimeoutMillis: 5000
      });
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
      expect(connection.isConnected()).toBe(true);
    });

    it('should use connection string when provided', async () => {
      const config: DatabaseConfig = {
        type: 'postgresql',
        connectionString: 'postgresql://user:pass@localhost:5432/db'
      };
      const testConnection = new PostgreSQLConnection(config);
      
      await testConnection.connect();
      
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        connectionString: 'postgresql://user:pass@localhost:5432/db'
      }));
      await testConnection.close();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(error);

      await expect(connection.connect()).rejects.toThrow(ConnectionError);
      await expect(connection.connect()).rejects.toThrow('Failed to connect to PostgreSQL: Connection failed');
    });

    it('should configure SSL when specified', async () => {
      const config: DatabaseConfig = {
        type: 'postgresql',
        host: 'localhost',
        ssl: true,
        maxConnections: 20,
        connectionTimeout: 10000
      };
      const sslConnection = new PostgreSQLConnection(config);
      
      await sslConnection.connect();
      
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        ssl: true,
        max: 20,
        connectionTimeoutMillis: 10000
      }));
      await sslConnection.close();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await connection.connect();
    });

    it('should execute queries successfully', async () => {
      const mockResult = { rows: [{ id: 1, name: 'Test' }] };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await connection.query('SELECT * FROM test WHERE id = $1', [1]);
      
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
      expect(result).toEqual([{ id: 1, name: 'Test' }]);
    });

    it('should handle query errors', async () => {
      const error = new Error('Query failed');
      mockPool.query.mockRejectedValue(error);

      await expect(connection.query('SELECT * FROM invalid')).rejects.toThrow(ConnectionError);
      await expect(connection.query('SELECT * FROM invalid')).rejects.toThrow('Query failed: Query failed');
    });

    it('should throw error when not connected', async () => {
      const disconnectedConnection = new PostgreSQLConnection({ type: 'postgresql' });
      
      await expect(disconnectedConnection.query('SELECT 1')).rejects.toThrow(ConnectionError);
      await expect(disconnectedConnection.query('SELECT 1')).rejects.toThrow('Database not connected');
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await connection.connect();
    });

    it('should execute statements successfully', async () => {
      const mockResult = { rowCount: 1, rows: [{ id: 123 }] };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await connection.execute('INSERT INTO test (name) VALUES ($1)', ['Test Name']);
      
      expect(mockPool.query).toHaveBeenCalledWith('INSERT INTO test (name) VALUES ($1)', ['Test Name']);
      expect(result).toEqual({ changes: 1, lastInsertRowid: 123 });
    });

    it('should handle null rowCount', async () => {
      const mockResult = { rowCount: null, rows: [] };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await connection.execute('CREATE TABLE test (id SERIAL PRIMARY KEY)');
      
      expect(result).toEqual({ changes: 0, lastInsertRowid: undefined });
    });

    it('should handle execution errors', async () => {
      const error = new Error('Execution failed');
      mockPool.query.mockRejectedValue(error);

      await expect(connection.execute('INSERT INTO invalid VALUES (1)')).rejects.toThrow(ConnectionError);
      await expect(connection.execute('INSERT INTO invalid VALUES (1)')).rejects.toThrow('Execute failed: Execution failed');
    });
  });

  describe('close', () => {
    it('should close pool successfully', async () => {
      await connection.connect();
      
      await connection.close();
      
      expect(mockPool.end).toHaveBeenCalled();
      expect(connection.isConnected()).toBe(false);
    });

    it('should handle close errors', async () => {
      await connection.connect();
      
      const error = new Error('Close failed');
      mockPool.end.mockRejectedValue(error);

      await expect(connection.close()).rejects.toThrow(ConnectionError);
      await expect(connection.close()).rejects.toThrow('Failed to close pool: Close failed');
    });

    it('should handle close when not connected', async () => {
      await expect(connection.close()).resolves.not.toThrow();
    });
  });
});

describe('AWSRDSConnection', () => {
  let connection: AWSRDSConnection;
  let mockPool: any;
  let mockClient: any;
  let mockRDS: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      release: vi.fn()
    };
    
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined)
    };
    
    mockRDS = {
      getAuthToken: vi.fn()
    };
    
    (Pool as any) = vi.fn().mockImplementation(() => mockPool);
    (RDS as any) = vi.fn().mockImplementation(() => mockRDS);

    const config: DatabaseConfig = {
      type: 'aws-rds',
      host: 'rds.amazonaws.com',
      port: 5432,
      database: 'alpaca_db',
      username: 'admin',
      password: 'secret',
      region: 'us-east-1'
    };
    connection = new AWSRDSConnection(config);
  });

  afterEach(async () => {
    if (connection.isConnected()) {
      await connection.close();
    }
  });

  describe('connect', () => {
    it('should connect to AWS RDS successfully', async () => {
      await connection.connect();
      
      expect(RDS).toHaveBeenCalledWith({ region: 'us-east-1' });
      expect(Pool).toHaveBeenCalledWith({
        host: 'rds.amazonaws.com',
        port: 5432,
        database: 'alpaca_db',
        user: 'admin',
        password: 'secret',
        ssl: true,
        max: 10,
        connectionTimeoutMillis: 10000
      });
      expect(connection.isConnected()).toBe(true);
    });

    it('should use IAM authentication when configured', async () => {
      const iamToken = 'iam-auth-token';
      mockRDS.getAuthToken.mockImplementation((params, callback) => {
        callback(null, iamToken);
      });

      const config: DatabaseConfig = {
        type: 'aws-rds',
        host: 'rds.amazonaws.com',
        username: 'admin',
        useIAM: true,
        rdsInstanceIdentifier: 'alpaca-db-instance',
        region: 'us-west-2'
      };
      const iamConnection = new AWSRDSConnection(config);
      
      await iamConnection.connect();
      
      expect(mockRDS.getAuthToken).toHaveBeenCalledWith({
        hostname: 'rds.amazonaws.com',
        port: 5432,
        username: 'admin',
        region: 'us-west-2'
      }, expect.any(Function));
      
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        password: iamToken
      }));
      
      await iamConnection.close();
    });

    it('should handle IAM token generation errors', async () => {
      const error = new Error('IAM token failed');
      mockRDS.getAuthToken.mockImplementation((params, callback) => {
        callback(error, null);
      });

      const config: DatabaseConfig = {
        type: 'aws-rds',
        host: 'rds.amazonaws.com',
        useIAM: true,
        rdsInstanceIdentifier: 'alpaca-db-instance'
      };
      const iamConnection = new AWSRDSConnection(config);
      
      await expect(iamConnection.connect()).rejects.toThrow(ConnectionError);
      await expect(iamConnection.connect()).rejects.toThrow('Failed to generate IAM token: IAM token failed');
    });

    it('should handle connection errors', async () => {
      const error = new Error('RDS connection failed');
      mockPool.connect.mockRejectedValue(error);

      await expect(connection.connect()).rejects.toThrow(ConnectionError);
      await expect(connection.connect()).rejects.toThrow('Failed to connect to AWS RDS: RDS connection failed');
    });

    it('should default to us-east-1 region', async () => {
      const config: DatabaseConfig = {
        type: 'aws-rds',
        host: 'rds.amazonaws.com'
      };
      const defaultConnection = new AWSRDSConnection(config);
      
      await defaultConnection.connect();
      
      expect(RDS).toHaveBeenCalledWith({ region: 'us-east-1' });
      await defaultConnection.close();
    });
  });

  describe('query and execute', () => {
    beforeEach(async () => {
      await connection.connect();
    });

    it('should execute queries successfully', async () => {
      const mockResult = { rows: [{ id: 1, name: 'Test' }] };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await connection.query('SELECT * FROM test WHERE id = $1', [1]);
      
      expect(result).toEqual([{ id: 1, name: 'Test' }]);
    });

    it('should execute statements successfully', async () => {
      const mockResult = { rowCount: 1, rows: [{ id: 123 }] };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await connection.execute('INSERT INTO test (name) VALUES ($1)', ['Test Name']);
      
      expect(result).toEqual({ changes: 1, lastInsertRowid: 123 });
    });
  });
});

describe('ConnectionManager', () => {
  let manager: ConnectionManager;
  let mockDatabase: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock sqlite3.Database for ConnectionManager tests
    mockDatabase = {
      run: vi.fn(),
      all: vi.fn(),
      close: vi.fn()
    };
    
    (sqlite3.Database as any) = vi.fn().mockImplementation((path, callback) => {
      process.nextTick(() => callback(null));
      return mockDatabase;
    });

    const config: DatabaseConfig = {
      type: 'sqlite',
      database: ':memory:',
      retryAttempts: 2,
      retryDelay: 10
    };
    manager = new ConnectionManager(config);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('connect', () => {
    it('should create and manage connections', async () => {
      const connection = await manager.connect();
      expect(connection.isConnected()).toBe(true);
      
      // Should return same connection on subsequent calls
      const connection2 = await manager.getConnection();
      expect(connection2).toBe(connection);
    });

    it('should return existing connection if already connected', async () => {
      const connection1 = await manager.connect();
      const connection2 = await manager.connect();
      
      expect(connection1).toBe(connection2);
      expect(connection1.isConnected()).toBe(true);
    });

    it('should retry failed connections', async () => {
      let attemptCount = 0;
      (sqlite3.Database as any) = vi.fn().mockImplementation((path, callback) => {
        attemptCount++;
        if (attemptCount <= 1) {
          process.nextTick(() => callback(new Error('Connection failed')));
        } else {
          process.nextTick(() => callback(null));
        }
        return mockDatabase;
      });
      
      const connection = await manager.connect();
      expect(connection.isConnected()).toBe(true);
      expect(attemptCount).toBe(2);
    });

    it('should fail after max retry attempts', async () => {
      (sqlite3.Database as any) = vi.fn().mockImplementation((path, callback) => {
        process.nextTick(() => callback(new Error('Persistent connection failure')));
        return mockDatabase;
      });
      
      await expect(manager.connect()).rejects.toThrow(ConnectionError);
      await expect(manager.connect()).rejects.toThrow('Failed to connect after 3 attempts');
    });

    it('should handle unsupported database types', async () => {
      const badConfig: DatabaseConfig = {
        type: 'unsupported' as any,
        retryAttempts: 1,
        retryDelay: 10
      };
      
      const badManager = new ConnectionManager(badConfig);
      await expect(badManager.connect()).rejects.toThrow(ConnectionError);
      await expect(badManager.connect()).rejects.toThrow('Unsupported database type: unsupported');
      await badManager.close();
    });
  });

  describe('getConnection', () => {
    it('should connect if no existing connection', async () => {
      const connection = await manager.getConnection();
      expect(connection.isConnected()).toBe(true);
    });

    it('should reconnect if existing connection is not connected', async () => {
      const connection1 = await manager.connect();
      
      // Simulate connection loss
      mockDatabase.close.mockImplementation((callback) => callback(null));
      await connection1.close();
      
      const connection2 = await manager.getConnection();
      expect(connection2.isConnected()).toBe(true);
    });
  });

  describe('close', () => {
    it('should close existing connection', async () => {
      await manager.connect();
      
      mockDatabase.close.mockImplementation((callback) => callback(null));
      await manager.close();
      
      expect(mockDatabase.close).toHaveBeenCalled();
    });

    it('should handle close when no connection exists', async () => {
      await expect(manager.close()).resolves.not.toThrow();
    });
  });

  describe('configuration defaults', () => {
    it('should apply default configuration values', () => {
      const config: DatabaseConfig = { type: 'sqlite' };
      const managerWithDefaults = new ConnectionManager(config);
      
      // Access private config to verify defaults were applied
      const privateConfig = (managerWithDefaults as any).config;
      expect(privateConfig.retryAttempts).toBe(3);
      expect(privateConfig.retryDelay).toBe(1000);
      expect(privateConfig.connectionTimeout).toBe(5000);
    });
  });

  describe('createConnection', () => {
    it('should create SQLite connection', () => {
      const config: DatabaseConfig = { type: 'sqlite', database: 'test.db' };
      const testManager = new ConnectionManager(config);
      
      const connection = (testManager as any).createConnection();
      expect(connection).toBeInstanceOf(SQLiteConnection);
    });

    it('should create PostgreSQL connection', () => {
      const config: DatabaseConfig = { type: 'postgresql', host: 'localhost' };
      const testManager = new ConnectionManager(config);
      
      const connection = (testManager as any).createConnection();
      expect(connection).toBeInstanceOf(PostgreSQLConnection);
    });

    it('should create AWS RDS connection', () => {
      const config: DatabaseConfig = { type: 'aws-rds', host: 'rds.amazonaws.com' };
      const testManager = new ConnectionManager(config);
      
      const connection = (testManager as any).createConnection();
      expect(connection).toBeInstanceOf(AWSRDSConnection);
    });
  });
});

describe('createDatabaseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('SQLite configuration', () => {
    it('should create SQLite config by default', () => {
      delete process.env.DB_TYPE;
      
      const config = createDatabaseConfig();
      
      expect(config.type).toBe('sqlite');
      expect(config.database).toBe('./data/alpaca-herd.db');
      expect(config.retryAttempts).toBe(3);
      expect(config.retryDelay).toBe(1000);
      expect(config.connectionTimeout).toBe(5000);
      expect(config.maxConnections).toBe(10);
    });

    it('should use custom SQLite database path', () => {
      process.env.DB_TYPE = 'sqlite';
      process.env.DB_PATH = './custom/path/database.db';
      
      const config = createDatabaseConfig();
      
      expect(config.type).toBe('sqlite');
      expect(config.database).toBe('./custom/path/database.db');
    });

    it('should parse retry configuration for SQLite', () => {
      process.env.DB_TYPE = 'sqlite';
      process.env.DB_RETRY_ATTEMPTS = '5';
      process.env.DB_RETRY_DELAY = '2000';
      process.env.DB_CONNECTION_TIMEOUT = '8000';
      process.env.DB_MAX_CONNECTIONS = '15';
      
      const config = createDatabaseConfig();
      
      expect(config.retryAttempts).toBe(5);
      expect(config.retryDelay).toBe(2000);
      expect(config.connectionTimeout).toBe(8000);
      expect(config.maxConnections).toBe(15);
    });
  });

  describe('PostgreSQL configuration', () => {
    it('should create PostgreSQL config from environment', () => {
      process.env.DB_TYPE = 'postgresql';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_pass';
      process.env.DB_SSL = 'true';

      const config = createDatabaseConfig();
      
      expect(config.type).toBe('postgresql');
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.database).toBe('test_db');
      expect(config.username).toBe('test_user');
      expect(config.password).toBe('test_pass');
      expect(config.ssl).toBe(true);
    });

    it('should use default PostgreSQL values', () => {
      process.env.DB_TYPE = 'postgresql';
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_NAME;
      delete process.env.DB_USER;
      delete process.env.DB_SSL;
      
      const config = createDatabaseConfig();
      
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.database).toBe('alpaca_herd');
      expect(config.username).toBe('postgres');
      expect(config.ssl).toBe(false);
    });

    it('should use connection string when provided', () => {
      process.env.DB_TYPE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
      
      const config = createDatabaseConfig();
      
      expect(config.connectionString).toBe('postgresql://user:pass@host:5432/db');
    });

    it('should handle SSL configuration variations', () => {
      process.env.DB_TYPE = 'postgresql';
      
      // Test SSL = false
      process.env.DB_SSL = 'false';
      let config = createDatabaseConfig();
      expect(config.ssl).toBe(false);
      
      // Test SSL = undefined
      delete process.env.DB_SSL;
      config = createDatabaseConfig();
      expect(config.ssl).toBe(false);
      
      // Test SSL = true
      process.env.DB_SSL = 'true';
      config = createDatabaseConfig();
      expect(config.ssl).toBe(true);
    });
  });

  describe('AWS RDS configuration', () => {
    it('should create AWS RDS config from environment', () => {
      process.env.DB_TYPE = 'aws-rds';
      process.env.RDS_HOST = 'rds.amazonaws.com';
      process.env.RDS_PORT = '5432';
      process.env.RDS_DATABASE = 'alpaca_prod';
      process.env.RDS_USERNAME = 'admin';
      process.env.RDS_PASSWORD = 'secret';
      process.env.AWS_REGION = 'us-west-2';
      process.env.RDS_USE_IAM = 'true';
      process.env.RDS_INSTANCE_ID = 'alpaca-db-instance';

      const config = createDatabaseConfig();
      
      expect(config.type).toBe('aws-rds');
      expect(config.host).toBe('rds.amazonaws.com');
      expect(config.port).toBe(5432);
      expect(config.database).toBe('alpaca_prod');
      expect(config.username).toBe('admin');
      expect(config.password).toBe('secret');
      expect(config.region).toBe('us-west-2');
      expect(config.useIAM).toBe(true);
      expect(config.rdsInstanceIdentifier).toBe('alpaca-db-instance');
      expect(config.ssl).toBe(true);
    });

    it('should use default RDS values', () => {
      process.env.DB_TYPE = 'aws-rds';
      delete process.env.RDS_PORT;
      delete process.env.RDS_DATABASE;
      delete process.env.AWS_REGION;
      delete process.env.RDS_USE_IAM;
      
      const config = createDatabaseConfig();
      
      expect(config.port).toBe(5432);
      expect(config.database).toBe('alpaca_herd');
      expect(config.region).toBe('us-east-1');
      expect(config.useIAM).toBe(false);
      expect(config.ssl).toBe(true); // Always true for RDS
    });

    it('should handle IAM authentication configuration', () => {
      process.env.DB_TYPE = 'aws-rds';
      
      // Test IAM = false
      process.env.RDS_USE_IAM = 'false';
      let config = createDatabaseConfig();
      expect(config.useIAM).toBe(false);
      
      // Test IAM = undefined
      delete process.env.RDS_USE_IAM;
      config = createDatabaseConfig();
      expect(config.useIAM).toBe(false);
      
      // Test IAM = true
      process.env.RDS_USE_IAM = 'true';
      config = createDatabaseConfig();
      expect(config.useIAM).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported database type', () => {
      process.env.DB_TYPE = 'unsupported';
      
      expect(() => createDatabaseConfig()).toThrow('Unsupported database type: unsupported');
    });

    it('should handle invalid port numbers gracefully', () => {
      process.env.DB_TYPE = 'postgresql';
      process.env.DB_PORT = 'invalid';
      
      const config = createDatabaseConfig();
      expect(config.port).toBeNaN();
    });

    it('should handle invalid retry configuration gracefully', () => {
      process.env.DB_TYPE = 'sqlite';
      process.env.DB_RETRY_ATTEMPTS = 'invalid';
      process.env.DB_RETRY_DELAY = 'invalid';
      process.env.DB_CONNECTION_TIMEOUT = 'invalid';
      process.env.DB_MAX_CONNECTIONS = 'invalid';
      
      const config = createDatabaseConfig();
      expect(config.retryAttempts).toBeNaN();
      expect(config.retryDelay).toBeNaN();
      expect(config.connectionTimeout).toBeNaN();
      expect(config.maxConnections).toBeNaN();
    });
  });
});

describe('Global Connection Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetConnectionManager();
  });

  describe('getConnectionManager', () => {
    it('should create and reuse global connection manager', () => {
      const manager1 = getConnectionManager();
      const manager2 = getConnectionManager();
      expect(manager1).toBe(manager2);
    });

    it('should use provided config for new manager', () => {
      const customConfig: DatabaseConfig = {
        type: 'sqlite',
        database: 'custom.db',
        retryAttempts: 5
      };
      
      const manager = getConnectionManager(customConfig);
      expect(manager).toBeInstanceOf(ConnectionManager);
      
      // Subsequent calls should return the same manager
      const manager2 = getConnectionManager();
      expect(manager2).toBe(manager);
    });

    it('should ignore config on subsequent calls', () => {
      const config1: DatabaseConfig = { type: 'sqlite', database: 'db1.db' };
      const config2: DatabaseConfig = { type: 'postgresql', host: 'localhost' };
      
      const manager1 = getConnectionManager(config1);
      const manager2 = getConnectionManager(config2);
      
      expect(manager1).toBe(manager2);
    });
  });

  describe('resetConnectionManager', () => {
    it('should reset global connection manager', () => {
      const manager1 = getConnectionManager();
      resetConnectionManager();
      const manager2 = getConnectionManager();
      expect(manager1).not.toBe(manager2);
    });

    it('should close existing connection manager', async () => {
      const manager = getConnectionManager();
      const closeSpy = vi.spyOn(manager, 'close').mockResolvedValue();
      
      resetConnectionManager();
      
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      const manager = getConnectionManager();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(manager, 'close').mockRejectedValue(new Error('Close failed'));
      
      resetConnectionManager();
      
      // Wait for async close to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should allow creating new manager after reset', () => {
      const manager1 = getConnectionManager();
      resetConnectionManager();
      const manager2 = getConnectionManager();
      const manager3 = getConnectionManager();
      
      expect(manager1).not.toBe(manager2);
      expect(manager2).toBe(manager3);
    });
  });
});