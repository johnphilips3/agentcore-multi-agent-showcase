#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Test runner configuration
const TEST_CONFIGS = {
  unit: {
    config: 'vitest.config.ts',
    description: 'Unit tests with mocked dependencies'
  },
  integration: {
    config: 'vitest.integration.config.ts',
    description: 'Integration tests with real database connections'
  },
  performance: {
    config: 'vitest.performance.config.ts',
    description: 'Performance and load tests'
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'unit';
const additionalArgs = args.slice(1);

// Validate test type
if (!TEST_CONFIGS[testType]) {
  console.error(`Invalid test type: ${testType}`);
  console.error(`Available types: ${Object.keys(TEST_CONFIGS).join(', ')}`);
  process.exit(1);
}

// Build command
const config = TEST_CONFIGS[testType];
const vitestArgs = [
  '--run',
  '--config',
  config.config,
  ...additionalArgs
];

console.log(`Running ${config.description}...`);
console.log(`Command: npx vitest ${vitestArgs.join(' ')}`);
console.log('');

// Execute vitest
const vitest = spawn('npx', ['vitest', ...vitestArgs], {
  stdio: 'inherit',
  cwd: process.cwd()
});

vitest.on('close', (code) => {
  if (code === 0) {
    console.log(`\n✅ ${config.description} completed successfully`);
  } else {
    console.log(`\n❌ ${config.description} failed with exit code ${code}`);
  }
  process.exit(code);
});

vitest.on('error', (error) => {
  console.error(`Failed to start test runner: ${error.message}`);
  process.exit(1);
});