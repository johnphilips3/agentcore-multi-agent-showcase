/**
 * Lambda Connection Manager
 * 
 * Manages database connections optimized for AWS Lambda environment.
 * Handles connection reuse, health checks, and Lambda-specific optimizations.
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger, logDatabaseConnectionError } from '../api/logging';

// Global connection pool for reuse across Lambda invocations
let globalPool: Pool | null = null;
let isPoolInitialized = false;
let lastHealthCheck = 0;
let connectionAttempts = 0;
let lastConnectionError: Error | null = null;

/**
 * Lambda-specific database configuration
 */
interface LambdaDbConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  healthCheckIntervalMs: number;
  maxRetryAttempts: number;
  retryDelayMs: number;
}

/**
 * Get database configuration from environment variables
 */
function getDatabaseConfig(): LambdaDbConfig {
  const config: LambdaDbConfig = {
    host: process.env.RDS_HOST || 'localhost',
    port: parseInt(process.env.RDS_PORT || '5432', 10),
    database: process.env.RDS_DATABASE || 'alpaca_herd',
    username: process.env.RDS_USERNAME || 'postgres',
    password: process.env.RDS_PASSWORD || '',
    ssl: process.env.RDS_SSL !== 'false', // Default to true for RDS
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '2', 10), // Low for Lambda
    connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    healthCheckIntervalMs: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '60000', 10), // 1 minute
    maxRetryAttempts: parseInt(process.env.DB_MAX_RETRY_ATTEMPTS || '3', 10),
    retryDelayMs: parseInt(process.env.DB_RETRY_DELAY || '1000', 10)
  };

  // Validate required configuration
  if (!config.host || !config.username) {
    throw new Error('Missing required database configuration: RDS_HOST and RDS_USERNAME must be set');
  }

  return config;
}

/**
 * Initialize Lambda environment and database connections with retry logic
 */
export async function initializeLambdaEnvironment(requestId?: string): Promise<void> {
  if (isPoolInitialized && globalPool) {
    // Check if health check is needed
    const now = Date.now();
    const config = getDatabaseConfig();
    
    if (now - lastHealthCheck < config.healthCheckIntervalMs) {
      logger.debug('Reusing existing database connection pool', {
        requestId,
        reason: 'health_check_not_needed',
        lastHealthCheck: new Date(lastHealthCheck).toISOString(),
        poolStatus: getPoolStatus()
      });
      return;
    }

    // Test existing connection
    try {
      await testConnection();
      lastHealthCheck = now;
      logger.debug('Reusing existing database connection pool', {
        requestId,
        reason: 'health_check_passed',
        poolStatus: getPoolStatus()
      });
      return;
    } catch (error) {
      logger.warn('Existing connection pool failed health check, reinitializing', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        poolStatus: getPoolStatus()
      });
      await closeDatabasePool();
    }
  }

  logger.info('Initializing Lambda database connection pool', {
    requestId,
    isFirstInitialization: !isPoolInitialized
  });
  
  const config = getDatabaseConfig();
  connectionAttempts = 0;
  
  await initializePoolWithRetry(config, requestId);
}

/**
 * Initialize connection pool with retry logic and enhanced error handling
 */
async function initializePoolWithRetry(config: LambdaDbConfig, requestId?: string): Promise<void> {
  const maxAttempts = config.maxRetryAttempts;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      connectionAttempts = attempt;
      
      logger.info('Initializing database connection pool', {
        requestId,
        attempt,
        maxAttempts,
        config: {
          host: config.host,
          database: config.database,
          maxConnections: config.maxConnections,
          ssl: config.ssl,
          connectionTimeout: `${config.connectionTimeoutMs}ms`,
          idleTimeout: `${config.idleTimeoutMs}ms`
        }
      });
      
      // Create connection pool optimized for Lambda
      globalPool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? {
          rejectUnauthorized: false // For RDS SSL certificates
        } : false,
        max: config.maxConnections, // Keep low for Lambda
        min: 0, // No minimum connections
        idleTimeoutMillis: config.idleTimeoutMs,
        connectionTimeoutMillis: config.connectionTimeoutMs,
        // Lambda-specific optimizations
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        allowExitOnIdle: true // Allow pool to close when Lambda is idle
      });

      // Set up connection pool event handlers with structured logging
      globalPool.on('connect', (client: PoolClient) => {
        logger.debug('New database connection established', {
          requestId,
          poolStatus: getPoolStatus()
        });
      });

      globalPool.on('error', (error: Error) => {
        lastConnectionError = error;
        logger.error('Database pool error detected', {
          requestId,
          error: error.message,
          stack: error.stack,
          poolStatus: getPoolStatus()
        });
      });

      globalPool.on('remove', () => {
        logger.debug('Database connection removed from pool', {
          requestId,
          poolStatus: getPoolStatus()
        });
      });

      // Test the connection with timeout
      const connectionTestStart = Date.now();
      await testConnection();
      const connectionTestTime = Date.now() - connectionTestStart;
      
      isPoolInitialized = true;
      lastHealthCheck = Date.now();
      lastConnectionError = null;
      
      logger.info('Database connection pool initialized successfully', {
        requestId,
        attempt,
        maxAttempts,
        connectionTestTime: `${connectionTestTime}ms`,
        poolStatus: getPoolStatus()
      });
      
      return;
      
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      lastConnectionError = errorInstance;
      
      // Log connection error with context
      logDatabaseConnectionError(errorInstance, attempt, maxAttempts, 'pool_initialization', requestId);
      
      // Clean up failed pool
      if (globalPool) {
        try {
          await globalPool.end();
        } catch (cleanupError) {
          logger.warn('Error cleaning up failed connection pool', {
            requestId,
            cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          });
        }
        globalPool = null;
      }
      
      // Wait before retry (except on last attempt)
      if (attempt < maxAttempts) {
        const delay = config.retryDelayMs * attempt; // Exponential backoff
        logger.info('Retrying database connection pool initialization', {
          requestId,
          attempt,
          maxAttempts,
          retryDelay: `${delay}ms`,
          nextAttempt: attempt + 1
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  const finalError = new Error(`Failed to initialize database connection pool after ${maxAttempts} attempts. Last error: ${lastConnectionError?.message}`);
  logger.error('Database connection pool initialization failed permanently', {
    requestId,
    maxAttempts,
    lastError: lastConnectionError?.message,
    lastErrorStack: lastConnectionError?.stack
  });
  
  throw finalError;
}

/**
 * Get database connection from pool with automatic reconnection and enhanced error handling
 */
export async function getDatabaseConnection(requestId?: string): Promise<PoolClient> {
  if (!globalPool || !isPoolInitialized) {
    logger.info('Database pool not initialized, initializing now', { requestId });
    await initializeLambdaEnvironment(requestId);
  }

  if (!globalPool) {
    const error = new Error('Database pool not initialized. Call initializeLambdaEnvironment() first.');
    logger.error('Database pool unavailable', {
      requestId,
      error: error.message,
      isPoolInitialized,
      globalPoolExists: !!globalPool
    });
    throw error;
  }

  try {
    const connectionStart = Date.now();
    const client = await globalPool.connect();
    const connectionTime = Date.now() - connectionStart;
    
    logger.debug('Database connection acquired', {
      requestId,
      connectionTime: `${connectionTime}ms`,
      poolStatus: getPoolStatus()
    });
    
    return client;
  } catch (error) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Failed to get database connection', {
      requestId,
      error: errorInstance.message,
      stack: errorInstance.stack,
      poolStatus: getPoolStatus()
    });
    
    // Try to reinitialize the pool once
    logger.info('Attempting to reinitialize database pool after connection failure', { requestId });
    
    try {
      await closeDatabasePool();
      await initializeLambdaEnvironment(requestId);
      
      if (!globalPool) {
        throw new Error('Failed to reinitialize database pool - pool is null after initialization');
      }
      
      // Retry connection
      const retryStart = Date.now();
      const client = await globalPool.connect();
      const retryTime = Date.now() - retryStart;
      
      logger.info('Database connection acquired after pool reinitialization', {
        requestId,
        retryTime: `${retryTime}ms`,
        poolStatus: getPoolStatus()
      });
      
      return client;
    } catch (retryError) {
      const retryErrorInstance = retryError instanceof Error ? retryError : new Error(String(retryError));
      
      logger.error('Failed to get database connection after pool reinitialization', {
        requestId,
        originalError: errorInstance.message,
        retryError: retryErrorInstance.message,
        retryStack: retryErrorInstance.stack
      });
      
      throw retryErrorInstance;
    }
  }
}

/**
 * Test database connection health with timeout
 */
export async function testConnection(): Promise<void> {
  if (!globalPool) {
    throw new Error('Database pool not initialized');
  }

  const config = getDatabaseConfig();
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Health check timeout')), config.connectionTimeoutMs);
  });

  try {
    const healthCheckPromise = performHealthCheck();
    await Promise.race([healthCheckPromise, timeoutPromise]);
  } catch (error) {
    throw new Error(`Database health check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Perform the actual health check query
 */
async function performHealthCheck(): Promise<void> {
  if (!globalPool) {
    throw new Error('Database pool not initialized');
  }

  const client = await globalPool.connect();
  try {
    const startTime = Date.now();
    const result = await client.query('SELECT NOW() as current_time, version() as version, current_database() as database');
    const duration = Date.now() - startTime;
    
    console.log('🏥 Database health check passed:', {
      currentTime: result.rows[0].current_time,
      database: result.rows[0].database,
      version: result.rows[0].version.split(' ')[0], // Just PostgreSQL version
      duration: `${duration}ms`,
      poolStatus: getPoolStatus()
    });
  } finally {
    client.release();
  }
}

/**
 * Execute a database query with automatic connection management and enhanced retry logic
 */
export async function executeQuery<T = any>(
  query: string,
  params: any[] = [],
  requestId?: string
): Promise<T[]> {
  const config = getDatabaseConfig();
  let lastError: Error | null = null;
  const queryPreview = query.substring(0, 100) + (query.length > 100 ? '...' : '');
  
  for (let attempt = 1; attempt <= config.maxRetryAttempts; attempt++) {
    try {
      const client = await getDatabaseConnection(requestId);
      
      try {
        logger.debug('Executing database query', {
          requestId,
          query: queryPreview,
          paramCount: params.length,
          attempt: attempt > 1 ? attempt : undefined,
          maxAttempts: attempt > 1 ? config.maxRetryAttempts : undefined,
          poolStatus: getPoolStatus()
        });
        
        const startTime = Date.now();
        const result = await client.query(query, params);
        const executionTime = Date.now() - startTime;
        
        logger.debug('Database query executed successfully', {
          requestId,
          query: queryPreview,
          rowCount: result.rowCount,
          executionTime: `${executionTime}ms`,
          attempt: attempt > 1 ? attempt : undefined,
          poolStatus: getPoolStatus()
        });
        
        // Log slow queries
        if (executionTime > 1000) {
          logger.warn('Slow database query detected', {
            requestId,
            query: queryPreview,
            executionTime: `${executionTime}ms`,
            rowCount: result.rowCount,
            recommendation: 'Consider optimizing this query or adding indexes'
          });
        }
        
        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Log database connection error with enhanced context
      logDatabaseConnectionError(lastError, attempt, config.maxRetryAttempts, 'query_execution', requestId);
      
      logger.error('Database query execution failed', {
        requestId,
        query: queryPreview,
        paramCount: params.length,
        attempt,
        maxAttempts: config.maxRetryAttempts,
        error: lastError.message,
        stack: lastError.stack,
        errorType: classifyDatabaseError(lastError),
        poolStatus: getPoolStatus()
      });
      
      // Don't retry on certain types of errors (syntax errors, constraint violations, etc.)
      if (isNonRetryableError(lastError)) {
        logger.info('Non-retryable database error detected', {
          requestId,
          error: lastError.message,
          errorType: classifyDatabaseError(lastError),
          query: queryPreview
        });
        throw lastError;
      }
      
      // Wait before retry (except on last attempt)
      if (attempt < config.maxRetryAttempts) {
        const delay = config.retryDelayMs * attempt;
        logger.info('Retrying database query after error', {
          requestId,
          attempt,
          maxAttempts: config.maxRetryAttempts,
          retryDelay: `${delay}ms`,
          error: lastError.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  const finalError = new Error(`Query failed after ${config.maxRetryAttempts} attempts. Last error: ${lastError?.message}`);
  logger.error('Database query failed permanently after all retry attempts', {
    requestId,
    query: queryPreview,
    maxAttempts: config.maxRetryAttempts,
    lastError: lastError?.message,
    lastErrorType: lastError ? classifyDatabaseError(lastError) : 'unknown'
  });
  
  throw finalError;
}

/**
 * Classify database errors for better error handling and logging
 */
function classifyDatabaseError(error: Error): string {
  const message = error.message.toLowerCase();
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'TIMEOUT';
  } else if (message.includes('connection') && (message.includes('refused') || message.includes('failed'))) {
    return 'CONNECTION_REFUSED';
  } else if (message.includes('authentication') || message.includes('password')) {
    return 'AUTHENTICATION_FAILED';
  } else if (message.includes('database') && message.includes('does not exist')) {
    return 'DATABASE_NOT_FOUND';
  } else if (message.includes('ssl') || message.includes('certificate')) {
    return 'SSL_ERROR';
  } else if (message.includes('pool') || message.includes('connection limit')) {
    return 'POOL_EXHAUSTED';
  } else if (message.includes('syntax error') || message.includes('column does not exist')) {
    return 'SQL_ERROR';
  } else if (message.includes('constraint') || message.includes('duplicate key')) {
    return 'CONSTRAINT_VIOLATION';
  }
  
  return 'UNKNOWN';
}

/**
 * Check if an error should not be retried
 */
function isNonRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // SQL syntax errors, constraint violations, etc. should not be retried
  const nonRetryablePatterns = [
    'syntax error',
    'column does not exist',
    'relation does not exist',
    'duplicate key value',
    'violates foreign key constraint',
    'violates not-null constraint',
    'violates unique constraint',
    'violates check constraint',
    'invalid input syntax',
    'permission denied',
    'function does not exist',
    'operator does not exist',
    'type does not exist',
    'schema does not exist',
    'table does not exist',
    'index does not exist'
  ];
  
  return nonRetryablePatterns.some(pattern => message.includes(pattern));
}

/**
 * Close database pool (for cleanup)
 */
export async function closeDatabasePool(): Promise<void> {
  if (globalPool) {
    console.log('🔌 Closing database connection pool...');
    await globalPool.end();
    globalPool = null;
    isPoolInitialized = false;
    console.log('✅ Database connection pool closed');
  }
}

/**
 * Get connection pool status
 */
export function getPoolStatus(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} {
  if (!globalPool) {
    return { totalCount: 0, idleCount: 0, waitingCount: 0 };
  }

  return {
    totalCount: globalPool.totalCount,
    idleCount: globalPool.idleCount,
    waitingCount: globalPool.waitingCount
  };
}

/**
 * Execute a database transaction with automatic rollback on error and enhanced logging
 */
export async function executeTransaction<T>(
  transactionFn: (client: PoolClient) => Promise<T>,
  requestId?: string
): Promise<T> {
  const client = await getDatabaseConnection(requestId);
  const transactionStart = Date.now();
  
  try {
    await client.query('BEGIN');
    logger.debug('Database transaction started', {
      requestId,
      poolStatus: getPoolStatus()
    });
    
    const result = await transactionFn(client);
    
    await client.query('COMMIT');
    const transactionTime = Date.now() - transactionStart;
    
    logger.debug('Database transaction committed successfully', {
      requestId,
      transactionTime: `${transactionTime}ms`,
      poolStatus: getPoolStatus()
    });
    
    // Log slow transactions
    if (transactionTime > 2000) {
      logger.warn('Slow database transaction detected', {
        requestId,
        transactionTime: `${transactionTime}ms`,
        recommendation: 'Consider optimizing transaction operations'
      });
    }
    
    return result;
  } catch (error) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    const transactionTime = Date.now() - transactionStart;
    
    try {
      await client.query('ROLLBACK');
      logger.info('Database transaction rolled back due to error', {
        requestId,
        transactionTime: `${transactionTime}ms`,
        error: errorInstance.message,
        poolStatus: getPoolStatus()
      });
    } catch (rollbackError) {
      const rollbackErrorInstance = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
      logger.error('Failed to rollback database transaction', {
        requestId,
        transactionTime: `${transactionTime}ms`,
        originalError: errorInstance.message,
        rollbackError: rollbackErrorInstance.message,
        rollbackStack: rollbackErrorInstance.stack
      });
    }
    
    logger.error('Database transaction failed', {
      requestId,
      transactionTime: `${transactionTime}ms`,
      error: errorInstance.message,
      stack: errorInstance.stack,
      errorType: classifyDatabaseError(errorInstance)
    });
    
    throw errorInstance;
  } finally {
    client.release();
  }
}

/**
 * Get detailed connection and environment information
 */
export function getConnectionInfo(): {
  isInitialized: boolean;
  poolStatus: { totalCount: number; idleCount: number; waitingCount: number };
  lastHealthCheck: number;
  connectionAttempts: number;
  lastError: string | null;
  environment: {
    host: string;
    database: string;
    username: string;
    maxConnections: number;
    nodeEnv: string;
    awsRegion: string;
  };
} {
  const config = getDatabaseConfig();
  
  return {
    isInitialized: isPoolInitialized,
    poolStatus: getPoolStatus(),
    lastHealthCheck,
    connectionAttempts,
    lastError: lastConnectionError?.message || null,
    environment: {
      host: config.host,
      database: config.database,
      username: config.username,
      maxConnections: config.maxConnections,
      nodeEnv: process.env.NODE_ENV || 'unknown',
      awsRegion: process.env.AWS_REGION || 'unknown'
    }
  };
}

/**
 * Lambda-specific database utilities with enhanced error handling
 */
export const LambdaDbUtils = {
  initialize: (requestId?: string) => initializeLambdaEnvironment(requestId),
  getConnection: (requestId?: string) => getDatabaseConnection(requestId),
  testConnection,
  executeQuery: <T = any>(query: string, params: any[] = [], requestId?: string) => executeQuery<T>(query, params, requestId),
  executeTransaction: <T>(transactionFn: (client: PoolClient) => Promise<T>, requestId?: string) => executeTransaction(transactionFn, requestId),
  close: closeDatabasePool,
  getStatus: getPoolStatus,
  getInfo: getConnectionInfo
};