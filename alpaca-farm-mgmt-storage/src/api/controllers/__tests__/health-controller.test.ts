/**
 * Unit tests for HealthController
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { HealthController, ApiResponse } from '../health-controller';
import { HealthService } from '../../../services/health-service';
import { HealthRecordFactory } from '../../../__tests__/data-factories';
import { MockServiceFactory } from '../../../__tests__/mock-factories';
import { CreateHealthRecordInput, UpdateHealthRecordInput } from '../../../models/health-record';
import { RecordType } from '../../../models/common';

// Mock the HealthService
vi.mock('../../../services/health-service');

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthService: jest.Mocked<HealthService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock service
    mockHealthService = {
      getAllHealthRecords: vi.fn(),
      createHealthRecord: vi.fn(),
      getHealthRecord: vi.fn(),
      updateHealthRecord: vi.fn(),
      deleteHealthRecord: vi.fn(),
      getHealthRecordsByAlpaca: vi.fn(),
      getHealthRecordsByType: vi.fn(),
      getOverdueVaccinations: vi.fn(),
      getHealthAlerts: vi.fn(),
      getHealthSummary: vi.fn()
    } as any;

    // Create controller instance
    controller = new HealthController(mockHealthService);

    // Create mock Express objects
    mockRequest = MockServiceFactory.createMockRequest();
    mockResponse = MockServiceFactory.createMockResponse();
    mockNext = MockServiceFactory.createMockNext();
  });

  describe('getAllHealthRecords', () => {
    it('should return paginated health records with default pagination', async () => {
      // Arrange
      const mockRecords = HealthRecordFactory.createMultiple(3);
      const mockResult = {
        data: mockRecords,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockHealthService.getAllHealthRecords.mockResolvedValue(mockResult);
      mockRequest.query = {};

      // Act
      await controller.getAllHealthRecords(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getAllHealthRecords).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        sortBy: undefined,
        sortOrder: 'desc'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRecords,
        pagination: {
          page: 1,
          limit: 20,
          total: 3,
          totalPages: 1
        }
      });
    });

    it('should handle custom pagination and sorting parameters', async () => {
      // Arrange
      const mockRecords = HealthRecordFactory.createMultiple(2);
      const mockResult = {
        data: mockRecords,
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      mockHealthService.getAllHealthRecords.mockResolvedValue(mockResult);
      mockRequest.query = {
        page: '2',
        limit: '10',
        sortBy: 'date',
        sortOrder: 'asc'
      };

      // Act
      await controller.getAllHealthRecords(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getAllHealthRecords).toHaveBeenCalledWith({
        limit: 10,
        offset: 10,
        sortBy: 'date',
        sortOrder: 'asc'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRecords,
        pagination: {
          page: mockResult.page,
          limit: mockResult.limit,
          total: mockResult.total,
          totalPages: mockResult.totalPages
        }
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockHealthService.getAllHealthRecords.mockRejectedValue(error);
      mockRequest.query = {};

      // Act
      await controller.getAllHealthRecords(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createHealthRecord', () => {
    it('should create health record successfully', async () => {
      // Arrange
      const inputData = HealthRecordFactory.createInput();
      const createdRecord = HealthRecordFactory.create(inputData);
      mockHealthService.createHealthRecord.mockResolvedValue(createdRecord);
      mockRequest.body = inputData;

      // Act
      await controller.createHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.createHealthRecord).toHaveBeenCalledWith(inputData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdRecord
      });
    });

    it('should handle string date conversion', async () => {
      // Arrange
      const inputData = HealthRecordFactory.createInput();
      const inputWithStringDates = {
        ...inputData,
        date: '2024-01-01T00:00:00.000Z',
        nextDueDate: '2024-12-01T00:00:00.000Z'
      };
      const createdRecord = HealthRecordFactory.create(inputData);
      mockHealthService.createHealthRecord.mockResolvedValue(createdRecord);
      mockRequest.body = inputWithStringDates;

      // Act
      await controller.createHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedInput = {
        ...inputWithStringDates,
        date: new Date('2024-01-01T00:00:00.000Z'),
        nextDueDate: new Date('2024-12-01T00:00:00.000Z')
      };
      expect(mockHealthService.createHealthRecord).toHaveBeenCalledWith(expectedInput);
    });

    it('should handle partial date conversion', async () => {
      // Arrange
      const inputData = HealthRecordFactory.createInput();
      const inputWithPartialStringDates = {
        ...inputData,
        date: '2024-01-01T00:00:00.000Z',
        nextDueDate: undefined
      };
      const createdRecord = HealthRecordFactory.create(inputData);
      mockHealthService.createHealthRecord.mockResolvedValue(createdRecord);
      mockRequest.body = inputWithPartialStringDates;

      // Act
      await controller.createHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedInput = {
        ...inputWithPartialStringDates,
        date: new Date('2024-01-01T00:00:00.000Z')
      };
      expect(mockHealthService.createHealthRecord).toHaveBeenCalledWith(expectedInput);
    });

    it('should handle service validation errors', async () => {
      // Arrange
      const inputData = HealthRecordFactory.createInput();
      const validationError = new Error('Invalid health record data');
      mockHealthService.createHealthRecord.mockRejectedValue(validationError);
      mockRequest.body = inputData;

      // Act
      await controller.createHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(validationError);
    });
  });

  describe('getHealthRecord', () => {
    it('should return health record when found', async () => {
      // Arrange
      const healthRecord = HealthRecordFactory.create();
      mockHealthService.getHealthRecord.mockResolvedValue(healthRecord);
      mockRequest.params = { id: healthRecord.id };

      // Act
      await controller.getHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getHealthRecord).toHaveBeenCalledWith(healthRecord.id);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: healthRecord
      });
    });

    it('should return 404 when health record not found', async () => {
      // Arrange
      const recordId = 'non-existent-id';
      mockHealthService.getHealthRecord.mockResolvedValue(null);
      mockRequest.params = { id: recordId };

      // Act
      await controller.getHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getHealthRecord).toHaveBeenCalledWith(recordId);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Health record not found'
        }
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      const recordId = 'test-id';
      const error = new Error('Database error');
      mockHealthService.getHealthRecord.mockRejectedValue(error);
      mockRequest.params = { id: recordId };

      // Act
      await controller.getHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateHealthRecord', () => {
    it('should update health record successfully', async () => {
      // Arrange
      const recordId = 'test-id';
      const updateData = HealthRecordFactory.updateInput();
      const updatedRecord = HealthRecordFactory.create({ id: recordId, ...updateData });
      mockHealthService.updateHealthRecord.mockResolvedValue(updatedRecord);
      mockRequest.params = { id: recordId };
      mockRequest.body = updateData;

      // Act
      await controller.updateHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.updateHealthRecord).toHaveBeenCalledWith(recordId, updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedRecord
      });
    });

    it('should handle string date conversion in updates', async () => {
      // Arrange
      const recordId = 'test-id';
      const updateData = {
        ...HealthRecordFactory.updateInput(),
        date: '2024-01-01T00:00:00.000Z',
        nextDueDate: '2024-12-01T00:00:00.000Z'
      };
      const updatedRecord = HealthRecordFactory.create({ id: recordId });
      mockHealthService.updateHealthRecord.mockResolvedValue(updatedRecord);
      mockRequest.params = { id: recordId };
      mockRequest.body = updateData;

      // Act
      await controller.updateHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedUpdateData = {
        ...updateData,
        date: new Date('2024-01-01T00:00:00.000Z'),
        nextDueDate: new Date('2024-12-01T00:00:00.000Z')
      };
      expect(mockHealthService.updateHealthRecord).toHaveBeenCalledWith(recordId, expectedUpdateData);
    });

    it('should return 404 when health record not found for update', async () => {
      // Arrange
      const recordId = 'non-existent-id';
      const updateData = HealthRecordFactory.updateInput();
      mockHealthService.updateHealthRecord.mockResolvedValue(null);
      mockRequest.params = { id: recordId };
      mockRequest.body = updateData;

      // Act
      await controller.updateHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Health record not found'
        }
      });
    });

    it('should handle service errors during update', async () => {
      // Arrange
      const recordId = 'test-id';
      const updateData = HealthRecordFactory.updateInput();
      const error = new Error('Update failed');
      mockHealthService.updateHealthRecord.mockRejectedValue(error);
      mockRequest.params = { id: recordId };
      mockRequest.body = updateData;

      // Act
      await controller.updateHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteHealthRecord', () => {
    it('should delete health record successfully', async () => {
      // Arrange
      const recordId = 'test-id';
      mockHealthService.deleteHealthRecord.mockResolvedValue(true);
      mockRequest.params = { id: recordId };

      // Act
      await controller.deleteHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.deleteHealthRecord).toHaveBeenCalledWith(recordId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Health record deleted successfully' }
      });
    });

    it('should return 404 when health record not found for deletion', async () => {
      // Arrange
      const recordId = 'non-existent-id';
      mockHealthService.deleteHealthRecord.mockResolvedValue(false);
      mockRequest.params = { id: recordId };

      // Act
      await controller.deleteHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Health record not found'
        }
      });
    });

    it('should handle service errors during deletion', async () => {
      // Arrange
      const recordId = 'test-id';
      const error = new Error('Deletion failed');
      mockHealthService.deleteHealthRecord.mockRejectedValue(error);
      mockRequest.params = { id: recordId };

      // Act
      await controller.deleteHealthRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getHealthRecordsByAlpaca', () => {
    it('should return health records for specific alpaca', async () => {
      // Arrange
      const alpacaId = 'alpaca-123';
      const mockRecords = HealthRecordFactory.createMultiple(3, alpacaId);
      const mockResult = {
        data: mockRecords,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockHealthService.getHealthRecordsByAlpaca.mockResolvedValue(mockResult);
      mockRequest.params = { alpacaId };
      mockRequest.query = {};

      // Act
      await controller.getHealthRecordsByAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getHealthRecordsByAlpaca).toHaveBeenCalledWith(alpacaId, {
        limit: 20,
        offset: 0
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRecords,
        pagination: {
          page: mockResult.page,
          limit: mockResult.limit,
          total: mockResult.total,
          totalPages: mockResult.totalPages
        }
      });
    });

    it('should handle pagination for alpaca health records', async () => {
      // Arrange
      const alpacaId = 'alpaca-123';
      const mockResult = {
        data: [],
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      mockHealthService.getHealthRecordsByAlpaca.mockResolvedValue(mockResult);
      mockRequest.params = { alpacaId };
      mockRequest.query = {
        page: '2',
        limit: '10'
      };

      // Act
      await controller.getHealthRecordsByAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getHealthRecordsByAlpaca).toHaveBeenCalledWith(alpacaId, {
        limit: 10,
        offset: 10
      });
    });

    it('should handle service errors for alpaca health records', async () => {
      // Arrange
      const alpacaId = 'alpaca-123';
      const error = new Error('Failed to fetch alpaca health records');
      mockHealthService.getHealthRecordsByAlpaca.mockRejectedValue(error);
      mockRequest.params = { alpacaId };
      mockRequest.query = {};

      // Act
      await controller.getHealthRecordsByAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getHealthRecordsByType', () => {
    it('should return health records filtered by valid record type', async () => {
      // Arrange
      const recordType: RecordType = 'vaccination';
      const mockRecords = HealthRecordFactory.createMultiple(3).map(r => ({ ...r, recordType }));
      const mockResult = {
        data: mockRecords,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockHealthService.getHealthRecordsByType.mockResolvedValue(mockResult);
      mockRequest.params = { recordType };
      mockRequest.query = {};

      // Act
      await controller.getHealthRecordsByType(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getHealthRecordsByType).toHaveBeenCalledWith(recordType, {
        limit: 20,
        offset: 0
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRecords,
        pagination: {
          page: mockResult.page,
          limit: mockResult.limit,
          total: mockResult.total,
          totalPages: mockResult.totalPages
        }
      });
    });

    it('should return 400 for invalid record type', async () => {
      // Arrange
      const invalidRecordType = 'invalid-type';
      mockRequest.params = { recordType: invalidRecordType };

      // Act
      await controller.getHealthRecordsByType(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_RECORD_TYPE',
          message: 'Record type must be one of: vaccination, checkup, treatment, medication, surgery, injury, illness, other'
        }
      });
      expect(mockHealthService.getHealthRecordsByType).not.toHaveBeenCalled();
    });

    it('should handle all valid record types', async () => {
      const validTypes: RecordType[] = ['vaccination', 'checkup', 'treatment', 'medication', 'surgery', 'injury', 'illness', 'other'];
      
      for (const recordType of validTypes) {
        // Arrange
        const mockResult = {
          data: [],
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        };
        mockHealthService.getHealthRecordsByType.mockResolvedValue(mockResult);
        mockRequest.params = { recordType };
        mockRequest.query = {};

        // Act
        await controller.getHealthRecordsByType(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockHealthService.getHealthRecordsByType).toHaveBeenCalledWith(recordType, {
          limit: 20,
          offset: 0
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        
        // Reset mocks for next iteration
        vi.clearAllMocks();
        mockHealthService.getHealthRecordsByType = vi.fn();
      }
    });

    it('should handle service errors for record type filtering', async () => {
      // Arrange
      const recordType: RecordType = 'vaccination';
      const error = new Error('Failed to filter by record type');
      mockHealthService.getHealthRecordsByType.mockRejectedValue(error);
      mockRequest.params = { recordType };
      mockRequest.query = {};

      // Act
      await controller.getHealthRecordsByType(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getOverdueVaccinations', () => {
    it('should return overdue vaccinations', async () => {
      // Arrange
      const overdueRecords = HealthRecordFactory.createMultiple(2).map(r => ({
        ...r,
        recordType: 'vaccination' as RecordType,
        nextDueDate: new Date(Date.now() - 86400000) // Yesterday
      }));
      mockHealthService.getOverdueVaccinations.mockResolvedValue(overdueRecords);

      // Act
      await controller.getOverdueVaccinations(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getOverdueVaccinations).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: overdueRecords
      });
    });

    it('should handle empty overdue vaccinations list', async () => {
      // Arrange
      mockHealthService.getOverdueVaccinations.mockResolvedValue([]);

      // Act
      await controller.getOverdueVaccinations(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getOverdueVaccinations).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle service errors for overdue vaccinations', async () => {
      // Arrange
      const error = new Error('Failed to fetch overdue vaccinations');
      mockHealthService.getOverdueVaccinations.mockRejectedValue(error);

      // Act
      await controller.getOverdueVaccinations(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getHealthAlerts', () => {
    it('should return health alerts', async () => {
      // Arrange
      const mockAlerts = [
        { type: 'overdue_vaccination', count: 3, message: '3 alpacas have overdue vaccinations' },
        { type: 'upcoming_checkup', count: 5, message: '5 alpacas need checkups soon' }
      ];
      mockHealthService.getHealthAlerts.mockResolvedValue(mockAlerts);

      // Act
      await controller.getHealthAlerts(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getHealthAlerts).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAlerts
      });
    });

    it('should handle empty alerts list', async () => {
      // Arrange
      mockHealthService.getHealthAlerts.mockResolvedValue([]);

      // Act
      await controller.getHealthAlerts(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getHealthAlerts).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle service errors for health alerts', async () => {
      // Arrange
      const error = new Error('Failed to fetch health alerts');
      mockHealthService.getHealthAlerts.mockRejectedValue(error);

      // Act
      await controller.getHealthAlerts(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getHealthSummary', () => {
    it('should return health summary for alpaca', async () => {
      // Arrange
      const alpacaId = 'alpaca-123';
      const mockSummary = {
        alpacaId,
        totalRecords: 10,
        lastCheckup: new Date('2024-01-01'),
        nextVaccination: new Date('2024-06-01'),
        healthStatus: 'good',
        recentRecords: HealthRecordFactory.createMultiple(3, alpacaId)
      };
      mockHealthService.getHealthSummary.mockResolvedValue(mockSummary);
      mockRequest.params = { alpacaId };

      // Act
      await controller.getHealthSummary(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockHealthService.getHealthSummary).toHaveBeenCalledWith(alpacaId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSummary
      });
    });

    it('should handle service errors for health summary', async () => {
      // Arrange
      const alpacaId = 'alpaca-123';
      const error = new Error('Failed to generate health summary');
      mockHealthService.getHealthSummary.mockRejectedValue(error);
      mockRequest.params = { alpacaId };

      // Act
      await controller.getHealthSummary(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});