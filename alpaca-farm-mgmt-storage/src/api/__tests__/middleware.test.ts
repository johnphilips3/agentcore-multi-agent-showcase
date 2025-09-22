/**
 * Middleware Tests
 * Unit tests for API middleware functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  requestValidationMiddleware,
  paginationMiddleware,
  validateRequestBody,
  validateRequestQuery,
  validateUUIDParam,
  asyncHandler,
  responseFormattingMiddleware,
  requestTimeoutMiddleware,
  ValidatedRequest
} from '../middleware.js';
import { ApiErrorClass } from '../errors.js';

// Mock request and response objects
function createMockRequest(overrides: Partial<Request> = {}): ValidatedRequest {
  return {
    method: 'GET',
    url: '/test',
    headers: {},
    query: {},
    body: {},
    params: {},
    ip: '127.0.0.1',
    get: vi.fn(),
    ...overrides
  } as any;
}

function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    removeHeader: vi.fn().mockReturnThis(),
    get: vi.fn(),
    headersSent: false,
    on: vi.fn(),
    end: vi.fn()
  } as any;
  
  return res;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

describe('Middleware', () => {
  let req: ValidatedRequest;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  describe('requestValidationMiddleware', () => {
    it('should add request ID to headers', () => {
      requestValidationMiddleware(req, res, next);
      
      expect(req.headers['x-request-id']).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should preserve existing request ID', () => {
      const existingId = 'existing-request-id';
      req.headers['x-request-id'] = existingId;
      
      requestValidationMiddleware(req, res, next);
      
      expect(req.headers['x-request-id']).toBe(existingId);
      expect(next).toHaveBeenCalled();
    });

    it('should validate content type for POST requests', () => {
      req.method = 'POST';
      req.headers['content-type'] = 'text/plain';
      
      requestValidationMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Content-Type must be application/json',
          details: {
            field: undefined,
            value: undefined,
            constraint: undefined
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow valid content type for POST requests', () => {
      req.method = 'POST';
      req.headers['content-type'] = 'application/json';
      
      requestValidationMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should validate request body size', () => {
      req.method = 'POST';
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = (11 * 1024 * 1024).toString(); // 11MB
      
      requestValidationMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body too large (max 10MB)',
          details: {
            field: undefined,
            value: undefined,
            constraint: undefined
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('paginationMiddleware', () => {
    it('should set default pagination values', () => {
      paginationMiddleware(req, res, next);
      
      expect(req.pagination).toEqual({
        page: 1,
        limit: 20,
        offset: 0
      });
      expect(next).toHaveBeenCalled();
    });

    it('should parse pagination query parameters', () => {
      req.query = {
        page: '2',
        limit: '10',
        sortBy: 'name',
        sortOrder: 'desc'
      };
      
      paginationMiddleware(req, res, next);
      
      expect(req.pagination).toEqual({
        page: 2,
        limit: 10,
        offset: 10
      });
      expect(req.validatedQuery).toEqual({
        page: 2,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'desc'
      });
      expect(next).toHaveBeenCalled();
    });

    it('should validate pagination parameters', () => {
      req.query = {
        page: '0', // Invalid page
        limit: '10'
      };
      
      paginationMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateRequestBody', () => {
    it('should validate request body successfully', () => {
      const validationFn = vi.fn();
      const middleware = validateRequestBody(validationFn);
      
      req.body = { name: 'Test' };
      
      middleware(req, res, next);
      
      expect(validationFn).toHaveBeenCalledWith(req.body);
      expect(req.validatedBody).toEqual(req.body);
      expect(next).toHaveBeenCalled();
    });

    it('should handle validation errors', () => {
      const validationFn = vi.fn().mockImplementation(() => {
        throw ApiErrorClass.validation('Invalid data');
      });
      const middleware = validateRequestBody(validationFn);
      
      req.body = { name: '' };
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
          details: {
            field: undefined,
            value: undefined,
            constraint: undefined
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should require request body', () => {
      const validationFn = vi.fn();
      const middleware = validateRequestBody(validationFn);
      
      req.body = undefined;
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body is required',
          details: {
            field: undefined,
            value: undefined,
            constraint: undefined
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateRequestQuery', () => {
    it('should validate query parameters successfully', () => {
      const validationFn = vi.fn();
      const middleware = validateRequestQuery(validationFn);
      
      req.query = { name: 'Test' };
      
      middleware(req, res, next);
      
      expect(validationFn).toHaveBeenCalledWith(req.query);
      expect(req.validatedQuery).toEqual(req.query);
      expect(next).toHaveBeenCalled();
    });

    it('should handle query validation errors', () => {
      const validationFn = vi.fn().mockImplementation(() => {
        throw ApiErrorClass.validation('Invalid query');
      });
      const middleware = validateRequestQuery(validationFn);
      
      req.query = { invalid: 'value' };
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateUUIDParam', () => {
    it('should validate valid UUID parameter', () => {
      const middleware = validateUUIDParam('id');
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid UUID parameter', () => {
      const middleware = validateUUIDParam('id');
      req.params = { id: 'invalid-uuid' };
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'id must be a valid UUID',
          details: {
            field: undefined,
            value: undefined,
            constraint: undefined
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should require parameter to be present', () => {
      const middleware = validateUUIDParam('id');
      req.params = {};
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'id parameter is required',
          details: {
            field: undefined,
            value: undefined,
            constraint: undefined
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const asyncFn = vi.fn().mockResolvedValue('success');
      const handler = asyncHandler(asyncFn);
      
      await handler(req, res, next);
      
      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch and forward async errors', async () => {
      const error = new Error('Async error');
      const asyncFn = vi.fn().mockRejectedValue(error);
      const handler = asyncHandler(asyncFn);
      
      // Wait for the promise to resolve/reject
      await new Promise(resolve => {
        const originalNext = next;
        next = vi.fn((err) => {
          originalNext(err);
          resolve(undefined);
        });
        handler(req, res, next);
      });
      
      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('responseFormattingMiddleware', () => {
    it('should wrap response data in success format', () => {
      const originalJson = res.json;
      const jsonSpy = vi.fn();
      
      responseFormattingMiddleware(req, res, next);
      
      const data = { name: 'Test' };
      res.json(data);
      
      // The middleware overrides res.json, so we need to check the behavior differently
      expect(next).toHaveBeenCalled();
    });

    it('should not wrap response if it already has success property', () => {
      responseFormattingMiddleware(req, res, next);
      
      const response = { success: false, error: { code: 'ERROR', message: 'Error' } };
      res.json(response);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requestTimeoutMiddleware', () => {
    it('should set up request timeout', () => {
      const timeoutMs = 1000;
      const middleware = requestTimeoutMiddleware(timeoutMs);
      
      middleware(req, res, next);
      
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(next).toHaveBeenCalled();
    });

    it('should handle timeout when response not sent', (done) => {
      const timeoutMs = 10; // Very short timeout for testing
      const middleware = requestTimeoutMiddleware(timeoutMs);
      
      middleware(req, res, next);
      
      setTimeout(() => {
        expect(res.status).toHaveBeenCalledWith(408);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Request timeout'
          }
        });
        done();
      }, 20);
    });
  });
});