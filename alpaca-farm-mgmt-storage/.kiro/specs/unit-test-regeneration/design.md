# Design Document

## Overview

This design outlines the comprehensive regeneration of unit tests for the alpaca farm management storage system. The system uses TypeScript with Vitest as the testing framework, following modern testing best practices including dependency injection, mocking, and comprehensive coverage patterns.

The existing codebase has a well-structured architecture with clear separation of concerns across services, repositories, models, controllers, and AWS integrations. The regenerated tests will maintain consistency with the current Vitest-based testing approach while ensuring comprehensive coverage and modern testing patterns.

## Architecture

### Testing Framework Stack
- **Test Runner**: Vitest (already configured)
- **Mocking**: Vitest's built-in mocking capabilities (`vi.fn()`, `vi.mocked()`)
- **Assertions**: Vitest's expect API with Jest-compatible matchers
- **Test Structure**: Describe/it pattern with proper setup/teardown

### Test Organization Structure
```
src/
├── services/__tests__/
├── models/__tests__/
├── repositories/__tests__/
├── api/controllers/__tests__/
├── aws/__tests__/
├── database/__tests__/
└── __tests__/
    ├── integration/
    └── performance/
```

### Testing Patterns
1. **Dependency Injection Mocking**: All external dependencies (repositories, AWS services) will be mocked
2. **Behavioral Testing**: Focus on testing public interfaces and business logic
3. **Error Scenario Coverage**: Comprehensive error handling and edge case testing
4. **Data-Driven Testing**: Use test data factories for consistent test objects

## Components and Interfaces

### Service Layer Tests
**Target Files**: `src/services/__tests__/*.test.ts`

**Components to Test**:
- `AlpacaService`: Registration, updates, lineage tracking, breeding compatibility
- `HealthService`: Health record management, vaccination tracking
- `BreedingService`: Breeding record management, inbreeding detection
- `ActivityService`: Management activity tracking and reporting

**Testing Approach**:
- Mock all repository dependencies
- Test business logic validation
- Verify error handling and custom exceptions
- Test complex operations like lineage calculation and breeding compatibility

### Model Layer Tests
**Target Files**: `src/models/__tests__/*.test.ts`

**Components to Test**:
- `Alpaca`: Validation rules, age calculations, breeding eligibility
- `HealthRecord`: Medical data validation, date handling
- `BreedingRecord`: Breeding data validation, relationship validation
- `ManagementActivity`: Activity type validation, scheduling logic

**Testing Approach**:
- Test validation methods and business rules
- Verify serialization/deserialization
- Test calculated properties and derived data
- Validate constraint enforcement

### Repository Layer Tests
**Target Files**: `src/repositories/__tests__/*.test.ts`

**Components to Test**:
- `PgAlpacaRepository`: CRUD operations, complex queries, lineage queries
- `PgHealthRepository`: Health record persistence, filtering
- `PgBreedingRepository`: Breeding record management, inbreeding checks
- `PgActivityRepository`: Activity tracking, reporting queries

**Testing Approach**:
- Mock database connections and query results
- Test SQL query construction and parameter binding
- Verify error handling for database failures
- Test transaction management

### API Controller Tests
**Target Files**: `src/api/controllers/__tests__/*.test.ts`

**Components to Test**:
- `AlpacaController`: HTTP endpoint handling, request validation
- `HealthController`: Health record API endpoints
- `BreedingController`: Breeding management endpoints
- `ActivityController`: Activity management endpoints

**Testing Approach**:
- Mock service layer dependencies
- Test HTTP request/response handling
- Verify input validation and error responses
- Test authentication and authorization (if applicable)

### AWS Integration Tests
**Target Files**: `src/aws/__tests__/*.test.ts`

**Components to Test**:
- `config`: Environment variable handling, AWS configuration
- `rds`: RDS connection management, SSL configuration
- `s3`: S3 operations for file storage
- `utils`: AWS utility functions and error handling

**Testing Approach**:
- Mock AWS SDK calls
- Test configuration validation
- Verify error handling for AWS service failures
- Test retry logic and connection management

### Database Layer Tests
**Target Files**: `src/database/__tests__/*.test.ts`

**Components to Test**:
- `connection`: Database connection management
- `initializer`: Database setup and initialization
- `migration`: Schema migration logic

**Testing Approach**:
- Mock database connections
- Test connection pooling and error recovery
- Verify migration script execution
- Test database initialization procedures

## Data Models

### Test Data Factories
Create consistent test data objects for reliable testing:

```typescript
// Test data factories for consistent mock objects
export const createMockAlpaca = (overrides?: Partial<Alpaca>): Alpaca => ({
  id: 'test-alpaca-1',
  name: 'Test Alpaca',
  registrationNumber: 'REG001',
  birthDate: new Date('2020-01-01'),
  gender: 'female',
  color: 'white',
  weight: 150,
  height: 90,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});
```

### Mock Repository Interfaces
Standardized mock implementations for all repository interfaces:

```typescript
// Consistent mock repository pattern
const createMockAlpacaRepository = (): AlpacaRepository => ({
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByRegistrationNumber: vi.fn(),
  findByParent: vi.fn(),
  findByGender: vi.fn(),
  getLineage: vi.fn()
});
```

## Error Handling

### Error Testing Strategy
1. **Service Layer Errors**: Test custom service exceptions and error wrapping
2. **Repository Layer Errors**: Test database error handling and connection failures
3. **API Layer Errors**: Test HTTP error responses and validation failures
4. **AWS Integration Errors**: Test cloud service failure scenarios

### Error Scenarios to Cover
- Database connection failures
- Invalid input validation
- Resource not found scenarios
- Constraint violation handling
- AWS service unavailability
- Network timeout scenarios

## Testing Strategy

### Test Categories
1. **Unit Tests**: Isolated component testing with mocked dependencies
2. **Integration Tests**: Cross-component interaction testing (existing)
3. **Performance Tests**: Load and memory testing (existing)

### Coverage Requirements
- **Line Coverage**: Minimum 90% for all modules
- **Branch Coverage**: Minimum 85% for conditional logic
- **Function Coverage**: 100% for public interfaces

### Test Execution Strategy
- **Parallel Execution**: Leverage Vitest's parallel test execution
- **Test Isolation**: Each test should be independent and repeatable
- **Fast Feedback**: Tests should execute quickly for development workflow

### Mocking Strategy
1. **External Dependencies**: Mock all external services (AWS, database)
2. **Repository Layer**: Mock repository interfaces in service tests
3. **Service Layer**: Mock service interfaces in controller tests
4. **Time-Dependent Logic**: Mock Date objects for consistent testing

### Test Structure Pattern
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

## Implementation Considerations

### Vitest Configuration
- Leverage existing Vitest configuration in package.json
- Maintain compatibility with current test scripts
- Ensure proper TypeScript integration

### Mock Management
- Use Vitest's built-in mocking capabilities
- Avoid external mocking libraries for consistency
- Implement proper mock cleanup in beforeEach/afterEach

### Test Performance
- Optimize test execution time
- Use appropriate test data sizes
- Implement efficient mock strategies

### Maintainability
- Follow consistent naming conventions
- Use descriptive test names
- Implement reusable test utilities
- Document complex test scenarios