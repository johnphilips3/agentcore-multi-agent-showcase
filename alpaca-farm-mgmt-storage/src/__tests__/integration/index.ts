// Integration test suite entry point
export * from './setup';
export * from './alpaca-workflow.test';
export * from './backup-recovery.test';
export * from './data-consistency.test';

// Test utilities for integration testing
export const integrationTestConfig = {
  timeout: 30000, // 30 seconds for integration tests
  retries: 2,
  setupTimeout: 10000
};

// Helper function to run all integration tests
export const runIntegrationTests = async () => {
  console.log('Starting integration test suite...');
  
  // This would be called by the test runner
  // Individual test files will be executed by vitest
  
  console.log('Integration tests completed.');
};