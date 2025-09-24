/**
 * Tests for Lambda Environment Setup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isLambdaEnvironment,
  setupLambdaEnvironment,
  getEnvironmentConnectionManager,
  getEnvironmentConnection,
  logEnvironmentInfo,
  cleanupEnvironment
} from '../environment-setup';

// Mock dependencies
vi.mock('../database-adapter', () => ({
  getLambdaConnectionManager: vi.fn().mockReturnValue({
    testConnection: vi.fn(),
    getConnection: vi.fn().mockResolvedValue({ isConnected: () => true }),
    close: vi.fn()
  }),
  createLambdaDatabaseConfig: vi.fn().mockReturnValue({
    host: 'test-host',
    database: 'test-db',
    username: 'test-user',
    maxConnections: 2,
    region: 'us-east-1'
  })
}));

vi.mock('../../database/connection', () => ({
  getConnectionManager: vi.fn().mockReturnValue({
    getConnection: vi.fn().mockResolvedValue({ isConnected: () => true }),
    close: vi.fn()
  }),
  resetConnectionManager: vi.fn()
}));

describe('Environment Setup', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isLambdaEnvironment', () => {
    it('should return true when AWS_LAMBDA_FUNCTION_NAME is set', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
      expect(isLambdaEnvironment()).toBe(true);
    });

    it('should return true when AWS_EXECUTION_ENV is set', () => {
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
      expect(isLambdaEnvironment()).toBe(true);
    });

    it('should return true when LAMBDA_TASK_ROOT is set', () => {
      process.env.LAMBDA_TASK_ROOT = '/var/task';
      expect(isLambdaEnvironment()).toBe(true);
    });

    it('should return false when no Lambda environment variables are set', () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      delete process.env.AWS_EXECUTION_ENV;
      delete process.env.LAMBDA_TASK_ROOT;
      
      expect(isLambdaEnvironment()).toBe(false);
    });

    it('should return true when multiple Lambda environment variables are set', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
      process.env.LAMBDA_TASK_ROOT = '/var/task';
      
      expect(isLambdaEnvironment()).toBe(true);
    });
  });

  describe('setupLambdaEnvironment', () => {
    it('should skip setup when not in Lambda environment', async () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      delete process.env.AWS_EXECUTION_ENV;
      delete process.env.LAMBDA_TASK_ROOT;

      await setupLambdaEnvironment();

      const { createLambdaDatabaseConfig } = await import('../database-adapter');
      expect(createLambdaDatabaseConfig).not.toHaveBeenCalled();
    });

    it('should setup Lambda environment when in Lambda', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
      process.env.RDS_HOST = 'test-host';
      process.env.RDS_USERNAME = 'test-user';

      await setupLambdaEnvironment();

      const { createLambdaDatabaseConfig, getLambdaConnectionManager } = await import('../database-adapter');
      const { resetConnectionManager } = await import('../../database/connection');
      
      expect(createLambdaDatabaseConfig).toHaveBeenCalled();
      expect(resetConnectionManager).toHaveBeenCalled();
      expect(getLambdaConnectionManager).toHaveBeenCalled();
    });

    it('should handle setup errors', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
      
      const { createLambdaDatabaseConfig } = await import('../database-adapter');
      (createLambdaDatabaseConfig as any).mockImplementation(() => {
        throw new Error('Configuration error');
      });

      await expect(setupLambdaEnvironment()).rejects.toThrow('Configuration error');
    });
  });

  describe('getEnvironmentConnectionManager', () => {
    it('should return Lambda connection manager in Lambda environment', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

      const manager = getEnvironmentConnectionManager();

      const { getLambdaConnectionManager } = require('../database-adapter');
      expect(getLambdaConnectionManager).toHaveBeenCalled();
    });

    it('should return regular connection manager outside Lambda environment', () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      delete process.env.AWS_EXECUTION_ENV;
      delete process.env.LAMBDA_TASK_ROOT;

      const manager = getEnvironmentConnectionManager();

      const { getConnectionManager } = require('../../database/connection');
      expect(getConnectionManager).toHaveBeenCalled();
    });
  });

  describe('getEnvironmentConnection', () => {
    it('should return connection from appropriate manager', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

      const connection = await getEnvironmentConnection();

      expect(connection).toBeDefined();
      expect(connection.isConnected()).toBe(true);
    });
  });

  describe('logEnvironmentInfo', () => {
    it('should log environment information', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
      process.env.NODE_ENV = 'production';
      process.env.AWS_REGION = 'us-west-2';
      process.env.AWS_LAMBDA_FUNCTION_VERSION = '1';
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '512';
      process.env.AWS_LAMBDA_FUNCTION_TIMEOUT = '30';
      process.env.RDS_HOST = 'test-host';
      process.env.RDS_DATABASE = 'test-db';
      process.env.RDS_USERNAME = 'test-user';

      logEnvironmentInfo();

      expect(consoleSpy).toHaveBeenCalledWith('🌍 Environment Information:', {
        isLambda: true,
        nodeEnv: 'production',
        awsRegion: 'us-west-2',
        functionName: 'test-function',
        functionVersion: '1',
        memorySize: '512',
        timeout: '30',
        rdsHost: '***configured***',
        rdsDatabase: 'test-db',
        rdsUsername: '***configured***'
      });

      consoleSpy.mockRestore();
    });

    it('should handle missing environment variables', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      delete process.env.NODE_ENV;
      delete process.env.RDS_HOST;
      delete process.env.RDS_DATABASE;
      delete process.env.RDS_USERNAME;

      logEnvironmentInfo();

      expect(consoleSpy).toHaveBeenCalledWith('🌍 Environment Information:', {
        isLambda: false,
        nodeEnv: undefined,
        awsRegion: undefined,
        functionName: undefined,
        functionVersion: undefined,
        memorySize: undefined,
        timeout: undefined,
        rdsHost: 'not set',
        rdsDatabase: 'not set',
        rdsUsername: 'not set'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('cleanupEnvironment', () => {
    it('should cleanup Lambda environment when in Lambda', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

      await cleanupEnvironment();

      const { getLambdaConnectionManager } = await import('../database-adapter');
      expect(getLambdaConnectionManager).toHaveBeenCalled();
    });

    it('should cleanup regular environment when not in Lambda', async () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      delete process.env.AWS_EXECUTION_ENV;
      delete process.env.LAMBDA_TASK_ROOT;

      await cleanupEnvironment();

      const { resetConnectionManager } = await import('../../database/connection');
      expect(resetConnectionManager).toHaveBeenCalled();
    });
  });
});