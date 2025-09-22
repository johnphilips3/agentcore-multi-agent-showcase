import { describe, it, expect, beforeEach } from 'vitest';
import { HealthRecordModel, HealthRecordValidation, HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput } from '../health-record';
import { RecordType } from '../common';

describe('HealthRecordValidation', () => {
  describe('validateCreateInput', () => {
    let validInput: CreateHealthRecordInput;

    beforeEach(() => {
      validInput = {
        alpacaId: '123e4567-e89b-12d3-a456-426614174000',
        recordType: 'vaccination' as RecordType,
        date: new Date('2023-01-01'),
        description: 'Annual vaccination'
      };
    });

    it('should validate a valid health record input', () => {
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid alpaca ID', () => {
      validInput.alpacaId = 'invalid-uuid';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alpaca ID is required and must be a valid UUID');
    });

    it('should reject invalid record type', () => {
      (validInput as any).recordType = 'invalid-type';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Record type must be one of: vaccination, treatment, observation, checkup');
    });

    it('should reject future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      validInput.date = futureDate;
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Date must be a valid date not in the future');
    });

    it('should reject empty description', () => {
      validInput.description = '';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description is required and must be non-empty');
    });

    it('should reject empty veterinarian if provided', () => {
      validInput.veterinarian = '';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Veterinarian must be non-empty if provided');
    });

    it('should reject next due date before record date', () => {
      validInput.date = new Date('2023-06-01');
      validInput.nextDueDate = new Date('2023-05-01');
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Next due date cannot be before the record date');
    });

    it('should reject next due date more than 5 years in future', () => {
      const farFutureDate = new Date();
      farFutureDate.setFullYear(farFutureDate.getFullYear() + 6);
      validInput.nextDueDate = farFutureDate;
      
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Next due date cannot be more than 5 years in the future');
    });

    it('should accept valid next due date', () => {
      validInput.nextDueDate = new Date('2024-01-01');
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
    });

    it('should reject empty notes if provided', () => {
      validInput.notes = '   ';
      const result = HealthRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Notes must be non-empty if provided');
    });
  });

  describe('validateUpdateInput', () => {
    it('should validate partial updates', () => {
      const updateInput: UpdateHealthRecordInput = {
        description: 'Updated description',
        veterinarian: 'Dr. Smith'
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid partial updates', () => {
      const updateInput: UpdateHealthRecordInput = {
        description: '',
        alpacaId: 'invalid-uuid'
      };
      
      const result = HealthRecordValidation.validateUpdateInput(updateInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description must be non-empty if provided');
      expect(result.errors).toContain('Alpaca ID must be a valid UUID if provided');
    });
  });
});

describe('HealthRecordModel', () => {
  let healthRecordData: HealthRecord;
  let healthRecordModel: HealthRecordModel;

  beforeEach(() => {
    healthRecordData = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      alpacaId: '123e4567-e89b-12d3-a456-426614174000',
      recordType: 'vaccination' as RecordType,
      date: new Date('2023-01-01'),
      description: 'Annual vaccination',
      veterinarian: 'Dr. Smith',
      nextDueDate: new Date('2024-01-01'),
      notes: 'No adverse reactions',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    };
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
  });

  describe('validate', () => {
    it('should validate a valid health record model', () => {
      const result = healthRecordModel.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      healthRecordModel.description = '';
      const result = healthRecordModel.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('update', () => {
    it('should update valid fields and return success', () => {
      const updates: UpdateHealthRecordInput = {
        description: 'Updated description',
        veterinarian: 'Dr. Johnson'
      };
      
      const result = healthRecordModel.update(updates);
      expect(result.isValid).toBe(true);
      expect(healthRecordModel.description).toBe('Updated description');
      expect(healthRecordModel.veterinarian).toBe('Dr. Johnson');
      expect(healthRecordModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid updates and not modify the model', () => {
      const originalDescription = healthRecordModel.description;
      const originalUpdatedAt = healthRecordModel.updatedAt;
      
      const updates: UpdateHealthRecordInput = {
        description: '',
        alpacaId: 'invalid-uuid'
      };
      
      const result = healthRecordModel.update(updates);
      expect(result.isValid).toBe(false);
      expect(healthRecordModel.description).toBe(originalDescription);
      expect(healthRecordModel.updatedAt).toBe(originalUpdatedAt);
    });
  });

  describe('isOverdue', () => {
    it('should return true when next due date is in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      healthRecordModel.nextDueDate = pastDate;
      
      expect(healthRecordModel.isOverdue()).toBe(true);
    });

    it('should return false when next due date is in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      healthRecordModel.nextDueDate = futureDate;
      
      expect(healthRecordModel.isOverdue()).toBe(false);
    });

    it('should return false when no next due date is set', () => {
      healthRecordModel.nextDueDate = undefined;
      expect(healthRecordModel.isOverdue()).toBe(false);
    });
  });

  describe('getDaysUntilDue', () => {
    it('should return positive number for future due date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      healthRecordModel.nextDueDate = futureDate;
      
      const days = healthRecordModel.getDaysUntilDue();
      expect(days).toBe(5);
    });

    it('should return negative number for overdue date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);
      healthRecordModel.nextDueDate = pastDate;
      
      const days = healthRecordModel.getDaysUntilDue();
      expect(days).toBe(-3);
    });

    it('should return null when no next due date is set', () => {
      healthRecordModel.nextDueDate = undefined;
      expect(healthRecordModel.getDaysUntilDue()).toBeNull();
    });
  });

  describe('isVaccination', () => {
    it('should return true for vaccination records', () => {
      healthRecordModel.recordType = 'vaccination';
      expect(healthRecordModel.isVaccination()).toBe(true);
    });

    it('should return false for non-vaccination records', () => {
      healthRecordModel.recordType = 'treatment';
      expect(healthRecordModel.isVaccination()).toBe(false);
    });
  });

  describe('isTreatment', () => {
    it('should return true for treatment records', () => {
      healthRecordModel.recordType = 'treatment';
      expect(healthRecordModel.isTreatment()).toBe(true);
    });

    it('should return false for non-treatment records', () => {
      healthRecordModel.recordType = 'vaccination';
      expect(healthRecordModel.isTreatment()).toBe(false);
    });
  });

  describe('validateAlpacaRelationship', () => {
    it('should return valid when alpaca exists', () => {
      const result = healthRecordModel.validateAlpacaRelationship(true);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when alpaca does not exist', () => {
      const result = healthRecordModel.validateAlpacaRelationship(false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Alpaca with ID ${healthRecordModel.alpacaId} does not exist`);
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with all health record properties', () => {
      const json = healthRecordModel.toJSON();
      expect(json).toEqual(healthRecordData);
      expect(json).not.toBeInstanceOf(HealthRecordModel);
    });
  });
});