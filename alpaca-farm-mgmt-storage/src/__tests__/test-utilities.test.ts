/**
 * Test file to verify test utilities and data factories work correctly
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  generateTestUUID, 
  generateTestDate, 
  TestDataUtils,
  MockUtils,
  TestAssertions 
} from './test-utils';
import { 
  AlpacaFactory, 
  HealthRecordFactory, 
  BreedingRecordFactory, 
  ManagementActivityFactory,
  TestDataFactory 
} from './data-factories';
import { 
  MockAlpacaRepositoryFactory,
  MockHealthRepositoryFactory,
  MockBreedingRepositoryFactory,
  MockActivityRepositoryFactory 
} from './mock-factories';

describe('Test Utilities', () => {
  beforeEach(() => {
    MockUtils.clearAllMocks();
  });

  describe('generateTestUUID', () => {
    it('should generate a valid UUID format', () => {
      const uuid = generateTestUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateTestUUID();
      const uuid2 = generateTestUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('generateTestDate', () => {
    it('should generate a date in the past', () => {
      const testDate = generateTestDate(1);
      const now = new Date();
      expect(testDate.getTime()).toBeLessThan(now.getTime());
    });

    it('should generate dates with different years ago', () => {
      const date1 = generateTestDate(1);
      const date2 = generateTestDate(2);
      expect(date1.getTime()).toBeGreaterThan(date2.getTime());
    });
  });

  describe('TestDataUtils', () => {
    it('should generate registration numbers', () => {
      const regNum = TestDataUtils.generateRegistrationNumber();
      expect(regNum).toMatch(/^(REG|ALP|HRD|FAM)\d{4}$/);
    });

    it('should generate alpaca names', () => {
      const name = TestDataUtils.generateAlpacaName();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should generate weights in valid range', () => {
      const weight = TestDataUtils.generateWeight();
      expect(weight).toBeGreaterThanOrEqual(120);
      expect(weight).toBeLessThanOrEqual(200);
    });
  });

  describe('TestAssertions', () => {
    it('should validate successful validation results', () => {
      const result = { isValid: true, errors: [] };
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should validate failed validation results', () => {
      const result = { isValid: false, errors: ['Test error'] };
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
    });

    it('should check mock function calls', () => {
      const mockFn = vi.fn();
      mockFn('test', 123);
      expect(TestAssertions.wasMockCalledWith(mockFn, 'test', 123)).toBe(true);
      expect(TestAssertions.wasMockCalledTimes(mockFn, 1)).toBe(true);
    });
  });
});

describe('Data Factories', () => {
  describe('AlpacaFactory', () => {
    it('should create a complete alpaca', () => {
      const alpaca = AlpacaFactory.create();
      
      expect(alpaca).toHaveProperty('id');
      expect(alpaca).toHaveProperty('name');
      expect(alpaca).toHaveProperty('birthDate');
      expect(alpaca).toHaveProperty('gender');
      expect(alpaca).toHaveProperty('color');
      expect(alpaca).toHaveProperty('createdAt');
      expect(alpaca).toHaveProperty('updatedAt');
    });

    it('should create alpaca with overrides', () => {
      const alpaca = AlpacaFactory.create({ name: 'Custom Name' });
      expect(alpaca.name).toBe('Custom Name');
    });

    it('should create minimal alpaca', () => {
      const alpaca = AlpacaFactory.createMinimal();
      expect(alpaca).toHaveProperty('id');
      expect(alpaca).toHaveProperty('name');
      expect(alpaca).toHaveProperty('birthDate');
      expect(alpaca).toHaveProperty('gender');
      expect(alpaca).toHaveProperty('color');
    });

    it('should create create input', () => {
      const input = AlpacaFactory.createInput();
      expect(input).not.toHaveProperty('id');
      expect(input).not.toHaveProperty('createdAt');
      expect(input).not.toHaveProperty('updatedAt');
      expect(input).toHaveProperty('name');
      expect(input).toHaveProperty('birthDate');
    });

    it('should create breeding pair', () => {
      const { sire, dam } = AlpacaFactory.createBreedingPair();
      expect(sire.gender).toBe('male');
      expect(dam.gender).toBe('female');
    });

    it('should create multiple alpacas', () => {
      const alpacas = AlpacaFactory.createMultiple(3);
      expect(alpacas).toHaveLength(3);
      alpacas.forEach(alpaca => {
        expect(alpaca).toHaveProperty('id');
        expect(alpaca).toHaveProperty('name');
      });
    });
  });

  describe('HealthRecordFactory', () => {
    it('should create a complete health record', () => {
      const record = HealthRecordFactory.create();
      
      expect(record).toHaveProperty('id');
      expect(record).toHaveProperty('alpacaId');
      expect(record).toHaveProperty('recordType');
      expect(record).toHaveProperty('date');
      expect(record).toHaveProperty('description');
    });

    it('should create health record by type', () => {
      const record = HealthRecordFactory.createByType('vaccination');
      expect(record.recordType).toBe('vaccination');
      expect(record.description).toContain('vaccination');
    });

    it('should create multiple health records', () => {
      const alpacaId = generateTestUUID();
      const records = HealthRecordFactory.createMultiple(3, alpacaId);
      
      expect(records).toHaveLength(3);
      records.forEach(record => {
        expect(record.alpacaId).toBe(alpacaId);
      });
    });
  });

  describe('BreedingRecordFactory', () => {
    it('should create a complete breeding record', () => {
      const record = BreedingRecordFactory.create();
      
      expect(record).toHaveProperty('id');
      expect(record).toHaveProperty('sireId');
      expect(record).toHaveProperty('damId');
      expect(record).toHaveProperty('breedingDate');
      expect(record).toHaveProperty('offspringIds');
    });

    it('should create breeding record with offspring', () => {
      const record = BreedingRecordFactory.createWithOffspring(2);
      expect(record.offspringIds).toHaveLength(2);
      expect(record.actualBirthDate).toBeDefined();
    });

    it('should create breeding record for specific alpacas', () => {
      const sireId = generateTestUUID();
      const damId = generateTestUUID();
      const record = BreedingRecordFactory.createForAlpacas(sireId, damId);
      
      expect(record.sireId).toBe(sireId);
      expect(record.damId).toBe(damId);
    });
  });

  describe('ManagementActivityFactory', () => {
    it('should create a complete management activity', () => {
      const activity = ManagementActivityFactory.create();
      
      expect(activity).toHaveProperty('id');
      expect(activity).toHaveProperty('activityType');
      expect(activity).toHaveProperty('date');
      expect(activity).toHaveProperty('alpacaIds');
      expect(activity).toHaveProperty('performedBy');
      expect(activity).toHaveProperty('description');
    });

    it('should create bulk activity', () => {
      const activity = ManagementActivityFactory.createBulkActivity(5);
      expect(activity.alpacaIds).toHaveLength(5);
    });

    it('should create activity by type', () => {
      const activity = ManagementActivityFactory.createByType('shearing');
      expect(activity.activityType).toBe('shearing');
      expect(activity.description).toContain('shearing');
    });
  });

  describe('TestDataFactory', () => {
    it('should create alpaca with health records', () => {
      const { alpaca, healthRecords } = TestDataFactory.createAlpacaWithHealthRecords(3);
      
      expect(alpaca).toHaveProperty('id');
      expect(healthRecords).toHaveLength(3);
      healthRecords.forEach(record => {
        expect(record.alpacaId).toBe(alpaca.id);
      });
    });

    it('should create breeding scenario', () => {
      const { sire, dam, breedingRecord } = TestDataFactory.createBreedingScenario();
      
      expect(sire.gender).toBe('male');
      expect(dam.gender).toBe('female');
      expect(breedingRecord.sireId).toBe(sire.id);
      expect(breedingRecord.damId).toBe(dam.id);
    });

    it('should create test herd', () => {
      const { alpacas, healthRecords, breedingRecords, activities } = TestDataFactory.createTestHerd(5);
      
      expect(alpacas).toHaveLength(5);
      expect(healthRecords.length).toBeGreaterThan(0);
      expect(activities.length).toBeGreaterThan(0);
    });
  });
});

describe('Mock Factories', () => {
  describe('MockAlpacaRepositoryFactory', () => {
    it('should create mock repository with all methods', () => {
      const mockRepo = MockAlpacaRepositoryFactory.create();
      
      expect(mockRepo.create).toBeDefined();
      expect(mockRepo.findById).toBeDefined();
      expect(mockRepo.findAll).toBeDefined();
      expect(mockRepo.update).toBeDefined();
      expect(mockRepo.delete).toBeDefined();
      expect(mockRepo.findByRegistrationNumber).toBeDefined();
      expect(mockRepo.getLineage).toBeDefined();
    });

    it('should create mock repository with defaults', () => {
      const alpaca = AlpacaFactory.create();
      const mockRepo = MockAlpacaRepositoryFactory.createWithDefaults({
        alpacas: [alpaca],
        defaultAlpaca: alpaca
      });
      
      expect(mockRepo.create).toBeDefined();
      expect(mockRepo.findById).toBeDefined();
    });

    it('should create mock repository with errors', () => {
      const mockRepo = MockAlpacaRepositoryFactory.createWithErrors();
      
      expect(mockRepo.create).toBeDefined();
      expect(mockRepo.findById).toBeDefined();
    });
  });

  describe('MockHealthRepositoryFactory', () => {
    it('should create mock health repository', () => {
      const mockRepo = MockHealthRepositoryFactory.create();
      
      expect(mockRepo.create).toBeDefined();
      expect(mockRepo.findById).toBeDefined();
      expect(mockRepo.findByAlpacaId).toBeDefined();
      expect(mockRepo.findOverdueRecords).toBeDefined();
    });
  });

  describe('MockBreedingRepositoryFactory', () => {
    it('should create mock breeding repository', () => {
      const mockRepo = MockBreedingRepositoryFactory.create();
      
      expect(mockRepo.create).toBeDefined();
      expect(mockRepo.findBySire).toBeDefined();
      expect(mockRepo.findByDam).toBeDefined();
      expect(mockRepo.checkInbreeding).toBeDefined();
    });
  });

  describe('MockActivityRepositoryFactory', () => {
    it('should create mock activity repository', () => {
      const mockRepo = MockActivityRepositoryFactory.create();
      
      expect(mockRepo.create).toBeDefined();
      expect(mockRepo.findByAlpacaId).toBeDefined();
      expect(mockRepo.findByActivityType).toBeDefined();
      expect(mockRepo.findByDateRange).toBeDefined();
    });
  });
});