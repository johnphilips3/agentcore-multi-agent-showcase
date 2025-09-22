# Test Configuration Documentation

## Overview

This document describes the comprehensive test configuration setup for the alpaca farm management storage system. The configuration has been optimized for reliability, performance, and maintainability.

## Test Structure

### Test Types

1. **Unit Tests** - Isolated component testing with mocked dependencies
2. **Integration Tests** - Cross-component interaction testing
3. **Performance Tests** - Load and memory testing

### Configuration Files

- `vitest.config.ts` - Main configuration for unit tests
- `vitest.integration.config.ts` - Configuration for integration tests
- `vitest.performance.config.ts` - Configuration for performance tests
- `src/__tests__/test-setup.ts` - Global test setup and utilities

## Available Scripts

### Basic Test Commands

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance
```

### Advanced Test Commands

```bash
# Run tests with minimal output
npm run test:silent

# Run tests with verbose output
npm run test:verbose

# Run tests in debug mode (stops on first failure)
npm run test:debug

# Validate test configuration
npm run test:validate

# Use custom test runner
npm run test:runner unit
npm run test:runner integration
npm run test:runner performance
```

## Configuration Features

### Unit Test Configuration (`vitest.config.ts`)

- **Environment**: Node.js
- **Coverage**: V8 provider with 85-90% thresholds
- **Parallel Execution**: Up to 4 threads
- **Timeouts**: 10s test, 10s hook, 5s teardown
- **Mock Management**: Auto-clear, restore, and reset
- **Excludes**: Integration and performance tests

### Integration Test Configuration (`vitest.integration.config.ts`)

- **Environment**: Node.js with integration setup
- **Execution**: Sequential (single thread)
- **Timeouts**: 30s test, 15s hook, 10s teardown
- **Coverage**: Disabled
- **Setup**: Custom integration setup file

### Performance Test Configuration (`vitest.performance.config.ts`)

- **Environment**: Node.js with performance setup
- **Execution**: Sequential (single thread)
- **Timeouts**: 120s test, 30s hook, 15s teardown
- **Coverage**: Disabled
- **Setup**: Custom performance setup file

## Test Utilities

### Global Test Setup (`src/__tests__/test-setup.ts`)

Provides:
- Automatic mock cleanup
- Console method mocking
- Environment variable setup
- Test utility functions

### Available Utilities

```typescript
// Create mock promises
const { promise, resolve, reject } = testUtils.createMockPromise<string>();

// Wait for next tick
await testUtils.nextTick();

// Wait for specified time
await testUtils.wait(100);
```

## Test Validation

### Validation Script (`scripts/validate-tests.js`)

Checks for:
- Proper test structure (describe/it blocks)
- Required imports (vitest, expect)
- Mock cleanup patterns
- Async/await usage
- Configuration file presence

Run validation:
```bash
npm run test:validate
```

### Test Runner Script (`scripts/test-runner.js`)

Provides unified interface for running different test types:
```bash
npm run test:runner unit
npm run test:runner integration
npm run test:runner performance
```

## Coverage Configuration

### Thresholds
- **Branches**: 85%
- **Functions**: 90%
- **Lines**: 90%
- **Statements**: 90%

### Excluded Files
- Node modules
- Dist folder
- Test files
- Type definitions
- Documentation files

## Best Practices

### Test Structure
```typescript
describe('ComponentName', () => {
  let component: ComponentType;
  let mockDependency: MockType;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDependency = createMockDependency();
    component = new ComponentType(mockDependency);
  });

  describe('methodName', () => {
    it('should handle success scenario', async () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle error scenario', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Mock Management
- Use `vi.clearAllMocks()` in `beforeEach`
- Use `vi.restoreAllMocks()` in `afterEach`
- Create consistent mock factories
- Mock external dependencies completely

### Async Testing
- Always use `await` with async operations
- Use `await expect().resolves.toX()` for success cases
- Use `await expect().rejects.toThrow()` for error cases

## Troubleshooting

### Common Issues

1. **Mock not working**: Ensure mocks are cleared in `beforeEach`
2. **Async test failing**: Check for proper `await` usage
3. **Coverage too low**: Add tests for uncovered branches
4. **Test timeout**: Increase timeout in configuration
5. **Import errors**: Check TypeScript configuration

### Debug Commands

```bash
# Run single test file
npx vitest run src/path/to/test.test.ts

# Run with debug output
npm run test:debug

# Run with coverage details
npm run test:coverage -- --reporter=verbose
```

## Performance Optimization

### Configuration Optimizations
- Parallel execution for unit tests
- Sequential execution for integration/performance tests
- Optimized timeouts based on test type
- Efficient mock cleanup
- TypeScript type checking disabled during tests

### Test Optimizations
- Use appropriate test data sizes
- Mock heavy operations
- Clean up resources properly
- Use efficient assertion patterns

## Migration Notes

### From Previous Configuration
- Added comprehensive Vitest configuration
- Separated test types with different configs
- Added test validation and runner scripts
- Improved mock management
- Added coverage thresholds
- Enhanced error handling

### Breaking Changes
- Test scripts now use specific configurations
- Mock cleanup is automatic
- Console methods are mocked by default
- Environment variables are set automatically

## Maintenance

### Regular Tasks
1. Run `npm run test:validate` to check configuration
2. Review coverage reports for gaps
3. Update thresholds as codebase matures
4. Monitor test execution times
5. Update configurations as needed

### Configuration Updates
- Modify `vitest.config.ts` for unit test changes
- Update timeout values based on performance
- Adjust coverage thresholds as appropriate
- Add new test utilities as needed