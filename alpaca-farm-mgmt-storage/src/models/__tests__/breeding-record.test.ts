import { describe, it, expect, beforeEach } from 'vitest';
import { BreedingRecordModel, BreedingRecordValidation, BreedingRecord, CreateBreedingRecordInput, UpdateBreedingRecordInput } from '../breeding-record';

describe('BreedingRecordValidation', () => {
  describe('validateCreateInput', () => {
    let validInput: CreateBreedingRecordInput;

    beforeEach(() => {
      validInput = {
        sireId: '123e4567-e89b-12d3-a456-426614174000',
        damId: '123e4567-e89b-12d3-a456-426614174001',
        breedingDate: new Date('2023-01-01'),
        offspringIds: []
      };
    });

    it('should validate a valid breeding record input', () => {
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid sire ID', () => {
      validInput.sireId = 'invalid-uuid';
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sire ID is required and must be a valid UUID');
    });

    it('should reject invalid dam ID', () => {
      validInput.damId = 'invalid-uuid';
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dam ID is required and must be a valid UUID');
    });

    it('should reject same sire and dam', () => {
      validInput.damId = validInput.sireId;
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sire and dam cannot be the same alpaca');
    });

    it('should reject future breeding date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      validInput.breedingDate = futureDate;
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Breeding date must be a valid date not in the future');
    });

    it('should reject expected due date before breeding date', () => {
      validInput.breedingDate = new Date('2023-06-01');
      validInput.expectedDueDate = new Date('2023-05-01');
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expected due date must be after breeding date');
    });

    it('should reject expected due date outside reasonable gestation range', () => {
      validInput.breedingDate = new Date('2023-01-01');
      validInput.expectedDueDate = new Date('2023-03-01'); // Too early (2 months)
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expected due date should be 10-13 months after breeding date');
    });

    it('should accept valid expected due date', () => {
      validInput.breedingDate = new Date('2023-01-01');
      validInput.expectedDueDate = new Date('2023-12-01'); // 11 months later
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
    });

    it('should reject actual birth date before breeding date', () => {
      validInput.breedingDate = new Date('2023-06-01');
      validInput.actualBirthDate = new Date('2023-05-01');
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Actual birth date must be after breeding date');
    });

    it('should reject future actual birth date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      validInput.actualBirthDate = futureDate;
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Actual birth date cannot be in the future');
    });

    it('should reject invalid offspring IDs', () => {
      validInput.offspringIds = ['invalid-uuid', '123e4567-e89b-12d3-a456-426614174002'];
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid offspring ID: invalid-uuid');
    });

    it('should accept valid offspring IDs', () => {
      validInput.offspringIds = [
        '123e4567-e89b-12d3-a456-426614174002',
        '123e4567-e89b-12d3-a456-426614174003'
      ];
      
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
    });

    it('should reject empty notes if provided', () => {
      validInput.notes = '   ';
      const result = BreedingRecordValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Notes must be non-empty if provided');
    });
  });

  describe('validateUpdateInput', () => {
    it('should validate partial updates', () => {
      const updateInput: UpdateBreedingRecordInput = {
        notes: 'Updated notes',
        actualBirthDate: new Date('2023-12-01')
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid partial updates', () => {
      const updateInput: UpdateBreedingRecordInput = {
        sireId: 'invalid-uuid',
        notes: ''
      };
      
      const result = BreedingRecordValidation.validateUpdateInput(updateInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sire ID must be a valid UUID if provided');
      expect(result.errors).toContain('Notes must be non-empty if provided');
    });
  });

  describe('validateGeneticCompatibility', () => {
    it('should reject same alpaca breeding with itself', () => {
      const sameId = '123e4567-e89b-12d3-a456-426614174000';
      const result = BreedingRecordValidation.validateGeneticCompatibility(sameId, sameId);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('An alpaca cannot breed with itself');
    });

    it('should accept different alpacas', () => {
      const sireId = '123e4567-e89b-12d3-a456-426614174000';
      const damId = '123e4567-e89b-12d3-a456-426614174001';
      const result = BreedingRecordValidation.validateGeneticCompatibility(sireId, damId);
      expect(result.isValid).toBe(true);
    });
  });
});

describe('BreedingRecordModel', () => {
  let breedingRecordData: BreedingRecord;
  let breedingRecordModel: BreedingRecordModel;

  beforeEach(() => {
    breedingRecordData = {
      id: '123e4567-e89b-12d3-a456-426614174002',
      sireId: '123e4567-e89b-12d3-a456-426614174000',
      damId: '123e4567-e89b-12d3-a456-426614174001',
      breedingDate: new Date('2023-01-01'),
      expectedDueDate: new Date('2023-12-01'),
      actualBirthDate: new Date('2023-11-15'),
      offspringIds: ['123e4567-e89b-12d3-a456-426614174003'],
      notes: 'Successful breeding',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    };
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

    it('should initialize empty offspring array if not provided', () => {
      const dataWithoutOffspring = { ...breedingRecordData };
      delete (dataWithoutOffspring as any).offspringIds;
      const model = new BreedingRecordModel(dataWithoutOffspring as BreedingRecord);
      expect(model.offspringIds).toEqual([]);
    });
  });

  describe('validate', () => {
    it('should validate a valid breeding record model', () => {
      const result = breedingRecordModel.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      breedingRecordModel.sireId = 'invalid-uuid';
      const result = breedingRecordModel.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('update', () => {
    it('should update valid fields and return success', () => {
      const updates: UpdateBreedingRecordInput = {
        notes: 'Updated notes',
        actualBirthDate: new Date('2023-12-01')
      };
      
      const result = breedingRecordModel.update(updates);
      expect(result.isValid).toBe(true);
      expect(breedingRecordModel.notes).toBe('Updated notes');
      expect(breedingRecordModel.actualBirthDate).toEqual(new Date('2023-12-01'));
      expect(breedingRecordModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid updates and not modify the model', () => {
      const originalNotes = breedingRecordModel.notes;
      const originalUpdatedAt = breedingRecordModel.updatedAt;
      
      const updates: UpdateBreedingRecordInput = {
        sireId: 'invalid-uuid',
        notes: ''
      };
      
      const result = breedingRecordModel.update(updates);
      expect(result.isValid).toBe(false);
      expect(breedingRecordModel.notes).toBe(originalNotes);
      expect(breedingRecordModel.updatedAt).toBe(originalUpdatedAt);
    });
  });

  describe('addOffspring', () => {
    it('should add valid offspring ID', () => {
      const newOffspringId = '123e4567-e89b-12d3-a456-426614174004';
      const result = breedingRecordModel.addOffspring(newOffspringId);
      
      expect(result.isValid).toBe(true);
      expect(breedingRecordModel.offspringIds).toContain(newOffspringId);
      expect(breedingRecordModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid offspring ID', () => {
      const result = breedingRecordModel.addOffspring('invalid-uuid');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Offspring ID must be a valid UUID');
    });

    it('should reject duplicate offspring ID', () => {
      const existingOffspringId = breedingRecordModel.offspringIds[0];
      const result = breedingRecordModel.addOffspring(existingOffspringId);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Offspring is already associated with this breeding record');
    });
  });

  describe('removeOffspring', () => {
    it('should remove existing offspring ID', () => {
      const existingOffspringId = breedingRecordModel.offspringIds[0];
      const result = breedingRecordModel.removeOffspring(existingOffspringId);
      
      expect(result.isValid).toBe(true);
      expect(breedingRecordModel.offspringIds).not.toContain(existingOffspringId);
      expect(breedingRecordModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject removing non-existent offspring ID', () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      const result = breedingRecordModel.removeOffspring(nonExistentId);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Offspring is not associated with this breeding record');
    });
  });

  describe('hasOffspring', () => {
    it('should return true when offspring exist', () => {
      expect(breedingRecordModel.hasOffspring()).toBe(true);
    });

    it('should return false when no offspring exist', () => {
      breedingRecordModel.offspringIds = [];
      expect(breedingRecordModel.hasOffspring()).toBe(false);
    });
  });

  describe('getOffspringCount', () => {
    it('should return correct offspring count', () => {
      expect(breedingRecordModel.getOffspringCount()).toBe(1);
    });

    it('should return zero when no offspring', () => {
      breedingRecordModel.offspringIds = [];
      expect(breedingRecordModel.getOffspringCount()).toBe(0);
    });
  });

  describe('isOverdue', () => {
    it('should return true when past expected due date with no birth', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      breedingRecordModel.expectedDueDate = pastDate;
      breedingRecordModel.actualBirthDate = undefined;
      
      expect(breedingRecordModel.isOverdue()).toBe(true);
    });

    it('should return false when birth is recorded', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      breedingRecordModel.expectedDueDate = pastDate;
      breedingRecordModel.actualBirthDate = new Date();
      
      expect(breedingRecordModel.isOverdue()).toBe(false);
    });

    it('should return false when no expected due date', () => {
      breedingRecordModel.expectedDueDate = undefined;
      expect(breedingRecordModel.isOverdue()).toBe(false);
    });
  });

  describe('getGestationPeriod', () => {
    it('should calculate gestation period correctly', () => {
      breedingRecordModel.breedingDate = new Date('2023-01-01');
      breedingRecordModel.actualBirthDate = new Date('2023-11-15');
      
      const gestationDays = breedingRecordModel.getGestationPeriod();
      expect(gestationDays).toBe(318); // Days between Jan 1 and Nov 15
    });

    it('should return null when no birth date', () => {
      breedingRecordModel.actualBirthDate = undefined;
      expect(breedingRecordModel.getGestationPeriod()).toBeNull();
    });
  });

  describe('isNormalGestationPeriod', () => {
    it('should return true for normal gestation period', () => {
      breedingRecordModel.breedingDate = new Date('2023-01-01');
      breedingRecordModel.actualBirthDate = new Date('2023-11-15'); // ~318 days
      
      expect(breedingRecordModel.isNormalGestationPeriod()).toBe(false); // 318 is slightly below normal range
    });

    it('should return true for gestation within normal range', () => {
      breedingRecordModel.breedingDate = new Date('2023-01-01');
      breedingRecordModel.actualBirthDate = new Date('2023-12-01'); // ~334 days
      
      expect(breedingRecordModel.isNormalGestationPeriod()).toBe(true);
    });

    it('should return null when no birth date', () => {
      breedingRecordModel.actualBirthDate = undefined;
      expect(breedingRecordModel.isNormalGestationPeriod()).toBeNull();
    });
  });

  describe('validateParentRelationships', () => {
    it('should return valid when both parents exist', () => {
      const result = breedingRecordModel.validateParentRelationships(true, true);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when sire does not exist', () => {
      const result = breedingRecordModel.validateParentRelationships(false, true);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Sire with ID ${breedingRecordModel.sireId} does not exist`);
    });

    it('should return invalid when dam does not exist', () => {
      const result = breedingRecordModel.validateParentRelationships(true, false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Dam with ID ${breedingRecordModel.damId} does not exist`);
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with all breeding record properties', () => {
      const json = breedingRecordModel.toJSON();
      expect(json).toEqual(breedingRecordData);
      expect(json).not.toBeInstanceOf(BreedingRecordModel);
      expect(json.offspringIds).not.toBe(breedingRecordModel.offspringIds); // Should be a copy
    });
  });
});