/**
 * API Middleware
 * Request validation and processing middleware for the Alpaca Herd Management API
 */

import { Request, Response, NextFunction } from 'express';
import { ApiErrorClass, formatErrorResponse, isApiError } from './errors.js';
import { validatePaginationQuery } from './validation.js';
import { PaginationQuery } from './types.js';

/**
 * Extended Request interface with validated query parameters
 */
export interface ValidatedRequest<TBody = any, TQuery = any> extends Request {
  validatedBody?: TBody;
  validatedQuery?: TQuery;
  pagination?: {
    page: number;
    limit: number;
    offset: number;
  };
}

/**
 * Request validation middleware
 * Adds request ID and basic validation
 */
export function requestValidationMiddleware(
  req: ValidatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Add request ID for tracking
    req.headers['x-request-id'] = req.headers['x-request-id'] || generateRequestId();

    // Validate content type for POST/PUT requests
    if (['POST', 'PUT'].includes(req.method) && req.headers['content-type']) {
      const contentType = req.headers['content-type'].toLowerCase();
      if (!contentType.includes('application/json')) {
        throw ApiErrorClass.validation('Content-Type must be application/json');
      }
    }

    // Validate request body size
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) { // 10MB limit
      throw ApiErrorClass.validation('Request body too large (max 10MB)');
    }

    next();
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.statusCode).json(formatErrorResponse(error));
    } else {
      next(error);
    }
  }
}

/**
 * Pagination middleware
 * Validates and processes pagination query parameters
 */
export function paginationMiddleware(
  req: ValidatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const query = req.query as any;
    
    // Extract pagination parameters
    const paginationQuery: PaginationQuery = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder || 'asc'
    };

    // Validate pagination parameters
    validatePaginationQuery(paginationQuery);

    // Ensure page and limit have default values after validation
    const page = paginationQuery.page ?? 1;
    const limit = paginationQuery.limit ?? 20;

    // Calculate offset
    const offset = (page - 1) * limit;

    // Add to request object
    req.pagination = {
      page,
      limit,
      offset
    };

    // Add validated query
    req.validatedQuery = {
      ...query,
      ...paginationQuery
    };

    next();
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.statusCode).json(formatErrorResponse(error));
    } else {
      next(error);
    }
  }
}

/**
 * Request body validation middleware factory
 * Creates middleware that validates request body using provided validation function
 */
export function validateRequestBody<T>(
  validationFn: (body: any) => void
) {
  return (req: ValidatedRequest<T>, res: Response, next: NextFunction): void => {
    try {
      if (!req.body) {
        throw ApiErrorClass.validation('Request body is required');
      }

      // Validate the request body
      validationFn(req.body);

      // Store validated body
      req.validatedBody = req.body;

      next();
    } catch (error) {
      if (isApiError(error)) {
        res.status(error.statusCode).json(formatErrorResponse(error));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Request query validation middleware factory
 * Creates middleware that validates query parameters using provided validation function
 */
export function validateRequestQuery<T>(
  validationFn: (query: any) => void
) {
  return (req: ValidatedRequest<any, T>, res: Response, next: NextFunction): void => {
    try {
      // Validate the query parameters
      validationFn(req.query);

      // Store validated query
      req.validatedQuery = req.query as T;

      next();
    } catch (error) {
      if (isApiError(error)) {
        res.status(error.statusCode).json(formatErrorResponse(error));
      } else {
        next(error);
      }
    }
  };
}

/**
 * UUID parameter validation middleware
 * Validates that route parameters are valid UUIDs
 */
export function validateUUIDParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const paramValue = req.params[paramName];
      
      if (!paramValue) {
        throw ApiErrorClass.validation(`${paramName} parameter is required`);
      }

      // UUID validation regex
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(paramValue)) {
        throw ApiErrorClass.validation(`${paramName} must be a valid UUID`);
      }

      next();
    } catch (error) {
      if (isApiError(error)) {
        res.status(error.statusCode).json(formatErrorResponse(error));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch and forward errors
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Response formatting middleware
 * Ensures consistent response format
 */
export function responseFormattingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Override res.json to ensure consistent format
  const originalJson = res.json;
  
  res.json = function(body: any) {
    // If body already has success property, use as-is
    if (body && typeof body === 'object' && 'success' in body) {
      return originalJson.call(this, body);
    }

    // Otherwise, wrap in success response format
    const response = {
      success: true,
      data: body
    };

    return originalJson.call(this, response);
  };

  next();
}

/**
 * Request timeout middleware
 * Sets a timeout for requests
 */
export function requestTimeoutMiddleware(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const error = new ApiErrorClass(
          'DATABASE_ERROR',
          'Request timeout',
          408
        );
        res.status(408).json(formatErrorResponse(error));
      }
    }, timeoutMs);

    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * CORS preflight handler
 */
export function corsPreflightHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(200).end();
  } else {
    next();
  }
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
}

/**
 * API version middleware
 * Adds API version to response headers
 */
export function apiVersionMiddleware(version: string = '1.0.0') {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.header('X-API-Version', version);
    next();
  };
}