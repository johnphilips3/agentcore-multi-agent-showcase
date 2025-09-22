import { BaseEntity, ValidationResult, ValidationUtils, CreateInput, UpdateInput } from './common';

/**
 * Breeding record entity for tracking breeding activities and lineage
 * Requirements: 3.1, 3.2, 3.4
 */
export interface BreedingRecord extends BaseEntity {
  sireId: string;
  damId: string;
  breedingDate: Date;
  expectedDueDate?: Date;
  actualBirthDate?: Date;
  offspringIds: string[];
  notes?: string;
}

/**
 * Input type for creating a new breeding record
 */
export type CreateBreedingRecordInput = CreateInput<BreedingRecord>;

/**
 * Input type for updating a breeding record
 */
export type UpdateBreedingRecordInput = UpdateInput<BreedingRecord>;

/**
 * BreedingRecord model class with validation methods
 * Requirements: 3.1, 3.2, 3.4
 */
export class BreedingRecordModel implements BreedingRecord {
  id: string;
  sireId: string;
  damId: string;
  breedingDate: Date;
  expectedDueDate?: Date;
  actualBirthDate?: Date;
  offspringIds: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: BreedingRecord) {
    this.id = data.id;
    this.sireId = data.sireId;
    this.damId = data.damId;
    this.breedingDate = data.breedingDate;
    this.expectedDueDate = data.expectedDueDate;
    this.actualBirthDate = data.actualBirthDate;
    this.offspringIds = data.offspringIds || [];
    this.notes = data.notes;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Validates the current breeding record instance
   */
  validate(): ValidationResult {
    return BreedingRecordValidation.validateCreateInput({
      sireId: this.sireId,
      damId: this.damId,
      breedingDate: this.breedingDate,
      expectedDueDate: this.expectedDueDate,
      actualBirthDate: this.actualBirthDate,
      offspringIds: this.offspringIds,
      notes: this.notes
    });
  }

  /**
   * Updates the breeding record with new data and validates
   */
  update(updates: UpdateBreedingRecordInput): ValidationResult {
    const validation = BreedingRecordValidation.validateUpdateInput(updates);
    
    if (validation.isValid) {
      Object.assign(this, updates);
      this.updatedAt = new Date();
    }
    
    return validation;
  }

  /**
   * Adds an offspring to the breeding record
   */
  addOffspring(offspringId: string): ValidationResult {
    const errors: string[] = [];
    
    if (!ValidationUtils.isValidUUID(offspringId)) {
      errors.push('Offspring ID must be a valid UUID');
    } else if (this.offspringIds.includes(offspringId)) {
      errors.push('Offspring is already associated with this breeding record');
    } else {
      this.offspringIds.push(offspringId);
      this.updatedAt = new Date();
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Removes an offspring from the breeding record
   */
  removeOffspring(offspringId: string): ValidationResult {
    const errors: string[] = [];
    const index = this.offspringIds.indexOf(offspringId);
    
    if (index === -1) {
      errors.push('Offspring is not associated with this breeding record');
    } else {
      this.offspringIds.splice(index, 1);
      this.updatedAt = new Date();
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Checks if the breeding has resulted in offspring
   */
  hasOffspring(): boolean {
    return this.offspringIds.length > 0;
  }

  /**
   * Gets the number of offspring from this breeding
   */
  getOffspringCount(): number {
    return this.offspringIds.length;
  }

  /**
   * Checks if the breeding is overdue (past expected due date with no birth recorded)
   */
  isOverdue(): boolean {
    if (!this.expectedDueDate || this.actualBirthDate) {
      return false;
    }
    
    return this.expectedDueDate < new Date();
  }

  /**
   * Gets the gestation period in days (if birth date is recorded)
   */
  getGestationPeriod(): number | null {
    if (!this.actualBirthDate) {
      return null;
    }
    
    const timeDiff = this.actualBirthDate.getTime() - this.breedingDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  /**
   * Checks if the gestation period is within normal range (320-375 days for alpacas)
   */
  isNormalGestationPeriod(): boolean | null {
    const gestationDays = this.getGestationPeriod();
    
    if (gestationDays === null) {
      return null;
    }
    
    return gestationDays >= 320 && gestationDays <= 375;
  }

  /**
   * Validates genetic compatibility (placeholder for actual genetic analysis)
   */
  validateGeneticCompatibility(sireLineage?: any, damLineage?: any): ValidationResult {
    return BreedingRecordValidation.validateGeneticCompatibility(
      this.sireId, 
      this.damId, 
      { sireLineage, damLineage }
    );
  }

  /**
   * Validates that parent alpacas exist (placeholder for actual alpaca validation)
   */
  validateParentRelationships(sireExists: boolean, damExists: boolean): ValidationResult {
    const errors: string[] = [];
    
    if (!sireExists) {
      errors.push(`Sire with ID ${this.sireId} does not exist`);
    }
    
    if (!damExists) {
      errors.push(`Dam with ID ${this.damId} does not exist`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Converts the breeding record to a plain object
   */
  toJSON(): BreedingRecord {
    return {
      id: this.id,
      sireId: this.sireId,
      damId: this.damId,
      breedingDate: this.breedingDate,
      expectedDueDate: this.expectedDueDate,
      actualBirthDate: this.actualBirthDate,
      offspringIds: [...this.offspringIds],
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Validation functions for BreedingRecord data
 */
export class BreedingRecordValidation {
  /**
   * Validates breeding record creation input
   */
  static validateCreateInput(input: CreateBreedingRecordInput): ValidationResult {
    const errors: string[] = [];

    // Required fields validation
    if (!ValidationUtils.isValidUUID(input.sireId)) {
      errors.push('Sire ID is required and must be a valid UUID');
    }

    if (!ValidationUtils.isValidUUID(input.damId)) {
      errors.push('Dam ID is required and must be a valid UUID');
    }

    if (input.sireId === input.damId) {
      errors.push('Sire and dam cannot be the same alpaca');
    }

    if (!ValidationUtils.isValidAlpacaDate(input.breedingDate)) {
      errors.push('Breeding date must be a valid date not in the future');
    }

    if (!Array.isArray(input.offspringIds)) {
      errors.push('Offspring IDs must be an array');
    } else {
      // Validate each offspring ID
      for (const offspringId of input.offspringIds) {
        if (!ValidationUtils.isValidUUID(offspringId)) {
          errors.push(`Invalid offspring ID: ${offspringId}`);
        }
      }
    }

    // Optional fields validation
    if (input.expectedDueDate !== undefined) {
      // Expected due date should be after breeding date
      if (input.expectedDueDate <= input.breedingDate) {
        errors.push('Expected due date must be after breeding date');
      }

      // Alpaca gestation is approximately 11-12 months, so check reasonable range
      const minDueDate = new Date(input.breedingDate);
      minDueDate.setMonth(minDueDate.getMonth() + 10); // 10 months minimum
      const maxDueDate = new Date(input.breedingDate);
      maxDueDate.setMonth(maxDueDate.getMonth() + 13); // 13 months maximum

      if (input.expectedDueDate < minDueDate || input.expectedDueDate > maxDueDate) {
        errors.push('Expected due date should be 10-13 months after breeding date');
      }
    }

    if (input.actualBirthDate !== undefined) {
      if (input.actualBirthDate <= input.breedingDate) {
        errors.push('Actual birth date must be after breeding date');
      }

      // Birth date should not be in the future
      if (input.actualBirthDate > new Date()) {
        errors.push('Actual birth date cannot be in the future');
      }

      // Check reasonable gestation period
      const minBirthDate = new Date(input.breedingDate);
      minBirthDate.setMonth(minBirthDate.getMonth() + 10);
      const maxBirthDate = new Date(input.breedingDate);
      maxBirthDate.setMonth(maxBirthDate.getMonth() + 13);

      if (input.actualBirthDate < minBirthDate || input.actualBirthDate > maxBirthDate) {
        errors.push('Actual birth date should be 10-13 months after breeding date');
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
   * Validates breeding record update input
   */
  static validateUpdateInput(input: UpdateBreedingRecordInput): ValidationResult {
    const errors: string[] = [];

    // Only validate provided fields
    if (input.sireId !== undefined && !ValidationUtils.isValidUUID(input.sireId)) {
      errors.push('Sire ID must be a valid UUID if provided');
    }

    if (input.damId !== undefined && !ValidationUtils.isValidUUID(input.damId)) {
      errors.push('Dam ID must be a valid UUID if provided');
    }

    if (input.sireId !== undefined && input.damId !== undefined && input.sireId === input.damId) {
      errors.push('Sire and dam cannot be the same alpaca');
    }

    if (input.breedingDate !== undefined && !ValidationUtils.isValidAlpacaDate(input.breedingDate)) {
      errors.push('Breeding date must be a valid date not in the future if provided');
    }

    if (input.offspringIds !== undefined) {
      if (!Array.isArray(input.offspringIds)) {
        errors.push('Offspring IDs must be an array if provided');
      } else {
        for (const offspringId of input.offspringIds) {
          if (!ValidationUtils.isValidUUID(offspringId)) {
            errors.push(`Invalid offspring ID: ${offspringId}`);
          }
        }
      }
    }

    if (input.expectedDueDate !== undefined && input.breedingDate !== undefined) {
      if (input.expectedDueDate <= input.breedingDate) {
        errors.push('Expected due date must be after breeding date if both are provided');
      }
    }

    if (input.actualBirthDate !== undefined) {
      if (input.actualBirthDate > new Date()) {
        errors.push('Actual birth date cannot be in the future if provided');
      }

      if (input.breedingDate !== undefined && input.actualBirthDate <= input.breedingDate) {
        errors.push('Actual birth date must be after breeding date if both are provided');
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
   * Validates that two alpacas are not closely related (for inbreeding prevention)
   * This is a placeholder - actual implementation would require lineage data
   */
  static validateGeneticCompatibility(sireId: string, damId: string, lineageData?: any): ValidationResult {
    const errors: string[] = [];

    // Basic validation - same alpaca cannot breed with itself
    if (sireId === damId) {
      errors.push('An alpaca cannot breed with itself');
    }

    // TODO: Implement actual genetic relationship checking when lineage data is available
    // This would check for parent-child, sibling, and close cousin relationships

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}