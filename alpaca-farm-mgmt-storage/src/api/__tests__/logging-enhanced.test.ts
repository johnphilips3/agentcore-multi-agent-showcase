/**
 * Enhanced Logging Tests for Lambda Environment
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  CloudWatchLogger, 
  logLambdaColdStart, 
  logLambdaTimeoutWarning, 
  logDatabaseConnectionError,
  logApiGatewayError,
  logLambdaPerformanceMetrics,
  LogLevel 
} from '../logging';

describe('Enhanced Logging for Lambda', () => {
  let consoleSpy: any;
  
  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CloudWatchLogger', () => {
    it('should create structured JSON logs', () => {
      const logger = new CloudWatchLogger(LogLevel.INFO);
      
      logger.info('Test message', { key: 'value' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('"level":"INFO"')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test message"')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('"service":"alpaca-farm-mgmt-api"')
      );
    });

    it('should include Lambda context when in Lambda environment', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME;
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
      
      const logger = new CloudWatchLogger(LogLevel.INFO);
      logger.info('Test message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('"functionName":"test-function"')
      );
      
      process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv;
    });
  });

  describe('Lambda-specific logging functions', () => {
    it('should log cold start with proper structure', () => {
      // Set Lambda environment for this test
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME;
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
      
      // Re-import to get CloudWatch logger
      vi.resetModules();
      
      logLambdaColdStart('test-request-id', 1500, 256);
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Lambda cold start detected')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('test-request-id')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('1500ms')
      );
      
      process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv;
    });

    it('should log timeout warning', () => {
      logLambdaTimeoutWarning('test-request-id', 2000, 'database-query');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Lambda timeout warning')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('2000ms')
      );
    });

    it('should log database connection error with retry context', () => {
      const error = new Error('Connection refused');
      logDatabaseConnectionError(error, 2, 3, 'query_execution', 'test-request-id');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Database connection failed, retrying (2/3)')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('test-request-id')
      );
    });

    it('should log API Gateway error', () => {
      const error = new Error('Handler failed');
      const mockEvent = {
        httpMethod: 'GET',
        path: '/test',
        requestContext: { stage: 'prod', identity: { sourceIp: '1.2.3.4' } },
        headers: { 'User-Agent': 'test-agent' }
      };
      
      logApiGatewayError(error, mockEvent, 'test-request-id', 500);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('API Gateway integration error')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('GET')
      );
    });

    it('should log performance metrics with recommendations', () => {
      logLambdaPerformanceMetrics('test-request-id', 6000, 400, true);
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Lambda performance metrics')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('test-request-id')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('6000ms')
      );
    });
  });
});