import { BaseEntity, ActivityType, ValidationResult, ValidationUtils, CreateInput, UpdateInput } from './common';

/**
 * Management activity entity for tracking herd operations
 * Requirements: 4.1, 4.2, 4.4
 */
export interface ManagementActivity extends BaseEntity {
  activityType: ActivityType;
  date: Date;
  alpacaIds: string[];
  performedBy: string;
  description: string;
  notes?: string;
}

/**
 * Input type for creating a new management activity
 */
export type CreateManagementActivityInput = CreateInput<ManagementActivity>;

/**
 * Input type for updating a management activity
 */
export type UpdateManagementActivityInput = UpdateInput<ManagementActivity>;

/**
 * ManagementActivity model class with validation methods
 * Requirements: 4.1, 4.2, 4.4
 */
export class ManagementActivityModel implements ManagementActivity {
  id: string;
  activityType: ActivityType;
  date: Date;
  alpacaIds: string[];
  performedBy: string;
  description: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: ManagementActivity) {
    this.id = data.id;
    this.activityType = data.activityType;
    this.date = data.date;
    this.alpacaIds = [...(data.alpacaIds || [])];
    this.performedBy = data.performedBy;
    this.description = data.description;
    this.notes = data.notes;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Validates the current management activity instance
   */
  validate(): ValidationResult {
    return ManagementActivityValidation.validateCreateInput({
      activityType: this.activityType,
      date: this.date,
      alpacaIds: this.alpacaIds,
      performedBy: this.performedBy,
      description: this.description,
      notes: this.notes
    });
  }

  /**
   * Updates the management activity with new data and validates
   */
  update(updates: UpdateManagementActivityInput): ValidationResult {
    const validation = ManagementActivityValidation.validateUpdateInput(updates);
    
    if (validation.isValid) {
      Object.assign(this, updates);
      // Ensure alpacaIds is copied if updated
      if (updates.alpacaIds) {
        this.alpacaIds = [...updates.alpacaIds];
      }
      this.updatedAt = new Date();
    }
    
    return validation;
  }

  /**
   * Adds an alpaca to the activity
   */
  addAlpaca(alpacaId: string): ValidationResult {
    const errors: string[] = [];
    
    if (!ValidationUtils.isValidUUID(alpacaId)) {
      errors.push('Alpaca ID must be a valid UUID');
    } else if (this.alpacaIds.includes(alpacaId)) {
      errors.push('Alpaca is already associated with this activity');
    } else {
      this.alpacaIds.push(alpacaId);
      this.updatedAt = new Date();
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Removes an alpaca from the activity
   */
  removeAlpaca(alpacaId: string): ValidationResult {
    const errors: string[] = [];
    const index = this.alpacaIds.indexOf(alpacaId);
    
    if (index === -1) {
      errors.push('Alpaca is not associated with this activity');
    } else {
      this.alpacaIds.splice(index, 1);
      
      // Ensure at least one alpaca remains
      if (this.alpacaIds.length === 0) {
        errors.push('Activity must have at least one alpaca associated');
        // Restore the removed alpaca
        this.alpacaIds.push(alpacaId);
      } else {
        this.updatedAt = new Date();
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Adds multiple alpacas to the activity (bulk operation)
   */
  addAlpacasBulk(alpacaIds: string[]): ValidationResult {
    const bulkValidation = ManagementActivityValidation.validateBulkOperation(alpacaIds);
    
    if (!bulkValidation.isValid) {
      return bulkValidation;
    }
    
    const errors: string[] = [];
    const newAlpacas: string[] = [];
    
    for (const alpacaId of alpacaIds) {
      if (this.alpacaIds.includes(alpacaId)) {
        errors.push(`Alpaca ${alpacaId} is already associated with this activity`);
      } else {
        newAlpacas.push(alpacaId);
      }
    }
    
    if (errors.length === 0) {
      this.alpacaIds.push(...newAlpacas);
      this.updatedAt = new Date();
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets the number of alpacas involved in this activity
   */
  getAlpacaCount(): number {
    return this.alpacaIds.length;
  }

  /**
   * Checks if this is a bulk activity (affects multiple alpacas)
   */
  isBulkActivity(): boolean {
    return this.alpacaIds.length > 1;
  }

  /**
   * Checks if a specific alpaca is involved in this activity
   */
  involvesAlpaca(alpacaId: string): boolean {
    return this.alpacaIds.includes(alpacaId);
  }

  /**
   * Gets the age of the activity in days
   */
  getActivityAge(): number {
    const today = new Date();
    const timeDiff = today.getTime() - this.date.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  }

  /**
   * Checks if this activity is recent (within specified days)
   */
  isRecent(days: number = 7): boolean {
    return this.getActivityAge() <= days;
  }

  /**
   * Validates that all alpacas exist (placeholder for actual alpaca validation)
   */
  validateAlpacaRelationships(existingAlpacaIds: string[]): ValidationResult {
    const errors: string[] = [];
    
    for (const alpacaId of this.alpacaIds) {
      if (!existingAlpacaIds.includes(alpacaId)) {
        errors.push(`Alpaca with ID ${alpacaId} does not exist`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets activity summary for reporting
   */
  getSummary(): string {
    const alpacaCount = this.getAlpacaCount();
    const alpacaText = alpacaCount === 1 ? 'alpaca' : 'alpacas';
    return `${this.activityType} activity for ${alpacaCount} ${alpacaText} on ${this.date.toDateString()}`;
  }

  /**
   * Converts the management activity to a plain object
   */
  toJSON(): ManagementActivity {
    return {
      id: this.id,
      activityType: this.activityType,
      date: this.date,
      alpacaIds: [...this.alpacaIds],
      performedBy: this.performedBy,
      description: this.description,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Validation functions for ManagementActivity data
 */
export class ManagementActivityValidation {
  private static readonly VALID_ACTIVITY_TYPES: ActivityType[] = [
    'feeding', 'shearing', 'weighing', 'moving', 'training', 'other'
  ];

  /**
   * Validates management activity creation input
   */
  static validateCreateInput(input: CreateManagementActivityInput): ValidationResult {
    const errors: string[] = [];

    // Required fields validation
    if (!ValidationUtils.isValidEnum(input.activityType, this.VALID_ACTIVITY_TYPES)) {
      errors.push(`Activity type must be one of: ${this.VALID_ACTIVITY_TYPES.join(', ')}`);
    }

    if (!ValidationUtils.isValidAlpacaDate(input.date)) {
      errors.push('Date must be a valid date not in the future');
    }

    if (!ValidationUtils.isNonEmptyArray(input.alpacaIds)) {
      errors.push('At least one alpaca ID is required');
    } else {
      // Validate each alpaca ID
      for (const alpacaId of input.alpacaIds) {
        if (!ValidationUtils.isValidUUID(alpacaId)) {
          errors.push(`Invalid alpaca ID: ${alpacaId}`);
        }
      }

      // Check for duplicate alpaca IDs
      const uniqueIds = new Set(input.alpacaIds);
      if (uniqueIds.size !== input.alpacaIds.length) {
        errors.push('Duplicate alpaca IDs are not allowed');
      }
    }

    if (!ValidationUtils.isNonEmptyString(input.performedBy)) {
      errors.push('Performed by is required and must be non-empty');
    }

    if (!ValidationUtils.isNonEmptyString(input.description)) {
      errors.push('Description is required and must be non-empty');
    }

    // Optional fields validation
    if (input.notes !== undefined && input.notes.trim().length === 0) {
      errors.push('Notes must be non-empty if provided');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates management activity update input
   */
  static validateUpdateInput(input: UpdateManagementActivityInput): ValidationResult {
    const errors: string[] = [];

    // Only validate provided fields
    if (input.activityType !== undefined && !ValidationUtils.isValidEnum(input.activityType, this.VALID_ACTIVITY_TYPES)) {
      errors.push(`Activity type must be one of: ${this.VALID_ACTIVITY_TYPES.join(', ')} if provided`);
    }

    if (input.date !== undefined && !ValidationUtils.isValidAlpacaDate(input.date)) {
      errors.push('Date must be a valid date not in the future if provided');
    }

    if (input.alpacaIds !== undefined) {
      if (!ValidationUtils.isNonEmptyArray(input.alpacaIds)) {
        errors.push('At least one alpaca ID is required if alpaca IDs are provided');
      } else {
        for (const alpacaId of input.alpacaIds) {
          if (!ValidationUtils.isValidUUID(alpacaId)) {
            errors.push(`Invalid alpaca ID: ${alpacaId}`);
          }
        }

        const uniqueIds = new Set(input.alpacaIds);
        if (uniqueIds.size !== input.alpacaIds.length) {
          errors.push('Duplicate alpaca IDs are not allowed');
        }
      }
    }

    if (input.performedBy !== undefined && !ValidationUtils.isNonEmptyString(input.performedBy)) {
      errors.push('Performed by must be non-empty if provided');
    }

    if (input.description !== undefined && !ValidationUtils.isNonEmptyString(input.description)) {
      errors.push('Description must be non-empty if provided');
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
   * Validates bulk operation input for activities affecting multiple alpacas
   */
  static validateBulkOperation(alpacaIds: string[], maxBulkSize: number = 100): ValidationResult {
    const errors: string[] = [];

    if (!ValidationUtils.isNonEmptyArray(alpacaIds)) {
      errors.push('At least one alpaca ID is required for bulk operations');
      return { isValid: false, errors };
    }

    if (alpacaIds.length > maxBulkSize) {
      errors.push(`Bulk operations are limited to ${maxBulkSize} alpacas at once`);
    }

    // Validate each alpaca ID
    for (const alpacaId of alpacaIds) {
      if (!ValidationUtils.isValidUUID(alpacaId)) {
        errors.push(`Invalid alpaca ID in bulk operation: ${alpacaId}`);
      }
    }

    // Check for duplicates
    const uniqueIds = new Set(alpacaIds);
    if (uniqueIds.size !== alpacaIds.length) {
      errors.push('Duplicate alpaca IDs are not allowed in bulk operations');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}