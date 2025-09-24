/**
 * API Logging Utilities
 * Request/response logging and monitoring for the Alpaca Herd Management API
 */

import { Request, Response, NextFunction } from 'express';
import { ValidatedRequest } from './middleware.js';

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * Logger interface
 */
export interface Logger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * CloudWatch-optimized structured logger implementation
 */
export class CloudWatchLogger implements Logger {
  private logLevel: LogLevel;
  private isLambdaEnvironment: boolean;

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
    this.isLambdaEnvironment = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private createLogEntry(level: LogLevel, message: string, meta?: any): any {
    const baseEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      service: 'alpaca-farm-mgmt-api',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    // Add Lambda-specific context if running in Lambda
    if (this.isLambdaEnvironment) {
      Object.assign(baseEntry, {
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
        requestId: process.env._X_AMZN_TRACE_ID,
        region: process.env.AWS_REGION,
        memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
        runtime: process.env.AWS_EXECUTION_ENV
      });
    }

    // Add metadata if provided
    if (meta) {
      Object.assign(baseEntry, { metadata: meta });
    }

    return baseEntry;
  }

  private outputLog(level: LogLevel, logEntry: any): void {
    const jsonString = JSON.stringify(logEntry);
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(jsonString);
        break;
      case LogLevel.WARN:
        console.warn(jsonString);
        break;
      case LogLevel.INFO:
        console.log(jsonString);
        break;
      case LogLevel.DEBUG:
        console.log(jsonString);
        break;
    }
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const logEntry = this.createLogEntry(LogLevel.ERROR, message, meta);
      this.outputLog(LogLevel.ERROR, logEntry);
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const logEntry = this.createLogEntry(LogLevel.WARN, message, meta);
      this.outputLog(LogLevel.WARN, logEntry);
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const logEntry = this.createLogEntry(LogLevel.INFO, message, meta);
      this.outputLog(LogLevel.INFO, logEntry);
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const logEntry = this.createLogEntry(LogLevel.DEBUG, message, meta);
      this.outputLog(LogLevel.DEBUG, logEntry);
    }
  }
}

/**
 * Simple console logger implementation (fallback for non-Lambda environments)
 */
export class ConsoleLogger implements Logger {
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, meta));
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, meta));
    }
  }
}

/**
 * Global logger instance - uses CloudWatch logger in Lambda environment
 */
export const logger = process.env.AWS_LAMBDA_FUNCTION_NAME 
  ? new CloudWatchLogger((process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO)
  : new ConsoleLogger((process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO);

/**
 * Request logging middleware
 * Logs incoming requests and outgoing responses
 */
export function requestLoggingMiddleware(
  req: ValidatedRequest,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    contentType: req.get('Content-Type')
  });

  // Log request body for non-GET requests (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = sanitizeRequestBody(req.body);
    logger.debug('Request body', {
      requestId,
      body: sanitizedBody
    });
  }

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('Outgoing response', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    });

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`
      });
    }

    // Call original end method with proper return
    return originalEnd(chunk, encoding, cb);
  } as any;

  next();
}

/**
 * Error logging middleware with enhanced Lambda context
 * Logs errors with context information
 */
export function errorLoggingMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string;
  const isLambdaEnvironment = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  const errorContext = {
    requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: sanitizeRequestBody(req.body),
    errorType: error.constructor.name
  };

  // Add Lambda-specific context if running in Lambda
  if (isLambdaEnvironment) {
    Object.assign(errorContext, {
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
      remainingTime: req.headers['x-lambda-remaining-time'] as string,
      coldStart: req.headers['x-lambda-cold-start'] === 'true'
    });
  }

  logger.error('Request processing error', errorContext);

  // Log additional context for specific error types
  if (error.message.includes('timeout')) {
    logger.warn('Request timeout detected', {
      requestId,
      url: req.url,
      method: req.method,
      recommendation: 'Consider optimizing request processing or increasing timeout'
    });
  } else if (error.message.includes('database') || error.message.includes('connection')) {
    logger.error('Database-related error in request processing', {
      requestId,
      url: req.url,
      method: req.method,
      error: error.message,
      recommendation: 'Check database connectivity and query performance'
    });
  }

  next(error);
}

/**
 * Database operation logging
 */
export function logDatabaseOperation(
  operation: string,
  table: string,
  duration: number,
  recordCount?: number,
  error?: Error
): void {
  const meta = {
    operation,
    table,
    duration: `${duration}ms`,
    recordCount
  };

  if (error) {
    logger.error(`Database operation failed: ${operation} on ${table}`, {
      ...meta,
      error: error.message
    });
  } else {
    logger.debug(`Database operation completed: ${operation} on ${table}`, meta);
    
    // Log slow database operations
    if (duration > 500) {
      logger.warn(`Slow database operation: ${operation} on ${table}`, meta);
    }
  }
}

/**
 * API endpoint performance logging
 */
export function logEndpointPerformance(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number,
  requestId?: string
): void {
  const meta = {
    endpoint,
    method,
    duration: `${duration}ms`,
    statusCode,
    requestId
  };

  if (statusCode >= 400) {
    logger.warn(`API endpoint error: ${method} ${endpoint}`, meta);
  } else {
    logger.info(`API endpoint completed: ${method} ${endpoint}`, meta);
  }

  // Log slow endpoints
  if (duration > 2000) {
    logger.warn(`Slow API endpoint: ${method} ${endpoint}`, meta);
  }
}

/**
 * Business logic operation logging
 */
export function logBusinessOperation(
  operation: string,
  entityType: string,
  entityId?: string,
  success: boolean = true,
  error?: Error,
  metadata?: any
): void {
  const meta = {
    operation,
    entityType,
    entityId,
    success,
    ...metadata
  };

  if (error) {
    logger.error(`Business operation failed: ${operation} on ${entityType}`, {
      ...meta,
      error: error.message
    });
  } else if (success) {
    logger.info(`Business operation completed: ${operation} on ${entityType}`, meta);
  } else {
    logger.warn(`Business operation completed with warnings: ${operation} on ${entityType}`, meta);
  }
}

/**
 * Validation error logging
 */
export function logValidationError(
  field: string,
  value: any,
  constraint: string,
  requestId?: string
): void {
  logger.warn('Validation error', {
    field,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    constraint,
    requestId
  });
}

/**
 * Authentication/Authorization logging
 */
export function logAuthEvent(
  event: 'login' | 'logout' | 'access_denied' | 'token_expired',
  userId?: string,
  ip?: string,
  userAgent?: string,
  details?: any
): void {
  const meta = {
    event,
    userId,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (event === 'access_denied' || event === 'token_expired') {
    logger.warn(`Authentication event: ${event}`, meta);
  } else {
    logger.info(`Authentication event: ${event}`, meta);
  }
}

/**
 * System health logging
 */
export function logSystemHealth(
  component: string,
  status: 'healthy' | 'degraded' | 'unhealthy',
  details?: any
): void {
  const meta = {
    component,
    status,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (status === 'unhealthy') {
    logger.error(`System health check failed: ${component}`, meta);
  } else if (status === 'degraded') {
    logger.warn(`System health degraded: ${component}`, meta);
  } else {
    logger.debug(`System health check passed: ${component}`, meta);
  }
}

/**
 * Sanitize request body for logging
 * Removes sensitive information from request body
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'auth',
    'credential',
    'ssn',
    'social_security_number'
  ];

  const sanitized = { ...body };

  function sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitizeObject(value);
        }
      }
      return result;
    }

    return obj;
  }

  return sanitizeObject(sanitized);
}

/**
 * Create request context for logging
 */
export function createRequestContext(req: Request): any {
  return {
    requestId: req.headers['x-request-id'],
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };
}

/**
 * Lambda-specific error logging
 */
export function logLambdaColdStart(
  requestId: string,
  initializationTime: number,
  memoryUsed?: number
): void {
  logger.info('Lambda cold start detected', {
    requestId,
    initializationTime: `${initializationTime}ms`,
    memoryUsed: memoryUsed ? `${memoryUsed}MB` : undefined,
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
    coldStartOptimization: {
      connectionPoolReuse: true,
      expressAppReuse: true
    }
  });
}

/**
 * Lambda timeout warning logging
 */
export function logLambdaTimeoutWarning(
  requestId: string,
  remainingTime: number,
  operation: string
): void {
  logger.warn('Lambda timeout warning', {
    requestId,
    remainingTime: `${remainingTime}ms`,
    operation,
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    recommendation: remainingTime < 5000 ? 'Consider increasing timeout or optimizing operation' : 'Monitor for potential timeout'
  });
}

/**
 * Database connection error logging with retry context
 */
export function logDatabaseConnectionError(
  error: Error,
  attempt: number,
  maxAttempts: number,
  operation: string,
  requestId?: string
): void {
  const isRetryable = attempt < maxAttempts;
  const logLevel = isRetryable ? LogLevel.WARN : LogLevel.ERROR;
  
  const logMessage = isRetryable 
    ? `Database connection failed, retrying (${attempt}/${maxAttempts})`
    : `Database connection failed after all retry attempts (${attempt}/${maxAttempts})`;

  const logEntry = {
    requestId,
    operation,
    error: error.message,
    stack: error.stack,
    attempt,
    maxAttempts,
    isRetryable,
    errorType: classifyDatabaseError(error),
    connectionPool: {
      host: process.env.RDS_HOST,
      database: process.env.RDS_DATABASE,
      ssl: process.env.RDS_SSL !== 'false'
    }
  };

  if (logLevel === LogLevel.ERROR) {
    logger.error(logMessage, logEntry);
  } else {
    logger.warn(logMessage, logEntry);
  }
}

/**
 * API Gateway integration error logging
 */
export function logApiGatewayError(
  error: Error,
  event: any,
  requestId: string,
  statusCode: number
): void {
  logger.error('API Gateway integration error', {
    requestId,
    error: error.message,
    stack: error.stack,
    statusCode,
    httpMethod: event.httpMethod,
    path: event.path,
    stage: event.requestContext?.stage,
    sourceIp: event.requestContext?.identity?.sourceIp,
    userAgent: event.headers?.['User-Agent'] || event.headers?.['user-agent'],
    apiGatewayRequestId: event.requestContext?.requestId,
    integration: {
      type: 'lambda-proxy',
      timeout: process.env.AWS_LAMBDA_FUNCTION_TIMEOUT || '30s'
    }
  });
}

/**
 * Lambda memory and performance monitoring
 */
export function logLambdaPerformanceMetrics(
  requestId: string,
  executionTime: number,
  memoryUsed?: number,
  coldStart: boolean = false
): void {
  const memoryLimit = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;
  const memoryUtilization = memoryUsed && memoryLimit 
    ? Math.round((memoryUsed / parseInt(memoryLimit)) * 100)
    : undefined;

  logger.info('Lambda performance metrics', {
    requestId,
    executionTime: `${executionTime}ms`,
    memoryUsed: memoryUsed ? `${memoryUsed}MB` : undefined,
    memoryLimit: memoryLimit ? `${memoryLimit}MB` : undefined,
    memoryUtilization: memoryUtilization ? `${memoryUtilization}%` : undefined,
    coldStart,
    performance: {
      isSlowRequest: executionTime > 5000,
      isHighMemoryUsage: memoryUtilization && memoryUtilization > 80,
      recommendations: getPerformanceRecommendations(executionTime, memoryUtilization)
    }
  });
}

/**
 * Classify database errors for better error handling
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
 * Get performance recommendations based on metrics
 */
function getPerformanceRecommendations(
  executionTime: number, 
  memoryUtilization?: number
): string[] {
  const recommendations: string[] = [];
  
  if (executionTime > 10000) {
    recommendations.push('Consider optimizing database queries or increasing Lambda memory');
  } else if (executionTime > 5000) {
    recommendations.push('Monitor for potential performance bottlenecks');
  }
  
  if (memoryUtilization && memoryUtilization > 90) {
    recommendations.push('Consider increasing Lambda memory allocation');
  } else if (memoryUtilization && memoryUtilization > 80) {
    recommendations.push('Monitor memory usage for potential optimization');
  }
  
  if (memoryUtilization && memoryUtilization < 30) {
    recommendations.push('Consider reducing Lambda memory allocation for cost optimization');
  }
  
  return recommendations;
}

/**
 * Performance monitoring decorator
 */
export function withPerformanceLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operationName: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      logger.debug(`Operation completed: ${operationName}`, { duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Operation failed: ${operationName}`, {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }) as T;
}