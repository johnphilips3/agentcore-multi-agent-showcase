import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthService, HealthAlert, HealthSummary } from '../health-service';
import { PostgreSQLHealthRepository, QueryOptions, PaginatedResult } from '../../repositories/pg-health-repository';
import { HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput } from '../../models/health-record';
import { RecordType } from '../../models/common';
import { HealthRecordFactory } from '../../__tests__/data-factories';
import { MockHealthRepositoryFactory } from '../../__tests__/mock-factories';

describe('HealthService', () => {
  let service: HealthService;
  let mockRepository: ReturnType<typeof MockHealthRepositoryFactory.create>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = MockHealthRepositoryFactory.create();
    service = new HealthService(mockRepository as any);
  });

  const mockHealthRecord = HealthRecordFactory.create({
    id: 'health-1',
    alpacaId: 'alpaca-1',
    recordType: 'vaccination',
    date: new Date('2023-01-01'),
    description: 'Annual vaccination',
    veterinarian: 'Dr. Smith',
    nextDueDate: new Date('2024-01-01'),
    notes: 'No adverse reactions'
  });

  const mockPaginatedResult: PaginatedResult<HealthRecord> = {
    data: [mockHealthRecord],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1
  };

  describe('createHealthRecord', () => {
    it('should successfully create a valid health record', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: 'alpaca-1',
        recordType: 'vaccination',
        date: new Date('2023-01-01'),
        description: 'Annual vaccination',
        veterinarian: 'Dr. Smith'
      };

      mockRepository.create.mockResolvedValue(mockHealthRecord);

      const result = await service.createHealthRecord(input);

      expect(result).toEqual(mockHealthRecord);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });

    it('should throw error for empty alpaca ID', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: '',
        recordType: 'vaccination',
        date: new Date('2023-01-01'),
        description: 'Annual vaccination'
      };

      await expect(service.createHealthRecord(input)).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only alpaca ID', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: '   ',
        recordType: 'vaccination',
        date: new Date('2023-01-01'),
        description: 'Annual vaccination'
      };

      await expect(service.createHealthRecord(input)).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for missing record type', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: 'alpaca-1',
        recordType: undefined as any,
        date: new Date('2023-01-01'),
        description: 'Annual vaccination'
      };

      await expect(service.createHealthRecord(input)).rejects.toThrow('Record type is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for missing date', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: 'alpaca-1',
        recordType: 'vaccination',
        date: undefined as any,
        description: 'Annual vaccination'
      };

      await expect(service.createHealthRecord(input)).rejects.toThrow('Date is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for empty description', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: 'alpaca-1',
        recordType: 'vaccination',
        date: new Date('2023-01-01'),
        description: ''
      };

      await expect(service.createHealthRecord(input)).rejects.toThrow('Description is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only description', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: 'alpaca-1',
        recordType: 'vaccination',
        date: new Date('2023-01-01'),
        description: '   '
      };

      await expect(service.createHealthRecord(input)).rejects.toThrow('Description is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: 'alpaca-1',
        recordType: 'vaccination',
        date: new Date('2023-01-01'),
        description: 'Annual vaccination'
      };

      const repositoryError = new Error('Database connection failed');
      mockRepository.create.mockRejectedValue(repositoryError);

      await expect(service.createHealthRecord(input)).rejects.toThrow('Database connection failed');
    });
  });

  describe('updateHealthRecord', () => {
    it('should successfully update a health record', async () => {
      const updates: UpdateHealthRecordInput = {
        description: 'Updated vaccination',
        notes: 'Updated notes'
      };

      const updatedRecord = { ...mockHealthRecord, ...updates };
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.updateHealthRecord('health-1', updates);

      expect(result).toEqual(updatedRecord);
      expect(mockRepository.update).toHaveBeenCalledWith('health-1', updates);
    });

    it('should throw error for empty ID', async () => {
      const updates: UpdateHealthRecordInput = { description: 'Updated' };

      await expect(service.updateHealthRecord('', updates)).rejects.toThrow('Health record ID is required');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      const updates: UpdateHealthRecordInput = { description: 'Updated' };

      await expect(service.updateHealthRecord('   ', updates)).rejects.toThrow('Health record ID is required');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for empty alpaca ID in updates', async () => {
      const updates: UpdateHealthRecordInput = { alpacaId: '' };

      await expect(service.updateHealthRecord('health-1', updates))
        .rejects.toThrow('Alpaca ID cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only alpaca ID in updates', async () => {
      const updates: UpdateHealthRecordInput = { alpacaId: '   ' };

      await expect(service.updateHealthRecord('health-1', updates))
        .rejects.toThrow('Alpaca ID cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for empty description in updates', async () => {
      const updates: UpdateHealthRecordInput = { description: '' };

      await expect(service.updateHealthRecord('health-1', updates))
        .rejects.toThrow('Description cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only description in updates', async () => {
      const updates: UpdateHealthRecordInput = { description: '   ' };

      await expect(service.updateHealthRecord('health-1', updates))
        .rejects.toThrow('Description cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should allow undefined values in updates', async () => {
      const updates: UpdateHealthRecordInput = {
        alpacaId: undefined,
        description: undefined
      };

      const updatedRecord = { ...mockHealthRecord };
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.updateHealthRecord('health-1', updates);

      expect(result).toEqual(updatedRecord);
      expect(mockRepository.update).toHaveBeenCalledWith('health-1', updates);
    });

    it('should handle repository errors', async () => {
      const updates: UpdateHealthRecordInput = { description: 'Updated' };
      const repositoryError = new Error('Database connection failed');
      mockRepository.update.mockRejectedValue(repositoryError);

      await expect(service.updateHealthRecord('health-1', updates))
        .rejects.toThrow('Database connection failed');
    });

    it('should return null when health record not found', async () => {
      const updates: UpdateHealthRecordInput = { description: 'Updated' };
      mockRepository.update.mockResolvedValue(null);

      const result = await service.updateHealthRecord('nonexistent-id', updates);

      expect(result).toBeNull();
      expect(mockRepository.update).toHaveBeenCalledWith('nonexistent-id', updates);
    });
  });

  describe('getHealthRecord', () => {
    it('should return health record by ID', async () => {
      mockRepository.findById.mockResolvedValue(mockHealthRecord);

      const result = await service.getHealthRecord('health-1');

      expect(result).toEqual(mockHealthRecord);
      expect(mockRepository.findById).toHaveBeenCalledWith('health-1');
    });

    it('should return null for non-existent health record', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getHealthRecord('invalid-id');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('invalid-id');
    });

    it('should throw error for empty ID', async () => {
      await expect(service.getHealthRecord('')).rejects.toThrow('Health record ID is required');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      await expect(service.getHealthRecord('   ')).rejects.toThrow('Health record ID is required');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findById.mockRejectedValue(repositoryError);

      await expect(service.getHealthRecord('health-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getAllHealthRecords', () => {
    it('should return all health records with default options', async () => {
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.getAllHealthRecords();

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith({});
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 10, offset: 0 };
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.getAllHealthRecords(options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith(options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findAll.mockRejectedValue(repositoryError);

      await expect(service.getAllHealthRecords()).rejects.toThrow('Database connection failed');
    });
  });

  describe('deleteHealthRecord', () => {
    it('should successfully delete a health record', async () => {
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.deleteHealthRecord('health-1');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('health-1');
    });

    it('should return false when health record not found', async () => {
      mockRepository.delete.mockResolvedValue(false);

      const result = await service.deleteHealthRecord('nonexistent-id');

      expect(result).toBe(false);
      expect(mockRepository.delete).toHaveBeenCalledWith('nonexistent-id');
    });

    it('should throw error for empty ID', async () => {
      await expect(service.deleteHealthRecord('')).rejects.toThrow('Health record ID is required');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      await expect(service.deleteHealthRecord('   ')).rejects.toThrow('Health record ID is required');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.delete.mockRejectedValue(repositoryError);

      await expect(service.deleteHealthRecord('health-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getHealthRecordsByAlpaca', () => {
    it('should return health records for an alpaca', async () => {
      mockRepository.findByAlpaca.mockResolvedValue(mockPaginatedResult);

      const result = await service.getHealthRecordsByAlpaca('alpaca-1');

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByAlpaca).toHaveBeenCalledWith('alpaca-1', {});
    });

    it('should throw error for empty alpaca ID', async () => {
      await expect(service.getHealthRecordsByAlpaca('')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.findByAlpaca).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only alpaca ID', async () => {
      await expect(service.getHealthRecordsByAlpaca('   ')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.findByAlpaca).not.toHaveBeenCalled();
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 5, offset: 10 };
      mockRepository.findByAlpaca.mockResolvedValue(mockPaginatedResult);

      const result = await service.getHealthRecordsByAlpaca('alpaca-1', options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByAlpaca).toHaveBeenCalledWith('alpaca-1', options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByAlpaca.mockRejectedValue(repositoryError);

      await expect(service.getHealthRecordsByAlpaca('alpaca-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getHealthRecordsByType', () => {
    it('should return health records by type', async () => {
      mockRepository.findByRecordType.mockResolvedValue(mockPaginatedResult);

      const result = await service.getHealthRecordsByType('vaccination');

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByRecordType).toHaveBeenCalledWith('vaccination', {});
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 5, offset: 10 };
      mockRepository.findByRecordType.mockResolvedValue(mockPaginatedResult);

      const result = await service.getHealthRecordsByType('checkup', options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByRecordType).toHaveBeenCalledWith('checkup', options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByRecordType.mockRejectedValue(repositoryError);

      await expect(service.getHealthRecordsByType('vaccination')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getOverdueVaccinations', () => {
    it('should return overdue vaccinations', async () => {
      const overdueRecords = [mockHealthRecord];
      mockRepository.getOverdueVaccinations.mockResolvedValue(overdueRecords);

      const result = await service.getOverdueVaccinations();

      expect(result).toEqual(overdueRecords);
      expect(mockRepository.getOverdueVaccinations).toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.getOverdueVaccinations.mockRejectedValue(repositoryError);

      await expect(service.getOverdueVaccinations()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getHealthAlerts', () => {
    it('should return health alerts for overdue items', async () => {
      const overdueRecord = HealthRecordFactory.create({
        id: 'overdue-1',
        alpacaId: 'alpaca-1',
        recordType: 'vaccination',
        description: 'Annual vaccination',
        nextDueDate: new Date('2022-01-01') // Very overdue
      });

      mockRepository.getOverdueVaccinations.mockResolvedValue([overdueRecord]);

      const result = await service.getHealthAlerts();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: overdueRecord.id,
        alpacaId: overdueRecord.alpacaId,
        recordType: overdueRecord.recordType,
        description: `Overdue ${overdueRecord.recordType}: ${overdueRecord.description}`,
        dueDate: overdueRecord.nextDueDate
      });
      expect(result[0].daysOverdue).toBeGreaterThan(0);
      expect(result[0].priority).toBe('critical'); // Very overdue
    });

    it('should calculate correct priority levels', async () => {
      const now = new Date();
      const records = [
        HealthRecordFactory.create({
          id: 'low-1',
          nextDueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days overdue
        }),
        HealthRecordFactory.create({
          id: 'medium-1',
          nextDueDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) // 15 days overdue
        }),
        HealthRecordFactory.create({
          id: 'high-1',
          nextDueDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000) // 45 days overdue
        }),
        HealthRecordFactory.create({
          id: 'critical-1',
          nextDueDate: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000) // 100 days overdue
        })
      ];

      mockRepository.getOverdueVaccinations.mockResolvedValue(records);

      const result = await service.getHealthAlerts();

      expect(result).toHaveLength(4);
      expect(result.find(r => r.id === 'low-1')?.priority).toBe('low');
      expect(result.find(r => r.id === 'medium-1')?.priority).toBe('medium');
      expect(result.find(r => r.id === 'high-1')?.priority).toBe('high');
      expect(result.find(r => r.id === 'critical-1')?.priority).toBe('critical');
    });

    it('should handle empty overdue vaccinations', async () => {
      mockRepository.getOverdueVaccinations.mockResolvedValue([]);

      const result = await service.getHealthAlerts();

      expect(result).toHaveLength(0);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.getOverdueVaccinations.mockRejectedValue(repositoryError);

      await expect(service.getHealthAlerts()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getHealthSummary', () => {
    it('should return comprehensive health summary', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days from now
      const recentCheckupDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 3 months ago
      const recentVaccinationDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 1 month ago
      const recentTreatmentDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 2 months ago
      
      const healthRecords = [
        HealthRecordFactory.create({
          recordType: 'vaccination',
          date: recentVaccinationDate,
          nextDueDate: futureDate // Not overdue, upcoming
        }),
        HealthRecordFactory.create({
          recordType: 'checkup',
          date: recentCheckupDate,
          nextDueDate: undefined
        }),
        HealthRecordFactory.create({
          recordType: 'treatment',
          date: recentTreatmentDate,
          nextDueDate: undefined
        })
      ];

      const paginatedRecords: PaginatedResult<HealthRecord> = {
        data: healthRecords,
        total: 3,
        page: 1,
        limit: 1000,
        totalPages: 1
      };

      mockRepository.findByAlpaca.mockResolvedValue(paginatedRecords);

      const result = await service.getHealthSummary('alpaca-1');

      expect(result).toMatchObject({
        alpacaId: 'alpaca-1',
        totalRecords: 3,
        upcomingVaccinations: 1, // One vaccination due within 30 days
        overdueVaccinations: 0
      });
      expect(result.lastVaccination).toEqual(recentVaccinationDate);
      expect(result.lastCheckup).toEqual(recentCheckupDate);
      expect(result.lastTreatment).toEqual(recentTreatmentDate);
    });

    it('should throw error for empty alpaca ID', async () => {
      await expect(service.getHealthSummary('')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.findByAlpaca).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only alpaca ID', async () => {
      await expect(service.getHealthSummary('   ')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.findByAlpaca).not.toHaveBeenCalled();
    });

    it('should handle alpaca with no health records', async () => {
      const emptyResult: PaginatedResult<HealthRecord> = {
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      };

      mockRepository.findByAlpaca.mockResolvedValue(emptyResult);

      const result = await service.getHealthSummary('alpaca-1');

      expect(result).toMatchObject({
        alpacaId: 'alpaca-1',
        totalRecords: 0,
        upcomingVaccinations: 0,
        overdueVaccinations: 0
      });
      expect(result.lastCheckup).toBeUndefined();
      expect(result.lastVaccination).toBeUndefined();
      expect(result.lastTreatment).toBeUndefined();
    });

    it('should detect overdue vaccinations in summary', async () => {
      const now = new Date();
      const overdueRecord = HealthRecordFactory.create({
        recordType: 'vaccination',
        nextDueDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 days overdue
      });

      const paginatedRecords: PaginatedResult<HealthRecord> = {
        data: [overdueRecord],
        total: 1,
        page: 1,
        limit: 1000,
        totalPages: 1
      };

      mockRepository.findByAlpaca.mockResolvedValue(paginatedRecords);

      const result = await service.getHealthSummary('alpaca-1');

      expect(result.overdueVaccinations).toBe(1);
      expect(result.upcomingVaccinations).toBe(0);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByAlpaca.mockRejectedValue(repositoryError);

      await expect(service.getHealthSummary('alpaca-1')).rejects.toThrow('Database connection failed');
    });
  });


});