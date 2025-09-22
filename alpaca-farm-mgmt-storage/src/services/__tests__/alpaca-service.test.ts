import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlpacaServiceImpl, AlpacaServiceError } from '../alpaca-service';
import { AlpacaRepository, LineageTree } from '../../repositories';
import { BreedingRepository } from '../../repositories';
import { Alpaca, CreateAlpacaInput, UpdateAlpacaInput } from '../../models';

// Mock repositories
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

describe('AlpacaService', () => {
  let service: AlpacaServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AlpacaServiceImpl(mockAlpacaRepository, mockBreedingRepository);
  });

  const mockAlpaca: Alpaca = {
    id: 'alpaca-1',
    name: 'Test Alpaca',
    registrationNumber: 'REG001',
    birthDate: new Date('2020-01-01'),
    gender: 'female',
    color: 'white',
    weight: 150,
    height: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockSire: Alpaca = {
    id: 'sire-1',
    name: 'Test Sire',
    birthDate: new Date('2018-01-01'),
    gender: 'male',
    color: 'brown',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockDam: Alpaca = {
    id: 'dam-1',
    name: 'Test Dam',
    birthDate: new Date('2019-01-01'),
    gender: 'female',
    color: 'black',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  describe('registerAlpaca', () => {
    it('should successfully register a valid alpaca', async () => {
      const input: CreateAlpacaInput = {
        name: 'New Alpaca',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'white'
      };

      vi.mocked(mockAlpacaRepository.create).mockResolvedValue(mockAlpaca);

      const result = await service.registerAlpaca(input);

      expect(result.success).toBe(true);
      expect(result.alpaca).toEqual(mockAlpaca);
      expect(result.errors).toHaveLength(0);
      expect(mockAlpacaRepository.create).toHaveBeenCalledWith(input);
    });

    it('should fail registration with invalid input', async () => {
      const input: CreateAlpacaInput = {
        name: '', // Invalid empty name
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'white'
      };

      const result = await service.registerAlpaca(input);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Name is required and must be non-empty');
      expect(mockAlpacaRepository.create).not.toHaveBeenCalled();
    });

    it('should fail registration with duplicate registration number', async () => {
      const input: CreateAlpacaInput = {
        name: 'New Alpaca',
        registrationNumber: 'REG001',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'white'
      };

      vi.mocked(mockAlpacaRepository.findByRegistrationNumber).mockResolvedValue(mockAlpaca);

      const result = await service.registerAlpaca(input);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Registration number already exists');
      expect(mockAlpacaRepository.create).not.toHaveBeenCalled();
    });

    it('should validate parent relationships during registration', async () => {
      const input: CreateAlpacaInput = {
        name: 'New Alpaca',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'white',
        sireId: '550e8400-e29b-41d4-a716-446655440000' // Valid UUID format
      };

      vi.mocked(mockAlpacaRepository.findByRegistrationNumber).mockResolvedValue(null);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      const result = await service.registerAlpaca(input);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Check that validation failed due to parent relationship issues
      expect(result.errors.some(error => error.includes('Sire not found'))).toBe(true);
    });
  });

  describe('updateAlpaca', () => {
    it('should successfully update an alpaca', async () => {
      const updates: UpdateAlpacaInput = {
        name: 'Updated Name',
        weight: 160
      };

      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);
      vi.mocked(mockAlpacaRepository.update).mockResolvedValue({ ...mockAlpaca, ...updates });

      const result = await service.updateAlpaca('alpaca-1', updates);

      expect(result.name).toBe('Updated Name');
      expect(result.weight).toBe(160);
      expect(mockAlpacaRepository.update).toHaveBeenCalledWith('alpaca-1', updates);
    });

    it('should throw error when updating non-existent alpaca', async () => {
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      await expect(service.updateAlpaca('invalid-id', { name: 'New Name' }))
        .rejects.toThrow(AlpacaServiceError);
    });

    it('should prevent duplicate registration numbers during update', async () => {
      const updates: UpdateAlpacaInput = {
        registrationNumber: 'REG002'
      };

      const existingAlpaca = { ...mockAlpaca, registrationNumber: 'REG001' };
      const duplicateAlpaca = { ...mockAlpaca, id: 'other-id', registrationNumber: 'REG002' };

      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(existingAlpaca);
      vi.mocked(mockAlpacaRepository.findByRegistrationNumber).mockResolvedValue(duplicateAlpaca);

      await expect(service.updateAlpaca('alpaca-1', updates))
        .rejects.toThrow('Registration number already exists');
    });
  });

  describe('getAlpaca', () => {
    it('should return alpaca by ID', async () => {
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);

      const result = await service.getAlpaca('alpaca-1');

      expect(result).toEqual(mockAlpaca);
      expect(mockAlpacaRepository.findById).toHaveBeenCalledWith('alpaca-1');
    });

    it('should return null for non-existent alpaca', async () => {
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      const result = await service.getAlpaca('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('getAlpacaByRegistration', () => {
    it('should return alpaca by registration number', async () => {
      vi.mocked(mockAlpacaRepository.findByRegistrationNumber).mockResolvedValue(mockAlpaca);

      const result = await service.getAlpacaByRegistration('REG001');

      expect(result).toEqual(mockAlpaca);
      expect(mockAlpacaRepository.findByRegistrationNumber).toHaveBeenCalledWith('REG001');
    });
  });

  describe('getAllAlpacas', () => {
    it('should return all alpacas', async () => {
      const alpacas = [mockAlpaca];
      vi.mocked(mockAlpacaRepository.findAll).mockResolvedValue(alpacas);

      const result = await service.getAllAlpacas();

      expect(result).toEqual(alpacas);
      expect(mockAlpacaRepository.findAll).toHaveBeenCalled();
    });

    it('should pass query options to repository', async () => {
      const options = { limit: 10, offset: 0 };
      vi.mocked(mockAlpacaRepository.findAll).mockResolvedValue([]);

      await service.getAllAlpacas(options);

      expect(mockAlpacaRepository.findAll).toHaveBeenCalledWith(options);
    });
  });

  describe('getAlpacasByGender', () => {
    it('should return alpacas by gender', async () => {
      const femaleAlpacas = [mockAlpaca];
      vi.mocked(mockAlpacaRepository.findByGender).mockResolvedValue(femaleAlpacas);

      const result = await service.getAlpacasByGender('female');

      expect(result).toEqual(femaleAlpacas);
      expect(mockAlpacaRepository.findByGender).toHaveBeenCalledWith('female');
    });
  });

  describe('getBreedingAgeAlpacas', () => {
    it('should return breeding age alpacas', async () => {
      const oldEnoughAlpaca: Alpaca = {
        ...mockAlpaca,
        birthDate: new Date('2020-01-01') // Over 18 months old
      };

      const tooYoungAlpaca: Alpaca = {
        ...mockAlpaca,
        id: 'young-alpaca',
        birthDate: new Date() // Just born
      };

      vi.mocked(mockAlpacaRepository.findAll).mockResolvedValue([oldEnoughAlpaca, tooYoungAlpaca]);

      const result = await service.getBreedingAgeAlpacas();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(oldEnoughAlpaca.id);
    });

    it('should filter by gender when specified', async () => {
      const femaleAlpacas = [mockAlpaca];
      vi.mocked(mockAlpacaRepository.findByGender).mockResolvedValue(femaleAlpacas);

      await service.getBreedingAgeAlpacas('female');

      expect(mockAlpacaRepository.findByGender).toHaveBeenCalledWith('female');
    });
  });

  describe('getOffspring', () => {
    it('should return offspring of a parent', async () => {
      const offspring = [mockAlpaca];
      vi.mocked(mockAlpacaRepository.findByParent).mockResolvedValue(offspring);

      const result = await service.getOffspring('parent-id');

      expect(result).toEqual(offspring);
      expect(mockAlpacaRepository.findByParent).toHaveBeenCalledWith('parent-id');
    });
  });

  describe('getLineage', () => {
    it('should return lineage tree', async () => {
      const lineage: LineageTree = {
        alpaca: mockAlpaca,
        sire: { alpaca: mockSire },
        dam: { alpaca: mockDam }
      };

      vi.mocked(mockAlpacaRepository.getLineage).mockResolvedValue(lineage);

      const result = await service.getLineage('alpaca-1', 3);

      expect(result).toEqual(lineage);
      expect(mockAlpacaRepository.getLineage).toHaveBeenCalledWith('alpaca-1', 3);
    });

    it('should validate generation limits', async () => {
      await expect(service.getLineage('alpaca-1', 0))
        .rejects.toThrow('Generations must be at least 1');

      await expect(service.getLineage('alpaca-1', 11))
        .rejects.toThrow('Maximum 10 generations allowed');
    });
  });

  describe('checkBreedingCompatibility', () => {
    it('should return compatible for valid breeding pair', async () => {
      const breedingAgeSire = { ...mockSire, birthDate: new Date('2020-01-01') };
      const breedingAgeDam = { ...mockDam, birthDate: new Date('2020-06-01') };

      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(breedingAgeSire)
        .mockResolvedValueOnce(breedingAgeDam);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(false);

      const result = await service.checkBreedingCompatibility('sire-1', 'dam-1');

      expect(result.compatible).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should detect gender issues', async () => {
      const femaleSire = { ...mockSire, gender: 'female' as const };
      const maleDam = { ...mockDam, gender: 'male' as const };

      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(femaleSire)
        .mockResolvedValueOnce(maleDam);

      const result = await service.checkBreedingCompatibility('sire-1', 'dam-1');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toContain('Sire must be male');
      expect(result.reasons).toContain('Dam must be female');
    });

    it('should detect inbreeding', async () => {
      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)
        .mockResolvedValueOnce(mockDam);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(true);

      const result = await service.checkBreedingCompatibility('sire-1', 'dam-1');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toContain('Breeding would result in inbreeding (close genetic relationship detected)');
    });

    it('should provide age warnings', async () => {
      const oldSire = { ...mockSire, birthDate: new Date('2005-01-01') }; // Very old
      const youngDam = { ...mockDam, birthDate: new Date('2020-01-01') }; // Much younger

      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(oldSire)
        .mockResolvedValueOnce(youngDam);
      vi.mocked(mockBreedingRepository.checkInbreeding).mockResolvedValue(false);

      const result = await service.checkBreedingCompatibility('sire-1', 'dam-1');

      expect(result.warnings).toContain('Sire is quite old (over 15 years)');
      expect(result.warnings).toContain('Large age difference between sire and dam');
    });
  });

  describe('getHerdStatistics', () => {
    it('should calculate correct herd statistics', async () => {
      const alpacas: Alpaca[] = [
        { ...mockAlpaca, gender: 'male', registrationNumber: 'REG001', birthDate: new Date('2020-01-01') },
        { ...mockAlpaca, id: 'alpaca-2', gender: 'female', registrationNumber: 'REG002', birthDate: new Date('2021-01-01') },
        { ...mockAlpaca, id: 'alpaca-3', gender: 'female', registrationNumber: undefined, birthDate: new Date('2022-01-01') }
      ];

      vi.mocked(mockAlpacaRepository.findAll).mockResolvedValue(alpacas);

      const result = await service.getHerdStatistics();

      expect(result.totalCount).toBe(3);
      expect(result.maleCount).toBe(1);
      expect(result.femaleCount).toBe(2);
      expect(result.registeredCount).toBe(2);
      expect(result.averageAge).toBeGreaterThan(0);
    });
  });

  describe('removeAlpaca', () => {
    it('should successfully remove alpaca with no dependencies', async () => {
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);
      vi.mocked(mockAlpacaRepository.findByParent).mockResolvedValue([]);
      vi.mocked(mockBreedingRepository.findByParent).mockResolvedValue([]);
      vi.mocked(mockAlpacaRepository.delete).mockResolvedValue(true);

      const result = await service.removeAlpaca('alpaca-1');

      expect(result).toBe(true);
      expect(mockAlpacaRepository.delete).toHaveBeenCalledWith('alpaca-1');
    });

    it('should prevent removal of alpaca with offspring', async () => {
      const offspring = [{ ...mockAlpaca, id: 'offspring-1' }];

      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);
      vi.mocked(mockAlpacaRepository.findByParent).mockResolvedValue(offspring);

      await expect(service.removeAlpaca('alpaca-1'))
        .rejects.toThrow('Cannot remove alpaca that has offspring');
    });

    it('should return false for non-existent alpaca', async () => {
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      const result = await service.removeAlpaca('invalid-id');

      expect(result).toBe(false);
    });
  });

  describe('validateRelationships', () => {
    it('should validate correct relationships', async () => {
      vi.mocked(mockAlpacaRepository.findById)
        .mockResolvedValueOnce(mockSire)
        .mockResolvedValueOnce(mockDam);
      vi.mocked(mockAlpacaRepository.findByParent).mockResolvedValue([]);

      const result = await service.validateRelationships('alpaca-1', 'sire-1', 'dam-1');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect circular references', async () => {
      const result = await service.validateRelationships('alpaca-1', 'alpaca-1', undefined);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Alpaca cannot be its own sire');
    });

    it('should detect invalid parent genders', async () => {
      const femaleSire = { ...mockSire, gender: 'female' as const };

      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(femaleSire);

      const result = await service.validateRelationships('alpaca-1', 'sire-1', undefined);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sire must be male');
    });
  });

  describe('error handling', () => {
    it('should wrap repository errors in service errors', async () => {
      const repositoryError = new Error('Database connection failed');
      vi.mocked(mockAlpacaRepository.findById).mockRejectedValue(repositoryError);

      await expect(service.getAlpaca('alpaca-1'))
        .rejects.toThrow(AlpacaServiceError);
    });
  });
});