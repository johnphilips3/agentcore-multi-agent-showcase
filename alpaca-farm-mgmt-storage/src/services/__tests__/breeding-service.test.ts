import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BreedingService, BreedingStatistics, BreedingCompatibility } from '../breeding-service';
import { PostgreSQLBreedingRepository, QueryOptions, PaginatedResult } from '../../repositories/pg-breeding-repository';
import { BreedingRecord, CreateBreedingRecordInput, UpdateBreedingRecordInput } from '../../models/breeding-record';
import { BreedingRecordFactory } from '../../__tests__/data-factories';
import { MockBreedingRepositoryFactory } from '../../__tests__/mock-factories';

describe('BreedingService', () => {
  let service: BreedingService;
  let mockRepository: ReturnType<typeof MockBreedingRepositoryFactory.create>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = MockBreedingRepositoryFactory.create();
    service = new BreedingService(mockRepository as any);
  });

  const mockBreedingRecord = BreedingRecordFactory.create({
    id: 'breeding-1',
    sireId: 'sire-1',
    damId: 'dam-1',
    breedingDate: new Date('2022-02-01'),
    expectedDueDate: new Date('2023-01-01'),
    actualBirthDate: new Date('2023-01-05'),
    offspringIds: ['offspring-1'],
    notes: 'Successful breeding'
  });

  const mockPaginatedResult: PaginatedResult<BreedingRecord> = {
    data: [mockBreedingRecord],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1
  };

  describe('createBreedingRecord', () => {
    it('should successfully create a valid breeding record', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: 'sire-1',
        damId: 'dam-1',
        breedingDate: new Date('2022-02-01'),
        expectedDueDate: new Date('2023-01-01'),
        offspringIds: []
      };

      mockRepository.create.mockResolvedValue(mockBreedingRecord);

      const result = await service.createBreedingRecord(input);

      expect(result).toEqual(mockBreedingRecord);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });

    it('should throw error for empty sire ID', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: '',
        damId: 'dam-1',
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      await expect(service.createBreedingRecord(input)).rejects.toThrow('Sire ID is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only sire ID', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: '   ',
        damId: 'dam-1',
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      await expect(service.createBreedingRecord(input)).rejects.toThrow('Sire ID is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for empty dam ID', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: 'sire-1',
        damId: '',
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      await expect(service.createBreedingRecord(input)).rejects.toThrow('Dam ID is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only dam ID', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: 'sire-1',
        damId: '   ',
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      await expect(service.createBreedingRecord(input)).rejects.toThrow('Dam ID is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for missing breeding date', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: 'sire-1',
        damId: 'dam-1',
        breedingDate: undefined as any,
        offspringIds: []
      };

      await expect(service.createBreedingRecord(input)).rejects.toThrow('Breeding date is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when sire and dam are the same', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: 'same-alpaca',
        damId: 'same-alpaca',
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      await expect(service.createBreedingRecord(input)).rejects.toThrow('Sire and dam cannot be the same alpaca');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const input: CreateBreedingRecordInput = {
        sireId: 'sire-1',
        damId: 'dam-1',
        breedingDate: new Date('2022-02-01'),
        offspringIds: []
      };

      const repositoryError = new Error('Database connection failed');
      mockRepository.create.mockRejectedValue(repositoryError);

      await expect(service.createBreedingRecord(input)).rejects.toThrow('Database connection failed');
    });
  });

  describe('updateBreedingRecord', () => {
    it('should successfully update a breeding record', async () => {
      const updates: UpdateBreedingRecordInput = {
        notes: 'Updated notes',
        actualBirthDate: new Date('2023-01-10')
      };

      const updatedRecord = { ...mockBreedingRecord, ...updates };
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.updateBreedingRecord('breeding-1', updates);

      expect(result).toEqual(updatedRecord);
      expect(mockRepository.update).toHaveBeenCalledWith('breeding-1', updates);
    });

    it('should throw error for empty ID', async () => {
      const updates: UpdateBreedingRecordInput = { notes: 'Updated' };

      await expect(service.updateBreedingRecord('', updates)).rejects.toThrow('Breeding record ID is required');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      const updates: UpdateBreedingRecordInput = { notes: 'Updated' };

      await expect(service.updateBreedingRecord('   ', updates)).rejects.toThrow('Breeding record ID is required');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for empty sire ID in updates', async () => {
      const updates: UpdateBreedingRecordInput = { sireId: '' };

      await expect(service.updateBreedingRecord('breeding-1', updates))
        .rejects.toThrow('Sire ID cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only sire ID in updates', async () => {
      const updates: UpdateBreedingRecordInput = { sireId: '   ' };

      await expect(service.updateBreedingRecord('breeding-1', updates))
        .rejects.toThrow('Sire ID cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for empty dam ID in updates', async () => {
      const updates: UpdateBreedingRecordInput = { damId: '' };

      await expect(service.updateBreedingRecord('breeding-1', updates))
        .rejects.toThrow('Dam ID cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only dam ID in updates', async () => {
      const updates: UpdateBreedingRecordInput = { damId: '   ' };

      await expect(service.updateBreedingRecord('breeding-1', updates))
        .rejects.toThrow('Dam ID cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when sire and dam are the same in updates', async () => {
      const updates: UpdateBreedingRecordInput = { 
        sireId: 'same-alpaca',
        damId: 'same-alpaca'
      };

      await expect(service.updateBreedingRecord('breeding-1', updates))
        .rejects.toThrow('Sire and dam cannot be the same alpaca');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should allow undefined values in updates', async () => {
      const updates: UpdateBreedingRecordInput = {
        sireId: undefined,
        damId: undefined
      };

      const updatedRecord = { ...mockBreedingRecord };
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.updateBreedingRecord('breeding-1', updates);

      expect(result).toEqual(updatedRecord);
      expect(mockRepository.update).toHaveBeenCalledWith('breeding-1', updates);
    });

    it('should handle repository errors', async () => {
      const updates: UpdateBreedingRecordInput = { notes: 'Updated' };
      const repositoryError = new Error('Database connection failed');
      mockRepository.update.mockRejectedValue(repositoryError);

      await expect(service.updateBreedingRecord('breeding-1', updates))
        .rejects.toThrow('Database connection failed');
    });

    it('should return null when breeding record not found', async () => {
      const updates: UpdateBreedingRecordInput = { notes: 'Updated' };
      mockRepository.update.mockResolvedValue(null);

      const result = await service.updateBreedingRecord('nonexistent-id', updates);

      expect(result).toBeNull();
      expect(mockRepository.update).toHaveBeenCalledWith('nonexistent-id', updates);
    });
  });

  describe('getBreedingRecord', () => {
    it('should return breeding record by ID', async () => {
      mockRepository.findById.mockResolvedValue(mockBreedingRecord);

      const result = await service.getBreedingRecord('breeding-1');

      expect(result).toEqual(mockBreedingRecord);
      expect(mockRepository.findById).toHaveBeenCalledWith('breeding-1');
    });

    it('should return null for non-existent breeding record', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getBreedingRecord('invalid-id');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('invalid-id');
    });

    it('should throw error for empty ID', async () => {
      await expect(service.getBreedingRecord('')).rejects.toThrow('Breeding record ID is required');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      await expect(service.getBreedingRecord('   ')).rejects.toThrow('Breeding record ID is required');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findById.mockRejectedValue(repositoryError);

      await expect(service.getBreedingRecord('breeding-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getAllBreedingRecords', () => {
    it('should return all breeding records with default options', async () => {
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.getAllBreedingRecords();

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith({});
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 10, offset: 0 };
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.getAllBreedingRecords(options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith(options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findAll.mockRejectedValue(repositoryError);

      await expect(service.getAllBreedingRecords()).rejects.toThrow('Database connection failed');
    });
  });

  describe('deleteBreedingRecord', () => {
    it('should successfully delete a breeding record', async () => {
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.deleteBreedingRecord('breeding-1');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('breeding-1');
    });

    it('should return false when breeding record not found', async () => {
      mockRepository.delete.mockResolvedValue(false);

      const result = await service.deleteBreedingRecord('nonexistent-id');

      expect(result).toBe(false);
      expect(mockRepository.delete).toHaveBeenCalledWith('nonexistent-id');
    });

    it('should throw error for empty ID', async () => {
      await expect(service.deleteBreedingRecord('')).rejects.toThrow('Breeding record ID is required');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      await expect(service.deleteBreedingRecord('   ')).rejects.toThrow('Breeding record ID is required');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.delete.mockRejectedValue(repositoryError);

      await expect(service.deleteBreedingRecord('breeding-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getBreedingRecordsBySire', () => {
    it('should return breeding records for a sire', async () => {
      mockRepository.findBySire.mockResolvedValue(mockPaginatedResult);

      const result = await service.getBreedingRecordsBySire('sire-1');

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findBySire).toHaveBeenCalledWith('sire-1', {});
    });

    it('should throw error for empty sire ID', async () => {
      await expect(service.getBreedingRecordsBySire('')).rejects.toThrow('Sire ID is required');
      expect(mockRepository.findBySire).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only sire ID', async () => {
      await expect(service.getBreedingRecordsBySire('   ')).rejects.toThrow('Sire ID is required');
      expect(mockRepository.findBySire).not.toHaveBeenCalled();
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 5, offset: 10 };
      mockRepository.findBySire.mockResolvedValue(mockPaginatedResult);

      const result = await service.getBreedingRecordsBySire('sire-1', options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findBySire).toHaveBeenCalledWith('sire-1', options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findBySire.mockRejectedValue(repositoryError);

      await expect(service.getBreedingRecordsBySire('sire-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getBreedingRecordsByDam', () => {
    it('should return breeding records for a dam', async () => {
      mockRepository.findByDam.mockResolvedValue(mockPaginatedResult);

      const result = await service.getBreedingRecordsByDam('dam-1');

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByDam).toHaveBeenCalledWith('dam-1', {});
    });

    it('should throw error for empty dam ID', async () => {
      await expect(service.getBreedingRecordsByDam('')).rejects.toThrow('Dam ID is required');
      expect(mockRepository.findByDam).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only dam ID', async () => {
      await expect(service.getBreedingRecordsByDam('   ')).rejects.toThrow('Dam ID is required');
      expect(mockRepository.findByDam).not.toHaveBeenCalled();
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 5, offset: 10 };
      mockRepository.findByDam.mockResolvedValue(mockPaginatedResult);

      const result = await service.getBreedingRecordsByDam('dam-1', options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByDam).toHaveBeenCalledWith('dam-1', options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByDam.mockRejectedValue(repositoryError);

      await expect(service.getBreedingRecordsByDam('dam-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getBreedingRecordsByParent', () => {
    it('should return breeding records for a parent (combining sire and dam records)', async () => {
      const sireRecords = BreedingRecordFactory.createMultiple(2, { sireId: 'parent-1' });
      const damRecords = BreedingRecordFactory.createMultiple(1, { damId: 'parent-1' });
      
      const sireResult: PaginatedResult<BreedingRecord> = {
        data: sireRecords,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      };
      
      const damResult: PaginatedResult<BreedingRecord> = {
        data: damRecords,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      mockRepository.findBySire.mockResolvedValue(sireResult);
      mockRepository.findByDam.mockResolvedValue(damResult);

      const result = await service.getBreedingRecordsByParent('parent-1');

      expect(result.data).toHaveLength(3); // 2 sire + 1 dam records
      expect(result.total).toBe(3);
      expect(mockRepository.findBySire).toHaveBeenCalledWith('parent-1', {});
      expect(mockRepository.findByDam).toHaveBeenCalledWith('parent-1', {});
    });

    it('should throw error for empty parent ID', async () => {
      await expect(service.getBreedingRecordsByParent('')).rejects.toThrow('Parent ID is required');
      expect(mockRepository.findBySire).not.toHaveBeenCalled();
      expect(mockRepository.findByDam).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only parent ID', async () => {
      await expect(service.getBreedingRecordsByParent('   ')).rejects.toThrow('Parent ID is required');
      expect(mockRepository.findBySire).not.toHaveBeenCalled();
      expect(mockRepository.findByDam).not.toHaveBeenCalled();
    });

    it('should deduplicate records and sort by breeding date', async () => {
      const sharedRecord = BreedingRecordFactory.create({ 
        id: 'shared-1', 
        sireId: 'parent-1', 
        damId: 'parent-1',
        breedingDate: new Date('2023-01-01')
      });
      
      const sireResult: PaginatedResult<BreedingRecord> = {
        data: [sharedRecord],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };
      
      const damResult: PaginatedResult<BreedingRecord> = {
        data: [sharedRecord], // Same record appears in both
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      mockRepository.findBySire.mockResolvedValue(sireResult);
      mockRepository.findByDam.mockResolvedValue(damResult);

      const result = await service.getBreedingRecordsByParent('parent-1');

      expect(result.data).toHaveLength(1); // Deduplicated
      expect(result.data[0].id).toBe('shared-1');
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findBySire.mockRejectedValue(repositoryError);

      await expect(service.getBreedingRecordsByParent('parent-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getBreedingRecordsByDateRange', () => {
    it('should return breeding records within date range', async () => {
      const startDate = new Date('2022-01-01');
      const endDate = new Date('2022-12-31');
      mockRepository.findByDateRange.mockResolvedValue(mockPaginatedResult);

      const result = await service.getBreedingRecordsByDateRange(startDate, endDate);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByDateRange).toHaveBeenCalledWith(startDate, endDate, {});
    });

    it('should pass query options to repository', async () => {
      const startDate = new Date('2022-01-01');
      const endDate = new Date('2022-12-31');
      const options: QueryOptions = { limit: 5, offset: 10 };
      mockRepository.findByDateRange.mockResolvedValue(mockPaginatedResult);

      const result = await service.getBreedingRecordsByDateRange(startDate, endDate, options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByDateRange).toHaveBeenCalledWith(startDate, endDate, options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByDateRange.mockRejectedValue(repositoryError);

      await expect(service.getBreedingRecordsByDateRange(new Date(), new Date())).rejects.toThrow('Database connection failed');
    });
  });

  describe('getExpectedBirths', () => {
    it('should return expected births with default days ahead', async () => {
      const expectedRecords = [mockBreedingRecord];
      mockRepository.getExpectedBirths.mockResolvedValue(expectedRecords);

      const result = await service.getExpectedBirths();

      expect(result).toEqual(expectedRecords);
      expect(mockRepository.getExpectedBirths).toHaveBeenCalledWith(30);
    });

    it('should return expected births with custom days ahead', async () => {
      const expectedRecords = [mockBreedingRecord];
      mockRepository.getExpectedBirths.mockResolvedValue(expectedRecords);

      const result = await service.getExpectedBirths(60);

      expect(result).toEqual(expectedRecords);
      expect(mockRepository.getExpectedBirths).toHaveBeenCalledWith(60);
    });

    it('should throw error for negative days ahead', async () => {
      await expect(service.getExpectedBirths(-5)).rejects.toThrow('Days ahead must be a positive number');
      expect(mockRepository.getExpectedBirths).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.getExpectedBirths.mockRejectedValue(repositoryError);

      await expect(service.getExpectedBirths()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getBreedingStatistics', () => {
    it('should calculate correct breeding statistics', async () => {
      const records = [
        BreedingRecordFactory.create({ 
          breedingDate: new Date('2022-01-01'),
          actualBirthDate: new Date('2022-12-01') // Successful
        }),
        BreedingRecordFactory.create({ 
          breedingDate: new Date('2023-01-01'),
          actualBirthDate: undefined, // Not yet born
          expectedDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Future expected (30 days from now)
        }),
        BreedingRecordFactory.create({ 
          breedingDate: new Date('2021-01-01'),
          actualBirthDate: new Date('2021-11-15') // Successful
        })
      ];

      const paginatedRecords: PaginatedResult<BreedingRecord> = {
        data: records,
        total: 3,
        page: 1,
        limit: 1000,
        totalPages: 1
      };

      mockRepository.findAll.mockResolvedValue(paginatedRecords);

      const result = await service.getBreedingStatistics();

      expect(result.totalBreedings).toBe(3);
      expect(result.successfulBreedings).toBe(2);
      expect(result.expectedBirths).toBe(1);
      expect(result.averageGestationDays).toBeGreaterThan(0);
      expect(result.breedingsByYear).toBeInstanceOf(Array);
      expect(mockRepository.findAll).toHaveBeenCalledWith({ limit: 1000 });
    });

    it('should handle empty breeding records', async () => {
      const emptyResult: PaginatedResult<BreedingRecord> = {
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      };

      mockRepository.findAll.mockResolvedValue(emptyResult);

      const result = await service.getBreedingStatistics();

      expect(result.totalBreedings).toBe(0);
      expect(result.successfulBreedings).toBe(0);
      expect(result.expectedBirths).toBe(0);
      expect(result.averageGestationDays).toBe(0);
      expect(result.breedingsByYear).toEqual([]);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findAll.mockRejectedValue(repositoryError);

      await expect(service.getBreedingStatistics()).rejects.toThrow('Database connection failed');
    });
  });

  describe('validateBreedingPair', () => {
    it('should return compatible for valid IDs', async () => {
      const result = await service.validateBreedingPair('sire-1', 'dam-1');

      expect(result.compatible).toBe(true);
      expect(result.reasons).toEqual([]);
      expect(result.warnings).toEqual(['Basic validation passed - detailed genetic analysis not yet implemented']);
    });

    it('should return incompatible when sire ID is missing', async () => {
      const result = await service.validateBreedingPair('', 'dam-1');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toEqual(['Both sire and dam IDs are required']);
      expect(result.warnings).toEqual([]);
    });

    it('should return incompatible when dam ID is missing', async () => {
      const result = await service.validateBreedingPair('sire-1', '');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toEqual(['Both sire and dam IDs are required']);
      expect(result.warnings).toEqual([]);
    });

    it('should return incompatible when sire and dam are the same', async () => {
      const result = await service.validateBreedingPair('same-id', 'same-id');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toEqual(['Sire and dam cannot be the same alpaca']);
      expect(result.warnings).toEqual([]);
    });
  });


});