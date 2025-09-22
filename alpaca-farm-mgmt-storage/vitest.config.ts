import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'node',
    
    // Global setup and teardown
    globals: true,
    
    // Test file patterns
    include: ['src/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'src/__tests__/integration/**',
      'src/__tests__/performance/**'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/__tests__/**',
        '**/*.test.ts',
        '**/*.d.ts',
        'src/api/docs/**',
        'src/api/openapi.yaml'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    
    // Test execution configuration
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Reporter configuration
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results.json'
    },
    
    // Retry configuration for flaky tests
    retry: 1,
    
    // Setup files
    setupFiles: ['./src/__tests__/test-setup.ts'],
    
    // TypeScript configuration
    typecheck: {
      enabled: false // Disable during test runs for performance
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
    'process.env.NODE_ENV': '"test"'
  }
});