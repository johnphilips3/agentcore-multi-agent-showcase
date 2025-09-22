import { BaseEntity, RecordType, ValidationResult, ValidationUtils, CreateInput, UpdateInput } from './common';

/**
 * Health record entity for tracking medical information
 * Requirements: 2.1, 2.2, 2.3
 */
export interface HealthRecord extends BaseEntity {
  alpacaId: string;
  recordType: RecordType;
  date: Date;
  description: string;
  veterinarian?: string;
  nextDueDate?: Date;
  notes?: string;
}

/**
 * Input type for creating a new health record
 */
export type CreateHealthRecordInput = CreateInput<HealthRecord>;

/**
 * Input type for updating a health record
 */
export type UpdateHealthRecordInput = UpdateInput<HealthRecord>;

/**
 * HealthRecord model class with validation methods
 * Requirements: 2.1, 2.2, 2.3
 */
export class HealthRecordModel implements HealthRecord {
  id: string;
  alpacaId: string;
  recordType: RecordType;
  date: Date;
  description: string;
  veterinarian?: string;
  nextDueDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: HealthRecord) {
    this.id = data.id;
    this.alpacaId = data.alpacaId;
    this.recordType = data.recordType;
    this.date = data.date;
    this.description = data.description;
    this.veterinarian = data.veterinarian;
    this.nextDueDate = data.nextDueDate;
    this.notes = data.notes;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Validates the current health record instance
   */
  validate(): ValidationResult {
    return HealthRecordValidation.validateCreateInput({
      alpacaId: this.alpacaId,
      recordType: this.recordType,
      date: this.date,
      description: this.description,
      veterinarian: this.veterinarian,
      nextDueDate: this.nextDueDate,
      notes: this.notes
    });
  }

  /**
   * Updates the health record with new data and validates
   */
  update(updates: UpdateHealthRecordInput): ValidationResult {
    const validation = HealthRecordValidation.validateUpdateInput(updates);
    
    if (validation.isValid) {
      Object.assign(this, updates);
      this.updatedAt = new Date();
    }
    
    return validation;
  }

  /**
   * Checks if this health record is overdue (for vaccinations and treatments)
   */
  isOverdue(): boolean {
    if (!this.nextDueDate) {
      return false;
    }
    
    return this.nextDueDate < new Date();
  }

  /**
   * Gets the number of days until the next due date (negative if overdue)
   */
  getDaysUntilDue(): number | null {
    if (!this.nextDueDate) {
      return null;
    }
    
    const today = new Date();
    const timeDiff = this.nextDueDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  /**
   * Checks if this is a vaccination record
   */
  isVaccination(): boolean {
    return this.recordType === 'vaccination';
  }

  /**
   * Checks if this is a treatment record
   */
  isTreatment(): boolean {
    return this.recordType === 'treatment';
  }

  /**
   * Validates the relationship with an alpaca (placeholder for actual alpaca validation)
   */
  validateAlpacaRelationship(alpacaExists: boolean): ValidationResult {
    const errors: string[] = [];
    
    if (!alpacaExists) {
      errors.push(`Alpaca with ID ${this.alpacaId} does not exist`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Converts the health record to a plain object
   */
  toJSON(): HealthRecord {
    return {
      id: this.id,
      alpacaId: this.alpacaId,
      recordType: this.recordType,
      date: this.date,
      description: this.description,
      veterinarian: this.veterinarian,
      nextDueDate: this.nextDueDate,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Validation functions for HealthRecord data
 */
export class HealthRecordValidation {
  private static readonly VALID_RECORD_TYPES: RecordType[] = ['vaccination', 'checkup', 'treatment', 'medication', 'surgery', 'injury', 'illness', 'other'];

  /**
   * Validates health record creation input
   */
  static validateCreateInput(input: CreateHealthRecordInput): ValidationResult {
    const errors: string[] = [];

    // Required fields validation
    if (!ValidationUtils.isValidUUID(input.alpacaId)) {
      errors.push('Alpaca ID is required and must be a valid UUID');
    }

    if (!ValidationUtils.isValidEnum(input.recordType, this.VALID_RECORD_TYPES)) {
      errors.push(`Record type must be one of: ${this.VALID_RECORD_TYPES.join(', ')}`);
    }

    if (!ValidationUtils.isValidAlpacaDate(input.date)) {
      errors.push('Date must be a valid date not in the future');
    }

    if (!ValidationUtils.isNonEmptyString(input.description)) {
      errors.push('Description is required and must be non-empty');
    }

    // Optional fields validation
    if (input.veterinarian !== undefined && !ValidationUtils.isNonEmptyString(input.veterinarian)) {
      errors.push('Veterinarian must be non-empty if provided');
    }

    if (input.nextDueDate !== undefined) {
      // Next due date can be in the future, but should be reasonable
      const maxFutureDate = new Date();
      maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 5); // Max 5 years in future
      
      if (input.nextDueDate > maxFutureDate) {
        errors.push('Next due date cannot be more than 5 years in the future');
      }
      
      if (input.nextDueDate < input.date) {
        errors.push('Next due date cannot be before the record date');
      }
    }

    if (input.notes !== undefined && input.notes.trim().length === 0) {
      errors.push('Notes must be non-empty if provided');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates health record update input
   */
  static validateUpdateInput(input: UpdateHealthRecordInput): ValidationResult {
    const errors: string[] = [];

    // Only validate provided fields
    if (input.alpacaId !== undefined && !ValidationUtils.isValidUUID(input.alpacaId)) {
      errors.push('Alpaca ID must be a valid UUID if provided');
    }

    if (input.recordType !== undefined && !ValidationUtils.isValidEnum(input.recordType, this.VALID_RECORD_TYPES)) {
      errors.push(`Record type must be one of: ${this.VALID_RECORD_TYPES.join(', ')} if provided`);
    }

    if (input.date !== undefined && !ValidationUtils.isValidAlpacaDate(input.date)) {
      errors.push('Date must be a valid date not in the future if provided');
    }

    if (input.description !== undefined && !ValidationUtils.isNonEmptyString(input.description)) {
      errors.push('Description must be non-empty if provided');
    }

    if (input.veterinarian !== undefined && !ValidationUtils.isNonEmptyString(input.veterinarian)) {
      errors.push('Veterinarian must be non-empty if provided');
    }

    if (input.nextDueDate !== undefined) {
      const maxFutureDate = new Date();
      maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 5);
      
      if (input.nextDueDate > maxFutureDate) {
        errors.push('Next due date cannot be more than 5 years in the future if provided');
      }
    }

    if (input.notes !== undefined && input.notes.trim().length === 0) {
      errors.push('Notes must be non-empty if provided');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}