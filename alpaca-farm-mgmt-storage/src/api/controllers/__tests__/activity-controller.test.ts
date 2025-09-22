/**
 * Unit tests for ActivityController
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ActivityController, ApiResponse } from '../activity-controller';
import { ActivityService } from '../../../services/activity-service';
import { ManagementActivityFactory } from '../../../__tests__/data-factories';
import { MockServiceFactory } from '../../../__tests__/mock-factories';
import { CreateManagementActivityInput, UpdateManagementActivityInput } from '../../../models/management-activity';
import { ActivityType } from '../../../models/common';

// Mock the ActivityService
vi.mock('../../../services/activity-service');

describe('ActivityController', () => {
  let controller: ActivityController;
  let mockActivityService: jest.Mocked<ActivityService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock service
    mockActivityService = {
      getAllActivities: vi.fn(),
      createActivity: vi.fn(),
      getActivity: vi.fn(),
      updateActivity: vi.fn(),
      deleteActivity: vi.fn(),
      getActivitiesByAlpaca: vi.fn(),
      getActivitiesByType: vi.fn(),
      getActivitiesByPerformer: vi.fn(),
      getActivityStatistics: vi.fn(),
      getAlpacaActivitySummary: vi.fn(),
      getActivitiesByDateRange: vi.fn(),
      createBulkActivity: vi.fn(),
      getScheduledActivities: vi.fn(),
      getPerformanceMetrics: vi.fn()
    } as any;

    // Create controller instance
    controller = new ActivityController(mockActivityService);

    // Create mock Express objects
    mockRequest = MockServiceFactory.createMockRequest();
    mockResponse = MockServiceFactory.createMockResponse();
    mockNext = MockServiceFactory.createMockNext();
  });

  describe('getAllActivities', () => {
    it('should return paginated activities with default pagination', async () => {
      // Arrange
      const mockActivities = ManagementActivityFactory.createMultiple(3);
      const mockResult = {
        data: mockActivities,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockActivityService.getAllActivities.mockResolvedValue(mockResult);
      mockRequest.query = {};

      // Act
      await controller.getAllActivities(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getAllActivities).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        sortBy: undefined,
        sortOrder: 'desc'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockActivities,
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
      const mockActivities = ManagementActivityFactory.createMultiple(2);
      const mockResult = {
        data: mockActivities,
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      mockActivityService.getAllActivities.mockResolvedValue(mockResult);
      mockRequest.query = {
        page: '2',
        limit: '10',
        sortBy: 'date',
        sortOrder: 'asc'
      };

      // Act
      await controller.getAllActivities(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getAllActivities).toHaveBeenCalledWith({
        limit: 10,
        offset: 10,
        sortBy: 'date',
        sortOrder: 'asc'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockActivities,
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
      mockActivityService.getAllActivities.mockRejectedValue(error);
      mockRequest.query = {};

      // Act
      await controller.getAllActivities(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createActivity', () => {
    it('should create activity successfully', async () => {
      // Arrange
      const alpacaIds = ['alpaca-1', 'alpaca-2'];
      const inputData = ManagementActivityFactory.createInput({ alpacaIds });
      const createdActivity = ManagementActivityFactory.create(inputData);
      mockActivityService.createActivity.mockResolvedValue(createdActivity);
      mockRequest.body = inputData;

      // Act
      await controller.createActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.createActivity).toHaveBeenCalledWith(inputData, alpacaIds);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdActivity
      });
    });

    it('should handle string date conversion', async () => {
      // Arrange
      const alpacaIds = ['alpaca-1'];
      const inputData = ManagementActivityFactory.createInput({ alpacaIds });
      const inputWithStringDate = {
        ...inputData,
        date: '2024-01-01T00:00:00.000Z'
      };
      const createdActivity = ManagementActivityFactory.create(inputData);
      mockActivityService.createActivity.mockResolvedValue(createdActivity);
      mockRequest.body = inputWithStringDate;

      // Act
      await controller.createActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedInput = {
        ...inputWithStringDate,
        date: new Date('2024-01-01T00:00:00.000Z')
      };
      expect(mockActivityService.createActivity).toHaveBeenCalledWith(expectedInput, alpacaIds);
    });

    it('should return 400 when alpacaIds is missing', async () => {
      // Arrange
      const inputData = ManagementActivityFactory.createInput();
      delete inputData.alpacaIds;
      mockRequest.body = inputData;

      // Act
      await controller.createActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_ALPACAS',
          message: 'At least one alpaca ID must be provided'
        }
      });
      expect(mockActivityService.createActivity).not.toHaveBeenCalled();
    });

    it('should return 400 when alpacaIds is empty array', async () => {
      // Arrange
      const inputData = ManagementActivityFactory.createInput({ alpacaIds: [] });
      mockRequest.body = inputData;

      // Act
      await controller.createActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_ALPACAS',
          message: 'At least one alpaca ID must be provided'
        }
      });
    });

    it('should return 400 when alpacaIds is not an array', async () => {
      // Arrange
      const inputData = ManagementActivityFactory.createInput();
      const inputWithInvalidAlpacaIds = {
        ...inputData,
        alpacaIds: 'not-an-array'
      };
      mockRequest.body = inputWithInvalidAlpacaIds;

      // Act
      await controller.createActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_ALPACAS',
          message: 'At least one alpaca ID must be provided'
        }
      });
    });

    it('should handle service validation errors', async () => {
      // Arrange
      const alpacaIds = ['alpaca-1'];
      const inputData = ManagementActivityFactory.createInput({ alpacaIds });
      const validationError = new Error('Invalid activity data');
      mockActivityService.createActivity.mockRejectedValue(validationError);
      mockRequest.body = inputData;

      // Act
      await controller.createActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(validationError);
    });
  });

  describe('getActivity', () => {
    it('should return activity when found', async () => {
      // Arrange
      const activity = ManagementActivityFactory.create();
      mockActivityService.getActivity.mockResolvedValue(activity);
      mockRequest.params = { id: activity.id };

      // Act
      await controller.getActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getActivity).toHaveBeenCalledWith(activity.id);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: activity
      });
    });

    it('should return 404 when activity not found', async () => {
      // Arrange
      const activityId = 'non-existent-id';
      mockActivityService.getActivity.mockResolvedValue(null);
      mockRequest.params = { id: activityId };

      // Act
      await controller.getActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getActivity).toHaveBeenCalledWith(activityId);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found'
        }
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      const activityId = 'test-id';
      const error = new Error('Database error');
      mockActivityService.getActivity.mockRejectedValue(error);
      mockRequest.params = { id: activityId };

      // Act
      await controller.getActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateActivity', () => {
    it('should update activity successfully', async () => {
      // Arrange
      const activityId = 'test-id';
      const alpacaIds = ['alpaca-1', 'alpaca-2'];
      const updateData = ManagementActivityFactory.updateInput({ alpacaIds });
      const updatedActivity = ManagementActivityFactory.create({ id: activityId, ...updateData });
      mockActivityService.updateActivity.mockResolvedValue(updatedActivity);
      mockRequest.params = { id: activityId };
      mockRequest.body = updateData;

      // Act
      await controller.updateActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.updateActivity).toHaveBeenCalledWith(activityId, updateData, alpacaIds);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedActivity
      });
    });

    it('should handle string date conversion in updates', async () => {
      // Arrange
      const activityId = 'test-id';
      const updateData = {
        ...ManagementActivityFactory.updateInput(),
        date: '2024-01-01T00:00:00.000Z'
      };
      const updatedActivity = ManagementActivityFactory.create({ id: activityId });
      mockActivityService.updateActivity.mockResolvedValue(updatedActivity);
      mockRequest.params = { id: activityId };
      mockRequest.body = updateData;

      // Act
      await controller.updateActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedUpdateData = {
        ...updateData,
        date: new Date('2024-01-01T00:00:00.000Z')
      };
      expect(mockActivityService.updateActivity).toHaveBeenCalledWith(activityId, expectedUpdateData, undefined);
    });

    it('should return 404 when activity not found for update', async () => {
      // Arrange
      const activityId = 'non-existent-id';
      const updateData = ManagementActivityFactory.updateInput();
      mockActivityService.updateActivity.mockResolvedValue(null);
      mockRequest.params = { id: activityId };
      mockRequest.body = updateData;

      // Act
      await controller.updateActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found'
        }
      });
    });

    it('should handle service errors during update', async () => {
      // Arrange
      const activityId = 'test-id';
      const updateData = ManagementActivityFactory.updateInput();
      const error = new Error('Update failed');
      mockActivityService.updateActivity.mockRejectedValue(error);
      mockRequest.params = { id: activityId };
      mockRequest.body = updateData;

      // Act
      await controller.updateActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteActivity', () => {
    it('should delete activity successfully', async () => {
      // Arrange
      const activityId = 'test-id';
      mockActivityService.deleteActivity.mockResolvedValue(true);
      mockRequest.params = { id: activityId };

      // Act
      await controller.deleteActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.deleteActivity).toHaveBeenCalledWith(activityId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Activity deleted successfully' }
      });
    });

    it('should return 404 when activity not found for deletion', async () => {
      // Arrange
      const activityId = 'non-existent-id';
      mockActivityService.deleteActivity.mockResolvedValue(false);
      mockRequest.params = { id: activityId };

      // Act
      await controller.deleteActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found'
        }
      });
    });

    it('should handle service errors during deletion', async () => {
      // Arrange
      const activityId = 'test-id';
      const error = new Error('Deletion failed');
      mockActivityService.deleteActivity.mockRejectedValue(error);
      mockRequest.params = { id: activityId };

      // Act
      await controller.deleteActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getActivitiesByAlpaca', () => {
    it('should return activities for specific alpaca', async () => {
      // Arrange
      const alpacaId = 'alpaca-123';
      const mockActivities = ManagementActivityFactory.createMultiple(3).map(a => ({
        ...a,
        alpacaIds: [alpacaId]
      }));
      const mockResult = {
        data: mockActivities,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockActivityService.getActivitiesByAlpaca.mockResolvedValue(mockResult);
      mockRequest.params = { alpacaId };
      mockRequest.query = {};

      // Act
      await controller.getActivitiesByAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getActivitiesByAlpaca).toHaveBeenCalledWith(alpacaId, {
        limit: 20,
        offset: 0
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockActivities,
        pagination: {
          page: mockResult.page,
          limit: mockResult.limit,
          total: mockResult.total,
          totalPages: mockResult.totalPages
        }
      });
    });

    it('should handle pagination for alpaca activities', async () => {
      // Arrange
      const alpacaId = 'alpaca-123';
      const mockResult = {
        data: [],
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      mockActivityService.getActivitiesByAlpaca.mockResolvedValue(mockResult);
      mockRequest.params = { alpacaId };
      mockRequest.query = {
        page: '2',
        limit: '10'
      };

      // Act
      await controller.getActivitiesByAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getActivitiesByAlpaca).toHaveBeenCalledWith(alpacaId, {
        limit: 10,
        offset: 10
      });
    });

    it('should handle service errors for alpaca activities', async () => {
      // Arrange
      const alpacaId = 'alpaca-123';
      const error = new Error('Failed to fetch alpaca activities');
      mockActivityService.getActivitiesByAlpaca.mockRejectedValue(error);
      mockRequest.params = { alpacaId };
      mockRequest.query = {};

      // Act
      await controller.getActivitiesByAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getActivitiesByType', () => {
    it('should return activities filtered by valid activity type', async () => {
      // Arrange
      const activityType: ActivityType = 'feeding';
      const mockActivities = ManagementActivityFactory.createMultiple(3).map(a => ({ ...a, activityType }));
      const mockResult = {
        data: mockActivities,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockActivityService.getActivitiesByType.mockResolvedValue(mockResult);
      mockRequest.params = { activityType };
      mockRequest.query = {};

      // Act
      await controller.getActivitiesByType(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getActivitiesByType).toHaveBeenCalledWith(activityType, {
        limit: 20,
        offset: 0
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockActivities,
        pagination: {
          page: mockResult.page,
          limit: mockResult.limit,
          total: mockResult.total,
          totalPages: mockResult.totalPages
        }
      });
    });

    it('should return 400 for invalid activity type', async () => {
      // Arrange
      const invalidActivityType = 'invalid-type';
      mockRequest.params = { activityType: invalidActivityType };

      // Act
      await controller.getActivitiesByType(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_ACTIVITY_TYPE',
          message: 'Activity type must be one of: feeding, shearing, weighing, moving, training, other'
        }
      });
      expect(mockActivityService.getActivitiesByType).not.toHaveBeenCalled();
    });

    it('should handle all valid activity types', async () => {
      const validTypes: ActivityType[] = ['feeding', 'shearing', 'weighing', 'moving', 'training', 'other'];
      
      for (const activityType of validTypes) {
        // Arrange
        const mockResult = {
          data: [],
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        };
        mockActivityService.getActivitiesByType.mockResolvedValue(mockResult);
        mockRequest.params = { activityType };
        mockRequest.query = {};

        // Act
        await controller.getActivitiesByType(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockActivityService.getActivitiesByType).toHaveBeenCalledWith(activityType, {
          limit: 20,
          offset: 0
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        
        // Reset mocks for next iteration
        vi.clearAllMocks();
        mockActivityService.getActivitiesByType = vi.fn();
      }
    });

    it('should handle service errors for activity type filtering', async () => {
      // Arrange
      const activityType: ActivityType = 'feeding';
      const error = new Error('Failed to filter by activity type');
      mockActivityService.getActivitiesByType.mockRejectedValue(error);
      mockRequest.params = { activityType };
      mockRequest.query = {};

      // Act
      await controller.getActivitiesByType(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getActivitiesByPerformer', () => {
    it('should return activities for specific performer', async () => {
      // Arrange
      const performer = 'John Doe';
      const mockActivities = ManagementActivityFactory.createMultiple(3).map(a => ({ ...a, performedBy: performer }));
      const mockResult = {
        data: mockActivities,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockActivityService.getActivitiesByPerformer.mockResolvedValue(mockResult);
      mockRequest.params = { performer };
      mockRequest.query = {};

      // Act
      await controller.getActivitiesByPerformer(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getActivitiesByPerformer).toHaveBeenCalledWith(performer, {
        limit: 20,
        offset: 0
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockActivities,
        pagination: {
          page: mockResult.page,
          limit: mockResult.limit,
          total: mockResult.total,
          totalPages: mockResult.totalPages
        }
      });
    });

    it('should handle service errors for performer filtering', async () => {
      // Arrange
      const performer = 'John Doe';
      const error = new Error('Failed to filter by performer');
      mockActivityService.getActivitiesByPerformer.mockRejectedValue(error);
      mockRequest.params = { performer };
      mockRequest.query = {};

      // Act
      await controller.getActivitiesByPerformer(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getActivityStatistics', () => {
    it('should return activity statistics', async () => {
      // Arrange
      const mockStats = {
        totalActivities: 100,
        activitiesByType: {
          feeding: 40,
          shearing: 20,
          weighing: 15,
          moving: 10,
          training: 10,
          other: 5
        },
        activitiesThisMonth: 25,
        mostActivePerformer: 'John Doe'
      };
      mockActivityService.getActivityStatistics.mockResolvedValue(mockStats);

      // Act
      await controller.getActivityStatistics(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getActivityStatistics).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    it('should handle service errors for activity statistics', async () => {
      // Arrange
      const error = new Error('Failed to calculate activity statistics');
      mockActivityService.getActivityStatistics.mockRejectedValue(error);

      // Act
      await controller.getActivityStatistics(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getAlpacaActivitySummary', () => {
    it('should return activity summary for alpaca', async () => {
      // Arrange
      const alpacaId = 'alpaca-123';
      const mockSummary = {
        alpacaId,
        totalActivities: 15,
        lastActivity: new Date('2024-01-01'),
        activitiesByType: {
          feeding: 8,
          weighing: 3,
          shearing: 2,
          other: 2
        },
        recentActivities: ManagementActivityFactory.createMultiple(3)
      };
      mockActivityService.getAlpacaActivitySummary.mockResolvedValue(mockSummary);
      mockRequest.params = { alpacaId };

      // Act
      await controller.getAlpacaActivitySummary(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getAlpacaActivitySummary).toHaveBeenCalledWith(alpacaId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSummary
      });
    });

    it('should handle service errors for alpaca activity summary', async () => {
      // Arrange
      const alpacaId = 'alpaca-123';
      const error = new Error('Failed to generate activity summary');
      mockActivityService.getAlpacaActivitySummary.mockRejectedValue(error);
      mockRequest.params = { alpacaId };

      // Act
      await controller.getAlpacaActivitySummary(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getActivitiesByDateRange', () => {
    it('should return activities within date range', async () => {
      // Arrange
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const mockActivities = ManagementActivityFactory.createMultiple(3);
      const mockResult = {
        data: mockActivities,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockActivityService.getActivitiesByDateRange.mockResolvedValue(mockResult);
      mockRequest.query = {
        startDate,
        endDate
      };

      // Act
      await controller.getActivitiesByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getActivitiesByDateRange).toHaveBeenCalledWith(
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
        data: mockActivities,
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
      await controller.getActivitiesByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Both startDate and endDate are required'
        }
      });
      expect(mockActivityService.getActivitiesByDateRange).not.toHaveBeenCalled();
    });

    it('should return 400 when endDate is missing', async () => {
      // Arrange
      mockRequest.query = {
        startDate: '2024-01-01'
      };

      // Act
      await controller.getActivitiesByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

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
      await controller.getActivitiesByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

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

    it('should handle service errors for date range query', async () => {
      // Arrange
      const error = new Error('Failed to fetch activities by date range');
      mockActivityService.getActivitiesByDateRange.mockRejectedValue(error);
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      // Act
      await controller.getActivitiesByDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createBulkActivity', () => {
    it('should create bulk activity successfully', async () => {
      // Arrange
      const alpacaIds = ['alpaca-1', 'alpaca-2', 'alpaca-3'];
      const inputData = ManagementActivityFactory.createInput({ alpacaIds });
      const createdActivity = ManagementActivityFactory.createBulkActivity(3, inputData);
      mockActivityService.createBulkActivity.mockResolvedValue(createdActivity);
      mockRequest.body = inputData;

      // Act
      await controller.createBulkActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.createBulkActivity).toHaveBeenCalledWith(inputData, alpacaIds);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdActivity
      });
    });

    it('should handle string date conversion for bulk activity', async () => {
      // Arrange
      const alpacaIds = ['alpaca-1', 'alpaca-2'];
      const inputData = ManagementActivityFactory.createInput({ alpacaIds });
      const inputWithStringDate = {
        ...inputData,
        date: '2024-01-01T00:00:00.000Z'
      };
      const createdActivity = ManagementActivityFactory.createBulkActivity(2);
      mockActivityService.createBulkActivity.mockResolvedValue(createdActivity);
      mockRequest.body = inputWithStringDate;

      // Act
      await controller.createBulkActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedInput = {
        ...inputWithStringDate,
        date: new Date('2024-01-01T00:00:00.000Z')
      };
      expect(mockActivityService.createBulkActivity).toHaveBeenCalledWith(expectedInput, alpacaIds);
    });

    it('should handle service errors for bulk activity creation', async () => {
      // Arrange
      const alpacaIds = ['alpaca-1'];
      const inputData = ManagementActivityFactory.createInput({ alpacaIds });
      const error = new Error('Failed to create bulk activity');
      mockActivityService.createBulkActivity.mockRejectedValue(error);
      mockRequest.body = inputData;

      // Act
      await controller.createBulkActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getScheduledActivities', () => {
    it('should return scheduled activities with default days ahead', async () => {
      // Arrange
      const scheduledActivities = ManagementActivityFactory.createMultiple(2).map(a => ({
        ...a,
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      }));
      mockActivityService.getScheduledActivities.mockResolvedValue(scheduledActivities);
      mockRequest.query = {};

      // Act
      await controller.getScheduledActivities(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getScheduledActivities).toHaveBeenCalledWith(7);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: scheduledActivities
      });
    });

    it('should handle custom days ahead parameter', async () => {
      // Arrange
      const scheduledActivities = ManagementActivityFactory.createMultiple(1);
      mockActivityService.getScheduledActivities.mockResolvedValue(scheduledActivities);
      mockRequest.query = { days: '14' };

      // Act
      await controller.getScheduledActivities(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getScheduledActivities).toHaveBeenCalledWith(14);
    });

    it('should handle service errors for scheduled activities', async () => {
      // Arrange
      const error = new Error('Failed to fetch scheduled activities');
      mockActivityService.getScheduledActivities.mockRejectedValue(error);
      mockRequest.query = {};

      // Act
      await controller.getScheduledActivities(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics with filters', async () => {
      // Arrange
      const mockMetrics = {
        totalActivities: 100,
        averageActivitiesPerDay: 3.3,
        performerEfficiency: {
          'John Doe': 85,
          'Jane Smith': 92
        },
        activityCompletionRate: 0.95,
        timeToCompletion: {
          average: 45,
          median: 40
        }
      };
      mockActivityService.getPerformanceMetrics.mockResolvedValue(mockMetrics);
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        activityType: 'feeding',
        performer: 'John Doe'
      };

      // Act
      await controller.getPerformanceMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedFilters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        activityType: 'feeding',
        performer: 'John Doe'
      };
      expect(mockActivityService.getPerformanceMetrics).toHaveBeenCalledWith(expectedFilters);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockMetrics
      });
    });

    it('should handle empty filters', async () => {
      // Arrange
      const mockMetrics = {
        totalActivities: 50,
        averageActivitiesPerDay: 2.1
      };
      mockActivityService.getPerformanceMetrics.mockResolvedValue(mockMetrics);
      mockRequest.query = {};

      // Act
      await controller.getPerformanceMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockActivityService.getPerformanceMetrics).toHaveBeenCalledWith({});
    });

    it('should handle service errors for performance metrics', async () => {
      // Arrange
      const error = new Error('Failed to calculate performance metrics');
      mockActivityService.getPerformanceMetrics.mockRejectedValue(error);
      mockRequest.query = {};

      // Act
      await controller.getPerformanceMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});