/**
 * AWS Lambda Handler for Alpaca Farm Management API
 * 
 * This handler wraps the existing Express application to work with AWS Lambda and API Gateway.
 * It uses serverless-http to convert Express requests/responses to Lambda-compatible format.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Application } from 'express';
import { createFullApp } from '../api/full-server';
import { createLambdaAdapter } from './app-adapter';
import { LambdaDbUtils } from './connection-manager';
import { setupLambdaEnvironment, logEnvironmentInfo } from './environment-setup';
import { 
  logger, 
  logLambdaColdStart, 
  logLambdaTimeoutWarning, 
  logApiGatewayError,
  logLambdaPerformanceMetrics 
} from '../api/logging';

// Global variables for connection reuse across Lambda invocations
let app: Application | null = null;
let lambdaHandler: any = null;
let isInitialized = false;
let initializationError: Error | null = null;

/**
 * Initialize the Lambda environment and Express app with comprehensive error handling
 */
async function initialize(requestId?: string): Promise<void> {
  if (isInitialized && !initializationError) {
    return;
  }

  const startTime = Date.now();
  
  try {
    logger.info('Lambda environment initialization started', {
      requestId,
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
      runtime: process.env.AWS_EXECUTION_ENV
    });
    
    // Log environment information
    logEnvironmentInfo();
    
    // Setup Lambda-specific environment (database connections, etc.)
    logger.info('Setting up Lambda environment', { requestId });
    await setupLambdaEnvironment();
    
    // Initialize Lambda database utilities with retry logic
    logger.info('Initializing Lambda database utilities', { requestId });
    await LambdaDbUtils.initialize(requestId);
    
    // Test database connection with timeout handling
    logger.info('Testing database connection', { requestId });
    const connectionTestStart = Date.now();
    await Promise.race([
      LambdaDbUtils.testConnection(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection test timeout')), 10000)
      )
    ]);
    const connectionTestTime = Date.now() - connectionTestStart;
    
    // Log connection pool status and info
    const connectionInfo = LambdaDbUtils.getInfo();
    logger.info('Database connection established', {
      requestId,
      connectionTestTime: `${connectionTestTime}ms`,
      isInitialized: connectionInfo.isInitialized,
      poolStatus: connectionInfo.poolStatus,
      environment: connectionInfo.environment,
      lastHealthCheck: connectionInfo.lastHealthCheck > 0 ? new Date(connectionInfo.lastHealthCheck).toISOString() : 'never',
      connectionAttempts: connectionInfo.connectionAttempts
    });
    
    // Create Express app with Lambda-optimized configuration
    logger.info('Creating Express application', { requestId });
    app = createFullApp({
      trustProxy: true, // API Gateway acts as proxy
      logLevel: 'combined'
    });
    
    // Create Lambda adapter using serverless-http
    logger.info('Creating Lambda adapter', { requestId });
    lambdaHandler = createLambdaAdapter(app);
    
    const initTime = Date.now() - startTime;
    isInitialized = true;
    initializationError = null;
    
    logger.info('Lambda environment initialized successfully', {
      requestId,
      initializationTime: `${initTime}ms`,
      components: ['environment', 'database', 'express', 'adapter']
    });
    
    // Log cold start metrics
    if (requestId) {
      logLambdaColdStart(requestId, initTime);
    }
    
  } catch (error) {
    const initTime = Date.now() - startTime;
    initializationError = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Lambda environment initialization failed', {
      requestId,
      initializationTime: `${initTime}ms`,
      error: initializationError.message,
      stack: initializationError.stack,
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
    });
    
    throw initializationError;
  }
}

/**
 * Main Lambda handler function with comprehensive error handling
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Configure Lambda context for optimal performance
  context.callbackWaitsForEmptyEventLoop = false; // Don't wait for empty event loop
  
  const requestStartTime = Date.now();
  const isColdStart = !isInitialized;
  const requestId = context.awsRequestId;
  
  try {
    // Log structured request information for CloudWatch
    logger.info('Incoming API Gateway request', {
      requestId,
      coldStart: isColdStart,
      method: event.httpMethod,
      path: event.path,
      queryStringParameters: event.queryStringParameters,
      userAgent: event.headers?.['User-Agent'] || event.headers?.['user-agent'],
      sourceIp: event.requestContext?.identity?.sourceIp,
      stage: event.requestContext?.stage,
      apiGatewayRequestId: event.requestContext?.requestId,
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      remainingTime: `${context.getRemainingTimeInMillis()}ms`
    });

    // Check for potential timeout early in the request
    const remainingTime = context.getRemainingTimeInMillis();
    if (remainingTime < 5000) { // Less than 5 seconds remaining
      logLambdaTimeoutWarning(requestId, remainingTime, 'request_start');
    }

    // Initialize if needed (cold start)
    if (!isInitialized || initializationError) {
      const initStartTime = Date.now();
      
      // Check if we have enough time for initialization
      if (context.getRemainingTimeInMillis() < 15000) { // Less than 15 seconds
        throw new Error('Insufficient time remaining for Lambda initialization');
      }
      
      await initialize(requestId);
      const initTime = Date.now() - initStartTime;
      
      logger.info('Cold start initialization completed', {
        requestId,
        initializationTime: `${initTime}ms`,
        remainingTime: `${context.getRemainingTimeInMillis()}ms`
      });
    }

    // Ensure handler is available
    if (!lambdaHandler) {
      throw new Error('Lambda handler not initialized - critical initialization failure');
    }

    // Check timeout before processing
    const preProcessingTime = context.getRemainingTimeInMillis();
    if (preProcessingTime < 3000) { // Less than 3 seconds remaining
      logLambdaTimeoutWarning(requestId, preProcessingTime, 'pre_processing');
    }

    // Process request through Express app via serverless-http
    const processingStartTime = Date.now();
    
    // Add timeout wrapper for request processing
    const processingPromise = lambdaHandler(event, context);
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutMs = Math.max(context.getRemainingTimeInMillis() - 1000, 1000); // Leave 1s buffer
      setTimeout(() => {
        reject(new Error(`Request processing timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    const result = await Promise.race([processingPromise, timeoutPromise]);
    const processingTime = Date.now() - processingStartTime;
    const totalTime = Date.now() - requestStartTime;

    // Log structured response information
    logger.info('Request processed successfully', {
      requestId,
      statusCode: result.statusCode,
      processingTime: `${processingTime}ms`,
      totalTime: `${totalTime}ms`,
      coldStart: isColdStart,
      responseSize: result.body ? result.body.length : 0,
      remainingTime: `${context.getRemainingTimeInMillis()}ms`,
      memoryUsed: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    });

    // Log performance metrics
    logLambdaPerformanceMetrics(
      requestId, 
      totalTime, 
      process.memoryUsage().heapUsed / 1024 / 1024, 
      isColdStart
    );

    return result;
    
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    
    // Log API Gateway integration error
    logApiGatewayError(errorInstance, event, requestId, getErrorStatusCode(errorInstance));
    
    // Log additional error context
    logger.error('Lambda handler execution failed', {
      requestId,
      error: errorInstance.message,
      stack: errorInstance.stack,
      totalTime: `${totalTime}ms`,
      coldStart: isColdStart,
      remainingTime: `${context.getRemainingTimeInMillis()}ms`,
      memoryUsed: process.memoryUsage().heapUsed / 1024 / 1024,
      event: {
        method: event.httpMethod,
        path: event.path,
        stage: event.requestContext?.stage,
        sourceIp: event.requestContext?.identity?.sourceIp
      },
      context: {
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        memoryLimitInMB: context.memoryLimitInMB,
        logGroupName: context.logGroupName,
        logStreamName: context.logStreamName
      }
    });

    // Return standardized error response
    return createErrorResponse(errorInstance.message, requestId, errorInstance, event);
  }
};

/**
 * Get appropriate HTTP status code for error
 */
function getErrorStatusCode(error: Error): number {
  const message = error.message.toLowerCase();
  
  if (message.includes('not found')) return 404;
  if (message.includes('validation') || message.includes('required')) return 400;
  if (message.includes('unauthorized')) return 401;
  if (message.includes('forbidden')) return 403;
  if (message.includes('timeout')) return 504;
  if (message.includes('too many requests')) return 429;
  if (message.includes('conflict') || message.includes('duplicate')) return 409;
  if (message.includes('unprocessable')) return 422;
  
  return 500;
}

/**
 * Create standardized error response for API Gateway with enhanced error handling
 */
function createErrorResponse(
  errorMessage: string, 
  requestId: string, 
  originalError?: Error,
  event?: APIGatewayProxyEvent
): APIGatewayProxyResult {
  // Determine appropriate status code and error code
  const statusCode = originalError ? getErrorStatusCode(originalError) : 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  
  // Map status codes to error codes
  switch (statusCode) {
    case 400:
      errorCode = 'BAD_REQUEST';
      break;
    case 401:
      errorCode = 'UNAUTHORIZED';
      break;
    case 403:
      errorCode = 'FORBIDDEN';
      break;
    case 404:
      errorCode = 'NOT_FOUND';
      break;
    case 409:
      errorCode = 'CONFLICT';
      break;
    case 422:
      errorCode = 'VALIDATION_ERROR';
      break;
    case 429:
      errorCode = 'TOO_MANY_REQUESTS';
      break;
    case 504:
      errorCode = 'GATEWAY_TIMEOUT';
      break;
    default:
      errorCode = 'INTERNAL_SERVER_ERROR';
  }

  // Determine user-friendly error message
  let userMessage = errorMessage;
  if (statusCode === 500) {
    // Don't expose internal error details to users
    userMessage = 'An internal server error occurred. Please try again later.';
  } else if (statusCode === 504) {
    userMessage = 'The request timed out. Please try again with a simpler request.';
  }

  // Create error response body
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: userMessage,
      requestId: requestId,
      timestamp: new Date().toISOString()
    }
  };

  // Add debug information in development
  if (process.env.NODE_ENV === 'development' && originalError) {
    Object.assign(errorResponse.error, {
      debug: {
        originalMessage: errorMessage,
        stack: originalError.stack,
        type: originalError.constructor.name
      }
    });
  }

  // Add request context for debugging
  if (event && (process.env.NODE_ENV === 'development' || statusCode >= 500)) {
    Object.assign(errorResponse.error, {
      context: {
        method: event.httpMethod,
        path: event.path,
        stage: event.requestContext?.stage,
        sourceIp: event.requestContext?.identity?.sourceIp,
        userAgent: event.headers?.['User-Agent'] || event.headers?.['user-agent']
      }
    });
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'X-Request-ID': requestId,
      'X-Error-Code': errorCode,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify(errorResponse, null, process.env.NODE_ENV === 'development' ? 2 : 0)
  };
}