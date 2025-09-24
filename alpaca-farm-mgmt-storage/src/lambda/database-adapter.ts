/**
 * Database Adapter for Lambda Environment
 * 
 * Adapts the existing ConnectionManager interface to work with Lambda-optimized connections.
 * This allows existing repositories and services to work seamlessly in Lambda environment.
 */

import { DatabaseConnection, ConnectionError } from '../database/connection';
import { LambdaDbUtils, executeQuery, executeTransaction } from './connection-manager';
import { PoolClient } from 'pg';

/**
 * Lambda-optimized database connection that implements the existing DatabaseConnection interface
 */
export class LambdaDatabaseConnection implements DatabaseConnection {
  private initialized = false;

  constructor() {
    // Initialize on first use
  }

  /**
   * Ensure Lambda environment is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await LambdaDbUtils.initialize();
      this.initialized = true;
    }
  }

  /**
   * Execute a query and return results
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ensureInitialized();
    
    try {
      return await executeQuery<T>(sql, params);
    } catch (error) {
      throw new ConnectionError(
        `Lambda query failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute a statement and return execution info
   */
  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    await this.ensureInitialized();
    
    try {
      const result = await executeQuery(sql, params);
      
      // For INSERT statements, try to get the inserted ID from RETURNING clause
      let lastInsertRowid: number | undefined;
      if (sql.trim().toLowerCase().startsWith('insert') && result.length > 0 && result[0].id) {
        lastInsertRowid = result[0].id;
      }
      
      // For PostgreSQL, we need to extract rowCount from the query result
      // Since executeQuery doesn't return rowCount, we'll estimate based on result
      const changes = result.length;
      
      return { changes, lastInsertRowid };
    } catch (error) {
      throw new ConnectionError(
        `Lambda execute failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute a transaction
   */
  async executeTransaction<T>(transactionFn: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    
    try {
      return await executeTransaction(async (client: PoolClient) => {
        // Create a transaction-scoped connection wrapper
        const transactionConnection = new LambdaTransactionConnection(client);
        return await transactionFn(transactionConnection);
      });
    } catch (error) {
      throw new ConnectionError(
        `Lambda transaction failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Close connection (no-op for Lambda as connections are managed globally)
   */
  async close(): Promise<void> {
    // In Lambda environment, we don't close individual connections
    // The global pool manages connection lifecycle
    console.log('🔌 Lambda connection close requested (no-op)');
  }

  /**
   * Connect to the database (initialize Lambda environment)
   */
  async connect(): Promise<void> {
    await this.ensureInitialized();
  }

  /**
   * Check if connection is available
   */
  isConnected(): boolean {
    const status = LambdaDbUtils.getStatus();
    return status.totalCount > 0 || status.idleCount > 0;
  }

  /**
   * Test connection health
   */
  async testConnection(): Promise<void> {
    await this.ensureInitialized();
    await LambdaDbUtils.testConnection();
  }
}

/**
 * Transaction-scoped connection that uses a specific client
 */
class LambdaTransactionConnection implements DatabaseConnection {
  constructor(private client: PoolClient) {}

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      console.log('🔍 Executing transaction query:', { 
        query: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''), 
        paramCount: params.length 
      });
      
      const startTime = Date.now();
      const result = await this.client.query(sql, params);
      const executionTime = Date.now() - startTime;
      
      console.log('✅ Transaction query executed:', { 
        rowCount: result.rowCount, 
        executionTime: `${executionTime}ms` 
      });
      
      return result.rows;
    } catch (error) {
      console.error('❌ Transaction query failed:', {
        error: error instanceof Error ? error.message : String(error),
        query: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        paramCount: params.length
      });
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    const result = await this.query(sql, params);
    
    let lastInsertRowid: number | undefined;
    if (sql.trim().toLowerCase().startsWith('insert') && result.length > 0 && result[0].id) {
      lastInsertRowid = result[0].id;
    }
    
    return { changes: result.length, lastInsertRowid };
  }

  async close(): Promise<void> {
    // Don't close the client in a transaction - it's managed by the transaction executor
  }

  async connect(): Promise<void> {
    // Already connected within transaction context
  }

  isConnected(): boolean {
    return true; // Assume connected within transaction
  }

  async testConnection(): Promise<void> {
    // Test with a simple query
    await this.query('SELECT 1');
  }
}

/**
 * Lambda-optimized Connection Manager that provides the existing interface
 */
export class LambdaConnectionManager {
  private connection: LambdaDatabaseConnection | null = null;

  /**
   * Get or create a Lambda-optimized database connection
   */
  async getConnection(): Promise<DatabaseConnection> {
    if (!this.connection) {
      this.connection = new LambdaDatabaseConnection();
    }
    return this.connection;
  }

  /**
   * Connect (initialize Lambda environment)
   */
  async connect(): Promise<DatabaseConnection> {
    return this.getConnection();
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    await LambdaDbUtils.close();
  }

  /**
   * Test connection health
   */
  async testConnection(): Promise<void> {
    const connection = await this.getConnection();
    await connection.testConnection();
  }

  /**
   * Get connection status information
   */
  getStatus() {
    return LambdaDbUtils.getInfo();
  }
}

// Global Lambda connection manager instance
let globalLambdaConnectionManager: LambdaConnectionManager | null = null;

/**
 * Get the global Lambda connection manager
 */
export function getLambdaConnectionManager(): LambdaConnectionManager {
  if (!globalLambdaConnectionManager) {
    globalLambdaConnectionManager = new LambdaConnectionManager();
  }
  return globalLambdaConnectionManager;
}

/**
 * Reset the global Lambda connection manager
 */
export async function resetLambdaConnectionManager(): Promise<void> {
  if (globalLambdaConnectionManager) {
    await globalLambdaConnectionManager.close();
    globalLambdaConnectionManager = null;
  }
}

/**
 * Create a Lambda-compatible database configuration
 * This function adapts environment variables to work with Lambda
 */
export function createLambdaDatabaseConfig() {
  // Ensure Lambda-specific environment variables are set
  const requiredVars = ['RDS_HOST', 'RDS_USERNAME'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required Lambda database environment variables: ${missing.join(', ')}`);
  }

  return {
    type: 'aws-rds' as const,
    host: process.env.RDS_HOST!,
    port: parseInt(process.env.RDS_PORT || '5432', 10),
    database: process.env.RDS_DATABASE || 'alpaca_herd',
    username: process.env.RDS_USERNAME!,
    password: process.env.RDS_PASSWORD || '',
    region: process.env.AWS_REGION || 'us-east-1',
    ssl: process.env.RDS_SSL !== 'false',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '2', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
    retryAttempts: parseInt(process.env.DB_MAX_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000', 10)
  };
}