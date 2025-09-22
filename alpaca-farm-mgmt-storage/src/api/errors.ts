/**
 * API Error Handling Utilities
 * Standardized error handling for the Alpaca Herd Management API
 */

import { ApiError, ErrorCode, ERROR_CODES } from './types.js';

/**
 * Custom API Error class for structured error handling
 */
export class ApiErrorClass extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(code: ErrorCode, message: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  /**
   * Convert to API error response format
   */
  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }

  /**
   * Create a validation error
   */
  static validation(message: string, field?: string, value?: any, constraint?: string): ApiErrorClass {
    return new ApiErrorClass(
      ERROR_CODES.VALIDATION_ERROR,
      message,
      422,
      { field, value, constraint }
    );
  }

  /**
   * Create a not found error
   */
  static notFound(resource: string, id?: string): ApiErrorClass {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    return new ApiErrorClass(ERROR_CODES.NOT_FOUND, message, 404);
  }

  /**
   * Create a duplicate registration error
   */
  static duplicateRegistration(registrationNumber: string): ApiErrorClass {
    return new ApiErrorClass(
      ERROR_CODES.DUPLICATE_REGISTRATION,
      `Registration number ${registrationNumber} already exists`,
      409,
      { field: 'registrationNumber', value: registrationNumber }
    );
  }

  /**
   * Create an invalid relationship error
   */
  static invalidRelationship(message: string): ApiErrorClass {
    return new ApiErrorClass(ERROR_CODES.INVALID_RELATIONSHIP, message, 400);
  }

  /**
   * Create an inbreeding detected error
   */
  static inbreedingDetected(sireId: string, damId: string, relationshipDegree: number): ApiErrorClass {
    return new ApiErrorClass(
      ERROR_CODES.INBREEDING_DETECTED,
      `Inbreeding detected: sire and dam are related (degree ${relationshipDegree})`,
      400,
      { sireId, damId, relationshipDegree }
    );
  }

  /**
   * Create a database error
   */
  static database(message: string, originalError?: Error): ApiErrorClass {
    return new ApiErrorClass(
      ERROR_CODES.DATABASE_ERROR,
      message,
      500,
      originalError ? { originalError: originalError.message } : undefined
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