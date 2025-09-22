/**
 * Unit tests for BreedingRecord model
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  BreedingRecordModel, 
  BreedingRecordValidation, 
  BreedingRecord, 
  CreateBreedingRecordInput, 
  UpdateBreedingRecordInput 
} from '../breeding-record';
import { 
  BreedingRecordFactory
} from '../../__tests__/data-factories';
import { 
  generateTestUUID, 
  generateTestDate,
  MockUtils,
  TestAssertions,
  createMockDate
} from '../../__tests__/test-utils';

describe('BreedingRecordModel', () => {
  let breedingRecordData: BreedingRecord;
  let breedingRecordModel: BreedingRecordModel;

  beforeEach(() => {
    MockUtils.clearAllMocks();
    breedingRecordData = BreedingRecordFactory.create();
    breedingRecordModel = new BreedingRecordModel(breedingRecordData);
  });

  describe('constructor', () => {
    it('should create a breeding record model with all properties', () => {
      expect(breedingRecordModel.id).toBe(breedingRecordData.id);
      expect(breedingRecordModel.sireId).toBe(breedingRecordData.sireId);
      expect(breedingRecordModel.damId).toBe(breedingRecordData.damId);
      expect(breedingRecordModel.breedingDate).toBe(breedingRecordData.breedingDate);
      expect(breedingRecordModel.expectedDueDate).toBe(breedingRecordData.expectedDueDate);
      expect(breedingRecordModel.actualBirthDate).toBe(breedingRecordData.actualBirthDate);
      expect(breedingRecordModel.offspringIds).toEqual(breedingRecordData.offspringIds);
      expect(breedingRecordModel.notes).toBe(breedingRecordData.notes);
      expect(breedingRecordModel.createdAt).toBe(breedingRecordData.createdAt);
      expect(breedingRecordModel.updatedAt).toBe(breedingRecordData.updatedAt);
    });

    it('should initialize empty offspring array when not provided', () => {
      const dataWithoutOffspring = { ...breedingRecordData, offspringIds: undefined };
      const model = new BreedingRecordModel(dataWithoutOffspring as BreedingRecord);

      expect(model.offspringIds).toEqual([]);
    });

    it('should handle offspring array correctly', () => {
      const originalOffspring = ['offspring1', 'offspring2'];
      const dataWithOffspring = { ...breedingRecordData, offspringIds: originalOffspring };
      const model = new BreedingRecordModel(dataWithOffspring);

      expect(model.offspringIds).toEqual(originalOffspring);
      expect(model.offspringIds).toBe(originalOffspring); // Uses the same reference
    });

    it('should handle optional fields when undefined', () => {
      const minimalData = {
        ...breedingRecordData,
        expectedDueDate: undefined,
        actualBirthDate: undefined,
        notes: undefined
      };
      const model = new BreedingRecordModel(minimalData);

      expect(model.expectedDueDate).toBeUndefined();
      expect(model.actualBirthDate).toBeUndefined();
      expect(model.notes).toBeUndefined();
    });
  });

  describe('validate', () => {
    it('should return valid result for valid breeding record data', () => {
      const result = breedingRecordModel.validate();
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for breeding record with invalid sire ID', () => {
      breedingRecordModel.sireId = 'invalid-uuid';
      const result = breedingRecordModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Sire ID is required and must be a valid UUID'])).toBe(true);
    });

    it('should return invalid result for breeding record with invalid dam ID', () => {
      breedingRecordModel.damId = 'invalid-uuid';
      const result = breedingRecordModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Dam ID is required and must be a valid UUID'])).toBe(true);
    });

    it('should return invalid result when sire and dam are the same', () => {
      const sameId = generateTestUUID();
      breedingRecordModel.sireId = sameId;
      breedingRecordModel.damId = sameId;
      
      const result = breedingRecordModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Sire and dam cannot be the same alpaca'])).toBe(true);
    });

    it('should return invalid result for future breeding date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      breedingRecordModel.breedingDate = futureDate;
      
      const result = breedingRecordModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Breeding date must be a valid date not in the future'])).toBe(true);
    });

    it('should return invalid result for invalid offspring IDs', () => {
      breedingRecordModel.offspringIds = ['valid-uuid', 'invalid-uuid'];
      const result = breedingRecordModel.validate();
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.some(error => error.includes('Invalid offspring ID: invalid-uuid'))).toBe(true);
    });
  });

  describe('update', () => {
    it('should update breeding record with valid data and return success', () => {
      const updates: UpdateBreedingRecordInput = {
        notes: 'Updated notes',
        actualBirthDate: new Date('2024-01-15')
      };
      
      const result = breedingRecordModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(breedingRecordModel.notes).toBe('Updated notes');
      expect(breedingRecordModel.actualBirthDate).toEqual(new Date('2024-01-15'));
      expect(breedingRecordModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should not update breeding record with invalid data and return failure', () => {
      const originalNotes = breedingRecordModel.notes;
      const updates: UpdateBreedingRecordInput = {
        sireId: 'invalid-uuid',
        notes: ''
      };
      
      const result = breedingRecordModel.update(updates);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(breedingRecordModel.notes).toBe(originalNotes); // Should not change
      expect(result.errors).toContain('Sire ID must be a valid UUID if provided');
      expect(result.errors).toContain('Notes must be non-empty if provided');
    });

    it('should update updatedAt timestamp on successful update', () => {
      const originalUpdatedAt = breedingRecordModel.updatedAt;
      
      // Mock Date to ensure we can detect the change
      vi.setSystemTime(new Date('2024-02-01T00:00:00Z'));
      
      const updates: UpdateBreedingRecordInput = { notes: 'New notes' };
      breedingRecordModel.update(updates);
      
      expect(breedingRecordModel.updatedAt).not.toBe(originalUpdatedAt);
      
      vi.useRealTimers();
    });

    it('should handle partial updates correctly', () => {
      const originalSireId = breedingRecordModel.sireId;
      const updates: UpdateBreedingRecordInput = {
        notes: 'Only updating notes'
      };
      
      const result = breedingRecordModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(breedingRecordModel.notes).toBe('Only updating notes');
      expect(breedingRecordModel.sireId).toBe(originalSireId); // Should remain unchanged
    });
  });

  describe('addOffspring', () => {
    it('should add valid offspring ID successfully', () => {
      const offspringId = generateTestUUID();
      const result = breedingRecordModel.addOffspring(offspringId);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(breedingRecordModel.offspringIds).toContain(offspringId);
      expect(breedingRecordModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should return error for invalid offspring ID', () => {
      const result = breedingRecordModel.addOffspring('invalid-uuid');
      
      expect(TestAssertions.isValidationFailure(result, ['Offspring ID must be a valid UUID'])).toBe(true);
      expect(breedingRecordModel.offspringIds).not.toContain('invalid-uuid');
    });

    it('should return error when adding duplicate offspring', () => {
      const offspringId = generateTestUUID();
      breedingRecordModel.offspringIds = [offspringId];
      
      const result = breedingRecordModel.addOffspring(offspringId);
      
      expect(TestAssertions.isValidationFailure(result, ['Offspring is already associated with this breeding record'])).toBe(true);
      expect(breedingRecordModel.offspringIds.filter(id => id === offspringId)).toHaveLength(1);
    });

    it('should update updatedAt timestamp when adding offspring', () => {
      const originalUpdatedAt = breedingRecordModel.updatedAt;
      vi.setSystemTime(new Date('2024-02-01T00:00:00Z'));
      
      const offspringId = generateTestUUID();
      breedingRecordModel.addOffspring(offspringId);
      
      expect(breedingRecordModel.updatedAt).not.toBe(originalUpdatedAt);
      
      vi.useRealTimers();
    });
  });

  describe('removeOffspring', () => {
    it('should remove existing offspring ID successfully', () => {
      const offspringId = generateTestUUID();
      breedingRecordModel.offspringIds = [offspringId];
      
      const result = breedingRecordModel.removeOffspring(offspringId);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(breedingRecordModel.offspringIds).not.toContain(offspringId);
      expect(breedingRecordModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should return error when removing non-existent offspring', () => {
      const offspringId = generateTestUUID();
      
      const result = breedingRecordModel.removeOffspring(offspringId);
      
      expect(TestAssertions.isValidationFailure(result, ['Offspring is not associated with this breeding record'])).toBe(true);
    });

    it('should remove only the specified offspring when multiple exist', () => {
      const offspring1 = generateTestUUID();
      const offspring2 = generateTestUUID();
      breedingRecordModel.offspringIds = [offspring1, offspring2];
      
      const result = breedingRecordModel.removeOffspring(offspring1);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(breedingRecordModel.offspringIds).toEqual([offspring2]);
    });

    it('should update updatedAt timestamp when removing offspring', () => {
      const offspringId = generateTestUUID();
      breedingRecordModel.offspringIds = [offspringId];
      const originalUpdatedAt = breedingRecordModel.updatedAt;
      
      vi.setSystemTime(new Date('2024-02-01T00:00:00Z'));
      
      breedingRecordModel.removeOffspring(offspringId);
      
      expect(breedingRecordModel.updatedAt).not.toBe(originalUpdatedAt);
      
      vi.useRealTimers();
    });
  });

  describe('hasOffspring', () => {
    it('should return true when offspring exist', () => {
      breedingRecordModel.offspringIds = [generateTestUUID()];
      
      const hasOffspring = breedingRecordModel.hasOffspring();
      
      expect(hasOffspring).toBe(true);
    });

    it('should return false when no offspring exist', () => {
      breedingRecordModel.offspringIds = [];
      
      const hasOffspring = breedingRecordModel.hasOffspring();
      
      expect(hasOffspring).toBe(false);
    });

    it('should return true when multiple offspring exist', () => {
      breedingRecordModel.offspringIds = [generateTestUUID(), generateTestUUID()];
      
      const hasOffspring = breedingRecordModel.hasOffspring();
      
      expect(hasOffspring).toBe(true);
    });
  });

  describe('getOffspringCount', () => {
    it('should return correct count of offspring', () => {
      const offspringIds = [generateTestUUID(), generateTestUUID(), generateTestUUID()];
      breedingRecordModel.offspringIds = offspringIds;
      
      const count = breedingRecordModel.getOffspringCount();
      
      expect(count).toBe(3);
    });

    it('should return 0 when no offspring exist', () => {
      breedingRecordModel.offspringIds = [];
      
      const count = breedingRecordModel.getOffspringCount();
      
      expect(count).toBe(0);
    });

    it('should return 1 for single offspring', () => {
      breedingRecordModel.offspringIds = [generateTestUUID()];
      
      const count = breedingRecordModel.getOffspringCount();
      
      expect(count).toBe(1);
    });
  });

  describe('isOverdue', () => {
    it('should return false when no expected due date is set', () => {
      breedingRecordModel.expectedDueDate = undefined;
      
      const isOverdue = breedingRecordModel.isOverdue();
      
      expect(isOverdue).toBe(false);
    });

    it('should return false when actual birth date is recorded', () => {
      breedingRecordModel.expectedDueDate = new Date('2023-01-01');
      breedingRecordModel.actualBirthDate = new Date('2023-01-15');
      
      const isOverdue = breedingRecordModel.isOverdue();
      
      expect(isOverdue).toBe(false);
    });

    it('should return true when expected due date is past and no birth recorded', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      breedingRecordModel.expectedDueDate = pastDate;
      breedingRecordModel.actualBirthDate = undefined;
      
      const isOverdue = breedingRecordModel.isOverdue();
      
      expect(isOverdue).toBe(true);
    });

    it('should return false when expected due date is in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      breedingRecordModel.expectedDueDate = futureDate;
      breedingRecordModel.actualBirthDate = undefined;
      
      const isOverdue = breedingRecordModel.isOverdue();
      
      expect(isOverdue).toBe(false);
    });

    it('should return false when expected due date is today and no birth recorded', () => {
      const today = new Date();
      breedingRecordModel.expectedDueDate = today;
      breedingRecordModel.actualBirthDate = undefined;
      
      const isOverdue = breedingRecordModel.isOverdue();
      
      expect(isOverdue).toBe(false);
    });
  });

  describe('getGestationPeriod', () => {
    it('should return null when no actual birth date is recorded', () => {
      breedingRecordModel.actualBirthDate = undefined;
      
      const gestationPeriod = breedingRecordModel.getGestationPeriod();
      
      expect(gestationPeriod).toBeNull();
    });

    it('should calculate correct gestation period in days', () => {
      breedingRecordModel.breedingDate = new Date('2023-01-01');
      breedingRecordModel.actualBirthDate = new Date('2023-12-01'); // 334 days later
      
      const gestationPeriod = breedingRecordModel.getGestationPeriod();
      
      expect(gestationPeriod).toBe(334);
    });

    it('should handle same-day breeding and birth', () => {
      const sameDate = new Date('2023-01-01');
      breedingRecordModel.breedingDate = sameDate;
      breedingRecordModel.actualBirthDate = sameDate;
      
      const gestationPeriod = breedingRecordModel.getGestationPeriod();
      
      expect(gestationPeriod).toBe(0);
    });

    it('should handle leap year calculations', () => {
      breedingRecordModel.breedingDate = new Date('2020-01-01'); // Leap year
      breedingRecordModel.actualBirthDate = new Date('2020-12-31'); // 365 days later (leap year)
      
      const gestationPeriod = breedingRecordModel.getGestationPeriod();
      
      expect(gestationPeriod).toBe(365);
    });

    it('should round up partial days', () => {
      breedingRecordModel.breedingDate = new Date('2023-01-01T00:00:00');
      breedingRecordModel.actualBirthDate = new Date('2023-01-01T12:00:00'); // 0.5 days later
      
      const gestationPeriod = breedingRecordModel.getGestationPeriod();
      
      expect(gestationPeriod).toBe(1); // Should round up to 1 day
    });
  });

  describe('isNormalGestationPeriod', () => {
    it('should return null when no actual birth date is recorded', () => {
      breedingRecordModel.actualBirthDate = undefined;
      
      const isNormal = breedingRecordModel.isNormalGestationPeriod();
      
      expect(isNormal).toBeNull();
    });

    it('should return true for normal gestation period (320-375 days)', () => {
      breedingRecordModel.breedingDate = new Date('2023-01-01');
      breedingRecordModel.actualBirthDate = new Date('2023-11-20'); // ~323 days
      
      const isNormal = breedingRecordModel.isNormalGestationPeriod();
      
      expect(isNormal).toBe(true);
    });

    it('should return false for short gestation period (under 320 days)', () => {
      breedingRecordModel.breedingDate = new Date('2023-01-01');
      breedingRecordModel.actualBirthDate = new Date('2023-10-01'); // ~273 days
      
      const isNormal = breedingRecordModel.isNormalGestationPeriod();
      
      expect(isNormal).toBe(false);
    });

    it('should return false for long gestation period (over 375 days)', () => {
      breedingRecordModel.breedingDate = new Date('2023-01-01');
      breedingRecordModel.actualBirthDate = new Date('2024-02-15'); // ~410 days
      
      const isNormal = breedingRecordModel.isNormalGestationPeriod();
      
      expect(isNormal).toBe(false);
    });

    it('should return true for boundary values', () => {
      // Test 320 days (minimum normal)
      breedingRecordModel.breedingDate = new Date('2023-01-01');
      breedingRecordModel.actualBirthDate = new Date('2023-11-17'); // 320 days
      
      let isNormal = breedingRecordModel.isNormalGestationPeriod();
      expect(isNormal).toBe(true);

      // Test 375 days (maximum normal)
      breedingRecordModel.actualBirthDate = new Date('2024-01-11'); // 375 days
      isNormal = breedingRecordModel.isNormalGestationPeriod();
      expect(isNormal).toBe(true);
    });

    it('should return false for boundary edge cases', () => {
      // Test 319 days (just under minimum)
      breedingRecordModel.breedingDate = new Date('2023-01-01');
      breedingRecordModel.actualBirthDate = new Date('2023-11-16'); // 319 days
      
      let isNormal = breedingRecordModel.isNormalGestationPeriod();
      expect(isNormal).toBe(false);

      // Test 376 days (just over maximum)
      breedingRecordModel.actualBirthDate = new Date('2024-01-12'); // 376 days
      isNormal = breedingRecordModel.isNormalGestationPeriod();
      expect(isNormal).toBe(false);
    });
  });

  describe('validateGeneticCompatibility', () => {
    it('should return valid result for different alpacas', () => {
      const result = breedingRecordModel.validateGeneticCompatibility();
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should handle lineage data when provided', () => {
      const sireLineage = { id: breedingRecordModel.sireId, parents: [] };
      const damLineage = { id: breedingRecordModel.damId, parents: [] };
      
      const result = breedingRecordModel.validateGeneticCompatibility(sireLineage, damLineage);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result when sire and dam are the same', () => {
      const sameId = generateTestUUID();
      breedingRecordModel.sireId = sameId;
      breedingRecordModel.damId = sameId;
      
      const result = breedingRecordModel.validateGeneticCompatibility();
      
      expect(TestAssertions.isValidationFailure(result, ['An alpaca cannot breed with itself'])).toBe(true);
    });

    it('should handle undefined lineage data gracefully', () => {
      const result = breedingRecordModel.validateGeneticCompatibility(undefined, undefined);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });
  });

  describe('validateParentRelationships', () => {
    it('should return valid result when both parents exist', () => {
      const result = breedingRecordModel.validateParentRelationships(true, true);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result when sire does not exist', () => {
      const result = breedingRecordModel.validateParentRelationships(false, true);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain(`Sire with ID ${breedingRecordModel.sireId} does not exist`);
    });

    it('should return invalid result when dam does not exist', () => {
      const result = breedingRecordModel.validateParentRelationships(true, false);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain(`Dam with ID ${breedingRecordModel.damId} does not exist`);
    });

    it('should return invalid result when both parents do not exist', () => {
      const result = breedingRecordModel.validateParentRelationships(false, false);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain(`Sire with ID ${breedingRecordModel.sireId} does not exist`);
      expect(result.errors[1]).toContain(`Dam with ID ${breedingRecordModel.damId} does not exist`);
    });

    it('should include correct alpaca IDs in error messages', () => {
      const customSireId = generateTestUUID();
      const customDamId = generateTestUUID();
      breedingRecordModel.sireId = customSireId;
      breedingRecordModel.damId = customDamId;
      
      const result = breedingRecordModel.validateParentRelationships(false, false);
      
      expect(result.errors[0]).toContain(customSireId);
      expect(result.errors[1]).toContain(customDamId);
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with all breeding record properties', () => {
      const json = breedingRecordModel.toJSON();
      
      expect(json).toEqual({
        id: breedingRecordModel.id,
        sireId: breedingRecordModel.sireId,
        damId: breedingRecordModel.damId,
        breedingDate: breedingRecordModel.breedingDate,
        expectedDueDate: breedingRecordModel.expectedDueDate,
        actualBirthDate: breedingRecordModel.actualBirthDate,
        offspringIds: breedingRecordModel.offspringIds,
        notes: breedingRecordModel.notes,
        createdAt: breedingRecordModel.createdAt,
        updatedAt: breedingRecordModel.updatedAt
      });
    });

    it('should return object without methods', () => {
      const json = breedingRecordModel.toJSON();
      
      expect(typeof json.validate).toBe('undefined');
      expect(typeof json.update).toBe('undefined');
      expect(typeof json.addOffspring).toBe('undefined');
      expect(typeof json.removeOffspring).toBe('undefined');
      expect(typeof json.hasOffspring).toBe('undefined');
      expect(typeof json.getOffspringCount).toBe('undefined');
      expect(typeof json.isOverdue).toBe('undefined');
      expect(typeof json.getGestationPeriod).toBe('undefined');
      expect(typeof json.isNormalGestationPeriod).toBe('undefined');
    });

    it('should create a copy of offspring array to prevent mutation', () => {
      const json = breedingRecordModel.toJSON();
      
      expect(json.offspringIds).toEqual(breedingRecordModel.offspringIds);
      expect(json.offspringIds).not.toBe(breedingRecordModel.offspringIds); // Should be a copy
    });

    it('should handle undefined optional properties', () => {
      breedingRecordModel.expectedDueDate = undefined;
      breedingRecordModel.actualBirthDate = undefined;
      breedingRecordModel.notes = undefined;
      
      const json = breedingRecordModel.toJSON();
      
      expect(json.expectedDueDate).toBeUndefined();
      expect(json.actualBirthDate).toBeUndefined();
      expect(json.notes).toBeUndefined();
    });

    it('should preserve date objects correctly', () => {
      const json = breedingRecordModel.toJSON();
      
      expect(json.breedingDate).toBeInstanceOf(Date);
      expect(json.createdAt).toBeInstanceOf(Date);
      expect(json.updatedAt).toBeInstanceOf(Date);
      if (json.expectedDueDate) {
        expect(json.expectedDueDate).toBeInstanceOf(Date);
      }
      if (json.actualBirthDate) {
        expect(json.actualBirthDate).toBeInstanceOf(Date);
      }
    });
  });
});

describe('BreedingRecordValidation', () => {
  describe('validateCreateInput', () => {
    let validInput: CreateBreedingRecordInput;

    beforeEach(() => {
      validInput = BreedingRecordFactory.createInput();
    });

    it('should return valid result for valid create input', () => {
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for invalid sire ID', () => {
      validInput.sireId = 'invalid-uuid';
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Sire ID is required and must be a valid UUID'])).toBe(true);
    });

    it('should return invalid result for missing sire ID', () => {
      validInput.sireId = '' as any;
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Sire ID is required and must be a valid UUID'])).toBe(true);
    });

    it('should return invalid result for invalid dam ID', () => {
      validInput.damId = 'invalid-uuid';
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Dam ID is required and must be a valid UUID'])).toBe(true);
    });

    it('should return invalid result for missing dam ID', () => {
      validInput.damId = '' as any;
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Dam ID is required and must be a valid UUID'])).toBe(true);
    });

    it('should return invalid result when sire and dam are the same', () => {
      const sameId = generateTestUUID();
      validInput.sireId = sameId;
      validInput.damId = sameId;
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Sire and dam cannot be the same alpaca'])).toBe(true);
    });

    it('should return invalid result for future breeding date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      validInput.breedingDate = futureDate;
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Breeding date must be a valid date not in the future'])).toBe(true);
    });

    it('should return invalid result for very old breeding date', () => {
      validInput.breedingDate = new Date('1980-01-01');
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Breeding date must be a valid date not in the future'])).toBe(true);
    });

    it('should return invalid result for non-array offspring IDs', () => {
      validInput.offspringIds = 'not-an-array' as any;
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Offspring IDs must be an array'])).toBe(true);
    });

    it('should return invalid result for invalid offspring ID in array', () => {
      validInput.offspringIds = [generateTestUUID(), 'invalid-uuid'];
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.some(error => error.includes('Invalid offspring ID: invalid-uuid'))).toBe(true);
    });

    it('should accept empty offspring array', () => {
      validInput.offspringIds = [];
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for expected due date before breeding date', () => {
      validInput.breedingDate = new Date('2023-06-01');
      validInput.expectedDueDate = new Date('2023-05-01'); // Before breeding date
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Expected due date must be after breeding date'])).toBe(true);
    });

    it('should return invalid result for expected due date too soon after breeding', () => {
      validInput.breedingDate = new Date('2023-01-01');
      validInput.expectedDueDate = new Date('2023-05-01'); // Only 4 months later
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Expected due date should be 10-13 months after breeding date'])).toBe(true);
    });

    it('should return invalid result for expected due date too late after breeding', () => {
      validInput.breedingDate = new Date('2023-01-01');
      validInput.expectedDueDate = new Date('2024-06-01'); // 17 months later
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Expected due date should be 10-13 months after breeding date'])).toBe(true);
    });

    it('should accept valid expected due date range', () => {
      validInput.breedingDate = new Date('2023-01-01');
      validInput.expectedDueDate = new Date('2023-12-01'); // 11 months later
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for actual birth date before breeding date', () => {
      validInput.breedingDate = new Date('2023-06-01');
      validInput.actualBirthDate = new Date('2023-05-01'); // Before breeding date
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Actual birth date must be after breeding date'])).toBe(true);
    });

    it('should return invalid result for actual birth date in the future', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      validInput.actualBirthDate = futureDate;
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Actual birth date cannot be in the future'])).toBe(true);
    });

    it('should return invalid result for actual birth date outside normal gestation range', () => {
      validInput.breedingDate = new Date('2023-01-01');
      validInput.actualBirthDate = new Date('2023-05-01'); // Only 4 months later
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Actual birth date should be 10-13 months after breeding date'])).toBe(true);
    });

    it('should accept valid actual birth date', () => {
      validInput.breedingDate = new Date('2023-01-01');
      validInput.actualBirthDate = new Date('2023-11-15'); // ~10.5 months later
      validInput.expectedDueDate = undefined; // Remove expected due date to avoid conflicts
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty notes when provided', () => {
      validInput.notes = '   ';
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Notes must be non-empty if provided'])).toBe(true);
    });

    it('should accept undefined notes', () => {
      validInput.notes = undefined;
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should accept valid notes', () => {
      validInput.notes = 'Valid breeding notes';
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should handle minimal valid input', () => {
      const minimalInput: CreateBreedingRecordInput = {
        sireId: generateTestUUID(),
        damId: generateTestUUID(),
        breedingDate: generateTestDate(0.1),
        offspringIds: []
      };
      
      const result = BreedingRecordValidation.validateCreateInput(minimalInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should accumulate multiple validation errors', () => {
      const invalidInput: CreateBreedingRecordInput = {
        sireId: 'invalid',
        damId: 'invalid',
        breedingDate: new Date('2030-01-01'),
        offspringIds: ['invalid-offspring'],
        notes: '   '
      };
      
      const result = BreedingRecordValidation.validateCreateInput(invalidInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(4);
    });

    it('should validate multiple invalid offspring IDs', () => {
      validInput.offspringIds = ['invalid1', 'invalid2', generateTestUUID()];
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.some(error => error.includes('Invalid offspring ID: invalid1'))).toBe(true);
      expect(result.errors.some(error => error.includes('Invalid offspring ID: invalid2'))).toBe(true);
    });
  });

  describe('validateUpdateInput', () => {
    it('should return valid result for valid update input', () => {
      const updateInput: UpdateBreedingRecordInput = {
        notes: 'Updated notes',
        actualBirthDate: generateTestDate(0.5)
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return valid result for empty update input', () => {
      const updateInput: UpdateBreedingRecordInput = {};
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for invalid sire ID when provided', () => {
      const updateInput: UpdateBreedingRecordInput = {
        sireId: 'invalid-uuid'
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Sire ID must be a valid UUID if provided'])).toBe(true);
    });

    it('should return invalid result for invalid dam ID when provided', () => {
      const updateInput: UpdateBreedingRecordInput = {
        damId: 'invalid-uuid'
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Dam ID must be a valid UUID if provided'])).toBe(true);
    });

    it('should return invalid result when sire and dam are the same in update', () => {
      const sameId = generateTestUUID();
      const updateInput: UpdateBreedingRecordInput = {
        sireId: sameId,
        damId: sameId
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Sire and dam cannot be the same alpaca'])).toBe(true);
    });

    it('should allow updating only sire ID', () => {
      const updateInput: UpdateBreedingRecordInput = {
        sireId: generateTestUUID()
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should allow updating only dam ID', () => {
      const updateInput: UpdateBreedingRecordInput = {
        damId: generateTestUUID()
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for future breeding date when provided', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const updateInput: UpdateBreedingRecordInput = {
        breedingDate: futureDate
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Breeding date must be a valid date not in the future if provided'])).toBe(true);
    });

    it('should return invalid result for non-array offspring IDs when provided', () => {
      const updateInput: UpdateBreedingRecordInput = {
        offspringIds: 'not-an-array' as any
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Offspring IDs must be an array if provided'])).toBe(true);
    });

    it('should return invalid result for invalid offspring IDs in update', () => {
      const updateInput: UpdateBreedingRecordInput = {
        offspringIds: [generateTestUUID(), 'invalid-uuid']
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.some(error => error.includes('Invalid offspring ID: invalid-uuid'))).toBe(true);
    });

    it('should return invalid result for future actual birth date when provided', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const updateInput: UpdateBreedingRecordInput = {
        actualBirthDate: futureDate
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Actual birth date cannot be in the future if provided'])).toBe(true);
    });

    it('should validate relationship between breeding date and actual birth date in update', () => {
      const updateInput: UpdateBreedingRecordInput = {
        breedingDate: new Date('2023-06-01'),
        actualBirthDate: new Date('2023-05-01') // Before breeding date
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Actual birth date must be after breeding date if both are provided'])).toBe(true);
    });

    it('should allow valid breeding and birth date combination in update', () => {
      const updateInput: UpdateBreedingRecordInput = {
        breedingDate: new Date('2023-01-01'),
        actualBirthDate: new Date('2023-12-01')
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty notes when provided', () => {
      const updateInput: UpdateBreedingRecordInput = {
        notes: '   '
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Notes must be non-empty if provided'])).toBe(true);
    });

    it('should handle partial updates correctly', () => {
      const updateInput: UpdateBreedingRecordInput = {
        notes: 'Updated notes only'
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should validate expected due date relationship when both dates provided', () => {
      const updateInput: UpdateBreedingRecordInput = {
        breedingDate: new Date('2023-01-01'),
        expectedDueDate: new Date('2022-12-01') // Before breeding date
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Expected due date must be after breeding date if both are provided'])).toBe(true);
    });

    it('should allow updating only expected due date', () => {
      const updateInput: UpdateBreedingRecordInput = {
        expectedDueDate: new Date('2024-01-01')
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should accumulate multiple validation errors in update', () => {
      const updateInput: UpdateBreedingRecordInput = {
        sireId: 'invalid',
        damId: 'invalid',
        breedingDate: new Date('2030-01-01'),
        notes: '   '
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe('validateGeneticCompatibility', () => {
    it('should return valid result for different alpacas', () => {
      const sireId = generateTestUUID();
      const damId = generateTestUUID();
      
      const result = BreedingRecordValidation.validateGeneticCompatibility(sireId, damId);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result when sire and dam are the same', () => {
      const sameId = generateTestUUID();
      
      const result = BreedingRecordValidation.validateGeneticCompatibility(sameId, sameId);
      
      expect(TestAssertions.isValidationFailure(result, ['An alpaca cannot breed with itself'])).toBe(true);
    });

    it('should handle lineage data when provided', () => {
      const sireId = generateTestUUID();
      const damId = generateTestUUID();
      const lineageData = {
        sireLineage: { id: sireId, parents: [] },
        damLineage: { id: damId, parents: [] }
      };
      
      const result = BreedingRecordValidation.validateGeneticCompatibility(sireId, damId, lineageData);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should handle undefined lineage data gracefully', () => {
      const sireId = generateTestUUID();
      const damId = generateTestUUID();
      
      const result = BreedingRecordValidation.validateGeneticCompatibility(sireId, damId, undefined);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should handle empty lineage data', () => {
      const sireId = generateTestUUID();
      const damId = generateTestUUID();
      const lineageData = {};
      
      const result = BreedingRecordValidation.validateGeneticCompatibility(sireId, damId, lineageData);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should prioritize same-alpaca validation over lineage data', () => {
      const sameId = generateTestUUID();
      const lineageData = {
        sireLineage: { id: sameId, parents: [] },
        damLineage: { id: sameId, parents: [] }
      };
      
      const result = BreedingRecordValidation.validateGeneticCompatibility(sameId, sameId, lineageData);
      
      expect(TestAssertions.isValidationFailure(result, ['An alpaca cannot breed with itself'])).toBe(true);
    });
  });
});