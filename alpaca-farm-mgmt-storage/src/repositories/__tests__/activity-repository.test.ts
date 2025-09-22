import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActivityRepositoryImpl } from '../activity-repository';
import { ManagementActivity, ActivityType } from '../../models';
import { DatabaseConnection } from '../../database/connection';

// Mock database connection
const mockConnection: DatabaseConnection = {
  query: vi.fn(),
  execute: vi.fn(),
  close: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true)
};

// Mock connection manager
vi.mock('../../database/connection', async () => {
  const actual = await vi.importActual('../../database/connection');
  return {
    ...actual,
    getConnectionManager: vi.fn(() => ({
      getConnection: vi.fn().mockResolvedValue(mockConnection)
    }))
  };
});

describe('ActivityRepositoryImpl', () => {
  let repository: ActivityRepositoryImpl;
  let mockQuery: any;
  let mockExecute: any;

  const mockActivityRow = {
    id: 'activity-1',
    activity_type: 'feeding',
    date: '2023-01-01T00:00:00.000Z',
    alpaca_ids: '["alpaca-1", "alpaca-2"]',
    performed_by: 'John Doe',
    description: 'Morning feeding',
    notes: 'All alpacas ate well',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z'
  };

  const mockActivity: ManagementActivity = {
    id: 'activity-1',
    activityType: 'feeding' as ActivityType,
    date: new Date('2023-01-01T00:00:00.000Z'),
    alpacaIds: ['alpaca-1', 'alpaca-2'],
    performedBy: 'John Doe',
    description: 'Morning feeding',
    notes: 'All alpacas ate well',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z')
  };

  beforeEach(() => {
    repository = new ActivityRepositoryImpl();
    mockQuery = vi.mocked(mockConnection.query);
    mockExecute = vi.mocked(mockConnection.execute);
    
    mockQuery.mockReset();
    mockExecute.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mapRowToEntity', () => {
    it('should map database row to activity entity correctly', async () => {
      mockQuery.mockResolvedValue([mockActivityRow]);

      const result = await repository.findById('activity-1');

      expect(result).toEqual(mockActivity);
    });

    it('should handle missing optional fields', async () => {
      const rowWithoutOptionals = {
        ...mockActivityRow,
        alpaca_ids: null,
        notes: null
      };

      mockQuery.mockResolvedValue([rowWithoutOptionals]);

      const result = await repository.findById('activity-1');

      expect(result?.alpacaIds).toEqual([]);
      expect(result?.notes).toBeNull();
    });

    it('should handle invalid JSON in alpaca_ids', async () => {
      const rowWithInvalidJson = {
        ...mockActivityRow,
        alpaca_ids: 'invalid-json'
      };

      mockQuery.mockResolvedValue([rowWithInvalidJson]);

      const result = await repository.findById('activity-1');

      expect(result?.alpacaIds).toEqual([]);
    });
  });

  describe('findByAlpaca', () => {
    it('should find activities by alpaca id using junction table', async () => {
      const activity1 = { ...mockActivityRow, id: 'activity-1', description: 'Feeding 1' };
      const activity2 = { ...mockActivityRow, id: 'activity-2', description: 'Feeding 2' };
      
      mockQuery.mockResolvedValue([activity1, activity2]);

      const result = await repository.findByAlpaca('alpaca-1');

      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('Feeding 1');
      expect(result[1].description).toBe('Feeding 2');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('JOIN activity_alpacas aa ON ma.id = aa.activity_id'),
        ['alpaca-1']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE aa.alpaca_id = $1'),
        ['alpaca-1']
      );
    });

    it('should return empty array when no activities found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findByAlpaca('alpaca-1');

      expect(result).toEqual([]);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByAlpaca('alpaca-1'))
        .rejects.toThrow('Failed to find activities by alpaca');
    });
  });

  describe('findByDateRange', () => {
    it('should find activities within date range', async () => {
      const activity1 = { ...mockActivityRow, id: 'activity-1', date: '2023-01-15T00:00:00.000Z' };
      const activity2 = { ...mockActivityRow, id: 'activity-2', date: '2023-02-15T00:00:00.000Z' };
      
      mockQuery.mockResolvedValue([activity1, activity2]);

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-02-28');
      const result = await repository.findByDateRange(startDate, endDate);

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM management_activities WHERE date BETWEEN $1 AND $2 ORDER BY date DESC',
        [startDate.toISOString(), endDate.toISOString()]
      );
    });

    it('should return empty array when no activities in range', async () => {
      mockQuery.mockResolvedValue([]);

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');
      const result = await repository.findByDateRange(startDate, endDate);

      expect(result).toEqual([]);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');
      await expect(repository.findByDateRange(startDate, endDate))
        .rejects.toThrow('Failed to find activities by date range');
    });
  });

  describe('findByActivityType', () => {
    it('should find activities by activity type', async () => {
      const feeding1 = { ...mockActivityRow, id: 'activity-1', description: 'Morning feeding' };
      const feeding2 = { ...mockActivityRow, id: 'activity-2', description: 'Evening feeding' };
      
      mockQuery.mockResolvedValue([feeding1, feeding2]);

      const result = await repository.findByActivityType('feeding');

      expect(result).toHaveLength(2);
      expect(result[0].activityType).toBe('feeding');
      expect(result[1].activityType).toBe('feeding');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM management_activities WHERE activity_type = $1 ORDER BY date DESC',
        ['feeding']
      );
    });

    it('should return empty array when no activities of type found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findByActivityType('shearing');

      expect(result).toEqual([]);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByActivityType('feeding'))
        .rejects.toThrow('Failed to find activities by type');
    });
  });

  describe('findByPerformer', () => {
    it('should find activities by performer', async () => {
      const activity1 = { ...mockActivityRow, id: 'activity-1', description: 'Task 1' };
      const activity2 = { ...mockActivityRow, id: 'activity-2', description: 'Task 2' };
      
      mockQuery.mockResolvedValue([activity1, activity2]);

      const result = await repository.findByPerformer('John Doe');

      expect(result).toHaveLength(2);
      expect(result[0].performedBy).toBe('John Doe');
      expect(result[1].performedBy).toBe('John Doe');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM management_activities WHERE performed_by = $1 ORDER BY date DESC',
        ['John Doe']
      );
    });

    it('should return empty array when no activities by performer found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findByPerformer('Jane Smith');

      expect(result).toEqual([]);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByPerformer('John Doe'))
        .rejects.toThrow('Failed to find activities by performer');
    });
  });

  describe('create with alpaca relationships', () => {
    it('should create activity and handle alpaca relationships', async () => {
      const createData = {
        activityType: 'weighing' as ActivityType,
        date: new Date('2023-01-01'),
        alpacaIds: ['alpaca-1', 'alpaca-2'],
        performedBy: 'Jane Smith',
        description: 'Monthly weighing'
      };

      // Mock the create call from parent class
      mockQuery.mockResolvedValue([{
        id: 'new-activity-id',
        activity_type: 'weighing',
        date: '2023-01-01T00:00:00.000Z',
        alpaca_ids: '["alpaca-1", "alpaca-2"]',
        performed_by: 'Jane Smith',
        description: 'Monthly weighing',
        notes: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }]);

      mockExecute.mockResolvedValue({ changes: 1 });

      const result = await repository.create(createData);

      expect(result.activityType).toBe('weighing');
      expect(result.alpacaIds).toEqual(['alpaca-1', 'alpaca-2']);
      expect(result.performedBy).toBe('Jane Smith');

      // Verify alpaca relationships were created
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO activity_alpacas (activity_id, alpaca_id) VALUES ($1, $2)',
        ['new-activity-id', 'alpaca-1']
      );
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO activity_alpacas (activity_id, alpaca_id) VALUES ($1, $2)',
        ['new-activity-id', 'alpaca-2']
      );
    });

    it('should create activity without alpaca relationships', async () => {
      const createData = {
        activityType: 'other' as ActivityType,
        date: new Date('2023-01-01'),
        alpacaIds: [],
        performedBy: 'Jane Smith',
        description: 'General maintenance'
      };

      mockQuery.mockResolvedValue([{
        id: 'new-activity-id',
        activity_type: 'other',
        date: '2023-01-01T00:00:00.000Z',
        alpaca_ids: '[]',
        performed_by: 'Jane Smith',
        description: 'General maintenance',
        notes: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }]);

      const result = await repository.create(createData);

      expect(result.alpacaIds).toEqual([]);
      // Should not call execute for alpaca relationships
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('update with alpaca relationships', () => {
    it('should update activity and handle alpaca relationships', async () => {
      const existingRecord = {
        id: 'activity-1',
        activity_type: 'feeding',
        date: '2023-01-01T00:00:00.000Z',
        alpaca_ids: '["old-alpaca"]',
        performed_by: 'John Doe',
        description: 'Feeding',
        notes: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const updatedRecord = {
        ...existingRecord,
        alpaca_ids: '["new-alpaca-1", "new-alpaca-2"]',
        updated_at: '2023-01-01T01:00:00.000Z'
      };

      // Mock findById call
      mockQuery.mockResolvedValueOnce([existingRecord]);
      // Mock update call
      mockQuery.mockResolvedValueOnce([updatedRecord]);

      mockExecute.mockResolvedValue({ changes: 1 });

      const result = await repository.update('activity-1', {
        alpacaIds: ['new-alpaca-1', 'new-alpaca-2']
      });

      expect(result.alpacaIds).toEqual(['new-alpaca-1', 'new-alpaca-2']);

      // Verify old relationships were deleted
      expect(mockExecute).toHaveBeenCalledWith(
        'DELETE FROM activity_alpacas WHERE activity_id = $1',
        ['activity-1']
      );

      // Verify new relationships were created
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO activity_alpacas (activity_id, alpaca_id) VALUES ($1, $2)',
        ['activity-1', 'new-alpaca-1']
      );
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO activity_alpacas (activity_id, alpaca_id) VALUES ($1, $2)',
        ['activity-1', 'new-alpaca-2']
      );
    });
  });

  describe('createBulkActivity', () => {
    it('should create bulk activity for multiple alpacas', async () => {
      const activityData = {
        activityType: 'shearing' as ActivityType,
        date: new Date('2023-06-01'),
        performedBy: 'Shearing Team',
        description: 'Annual shearing'
      };

      const alpacaIds = ['alpaca-1', 'alpaca-2', 'alpaca-3'];

      mockQuery.mockResolvedValue([{
        id: 'bulk-activity-id',
        activity_type: 'shearing',
        date: '2023-06-01T00:00:00.000Z',
        alpaca_ids: '["alpaca-1", "alpaca-2", "alpaca-3"]',
        performed_by: 'Shearing Team',
        description: 'Annual shearing',
        notes: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }]);

      mockExecute.mockResolvedValue({ changes: 1 });

      const result = await repository.createBulkActivity(activityData, alpacaIds);

      expect(result.activityType).toBe('shearing');
      expect(result.alpacaIds).toEqual(alpacaIds);
      expect(result.description).toBe('Annual shearing');

      // Verify all alpaca relationships were created (1 delete + 3 inserts)
      expect(mockExecute).toHaveBeenCalledTimes(4);
      
      // Verify delete was called first
      expect(mockExecute).toHaveBeenNthCalledWith(1,
        'DELETE FROM activity_alpacas WHERE activity_id = $1',
        ['bulk-activity-id']
      );
      
      // Verify inserts for each alpaca
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO activity_alpacas (activity_id, alpaca_id) VALUES ($1, $2)',
        ['bulk-activity-id', 'alpaca-1']
      );
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO activity_alpacas (activity_id, alpaca_id) VALUES ($1, $2)',
        ['bulk-activity-id', 'alpaca-2']
      );
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO activity_alpacas (activity_id, alpaca_id) VALUES ($1, $2)',
        ['bulk-activity-id', 'alpaca-3']
      );
    });

    it('should throw error for empty alpaca list', async () => {
      const activityData = {
        activityType: 'shearing' as ActivityType,
        date: new Date('2023-06-01'),
        performedBy: 'Shearing Team',
        description: 'Annual shearing'
      };

      await expect(repository.createBulkActivity(activityData, []))
        .rejects.toThrow('At least one alpaca ID is required for bulk activity');
    });
  });

  describe('getActivityStats', () => {
    it('should return activity statistics', async () => {
      // Mock total count
      mockQuery.mockResolvedValueOnce([{ count: 10 }]);
      
      // Mock activities by type
      mockQuery.mockResolvedValueOnce([
        { activity_type: 'feeding', count: 5 },
        { activity_type: 'weighing', count: 3 },
        { activity_type: 'shearing', count: 2 }
      ]);
      
      // Mock activities by performer
      mockQuery.mockResolvedValueOnce([
        { performed_by: 'John Doe', count: 6 },
        { performed_by: 'Jane Smith', count: 4 }
      ]);

      const result = await repository.getActivityStats();

      expect(result.totalActivities).toBe(10);
      expect(result.activitiesByType.feeding).toBe(5);
      expect(result.activitiesByType.weighing).toBe(3);
      expect(result.activitiesByType.shearing).toBe(2);
      expect(result.activitiesByType.moving).toBe(0); // Default value
      expect(result.activitiesByPerformer['John Doe']).toBe(6);
      expect(result.activitiesByPerformer['Jane Smith']).toBe(4);
    });

    it('should return activity statistics with date range', async () => {
      mockQuery.mockResolvedValueOnce([{ count: 5 }]);
      mockQuery.mockResolvedValueOnce([{ activity_type: 'feeding', count: 5 }]);
      mockQuery.mockResolvedValueOnce([{ performed_by: 'John Doe', count: 5 }]);

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');
      const result = await repository.getActivityStats(startDate, endDate);

      expect(result.totalActivities).toBe(5);
      
      // Verify date range was used in queries
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE date BETWEEN $1 AND $2'),
        [startDate.toISOString(), endDate.toISOString()]
      );
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.getActivityStats())
        .rejects.toThrow('Failed to get activity statistics');
    });
  });

  describe('mapEntityToRow', () => {
    it('should map entity to database row correctly', async () => {
      const createData = {
        activityType: 'training' as ActivityType,
        date: new Date('2023-03-01'),
        alpacaIds: ['alpaca-1'],
        performedBy: 'Trainer',
        description: 'Halter training',
        notes: 'Good progress'
      };

      const mockResult = [{
        id: 'new-activity-id',
        activity_type: 'training',
        date: '2023-03-01T00:00:00.000Z',
        alpaca_ids: '["alpaca-1"]',
        performed_by: 'Trainer',
        description: 'Halter training',
        notes: 'Good progress',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }];

      mockQuery.mockResolvedValue(mockResult);
      mockExecute.mockResolvedValue({ changes: 1 });

      const result = await repository.create(createData);

      expect(result.activityType).toBe('training');
      expect(result.alpacaIds).toEqual(['alpaca-1']);
      expect(result.performedBy).toBe('Trainer');
      expect(result.notes).toBe('Good progress');
      
      // Verify the SQL call includes the mapped fields
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO management_activities'),
        expect.arrayContaining(['training', 'Trainer', 'Halter training'])
      );
    });
  });
});