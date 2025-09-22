import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'node',
    
    // Global setup and teardown
    globals: true,
    
    // Test file patterns for integration tests
    include: ['src/__tests__/integration/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    
    // Coverage configuration (disabled for integration tests)
    coverage: {
      enabled: false
    },
    
    // Test execution configuration - longer timeouts for integration tests
    testTimeout: 30000,
    hookTimeout: 15000,
    teardownTimeout: 10000,
    
    // Sequential execution for integration tests to avoid conflicts
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        maxThreads: 1,
        minThreads: 1
      }
    },
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Reporter configuration
    reporter: ['verbose'],
    
    // No retry for integration tests
    retry: 0,
    
    // Setup files
    setupFiles: ['./src/__tests__/integration/setup.ts'],
    
    // TypeScript configuration
    typecheck: {
      enabled: false
    }
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './src/__tests__')
    }
  },
  
  // Define configuration
  define: {
    'process.env.NODE_ENV': '"integration"'
  }
});