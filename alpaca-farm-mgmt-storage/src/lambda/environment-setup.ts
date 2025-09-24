/**
 * Lambda Environment Setup
 * 
 * Configures the application to use Lambda-optimized database connections
 * when running in AWS Lambda environment.
 */

import { getLambdaConnectionManager, createLambdaDatabaseConfig } from './database-adapter';
import { getConnectionManager, resetConnectionManager } from '../database/connection';

/**
 * Check if we're running in AWS Lambda environment
 */
export function isLambdaEnvironment(): boolean {
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT
  );
}

/**
 * Setup Lambda environment for database connections
 * This should be called during Lambda initialization
 */
export async function setupLambdaEnvironment(): Promise<void> {
  if (!isLambdaEnvironment()) {
    console.log('📍 Not in Lambda environment, skipping Lambda setup');
    return;
  }

  console.log('🔧 Setting up Lambda environment...');
  
  try {
    // Validate Lambda database configuration
    const config = createLambdaDatabaseConfig();
    console.log('✅ Lambda database configuration validated:', {
      host: config.host,
      database: config.database,
      username: config.username,
      maxConnections: config.maxConnections,
      region: config.region
    });

    // Reset any existing connection manager
    resetConnectionManager();
    
    // Initialize Lambda connection manager
    const lambdaManager = getLambdaConnectionManager();
    await lambdaManager.testConnection();
    
    console.log('✅ Lambda environment setup completed');
  } catch (error) {
    console.error('❌ Failed to setup Lambda environment:', error);
    throw error;
  }
}

/**
 * Get the appropriate connection manager for the current environment
 */
export function getEnvironmentConnectionManager() {
  if (isLambdaEnvironment()) {
    return getLambdaConnectionManager();
  } else {
    return getConnectionManager();
  }
}

/**
 * Environment-aware database connection helper
 * This function returns a connection that works in both Lambda and regular environments
 */
export async function getEnvironmentConnection() {
  const manager = getEnvironmentConnectionManager();
  return await manager.getConnection();
}

/**
 * Log environment information for debugging
 */
export function logEnvironmentInfo(): void {
  const isLambda = isLambdaEnvironment();
  
  console.log('🌍 Environment Information:', {
    isLambda,
    nodeEnv: process.env.NODE_ENV,
    awsRegion: process.env.AWS_REGION,
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
    memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
    timeout: process.env.AWS_LAMBDA_FUNCTION_TIMEOUT,
    rdsHost: process.env.RDS_HOST ? '***configured***' : 'not set',
    rdsDatabase: process.env.RDS_DATABASE || 'not set',
    rdsUsername: process.env.RDS_USERNAME ? '***configured***' : 'not set'
  });
}

/**
 * Cleanup environment resources
 */
export async function cleanupEnvironment(): Promise<void> {
  if (isLambdaEnvironment()) {
    const lambdaManager = getLambdaConnectionManager();
    await lambdaManager.close();
  } else {
    resetConnectionManager();
  }
}