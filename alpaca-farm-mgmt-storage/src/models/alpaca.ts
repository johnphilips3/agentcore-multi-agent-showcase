import { BaseEntity, Gender, ValidationResult, ValidationUtils, CreateInput, UpdateInput } from './common';

/**
 * Fiber quality metrics for alpaca fleece
 */
export interface FiberQuality {
  micronCount?: number;
  stapleLength?: number;
  crimp?: string;
  density?: string;
}

/**
 * Alpaca entity representing individual animals in the herd
 * Requirements: 1.1, 1.2, 1.3
 */
export interface Alpaca extends BaseEntity {
  name: string;
  registrationNumber?: string;
  birthDate: Date;
  gender: Gender;
  color: string;
  weight?: number;
  height?: number;
  fiberQuality?: FiberQuality;
  sireId?: string;
  damId?: string;
}

/**
 * Input type for creating a new alpaca (excludes auto-generated fields)
 */
export type CreateAlpacaInput = CreateInput<Alpaca>;

/**
 * Input type for updating an alpaca (all fields optional except id)
 */
export type UpdateAlpacaInput = UpdateInput<Alpaca>;

/**
 * Alpaca model class with validation methods
 * Requirements: 1.1, 1.2, 1.3
 */
export class AlpacaModel implements Alpaca {
  id: string;
  name: string;
  registrationNumber?: string;
  birthDate: Date;
  gender: Gender;
  color: string;
  weight?: number;
  height?: number;
  fiberQuality?: FiberQuality;
  sireId?: string;
  damId?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Alpaca) {
    this.id = data.id;
    this.name = data.name;
    this.registrationNumber = data.registrationNumber;
    this.birthDate = data.birthDate;
    this.gender = data.gender;
    this.color = data.color;
    this.weight = data.weight;
    this.height = data.height;
    this.fiberQuality = data.fiberQuality;
    this.sireId = data.sireId;
    this.damId = data.damId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Validates the current alpaca instance
   */
  validate(): ValidationResult {
    return AlpacaValidation.validateCreateInput({
      name: this.name,
      registrationNumber: this.registrationNumber,
      birthDate: this.birthDate,
      gender: this.gender,
      color: this.color,
      weight: this.weight,
      height: this.height,
      fiberQuality: this.fiberQuality,
      sireId: this.sireId,
      damId: this.damId
    });
  }

  /**
   * Updates the alpaca with new data and validates
   */
  update(updates: UpdateAlpacaInput): ValidationResult {
    const validation = AlpacaValidation.validateUpdateInput(updates);
    
    if (validation.isValid) {
      Object.assign(this, updates);
      this.updatedAt = new Date();
    }
    
    return validation;
  }

  /**
   * Gets the alpaca's age in years
   */
  getAge(): number {
    const today = new Date();
    const birthYear = this.birthDate.getFullYear();
    const currentYear = today.getFullYear();
    
    let age = currentYear - birthYear;
    
    // Adjust if birthday hasn't occurred this year
    const birthMonth = this.birthDate.getMonth();
    const birthDay = this.birthDate.getDate();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    
    if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
      age--;
    }
    
    return age;
  }

  /**
   * Checks if the alpaca is a breeding age (typically 18+ months for females, 24+ months for males)
   */
  isBreedingAge(): boolean {
    const ageInMonths = this.getAgeInMonths();
    
    if (this.gender === 'female') {
      return ageInMonths >= 18;
    } else {
      return ageInMonths >= 24;
    }
  }

  /**
   * Gets the alpaca's age in months
   */
  private getAgeInMonths(): number {
    const today = new Date();
    const months = (today.getFullYear() - this.birthDate.getFullYear()) * 12;
    return months - this.birthDate.getMonth() + today.getMonth();
  }

  /**
   * Converts the alpaca to a plain object
   */
  toJSON(): Alpaca {
    return {
      id: this.id,
      name: this.name,
      registrationNumber: this.registrationNumber,
      birthDate: this.birthDate,
      gender: this.gender,
      color: this.color,
      weight: this.weight,
      height: this.height,
      fiberQuality: this.fiberQuality,
      sireId: this.sireId,
      damId: this.damId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Validation functions for Alpaca data
 */
export class AlpacaValidation {
  /**
   * Validates fiber quality data
   */
  static validateFiberQuality(fiberQuality?: FiberQuality): ValidationResult {
    const errors: string[] = [];

    if (fiberQuality) {
      if (fiberQuality.micronCount !== undefined && !ValidationUtils.isPositiveNumber(fiberQuality.micronCount)) {
        errors.push('Micron count must be a positive number');
      }
      if (fiberQuality.stapleLength !== undefined && !ValidationUtils.isPositiveNumber(fiberQuality.stapleLength)) {
        errors.push('Staple length must be a positive number');
      }
      if (fiberQuality.crimp !== undefined && !ValidationUtils.isNonEmptyString(fiberQuality.crimp)) {
        errors.push('Crimp must be a non-empty string');
      }
      if (fiberQuality.density !== undefined && !ValidationUtils.isNonEmptyString(fiberQuality.density)) {
        errors.push('Density must be a non-empty string');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates alpaca creation input
   */
  static validateCreateInput(input: CreateAlpacaInput): ValidationResult {
    const errors: string[] = [];

    // Required fields validation
    if (!ValidationUtils.isNonEmptyString(input.name)) {
      errors.push('Name is required and must be non-empty');
    }

    if (!ValidationUtils.isValidAlpacaDate(input.birthDate)) {
      errors.push('Birth date must be a valid date not in the future');
    }

    if (!ValidationUtils.isValidEnum(input.gender, ['male', 'female'])) {
      errors.push('Gender must be either "male" or "female"');
    }

    if (!ValidationUtils.isNonEmptyString(input.color)) {
      errors.push('Color is required and must be non-empty');
    }

    // Optional fields validation
    if (input.registrationNumber !== undefined && !ValidationUtils.isNonEmptyString(input.registrationNumber)) {
      errors.push('Registration number must be non-empty if provided');
    }

    if (input.weight !== undefined && !ValidationUtils.isPositiveNumber(input.weight)) {
      errors.push('Weight must be a positive number if provided');
    }

    if (input.height !== undefined && !ValidationUtils.isPositiveNumber(input.height)) {
      errors.push('Height must be a positive number if provided');
    }

    if (input.sireId !== undefined && !ValidationUtils.isValidUUID(input.sireId)) {
      errors.push('Sire ID must be a valid UUID if provided');
    }

    if (input.damId !== undefined && !ValidationUtils.isValidUUID(input.damId)) {
      errors.push('Dam ID must be a valid UUID if provided');
    }

    // Validate fiber quality if provided
    const fiberQualityValidation = this.validateFiberQuality(input.fiberQuality);
    if (!fiberQualityValidation.isValid) {
      errors.push(...fiberQualityValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates alpaca update input
   */
  static validateUpdateInput(input: UpdateAlpacaInput): ValidationResult {
    const errors: string[] = [];

    // Only validate provided fields
    if (input.name !== undefined && !ValidationUtils.isNonEmptyString(input.name)) {
      errors.push('Name must be non-empty if provided');
    }

    if (input.birthDate !== undefined && !ValidationUtils.isValidAlpacaDate(input.birthDate)) {
      errors.push('Birth date must be a valid date not in the future if provided');
    }

    if (input.gender !== undefined && !ValidationUtils.isValidEnum(input.gender, ['male', 'female'])) {
      errors.push('Gender must be either "male" or "female" if provided');
    }

    if (input.color !== undefined && !ValidationUtils.isNonEmptyString(input.color)) {
      errors.push('Color must be non-empty if provided');
    }

    if (input.registrationNumber !== undefined && !ValidationUtils.isNonEmptyString(input.registrationNumber)) {
      errors.push('Registration number must be non-empty if provided');
    }

    if (input.weight !== undefined && !ValidationUtils.isPositiveNumber(input.weight)) {
      errors.push('Weight must be a positive number if provided');
    }

    if (input.height !== undefined && !ValidationUtils.isPositiveNumber(input.height)) {
      errors.push('Height must be a positive number if provided');
    }

    if (input.sireId !== undefined && !ValidationUtils.isValidUUID(input.sireId)) {
      errors.push('Sire ID must be a valid UUID if provided');
    }

    if (input.damId !== undefined && !ValidationUtils.isValidUUID(input.damId)) {
      errors.push('Dam ID must be a valid UUID if provided');
    }

    // Validate fiber quality if provided
    if (input.fiberQuality !== undefined) {
      const fiberQualityValidation = this.validateFiberQuality(input.fiberQuality);
      if (!fiberQualityValidation.isValid) {
        errors.push(...fiberQualityValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}