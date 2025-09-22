/**
 * Health Controller Tests
 * Unit tests for the Health Records REST controller
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { HealthController } from '../health-controller.js';
import { HealthService } from '../../../services/index.js';
import { ApiErrorClass } from '../../errors.js';
import { HealthRecord, CreateHealthRecordRequest, UpdateHealthRecordRequest } from '../../types.js';

// Mock HealthService
const mockHealthService = {
  findAll: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByAlpaca: vi.fn(),
  findOverdueVaccinations: vi.fn(),
  findByDateRange: vi.fn(),
  findByRecordType: vi.fn(),
  getHealthStats: vi.fn(),
  getUpcomingReminders: vi.fn()
} as any;

// Mock request and response objects
function createMockRequest(overrides: any = {}): any {
  return {
    params: {},
    query: {},
    body: {},
    validatedBody: undefined,
    validatedQuery: undefined,
    pagination: { page: 1, limit: 20, offset: 0 },
    ...overrides
  };
}

function createMockResponse(): any {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  };
  return res;
}

describe('HealthController', () => {
  let controller: HealthController;
  let req: any;
  let res: any;

  beforeEach(() => {
    controller = new HealthController(mockHealthService);
    req = createMockRequest();
    res = createMockResponse();
    vi.clearAllMocks();
  });

  describe('listHealthRecords', () => {
    it('should list health records with pagination', async () => {
      const mockHealthRecords = [
        { 
          id: '1', 
          alpacaId: 'alpaca1', 
          recordType: 'vaccination', 
          date: '2023-01-01',
          description: 'Annual vaccination'
        },
        { 
          id: '2', 
          alpacaId: 'alpaca2', 
          recordType: 'checkup', 
          date: '2023-01-02',
          description: 'Routine checkup'
        }
      ];
      
      mockHealthService.findAll.mockResolvedValue({
        healthRecords: mockHealthRecords,
        total: 2
      });

      await controller.listHealthRecords(req, res);

      expect(mockHealthService.findAll).toHaveBeenCalledWith({
        limit: 20,
        offset: 0
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockHealthRecords,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1
        }
      });
    });

    it('should handle query parameters', async () => {
      req.validatedQuery = {
        alpacaId: 'alpaca1',
        recordType: 'vaccination',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      };

      mockHealthService.findAll.mockResolvedValue({
        healthRecords: [],
        total: 0
      });

      await controller.listHealthRecords(req, res);

      expect(mockHealthService.findAll).toHaveBeenCalledWith({
        alpacaId: 'alpaca1',
        recordType: 'vaccination',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
        limit: 20,
        offset: 0
      });
    });
  });

  describe('createHealthRecord', () => {
    it('should create a new health record', async () => {
      const createRequest: CreateHealthRecordRequest = {
        alpacaId: 'alpaca1',
        recordType: 'vaccination',
        date: '2023-01-01',
        description: 'Annual vaccination',
        veterinarian: 'Dr. Smith'
      };

      const createdHealthRecord: HealthRecord = {
        id: 'new-id',
        ...createRequest,
        createdAt: '2023-01-01T00:00:00Z'
      };

      req.validatedBody = createRequest;
      mockHealthService.create.mockResolvedValue(createdHealthRecord);

      await controller.createHealthRecord(req, res);

      expect(mockHealthService.create).toHaveBeenCalledWith(createRequest);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdHealthRecord
      });
    });
  });

  describe('getHealthRecord', () => {
    it('should get health record by ID', async () => {
      const healthRecord: HealthRecord = {
        id: 'test-id',
        alpacaId: 'alpaca1',
        recordType: 'vaccination',
        date: '2023-01-01',
        description: 'Annual vaccination',
        createdAt: '2023-01-01T00:00:00Z'
      };

      req.params = { id: 'test-id' };
      mockHealthService.findById.mockResolvedValue(healthRecord);

      await controller.getHealthRecord(req, res);

      expect(mockHealthService.findById).toHaveBeenCalledWith('test-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: healthRecord
      });
    });

    it('should throw not found error when health record does not exist', async () => {
      req.params = { id: 'non-existent-id' };
      mockHealthService.findById.mockResolvedValue(null);

      await expect(controller.getHealthRecord(req, res)).rejects.toThrow(ApiErrorClass);
      
      expect(mockHealthService.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('updateHealthRecord', () => {
    it('should update health record', async () => {
      const updateRequest: UpdateHealthRecordRequest = {
        description: 'Updated vaccination record',
        veterinarian: 'Dr. Johnson'
      };

      const updatedHealthRecord: HealthRecord = {
        id: 'test-id',
        alpacaId: 'alpaca1',
        recordType: 'vaccination',
        date: '2023-01-01',
        description: 'Updated vaccination record',
        veterinarian: 'Dr. Johnson',
        createdAt: '2023-01-01T00:00:00Z'
      };

      req.params = { id: 'test-id' };
      req.validatedBody = updateRequest;
      mockHealthService.update.mockResolvedValue(updatedHealthRecord);

      await controller.updateHealthRecord(req, res);

      expect(mockHealthService.update).toHaveBeenCalledWith('test-id', updateRequest);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedHealthRecord
      });
    });
  });

  describe('deleteHealthRecord', () => {
    it('should delete health record', async () => {
      req.params = { id: 'test-id' };
      mockHealthService.delete.mockResolvedValue(true);

      await controller.deleteHealthRecord(req, res);

      expect(mockHealthService.delete).toHaveBeenCalledWith('test-id');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should throw not found error when health record does not exist', async () => {
      req.params = { id: 'non-existent-id' };
      mockHealthService.delete.mockResolvedValue(false);

      await expect(controller.deleteHealthRecord(req, res)).rejects.toThrow(ApiErrorClass);
      
      expect(mockHealthService.delete).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('getAlpacaHealthRecords', () => {
    it('should get health records for alpaca', async () => {
      const healthRecords = [
        { 
          id: '1', 
          alpacaId: 'alpaca1', 
          recordType: 'vaccination', 
          date: '2023-01-01',
          description: 'Vaccination'
        }
      ];

      req.params = { id: 'alpaca1' };
      req.query = {};
      mockHealthService.findByAlpaca.mockResolvedValue(healthRecords);

      await controller.getAlpacaHealthRecords(req, res);

      expect(mockHealthService.findByAlpaca).toHaveBeenCalledWith('alpaca1', { alpacaId: 'alpaca1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: healthRecords
      });
    });

    it('should handle query filters', async () => {
      const healthRecords = [];

      req.params = { id: 'alpaca1' };
      req.query = {
        recordType: 'vaccination',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      };
      mockHealthService.findByAlpaca.mockResolvedValue(healthRecords);

      await controller.getAlpacaHealthRecords(req, res);

      expect(mockHealthService.findByAlpaca).toHaveBeenCalledWith('alpaca1', {
        alpacaId: 'alpaca1',
        recordType: 'vaccination',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      });
    });
  });

  describe('getOverdueVaccinations', () => {
    it('should get overdue vaccinations', async () => {
      const overdueRecords = [
        { 
          id: '1', 
          alpacaId: 'alpaca1', 
          recordType: 'vaccination', 
          nextDueDate: '2022-12-01',
          description: 'Overdue vaccination'
        }
      ];

      mockHealthService.findOverdueVaccinations.mockResolvedValue(overdueRecords);

      await controller.getOverdueVaccinations(req, res);

      expect(mockHealthService.findOverdueVaccinations).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: overdueRecords
      });
    });
  });

  describe('getHealthRecordsByDateRange', () => {
    it('should get health records by date range', async () => {
      const healthRecords = [
        { 
          id: '1', 
          alpacaId: 'alpaca1', 
          recordType: 'vaccination', 
          date: '2023-06-01',
          description: 'Mid-year vaccination'
        }
      ];

      req.query = {
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      };
      mockHealthService.findByDateRange.mockResolvedValue(healthRecords);

      await controller.getHealthRecordsByDateRange(req, res);

      expect(mockHealthService.findByDateRange).toHaveBeenCalledWith('2023-01-01', '2023-12-31');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: healthRecords
      });
    });

    it('should require dateFrom and dateTo parameters', async () => {
      req.query = { dateFrom: '2023-01-01' }; // Missing dateTo

      await expect(controller.getHealthRecordsByDateRange(req, res)).rejects.toThrow(ApiErrorClass);
    });
  });

  describe('getHealthRecordsByType', () => {
    it('should get health records by type', async () => {
      const healthRecords = [
        { 
          id: '1', 
          alpacaId: 'alpaca1', 
          recordType: 'vaccination', 
          date: '2023-01-01',
          description: 'Vaccination record'
        }
      ];

      req.params = { type: 'vaccination' };
      req.query = {};
      mockHealthService.findByRecordType.mockResolvedValue(healthRecords);

      await controller.getHealthRecordsByType(req, res);

      expect(mockHealthService.findByRecordType).toHaveBeenCalledWith('vaccination', undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: healthRecords
      });
    });

    it('should handle pagination for type query', async () => {
      const result = {
        healthRecords: [],
        total: 0
      };

      req.params = { type: 'vaccination' };
      req.query = { page: '2', limit: '10' };
      mockHealthService.findByRecordType.mockResolvedValue(result);

      await controller.getHealthRecordsByType(req, res);

      expect(mockHealthService.findByRecordType).toHaveBeenCalledWith('vaccination', {
        page: 2,
        limit: 10,
        offset: 10
      });
    });
  });

  describe('getAlpacaHealthStats', () => {
    it('should get health statistics for alpaca', async () => {
      const stats = {
        totalRecords: 5,
        vaccinationCount: 3,
        treatmentCount: 1,
        checkupCount: 1,
        lastCheckup: '2023-06-01',
        nextDueVaccination: '2024-01-01'
      };

      req.params = { id: 'alpaca1' };
      mockHealthService.getHealthStats.mockResolvedValue(stats);

      await controller.getAlpacaHealthStats(req, res);

      expect(mockHealthService.getHealthStats).toHaveBeenCalledWith('alpaca1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: stats
      });
    });
  });

  describe('getHealthReminders', () => {
    it('should get upcoming health reminders with default days', async () => {
      const reminders = [
        { 
          id: '1', 
          alpacaId: 'alpaca1', 
          recordType: 'vaccination', 
          nextDueDate: '2023-12-15',
          description: 'Upcoming vaccination'
        }
      ];

      req.query = {};
      mockHealthService.getUpcomingReminders.mockResolvedValue(reminders);

      await controller.getHealthReminders(req, res);

      expect(mockHealthService.getUpcomingReminders).toHaveBeenCalledWith(30);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: reminders
      });
    });

    it('should get upcoming health reminders with custom days', async () => {
      const reminders = [];

      req.query = { days: '7' };
      mockHealthService.getUpcomingReminders.mockResolvedValue(reminders);

      await controller.getHealthReminders(req, res);

      expect(mockHealthService.getUpcomingReminders).toHaveBeenCalledWith(7);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockHealthService.findAll.mockRejectedValue(error);

      await expect(controller.listHealthRecords(req, res)).rejects.toThrow(error);
    });

    it('should handle API errors', async () => {
      const apiError = ApiErrorClass.validation('Invalid data');
      mockHealthService.create.mockRejectedValue(apiError);

      req.validatedBody = { alpacaId: 'test' };

      await expect(controller.createHealthRecord(req, res)).rejects.toThrow(apiError);
    });
  });
});