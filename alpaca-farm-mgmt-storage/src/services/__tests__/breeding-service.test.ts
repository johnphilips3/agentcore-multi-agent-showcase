import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BreedingServiceImpl, BreedingServiceError } from '../breeding-service';
import { BreedingRepository } from '../../repositories';
import { AlpacaRepository, LineageTree } from '../../repositories';
import { BreedingRecord, CreateBreedingRecordInput, UpdateBreedingRecordInput, Alpaca } from '../../models';

// Mock repositories
const mockBreedingRepository: BreedingRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByParent: vi.fn(),
  findByDateRange: vi.fn(),
  checkInbreeding: vi.fn()
};

const mockAlpacaRepository: AlpacaRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByRegistrationNumber: vi.fn(),
  findByParent: vi.fn(),
  findByGender: vi.fn(),
  getLineage: vi.fn()
};

describe('BreedingService', () => {
  let service: BreedingServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BreedingServiceImpl(mockBreedingRepository, mockAlpacaRepository);
  });

  const mockSire: Alpaca = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Sire',
    birthDate: new Date('2018-01-01'),
    gender: 'male',
    color: 'brown',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockDam: Alpaca = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Test Dam',
    birthDate: new Date('2019-01-01'),
    gender: 'female',
    color: 'white',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockOffspring: Alpaca = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Test Offspring',
    birthDate: new Date('2023-01-01'),
    gender: 'female',
    color: 'gray',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockBreedingRecord: BreedingRecord = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    sireId: mockSire.id,
    damId: mockDam.id,
    breedingDate: new Date('2022-02-01'),
    expectedDueDate: new Date('2023-01-01'),
    actualBirthDate: new Date('2023-01-05'),
    offspringIds: [mockOffspring.id],
    notes: 'Successful breeding',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  describe('createBreedingRecord', () => {
    it('should successfully create a valid breeding record', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: mockSire.id,
        damId: mockDam.id,
        breedingDate: new Date('2022-02-01'),
        expectedDueDate: new Date('2023-01-01'),
        offspringIds: []
      };

      // Mock findById calls for both creation validation and compatibility check
      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)  // First call for sire in createBreedingRecord
        .mockResolvedValueOnce(mockDam)   // Second call for dam in createBreedingRecord
        .mockResolvedValueOnce(mockSire)  // Third call for sire in checkBreedingCompatibility
        .mockResolvedValueOnce(mockDam);  // Fourth call for dam in checkBreedingCompatibility
      
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(false);
      vi.mocked(mockAlpacaRepository.getLineage).mockResolvedValue(null);
      vi.mocked(mockBreedingRepository.findByParent).mockResolvedValue([]);
      vi.mocked(mockBreedingRepository.create).mockResolvedValue(mockBreedingRecord);

      const result = await service.createBreedingRecord(input);

      expect(result).toEqual(mockBreedingRecord);
      expect(mockBreedingRepository.create).toHaveBeenCalledWith(input);
    });

    it('should fail creation with invalid input', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: 'invalid-id', // Invalid UUID
        damId: mockDam.id,
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      await expect(service.createBreedingRecord(input))
        .rejects.toThrow(BreedingServiceError);
    });

    it('should fail creation when sire does not exist', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: mockSire.id,
        damId: mockDam.id,
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockDam);

      await expect(service.createBreedingRecord(input))
        .rejects.toThrow('Sire not found');
    });

    it('should fail creation when dam does not exist', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: mockSire.id,
        damId: mockDam.id,
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)
        .mockResolvedValueOnce(null);

      await expect(service.createBreedingRecord(input))
        .rejects.toThrow('Dam not found');
    });

    it('should fail creation when sire is not male', async () => {
      const femaleSire = { ...mockSire, gender: 'female' as const };
      const input: CreateBreedingRecordInput = {
        sireId: mockSire.id,
        damId: mockDam.id,
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(femaleSire)
        .mockResolvedValueOnce(mockDam);

      await expect(service.createBreedingRecord(input))
        .rejects.toThrow('Sire must be male');
    });

    it('should fail creation when dam is not female', async () => {
      const maleDam = { ...mockDam, gender: 'male' as const };
      const input: CreateBreedingRecordInput = {
        sireId: mockSire.id,
        damId: mockDam.id,
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)
        .mockResolvedValueOnce(maleDam);

      await expect(service.createBreedingRecord(input))
        .rejects.toThrow('Dam must be female');
    });

    it('should fail creation when inbreeding is detected', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: mockSire.id,
        damId: mockDam.id,
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)
        .mockResolvedValueOnce(mockDam);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(true);
      vi.mocked(mockAlpacaRepository.getLineage).mockResolvedValue(null);

      await expect(service.createBreedingRecord(input))
        .rejects.toThrow('Breeding not compatible');
    });
  });

  describe('updateBreedingRecord', () => {
    it('should successfully update a breeding record', async () => {
      const updates: UpdateBreedingRecordInput = {
        notes: 'Updated notes',
        actualBirthDate: new Date('2023-01-10')
      };

      const updatedRecord = { ...mockBreedingRecord, ...updates };

      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(mockBreedingRecord);
      vi.mocked(mockBreedingRepository.update).mockResolvedValue(updatedRecord);

      const result = await service.updateBreedingRecord(mockBreedingRecord.id, updates);

      expect(result).toEqual(updatedRecord);
      expect(mockBreedingRepository.update).toHaveBeenCalledWith(mockBreedingRecord.id, updates);
    });

    it('should throw error when updating non-existent breeding record', async () => {
      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(null);

      await expect(service.updateBreedingRecord('invalid-id', { notes: 'Updated' }))
        .rejects.toThrow('Breeding record not found');
    });

    it('should validate new sire when updating sireId', async () => {
      const updates: UpdateBreedingRecordInput = {
        sireId: '550e8400-e29b-41d4-a716-446655440004'
      };

      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(mockBreedingRecord);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      await expect(service.updateBreedingRecord(mockBreedingRecord.id, updates))
        .rejects.toThrow('Sire not found');
    });
  });

  describe('getBreedingRecord', () => {
    it('should return breeding record by ID', async () => {
      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(mockBreedingRecord);

      const result = await service.getBreedingRecord(mockBreedingRecord.id);

      expect(result).toEqual(mockBreedingRecord);
      expect(mockBreedingRepository.findById).toHaveBeenCalledWith(mockBreedingRecord.id);
    });

    it('should return null for non-existent breeding record', async () => {
      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(null);

      const result = await service.getBreedingRecord('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('getAllBreedingRecords', () => {
    it('should return all breeding records', async () => {
      const breedingRecords = [mockBreedingRecord];
      vi.mocked(mockBreedingRepository.findAll).mockResolvedValue(breedingRecords);

      const result = await service.getAllBreedingRecords();

      expect(result).toEqual(breedingRecords);
      expect(mockBreedingRepository.findAll).toHaveBeenCalled();
    });

    it('should pass query options to repository', async () => {
      const options = { limit: 10, offset: 0 };
      vi.mocked(mockBreedingRepository.findAll).mockResolvedValue([]);

      await service.getAllBreedingRecords(options);

      expect(mockBreedingRepository.findAll).toHaveBeenCalledWith(options);
    });
  });

  describe('getBreedingRecordsByParent', () => {
    it('should return breeding records for a parent', async () => {
      const breedingRecords = [mockBreedingRecord];

      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockSire);
      vi.mocked(mockBreedingRepository.findByParent).mockResolvedValue(breedingRecords);

      const result = await service.getBreedingRecordsByParent(mockSire.id);

      expect(result).toEqual(breedingRecords);
      expect(mockAlpacaRepository.findById).toHaveBeenCalledWith(mockSire.id);
      expect(mockBreedingRepository.findByParent).toHaveBeenCalledWith(mockSire.id);
    });

    it('should throw error for non-existent parent', async () => {
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      await expect(service.getBreedingRecordsByParent('invalid-id'))
        .rejects.toThrow('Parent alpaca not found');
    });
  });

  describe('getBreedingRecordsByDateRange', () => {
    it('should return breeding records within date range', async () => {
      const startDate = new Date('2022-01-01');
      const endDate = new Date('2022-12-31');
      const breedingRecords = [mockBreedingRecord];

      vi.mocked(mockBreedingRepository.findByDateRange).mockResolvedValue(breedingRecords);

      const result = await service.getBreedingRecordsByDateRange(startDate, endDate);

      expect(result).toEqual(breedingRecords);
      expect(mockBreedingRepository.findByDateRange).toHaveBeenCalledWith(startDate, endDate);
    });

    it('should throw error when start date is after end date', async () => {
      const startDate = new Date('2022-12-31');
      const endDate = new Date('2022-01-01');

      await expect(service.getBreedingRecordsByDateRange(startDate, endDate))
        .rejects.toThrow('Start date must be before end date');
    });
  });

  describe('checkBreedingCompatibility', () => {
    it('should return compatible for valid breeding pair', async () => {
      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)
        .mockResolvedValueOnce(mockDam);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(false);
      vi.mocked(mockAlpacaRepository.getLineage).mockResolvedValue(null);
      vi.mocked(mockBreedingRepository.findByParent).mockResolvedValue([]);

      const result = await service.checkBreedingCompatibility(mockSire.id, mockDam.id);

      expect(result.compatible).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.riskLevel).toBe('low');
    });

    it('should detect gender issues', async () => {
      const femaleSire = { ...mockSire, gender: 'female' as const };
      const maleDam = { ...mockDam, gender: 'male' as const };

      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(femaleSire)
        .mockResolvedValueOnce(maleDam);

      const result = await service.checkBreedingCompatibility(mockSire.id, mockDam.id);

      expect(result.compatible).toBe(false);
      expect(result.reasons).toContain('Sire must be male');
      expect(result.reasons).toContain('Dam must be female');
    });

    it('should detect inbreeding', async () => {
      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)
        .mockResolvedValueOnce(mockDam);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(true);

      const result = await service.checkBreedingCompatibility(mockSire.id, mockDam.id);

      expect(result.compatible).toBe(false);
      expect(result.reasons).toContain('Close genetic relationship detected (inbreeding risk)');
      expect(result.riskLevel).toBe('high');
    });

    it('should detect age issues', async () => {
      const youngSire = { ...mockSire, birthDate: new Date() }; // Just born
      const youngDam = { ...mockDam, birthDate: new Date() }; // Just born

      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(youngSire)
        .mockResolvedValueOnce(youngDam);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(false);
      vi.mocked(mockAlpacaRepository.getLineage).mockResolvedValue(null);

      const result = await service.checkBreedingCompatibility(mockSire.id, mockDam.id);

      expect(result.compatible).toBe(false);
      expect(result.reasons).toContain('Sire is too young (under 2 years)');
      expect(result.reasons).toContain('Dam is too young (under 18 months)');
    });
  });

  describe('validateGeneticCompatibility', () => {
    it('should validate compatible breeding pair', async () => {
      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)
        .mockResolvedValueOnce(mockDam);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(false);
      vi.mocked(mockAlpacaRepository.getLineage).mockResolvedValue(null);
      vi.mocked(mockBreedingRepository.findByParent).mockResolvedValue([]);

      const result = await service.validateGeneticCompatibility(mockSire.id, mockDam.id);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect incompatible breeding pair', async () => {
      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)
        .mockResolvedValueOnce(mockDam);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(true);

      const result = await service.validateGeneticCompatibility(mockSire.id, mockDam.id);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('addOffspring', () => {
    it('should successfully add offspring to breeding record', async () => {
      const breedingWithoutOffspring = { ...mockBreedingRecord, offspringIds: [] };
      const updatedBreeding = { ...mockBreedingRecord, offspringIds: [mockOffspring.id] };

      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(breedingWithoutOffspring);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockOffspring);
      vi.mocked(mockBreedingRepository.update).mockResolvedValue(updatedBreeding);

      const result = await service.addOffspring(mockBreedingRecord.id, mockOffspring.id);

      expect(result).toEqual(updatedBreeding);
      expect(mockBreedingRepository.update).toHaveBeenCalledWith(
        mockBreedingRecord.id,
        { offspringIds: [mockOffspring.id] }
      );
    });

    it('should throw error when breeding record does not exist', async () => {
      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(null);

      await expect(service.addOffspring('invalid-id', mockOffspring.id))
        .rejects.toThrow('Breeding record not found');
    });

    it('should throw error when offspring does not exist', async () => {
      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(mockBreedingRecord);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      await expect(service.addOffspring(mockBreedingRecord.id, 'invalid-offspring-id'))
        .rejects.toThrow('Offspring not found');
    });

    it('should throw error when offspring is already associated', async () => {
      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(mockBreedingRecord);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockOffspring);

      await expect(service.addOffspring(mockBreedingRecord.id, mockOffspring.id))
        .rejects.toThrow('Offspring is already associated with this breeding record');
    });
  });

  describe('removeOffspring', () => {
    it('should successfully remove offspring from breeding record', async () => {
      const updatedBreeding = { ...mockBreedingRecord, offspringIds: [] };

      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(mockBreedingRecord);
      vi.mocked(mockBreedingRepository.update).mockResolvedValue(updatedBreeding);

      const result = await service.removeOffspring(mockBreedingRecord.id, mockOffspring.id);

      expect(result).toEqual(updatedBreeding);
      expect(mockBreedingRepository.update).toHaveBeenCalledWith(
        mockBreedingRecord.id,
        { offspringIds: [] }
      );
    });

    it('should throw error when offspring is not associated', async () => {
      const breedingWithoutOffspring = { ...mockBreedingRecord, offspringIds: [] };

      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(breedingWithoutOffspring);

      await expect(service.removeOffspring(mockBreedingRecord.id, mockOffspring.id))
        .rejects.toThrow('Offspring is not associated with this breeding record');
    });
  });

  describe('getBreedingStatistics', () => {
    it('should calculate correct breeding statistics', async () => {
      const breedingRecords = [
        mockBreedingRecord,
        {
          ...mockBreedingRecord,
          id: '550e8400-e29b-41d4-a716-446655440004',
          offspringIds: [],
          actualBirthDate: undefined
        }
      ];

      vi.mocked(mockBreedingRepository.findAll).mockResolvedValue(breedingRecords);
      vi.mocked(mockAlpacaRepository.findAll).mockResolvedValue([mockSire, mockDam, mockOffspring]);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(false);

      const result = await service.getBreedingStatistics();

      expect(result.totalBreedings).toBe(2);
      expect(result.successfulBreedings).toBe(1);
      expect(result.activeSires).toBe(1);
      expect(result.activeDams).toBe(1);
      expect(result.inbreedingRate).toBe(0);
    });
  });

  describe('getGeneticDiversityMetrics', () => {
    it('should calculate genetic diversity metrics', async () => {
      const alpacas = [mockSire, mockDam, mockOffspring];
      const breedingRecords = [mockBreedingRecord];

      vi.mocked(mockAlpacaRepository.findAll).mockResolvedValue(alpacas);
      vi.mocked(mockBreedingRepository.findAll).mockResolvedValue(breedingRecords);
      vi.mocked(mockAlpacaRepository.getLineage).mockResolvedValue(null);

      const result = await service.getGeneticDiversityMetrics();

      expect(result.totalBreedingAnimals).toBe(2); // Sire and dam
      expect(result.effectivePopulationSize).toBeGreaterThan(0);
      expect(result.geneticDiversityIndex).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getBreedingRecommendations', () => {
    it('should return breeding recommendations', async () => {
      const alpacas = [mockSire, mockDam];

      vi.mocked(mockAlpacaRepository.findAll).mockResolvedValue(alpacas);
      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValue(mockSire)
        .mockResolvedValue(mockDam);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(false);
      vi.mocked(mockAlpacaRepository.getLineage).mockResolvedValue(null);
      vi.mocked(mockBreedingRepository.findByParent).mockResolvedValue([]);

      const result = await service.getBreedingRecommendations(5);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getBreedingCalendar', () => {
    it('should return breeding calendar entries', async () => {
      const breedingRecords = [mockBreedingRecord];

      vi.mocked(mockBreedingRepository.findAll).mockResolvedValue(breedingRecords);
      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)
        .mockResolvedValueOnce(mockDam);

      const result = await service.getBreedingCalendar(12);

      expect(result).toBeInstanceOf(Array);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('breedingId');
        expect(result[0]).toHaveProperty('sireName');
        expect(result[0]).toHaveProperty('damName');
        expect(result[0]).toHaveProperty('status');
      }
    });
  });

  describe('getOverdueBreedings', () => {
    it('should return overdue breeding records', async () => {
      const overdueBreeding: BreedingRecord = {
        ...mockBreedingRecord,
        expectedDueDate: new Date('2020-01-01'), // Past date
        actualBirthDate: undefined // No birth recorded
      };

      vi.mocked(mockBreedingRepository.findAll).mockResolvedValue([overdueBreeding]);

      const result = await service.getOverdueBreedings();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(overdueBreeding);
    });

    it('should not return breeding records that have given birth', async () => {
      const completedBreeding = mockBreedingRecord; // Has actualBirthDate

      vi.mocked(mockBreedingRepository.findAll).mockResolvedValue([completedBreeding]);

      const result = await service.getOverdueBreedings();

      expect(result).toHaveLength(0);
    });
  });

  describe('removeBreedingRecord', () => {
    it('should successfully remove breeding record', async () => {
      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(mockBreedingRecord);
      vi.mocked(mockBreedingRepository.delete).mockResolvedValue(true);

      const result = await service.removeBreedingRecord(mockBreedingRecord.id);

      expect(result).toBe(true);
      expect(mockBreedingRepository.delete).toHaveBeenCalledWith(mockBreedingRecord.id);
    });

    it('should return false for non-existent breeding record', async () => {
      vi.mocked(mockBreedingRepository.findById).mockResolvedValue(null);

      const result = await service.removeBreedingRecord('invalid-id');

      expect(result).toBe(false);
    });
  });

  describe('calculateInbreedingCoefficient', () => {
    it('should return 0 when no lineage data is available', async () => {
      vi.mocked(mockAlpacaRepository.getLineage).mockResolvedValue(null);

      const result = await service.calculateInbreedingCoefficient(mockSire.id, mockDam.id);

      expect(result).toBe(0);
    });

    it('should return 0 when no common ancestors are found', async () => {
      const sireLineage: LineageTree = {
        alpaca: mockSire
      };
      const damLineage: LineageTree = {
        alpaca: mockDam
      };

      vi.mocked(mockAlpacaRepository.getLineage)
        .mockResolvedValueOnce(sireLineage)
        .mockResolvedValueOnce(damLineage);

      const result = await service.calculateInbreedingCoefficient(mockSire.id, mockDam.id);

      expect(result).toBe(0);
    });

    it('should calculate coefficient when common ancestors exist', async () => {
      const commonAncestor: Alpaca = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        name: 'Common Ancestor',
        birthDate: new Date('2015-01-01'),
        gender: 'male',
        color: 'brown',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const sireLineage: LineageTree = {
        alpaca: mockSire,
        sire: { alpaca: commonAncestor }
      };
      const damLineage: LineageTree = {
        alpaca: mockDam,
        sire: { alpaca: commonAncestor }
      };

      vi.mocked(mockAlpacaRepository.getLineage)
        .mockResolvedValueOnce(sireLineage)
        .mockResolvedValueOnce(damLineage);

      const result = await service.calculateInbreedingCoefficient(mockSire.id, mockDam.id);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should wrap repository errors in service errors', async () => {
      const repositoryError = new Error('Database connection failed');
      vi.mocked(mockBreedingRepository.findById).mockRejectedValue(repositoryError);

      await expect(service.getBreedingRecord(mockBreedingRecord.id))
        .rejects.toThrow(BreedingServiceError);
    });
  });
});