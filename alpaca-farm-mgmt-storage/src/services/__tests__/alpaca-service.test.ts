import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlpacaService, HerdStatistics } from '../alpaca-service';
import { PostgreSQLAlpacaRepository, QueryOptions, PaginatedResult } from '../../repositories/pg-alpaca-repository';
import { Alpaca, CreateAlpacaInput, UpdateAlpacaInput } from '../../models/alpaca';
import { AlpacaFactory } from '../../__tests__/data-factories';
import { MockAlpacaRepositoryFactory } from '../../__tests__/mock-factories';

describe('AlpacaService', () => {
  let service: AlpacaService;
  let mockRepository: ReturnType<typeof MockAlpacaRepositoryFactory.create>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = MockAlpacaRepositoryFactory.create();
    service = new AlpacaService(mockRepository as any);
  });

  const mockAlpaca = AlpacaFactory.create({
    id: 'alpaca-1',
    name: 'Test Alpaca',
    registrationNumber: 'REG001',
    birthDate: new Date('2020-01-01'),
    gender: 'female',
    color: 'white',
    weight: 150,
    height: 90
  });

  const mockPaginatedResult: PaginatedResult<Alpaca> = {
    data: [mockAlpaca],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1
  };

  describe('createAlpaca', () => {
    it('should successfully create a valid alpaca', async () => {
      const input: CreateAlpacaInput = {
        name: 'New Alpaca',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'white'
      };

      mockRepository.create.mockResolvedValue(mockAlpaca);

      const result = await service.createAlpaca(input);

      expect(result).toEqual(mockAlpaca);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });

    it('should throw error for empty name', async () => {
      const input: CreateAlpacaInput = {
        name: '',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'white'
      };

      await expect(service.createAlpaca(input)).rejects.toThrow('Alpaca name is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only name', async () => {
      const input: CreateAlpacaInput = {
        name: '   ',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'white'
      };

      await expect(service.createAlpaca(input)).rejects.toThrow('Alpaca name is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for missing birth date', async () => {
      const input: CreateAlpacaInput = {
        name: 'Test Alpaca',
        birthDate: undefined as any,
        gender: 'female',
        color: 'white'
      };

      await expect(service.createAlpaca(input)).rejects.toThrow('Birth date is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid gender', async () => {
      const input: CreateAlpacaInput = {
        name: 'Test Alpaca',
        birthDate: new Date('2022-01-01'),
        gender: 'invalid' as any,
        color: 'white'
      };

      await expect(service.createAlpaca(input)).rejects.toThrow('Valid gender (male/female) is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for empty color', async () => {
      const input: CreateAlpacaInput = {
        name: 'Test Alpaca',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: ''
      };

      await expect(service.createAlpaca(input)).rejects.toThrow('Color is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const input: CreateAlpacaInput = {
        name: 'Test Alpaca',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'white'
      };

      const repositoryError = new Error('Database connection failed');
      mockRepository.create.mockRejectedValue(repositoryError);

      await expect(service.createAlpaca(input)).rejects.toThrow('Database connection failed');
    });
  });

  describe('updateAlpaca', () => {
    it('should successfully update an alpaca', async () => {
      const updates: UpdateAlpacaInput = {
        name: 'Updated Name',
        weight: 160
      };

      const updatedAlpaca = { ...mockAlpaca, ...updates };
      mockRepository.update.mockResolvedValue(updatedAlpaca);

      const result = await service.updateAlpaca('alpaca-1', updates);

      expect(result).toEqual(updatedAlpaca);
      expect(mockRepository.update).toHaveBeenCalledWith('alpaca-1', updates);
    });

    it('should throw error for empty ID', async () => {
      const updates: UpdateAlpacaInput = { name: 'New Name' };

      await expect(service.updateAlpaca('', updates)).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      const updates: UpdateAlpacaInput = { name: 'New Name' };

      await expect(service.updateAlpaca('   ', updates)).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for empty name in updates', async () => {
      const updates: UpdateAlpacaInput = { name: '' };

      await expect(service.updateAlpaca('alpaca-1', updates))
        .rejects.toThrow('Alpaca name cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only name in updates', async () => {
      const updates: UpdateAlpacaInput = { name: '   ' };

      await expect(service.updateAlpaca('alpaca-1', updates))
        .rejects.toThrow('Alpaca name cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for invalid gender in updates', async () => {
      const updates: UpdateAlpacaInput = { gender: 'invalid' as any };

      await expect(service.updateAlpaca('alpaca-1', updates))
        .rejects.toThrow('Valid gender (male/female) is required');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for empty color in updates', async () => {
      const updates: UpdateAlpacaInput = { color: '' };

      await expect(service.updateAlpaca('alpaca-1', updates))
        .rejects.toThrow('Color cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should allow undefined values in updates', async () => {
      const updates: UpdateAlpacaInput = {
        name: undefined,
        gender: undefined,
        color: undefined
      };

      const updatedAlpaca = { ...mockAlpaca };
      mockRepository.update.mockResolvedValue(updatedAlpaca);

      const result = await service.updateAlpaca('alpaca-1', updates);

      expect(result).toEqual(updatedAlpaca);
      expect(mockRepository.update).toHaveBeenCalledWith('alpaca-1', updates);
    });

    it('should handle repository errors', async () => {
      const updates: UpdateAlpacaInput = { name: 'New Name' };
      const repositoryError = new Error('Database connection failed');
      mockRepository.update.mockRejectedValue(repositoryError);

      await expect(service.updateAlpaca('alpaca-1', updates))
        .rejects.toThrow('Database connection failed');
    });

    it('should return null when alpaca not found', async () => {
      const updates: UpdateAlpacaInput = { name: 'New Name' };
      mockRepository.update.mockResolvedValue(null);

      const result = await service.updateAlpaca('nonexistent-id', updates);

      expect(result).toBeNull();
      expect(mockRepository.update).toHaveBeenCalledWith('nonexistent-id', updates);
    });
  });

  describe('getAlpaca', () => {
    it('should return alpaca by ID', async () => {
      mockRepository.findById.mockResolvedValue(mockAlpaca);

      const result = await service.getAlpaca('alpaca-1');

      expect(result).toEqual(mockAlpaca);
      expect(mockRepository.findById).toHaveBeenCalledWith('alpaca-1');
    });

    it('should return null for non-existent alpaca', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getAlpaca('invalid-id');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('invalid-id');
    });

    it('should throw error for empty ID', async () => {
      await expect(service.getAlpaca('')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      await expect(service.getAlpaca('   ')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findById.mockRejectedValue(repositoryError);

      await expect(service.getAlpaca('alpaca-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getAllAlpacas', () => {
    it('should return all alpacas with default options', async () => {
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.getAllAlpacas();

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith({});
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 10, offset: 0 };
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.getAllAlpacas(options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith(options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findAll.mockRejectedValue(repositoryError);

      await expect(service.getAllAlpacas()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getAlpacasByGender', () => {
    it('should return female alpacas', async () => {
      const femaleResult: PaginatedResult<Alpaca> = {
        data: [mockAlpaca],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      };
      mockRepository.findByGender.mockResolvedValue(femaleResult);

      const result = await service.getAlpacasByGender('female');

      expect(result).toEqual(femaleResult);
      expect(mockRepository.findByGender).toHaveBeenCalledWith('female', {});
    });

    it('should return male alpacas', async () => {
      const maleAlpaca = AlpacaFactory.create({ gender: 'male' });
      const maleResult: PaginatedResult<Alpaca> = {
        data: [maleAlpaca],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      };
      mockRepository.findByGender.mockResolvedValue(maleResult);

      const result = await service.getAlpacasByGender('male');

      expect(result).toEqual(maleResult);
      expect(mockRepository.findByGender).toHaveBeenCalledWith('male', {});
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 5, offset: 10 };
      const femaleResult: PaginatedResult<Alpaca> = {
        data: [],
        total: 0,
        page: 3,
        limit: 5,
        totalPages: 0
      };
      mockRepository.findByGender.mockResolvedValue(femaleResult);

      const result = await service.getAlpacasByGender('female', options);

      expect(result).toEqual(femaleResult);
      expect(mockRepository.findByGender).toHaveBeenCalledWith('female', options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByGender.mockRejectedValue(repositoryError);

      await expect(service.getAlpacasByGender('female')).rejects.toThrow('Database connection failed');
    });
  });

  describe('deleteAlpaca', () => {
    it('should successfully delete an alpaca', async () => {
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.deleteAlpaca('alpaca-1');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('alpaca-1');
    });

    it('should return false when alpaca not found', async () => {
      mockRepository.delete.mockResolvedValue(false);

      const result = await service.deleteAlpaca('nonexistent-id');

      expect(result).toBe(false);
      expect(mockRepository.delete).toHaveBeenCalledWith('nonexistent-id');
    });

    it('should throw error for empty ID', async () => {
      await expect(service.deleteAlpaca('')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      await expect(service.deleteAlpaca('   ')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.delete.mockRejectedValue(repositoryError);

      await expect(service.deleteAlpaca('alpaca-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('searchAlpacas', () => {
    it('should search alpacas with query', async () => {
      const searchQuery = 'Test';
      mockRepository.search.mockResolvedValue(mockPaginatedResult);

      const result = await service.searchAlpacas(searchQuery);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.search).toHaveBeenCalledWith('Test', {});
    });

    it('should return all alpacas for empty query', async () => {
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.searchAlpacas('');

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith({});
      expect(mockRepository.search).not.toHaveBeenCalled();
    });

    it('should return all alpacas for whitespace-only query', async () => {
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.searchAlpacas('   ');

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith({});
      expect(mockRepository.search).not.toHaveBeenCalled();
    });

    it('should trim search query', async () => {
      const searchQuery = '  Test Alpaca  ';
      mockRepository.search.mockResolvedValue(mockPaginatedResult);

      const result = await service.searchAlpacas(searchQuery);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.search).toHaveBeenCalledWith('Test Alpaca', {});
    });

    it('should pass query options to search', async () => {
      const searchQuery = 'Test';
      const options: QueryOptions = { limit: 5, offset: 10 };
      mockRepository.search.mockResolvedValue(mockPaginatedResult);

      const result = await service.searchAlpacas(searchQuery, options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.search).toHaveBeenCalledWith('Test', options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.search.mockRejectedValue(repositoryError);

      await expect(service.searchAlpacas('Test')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getHerdStatistics', () => {
    it('should calculate correct herd statistics', async () => {
      const alpacas = [
        AlpacaFactory.create({ 
          gender: 'male', 
          registrationNumber: 'REG001', 
          birthDate: new Date('2020-01-01') 
        }),
        AlpacaFactory.create({ 
          id: 'alpaca-2',
          gender: 'female', 
          registrationNumber: 'REG002', 
          birthDate: new Date('2021-01-01') 
        }),
        AlpacaFactory.create({ 
          id: 'alpaca-3',
          gender: 'female', 
          registrationNumber: undefined, 
          birthDate: new Date('2022-01-01') 
        })
      ];

      const paginatedAlpacas: PaginatedResult<Alpaca> = {
        data: alpacas,
        total: 3,
        page: 1,
        limit: 1000,
        totalPages: 1
      };

      mockRepository.findAll.mockResolvedValue(paginatedAlpacas);

      const result = await service.getHerdStatistics();

      expect(result.totalCount).toBe(3);
      expect(result.maleCount).toBe(1);
      expect(result.femaleCount).toBe(2);
      expect(result.registeredCount).toBe(2);
      expect(result.averageAge).toBeGreaterThan(0);
      expect(mockRepository.findAll).toHaveBeenCalledWith({ limit: 1000 });
    });

    it('should handle empty herd', async () => {
      const emptyResult: PaginatedResult<Alpaca> = {
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      };

      mockRepository.findAll.mockResolvedValue(emptyResult);

      const result = await service.getHerdStatistics();

      expect(result.totalCount).toBe(0);
      expect(result.maleCount).toBe(0);
      expect(result.femaleCount).toBe(0);
      expect(result.registeredCount).toBe(0);
      expect(result.averageAge).toBe(0);
    });

    it('should calculate average age correctly', async () => {
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

      const alpacas = [
        AlpacaFactory.create({ birthDate: oneYearAgo }),
        AlpacaFactory.create({ birthDate: twoYearsAgo })
      ];

      const paginatedAlpacas: PaginatedResult<Alpaca> = {
        data: alpacas,
        total: 2,
        page: 1,
        limit: 1000,
        totalPages: 1
      };

      mockRepository.findAll.mockResolvedValue(paginatedAlpacas);

      const result = await service.getHerdStatistics();

      expect(result.averageAge).toBeCloseTo(1.5, 1); // Average of 1 and 2 years
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findAll.mockRejectedValue(repositoryError);

      await expect(service.getHerdStatistics()).rejects.toThrow('Database connection failed');
    });
  });


});