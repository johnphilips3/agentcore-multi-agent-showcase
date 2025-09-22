/**
 * Unit tests for Alpaca model
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  AlpacaModel, 
  AlpacaValidation, 
  Alpaca, 
  CreateAlpacaInput, 
  UpdateAlpacaInput,
  FiberQuality 
} from '../alpaca';
import { Gender } from '../common';
import { 
  AlpacaFactory
} from '../../__tests__/data-factories';
import { 
  generateTestUUID, 
  generateTestDate,
  MockUtils,
  TestAssertions,
  createMockDate
} from '../../__tests__/test-utils';

describe('AlpacaModel', () => {
  let alpacaData: Alpaca;
  let alpacaModel: AlpacaModel;

  beforeEach(() => {
    MockUtils.clearAllMocks();
    alpacaData = AlpacaFactory.create();
    alpacaModel = new AlpacaModel(alpacaData);
  });

  describe('constructor', () => {
    it('should create an alpaca model with all properties', () => {
      expect(alpacaModel.id).toBe(alpacaData.id);
      expect(alpacaModel.name).toBe(alpacaData.name);
      expect(alpacaModel.registrationNumber).toBe(alpacaData.registrationNumber);
      expect(alpacaModel.birthDate).toBe(alpacaData.birthDate);
      expect(alpacaModel.gender).toBe(alpacaData.gender);
      expect(alpacaModel.color).toBe(alpacaData.color);
      expect(alpacaModel.weight).toBe(alpacaData.weight);
      expect(alpacaModel.height).toBe(alpacaData.height);
      expect(alpacaModel.fiberQuality).toBe(alpacaData.fiberQuality);
      expect(alpacaModel.sireId).toBe(alpacaData.sireId);
      expect(alpacaModel.damId).toBe(alpacaData.damId);
      expect(alpacaModel.createdAt).toBe(alpacaData.createdAt);
      expect(alpacaModel.updatedAt).toBe(alpacaData.updatedAt);
    });

    it('should create an alpaca model with minimal data', () => {
      const minimalData = AlpacaFactory.createMinimal();
      const model = new AlpacaModel(minimalData);

      expect(model.id).toBe(minimalData.id);
      expect(model.name).toBe(minimalData.name);
      expect(model.birthDate).toBe(minimalData.birthDate);
      expect(model.gender).toBe(minimalData.gender);
      expect(model.color).toBe(minimalData.color);
      expect(model.registrationNumber).toBeUndefined();
      expect(model.weight).toBeUndefined();
      expect(model.height).toBeUndefined();
      expect(model.fiberQuality).toBeUndefined();
      expect(model.sireId).toBeUndefined();
      expect(model.damId).toBeUndefined();
    });
  });

  describe('validate', () => {
    it('should return valid result for valid alpaca data', () => {
      const result = alpacaModel.validate();
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for alpaca with empty name', () => {
      alpacaModel.name = '';
      const result = alpacaModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Name is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for alpaca with future birth date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      alpacaModel.birthDate = futureDate;
      
      const result = alpacaModel.validate();
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors).toContain('Birth date must be a valid date not in the future');
    });

    it('should return invalid result for alpaca with invalid gender', () => {
      alpacaModel.gender = 'invalid' as Gender;
      const result = alpacaModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Gender must be either "male" or "female"'])).toBe(true);
    });

    it('should return invalid result for alpaca with negative weight', () => {
      alpacaModel.weight = -10;
      const result = alpacaModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Weight must be a positive number if provided'])).toBe(true);
    });

    it('should return invalid result for alpaca with invalid sire ID', () => {
      alpacaModel.sireId = 'invalid-uuid';
      const result = alpacaModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Sire ID must be a valid UUID if provided'])).toBe(true);
    });
  });

  describe('update', () => {
    it('should update alpaca with valid data and return success', () => {
      const updates: UpdateAlpacaInput = {
        name: 'Updated Name',
        weight: 180,
        height: 95
      };
      
      const result = alpacaModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(alpacaModel.name).toBe('Updated Name');
      expect(alpacaModel.weight).toBe(180);
      expect(alpacaModel.height).toBe(95);
      expect(alpacaModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should not update alpaca with invalid data and return failure', () => {
      const originalName = alpacaModel.name;
      const updates: UpdateAlpacaInput = {
        name: '',
        weight: -10
      };
      
      const result = alpacaModel.update(updates);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(alpacaModel.name).toBe(originalName); // Should not change
      expect(result.errors).toContain('Name must be non-empty if provided');
      expect(result.errors).toContain('Weight must be a positive number if provided');
    });

    it('should update updatedAt timestamp on successful update', () => {
      const originalUpdatedAt = alpacaModel.updatedAt;
      
      // Mock Date to ensure we can detect the change
      vi.setSystemTime(new Date('2024-02-01T00:00:00Z'));
      
      const updates: UpdateAlpacaInput = { name: 'New Name' };
      alpacaModel.update(updates);
      
      expect(alpacaModel.updatedAt).not.toBe(originalUpdatedAt);
      
      vi.useRealTimers();
    });
  });

  describe('getAge', () => {
    it('should calculate correct age in years', () => {
      // Mock current date to 2024-01-01
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      
      // Set birth date to 2020-01-01 (exactly 4 years ago)
      alpacaModel.birthDate = new Date('2020-01-01T00:00:00Z');
      
      const age = alpacaModel.getAge();
      
      expect(age).toBe(4);
      
      vi.useRealTimers();
    });

    it('should handle birthday not yet occurred this year', () => {
      // Mock current date to 2024-06-01
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      
      // Set birth date to 2020-12-01 (birthday hasn't occurred yet this year)
      alpacaModel.birthDate = new Date('2020-12-01T00:00:00Z');
      
      const age = alpacaModel.getAge();
      
      expect(age).toBe(3); // Should be 3, not 4
      
      vi.useRealTimers();
    });

    it('should handle same birth month but day not reached', () => {
      // Mock current date to 2024-06-15
      vi.setSystemTime(new Date('2024-06-15T00:00:00Z'));
      
      // Set birth date to 2020-06-20 (same month, but day not reached)
      alpacaModel.birthDate = new Date('2020-06-20T00:00:00Z');
      
      const age = alpacaModel.getAge();
      
      expect(age).toBe(3); // Should be 3, not 4
      
      vi.useRealTimers();
    });

    it('should handle leap year calculations', () => {
      // Mock current date to 2024-02-29 (leap year)
      vi.setSystemTime(new Date('2024-02-29T00:00:00Z'));
      
      // Set birth date to 2020-02-29 (previous leap year)
      alpacaModel.birthDate = new Date('2020-02-29T00:00:00Z');
      
      const age = alpacaModel.getAge();
      
      expect(age).toBe(4);
      
      vi.useRealTimers();
    });
  });

  describe('isBreedingAge', () => {
    it('should return true for female alpaca 18+ months old', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      
      // Set birth date to 18 months ago
      alpacaModel.birthDate = new Date('2022-07-01T00:00:00Z');
      alpacaModel.gender = 'female';
      
      const isBreedingAge = alpacaModel.isBreedingAge();
      
      expect(isBreedingAge).toBe(true);
      
      vi.useRealTimers();
    });

    it('should return false for female alpaca under 18 months old', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      
      // Set birth date to 12 months ago
      alpacaModel.birthDate = new Date('2023-01-01T00:00:00Z');
      alpacaModel.gender = 'female';
      
      const isBreedingAge = alpacaModel.isBreedingAge();
      
      expect(isBreedingAge).toBe(false);
      
      vi.useRealTimers();
    });

    it('should return true for male alpaca 24+ months old', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      
      // Set birth date to 24 months ago
      alpacaModel.birthDate = new Date('2022-01-01T00:00:00Z');
      alpacaModel.gender = 'male';
      
      const isBreedingAge = alpacaModel.isBreedingAge();
      
      expect(isBreedingAge).toBe(true);
      
      vi.useRealTimers();
    });

    it('should return false for male alpaca under 24 months old', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      
      // Set birth date to 20 months ago
      alpacaModel.birthDate = new Date('2022-05-01T00:00:00Z');
      alpacaModel.gender = 'male';
      
      const isBreedingAge = alpacaModel.isBreedingAge();
      
      expect(isBreedingAge).toBe(false);
      
      vi.useRealTimers();
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with all alpaca properties', () => {
      const json = alpacaModel.toJSON();
      
      expect(json).toEqual({
        id: alpacaModel.id,
        name: alpacaModel.name,
        registrationNumber: alpacaModel.registrationNumber,
        birthDate: alpacaModel.birthDate,
        gender: alpacaModel.gender,
        color: alpacaModel.color,
        weight: alpacaModel.weight,
        height: alpacaModel.height,
        fiberQuality: alpacaModel.fiberQuality,
        sireId: alpacaModel.sireId,
        damId: alpacaModel.damId,
        createdAt: alpacaModel.createdAt,
        updatedAt: alpacaModel.updatedAt
      });
    });

    it('should return object without methods', () => {
      const json = alpacaModel.toJSON();
      
      expect(typeof json.validate).toBe('undefined');
      expect(typeof json.update).toBe('undefined');
      expect(typeof json.getAge).toBe('undefined');
      expect(typeof json.isBreedingAge).toBe('undefined');
    });

    it('should handle undefined optional properties', () => {
      const minimalData = AlpacaFactory.createMinimal();
      const model = new AlpacaModel(minimalData);
      const json = model.toJSON();
      
      expect(json.registrationNumber).toBeUndefined();
      expect(json.weight).toBeUndefined();
      expect(json.height).toBeUndefined();
      expect(json.fiberQuality).toBeUndefined();
      expect(json.sireId).toBeUndefined();
      expect(json.damId).toBeUndefined();
    });
  });
});

describe('AlpacaValidation', () => {
  describe('validateFiberQuality', () => {
    it('should return valid result for valid fiber quality', () => {
      const fiberQuality: FiberQuality = {
        micronCount: 25,
        stapleLength: 4,
        crimp: 'fine',
        density: 'high'
      };
      
      const result = AlpacaValidation.validateFiberQuality(fiberQuality);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return valid result for undefined fiber quality', () => {
      const result = AlpacaValidation.validateFiberQuality(undefined);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for negative micron count', () => {
      const fiberQuality: FiberQuality = {
        micronCount: -5,
        stapleLength: 4,
        crimp: 'fine',
        density: 'high'
      };
      
      const result = AlpacaValidation.validateFiberQuality(fiberQuality);
      
      expect(TestAssertions.isValidationFailure(result, ['Micron count must be a positive number'])).toBe(true);
    });

    it('should return invalid result for negative staple length', () => {
      const fiberQuality: FiberQuality = {
        micronCount: 25,
        stapleLength: -2,
        crimp: 'fine',
        density: 'high'
      };
      
      const result = AlpacaValidation.validateFiberQuality(fiberQuality);
      
      expect(TestAssertions.isValidationFailure(result, ['Staple length must be a positive number'])).toBe(true);
    });

    it('should return invalid result for empty crimp string', () => {
      const fiberQuality: FiberQuality = {
        micronCount: 25,
        stapleLength: 4,
        crimp: '',
        density: 'high'
      };
      
      const result = AlpacaValidation.validateFiberQuality(fiberQuality);
      
      expect(TestAssertions.isValidationFailure(result, ['Crimp must be a non-empty string'])).toBe(true);
    });

    it('should return invalid result for empty density string', () => {
      const fiberQuality: FiberQuality = {
        micronCount: 25,
        stapleLength: 4,
        crimp: 'fine',
        density: ''
      };
      
      const result = AlpacaValidation.validateFiberQuality(fiberQuality);
      
      expect(TestAssertions.isValidationFailure(result, ['Density must be a non-empty string'])).toBe(true);
    });

    it('should handle partial fiber quality data', () => {
      const fiberQuality: FiberQuality = {
        micronCount: 25
      };
      
      const result = AlpacaValidation.validateFiberQuality(fiberQuality);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });
  });

  describe('validateCreateInput', () => {
    let validInput: CreateAlpacaInput;

    beforeEach(() => {
      validInput = AlpacaFactory.createInput();
    });

    it('should return valid result for valid create input', () => {
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty name', () => {
      validInput.name = '';
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Name is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for whitespace-only name', () => {
      validInput.name = '   ';
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Name is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for future birth date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      validInput.birthDate = futureDate;
      
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors).toContain('Birth date must be a valid date not in the future');
    });

    it('should return invalid result for invalid gender', () => {
      validInput.gender = 'unknown' as Gender;
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Gender must be either "male" or "female"'])).toBe(true);
    });

    it('should return invalid result for empty color', () => {
      validInput.color = '';
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Color is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for empty registration number', () => {
      validInput.registrationNumber = '';
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Registration number must be non-empty if provided'])).toBe(true);
    });

    it('should return invalid result for negative weight', () => {
      validInput.weight = -10;
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Weight must be a positive number if provided'])).toBe(true);
    });

    it('should return invalid result for zero weight', () => {
      validInput.weight = 0;
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Weight must be a positive number if provided'])).toBe(true);
    });

    it('should return invalid result for negative height', () => {
      validInput.height = -5;
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Height must be a positive number if provided'])).toBe(true);
    });

    it('should return invalid result for invalid sire ID', () => {
      validInput.sireId = 'invalid-uuid';
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Sire ID must be a valid UUID if provided'])).toBe(true);
    });

    it('should return invalid result for invalid dam ID', () => {
      validInput.damId = 'invalid-uuid';
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Dam ID must be a valid UUID if provided'])).toBe(true);
    });

    it('should validate fiber quality when provided', () => {
      validInput.fiberQuality = {
        micronCount: -5,
        stapleLength: 4,
        crimp: 'fine',
        density: 'high'
      };
      
      const result = AlpacaValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Micron count must be a positive number'])).toBe(true);
    });

    it('should handle minimal valid input', () => {
      const minimalInput: CreateAlpacaInput = {
        name: 'Test Alpaca',
        birthDate: generateTestDate(2),
        gender: 'male',
        color: 'white'
      };
      
      const result = AlpacaValidation.validateCreateInput(minimalInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should accumulate multiple validation errors', () => {
      const invalidInput: CreateAlpacaInput = {
        name: '',
        birthDate: new Date('2030-01-01'),
        gender: 'invalid' as Gender,
        color: '',
        weight: -10,
        height: 0,
        sireId: 'invalid',
        damId: 'invalid'
      };
      
      const result = AlpacaValidation.validateCreateInput(invalidInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(5);
    });
  });

  describe('validateUpdateInput', () => {
    it('should return valid result for valid update input', () => {
      const updateInput: UpdateAlpacaInput = {
        name: 'Updated Name',
        weight: 180,
        height: 95
      };
      
      const result = AlpacaValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return valid result for empty update input', () => {
      const updateInput: UpdateAlpacaInput = {};
      
      const result = AlpacaValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty name when provided', () => {
      const updateInput: UpdateAlpacaInput = {
        name: ''
      };
      
      const result = AlpacaValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Name must be non-empty if provided'])).toBe(true);
    });

    it('should return invalid result for future birth date when provided', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const updateInput: UpdateAlpacaInput = {
        birthDate: futureDate
      };
      
      const result = AlpacaValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors).toContain('Birth date must be a valid date not in the future if provided');
    });

    it('should return invalid result for invalid gender when provided', () => {
      const updateInput: UpdateAlpacaInput = {
        gender: 'unknown' as Gender
      };
      
      const result = AlpacaValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Gender must be either "male" or "female" if provided'])).toBe(true);
    });

    it('should validate fiber quality when provided in update', () => {
      const updateInput: UpdateAlpacaInput = {
        fiberQuality: {
          micronCount: -5
        }
      };
      
      const result = AlpacaValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Micron count must be a positive number'])).toBe(true);
    });

    it('should handle partial updates correctly', () => {
      const updateInput: UpdateAlpacaInput = {
        weight: 175
      };
      
      const result = AlpacaValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should accumulate multiple validation errors in updates', () => {
      const invalidUpdate: UpdateAlpacaInput = {
        name: '',
        weight: -10,
        height: 0,
        sireId: 'invalid',
        damId: 'invalid'
      };
      
      const result = AlpacaValidation.validateUpdateInput(invalidUpdate);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });
});