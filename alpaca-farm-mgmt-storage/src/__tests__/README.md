# Test Utilities Documentation

This directory contains shared test utilities, data factories, and mock factories for consistent testing across the alpaca farm management storage system.

## Overview

The test utilities are designed to support the unit test regeneration requirements (7.1, 7.2, 7.3, 7.4) by providing:

- Consistent mock objects and test data
- Data factories for all models (Alpaca, HealthRecord, BreedingRecord, ManagementActivity)
- Mock repository factory functions for consistent mocking patterns
- Utility functions for common test operations

## Files

### `test-utils.ts`
Core utility functions for test data generation and common test operations.

**Key Functions:**
- `generateTestUUID()` - Generates valid UUIDs for testing
- `generateTestDate(yearsAgo)` - Generates test dates in the past
- `generateFutureTestDate(monthsFromNow)` - Generates future dates
- `TestDataUtils` - Static methods for generating test data (names, weights, etc.)
- `MockUtils` - Mock management utilities
- `TestAssertions` - Helper functions for common assertions

### `data-factories.ts`
Factory classes for creating consistent test data objects.

**Available Factories:**
- `AlpacaFactory` - Creates Alpaca entities and inputs
- `HealthRecordFactory` - Creates HealthRecord entities and inputs
- `BreedingRecordFactory` - Creates BreedingRecord entities and inputs
- `ManagementActivityFactory` - Creates ManagementActivity entities and inputs
- `TestDataFactory` - Creates complex scenarios with related data

### `mock-factories.ts`
Factory classes for creating mock repository objects with consistent interfaces.

**Available Mock Factories:**
- `MockAlpacaRepositoryFactory` - Mock alpaca repository
- `MockHealthRepositoryFactory` - Mock health repository
- `MockBreedingRepositoryFactory` - Mock breeding repository
- `MockActivityRepositoryFactory` - Mock activity repository
- `MockServiceFactory` - Mock AWS and database services

### `index.ts`
Exports all utilities for easy importing in test files.

## Usage Examples

### Basic Test Setup

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  AlpacaFactory, 
  MockAlpacaRepositoryFactory,
  MockUtils,
  TestAssertions 
} from '../__tests__';

describe('AlpacaService', () => {
  let alpacaService: AlpacaService;
  let mockAlpacaRepo: MockAlpacaRepository;

  beforeEach(() => {
    MockUtils.clearAllMocks();
    mockAlpacaRepo = MockAlpacaRepositoryFactory.create();
    alpacaService = new AlpacaService(mockAlpacaRepo);
  });

  it('should create an alpaca', async () => {
    // Arrange
    const input = AlpacaFactory.createInput();
    const expectedAlpaca = AlpacaFactory.create(input);
    mockAlpacaRepo.create.mockResolvedValue(expectedAlpaca);

    // Act
    const result = await alpacaService.createAlpaca(input);

    // Assert
    expect(result).toEqual(expectedAlpaca);
    expect(TestAssertions.wasMockCalledWith(mockAlpacaRepo.create, input)).toBe(true);
  });
});
```

### Creating Test Data

```typescript
// Create a single alpaca
const alpaca = AlpacaFactory.create();

// Create alpaca with specific properties
const femaleAlpaca = AlpacaFactory.create({ gender: 'female' });

// Create minimal alpaca (only required fields)
const minimalAlpaca = AlpacaFactory.createMinimal();

// Create input for creation operations
const createInput = AlpacaFactory.createInput();

// Create multiple alpacas
const herd = AlpacaFactory.createMultiple(10);

// Create breeding pair
const { sire, dam } = AlpacaFactory.createBreedingPair();
```

### Creating Mock Repositories

```typescript
// Basic mock repository
const mockRepo = MockAlpacaRepositoryFactory.create();

// Mock repository with default successful responses
const mockRepoWithDefaults = MockAlpacaRepositoryFactory.createWithDefaults({
  alpacas: [alpaca1, alpaca2],
  defaultAlpaca: alpaca1
});

// Mock repository that throws errors
const mockRepoWithErrors = MockAlpacaRepositoryFactory.createWithErrors();
```

### Complex Test Scenarios

```typescript
// Create alpaca with related health records
const { alpaca, healthRecords } = TestDataFactory.createAlpacaWithHealthRecords(3);

// Create breeding scenario
const { sire, dam, breedingRecord } = TestDataFactory.createBreedingScenario();

// Create complete test herd
const { alpacas, healthRecords, breedingRecords, activities } = 
  TestDataFactory.createTestHerd(10);
```

### Validation Testing

```typescript
// Test successful validation
const validResult = { isValid: true, errors: [] };
expect(TestAssertions.isValidationSuccess(validResult)).toBe(true);

// Test failed validation
const invalidResult = { isValid: false, errors: ['Name is required'] };
expect(TestAssertions.isValidationFailure(invalidResult)).toBe(true);

// Test with specific error messages
expect(TestAssertions.isValidationFailure(invalidResult, ['Name is required'])).toBe(true);
```

### Mock Function Testing

```typescript
const mockFn = vi.fn();
mockFn('arg1', 'arg2');

// Check if mock was called with specific arguments
expect(TestAssertions.wasMockCalledWith(mockFn, 'arg1', 'arg2')).toBe(true);

// Check if mock was called specific number of times
expect(TestAssertions.wasMockCalledTimes(mockFn, 1)).toBe(true);
```

## Best Practices

### 1. Use Factories for Consistent Data
Always use the factory classes to create test data instead of manually constructing objects:

```typescript
// ✅ Good
const alpaca = AlpacaFactory.create();

// ❌ Avoid
const alpaca = {
  id: 'some-id',
  name: 'Test Alpaca',
  // ... manually setting all properties
};
```

### 2. Clear Mocks Between Tests
Always clear mocks in `beforeEach` to ensure test isolation:

```typescript
beforeEach(() => {
  MockUtils.clearAllMocks();
  // ... setup test dependencies
});
```

### 3. Use Appropriate Mock Factories
Choose the right mock factory method based on your test needs:

```typescript
// For basic mocking
const mockRepo = MockAlpacaRepositoryFactory.create();

// For tests that need successful responses
const mockRepo = MockAlpacaRepositoryFactory.createWithDefaults({ alpacas: testData });

// For error scenario testing
const mockRepo = MockAlpacaRepositoryFactory.createWithErrors();
```

### 4. Override Factory Defaults When Needed
Use the override parameter to customize test data for specific scenarios:

```typescript
// Create alpaca with specific birth date for age testing
const youngAlpaca = AlpacaFactory.create({ 
  birthDate: generateTestDate(0.5) // 6 months ago
});

// Create overdue health record for testing
const overdueRecord = HealthRecordFactory.create({
  nextDueDate: generateTestDate(0.1) // 1 month ago (overdue)
});
```

### 5. Use TestAssertions for Common Patterns
Leverage the TestAssertions class for common validation patterns:

```typescript
// Instead of multiple expect statements
expect(TestAssertions.isValidationSuccess(result)).toBe(true);

// Instead of checking mock calls manually
expect(TestAssertions.wasMockCalledWith(mockFn, expectedArg)).toBe(true);
```

## Testing Patterns

### Service Layer Testing
```typescript
describe('ServiceClass', () => {
  let service: ServiceClass;
  let mockRepo: MockRepository;

  beforeEach(() => {
    MockUtils.clearAllMocks();
    mockRepo = MockRepositoryFactory.createWithDefaults();
    service = new ServiceClass(mockRepo);
  });

  // Test successful operations
  // Test error scenarios
  // Test validation logic
  // Test business rules
});
```

### Model Testing
```typescript
describe('ModelClass', () => {
  let model: ModelClass;

  beforeEach(() => {
    const data = ModelFactory.create();
    model = new ModelClass(data);
  });

  // Test validation methods
  // Test business logic methods
  // Test serialization
});
```

### Repository Testing
```typescript
describe('RepositoryClass', () => {
  let repository: RepositoryClass;
  let mockDb: MockDatabase;

  beforeEach(() => {
    MockUtils.clearAllMocks();
    mockDb = MockServiceFactory.createDatabaseMock();
    repository = new RepositoryClass(mockDb);
  });

  // Test CRUD operations
  // Test query methods
  // Test error handling
});
```

This test utility system provides a solid foundation for comprehensive unit testing across the entire alpaca farm management storage system.