/**
 * API Error Handling Utilities
 * Standardized error handling for the Alpaca Herd Management API
 */

import { ApiError, ErrorCode, ERROR_CODES } from './types.js';

/**
 * Custom API Error class for structured error handling with Lambda support
 */
export class ApiErrorClass extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly requestId?: string;
  public readonly timestamp: string;

  constructor(code: ErrorCode, message: string, statusCode: number = 500, details?: any, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Convert to API error response format
   */
  toApiError(): ApiError {
    const apiError: ApiError = {
      code: this.code,
      message: this.message,
      details: this.details
    };

    // Add Lambda-specific context in Lambda environment
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      Object.assign(apiError, {
        requestId: this.requestId,
        timestamp: this.timestamp,
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME
      });
    }

    return apiError;
  }

  /**
   * Convert to CloudWatch-friendly log format
   */
  toLogFormat(): any {
    return {
      level: 'error',
      message: this.message,
      errorCode: this.code,
      statusCode: this.statusCode,
      details: this.details,
      requestId: this.requestId,
      timestamp: this.timestamp,
      stack: this.stack,
      service: 'alpaca-farm-mgmt-api',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Create a validation error
   */
  static validation(message: string, field?: string, value?: any, constraint?: string, requestId?: string): ApiErrorClass {
    return new ApiErrorClass(
      ERROR_CODES.VALIDATION_ERROR,
      message,
      422,
      { field, value, constraint },
      requestId
    );
  }

  /**
   * Create a not found error
   */
  static notFound(resource: string, id?: string, requestId?: string): ApiErrorClass {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    return new ApiErrorClass(ERROR_CODES.NOT_FOUND, message, 404, undefined, requestId);
  }

  /**
   * Create a duplicate registration error
   */
  static duplicateRegistration(registrationNumber: string, requestId?: string): ApiErrorClass {
    return new ApiErrorClass(
      ERROR_CODES.DUPLICATE_REGISTRATION,
      `Registration number ${registrationNumber} already exists`,
      409,
      { field: 'registrationNumber', value: registrationNumber },
      requestId
    );
  }

  /**
   * Create an invalid relationship error
   */
  static invalidRelationship(message: string, requestId?: string): ApiErrorClass {
    return new ApiErrorClass(ERROR_CODES.INVALID_RELATIONSHIP, message, 400, undefined, requestId);
  }

  /**
   * Create an inbreeding detected error
   */
  static inbreedingDetected(sireId: string, damId: string, relationshipDegree: number, requestId?: string): ApiErrorClass {
    return new ApiErrorClass(
      ERROR_CODES.INBREEDING_DETECTED,
      `Inbreeding detected: sire and dam are related (degree ${relationshipDegree})`,
      400,
      { sireId, damId, relationshipDegree },
      requestId
    );
  }

  /**
   * Create a database error
   */
  static database(message: string, originalError?: Error, requestId?: string): ApiErrorClass {
    return new ApiErrorClass(
      ERROR_CODES.DATABASE_ERROR,
      message,
      500,
      originalError ? { 
        originalError: originalError.message,
        errorType: originalError.constructor.name,
        stack: process.env.NODE_ENV === 'development' ? originalError.stack : undefined
      } : undefined,
      requestId
    );
  }

  /**
   * Create a timeout error
   */
  static timeout(operation: string, timeoutMs: number, requestId?: string): ApiErrorClass {
    return new ApiErrorClass(
      ERROR_CODES.DATABASE_ERROR, // Using DATABASE_ERROR as we don't have a specific timeout code
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      504,
      { operation, timeoutMs, type: 'timeout' },
      requestId
    );
  }

  /**
   * Create a Lambda-specific error
   */
  static lambda(message: string, errorType: string, requestId?: string): ApiErrorClass {
    return new ApiErrorClass(
      ERROR_CODES.DATABASE_ERROR, // Using DATABASE_ERROR as a generic server error
      message,
      500,
      { 
        type: 'lambda_error',
        errorType,
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION
      },
      requestId
    );
  }
}

/**
 * HTTP status code mappings for error codes
 */
export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  [ERROR_CODES.VALIDATION_ERROR]: 422,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.DUPLICATE_REGISTRATION]: 409,
  [ERROR_CODES.INVALID_RELATIONSHIP]: 400,
  [ERROR_CODES.DATABASE_ERROR]: 500,
  [ERROR_CODES.INBREEDING_DETECTED]: 400
};

/**
 * Validation error helper functions
 */
export class ValidationError {
  /**
   * Required field validation
   */
  static required(field: string): ApiErrorClass {
    return ApiErrorClass.validation(
      `${field} is required`,
      field,
      undefined,
      'required'
    );
  }

  /**
   * String length validation
   */
  static stringLength(field: string, value: string, min?: number, max?: number): ApiErrorClass {
    if (min && value.length < min) {
      return ApiErrorClass.validation(
        `${field} must be at least ${min} characters long`,
        field,
        value,
        `minLength:${min}`
      );
    }
    if (max && value.length > max) {
      return ApiErrorClass.validation(
        `${field} must be no more than ${max} characters long`,
        field,
        value,
        `maxLength:${max}`
      );
    }
    throw new Error('Invalid string length validation parameters');
  }

  /**
   * Number range validation
   */
  static numberRange(field: string, value: number, min?: number, max?: number): ApiErrorClass {
    if (min !== undefined && value < min) {
      return ApiErrorClass.validation(
        `${field} must be at least ${min}`,
        field,
        value,
        `minimum:${min}`
      );
    }
    if (max !== undefined && value > max) {
      return ApiErrorClass.validation(
        `${field} must be no more than ${max}`,
        field,
        value,
        `maximum:${max}`
      );
    }
    throw new Error('Invalid number range validation parameters');
  }

  /**
   * Enum validation
   */
  static enum(field: string, value: any, allowedValues: readonly string[]): ApiErrorClass {
    return ApiErrorClass.validation(
      `${field} must be one of: ${allowedValues.join(', ')}`,
      field,
      value,
      `enum:${allowedValues.join(',')}`
    );
  }

  /**
   * Date format validation
   */
  static dateFormat(field: string, value: string): ApiErrorClass {
    return ApiErrorClass.validation(
      `${field} must be a valid ISO date string (YYYY-MM-DD)`,
      field,
      value,
      'dateFormat'
    );
  }

  /**
   * UUID format validation
   */
  static uuidFormat(field: string, value: string): ApiErrorClass {
    return ApiErrorClass.validation(
      `${field} must be a valid UUID`,
      field,
      value,
      'uuidFormat'
    );
  }

  /**
   * Array validation
   */
  static arrayMinItems(field: string, value: any[], minItems: number): ApiErrorClass {
    return ApiErrorClass.validation(
      `${field} must contain at least ${minItems} item(s)`,
      field,
      value,
      `minItems:${minItems}`
    );
  }

  /**
   * Future date validation
   */
  static futureDate(field: string, value: string): ApiErrorClass {
    return ApiErrorClass.validation(
      `${field} cannot be in the future`,
      field,
      value,
      'futureDate'
    );
  }

  /**
   * Past date validation
   */
  static pastDate(field: string, value: string): ApiErrorClass {
    return ApiErrorClass.validation(
      `${field} cannot be in the past`,
      field,
      value,
      'pastDate'
    );
  }
}

/**
 * Error response formatter
 */
export function formatErrorResponse(error: ApiErrorClass | Error): {
  success: false;
  error: ApiError;
} {
  if (error instanceof ApiErrorClass) {
    return {
      success: false,
      error: error.toApiError()
    };
  }

  // Handle unexpected errors
  return {
    success: false,
    error: {
      code: ERROR_CODES.DATABASE_ERROR,
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined
    }
  };
}

/**
 * Success response formatter
 */
export function formatSuccessResponse<T>(data: T, pagination?: any): {
  success: true;
  data: T;
  pagination?: any;
} {
  const response: any = {
    success: true,
    data
  };

  if (pagination) {
    response.pagination = pagination;
  }

  return response;
}

/**
 * Check if error is an API error
 */
export function isApiError(error: any): error is ApiErrorClass {
  return error instanceof ApiErrorClass;
}

/**
 * Get HTTP status code for error
 */
export function getErrorStatusCode(error: ApiErrorClass | Error): number {
  if (error instanceof ApiErrorClass) {
    return error.statusCode;
  }
  return 500; // Internal server error for unexpected errors
}