import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthServiceImpl, HealthServiceError } from '../health-service';
import { HealthRepository } from '../../repositories';
import { AlpacaRepository } from '../../repositories';
import { HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput, Alpaca } from '../../models';

// Mock repositories
const mockHealthRepository: HealthRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByAlpaca: vi.fn(),
  findByDateRange: vi.fn(),
  findByRecordType: vi.fn(),
  findOverdueVaccinations: vi.fn()
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

describe('HealthService', () => {
  let service: HealthServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HealthServiceImpl(mockHealthRepository, mockAlpacaRepository);
  });

  const mockAlpaca: Alpaca = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Alpaca',
    birthDate: new Date('2020-01-01'),
    gender: 'female',
    color: 'white',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockHealthRecord: HealthRecord = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    alpacaId: '550e8400-e29b-41d4-a716-446655440000',
    recordType: 'vaccination',
    date: new Date('2023-01-01'),
    description: 'Annual vaccination',
    veterinarian: 'Dr. Smith',
    nextDueDate: new Date('2024-01-01'),
    notes: 'No adverse reactions',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  describe('createHealthRecord', () => {
    it('should successfully create a valid health record', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: '550e8400-e29b-41d4-a716-446655440000',
        recordType: 'vaccination',
        date: new Date('2023-01-01'),
        description: 'Annual vaccination',
        veterinarian: 'Dr. Smith'
      };

      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);
      vi.mocked(mockHealthRepository.create).mockResolvedValue(mockHealthRecord);

      const result = await service.createHealthRecord(input);

      expect(result).toEqual(mockHealthRecord);
      expect(mockAlpacaRepository.findById).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
      expect(mockHealthRepository.create).toHaveBeenCalledWith(input);
    });

    it('should fail creation with invalid input', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: 'invalid-id', // Invalid UUID
        recordType: 'vaccination',
        date: new Date('2023-01-01'),
        description: 'Annual vaccination'
      };

      await expect(service.createHealthRecord(input))
        .rejects.toThrow(HealthServiceError);
    });

    it('should fail creation when alpaca does not exist', async () => {
      const input: CreateHealthRecordInput = {
        alpacaId: '550e8400-e29b-41d4-a716-446655440000',
        recordType: 'vaccination',
        date: new Date('2023-01-01'),
        description: 'Annual vaccination'
      };

      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      await expect(service.createHealthRecord(input))
        .rejects.toThrow('Alpaca not found');
    });
  });

  describe('updateHealthRecord', () => {
    it('should successfully update a health record', async () => {
      const updates: UpdateHealthRecordInput = {
        description: 'Updated vaccination',
        notes: 'Updated notes'
      };

      const updatedRecord = { ...mockHealthRecord, ...updates };

      vi.mocked(mockHealthRepository.findById).mockResolvedValue(mockHealthRecord);
      vi.mocked(mockHealthRepository.update).mockResolvedValue(updatedRecord);

      const result = await service.updateHealthRecord('health-1', updates);

      expect(result).toEqual(updatedRecord);
      expect(mockHealthRepository.update).toHaveBeenCalledWith('health-1', updates);
    });

    it('should throw error when updating non-existent health record', async () => {
      vi.mocked(mockHealthRepository.findById).mockResolvedValue(null);

      await expect(service.updateHealthRecord('invalid-id', { description: 'Updated' }))
        .rejects.toThrow('Health record not found');
    });

    it('should validate alpaca exists when updating alpacaId', async () => {
      const updates: UpdateHealthRecordInput = {
        alpacaId: '550e8400-e29b-41d4-a716-446655440002'
      };

      vi.mocked(mockHealthRepository.findById).mockResolvedValue(mockHealthRecord);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      await expect(service.updateHealthRecord('550e8400-e29b-41d4-a716-446655440001', updates))
        .rejects.toThrow('Alpaca not found');
    });
  });

  describe('getHealthRecord', () => {
    it('should return health record by ID', async () => {
      vi.mocked(mockHealthRepository.findById).mockResolvedValue(mockHealthRecord);

      const result = await service.getHealthRecord('health-1');

      expect(result).toEqual(mockHealthRecord);
      expect(mockHealthRepository.findById).toHaveBeenCalledWith('health-1');
    });

    it('should return null for non-existent health record', async () => {
      vi.mocked(mockHealthRepository.findById).mockResolvedValue(null);

      const result = await service.getHealthRecord('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('getAlpacaHealthRecords', () => {
    it('should return health records for an alpaca', async () => {
      const healthRecords = [mockHealthRecord];

      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);
      vi.mocked(mockHealthRepository.findByAlpaca).mockResolvedValue(healthRecords);

      const result = await service.getAlpacaHealthRecords('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(healthRecords);
      expect(mockAlpacaRepository.findById).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
      expect(mockHealthRepository.findByAlpaca).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should throw error for non-existent alpaca', async () => {
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      await expect(service.getAlpacaHealthRecords('invalid-id'))
        .rejects.toThrow('Alpaca not found');
    });
  });

  describe('getHealthRecordsByDateRange', () => {
    it('should return health records within date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      const healthRecords = [mockHealthRecord];

      vi.mocked(mockHealthRepository.findByDateRange).mockResolvedValue(healthRecords);

      const result = await service.getHealthRecordsByDateRange(startDate, endDate);

      expect(result).toEqual(healthRecords);
      expect(mockHealthRepository.findByDateRange).toHaveBeenCalledWith(startDate, endDate);
    });

    it('should throw error when start date is after end date', async () => {
      const startDate = new Date('2023-12-31');
      const endDate = new Date('2023-01-01');

      await expect(service.getHealthRecordsByDateRange(startDate, endDate))
        .rejects.toThrow('Start date must be before end date');
    });
  });

  describe('getHealthRecordsByType', () => {
    it('should return health records by type', async () => {
      const healthRecords = [mockHealthRecord];

      vi.mocked(mockHealthRepository.findByRecordType).mockResolvedValue(healthRecords);

      const result = await service.getHealthRecordsByType('vaccination');

      expect(result).toEqual(healthRecords);
      expect(mockHealthRepository.findByRecordType).toHaveBeenCalledWith('vaccination');
    });
  });

  describe('getOverdueVaccinations', () => {
    it('should return overdue vaccinations', async () => {
      const overdueRecords = [mockHealthRecord];

      vi.mocked(mockHealthRepository.findOverdueVaccinations).mockResolvedValue(overdueRecords);

      const result = await service.getOverdueVaccinations();

      expect(result).toEqual(overdueRecords);
      expect(mockHealthRepository.findOverdueVaccinations).toHaveBeenCalled();
    });
  });

  describe('getHealthAlerts', () => {
    it('should return health alerts for overdue items', async () => {
      const overdueRecord: HealthRecord = {
        ...mockHealthRecord,
        nextDueDate: new Date('2022-01-01') // Overdue
      };

      vi.mocked(mockHealthRepository.findOverdueVaccinations).mockResolvedValue([overdueRecord]);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);

      const result = await service.getHealthAlerts();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: overdueRecord.id,
        alpacaId: overdueRecord.alpacaId,
        alpacaName: mockAlpaca.name,
        recordType: overdueRecord.recordType,
        description: overdueRecord.description
      });
      expect(result[0].daysOverdue).toBeGreaterThan(0);
      expect(result[0].priority).toBe('critical'); // Very overdue
    });

    it('should handle records without alpacas', async () => {
      const overdueRecord: HealthRecord = {
        ...mockHealthRecord,
        nextDueDate: new Date('2022-01-01')
      };

      vi.mocked(mockHealthRepository.findOverdueVaccinations).mockResolvedValue([overdueRecord]);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      const result = await service.getHealthAlerts();

      expect(result).toHaveLength(0); // Should skip records without alpacas
    });
  });

  describe('getVaccinationSchedule', () => {
    it('should return vaccination schedule for all alpacas', async () => {
      const vaccinations = [mockHealthRecord];

      vi.mocked(mockHealthRepository.findByRecordType).mockResolvedValue(vaccinations);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);

      const result = await service.getVaccinationSchedule();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        alpacaId: mockAlpaca.id,
        alpacaName: mockAlpaca.name,
        vaccinationType: mockHealthRecord.description,
        lastVaccination: mockHealthRecord.date,
        nextDueDate: mockHealthRecord.nextDueDate
      });
    });

    it('should filter by alpaca ID when provided', async () => {
      const vaccinations = [mockHealthRecord];

      vi.mocked(mockHealthRepository.findByRecordType).mockResolvedValue(vaccinations);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);

      await service.getVaccinationSchedule('550e8400-e29b-41d4-a716-446655440000');

      expect(mockHealthRepository.findByRecordType).toHaveBeenCalledWith('vaccination');
    });
  });

  describe('getTreatmentSchedule', () => {
    it('should return treatment schedule', async () => {
      const treatmentRecord: HealthRecord = {
        ...mockHealthRecord,
        recordType: 'treatment',
        description: 'Deworming'
      };

      vi.mocked(mockHealthRepository.findByRecordType).mockResolvedValue([treatmentRecord]);
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);

      const result = await service.getTreatmentSchedule();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        alpacaId: mockAlpaca.id,
        alpacaName: mockAlpaca.name,
        treatmentType: treatmentRecord.description,
        lastTreatment: treatmentRecord.date
      });
    });
  });

  describe('getHealthSummary', () => {
    it('should return comprehensive health summary', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1); // Next year
      
      const recentCheckupDate = new Date();
      recentCheckupDate.setMonth(recentCheckupDate.getMonth() - 3); // 3 months ago
      
      const healthRecords = [
        {
          ...mockHealthRecord,
          nextDueDate: futureDate // Not overdue
        },
        {
          ...mockHealthRecord,
          id: '550e8400-e29b-41d4-a716-446655440002',
          recordType: 'checkup' as const,
          description: 'Annual checkup',
          date: recentCheckupDate,
          nextDueDate: undefined
        }
      ];

      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);
      vi.mocked(mockHealthRepository.findByAlpaca).mockResolvedValue(healthRecords);

      const result = await service.getHealthSummary('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toMatchObject({
        alpacaId: '550e8400-e29b-41d4-a716-446655440000',
        totalRecords: 2,
        overdueVaccinations: 0,
        healthStatus: 'excellent'
      });
      expect(result.lastVaccination).toEqual(mockHealthRecord.date);
      expect(result.lastCheckup).toEqual(recentCheckupDate);
    });

    it('should throw error for non-existent alpaca', async () => {
      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(null);

      await expect(service.getHealthSummary('invalid-id'))
        .rejects.toThrow('Alpaca not found');
    });

    it('should detect overdue vaccinations in summary', async () => {
      const overdueRecord: HealthRecord = {
        ...mockHealthRecord,
        nextDueDate: new Date('2022-01-01') // Overdue
      };

      vi.mocked(mockAlpacaRepository.findById).mockResolvedValue(mockAlpaca);
      vi.mocked(mockHealthRepository.findByAlpaca).mockResolvedValue([overdueRecord]);

      const result = await service.getHealthSummary('550e8400-e29b-41d4-a716-446655440000');

      expect(result.overdueVaccinations).toBe(1);
      expect(result.healthStatus).toBe('needs_attention');
    });
  });

  describe('scheduleNextDueDate', () => {
    it('should successfully schedule next due date', async () => {
      const nextDueDate = new Date('2024-06-01');
      const updatedRecord = { ...mockHealthRecord, nextDueDate };

      vi.mocked(mockHealthRepository.update).mockResolvedValue(updatedRecord);

      const result = await service.scheduleNextDueDate('health-1', nextDueDate);

      expect(result).toEqual(updatedRecord);
      expect(mockHealthRepository.update).toHaveBeenCalledWith('health-1', { nextDueDate });
    });

    it('should reject due dates too far in the future', async () => {
      const farFutureDate = new Date();
      farFutureDate.setFullYear(farFutureDate.getFullYear() + 10);

      await expect(service.scheduleNextDueDate('health-1', farFutureDate))
        .rejects.toThrow('Next due date cannot be more than 5 years in the future');
    });
  });

  describe('removeHealthRecord', () => {
    it('should successfully remove health record', async () => {
      vi.mocked(mockHealthRepository.findById).mockResolvedValue(mockHealthRecord);
      vi.mocked(mockHealthRepository.delete).mockResolvedValue(true);

      const result = await service.removeHealthRecord('health-1');

      expect(result).toBe(true);
      expect(mockHealthRepository.delete).toHaveBeenCalledWith('health-1');
    });

    it('should return false for non-existent health record', async () => {
      vi.mocked(mockHealthRepository.findById).mockResolvedValue(null);

      const result = await service.removeHealthRecord('invalid-id');

      expect(result).toBe(false);
    });
  });

  describe('getUpcomingHealthEvents', () => {
    it('should return upcoming health events within specified days', async () => {
      const upcomingRecord: HealthRecord = {
        ...mockHealthRecord,
        nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      };

      vi.mocked(mockHealthRepository.findAll).mockResolvedValue([upcomingRecord]);

      const result = await service.getUpcomingHealthEvents(30);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(upcomingRecord);
    });

    it('should validate days parameter', async () => {
      await expect(service.getUpcomingHealthEvents(0))
        .rejects.toThrow('Days must be between 1 and 365');

      await expect(service.getUpcomingHealthEvents(400))
        .rejects.toThrow('Days must be between 1 and 365');
    });

    it('should filter out records without due dates', async () => {
      const recordWithoutDueDate: HealthRecord = {
        ...mockHealthRecord,
        nextDueDate: undefined
      };

      vi.mocked(mockHealthRepository.findAll).mockResolvedValue([recordWithoutDueDate]);

      const result = await service.getUpcomingHealthEvents(30);

      expect(result).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should wrap repository errors in service errors', async () => {
      const repositoryError = new Error('Database connection failed');
      vi.mocked(mockHealthRepository.findById).mockRejectedValue(repositoryError);

      await expect(service.getHealthRecord('health-1'))
        .rejects.toThrow(HealthServiceError);
    });
  });
});