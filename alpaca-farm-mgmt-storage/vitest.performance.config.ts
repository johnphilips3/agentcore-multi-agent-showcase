import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'node',
    
    // Global setup and teardown
    globals: true,
    
    // Test file patterns for performance tests
    include: ['src/__tests__/performance/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    
    // Coverage configuration (disabled for performance tests)
    coverage: {
      enabled: false
    },
    
    // Test execution configuration - very long timeouts for performance tests
    testTimeout: 120000, // 2 minutes
    hookTimeout: 30000,
    teardownTimeout: 15000,
    
    // Sequential execution for performance tests
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
    
    // No retry for performance tests
    retry: 0,
    
    // Setup files
    setupFiles: ['./src/__tests__/performance/performance-setup.ts'],
    
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
    'process.env.NODE_ENV': '"performance"'
  }
});