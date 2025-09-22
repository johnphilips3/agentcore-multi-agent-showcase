/**
 * Unit tests for HealthRecord model
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  HealthRecordModel, 
  HealthRecordValidation, 
  HealthRecord, 
  CreateHealthRecordInput, 
  UpdateHealthRecordInput 
} from '../health-record';
import { RecordType } from '../common';
import { 
  HealthRecordFactory
} from '../../__tests__/data-factories';
import { 
  generateTestUUID, 
  generateTestDate,
  generateFutureTestDate,
  MockUtils,
  TestAssertions
} from '../../__tests__/test-utils';

describe('HealthRecordModel', () => {
  let healthRecordData: HealthRecord;
  let healthRecordModel: HealthRecordModel;

  beforeEach(() => {
    MockUtils.clearAllMocks();
    vi.useRealTimers();
    healthRecordData = HealthRecordFactory.create();
    healthRecordModel = new HealthRecordModel(healthRecordData);
  });

  describe('constructor', () => {
    it('should create a health record model with all properties', () => {
      expect(healthRecordModel.id).toBe(healthRecordData.id);
      expect(healthRecordModel.alpacaId).toBe(healthRecordData.alpacaId);
      expect(healthRecordModel.recordType).toBe(healthRecordData.recordType);
      expect(healthRecordModel.date).toBe(healthRecordData.date);
      expect(healthRecordModel.description).toBe(healthRecordData.description);
      expect(healthRecordModel.veterinarian).toBe(healthRecordData.veterinarian);
      expect(healthRecordModel.nextDueDate).toBe(healthRecordData.nextDueDate);
      expect(healthRecordModel.notes).toBe(healthRecordData.notes);
      expect(healthRecordModel.createdAt).toBe(healthRecordData.createdAt);
      expect(healthRecordModel.updatedAt).toBe(healthRecordData.updatedAt);
    });

    it('should create a health record model with minimal data', () => {
      const minimalData = HealthRecordFactory.createMinimal();
      const model = new HealthRecordModel(minimalData);

      expect(model.id).toBe(minimalData.id);
      expect(model.alpacaId).toBe(minimalData.alpacaId);
      expect(model.recordType).toBe(minimalData.recordType);
      expect(model.date).toBe(minimalData.date);
      expect(model.description).toBe(minimalData.description);
      expect(model.veterinarian).toBeUndefined();
      expect(model.nextDueDate).toBeUndefined();
      expect(model.notes).toBeUndefined();
    });

    it('should handle all record types correctly', () => {
      const recordTypes: RecordType[] = ['vaccination', 'checkup', 'treatment', 'medication', 'surgery', 'injury', 'illness', 'other'];
      
      recordTypes.forEach(recordType => {
        const data = HealthRecordFactory.createByType(recordType);
        const model = new HealthRecordModel(data);
        expect(model.recordType).toBe(recordType);
      });
    });
  });

  describe('validate', () => {
    it('should return valid result for valid health record data', () => {
      const result = healthRecordModel.validate();
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for health record with invalid alpaca ID', () => {
      healthRecordModel.alpacaId = 'invalid-uuid';
      const result = healthRecordModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Alpaca ID is required and must be a valid UUID'])).toBe(true);
    });

    it('should return invalid result for health record with invalid record type', () => {
      healthRecordModel.recordType = 'invalid' as RecordType;
      const result = healthRecordModel.validate();
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Record type must be one of:');
    });

    it('should return invalid result for health record with future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      healthRecordModel.date = futureDate;
      
      const result = healthRecordModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Date must be a valid date not in the future'])).toBe(true);
    });

    it('should return invalid result for health record with empty description', () => {
      healthRecordModel.description = '';
      const result = healthRecordModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Description is required and must be non-empty'])).toBe(true);
    });
  });

  describe('update', () => {
    it('should update health record with valid data and return success', () => {
      const originalUpdatedAt = healthRecordModel.updatedAt;
      const updates: UpdateHealthRecordInput = {
        description: 'Updated description',
        veterinarian: 'Dr. Updated',
        notes: 'Updated notes'
      };
      
      const result = healthRecordModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(healthRecordModel.description).toBe('Updated description');
      expect(healthRecordModel.veterinarian).toBe('Dr. Updated');
      expect(healthRecordModel.notes).toBe('Updated notes');
      expect(healthRecordModel.updatedAt).toBeInstanceOf(Date);
      expect(healthRecordModel.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should not update health record with invalid data and return failure', () => {
      const originalDescription = healthRecordModel.description;
      const originalVeterinarian = healthRecordModel.veterinarian;
      const updates: UpdateHealthRecordInput = {
        description: '',
        veterinarian: ''
      };
      
      const result = healthRecordModel.update(updates);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(healthRecordModel.description).toBe(originalDescription); // Should not change
      expect(healthRecordModel.veterinarian).toBe(originalVeterinarian); // Should not change
      expect(result.errors).toContain('Description must be non-empty if provided');
      expect(result.errors).toContain('Veterinarian must be non-empty if provided');
    });

    it('should update updatedAt timestamp on successful update', () => {
      const originalUpdatedAt = healthRecordModel.updatedAt;
      
      // Mock Date to ensure we can detect the change
      vi.setSystemTime(new Date('2024-02-01T00:00:00Z'));
      
      const updates: UpdateHealthRecordInput = { description: 'New description' };
      const result = healthRecordModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(healthRecordModel.updatedAt).not.toBe(originalUpdatedAt);
      expect(healthRecordModel.updatedAt.getTime()).toBe(new Date('2024-02-01T00:00:00Z').getTime());
      
      vi.useRealTimers();
    });

    it('should handle partial updates correctly', () => {
      const originalDescription = healthRecordModel.description;
      const originalVeterinarian = healthRecordModel.veterinarian;
      
      const updates: UpdateHealthRecordInput = {
        notes: 'Only updating notes'
      };
      
      const result = healthRecordModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(healthRecordModel.description).toBe(originalDescription); // Should remain unchanged
      expect(healthRecordModel.veterinarian).toBe(originalVeterinarian); // Should remain unchanged
      expect(healthRecordModel.notes).toBe('Only updating notes');
    });

    it('should validate record type updates', () => {
      const updates: UpdateHealthRecordInput = {
        recordType: 'treatment' as RecordType
      };
      
      const result = healthRecordModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(healthRecordModel.recordType).toBe('treatment');
    });

    it('should validate date updates', () => {
      const newDate = generateTestDate(0.5);
      const updates: UpdateHealthRecordInput = {
        date: newDate
      };
      
      const result = healthRecordModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(healthRecordModel.date).toBe(newDate);
    });

    it('should validate nextDueDate updates', () => {
      const newDueDate = generateFutureTestDate(6);
      const updates: UpdateHealthRecordInput = {
        nextDueDate: newDueDate
      };
      
      const result = healthRecordModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(healthRecordModel.nextDueDate).toBe(newDueDate);
    });
  });

  describe('isOverdue', () => {
    it('should return false when no next due date is set', () => {
      healthRecordModel.nextDueDate = undefined;
      
      const isOverdue = healthRecordModel.isOverdue();
      
      expect(isOverdue).toBe(false);
    });

    it('should return true when next due date is in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      healthRecordModel.nextDueDate = pastDate;
      
      const isOverdue = healthRecordModel.isOverdue();
      
      expect(isOverdue).toBe(true);
    });

    it('should return false when next due date is in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      healthRecordModel.nextDueDate = futureDate;
      
      const isOverdue = healthRecordModel.isOverdue();
      
      expect(isOverdue).toBe(false);
    });

    it('should return true when next due date is earlier today', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      
      healthRecordModel.nextDueDate = new Date('2024-01-01T10:00:00Z');
      
      const isOverdue = healthRecordModel.isOverdue();
      
      expect(isOverdue).toBe(true); // Earlier time same day is overdue
      
      vi.useRealTimers();
    });

    it('should return false when next due date is later today', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
      
      healthRecordModel.nextDueDate = new Date('2024-01-01T12:00:00Z');
      
      const isOverdue = healthRecordModel.isOverdue();
      
      expect(isOverdue).toBe(false); // Later time same day is not overdue
      
      vi.useRealTimers();
    });

    it('should handle edge case of exact current time', () => {
      const currentTime = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(currentTime);
      
      healthRecordModel.nextDueDate = new Date(currentTime.getTime());
      
      const isOverdue = healthRecordModel.isOverdue();
      
      expect(isOverdue).toBe(false); // Exact current time should not be overdue
      
      vi.useRealTimers();
    });
  });

  describe('getDaysUntilDue', () => {
    it('should return null when no next due date is set', () => {
      healthRecordModel.nextDueDate = undefined;
      
      const daysUntilDue = healthRecordModel.getDaysUntilDue();
      
      expect(daysUntilDue).toBeNull();
    });

    it('should return positive number for future due date', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      
      healthRecordModel.nextDueDate = new Date('2024-01-11T00:00:00Z'); // 10 days in future
      
      const daysUntilDue = healthRecordModel.getDaysUntilDue();
      
      expect(daysUntilDue).toBe(10);
      
      vi.useRealTimers();
    });

    it('should return negative number for overdue date', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-11T00:00:00Z'));
      
      healthRecordModel.nextDueDate = new Date('2024-01-01T00:00:00Z'); // 10 days ago
      
      const daysUntilDue = healthRecordModel.getDaysUntilDue();
      
      expect(daysUntilDue).toBe(-10);
      
      vi.useRealTimers();
    });

    it('should return 0 for due date today', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      
      healthRecordModel.nextDueDate = new Date('2024-01-01T10:00:00Z');
      
      const daysUntilDue = healthRecordModel.getDaysUntilDue();
      
      expect(Math.abs(daysUntilDue!)).toBe(0); // Same day should be 0 (handle -0 vs 0)
      
      vi.useRealTimers();
    });

    it('should handle fractional days correctly', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-01T06:00:00Z'));
      
      healthRecordModel.nextDueDate = new Date('2024-01-02T18:00:00Z'); // 1.5 days in future
      
      const daysUntilDue = healthRecordModel.getDaysUntilDue();
      
      expect(daysUntilDue).toBe(2); // Should round up using Math.ceil
      
      vi.useRealTimers();
    });

    it('should handle time zone differences correctly', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-01T23:00:00Z'));
      
      healthRecordModel.nextDueDate = new Date('2024-01-02T01:00:00Z'); // 2 hours in future
      
      const daysUntilDue = healthRecordModel.getDaysUntilDue();
      
      expect(daysUntilDue).toBe(1); // Should be 1 day due to Math.ceil
      
      vi.useRealTimers();
    });

    it('should handle leap year calculations', () => {
      // Mock current date to leap year
      vi.setSystemTime(new Date('2024-02-28T00:00:00Z'));
      
      healthRecordModel.nextDueDate = new Date('2024-03-01T00:00:00Z'); // 2 days in leap year
      
      const daysUntilDue = healthRecordModel.getDaysUntilDue();
      
      expect(daysUntilDue).toBe(2); // Should correctly handle leap year
      
      vi.useRealTimers();
    });
  });

  describe('isVaccination', () => {
    it('should return true for vaccination record type', () => {
      healthRecordModel.recordType = 'vaccination';
      
      const isVaccination = healthRecordModel.isVaccination();
      
      expect(isVaccination).toBe(true);
    });

    it('should return false for non-vaccination record types', () => {
      const nonVaccinationTypes: RecordType[] = ['checkup', 'treatment', 'medication', 'surgery', 'injury', 'illness', 'other'];
      
      nonVaccinationTypes.forEach(recordType => {
        healthRecordModel.recordType = recordType;
        const isVaccination = healthRecordModel.isVaccination();
        expect(isVaccination).toBe(false);
      });
    });
  });

  describe('isTreatment', () => {
    it('should return true for treatment record type', () => {
      healthRecordModel.recordType = 'treatment';
      
      const isTreatment = healthRecordModel.isTreatment();
      
      expect(isTreatment).toBe(true);
    });

    it('should return false for non-treatment record types', () => {
      const nonTreatmentTypes: RecordType[] = ['vaccination', 'checkup', 'medication', 'surgery', 'injury', 'illness', 'other'];
      
      nonTreatmentTypes.forEach(recordType => {
        healthRecordModel.recordType = recordType;
        const isTreatment = healthRecordModel.isTreatment();
        expect(isTreatment).toBe(false);
      });
    });
  });

  describe('validateAlpacaRelationship', () => {
    it('should return valid result when alpaca exists', () => {
      const result = healthRecordModel.validateAlpacaRelationship(true);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result when alpaca does not exist', () => {
      const result = healthRecordModel.validateAlpacaRelationship(false);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain(`Alpaca with ID ${healthRecordModel.alpacaId} does not exist`);
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with all health record properties', () => {
      const json = healthRecordModel.toJSON();
      
      expect(json).toEqual({
        id: healthRecordModel.id,
        alpacaId: healthRecordModel.alpacaId,
        recordType: healthRecordModel.recordType,
        date: healthRecordModel.date,
        description: healthRecordModel.description,
        veterinarian: healthRecordModel.veterinarian,
        nextDueDate: healthRecordModel.nextDueDate,
        notes: healthRecordModel.notes,
        createdAt: healthRecordModel.createdAt,
        updatedAt: healthRecordModel.updatedAt
      });
    });

    it('should return object without methods', () => {
      const json = healthRecordModel.toJSON();
      
      expect(typeof (json as any).validate).toBe('undefined');
      expect(typeof (json as any).update).toBe('undefined');
      expect(typeof (json as any).isOverdue).toBe('undefined');
      expect(typeof (json as any).getDaysUntilDue).toBe('undefined');
      expect(typeof (json as any).isVaccination).toBe('undefined');
      expect(typeof (json as any).isTreatment).toBe('undefined');
    });

    it('should handle undefined optional properties', () => {
      const minimalData = HealthRecordFactory.createMinimal();
      const model = new HealthRecordModel(minimalData);
      const json = model.toJSON();
      
      expect(json.veterinarian).toBeUndefined();
      expect(json.nextDueDate).toBeUndefined();
      expect(json.notes).toBeUndefined();
    });

    it('should preserve date objects correctly', () => {
      const json = healthRecordModel.toJSON();
      
      expect(json.date).toBeInstanceOf(Date);
      expect(json.createdAt).toBeInstanceOf(Date);
      expect(json.updatedAt).toBeInstanceOf(Date);
      if (json.nextDueDate) {
        expect(json.nextDueDate).toBeInstanceOf(Date);
      }
    });

    it('should be serializable to JSON string', () => {
      const json = healthRecordModel.toJSON();
      
      expect(() => JSON.stringify(json)).not.toThrow();
      
      const jsonString = JSON.stringify(json);
      const parsed = JSON.parse(jsonString);
      
      expect(parsed.id).toBe(healthRecordModel.id);
      expect(parsed.alpacaId).toBe(healthRecordModel.alpacaId);
      expect(parsed.recordType).toBe(healthRecordModel.recordType);
      expect(parsed.description).toBe(healthRecordModel.description);
    });

    it('should maintain data integrity after serialization', () => {
      const originalData = healthRecordModel.toJSON();
      const serialized = JSON.stringify(originalData);
      const deserialized = JSON.parse(serialized);
      
      // Convert date strings back to Date objects for comparison
      deserialized.date = new Date(deserialized.date);
      deserialized.createdAt = new Date(deserialized.createdAt);
      deserialized.updatedAt = new Date(deserialized.updatedAt);
      if (deserialized.nextDueDate) {
        deserialized.nextDueDate = new Date(deserialized.nextDueDate);
      }
      
      expect(deserialized.id).toBe(originalData.id);
      expect(deserialized.alpacaId).toBe(originalData.alpacaId);
      expect(deserialized.recordType).toBe(originalData.recordType);
      expect(deserialized.date.getTime()).toBe(originalData.date.getTime());
      expect(deserialized.description).toBe(originalData.description);
    });
  });
});

describe('HealthRecordValidation', () => {
  describe('validateCreateInput', () => {
    let validInput: CreateHealthRecordInput;

    beforeEach(() => {
      MockUtils.clearAllMocks();
      validInput = HealthRecordFactory.createInput();
    });

    it('should return valid result for valid create input', () => {
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for invalid alpaca ID', () => {
      validInput.alpacaId = 'invalid-uuid';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Alpaca ID is required and must be a valid UUID'])).toBe(true);
    });

    it('should return invalid result for empty alpaca ID', () => {
      validInput.alpacaId = '';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Alpaca ID is required and must be a valid UUID'])).toBe(true);
    });

    it('should return invalid result for invalid record type', () => {
      validInput.recordType = 'invalid' as RecordType;
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Record type must be one of:');
    });

    it('should return invalid result for future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      validInput.date = futureDate;
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Date must be a valid date not in the future'])).toBe(true);
    });

    it('should return invalid result for empty description', () => {
      validInput.description = '';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Description is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for whitespace-only description', () => {
      validInput.description = '   ';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Description is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for empty veterinarian when provided', () => {
      validInput.veterinarian = '';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Veterinarian must be non-empty if provided'])).toBe(true);
    });

    it('should return invalid result for next due date more than 5 years in future', () => {
      const farFutureDate = new Date();
      farFutureDate.setFullYear(farFutureDate.getFullYear() + 6);
      validInput.nextDueDate = farFutureDate;
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Next due date cannot be more than 5 years in the future'])).toBe(true);
    });

    it('should return invalid result for next due date before record date', () => {
      validInput.date = new Date('2024-01-15');
      validInput.nextDueDate = new Date('2024-01-10'); // Before record date
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Next due date cannot be before the record date'])).toBe(true);
    });

    it('should return invalid result for empty notes when provided', () => {
      validInput.notes = '   ';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Notes must be non-empty if provided'])).toBe(true);
    });

    it('should handle minimal valid input', () => {
      const minimalInput: CreateHealthRecordInput = {
        alpacaId: generateTestUUID(),
        recordType: 'checkup',
        date: generateTestDate(0.1),
        description: 'Health checkup'
      };
      
      const result = HealthRecordValidation.validateCreateInput(minimalInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should validate all record types', () => {
      const validRecordTypes: RecordType[] = ['vaccination', 'checkup', 'treatment', 'medication', 'surgery', 'injury', 'illness', 'other'];
      
      validRecordTypes.forEach(recordType => {
        validInput.recordType = recordType;
        const result = HealthRecordValidation.validateCreateInput(validInput);
        expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      });
    });

    it('should accumulate multiple validation errors', () => {
      const invalidInput: CreateHealthRecordInput = {
        alpacaId: 'invalid',
        recordType: 'invalid' as RecordType,
        date: new Date('2030-01-01'),
        description: '',
        veterinarian: '',
        notes: '   '
      };
      
      const result = HealthRecordValidation.validateCreateInput(invalidInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(4);
    });

    it('should validate date boundaries correctly', () => {
      // Test date exactly at current time
      const now = new Date();
      validInput.date = now;
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should validate next due date edge cases', () => {
      // Test next due date exactly 5 years in future
      const fiveYearsFromNow = new Date();
      fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
      validInput.nextDueDate = fiveYearsFromNow;
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should handle undefined optional fields correctly', () => {
      const minimalInput: CreateHealthRecordInput = {
        alpacaId: generateTestUUID(),
        recordType: 'checkup',
        date: generateTestDate(0.1),
        description: 'Minimal health record'
      };
      
      const result = HealthRecordValidation.validateCreateInput(minimalInput);
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should validate special characters in text fields', () => {
      validInput.description = 'Health record with special chars: @#$%^&*()';
      validInput.veterinarian = 'Dr. O\'Connor-Smith';
      validInput.notes = 'Notes with unicode: αβγδε and emojis: 🐾🏥';
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should validate very long text fields', () => {
      const longText = 'A'.repeat(1000);
      validInput.description = longText;
      validInput.notes = longText;
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });
  });

  describe('validateUpdateInput', () => {
    beforeEach(() => {
      MockUtils.clearAllMocks();
    });

    it('should return valid result for valid update input', () => {
      const updateInput: UpdateHealthRecordInput = {
        description: 'Updated description',
        veterinarian: 'Dr. Updated',
        notes: 'Updated notes'
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return valid result for empty update input', () => {
      const updateInput: UpdateHealthRecordInput = {};
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for invalid alpaca ID when provided', () => {
      const updateInput: UpdateHealthRecordInput = {
        alpacaId: 'invalid-uuid'
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Alpaca ID must be a valid UUID if provided'])).toBe(true);
    });

    it('should return invalid result for invalid record type when provided', () => {
      const updateInput: UpdateHealthRecordInput = {
        recordType: 'invalid' as RecordType
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Record type must be one of:');
    });

    it('should return invalid result for future date when provided', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const updateInput: UpdateHealthRecordInput = {
        date: futureDate
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Date must be a valid date not in the future if provided'])).toBe(true);
    });

    it('should return invalid result for empty description when provided', () => {
      const updateInput: UpdateHealthRecordInput = {
        description: ''
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Description must be non-empty if provided'])).toBe(true);
    });

    it('should return invalid result for empty veterinarian when provided', () => {
      const updateInput: UpdateHealthRecordInput = {
        veterinarian: ''
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Veterinarian must be non-empty if provided'])).toBe(true);
    });

    it('should return invalid result for next due date too far in future when provided', () => {
      const farFutureDate = new Date();
      farFutureDate.setFullYear(farFutureDate.getFullYear() + 6);
      
      const updateInput: UpdateHealthRecordInput = {
        nextDueDate: farFutureDate
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Next due date cannot be more than 5 years in the future if provided'])).toBe(true);
    });

    it('should return invalid result for empty notes when provided', () => {
      const updateInput: UpdateHealthRecordInput = {
        notes: '   '
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Notes must be non-empty if provided'])).toBe(true);
    });

    it('should handle partial updates correctly', () => {
      const updateInput: UpdateHealthRecordInput = {
        description: 'Updated description only'
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should accumulate multiple validation errors in updates', () => {
      const invalidUpdate: UpdateHealthRecordInput = {
        alpacaId: 'invalid',
        description: '',
        veterinarian: '',
        notes: '   '
      };
      
      const result = HealthRecordValidation.validateUpdateInput(invalidUpdate);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(2);
    });

    it('should validate alpaca ID format in updates', () => {
      const updateInput: UpdateHealthRecordInput = {
        alpacaId: generateTestUUID()
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should handle null and undefined values correctly', () => {
      const updateInput: UpdateHealthRecordInput = {
        veterinarian: undefined,
        notes: undefined
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should validate record type changes in updates', () => {
      const recordTypes: RecordType[] = ['vaccination', 'checkup', 'treatment', 'medication', 'surgery', 'injury', 'illness', 'other'];
      
      recordTypes.forEach(recordType => {
        const updateInput: UpdateHealthRecordInput = {
          recordType
        };
        
        const result = HealthRecordValidation.validateUpdateInput(updateInput);
        expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      });
    });

    it('should validate date changes in updates', () => {
      const updateInput: UpdateHealthRecordInput = {
        date: generateTestDate(1)
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should validate next due date changes in updates', () => {
      const updateInput: UpdateHealthRecordInput = {
        nextDueDate: generateFutureTestDate(3)
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should handle edge case of empty string vs undefined', () => {
      // Empty string should fail validation
      const invalidUpdate: UpdateHealthRecordInput = {
        description: ''
      };
      
      const invalidResult = HealthRecordValidation.validateUpdateInput(invalidUpdate);
      expect(TestAssertions.isValidationFailure(invalidResult)).toBe(true);
      
      // Undefined should pass validation (field not being updated)
      const validUpdate: UpdateHealthRecordInput = {
        description: undefined
      };
      
      const validResult = HealthRecordValidation.validateUpdateInput(validUpdate);
      expect(TestAssertions.isValidationSuccess(validResult)).toBe(true);
    });

    it('should validate whitespace-only strings correctly', () => {
      const updateInput: UpdateHealthRecordInput = {
        description: '   \t\n   ',
        veterinarian: '\t\t',
        notes: '   '
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors).toContain('Description must be non-empty if provided');
      expect(result.errors).toContain('Veterinarian must be non-empty if provided');
      expect(result.errors).toContain('Notes must be non-empty if provided');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle invalid date objects', () => {
      const invalidInput: CreateHealthRecordInput = {
        alpacaId: generateTestUUID(),
        recordType: 'checkup',
        date: new Date('invalid-date'),
        description: 'Test description'
      };
      
      const result = HealthRecordValidation.validateCreateInput(invalidInput);
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
    });

    it('should validate minimum date boundaries', () => {
      const veryOldDate = new Date('1989-12-31'); // Before minimum date
      const validInput: CreateHealthRecordInput = {
        alpacaId: generateTestUUID(),
        recordType: 'checkup',
        date: veryOldDate,
        description: 'Very old record'
      };
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
    });

    it('should handle concurrent validation calls', () => {
      const input1 = HealthRecordFactory.createInput();
      const input2 = HealthRecordFactory.createInput();
      
      const result1 = HealthRecordValidation.validateCreateInput(input1);
      const result2 = HealthRecordValidation.validateCreateInput(input2);
      
      expect(TestAssertions.isValidationSuccess(result1)).toBe(true);
      expect(TestAssertions.isValidationSuccess(result2)).toBe(true);
    });
  });
});