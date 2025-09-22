import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('SQLiteConnection', () => {
  let connection: SQLiteConnection;
  
  beforeEach(() => {
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

  it('should connect to SQLite database', async () => {
    await connection.connect();
    expect(connection.isConnected()).toBe(true);
  });

  it('should execute queries', async () => {
    await connection.connect();
    
    // Create a test table
    await connection.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    
    // Insert data
    const result = await connection.execute('INSERT INTO test (name) VALUES (?)', ['Test Name']);
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBe(1);
    
    // Query data
    const rows = await connection.query('SELECT * FROM test WHERE name = ?', ['Test Name']);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ id: 1, name: 'Test Name' });
  });

  it('should handle connection errors', async () => {
    const badConfig: DatabaseConfig = {
      type: 'sqlite',
      database: '/invalid/path/database.db'
    };
    const badConnection = new SQLiteConnection(badConfig);
    
    await expect(badConnection.connect()).rejects.toThrow(ConnectionError);
  });

  it('should throw error when querying without connection', async () => {
    await expect(connection.query('SELECT 1')).rejects.toThrow(ConnectionError);
  });
});

describe('ConnectionManager', () => {
  let manager: ConnectionManager;
  
  beforeEach(() => {
    const config: DatabaseConfig = {
      type: 'sqlite',
      database: ':memory:',
      retryAttempts: 2,
      retryDelay: 100
    };
    manager = new ConnectionManager(config);
  });

  afterEach(async () => {
    await manager.close();
  });

  it('should create and manage connections', async () => {
    const connection = await manager.connect();
    expect(connection.isConnected()).toBe(true);
    
    // Should return same connection on subsequent calls
    const connection2 = await manager.getConnection();
    expect(connection2).toBe(connection);
  });

  it('should retry failed connections', async () => {
    // Mock the createConnection to simulate connection failures
    const manager = new ConnectionManager({
      type: 'sqlite',
      database: ':memory:',
      retryAttempts: 2,
      retryDelay: 10
    });
    
    // Override createConnection to throw error first few times
    let attemptCount = 0;
    const originalCreateConnection = (manager as any).createConnection;
    (manager as any).createConnection = () => {
      attemptCount++;
      if (attemptCount <= 2) {
        throw new Error('Simulated connection failure');
      }
      return originalCreateConnection.call(manager);
    };
    
    // Should eventually succeed after retries
    const connection = await manager.connect();
    expect(connection.isConnected()).toBe(true);
    await manager.close();
  });

  it('should handle unsupported database types', async () => {
    const badConfig: DatabaseConfig = {
      type: 'unsupported' as any,
      retryAttempts: 1,
      retryDelay: 10
    };
    
    expect(() => new ConnectionManager(badConfig)).not.toThrow();
    const badManager = new ConnectionManager(badConfig);
    await expect(badManager.connect()).rejects.toThrow(ConnectionError);
    await badManager.close();
  }, 5000);
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

  it('should create SQLite config by default', () => {
    const config = createDatabaseConfig();
    expect(config.type).toBe('sqlite');
    expect(config.database).toBe('./data/alpaca-herd.db');
  });

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
    expect(config.region).toBe('us-west-2');
    expect(config.useIAM).toBe(true);
    expect(config.rdsInstanceIdentifier).toBe('alpaca-db-instance');
    expect(config.ssl).toBe(true);
  });
});

describe('Global Connection Manager', () => {
  afterEach(() => {
    resetConnectionManager();
  });

  it('should create and reuse global connection manager', () => {
    const manager1 = getConnectionManager();
    const manager2 = getConnectionManager();
    expect(manager1).toBe(manager2);
  });

  it('should reset global connection manager', () => {
    const manager1 = getConnectionManager();
    resetConnectionManager();
    const manager2 = getConnectionManager();
    expect(manager1).not.toBe(manager2);
  });
});