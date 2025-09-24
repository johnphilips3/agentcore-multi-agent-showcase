import { Pool, Client, PoolConfig } from 'pg';
import { RDS } from 'aws-sdk';

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'aws-rds';
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  // AWS RDS specific
  region?: string;
  useIAM?: boolean;
  rdsInstanceIdentifier?: string;
}

export interface DatabaseConnection {
  connect(): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  close(): Promise<void>;
  isConnected(): boolean;
  testConnection(): Promise<void>;
}

export class ConnectionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class SQLiteConnection implements DatabaseConnection {
  private db: any | null = null;
  private connected = false;
  private sqlite3: any = null;

  constructor(private config: DatabaseConfig) {}

  async connect(): Promise<void> {
    // Dynamically load sqlite3 only when needed
    if (!this.sqlite3) {
      try {
        this.sqlite3 = require('sqlite3');
      } catch (error) {
        throw new ConnectionError('SQLite3 is not available in this environment. Use PostgreSQL or AWS RDS instead.');
      }
    }
    
    return new Promise((resolve, reject) => {
      const dbPath = this.config.connectionString || this.config.database || ':memory:';
      
      this.db = new this.sqlite3.Database(dbPath, (err: any) => {
        if (err) {
          reject(new ConnectionError(`Failed to connect to SQLite database: ${err.message}`, err));
          return;
        }
        
        this.connected = true;
        // Enable foreign keys
        this.db!.run('PRAGMA foreign_keys = ON');
        resolve();
      });
    });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db || !this.connected) {
      throw new ConnectionError('Database not connected');
    }

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err: any, rows: any) => {
        if (err) {
          reject(new ConnectionError(`Query failed: ${err.message}`, err));
          return;
        }
        resolve(rows as T[]);
      });
    });
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (!this.db || !this.connected) {
      throw new ConnectionError('Database not connected');
    }

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err: any) {
        if (err) {
          reject(new ConnectionError(`Execute failed: ${err.message}`, err));
          return;
        }
        // @ts-ignore - 'this' in sqlite3 callback refers to the statement context
        resolve({ changes: this.changes, lastInsertRowid: this.lastID });
      });
    });
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.close((err: any) => {
        if (err) {
          reject(new ConnectionError(`Failed to close database: ${err.message}`, err));
          return;
        }
        this.connected = false;
        this.db = null;
        resolve();
      });
    });
  }

  isConnected(): boolean {
    return this.connected && this.db !== null;
  }

  async testConnection(): Promise<void> {
    if (!this.isConnected()) {
      throw new ConnectionError('Database not connected');
    }
    
    // Test with a simple query
    await this.query('SELECT 1');
  }
}export
 class PostgreSQLConnection implements DatabaseConnection {
  private pool: Pool | null = null;
  private connected = false;

  constructor(private config: DatabaseConfig) {}

  async connect(): Promise<void> {
    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port || 5432,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl,
      max: this.config.maxConnections || 10,
      connectionTimeoutMillis: this.config.connectionTimeout || 5000,
    };

    if (this.config.connectionString) {
      poolConfig.connectionString = this.config.connectionString;
    }

    try {
      this.pool = new Pool(poolConfig);
      
      // Test connection
      const client = await this.pool.connect();
      client.release();
      
      this.connected = true;
    } catch (error) {
      throw new ConnectionError(`Failed to connect to PostgreSQL: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.pool || !this.connected) {
      throw new ConnectionError('Database not connected');
    }

    try {
      const result = await this.pool.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      throw new ConnectionError(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (!this.pool || !this.connected) {
      throw new ConnectionError('Database not connected');
    }

    try {
      const result = await this.pool.query(sql, params);
      return { 
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows[0]?.id 
      };
    } catch (error) {
      throw new ConnectionError(`Execute failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  async close(): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.end();
      this.connected = false;
      this.pool = null;
    } catch (error) {
      throw new ConnectionError(`Failed to close pool: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  isConnected(): boolean {
    return this.connected && this.pool !== null;
  }

  async testConnection(): Promise<void> {
    if (!this.isConnected()) {
      throw new ConnectionError('Database not connected');
    }
    
    // Test with a simple query
    await this.query('SELECT 1');
  }
}

export class AWSRDSConnection implements DatabaseConnection {
  private pool: Pool | null = null;
  private connected = false;
  private rds: RDS;

  constructor(private config: DatabaseConfig) {
    this.rds = new RDS({ region: this.config.region || 'us-east-1' });
  }

  async connect(): Promise<void> {
    try {
      let password = this.config.password;

      // Use IAM authentication if configured
      if (this.config.useIAM && this.config.rdsInstanceIdentifier) {
        password = await this.generateIAMToken();
      }

      const poolConfig: PoolConfig = {
        host: this.config.host,
        port: this.config.port || 5432,
        database: this.config.database,
        user: this.config.username,
        password: password,
        ssl: this.config.ssl !== false, // Default to true for RDS
        max: this.config.maxConnections || 10,
        connectionTimeoutMillis: this.config.connectionTimeout || 10000,
      };

      this.pool = new Pool(poolConfig);
      
      // Test connection
      const client = await this.pool.connect();
      client.release();
      
      this.connected = true;
    } catch (error) {
      throw new ConnectionError(`Failed to connect to AWS RDS: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  private async generateIAMToken(): Promise<string> {
    const params = {
      hostname: this.config.host!,
      port: this.config.port || 5432,
      username: this.config.username!,
      region: this.config.region || 'us-east-1'
    };

    return new Promise((resolve, reject) => {
      const signer = new RDS.Signer();
      signer.getAuthToken(params, (err: any, token: any) => {
        if (err) {
          reject(new ConnectionError(`Failed to generate IAM token: ${err.message}`, err));
          return;
        }
        resolve(token);
      });
    });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.pool || !this.connected) {
      throw new ConnectionError('Database not connected');
    }

    try {
      const result = await this.pool.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      throw new ConnectionError(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (!this.pool || !this.connected) {
      throw new ConnectionError('Database not connected');
    }

    try {
      const result = await this.pool.query(sql, params);
      return { 
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows[0]?.id 
      };
    } catch (error) {
      throw new ConnectionError(`Execute failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  async close(): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.end();
      this.connected = false;
      this.pool = null;
    } catch (error) {
      throw new ConnectionError(`Failed to close pool: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  isConnected(): boolean {
    return this.connected && this.pool !== null;
  }

  async testConnection(): Promise<void> {
    if (!this.isConnected()) {
      throw new ConnectionError('Database not connected');
    }
    
    // Test with a simple query
    await this.query('SELECT 1');
  }
}export
 class ConnectionManager {
  private connection: DatabaseConnection | null = null;
  private config: DatabaseConfig;
  private retryCount = 0;

  constructor(config: DatabaseConfig) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      connectionTimeout: 5000,
      ...config
    };
  }

  async connect(): Promise<DatabaseConnection> {
    if (this.connection && this.connection.isConnected()) {
      return this.connection;
    }

    this.retryCount = 0;
    return this.connectWithRetry();
  }

  private async connectWithRetry(): Promise<DatabaseConnection> {
    try {
      this.connection = this.createConnection();
      await this.connection.connect();
      this.retryCount = 0;
      return this.connection;
    } catch (error) {
      this.retryCount++;
      
      if (this.retryCount <= (this.config.retryAttempts || 3)) {
        console.warn(`Connection attempt ${this.retryCount} failed, retrying in ${this.config.retryDelay}ms...`);
        await this.delay(this.config.retryDelay || 1000);
        return this.connectWithRetry();
      }
      
      throw new ConnectionError(`Failed to connect after ${this.retryCount} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  private createConnection(): DatabaseConnection {
    switch (this.config.type) {
      case 'sqlite':
        return new SQLiteConnection(this.config);
      case 'postgresql':
        return new PostgreSQLConnection(this.config);
      case 'aws-rds':
        return new AWSRDSConnection(this.config);
      default:
        throw new ConnectionError(`Unsupported database type: ${this.config.type}`);
    }
  }

  async getConnection(): Promise<DatabaseConnection> {
    if (!this.connection || !this.connection.isConnected()) {
      return this.connect();
    }
    return this.connection;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Environment-based configuration helper
export function createDatabaseConfig(): DatabaseConfig {
  const env = process.env;
  
  // Default to SQLite for development
  const dbType = (env.DB_TYPE as DatabaseConfig['type']) || 'sqlite';
  
  const baseConfig: DatabaseConfig = {
    type: dbType,
    retryAttempts: parseInt(env.DB_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(env.DB_RETRY_DELAY || '1000'),
    connectionTimeout: parseInt(env.DB_CONNECTION_TIMEOUT || '5000'),
    maxConnections: parseInt(env.DB_MAX_CONNECTIONS || '10'),
  };

  switch (dbType) {
    case 'sqlite':
      return {
        ...baseConfig,
        database: env.DB_PATH || './data/alpaca-herd.db',
      };
      
    case 'postgresql':
      return {
        ...baseConfig,
        host: env.DB_HOST || 'localhost',
        port: parseInt(env.DB_PORT || '5432'),
        database: env.DB_NAME || 'alpaca_herd',
        username: env.DB_USER || 'postgres',
        password: env.DB_PASSWORD,
        ssl: env.DB_SSL === 'true',
        connectionString: env.DATABASE_URL,
      };
      
    case 'aws-rds':
      return {
        ...baseConfig,
        host: env.RDS_HOST,
        port: parseInt(env.RDS_PORT || '5432'),
        database: env.RDS_DATABASE || 'alpaca_herd',
        username: env.RDS_USERNAME,
        password: env.RDS_PASSWORD,
        region: env.AWS_REGION || 'us-east-1',
        useIAM: env.RDS_USE_IAM === 'true',
        rdsInstanceIdentifier: env.RDS_INSTANCE_ID,
        ssl: true, // Always use SSL for RDS
      };
      
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

// Global connection manager instance
let globalConnectionManager: ConnectionManager | null = null;

export function getConnectionManager(config?: DatabaseConfig): ConnectionManager {
  if (!globalConnectionManager) {
    const dbConfig = config || createDatabaseConfig();
    globalConnectionManager = new ConnectionManager(dbConfig);
  }
  return globalConnectionManager;
}

export function resetConnectionManager(): void {
  if (globalConnectionManager) {
    globalConnectionManager.close().catch(console.error);
    globalConnectionManager = null;
  }
}