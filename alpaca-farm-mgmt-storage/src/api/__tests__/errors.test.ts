/**
 * Error Handling Tests
 * Unit tests for API error handling utilities
 */

import { describe, it, expect } from 'vitest';
import {
  ApiErrorClass,
  ValidationError,
  formatErrorResponse,
  formatSuccessResponse,
  isApiError,
  getErrorStatusCode,
  ERROR_STATUS_CODES
} from '../errors.js';
import { ERROR_CODES } from '../types.js';

describe('Error Handling', () => {
  describe('ApiErrorClass', () => {
    it('should create API error with correct properties', () => {
      const error = new ApiErrorClass(
        ERROR_CODES.VALIDATION_ERROR,
        'Test error',
        422,
        { field: 'name' }
      );

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(422);
      expect(error.details).toEqual({ field: 'name' });
      expect(error.name).toBe('ApiError');
    });

    it('should convert to API error format', () => {
      const error = new ApiErrorClass(
        ERROR_CODES.NOT_FOUND,
        'Resource not found',
        404
      );

      const apiError = error.toApiError();

      expect(apiError).toEqual({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Resource not found',
        details: undefined
      });
    });

    describe('Static factory methods', () => {
      it('should create validation error', () => {
        const error = ApiErrorClass.validation('Invalid input', 'name', 'test', 'required');

        expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
        expect(error.message).toBe('Invalid input');
        expect(error.statusCode).toBe(422);
        expect(error.details).toEqual({
          field: 'name',
          value: 'test',
          constraint: 'required'
        });
      });

      it('should create not found error', () => {
        const error = ApiErrorClass.notFound('Alpaca', '123');

        expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
        expect(error.message).toBe('Alpaca with ID 123 not found');
        expect(error.statusCode).toBe(404);
      });

      it('should create not found error without ID', () => {
        const error = ApiErrorClass.notFound('Alpaca');

        expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
        expect(error.message).toBe('Alpaca not found');
        expect(error.statusCode).toBe(404);
      });

      it('should create duplicate registration error', () => {
        const error = ApiErrorClass.duplicateRegistration('REG123');

        expect(error.code).toBe(ERROR_CODES.DUPLICATE_REGISTRATION);
        expect(error.message).toBe('Registration number REG123 already exists');
        expect(error.statusCode).toBe(409);
        expect(error.details).toEqual({
          field: 'registrationNumber',
          value: 'REG123'
        });
      });

      it('should create invalid relationship error', () => {
        const error = ApiErrorClass.invalidRelationship('Cannot breed siblings');

        expect(error.code).toBe(ERROR_CODES.INVALID_RELATIONSHIP);
        expect(error.message).toBe('Cannot breed siblings');
        expect(error.statusCode).toBe(400);
      });

      it('should create inbreeding detected error', () => {
        const error = ApiErrorClass.inbreedingDetected('sire123', 'dam456', 2);

        expect(error.code).toBe(ERROR_CODES.INBREEDING_DETECTED);
        expect(error.message).toBe('Inbreeding detected: sire and dam are related (degree 2)');
        expect(error.statusCode).toBe(400);
        expect(error.details).toEqual({
          sireId: 'sire123',
          damId: 'dam456',
          relationshipDegree: 2
        });
      });

      it('should create database error', () => {
        const originalError = new Error('Connection failed');
        const error = ApiErrorClass.database('Database operation failed', originalError);

        expect(error.code).toBe(ERROR_CODES.DATABASE_ERROR);
        expect(error.message).toBe('Database operation failed');
        expect(error.statusCode).toBe(500);
        expect(error.details).toEqual({
          originalError: 'Connection failed'
        });
      });

      it('should create database error without original error', () => {
        const error = ApiErrorClass.database('Database operation failed');

        expect(error.code).toBe(ERROR_CODES.DATABASE_ERROR);
        expect(error.message).toBe('Database operation failed');
        expect(error.statusCode).toBe(500);
        expect(error.details).toBeUndefined();
      });
    });
  });

  describe('ValidationError', () => {
    it('should create required field error', () => {
      const error = ValidationError.required('name');

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('name is required');
      expect(error.details).toEqual({
        field: 'name',
        value: undefined,
        constraint: 'required'
      });
    });

    it('should create string length error for minimum', () => {
      const error = ValidationError.stringLength('name', 'ab', 3, 10);

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('name must be at least 3 characters long');
      expect(error.details).toEqual({
        field: 'name',
        value: 'ab',
        constraint: 'minLength:3'
      });
    });

    it('should create string length error for maximum', () => {
      const error = ValidationError.stringLength('name', 'verylongname', 1, 5);

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('name must be no more than 5 characters long');
      expect(error.details).toEqual({
        field: 'name',
        value: 'verylongname',
        constraint: 'maxLength:5'
      });
    });

    it('should create number range error for minimum', () => {
      const error = ValidationError.numberRange('age', 5, 10, 100);

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('age must be at least 10');
      expect(error.details).toEqual({
        field: 'age',
        value: 5,
        constraint: 'minimum:10'
      });
    });

    it('should create number range error for maximum', () => {
      const error = ValidationError.numberRange('age', 150, 0, 100);

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('age must be no more than 100');
      expect(error.details).toEqual({
        field: 'age',
        value: 150,
        constraint: 'maximum:100'
      });
    });

    it('should create enum validation error', () => {
      const error = ValidationError.enum('gender', 'unknown', ['male', 'female']);

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('gender must be one of: male, female');
      expect(error.details).toEqual({
        field: 'gender',
        value: 'unknown',
        constraint: 'enum:male,female'
      });
    });

    it('should create date format error', () => {
      const error = ValidationError.dateFormat('birthDate', 'invalid-date');

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('birthDate must be a valid ISO date string (YYYY-MM-DD)');
      expect(error.details).toEqual({
        field: 'birthDate',
        value: 'invalid-date',
        constraint: 'dateFormat'
      });
    });

    it('should create UUID format error', () => {
      const error = ValidationError.uuidFormat('id', 'invalid-uuid');

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('id must be a valid UUID');
      expect(error.details).toEqual({
        field: 'id',
        value: 'invalid-uuid',
        constraint: 'uuidFormat'
      });
    });

    it('should create array min items error', () => {
      const error = ValidationError.arrayMinItems('alpacaIds', [], 1);

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('alpacaIds must contain at least 1 item(s)');
      expect(error.details).toEqual({
        field: 'alpacaIds',
        value: [],
        constraint: 'minItems:1'
      });
    });

    it('should create future date error', () => {
      const error = ValidationError.futureDate('birthDate', '2025-01-01');

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('birthDate cannot be in the future');
      expect(error.details).toEqual({
        field: 'birthDate',
        value: '2025-01-01',
        constraint: 'futureDate'
      });
    });

    it('should create past date error', () => {
      const error = ValidationError.pastDate('dueDate', '2020-01-01');

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('dueDate cannot be in the past');
      expect(error.details).toEqual({
        field: 'dueDate',
        value: '2020-01-01',
        constraint: 'pastDate'
      });
    });
  });

  describe('formatErrorResponse', () => {
    it('should format API error response', () => {
      const error = new ApiErrorClass(ERROR_CODES.NOT_FOUND, 'Not found', 404);
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Not found',
          details: undefined
        }
      });
    });

    it('should format generic error response', () => {
      const error = new Error('Generic error');
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: {
          code: ERROR_CODES.DATABASE_ERROR,
          message: 'An unexpected error occurred',
          details: undefined
        }
      });
    });

    it('should include error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Generic error');
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: {
          code: ERROR_CODES.DATABASE_ERROR,
          message: 'An unexpected error occurred',
          details: { originalError: 'Generic error' }
        }
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('formatSuccessResponse', () => {
    it('should format success response without pagination', () => {
      const data = { name: 'Test' };
      const response = formatSuccessResponse(data);

      expect(response).toEqual({
        success: true,
        data
      });
    });

    it('should format success response with pagination', () => {
      const data = [{ name: 'Test1' }, { name: 'Test2' }];
      const pagination = { page: 1, limit: 10, total: 2, totalPages: 1 };
      const response = formatSuccessResponse(data, pagination);

      expect(response).toEqual({
        success: true,
        data,
        pagination
      });
    });
  });

  describe('isApiError', () => {
    it('should return true for API errors', () => {
      const error = new ApiErrorClass(ERROR_CODES.NOT_FOUND, 'Not found', 404);
      expect(isApiError(error)).toBe(true);
    });

    it('should return false for generic errors', () => {
      const error = new Error('Generic error');
      expect(isApiError(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(isApiError({})).toBe(false);
      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
    });
  });

  describe('getErrorStatusCode', () => {
    it('should return status code for API errors', () => {
      const error = new ApiErrorClass(ERROR_CODES.NOT_FOUND, 'Not found', 404);
      expect(getErrorStatusCode(error)).toBe(404);
    });

    it('should return 500 for generic errors', () => {
      const error = new Error('Generic error');
      expect(getErrorStatusCode(error)).toBe(500);
    });
  });

  describe('ERROR_STATUS_CODES', () => {
    it('should have correct status codes for all error types', () => {
      expect(ERROR_STATUS_CODES).toEqual({
        [ERROR_CODES.VALIDATION_ERROR]: 422,
        [ERROR_CODES.NOT_FOUND]: 404,
        [ERROR_CODES.DUPLICATE_REGISTRATION]: 409,
        [ERROR_CODES.INVALID_RELATIONSHIP]: 400,
        [ERROR_CODES.DATABASE_ERROR]: 500,
        [ERROR_CODES.INBREEDING_DETECTED]: 400
      });
    });
  });
});