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
 * Simple console logger implementation
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
 * Global logger instance
 */
export const logger = new ConsoleLogger(
  (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO
);

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
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
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

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Error logging middleware
 * Logs errors with context information
 */
export function errorLoggingMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string;

  logger.error('Request error', {
    requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: sanitizeRequestBody(req.body)
  });

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