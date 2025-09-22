import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivityService, ActivityStatistics, AlpacaActivitySummary } from '../activity-service';
import { PostgreSQLActivityRepository, QueryOptions, PaginatedResult } from '../../repositories/pg-activity-repository';
import { ManagementActivity, CreateManagementActivityInput, UpdateManagementActivityInput } from '../../models/management-activity';
import { ActivityType } from '../../models/common';
import { ManagementActivityFactory } from '../../__tests__/data-factories';
import { MockActivityRepositoryFactory } from '../../__tests__/mock-factories';

describe('ActivityService', () => {
  let service: ActivityService;
  let mockRepository: ReturnType<typeof MockActivityRepositoryFactory.create>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = MockActivityRepositoryFactory.create();
    service = new ActivityService(mockRepository as any);
  });

  const mockActivity = ManagementActivityFactory.create({
    id: 'activity-1',
    activityType: 'feeding',
    date: new Date('2023-01-01'),
    alpacaIds: ['alpaca-1'],
    performedBy: 'John Doe',
    description: 'Daily feeding',
    notes: 'All animals ate well'
  });

  const mockPaginatedResult: PaginatedResult<ManagementActivity> = {
    data: [mockActivity],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1
  };

  describe('createActivity', () => {
    it('should successfully create a valid activity', async () => {
      const input: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: new Date('2023-01-01'),
        performedBy: 'John Doe',
        description: 'Daily feeding'
      };
      const alpacaIds = ['alpaca-1'];

      mockRepository.create.mockResolvedValue(mockActivity);

      const result = await service.createActivity(input, alpacaIds);

      expect(result).toEqual(mockActivity);
      expect(mockRepository.create).toHaveBeenCalledWith(input, alpacaIds);
    });

    it('should throw error for missing activity type', async () => {
      const input: CreateManagementActivityInput = {
        activityType: undefined as any,
        date: new Date('2023-01-01'),
        performedBy: 'John Doe',
        description: 'Daily feeding'
      };
      const alpacaIds = ['alpaca-1'];

      await expect(service.createActivity(input, alpacaIds)).rejects.toThrow('Activity type is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for missing date', async () => {
      const input: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: undefined as any,
        performedBy: 'John Doe',
        description: 'Daily feeding'
      };
      const alpacaIds = ['alpaca-1'];

      await expect(service.createActivity(input, alpacaIds)).rejects.toThrow('Date is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for empty performed by', async () => {
      const input: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: new Date('2023-01-01'),
        performedBy: '',
        description: 'Daily feeding'
      };
      const alpacaIds = ['alpaca-1'];

      await expect(service.createActivity(input, alpacaIds)).rejects.toThrow('Performed by is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only performed by', async () => {
      const input: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: new Date('2023-01-01'),
        performedBy: '   ',
        description: 'Daily feeding'
      };
      const alpacaIds = ['alpaca-1'];

      await expect(service.createActivity(input, alpacaIds)).rejects.toThrow('Performed by is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for empty description', async () => {
      const input: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: new Date('2023-01-01'),
        performedBy: 'John Doe',
        description: ''
      };
      const alpacaIds = ['alpaca-1'];

      await expect(service.createActivity(input, alpacaIds)).rejects.toThrow('Description is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only description', async () => {
      const input: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: new Date('2023-01-01'),
        performedBy: 'John Doe',
        description: '   '
      };
      const alpacaIds = ['alpaca-1'];

      await expect(service.createActivity(input, alpacaIds)).rejects.toThrow('Description is required');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for empty alpaca IDs array', async () => {
      const input: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: new Date('2023-01-01'),
        performedBy: 'John Doe',
        description: 'Daily feeding'
      };
      const alpacaIds: string[] = [];

      await expect(service.createActivity(input, alpacaIds)).rejects.toThrow('At least one alpaca must be associated with the activity');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for undefined alpaca IDs', async () => {
      const input: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: new Date('2023-01-01'),
        performedBy: 'John Doe',
        description: 'Daily feeding'
      };

      await expect(service.createActivity(input, undefined as any)).rejects.toThrow('At least one alpaca must be associated with the activity');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const input: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: new Date('2023-01-01'),
        performedBy: 'John Doe',
        description: 'Daily feeding'
      };
      const alpacaIds = ['alpaca-1'];

      const repositoryError = new Error('Database connection failed');
      mockRepository.create.mockRejectedValue(repositoryError);

      await expect(service.createActivity(input, alpacaIds)).rejects.toThrow('Database connection failed');
    });
  });

  describe('getActivity', () => {
    it('should return activity by ID', async () => {
      mockRepository.findById.mockResolvedValue(mockActivity);

      const result = await service.getActivity('activity-1');

      expect(result).toEqual(mockActivity);
      expect(mockRepository.findById).toHaveBeenCalledWith('activity-1');
    });

    it('should return null for non-existent activity', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getActivity('invalid-id');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('invalid-id');
    });

    it('should throw error for empty ID', async () => {
      await expect(service.getActivity('')).rejects.toThrow('Activity ID is required');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      await expect(service.getActivity('   ')).rejects.toThrow('Activity ID is required');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findById.mockRejectedValue(repositoryError);

      await expect(service.getActivity('activity-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getAllActivities', () => {
    it('should return all activities with default options', async () => {
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.getAllActivities();

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith({});
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 10, offset: 0 };
      mockRepository.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await service.getAllActivities(options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith(options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findAll.mockRejectedValue(repositoryError);

      await expect(service.getAllActivities()).rejects.toThrow('Database connection failed');
    });
  });

  describe('updateActivity', () => {
    it('should successfully update an activity', async () => {
      const updates: UpdateManagementActivityInput = {
        description: 'Updated feeding',
        notes: 'Updated notes'
      };

      const updatedActivity = { ...mockActivity, ...updates };
      mockRepository.update.mockResolvedValue(updatedActivity);

      const result = await service.updateActivity('activity-1', updates);

      expect(result).toEqual(updatedActivity);
      expect(mockRepository.update).toHaveBeenCalledWith('activity-1', updates, undefined);
    });

    it('should successfully update activity with alpaca IDs', async () => {
      const updates: UpdateManagementActivityInput = {
        description: 'Updated feeding'
      };
      const alpacaIds = ['alpaca-1', 'alpaca-2'];

      const updatedActivity = { ...mockActivity, ...updates, alpacaIds };
      mockRepository.update.mockResolvedValue(updatedActivity);

      const result = await service.updateActivity('activity-1', updates, alpacaIds);

      expect(result).toEqual(updatedActivity);
      expect(mockRepository.update).toHaveBeenCalledWith('activity-1', updates, alpacaIds);
    });

    it('should throw error for empty ID', async () => {
      const updates: UpdateManagementActivityInput = { description: 'Updated' };

      await expect(service.updateActivity('', updates)).rejects.toThrow('Activity ID is required');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      const updates: UpdateManagementActivityInput = { description: 'Updated' };

      await expect(service.updateActivity('   ', updates)).rejects.toThrow('Activity ID is required');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for empty performed by in updates', async () => {
      const updates: UpdateManagementActivityInput = { performedBy: '' };

      await expect(service.updateActivity('activity-1', updates))
        .rejects.toThrow('Performed by cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only performed by in updates', async () => {
      const updates: UpdateManagementActivityInput = { performedBy: '   ' };

      await expect(service.updateActivity('activity-1', updates))
        .rejects.toThrow('Performed by cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for empty description in updates', async () => {
      const updates: UpdateManagementActivityInput = { description: '' };

      await expect(service.updateActivity('activity-1', updates))
        .rejects.toThrow('Description cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only description in updates', async () => {
      const updates: UpdateManagementActivityInput = { description: '   ' };

      await expect(service.updateActivity('activity-1', updates))
        .rejects.toThrow('Description cannot be empty');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should allow undefined values in updates', async () => {
      const updates: UpdateManagementActivityInput = {
        performedBy: undefined,
        description: undefined
      };

      const updatedActivity = { ...mockActivity };
      mockRepository.update.mockResolvedValue(updatedActivity);

      const result = await service.updateActivity('activity-1', updates);

      expect(result).toEqual(updatedActivity);
      expect(mockRepository.update).toHaveBeenCalledWith('activity-1', updates, undefined);
    });

    it('should handle repository errors', async () => {
      const updates: UpdateManagementActivityInput = { description: 'Updated' };
      const repositoryError = new Error('Database connection failed');
      mockRepository.update.mockRejectedValue(repositoryError);

      await expect(service.updateActivity('activity-1', updates))
        .rejects.toThrow('Database connection failed');
    });

    it('should return null when activity not found', async () => {
      const updates: UpdateManagementActivityInput = { description: 'Updated' };
      mockRepository.update.mockResolvedValue(null);

      const result = await service.updateActivity('nonexistent-id', updates);

      expect(result).toBeNull();
      expect(mockRepository.update).toHaveBeenCalledWith('nonexistent-id', updates, undefined);
    });
  });

  describe('deleteActivity', () => {
    it('should successfully delete an activity', async () => {
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.deleteActivity('activity-1');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('activity-1');
    });

    it('should return false when activity not found', async () => {
      mockRepository.delete.mockResolvedValue(false);

      const result = await service.deleteActivity('nonexistent-id');

      expect(result).toBe(false);
      expect(mockRepository.delete).toHaveBeenCalledWith('nonexistent-id');
    });

    it('should throw error for empty ID', async () => {
      await expect(service.deleteActivity('')).rejects.toThrow('Activity ID is required');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      await expect(service.deleteActivity('   ')).rejects.toThrow('Activity ID is required');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.delete.mockRejectedValue(repositoryError);

      await expect(service.deleteActivity('activity-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getActivitiesByAlpaca', () => {
    it('should return activities for an alpaca', async () => {
      mockRepository.findByAlpaca.mockResolvedValue(mockPaginatedResult);

      const result = await service.getActivitiesByAlpaca('alpaca-1');

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByAlpaca).toHaveBeenCalledWith('alpaca-1', {});
    });

    it('should throw error for empty alpaca ID', async () => {
      await expect(service.getActivitiesByAlpaca('')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.findByAlpaca).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only alpaca ID', async () => {
      await expect(service.getActivitiesByAlpaca('   ')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.findByAlpaca).not.toHaveBeenCalled();
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 5, offset: 10 };
      mockRepository.findByAlpaca.mockResolvedValue(mockPaginatedResult);

      const result = await service.getActivitiesByAlpaca('alpaca-1', options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByAlpaca).toHaveBeenCalledWith('alpaca-1', options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByAlpaca.mockRejectedValue(repositoryError);

      await expect(service.getActivitiesByAlpaca('alpaca-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getActivitiesByType', () => {
    it('should return activities by type', async () => {
      mockRepository.findByActivityType.mockResolvedValue(mockPaginatedResult);

      const result = await service.getActivitiesByType('feeding');

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByActivityType).toHaveBeenCalledWith('feeding', {});
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 5, offset: 10 };
      mockRepository.findByActivityType.mockResolvedValue(mockPaginatedResult);

      const result = await service.getActivitiesByType('shearing', options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByActivityType).toHaveBeenCalledWith('shearing', options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByActivityType.mockRejectedValue(repositoryError);

      await expect(service.getActivitiesByType('feeding')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getActivitiesByPerformer', () => {
    it('should return activities by performer', async () => {
      mockRepository.findByPerformer.mockResolvedValue(mockPaginatedResult);

      const result = await service.getActivitiesByPerformer('John Doe');

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByPerformer).toHaveBeenCalledWith('John Doe', {});
    });

    it('should throw error for empty performer name', async () => {
      await expect(service.getActivitiesByPerformer('')).rejects.toThrow('Performer name is required');
      expect(mockRepository.findByPerformer).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only performer name', async () => {
      await expect(service.getActivitiesByPerformer('   ')).rejects.toThrow('Performer name is required');
      expect(mockRepository.findByPerformer).not.toHaveBeenCalled();
    });

    it('should pass query options to repository', async () => {
      const options: QueryOptions = { limit: 5, offset: 10 };
      mockRepository.findByPerformer.mockResolvedValue(mockPaginatedResult);

      const result = await service.getActivitiesByPerformer('Jane Smith', options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByPerformer).toHaveBeenCalledWith('Jane Smith', options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByPerformer.mockRejectedValue(repositoryError);

      await expect(service.getActivitiesByPerformer('John Doe')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getActivitiesByDateRange', () => {
    it('should return activities within date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      mockRepository.findByDateRange.mockResolvedValue(mockPaginatedResult);

      const result = await service.getActivitiesByDateRange(startDate, endDate);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByDateRange).toHaveBeenCalledWith(startDate, endDate, {});
    });

    it('should throw error when start date is after end date', async () => {
      const startDate = new Date('2023-12-31');
      const endDate = new Date('2023-01-01');

      await expect(service.getActivitiesByDateRange(startDate, endDate))
        .rejects.toThrow('Start date must be before end date');
      expect(mockRepository.findByDateRange).not.toHaveBeenCalled();
    });

    it('should pass query options to repository', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      const options: QueryOptions = { limit: 5, offset: 10 };
      mockRepository.findByDateRange.mockResolvedValue(mockPaginatedResult);

      const result = await service.getActivitiesByDateRange(startDate, endDate, options);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockRepository.findByDateRange).toHaveBeenCalledWith(startDate, endDate, options);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByDateRange.mockRejectedValue(repositoryError);

      await expect(service.getActivitiesByDateRange(new Date(), new Date())).rejects.toThrow('Database connection failed');
    });
  });

  describe('getActivityStatistics', () => {
    it('should calculate correct activity statistics', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

      const activities = [
        ManagementActivityFactory.create({
          activityType: 'feeding',
          performedBy: 'John Doe',
          date: recentDate,
          alpacaIds: ['alpaca-1']
        }),
        ManagementActivityFactory.create({
          activityType: 'shearing',
          performedBy: 'Jane Smith',
          date: oldDate,
          alpacaIds: ['alpaca-1', 'alpaca-2']
        }),
        ManagementActivityFactory.create({
          activityType: 'feeding',
          performedBy: 'John Doe',
          date: recentDate,
          alpacaIds: ['alpaca-2']
        })
      ];

      const paginatedActivities: PaginatedResult<ManagementActivity> = {
        data: activities,
        total: 3,
        page: 1,
        limit: 1000,
        totalPages: 1
      };

      mockRepository.findAll.mockResolvedValue(paginatedActivities);

      const result = await service.getActivityStatistics();

      expect(result.totalActivities).toBe(3);
      expect(result.activitiesByType).toHaveLength(2);
      expect(result.activitiesByType[0].type).toBe('feeding'); // Most common
      expect(result.activitiesByType[0].count).toBe(2);
      expect(result.activitiesByPerformer).toHaveLength(2);
      expect(result.activitiesByPerformer[0].performer).toBe('John Doe'); // Most active
      expect(result.activitiesByPerformer[0].count).toBe(2);
      expect(result.recentActivities).toBe(2); // Activities in last 30 days
      expect(result.mostActiveAlpaca).toBe('alpaca-1'); // Appears in 2 activities
      expect(mockRepository.findAll).toHaveBeenCalledWith({ limit: 1000 });
    });

    it('should handle empty activities', async () => {
      const emptyResult: PaginatedResult<ManagementActivity> = {
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      };

      mockRepository.findAll.mockResolvedValue(emptyResult);

      const result = await service.getActivityStatistics();

      expect(result.totalActivities).toBe(0);
      expect(result.activitiesByType).toEqual([]);
      expect(result.activitiesByPerformer).toEqual([]);
      expect(result.recentActivities).toBe(0);
      expect(result.mostActiveAlpaca).toBeUndefined();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findAll.mockRejectedValue(repositoryError);

      await expect(service.getActivityStatistics()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getAlpacaActivitySummary', () => {
    it('should return activity summary for an alpaca', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

      const activities = [
        ManagementActivityFactory.create({
          activityType: 'feeding',
          date: recentDate
        }),
        ManagementActivityFactory.create({
          activityType: 'shearing',
          date: oldDate
        }),
        ManagementActivityFactory.create({
          activityType: 'feeding',
          date: recentDate
        })
      ];

      const paginatedActivities: PaginatedResult<ManagementActivity> = {
        data: activities,
        total: 3,
        page: 1,
        limit: 1000,
        totalPages: 1
      };

      mockRepository.findByAlpaca.mockResolvedValue(paginatedActivities);

      const result = await service.getAlpacaActivitySummary('alpaca-1');

      expect(result.alpacaId).toBe('alpaca-1');
      expect(result.totalActivities).toBe(3);
      expect(result.lastActivity).toEqual(recentDate); // Most recent activity
      expect(result.activitiesByType).toHaveLength(2);
      expect(result.activitiesByType[0].type).toBe('feeding'); // Most common
      expect(result.activitiesByType[0].count).toBe(2);
      expect(result.recentActivities).toBe(2); // Activities in last 30 days
      expect(mockRepository.findByAlpaca).toHaveBeenCalledWith('alpaca-1', { limit: 1000 });
    });

    it('should throw error for empty alpaca ID', async () => {
      await expect(service.getAlpacaActivitySummary('')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.findByAlpaca).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only alpaca ID', async () => {
      await expect(service.getAlpacaActivitySummary('   ')).rejects.toThrow('Alpaca ID is required');
      expect(mockRepository.findByAlpaca).not.toHaveBeenCalled();
    });

    it('should handle alpaca with no activities', async () => {
      const emptyResult: PaginatedResult<ManagementActivity> = {
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      };

      mockRepository.findByAlpaca.mockResolvedValue(emptyResult);

      const result = await service.getAlpacaActivitySummary('alpaca-1');

      expect(result.alpacaId).toBe('alpaca-1');
      expect(result.totalActivities).toBe(0);
      expect(result.lastActivity).toBeUndefined();
      expect(result.activitiesByType).toEqual([]);
      expect(result.recentActivities).toBe(0);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockRepository.findByAlpaca.mockRejectedValue(repositoryError);

      await expect(service.getAlpacaActivitySummary('alpaca-1')).rejects.toThrow('Database connection failed');
    });
  });


});