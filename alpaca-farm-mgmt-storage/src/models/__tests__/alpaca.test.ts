import { describe, it, expect, beforeEach } from 'vitest';
import { AlpacaModel, AlpacaValidation, Alpaca, CreateAlpacaInput, UpdateAlpacaInput } from '../alpaca';
import { Gender } from '../common';

describe('AlpacaValidation', () => {
  describe('validateCreateInput', () => {
    let validInput: CreateAlpacaInput;

    beforeEach(() => {
      validInput = {
        name: 'Test Alpaca',
        birthDate: new Date('2020-01-01'),
        gender: 'female' as Gender,
        color: 'white',
        offspringIds: []
      };
    });

    it('should validate a valid alpaca input', () => {
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty name', () => {
      validInput.name = '';
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required and must be non-empty');
    });

    it('should reject whitespace-only name', () => {
      validInput.name = '   ';
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required and must be non-empty');
    });

    it('should reject future birth date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      validInput.birthDate = futureDate;
      
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Birth date must be a valid date not in the future');
    });

    it('should reject invalid gender', () => {
      (validInput as any).gender = 'invalid';
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Gender must be either "male" or "female"');
    });

    it('should reject empty color', () => {
      validInput.color = '';
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Color is required and must be non-empty');
    });

    it('should reject negative weight', () => {
      validInput.weight = -10;
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Weight must be a positive number if provided');
    });

    it('should reject negative height', () => {
      validInput.height = -5;
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Height must be a positive number if provided');
    });

    it('should reject invalid UUID for sireId', () => {
      validInput.sireId = 'invalid-uuid';
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sire ID must be a valid UUID if provided');
    });

    it('should reject invalid UUID for damId', () => {
      validInput.damId = 'invalid-uuid';
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dam ID must be a valid UUID if provided');
    });

    it('should accept valid UUIDs for parent IDs', () => {
      validInput.sireId = '123e4567-e89b-12d3-a456-426614174000';
      validInput.damId = '123e4567-e89b-12d3-a456-426614174001';
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
    });

    it('should validate fiber quality', () => {
      validInput.fiberQuality = {
        micronCount: -1,
        stapleLength: 0,
        crimp: '',
        density: '   '
      };
      
      const result = AlpacaValidation.validateCreateInput(validInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Micron count must be a positive number');
      expect(result.errors).toContain('Staple length must be a positive number');
      expect(result.errors).toContain('Crimp must be a non-empty string');
      expect(result.errors).toContain('Density must be a non-empty string');
    });
  });

  describe('validateUpdateInput', () => {
    it('should validate partial updates', () => {
      const updateInput: UpdateAlpacaInput = {
        name: 'Updated Name',
        weight: 150
      };
      
      const result = AlpacaValidation.validateUpdateInput(updateInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid partial updates', () => {
      const updateInput: UpdateAlpacaInput = {
        name: '',
        weight: -10
      };
      
      const result = AlpacaValidation.validateUpdateInput(updateInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be non-empty if provided');
      expect(result.errors).toContain('Weight must be a positive number if provided');
    });
  });
});

describe('AlpacaModel', () => {
  let alpacaData: Alpaca;
  let alpacaModel: AlpacaModel;

  beforeEach(() => {
    alpacaData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Alpaca',
      birthDate: new Date('2020-01-01'),
      gender: 'female' as Gender,
      color: 'white',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    };
    alpacaModel = new AlpacaModel(alpacaData);
  });

  describe('constructor', () => {
    it('should create an alpaca model with all properties', () => {
      expect(alpacaModel.id).toBe(alpacaData.id);
      expect(alpacaModel.name).toBe(alpacaData.name);
      expect(alpacaModel.birthDate).toBe(alpacaData.birthDate);
      expect(alpacaModel.gender).toBe(alpacaData.gender);
      expect(alpacaModel.color).toBe(alpacaData.color);
      expect(alpacaModel.createdAt).toBe(alpacaData.createdAt);
      expect(alpacaModel.updatedAt).toBe(alpacaData.updatedAt);
    });
  });

  describe('validate', () => {
    it('should validate a valid alpaca model', () => {
      const result = alpacaModel.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      alpacaModel.name = '';
      const result = alpacaModel.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('update', () => {
    it('should update valid fields and return success', () => {
      const updates: UpdateAlpacaInput = {
        name: 'Updated Name',
        weight: 150
      };
      
      const result = alpacaModel.update(updates);
      expect(result.isValid).toBe(true);
      expect(alpacaModel.name).toBe('Updated Name');
      expect(alpacaModel.weight).toBe(150);
      expect(alpacaModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid updates and not modify the model', () => {
      const originalName = alpacaModel.name;
      const originalUpdatedAt = alpacaModel.updatedAt;
      
      const updates: UpdateAlpacaInput = {
        name: '',
        weight: -10
      };
      
      const result = alpacaModel.update(updates);
      expect(result.isValid).toBe(false);
      expect(alpacaModel.name).toBe(originalName);
      expect(alpacaModel.updatedAt).toBe(originalUpdatedAt);
    });
  });

  describe('getAge', () => {
    it('should calculate age correctly', () => {
      // Set birth date to exactly 3 years ago
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      alpacaModel.birthDate = threeYearsAgo;
      
      expect(alpacaModel.getAge()).toBe(3);
    });

    it('should handle birthday not yet occurred this year', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 2, today.getMonth() + 1, today.getDate());
      alpacaModel.birthDate = birthDate;
      
      expect(alpacaModel.getAge()).toBe(1);
    });
  });

  describe('isBreedingAge', () => {
    it('should return true for female alpaca over 18 months', () => {
      const twentyMonthsAgo = new Date();
      twentyMonthsAgo.setMonth(twentyMonthsAgo.getMonth() - 20);
      alpacaModel.birthDate = twentyMonthsAgo;
      alpacaModel.gender = 'female';
      
      expect(alpacaModel.isBreedingAge()).toBe(true);
    });

    it('should return false for female alpaca under 18 months', () => {
      const tenMonthsAgo = new Date();
      tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 10);
      alpacaModel.birthDate = tenMonthsAgo;
      alpacaModel.gender = 'female';
      
      expect(alpacaModel.isBreedingAge()).toBe(false);
    });

    it('should return true for male alpaca over 24 months', () => {
      const thirtyMonthsAgo = new Date();
      thirtyMonthsAgo.setMonth(thirtyMonthsAgo.getMonth() - 30);
      alpacaModel.birthDate = thirtyMonthsAgo;
      alpacaModel.gender = 'male';
      
      expect(alpacaModel.isBreedingAge()).toBe(true);
    });

    it('should return false for male alpaca under 24 months', () => {
      const twentyMonthsAgo = new Date();
      twentyMonthsAgo.setMonth(twentyMonthsAgo.getMonth() - 20);
      alpacaModel.birthDate = twentyMonthsAgo;
      alpacaModel.gender = 'male';
      
      expect(alpacaModel.isBreedingAge()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with all alpaca properties', () => {
      const json = alpacaModel.toJSON();
      expect(json).toEqual(alpacaData);
      expect(json).not.toBeInstanceOf(AlpacaModel);
    });
  });
});