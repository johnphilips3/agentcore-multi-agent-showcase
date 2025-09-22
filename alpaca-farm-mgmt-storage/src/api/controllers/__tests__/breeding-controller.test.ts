/**
 * Unit tests for BreedingController
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { BreedingController, ApiResponse } from '../breeding-controller';
import { BreedingService } from '../../../services/breeding-service';
import { BreedingRecordFactory } from '../../../__tests__/data-factories';
import { MockServiceFactory } from '../../../__tests__/mock-factories';
import { CreateBreedingRecordInput, UpdateBreedingRecordInput } from '../../../models/breeding-record';

// Mock the BreedingService
vi.mock('../../../services/breeding-service');

describe('BreedingController', () => {
  let controller: BreedingController;
  let mockBreedingService: jest.Mocked<BreedingService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock service
    mockBreedingService = {
      getAllBreedingRecords: vi.fn(),
      createBreedingRecord: vi.fn(),
      getBreedingRecord: vi.fn(),
      updateBreedingRecord: vi.fn(),
      deleteBreedingRecord: vi.fn(),
      getBreedingRecordsBySire: vi.fn(),
      getBreedingRecordsByDam: vi.fn(),
      getBreedingRecordsByParent: vi.fn(),
      getExpectedBirths: vi.fn(),
      getBreedingStatistics: vi.fn(),
      getBreedingRecordsByDateRange: vi.fn(),
      validateBreedingPair: vi.fn()
    } as any;

    // Create controller instance
    controller = new BreedingController(mockBreedingService);

    // Create mock Express objects
    mockRequest = MockServiceFactory.createMockRequest();
    mockResponse = MockServiceFactory.createMockResponse();
    mockNext = MockServiceFactory.createMockNext();
  });

  describe('getAllBreedingRecords', () => {
    it('should return paginated breeding records with default pagination', async () => {
      // Arrange
      const mockRecords = BreedingRecordFactory.createMultiple(3);
      const mockResult = {
        data: mockRecords,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockBreedingService.getAllBreedingRecords.mockResolvedValue(mockResult);
      mockRequest.query = {};

      // Act
      await controller.getAllBreedingRecords(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getAllBreedingRecords).toHaveBeenCalledWith({
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
      const mockRecords = BreedingRecordFactory.createMultiple(2);
      const mockResult = {
        data: mockRecords,
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      mockBreedingService.getAllBreedingRecords.mockResolvedValue(mockResult);
      mockRequest.query = {
        page: '2',
        limit: '10',
        sortBy: 'breedingDate',
        sortOrder: 'asc'
      };

      // Act
      await controller.getAllBreedingRecords(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getAllBreedingRecords).toHaveBeenCalledWith({
        limit: 10,
        offset: 10,
        sortBy: 'breedingDate',
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
      mockBreedingService.getAllBreedingRecords.mockRejectedValue(error);
      mockRequest.query = {};

      // Act
      await controller.getAllBreedingRecords(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createBreedingRecord', () => {
    it('should create breeding record successfully', async () => {
      // Arrange
      const inputData = BreedingRecordFactory.createInput();
      const createdRecord = BreedingRecordFactory.create(inputData);
      mockBreedingService.createBreedingRecord.mockResolvedValue(createdRecord);
      mockRequest.body = inputData;

      // Act
      await controller.createBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.createBreedingRecord).toHaveBeenCalledWith(inputData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdRecord
      });
    });

    it('should handle string date conversion', async () => {
      // Arrange
      const inputData = BreedingRecordFactory.createInput();
      const inputWithStringDates = {
        ...inputData,
        breedingDate: '2024-01-01T00:00:00.000Z',
        expectedDueDate: '2024-12-01T00:00:00.000Z',
        actualBirthDate: '2024-12-05T00:00:00.000Z'
      };
      const createdRecord = BreedingRecordFactory.create(inputData);
      mockBreedingService.createBreedingRecord.mockResolvedValue(createdRecord);
      mockRequest.body = inputWithStringDates;

      // Act
      await controller.createBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedInput = {
        ...inputWithStringDates,
        breedingDate: new Date('2024-01-01T00:00:00.000Z'),
        expectedDueDate: new Date('2024-12-01T00:00:00.000Z'),
        actualBirthDate: new Date('2024-12-05T00:00:00.000Z')
      };
      expect(mockBreedingService.createBreedingRecord).toHaveBeenCalledWith(expectedInput);
    });

    it('should handle partial date conversion', async () => {
      // Arrange
      const inputData = BreedingRecordFactory.createInput();
      const inputWithPartialStringDates = {
        ...inputData,
        breedingDate: '2024-01-01T00:00:00.000Z',
        expectedDueDate: undefined,
        actualBirthDate: undefined
      };
      const createdRecord = BreedingRecordFactory.create(inputData);
      mockBreedingService.createBreedingRecord.mockResolvedValue(createdRecord);
      mockRequest.body = inputWithPartialStringDates;

      // Act
      await controller.createBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedInput = {
        ...inputWithPartialStringDates,
        breedingDate: new Date('2024-01-01T00:00:00.000Z')
      };
      expect(mockBreedingService.createBreedingRecord).toHaveBeenCalledWith(expectedInput);
    });

    it('should handle service validation errors', async () => {
      // Arrange
      const inputData = BreedingRecordFactory.createInput();
      const validationError = new Error('Invalid breeding record data');
      mockBreedingService.createBreedingRecord.mockRejectedValue(validationError);
      mockRequest.body = inputData;

      // Act
      await controller.createBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(validationError);
    });
  });

  describe('getBreedingRecord', () => {
    it('should return breeding record when found', async () => {
      // Arrange
      const breedingRecord = BreedingRecordFactory.create();
      mockBreedingService.getBreedingRecord.mockResolvedValue(breedingRecord);
      mockRequest.params = { id: breedingRecord.id };

      // Act
      await controller.getBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getBreedingRecord).toHaveBeenCalledWith(breedingRecord.id);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: breedingRecord
      });
    });

    it('should return 404 when breeding record not found', async () => {
      // Arrange
      const recordId = 'non-existent-id';
      mockBreedingService.getBreedingRecord.mockResolvedValue(null);
      mockRequest.params = { id: recordId };

      // Act
      await controller.getBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getBreedingRecord).toHaveBeenCalledWith(recordId);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Breeding record not found'
        }
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      const recordId = 'test-id';
      const error = new Error('Database error');
      mockBreedingService.getBreedingRecord.mockRejectedValue(error);
      mockRequest.params = { id: recordId };

      // Act
      await controller.getBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateBreedingRecord', () => {
    it('should update breeding record successfully', async () => {
      // Arrange
      const recordId = 'test-id';
      const updateData = BreedingRecordFactory.updateInput();
      const updatedRecord = BreedingRecordFactory.create({ id: recordId, ...updateData });
      mockBreedingService.updateBreedingRecord.mockResolvedValue(updatedRecord);
      mockRequest.params = { id: recordId };
      mockRequest.body = updateData;

      // Act
      await controller.updateBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.updateBreedingRecord).toHaveBeenCalledWith(recordId, updateData);
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
        ...BreedingRecordFactory.updateInput(),
        breedingDate: '2024-01-01T00:00:00.000Z',
        expectedDueDate: '2024-12-01T00:00:00.000Z',
        actualBirthDate: '2024-12-05T00:00:00.000Z'
      };
      const updatedRecord = BreedingRecordFactory.create({ id: recordId });
      mockBreedingService.updateBreedingRecord.mockResolvedValue(updatedRecord);
      mockRequest.params = { id: recordId };
      mockRequest.body = updateData;

      // Act
      await controller.updateBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedUpdateData = {
        ...updateData,
        breedingDate: new Date('2024-01-01T00:00:00.000Z'),
        expectedDueDate: new Date('2024-12-01T00:00:00.000Z'),
        actualBirthDate: new Date('2024-12-05T00:00:00.000Z')
      };
      expect(mockBreedingService.updateBreedingRecord).toHaveBeenCalledWith(recordId, expectedUpdateData);
    });

    it('should return 404 when breeding record not found for update', async () => {
      // Arrange
      const recordId = 'non-existent-id';
      const updateData = BreedingRecordFactory.updateInput();
      mockBreedingService.updateBreedingRecord.mockResolvedValue(null);
      mockRequest.params = { id: recordId };
      mockRequest.body = updateData;

      // Act
      await controller.updateBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Breeding record not found'
        }
      });
    });

    it('should handle service errors during update', async () => {
      // Arrange
      const recordId = 'test-id';
      const updateData = BreedingRecordFactory.updateInput();
      const error = new Error('Update failed');
      mockBreedingService.updateBreedingRecord.mockRejectedValue(error);
      mockRequest.params = { id: recordId };
      mockRequest.body = updateData;

      // Act
      await controller.updateBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteBreedingRecord', () => {
    it('should delete breeding record successfully', async () => {
      // Arrange
      const recordId = 'test-id';
      mockBreedingService.deleteBreedingRecord.mockResolvedValue(true);
      mockRequest.params = { id: recordId };

      // Act
      await controller.deleteBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.deleteBreedingRecord).toHaveBeenCalledWith(recordId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Breeding record deleted successfully' }
      });
    });

    it('should return 404 when breeding record not found for deletion', async () => {
      // Arrange
      const recordId = 'non-existent-id';
      mockBreedingService.deleteBreedingRecord.mockResolvedValue(false);
      mockRequest.params = { id: recordId };

      // Act
      await controller.deleteBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Breeding record not found'
        }
      });
    });

    it('should handle service errors during deletion', async () => {
      // Arrange
      const recordId = 'test-id';
      const error = new Error('Deletion failed');
      mockBreedingService.deleteBreedingRecord.mockRejectedValue(error);
      mockRequest.params = { id: recordId };

      // Act
      await controller.deleteBreedingRecord(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getBreedingRecordsBySire', () => {
    it('should return breeding records for specific sire', async () => {
      // Arrange
      const sireId = 'sire-123';
      const mockRecords = BreedingRecordFactory.createMultiple(3, { sireId });
      const mockResult = {
        data: mockRecords,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockBreedingService.getBreedingRecordsBySire.mockResolvedValue(mockResult);
      mockRequest.params = { sireId };
      mockRequest.query = {};

      // Act
      await controller.getBreedingRecordsBySire(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getBreedingRecordsBySire).toHaveBeenCalledWith(sireId, {
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

    it('should handle pagination for sire breeding records', async () => {
      // Arrange
      const sireId = 'sire-123';
      const mockResult = {
        data: [],
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      mockBreedingService.getBreedingRecordsBySire.mockResolvedValue(mockResult);
      mockRequest.params = { sireId };
      mockRequest.query = {
        page: '2',
        limit: '10'
      };

      // Act
      await controller.getBreedingRecordsBySire(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getBreedingRecordsBySire).toHaveBeenCalledWith(sireId, {
        limit: 10,
        offset: 10
      });
    });

    it('should handle service errors for sire breeding records', async () => {
      // Arrange
      const sireId = 'sire-123';
      const error = new Error('Failed to fetch sire breeding records');
      mockBreedingService.getBreedingRecordsBySire.mockRejectedValue(error);
      mockRequest.params = { sireId };
      mockRequest.query = {};

      // Act
      await controller.getBreedingRecordsBySire(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getBreedingRecordsByDam', () => {
    it('should return breeding records for specific dam', async () => {
      // Arrange
      const damId = 'dam-123';
      const mockRecords = BreedingRecordFactory.createMultiple(3, { damId });
      const mockResult = {
        data: mockRecords,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockBreedingService.getBreedingRecordsByDam.mockResolvedValue(mockResult);
      mockRequest.params = { damId };
      mockRequest.query = {};

      // Act
      await controller.getBreedingRecordsByDam(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getBreedingRecordsByDam).toHaveBeenCalledWith(damId, {
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

    it('should handle service errors for dam breeding records', async () => {
      // Arrange
      const damId = 'dam-123';
      const error = new Error('Failed to fetch dam breeding records');
      mockBreedingService.getBreedingRecordsByDam.mockRejectedValue(error);
      mockRequest.params = { damId };
      mockRequest.query = {};

      // Act
      await controller.getBreedingRecordsByDam(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getBreedingRecordsByParent', () => {
    it('should return breeding records for specific parent', async () => {
      // Arrange
      const parentId = 'parent-123';
      const mockRecords = BreedingRecordFactory.createMultiple(3);
      const mockResult = {
        data: mockRecords,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockBreedingService.getBreedingRecordsByParent.mockResolvedValue(mockResult);
      mockRequest.params = { parentId };
      mockRequest.query = {};

      // Act
      await controller.getBreedingRecordsByParent(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getBreedingRecordsByParent).toHaveBeenCalledWith(parentId, {
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

    it('should handle service errors for parent breeding records', async () => {
      // Arrange
      const parentId = 'parent-123';
      const error = new Error('Failed to fetch parent breeding records');
      mockBreedingService.getBreedingRecordsByParent.mockRejectedValue(error);
      mockRequest.params = { parentId };
      mockRequest.query = {};

      // Act
      await controller.getBreedingRecordsByParent(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getExpectedBirths', () => {
    it('should return expected births with default days ahead', async () => {
      // Arrange
      const expectedBirths = BreedingRecordFactory.createMultiple(2).map(r => ({
        ...r,
        expectedDueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days from now
      }));
      mockBreedingService.getExpectedBirths.mockResolvedValue(expectedBirths);
      mockRequest.query = {};

      // Act
      await controller.getExpectedBirths(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getExpectedBirths).toHaveBeenCalledWith(30);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expectedBirths
      });
    });

    it('should handle custom days ahead parameter', async () => {
      // Arrange
      const expectedBirths = BreedingRecordFactory.createMultiple(1);
      mockBreedingService.getExpectedBirths.mockResolvedValue(expectedBirths);
      mockRequest.query = { days: '60' };

      // Act
      await controller.getExpectedBirths(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getExpectedBirths).toHaveBeenCalledWith(60);
    });

    it('should handle service errors for expected births', async () => {
      // Arrange
      const error = new Error('Failed to fetch expected births');
      mockBreedingService.getExpectedBirths.mockRejectedValue(error);
      mockRequest.query = {};

      // Act
      await controller.getExpectedBirths(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getBreedingStatistics', () => {
    it('should return breeding statistics', async () => {
      // Arrange
      const mockStats = {
        totalBreedings: 25,
        successfulBreedings: 20,
        successRate: 0.8,
        averageGestationPeriod: 335,
        expectedBirths: 5
      };
      mockBreedingService.getBreedingStatistics.mockResolvedValue(mockStats);

      // Act
      await controller.getBreedingStatistics(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getBreedingStatistics).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    it('should handle service errors for breeding statistics', async () => {
      // Arrange
      const error = new Error('Failed to calculate breeding statistics');
      mockBreedingService.getBreedingStatistics.mockRejectedValue(error);

      // Act
      await controller.getBreedingStatistics(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getBreedingRecordsByDateRange', () => {
    it('should return breeding records within date range', async () => {
      // Arrange
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const mockRecords = BreedingRecordFactory.createMultiple(3);
      const mockResult = {
        data: mockRecords,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockBreedingService.getBreedingRecordsByDateRange.mockResolvedValue(mockResult);
      mockRequest.query = {
        startDate,
        endDate
      };

      // Act
      await controller.getBreedingRecordsByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getBreedingRecordsByDateRange).toHaveBeenCalledWith(
        new Date(startDate),
        new Date(endDate),
        {
          limit: 20,
          offset: 0
        }
      );
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

    it('should return 400 when startDate is missing', async () => {
      // Arrange
      mockRequest.query = {
        endDate: '2024-12-31'
      };

      // Act
      await controller.getBreedingRecordsByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Both startDate and endDate are required'
        }
      });
      expect(mockBreedingService.getBreedingRecordsByDateRange).not.toHaveBeenCalled();
    });

    it('should return 400 when endDate is missing', async () => {
      // Arrange
      mockRequest.query = {
        startDate: '2024-01-01'
      };

      // Act
      await controller.getBreedingRecordsByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Both startDate and endDate are required'
        }
      });
    });

    it('should return 400 for invalid date format', async () => {
      // Arrange
      mockRequest.query = {
        startDate: 'invalid-date',
        endDate: '2024-12-31'
      };

      // Act
      await controller.getBreedingRecordsByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DATE',
          message: 'Invalid date format. Use YYYY-MM-DD'
        }
      });
    });

    it('should handle pagination with date range', async () => {
      // Arrange
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const mockResult = {
        data: [],
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      mockBreedingService.getBreedingRecordsByDateRange.mockResolvedValue(mockResult);
      mockRequest.query = {
        startDate,
        endDate,
        page: '2',
        limit: '10'
      };

      // Act
      await controller.getBreedingRecordsByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.getBreedingRecordsByDateRange).toHaveBeenCalledWith(
        new Date(startDate),
        new Date(endDate),
        {
          limit: 10,
          offset: 10
        }
      );
    });

    it('should handle service errors for date range query', async () => {
      // Arrange
      const error = new Error('Failed to fetch breeding records by date range');
      mockBreedingService.getBreedingRecordsByDateRange.mockRejectedValue(error);
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      // Act
      await controller.getBreedingRecordsByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('validateBreedingPair', () => {
    it('should validate breeding pair successfully', async () => {
      // Arrange
      const sireId = 'sire-123';
      const damId = 'dam-456';
      const validationResult = {
        isValid: true,
        inbreedingCoefficient: 0.05,
        warnings: [],
        recommendations: ['Good genetic match']
      };
      mockBreedingService.validateBreedingPair.mockResolvedValue(validationResult);
      mockRequest.body = { sireId, damId };

      // Act
      await controller.validateBreedingPair(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.validateBreedingPair).toHaveBeenCalledWith(sireId, damId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: validationResult
      });
    });

    it('should return 400 when sireId is missing', async () => {
      // Arrange
      mockRequest.body = { damId: 'dam-456' };

      // Act
      await controller.validateBreedingPair(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Both sireId and damId are required'
        }
      });
      expect(mockBreedingService.validateBreedingPair).not.toHaveBeenCalled();
    });

    it('should return 400 when damId is missing', async () => {
      // Arrange
      mockRequest.body = { sireId: 'sire-123' };

      // Act
      await controller.validateBreedingPair(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Both sireId and damId are required'
        }
      });
    });

    it('should handle validation with warnings', async () => {
      // Arrange
      const sireId = 'sire-123';
      const damId = 'dam-456';
      const validationResult = {
        isValid: true,
        inbreedingCoefficient: 0.15,
        warnings: ['High inbreeding coefficient'],
        recommendations: ['Consider alternative breeding pairs']
      };
      mockBreedingService.validateBreedingPair.mockResolvedValue(validationResult);
      mockRequest.body = { sireId, damId };

      // Act
      await controller.validateBreedingPair(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockBreedingService.validateBreedingPair).toHaveBeenCalledWith(sireId, damId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: validationResult
      });
    });

    it('should handle service errors for breeding pair validation', async () => {
      // Arrange
      const sireId = 'sire-123';
      const damId = 'dam-456';
      const error = new Error('Failed to validate breeding pair');
      mockBreedingService.validateBreedingPair.mockRejectedValue(error);
      mockRequest.body = { sireId, damId };

      // Act
      await controller.validateBreedingPair(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});