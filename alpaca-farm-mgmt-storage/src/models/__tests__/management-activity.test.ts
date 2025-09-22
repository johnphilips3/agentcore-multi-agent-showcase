import { describe, it, expect, beforeEach } from 'vitest';
import { ManagementActivityModel, ManagementActivityValidation, ManagementActivity, CreateManagementActivityInput, UpdateManagementActivityInput } from '../management-activity';
import { ActivityType } from '../common';

describe('ManagementActivityValidation', () => {
  describe('validateCreateInput', () => {
    let validInput: CreateManagementActivityInput;

    beforeEach(() => {
      validInput = {
        activityType: 'feeding' as ActivityType,
        date: new Date('2023-01-01'),
        alpacaIds: ['123e4567-e89b-12d3-a456-426614174000'],
        performedBy: 'John Doe',
        description: 'Daily feeding'
      };
    });

    it('should validate a valid management activity input', () => {
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid activity type', () => {
      (validInput as any).activityType = 'invalid-type';
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Activity type must be one of: feeding, shearing, weighing, moving, training, other');
    });

    it('should reject future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      validInput.date = futureDate;
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Date must be a valid date not in the future');
    });

    it('should reject empty alpaca IDs array', () => {
      validInput.alpacaIds = [];
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one alpaca ID is required');
    });

    it('should reject invalid alpaca IDs', () => {
      validInput.alpacaIds = ['invalid-uuid', '123e4567-e89b-12d3-a456-426614174000'];
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid alpaca ID: invalid-uuid');
    });

    it('should reject duplicate alpaca IDs', () => {
      const duplicateId = '123e4567-e89b-12d3-a456-426614174000';
      validInput.alpacaIds = [duplicateId, duplicateId];
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate alpaca IDs are not allowed');
    });

    it('should reject empty performedBy', () => {
      validInput.performedBy = '';
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Performed by is required and must be non-empty');
    });

    it('should reject empty description', () => {
      validInput.description = '';
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description is required and must be non-empty');
    });

    it('should reject empty notes if provided', () => {
      validInput.notes = '   ';
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Notes must be non-empty if provided');
    });

    it('should accept multiple valid alpaca IDs', () => {
      validInput.alpacaIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174002'
      ];
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateUpdateInput', () => {
    it('should validate partial updates', () => {
      const updateInput: UpdateManagementActivityInput = {
        description: 'Updated description',
        performedBy: 'Jane Doe'
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid partial updates', () => {
      const updateInput: UpdateManagementActivityInput = {
        description: '',
        alpacaIds: ['invalid-uuid']
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description must be non-empty if provided');
      expect(result.errors).toContain('Invalid alpaca ID: invalid-uuid');
    });
  });

  describe('validateBulkOperation', () => {
    it('should validate bulk operation with valid alpaca IDs', () => {
      const alpacaIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        '123e4567-e89b-12d3-a456-426614174001'
      ];
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds);
      expect(result.isValid).toBe(true);
    });

    it('should reject empty alpaca IDs array', () => {
      const result = ManagementActivityValidation.validateBulkOperation([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one alpaca ID is required for bulk operations');
    });

    it('should reject too many alpacas in bulk operation', () => {
      const manyAlpacas = Array(101).fill(0).map((_, i) => 
        `123e4567-e89b-12d3-a456-42661417${i.toString().padStart(4, '0')}`
      );
      const result = ManagementActivityValidation.validateBulkOperation(manyAlpacas);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bulk operations are limited to 100 alpacas at once');
    });

    it('should reject invalid alpaca IDs in bulk operation', () => {
      const alpacaIds = ['invalid-uuid', '123e4567-e89b-12d3-a456-426614174000'];
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid alpaca ID in bulk operation: invalid-uuid');
    });

    it('should reject duplicate alpaca IDs in bulk operation', () => {
      const duplicateId = '123e4567-e89b-12d3-a456-426614174000';
      const result = ManagementActivityValidation.validateBulkOperation([duplicateId, duplicateId]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate alpaca IDs are not allowed in bulk operations');
    });
  });
});

describe('ManagementActivityModel', () => {
  let activityData: ManagementActivity;
  let activityModel: ManagementActivityModel;

  beforeEach(() => {
    activityData = {
      id: '123e4567-e89b-12d3-a456-426614174003',
      activityType: 'feeding' as ActivityType,
      date: new Date('2023-01-01'),
      alpacaIds: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
      performedBy: 'John Doe',
      description: 'Daily feeding',
      notes: 'All alpacas ate well',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    };
    activityModel = new ManagementActivityModel(activityData);
  });

  describe('constructor', () => {
    it('should create a management activity model with all properties', () => {
      expect(activityModel.id).toBe(activityData.id);
      expect(activityModel.activityType).toBe(activityData.activityType);
      expect(activityModel.date).toBe(activityData.date);
      expect(activityModel.alpacaIds).toEqual(activityData.alpacaIds);
      expect(activityModel.alpacaIds).not.toBe(activityData.alpacaIds); // Should be a copy
      expect(activityModel.performedBy).toBe(activityData.performedBy);
      expect(activityModel.description).toBe(activityData.description);
      expect(activityModel.notes).toBe(activityData.notes);
      expect(activityModel.createdAt).toBe(activityData.createdAt);
      expect(activityModel.updatedAt).toBe(activityData.updatedAt);
    });

    it('should initialize empty alpaca array if not provided', () => {
      const dataWithoutAlpacas = { ...activityData };
      delete (dataWithoutAlpacas as any).alpacaIds;
      const model = new ManagementActivityModel(dataWithoutAlpacas as ManagementActivity);
      expect(model.alpacaIds).toEqual([]);
    });
  });

  describe('validate', () => {
    it('should validate a valid management activity model', () => {
      const result = activityModel.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      activityModel.description = '';
      const result = activityModel.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('update', () => {
    it('should update valid fields and return success', () => {
      const updates: UpdateManagementActivityInput = {
        description: 'Updated description',
        performedBy: 'Jane Doe'
      };
      
      const result = activityModel.update(updates);
      expect(result.isValid).toBe(true);
      expect(activityModel.description).toBe('Updated description');
      expect(activityModel.performedBy).toBe('Jane Doe');
      expect(activityModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should update alpaca IDs and create a copy', () => {
      const newAlpacaIds = ['123e4567-e89b-12d3-a456-426614174002'];
      const updates: UpdateManagementActivityInput = {
        alpacaIds: newAlpacaIds
      };
      
      const result = activityModel.update(updates);
      expect(result.isValid).toBe(true);
      expect(activityModel.alpacaIds).toEqual(newAlpacaIds);
      expect(activityModel.alpacaIds).not.toBe(newAlpacaIds); // Should be a copy
    });

    it('should reject invalid updates and not modify the model', () => {
      const originalDescription = activityModel.description;
      const originalUpdatedAt = activityModel.updatedAt;
      
      const updates: UpdateManagementActivityInput = {
        description: '',
        alpacaIds: ['invalid-uuid']
      };
      
      const result = activityModel.update(updates);
      expect(result.isValid).toBe(false);
      expect(activityModel.description).toBe(originalDescription);
      expect(activityModel.updatedAt).toBe(originalUpdatedAt);
    });
  });

  describe('addAlpaca', () => {
    it('should add valid alpaca ID', () => {
      const newAlpacaId = '123e4567-e89b-12d3-a456-426614174002';
      const result = activityModel.addAlpaca(newAlpacaId);
      
      expect(result.isValid).toBe(true);
      expect(activityModel.alpacaIds).toContain(newAlpacaId);
      expect(activityModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid alpaca ID', () => {
      const result = activityModel.addAlpaca('invalid-uuid');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alpaca ID must be a valid UUID');
    });

    it('should reject duplicate alpaca ID', () => {
      const existingAlpacaId = activityModel.alpacaIds[0];
      const result = activityModel.addAlpaca(existingAlpacaId);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alpaca is already associated with this activity');
    });
  });

  describe('removeAlpaca', () => {
    it('should remove existing alpaca ID', () => {
      const existingAlpacaId = activityModel.alpacaIds[0];
      const result = activityModel.removeAlpaca(existingAlpacaId);
      
      expect(result.isValid).toBe(true);
      expect(activityModel.alpacaIds).not.toContain(existingAlpacaId);
      expect(activityModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject removing non-existent alpaca ID', () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      const result = activityModel.removeAlpaca(nonExistentId);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alpaca is not associated with this activity');
    });

    it('should reject removing last alpaca', () => {
      // Remove all but one alpaca first
      activityModel.alpacaIds = ['123e4567-e89b-12d3-a456-426614174000'];
      
      const result = activityModel.removeAlpaca(activityModel.alpacaIds[0]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Activity must have at least one alpaca associated');
      expect(activityModel.alpacaIds).toHaveLength(1); // Should be restored
    });
  });

  describe('addAlpacasBulk', () => {
    it('should add multiple valid alpaca IDs', () => {
      const newAlpacaIds = [
        '123e4567-e89b-12d3-a456-426614174002',
        '123e4567-e89b-12d3-a456-426614174003'
      ];
      const result = activityModel.addAlpacasBulk(newAlpacaIds);
      
      expect(result.isValid).toBe(true);
      expect(activityModel.alpacaIds).toContain(newAlpacaIds[0]);
      expect(activityModel.alpacaIds).toContain(newAlpacaIds[1]);
      expect(activityModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject adding existing alpaca IDs', () => {
      const existingAlpacaId = activityModel.alpacaIds[0];
      const result = activityModel.addAlpacasBulk([existingAlpacaId]);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Alpaca ${existingAlpacaId} is already associated with this activity`);
    });

    it('should reject invalid bulk operation', () => {
      const result = activityModel.addAlpacasBulk(['invalid-uuid']);
      expect(result.isValid).toBe(false);
    });
  });

  describe('getAlpacaCount', () => {
    it('should return correct alpaca count', () => {
      expect(activityModel.getAlpacaCount()).toBe(2);
    });
  });

  describe('isBulkActivity', () => {
    it('should return true for multiple alpacas', () => {
      expect(activityModel.isBulkActivity()).toBe(true);
    });

    it('should return false for single alpaca', () => {
      activityModel.alpacaIds = ['123e4567-e89b-12d3-a456-426614174000'];
      expect(activityModel.isBulkActivity()).toBe(false);
    });
  });

  describe('involvesAlpaca', () => {
    it('should return true for involved alpaca', () => {
      const alpacaId = activityModel.alpacaIds[0];
      expect(activityModel.involvesAlpaca(alpacaId)).toBe(true);
    });

    it('should return false for non-involved alpaca', () => {
      const nonInvolvedId = '123e4567-e89b-12d3-a456-426614174999';
      expect(activityModel.involvesAlpaca(nonInvolvedId)).toBe(false);
    });
  });

  describe('getActivityAge', () => {
    it('should calculate activity age correctly', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      activityModel.date = yesterday;
      
      expect(activityModel.getActivityAge()).toBe(1);
    });
  });

  describe('isRecent', () => {
    it('should return true for recent activity', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      activityModel.date = yesterday;
      
      expect(activityModel.isRecent(7)).toBe(true);
    });

    it('should return false for old activity', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      activityModel.date = tenDaysAgo;
      
      expect(activityModel.isRecent(7)).toBe(false);
    });
  });

  describe('validateAlpacaRelationships', () => {
    it('should return valid when all alpacas exist', () => {
      const existingAlpacaIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        '123e4567-e89b-12d3-a456-426614174001'
      ];
      const result = activityModel.validateAlpacaRelationships(existingAlpacaIds);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when some alpacas do not exist', () => {
      const existingAlpacaIds = ['123e4567-e89b-12d3-a456-426614174000'];
      const result = activityModel.validateAlpacaRelationships(existingAlpacaIds);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alpaca with ID 123e4567-e89b-12d3-a456-426614174001 does not exist');
    });
  });

  describe('getSummary', () => {
    it('should return correct summary for multiple alpacas', () => {
      const summary = activityModel.getSummary();
      expect(summary).toContain('feeding activity for 2 alpacas');
      expect(summary).toContain('on '); // Just check that it includes the date
    });

    it('should return correct summary for single alpaca', () => {
      activityModel.alpacaIds = ['123e4567-e89b-12d3-a456-426614174000'];
      const summary = activityModel.getSummary();
      expect(summary).toContain('feeding activity for 1 alpaca');
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with all management activity properties', () => {
      const json = activityModel.toJSON();
      expect(json).toEqual(activityData);
      expect(json).not.toBeInstanceOf(ManagementActivityModel);
      expect(json.alpacaIds).not.toBe(activityModel.alpacaIds); // Should be a copy
    });
  });
});