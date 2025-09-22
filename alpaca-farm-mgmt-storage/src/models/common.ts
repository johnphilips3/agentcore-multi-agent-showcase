/**
 * Common types and interfaces used across the application
 */

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Gender = 'male' | 'female';

export type RecordType = 'vaccination' | 'checkup' | 'treatment' | 'medication' | 'surgery' | 'injury' | 'illness' | 'other';

export type ActivityType = 'feeding' | 'shearing' | 'weighing' | 'moving' | 'training' | 'other';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Database operation result interface
 */
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Utility type for creating entities (excludes auto-generated fields)
 */
export type CreateInput<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Utility type for updating entities (all fields optional except id)
 */
export type UpdateInput<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Utility type for database query filters
 */
export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

/**
 * Lineage tree structure for alpaca family relationships
 */
export interface LineageTree {
  alpacaId: string;
  name: string;
  generation: number;
  sire?: LineageTree;
  dam?: LineageTree;
  offspring?: LineageTree[];
}

/**
 * Common validation functions
 */
export class ValidationUtils {
  /**
   * Validates that a string is not empty or whitespace only
   */
  static isNonEmptyString(value: string | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Validates that a date is not in the future
   */
  static isNotFutureDate(date: Date): boolean {
    return date <= new Date();
  }

  /**
   * Validates that a date is within a reasonable range for alpaca records
   */
  static isValidAlpacaDate(date: Date): boolean {
    const minDate = new Date('1990-01-01'); // Reasonable minimum for alpaca records
    const maxDate = new Date();
    return date >= minDate && date <= maxDate;
  }

  /**
   * Validates that a number is positive
   */
  static isPositiveNumber(value: number | undefined): boolean {
    return typeof value === 'number' && value > 0;
  }

  /**
   * Validates that an array is not empty
   */
  static isNonEmptyArray<T>(value: T[] | undefined): boolean {
    return Array.isArray(value) && value.length > 0;
  }

  /**
   * Validates that a value is one of the allowed enum values
   */
  static isValidEnum<T>(value: T, allowedValues: T[]): boolean {
    return allowedValues.includes(value);
  }

  /**
   * Validates UUID format
   */
  static isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}