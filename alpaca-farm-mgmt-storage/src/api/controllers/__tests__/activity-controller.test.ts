/**
 * Activity Controller Tests
 * Unit tests for the Activity Management REST controller
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { ActivityController } from '../activity-controller.js';
import { ActivityService } from '../../../services/index.js';
import { ApiErrorClass } from '../../errors.js';
import { 
  ManagementActivity, 
  CreateActivityRequest, 
  UpdateActivityRequest,
  BulkActivityRequest 
} from '../../types.js';

// Mock ActivityService
const mockActivityService = {
  findAll: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByAlpaca: vi.fn(),
  createBulkActivity: vi.fn(),
  findByDateRange: vi.fn(),
  findByActivityType: vi.fn(),
  findByPerformer: vi.fn(),
  getActivityStats: vi.fn(),
  getRecentActivities: vi.fn(),
  getActivitySummary: vi.fn(),
  getAuditTrail: vi.fn(),
  getScheduledActivities: vi.fn(),
  getPerformanceMetrics: vi.fn()
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

describe('ActivityController', () => {
  let controller: ActivityController;
  let req: any;
  let res: any;

  beforeEach(() => {
    controller = new ActivityController(mockActivityService);
    req = createMockRequest();
    res = createMockResponse();
    vi.clearAllMocks();
  });

  describe('listActivities', () => {
    it('should list activities with pagination', async () => {
      const mockActivities = [
        { 
          id: '1', 
          activityType: 'feeding', 
          date: '2023-01-01',
          alpacaIds: ['alpaca1'],
          performedBy: 'John Doe',
          description: 'Morning feeding'
        },
        { 
          id: '2', 
          activityType: 'shearing', 
          date: '2023-01-02',
          alpacaIds: ['alpaca2'],
          performedBy: 'Jane Smith',
          description: 'Annual shearing'
        }
      ];
      
      mockActivityService.findAll.mockResolvedValue({
        activities: mockActivities,
        total: 2
      });

      await controller.listActivities(req, res);

      expect(mockActivityService.findAll).toHaveBeenCalledWith({
        limit: 20,
        offset: 0
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockActivities,
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
        activityType: 'feeding',
        performedBy: 'John Doe',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      };

      mockActivityService.findAll.mockResolvedValue({
        activities: [],
        total: 0
      });

      await controller.listActivities(req, res);

      expect(mockActivityService.findAll).toHaveBeenCalledWith({
        activityType: 'feeding',
        performedBy: 'John Doe',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
        limit: 20,
        offset: 0
      });
    });
  });

  describe('createActivity', () => {
    it('should create a new activity', async () => {
      const createRequest: CreateActivityRequest = {
        activityType: 'feeding',
        date: '2023-01-01',
        alpacaIds: ['alpaca1', 'alpaca2'],
        performedBy: 'John Doe',
        description: 'Morning feeding session'
      };

      const createdActivity: ManagementActivity = {
        id: 'new-id',
        ...createRequest,
        createdAt: '2023-01-01T00:00:00Z'
      };

      req.validatedBody = createRequest;
      mockActivityService.create.mockResolvedValue(createdActivity);

      await controller.createActivity(req, res);

      expect(mockActivityService.create).toHaveBeenCalledWith(createRequest);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdActivity
      });
    });
  });

  describe('getActivity', () => {
    it('should get activity by ID', async () => {
      const activity: ManagementActivity = {
        id: 'test-id',
        activityType: 'feeding',
        date: '2023-01-01',
        alpacaIds: ['alpaca1'],
        performedBy: 'John Doe',
        description: 'Morning feeding',
        createdAt: '2023-01-01T00:00:00Z'
      };

      req.params = { id: 'test-id' };
      mockActivityService.findById.mockResolvedValue(activity);

      await controller.getActivity(req, res);

      expect(mockActivityService.findById).toHaveBeenCalledWith('test-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: activity
      });
    });

    it('should throw not found error when activity does not exist', async () => {
      req.params = { id: 'non-existent-id' };
      mockActivityService.findById.mockResolvedValue(null);

      await expect(controller.getActivity(req, res)).rejects.toThrow(ApiErrorClass);
      
      expect(mockActivityService.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('updateActivity', () => {
    it('should update activity', async () => {
      const updateRequest: UpdateActivityRequest = {
        description: 'Updated feeding session',
        notes: 'Added extra hay'
      };

      const updatedActivity: ManagementActivity = {
        id: 'test-id',
        activityType: 'feeding',
        date: '2023-01-01',
        alpacaIds: ['alpaca1'],
        performedBy: 'John Doe',
        description: 'Updated feeding session',
        notes: 'Added extra hay',
        createdAt: '2023-01-01T00:00:00Z'
      };

      req.params = { id: 'test-id' };
      req.validatedBody = updateRequest;
      mockActivityService.update.mockResolvedValue(updatedActivity);

      await controller.updateActivity(req, res);

      expect(mockActivityService.update).toHaveBeenCalledWith('test-id', updateRequest);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedActivity
      });
    });
  });

  describe('deleteActivity', () => {
    it('should delete activity', async () => {
      req.params = { id: 'test-id' };
      mockActivityService.delete.mockResolvedValue(true);

      await controller.deleteActivity(req, res);

      expect(mockActivityService.delete).toHaveBeenCalledWith('test-id');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should throw not found error when activity does not exist', async () => {
      req.params = { id: 'non-existent-id' };
      mockActivityService.delete.mockResolvedValue(false);

      await expect(controller.deleteActivity(req, res)).rejects.toThrow(ApiErrorClass);
      
      expect(mockActivityService.delete).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('getAlpacaActivities', () => {
    it('should get activities for alpaca', async () => {
      const activities = [
        { 
          id: '1', 
          activityType: 'feeding', 
          date: '2023-01-01',
          alpacaIds: ['alpaca1'],
          performedBy: 'John Doe',
          description: 'Feeding'
        }
      ];

      req.params = { id: 'alpaca1' };
      req.query = {};
      mockActivityService.findByAlpaca.mockResolvedValue(activities);

      await controller.getAlpacaActivities(req, res);

      expect(mockActivityService.findByAlpaca).toHaveBeenCalledWith('alpaca1', { alpacaId: 'alpaca1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: activities
      });
    });

    it('should handle query filters', async () => {
      const activities = [];

      req.params = { id: 'alpaca1' };
      req.query = {
        activityType: 'feeding',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      };
      mockActivityService.findByAlpaca.mockResolvedValue(activities);

      await controller.getAlpacaActivities(req, res);

      expect(mockActivityService.findByAlpaca).toHaveBeenCalledWith('alpaca1', {
        alpacaId: 'alpaca1',
        activityType: 'feeding',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      });
    });
  });

  describe('createBulkActivity', () => {
    it('should create bulk activity', async () => {
      const bulkRequest: BulkActivityRequest = {
        activityType: 'shearing',
        date: '2023-06-01',
        alpacaIds: ['alpaca1', 'alpaca2', 'alpaca3'],
        performedBy: 'Shearing Team',
        description: 'Annual herd shearing'
      };

      const createdActivity: ManagementActivity = {
        id: 'bulk-id',
        ...bulkRequest,
        createdAt: '2023-06-01T00:00:00Z'
      };

      req.validatedBody = bulkRequest;
      mockActivityService.createBulkActivity.mockResolvedValue(createdActivity);

      await controller.createBulkActivity(req, res);

      expect(mockActivityService.createBulkActivity).toHaveBeenCalledWith(bulkRequest);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdActivity
      });
    });
  });

  describe('getActivitiesByDateRange', () => {
    it('should get activities by date range', async () => {
      const activities = [
        { 
          id: '1', 
          activityType: 'feeding', 
          date: '2023-06-01',
          alpacaIds: ['alpaca1'],
          performedBy: 'John Doe',
          description: 'Mid-year feeding'
        }
      ];

      req.query = {
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      };
      mockActivityService.findByDateRange.mockResolvedValue(activities);

      await controller.getActivitiesByDateRange(req, res);

      expect(mockActivityService.findByDateRange).toHaveBeenCalledWith('2023-01-01', '2023-12-31');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: activities
      });
    });

    it('should require dateFrom and dateTo parameters', async () => {
      req.query = { dateFrom: '2023-01-01' }; // Missing dateTo

      await expect(controller.getActivitiesByDateRange(req, res)).rejects.toThrow(ApiErrorClass);
    });
  });

  describe('getActivitiesByType', () => {
    it('should get activities by type', async () => {
      const activities = [
        { 
          id: '1', 
          activityType: 'feeding', 
          date: '2023-01-01',
          alpacaIds: ['alpaca1'],
          performedBy: 'John Doe',
          description: 'Feeding activity'
        }
      ];

      req.params = { type: 'feeding' };
      req.query = {};
      mockActivityService.findByActivityType.mockResolvedValue(activities);

      await controller.getActivitiesByType(req, res);

      expect(mockActivityService.findByActivityType).toHaveBeenCalledWith('feeding', undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: activities
      });
    });

    it('should handle pagination for type query', async () => {
      const result = {
        activities: [],
        total: 0
      };

      req.params = { type: 'feeding' };
      req.query = { page: '2', limit: '10' };
      mockActivityService.findByActivityType.mockResolvedValue(result);

      await controller.getActivitiesByType(req, res);

      expect(mockActivityService.findByActivityType).toHaveBeenCalledWith('feeding', {
        page: 2,
        limit: 10,
        offset: 10
      });
    });
  });

  describe('getActivitiesByPerformer', () => {
    it('should get activities by performer', async () => {
      const activities = [
        { 
          id: '1', 
          activityType: 'feeding', 
          date: '2023-01-01',
          alpacaIds: ['alpaca1'],
          performedBy: 'John Doe',
          description: 'Feeding activity'
        }
      ];

      req.params = { performer: 'John Doe' };
      req.query = {};
      mockActivityService.findByPerformer.mockResolvedValue(activities);

      await controller.getActivitiesByPerformer(req, res);

      expect(mockActivityService.findByPerformer).toHaveBeenCalledWith('John Doe', undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: activities
      });
    });
  });

  describe('getAlpacaActivityStats', () => {
    it('should get activity statistics for alpaca', async () => {
      const stats = {
        totalActivities: 15,
        feedingCount: 10,
        shearingCount: 2,
        weighingCount: 2,
        trainingCount: 1,
        lastActivity: '2023-06-01',
        mostFrequentActivity: 'feeding'
      };

      req.params = { id: 'alpaca1' };
      mockActivityService.getActivityStats.mockResolvedValue(stats);

      await controller.getAlpacaActivityStats(req, res);

      expect(mockActivityService.getActivityStats).toHaveBeenCalledWith('alpaca1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: stats
      });
    });
  });

  describe('getRecentActivities', () => {
    it('should get recent activities with default days', async () => {
      const activities = [
        { 
          id: '1', 
          activityType: 'feeding', 
          date: '2023-12-15',
          alpacaIds: ['alpaca1'],
          performedBy: 'John Doe',
          description: 'Recent feeding'
        }
      ];

      req.query = {};
      mockActivityService.getRecentActivities.mockResolvedValue(activities);

      await controller.getRecentActivities(req, res);

      expect(mockActivityService.getRecentActivities).toHaveBeenCalledWith(7, 50);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: activities
      });
    });

    it('should get recent activities with custom parameters', async () => {
      const activities = [];

      req.query = { days: '3', limit: '10' };
      mockActivityService.getRecentActivities.mockResolvedValue(activities);

      await controller.getRecentActivities(req, res);

      expect(mockActivityService.getRecentActivities).toHaveBeenCalledWith(3, 10);
    });
  });

  describe('getActivitySummary', () => {
    it('should get activity summary', async () => {
      const summary = {
        totalActivities: 100,
        byType: {
          feeding: 60,
          shearing: 20,
          weighing: 15,
          training: 5
        },
        byDate: [
          { date: '2023-01-01', count: 5 },
          { date: '2023-01-02', count: 3 }
        ]
      };

      req.query = {
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
        groupBy: 'day'
      };
      mockActivityService.getActivitySummary.mockResolvedValue(summary);

      await controller.getActivitySummary(req, res);

      expect(mockActivityService.getActivitySummary).toHaveBeenCalledWith('2023-01-01', '2023-12-31', 'day');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: summary
      });
    });

    it('should require dateFrom and dateTo parameters', async () => {
      req.query = { dateFrom: '2023-01-01' }; // Missing dateTo

      await expect(controller.getActivitySummary(req, res)).rejects.toThrow(ApiErrorClass);
    });
  });

  describe('getActivityAuditTrail', () => {
    it('should get activity audit trail', async () => {
      const result = {
        activities: [
          { 
            id: '1', 
            activityType: 'feeding', 
            date: '2023-01-01',
            alpacaIds: ['alpaca1'],
            performedBy: 'John Doe',
            description: 'Audit trail activity'
          }
        ],
        total: 1
      };

      req.query = {
        alpacaId: 'alpaca1',
        performedBy: 'John Doe'
      };
      mockActivityService.getAuditTrail.mockResolvedValue(result);

      await controller.getActivityAuditTrail(req, res);

      expect(mockActivityService.getAuditTrail).toHaveBeenCalledWith(
        {
          alpacaId: 'alpaca1',
          performedBy: 'John Doe'
        },
        {
          limit: 20,
          offset: 0
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: result.activities,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      });
    });
  });

  describe('getScheduledActivities', () => {
    it('should get scheduled activities', async () => {
      const activities = [
        { 
          id: '1', 
          activityType: 'shearing', 
          date: '2024-06-01',
          alpacaIds: ['alpaca1'],
          performedBy: 'Scheduled Team',
          description: 'Scheduled shearing'
        }
      ];

      req.query = { days: '60' };
      mockActivityService.getScheduledActivities.mockResolvedValue(activities);

      await controller.getScheduledActivities(req, res);

      expect(mockActivityService.getScheduledActivities).toHaveBeenCalledWith(60);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: activities
      });
    });
  });

  describe('getActivityMetrics', () => {
    it('should get activity performance metrics', async () => {
      const metrics = {
        totalActivities: 500,
        averageActivitiesPerDay: 5.5,
        mostActivePerformer: 'John Doe',
        mostCommonActivity: 'feeding',
        efficiencyScore: 0.85
      };

      req.query = {
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
        performedBy: 'John Doe'
      };
      mockActivityService.getPerformanceMetrics.mockResolvedValue(metrics);

      await controller.getActivityMetrics(req, res);

      expect(mockActivityService.getPerformanceMetrics).toHaveBeenCalledWith({
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
        performedBy: 'John Doe'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: metrics
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockActivityService.findAll.mockRejectedValue(error);

      await expect(controller.listActivities(req, res)).rejects.toThrow(error);
    });

    it('should handle API errors', async () => {
      const apiError = ApiErrorClass.validation('Invalid data');
      mockActivityService.create.mockRejectedValue(apiError);

      req.validatedBody = { activityType: 'test' };

      await expect(controller.createActivity(req, res)).rejects.toThrow(apiError);
    });
  });
});