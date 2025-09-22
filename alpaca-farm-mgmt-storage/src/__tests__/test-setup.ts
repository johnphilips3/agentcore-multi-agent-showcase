import { vi } from 'vitest';

// Global test setup configuration
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset all modules to ensure clean state
  vi.resetModules();
  
  // Mock console methods to reduce noise in test output
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  // Helper to create mock promises that can be resolved/rejected
  createMockPromise: <T>() => {
    let resolve: (value: T) => void;
    let reject: (reason?: any) => void;
    
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    
    return { promise, resolve: resolve!, reject: reject! };
  },
  
  // Helper to wait for next tick
  nextTick: () => new Promise(resolve => process.nextTick(resolve)),
  
  // Helper to wait for specified time
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Mock environment variables for consistent testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

// Extend global types for test utilities
declare global {
  var testUtils: {
    createMockPromise: <T>() => {
      promise: Promise<T>;
      resolve: (value: T) => void;
      reject: (reason?: any) => void;
    };
    nextTick: () => Promise<void>;
    wait: (ms: number) => Promise<void>;
  };
}

export {};