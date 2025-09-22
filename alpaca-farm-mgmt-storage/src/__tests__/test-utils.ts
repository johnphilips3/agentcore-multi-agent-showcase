/**
 * Test utilities for consistent mock objects and test data
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { vi } from 'vitest';
import { 
  Alpaca, 
  HealthRecord, 
  BreedingRecord, 
  ManagementActivity,
  Gender,
  RecordType,
  ActivityType,
  FiberQuality
} from '../models';

/**
 * Generates a valid UUID for testing
 */
export const generateTestUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Generates a test date within a reasonable range
 */
export const generateTestDate = (yearsAgo: number = 2): Date => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - yearsAgo);
  return date;
};

/**
 * Generates a future test date
 */
export const generateFutureTestDate = (monthsFromNow: number = 6): Date => {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsFromNow);
  return date;
};

/**
 * Creates a mock Date constructor that returns a fixed date
 */
export const createMockDate = (fixedDate: Date = new Date('2024-01-01T00:00:00Z')) => {
  const MockDate = vi.fn(() => fixedDate);
  MockDate.now = vi.fn(() => fixedDate.getTime());
  MockDate.prototype = Date.prototype;
  return MockDate as any;
};

/**
 * Test data constants
 */
export const TEST_CONSTANTS = {
  ALPACA_NAMES: ['Fluffy', 'Snowball', 'Cocoa', 'Caramel', 'Pepper', 'Sugar'],
  COLORS: ['white', 'brown', 'black', 'gray', 'beige', 'fawn'],
  VETERINARIANS: ['Dr. Smith', 'Dr. Johnson', 'Dr. Williams', 'Dr. Brown'],
  PERFORMERS: ['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Cooper'],
  REGISTRATION_PREFIXES: ['REG', 'ALP', 'HRD', 'FAM']
} as const;

/**
 * Utility functions for test data generation
 */
export class TestDataUtils {
  /**
   * Generates a random registration number
   */
  static generateRegistrationNumber(): string {
    const prefix = TEST_CONSTANTS.REGISTRATION_PREFIXES[
      Math.floor(Math.random() * TEST_CONSTANTS.REGISTRATION_PREFIXES.length)
    ];
    const number = Math.floor(Math.random() * 9999) + 1;
    return `${prefix}${number.toString().padStart(4, '0')}`;
  }

  /**
   * Generates a random alpaca name
   */
  static generateAlpacaName(): string {
    return TEST_CONSTANTS.ALPACA_NAMES[
      Math.floor(Math.random() * TEST_CONSTANTS.ALPACA_NAMES.length)
    ];
  }

  /**
   * Generates a random color
   */
  static generateColor(): string {
    return TEST_CONSTANTS.COLORS[
      Math.floor(Math.random() * TEST_CONSTANTS.COLORS.length)
    ];
  }

  /**
   * Generates a random veterinarian name
   */
  static generateVeterinarianName(): string {
    return TEST_CONSTANTS.VETERINARIANS[
      Math.floor(Math.random() * TEST_CONSTANTS.VETERINARIANS.length)
    ];
  }

  /**
   * Generates a random performer name
   */
  static generatePerformerName(): string {
    return TEST_CONSTANTS.PERFORMERS[
      Math.floor(Math.random() * TEST_CONSTANTS.PERFORMERS.length)
    ];
  }

  /**
   * Generates random weight for alpaca (typical range: 120-200 lbs)
   */
  static generateWeight(): number {
    return Math.floor(Math.random() * 80) + 120;
  }

  /**
   * Generates random height for alpaca (typical range: 80-100 cm)
   */
  static generateHeight(): number {
    return Math.floor(Math.random() * 20) + 80;
  }

  /**
   * Generates random micron count for fiber (typical range: 18-30)
   */
  static generateMicronCount(): number {
    return Math.floor(Math.random() * 12) + 18;
  }

  /**
   * Generates random staple length (typical range: 3-6 inches)
   */
  static generateStapleLength(): number {
    return Math.floor(Math.random() * 3) + 3;
  }
}

/**
 * Mock cleanup utilities
 */
export class MockUtils {
  /**
   * Clears all mocks and resets their implementation
   */
  static clearAllMocks(): void {
    vi.clearAllMocks();
  }

  /**
   * Resets all mocks to their original implementation
   */
  static resetAllMocks(): void {
    vi.resetAllMocks();
  }

  /**
   * Restores all mocks to their original implementation
   */
  static restoreAllMocks(): void {
    vi.restoreAllMocks();
  }

  /**
   * Creates a mock function with optional implementation
   */
  static createMockFn<T extends (...args: any[]) => any>(
    implementation?: T
  ): ReturnType<typeof vi.fn<T>> {
    return implementation ? vi.fn(implementation) : vi.fn();
  }

  /**
   * Creates a mock object with all methods as mock functions
   */
  static createMockObject<T extends Record<string, any>>(
    methods: (keyof T)[]
  ): { [K in keyof T]: ReturnType<typeof vi.fn> } {
    const mock = {} as any;
    methods.forEach(method => {
      mock[method] = vi.fn();
    });
    return mock;
  }
}

/**
 * Assertion helpers for common test patterns
 * Note: These functions return boolean values for validation instead of throwing
 * Use them with expect() in your tests
 */
export class TestAssertions {
  /**
   * Validates that a validation result is valid
   */
  static isValidationSuccess(result: { isValid: boolean; errors: string[] }): boolean {
    return result.isValid === true && result.errors.length === 0;
  }

  /**
   * Validates that a validation result is invalid with specific errors
   */
  static isValidationFailure(
    result: { isValid: boolean; errors: string[] },
    expectedErrors?: string[]
  ): boolean {
    if (result.isValid !== false || result.errors.length === 0) {
      return false;
    }
    
    if (expectedErrors) {
      return expectedErrors.every(error => result.errors.includes(error));
    }
    
    return true;
  }

  /**
   * Validates that an object has all required properties
   */
  static hasAllProperties<T extends Record<string, any>>(
    obj: T,
    properties: (keyof T)[]
  ): boolean {
    return properties.every(prop => obj.hasOwnProperty(prop));
  }

  /**
   * Validates that a date is within a reasonable range of another date
   */
  static isDateNear(actual: Date, expected: Date, toleranceMs: number = 1000): boolean {
    const diff = Math.abs(actual.getTime() - expected.getTime());
    return diff <= toleranceMs;
  }

  /**
   * Validates that a mock function was called with specific arguments
   */
  static wasMockCalledWith<T extends (...args: any[]) => any>(
    mockFn: ReturnType<typeof vi.fn<T>>,
    ...expectedArgs: Parameters<T>
  ): boolean {
    return mockFn.mock.calls.some(call => 
      call.length === expectedArgs.length && 
      call.every((arg, index) => arg === expectedArgs[index])
    );
  }

  /**
   * Validates that a mock function was called a specific number of times
   */
  static wasMockCalledTimes<T extends (...args: any[]) => any>(
    mockFn: ReturnType<typeof vi.fn<T>>,
    times: number
  ): boolean {
    return mockFn.mock.calls.length === times;
  }
}

/**
 * Test environment setup utilities
 */
export class TestEnvironment {
  /**
   * Sets up common test environment variables
   */
  static setupTestEnv(): void {
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'test_db';
    process.env.DB_USER = 'test_user';
    process.env.DB_PASSWORD = 'test_password';
  }

  /**
   * Cleans up test environment
   */
  static cleanupTestEnv(): void {
    delete process.env.NODE_ENV;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
  }

  /**
   * Creates a test-specific console that can be mocked
   */
  static createTestConsole() {
    return {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    };
  }
}