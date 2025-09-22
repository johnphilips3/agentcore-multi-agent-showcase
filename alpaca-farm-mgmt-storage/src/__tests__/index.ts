/**
 * Test utilities and factories index
 * Exports all test utilities for easy importing in test files
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

// Test utilities
export * from './test-utils';

// Data factories
export * from './data-factories';

// Mock factories
export * from './mock-factories';

// Re-export commonly used testing functions from vitest
export { 
  describe, 
  it, 
  expect, 
  beforeEach, 
  afterEach, 
  beforeAll, 
  afterAll,
  vi 
} from 'vitest';