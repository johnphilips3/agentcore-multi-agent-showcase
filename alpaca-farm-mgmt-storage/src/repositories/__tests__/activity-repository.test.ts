/**
 * Unit tests for PostgreSQLActivityRepository
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PostgreSQLActivityRepository, QueryOptions, PaginatedResult } from '../pg-activity-repository';
import { ManagementActivity, CreateManagementActivityInput, UpdateManagementActivityInput } from '../../models/management-activity';
import { ActivityType } from '../../models/common';
import { PostgreSQLConnection } from '../../database/pg-connection';
import { ManagementActivityFactory } from '../../__tests__/data-factories';
import { MockUtils, TestEnvironment } from '../../__tests__/test-utils';

// Mock PostgreSQL connection and client
const mockClient = {
  query: vi.fn(),
  release: vi.fn()
};

const mockConnection: PostgreSQLConnection = {
  query: vi.fn(),
  getClient: vi.fn().mockResolvedValue(mockClient),
  close: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true)
};

describe('PostgreSQLActivityRepository', () => {
  let repository: PostgreSQLActivityRepository;
  let mockQuery: any;
  let mockGetClient: any;
  let mockClientQuery: any;

  const mockActivityRow = {
    id: 'test-activity-1',
    activity_type: 'feeding',
    date: '2024-01-01T00:00:00.000Z',
    performed_by: 'John Doe',
    description: 'Morning feeding',
    notes: 'All alpacas ate well',
    created_at: '2024-01-01T00:00:00.000Z',
    alpaca_ids: ['alpaca-1', 'alpaca-2']
  };

  const mockActivity: ManagementActivity = ManagementActivityFactory.create({
    id: 'test-activity-1',
    activityType: 'feeding',
    date: new Date('2024-01-01T00:00:00.000Z'),
    alpacaIds: ['alpaca-1', 'alpaca-2'],
    performedBy: 'John Doe',
    description: 'Morning feeding',
    notes: 'All alpacas ate well',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z')
  });

  beforeEach(() => {
    TestEnvironment.setupTestEnv();
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Ensure getClient returns the mockClient
    mockConnection.getClient = vi.fn().mockResolvedValue(mockClient);
    
    repository = new PostgreSQLActivityRepository(mockConnection);
    mockQuery = vi.mocked(mockConnection.query);
    mockGetClient = vi.mocked(mockConnection.getClient);
    mockClientQuery = vi.mocked(mockClient.query);
    
    MockUtils.clearAllMocks();
  });

  afterEach(() => {
    TestEnvironment.cleanupTestEnv();
    MockUtils.restoreAllMocks();
  });

  describe('create', () => {
    it('should create management activity with alpaca associations', async () => {
      const createInput: CreateManagementActivityInput = ManagementActivityFactory.createInput();
      const alpacaIds = ['alpaca-1', 'alpaca-2'];

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockActivityRow] }) // INSERT activity
        .mockResolvedValueOnce({}) // INSERT alpaca association 1
        .mockResolvedValueOnce({}) // INSERT alpaca association 2
        .mockResolvedValueOnce({}); // COMMIT

      const result = await repository.create(createInput, alpacaIds);

      expect(result).toEqual(mockActivity);
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO management_activities'),
        expect.arrayContaining([
          createInput.activityType,
          createInput.date,
          createInput.performedBy,
          createInput.description,
          createInput.notes
        ])
      );
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should create activity without alpaca associations', async () => {
      const createInput: CreateManagementActivityInput = ManagementActivityFactory.createInput();
      const alpacaIds: string[] = [];

      const activityWithoutAlpacas = { ...mockActivityRow, alpaca_ids: [] };
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [activityWithoutAlpacas] }) // INSERT activity
        .mockResolvedValueOnce({}); // COMMIT

      const result = await repository.create(createInput, alpacaIds);

      expect(result.alpacaIds).toEqual([]);
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction on error', async () => {
      const createInput = ManagementActivityFactory.createInput();
      const alpacaIds = ['alpaca-1'];
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(repository.create(createInput, alpacaIds)).rejects.toThrow('Database error');

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find management activity by id with alpaca associations', async () => {
      mockQuery.mockResolvedValue({ rows: [mockActivityRow] });

      const result = await repository.findById('test-activity-1');

      expect(result).toEqual(mockActivity);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT ma.*'),
        ['test-activity-1']
      );
    });

    it('should return null when activity not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findById('test-activity-1')).rejects.toThrow('Database connection failed');
    });

    it('should map row to activity entity correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [mockActivityRow] });

      const result = await repository.findById('test-activity-1');

      expect(result?.id).toBe('test-activity-1');
      expect(result?.activityType).toBe('feeding');
      expect(result?.date).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(result?.performedBy).toBe('John Doe');
      expect(result?.description).toBe('Morning feeding');
      expect(result?.notes).toBe('All alpacas ate well');
      expect(result?.alpacaIds).toEqual(['alpaca-1', 'alpaca-2']);
    });

    it('should handle missing optional fields', async () => {
      const rowWithoutOptionals = {
        ...mockActivityRow,
        notes: null,
        alpaca_ids: null
      };

      mockQuery.mockResolvedValue({ rows: [rowWithoutOptionals] });

      const result = await repository.findById('test-activity-1');

      expect(result?.notes).toBeNull();
      expect(result?.alpacaIds).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should find all activities with default pagination', async () => {
      const activityRows = [mockActivityRow, { ...mockActivityRow, id: 'activity-2' }];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
        .mockResolvedValueOnce({ rows: activityRows }); // data query

      const result = await repository.findAll();

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle custom pagination options', async () => {
      const options: QueryOptions = { limit: 5, offset: 10 };
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '25' }] })
        .mockResolvedValueOnce({ rows: [mockActivityRow] });

      const result = await repository.findAll(options);

      expect(result.page).toBe(3); // offset 10 / limit 5 + 1
      expect(result.limit).toBe(5);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [5, 10]
      );
    });

    it('should handle sorting options', async () => {
      const options: QueryOptions = { sortBy: 'date', sortOrder: 'asc' };
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockActivityRow] });

      await repository.findAll(options);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY ma.date ASC'),
        [20, 0]
      );
    });

    it('should use default sorting for invalid sort fields', async () => {
      const options: QueryOptions = { sortBy: 'invalid_field' };
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockActivityRow] });

      await repository.findAll(options);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY ma.date DESC, ma.created_at DESC'),
        [20, 0]
      );
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findAll()).rejects.toThrow('Database connection failed');
    });
  });

  describe('update', () => {
    it('should update activity with alpaca associations', async () => {
      const updateInput: UpdateManagementActivityInput = {
        description: 'Updated feeding activity',
        notes: 'Updated notes'
      };
      const alpacaIds = ['new-alpaca-1', 'new-alpaca-2'];
      
      const updatedRow = { ...mockActivityRow, description: 'Updated feeding activity', notes: 'Updated notes' };
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [updatedRow] }) // UPDATE activity
        .mockResolvedValueOnce({}) // DELETE old alpaca associations
        .mockResolvedValueOnce({}) // INSERT new alpaca association 1
        .mockResolvedValueOnce({}) // INSERT new alpaca association 2
        .mockResolvedValueOnce({}); // COMMIT

      // Mock the alpaca query for final result
      mockQuery.mockResolvedValueOnce({ 
        rows: [
          { alpaca_id: 'new-alpaca-1' },
          { alpaca_id: 'new-alpaca-2' }
        ]
      });

      const result = await repository.update('test-activity-1', updateInput, alpacaIds);

      expect(result?.description).toBe('Updated feeding activity');
      expect(result?.notes).toBe('Updated notes');
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE management_activities SET'),
        expect.arrayContaining(['Updated feeding activity', 'Updated notes', 'test-activity-1'])
      );
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return existing record when no fields to update', async () => {
      const updateInput: UpdateManagementActivityInput = {};
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockActivityRow] }) // SELECT existing record
        .mockResolvedValueOnce({}); // COMMIT

      mockQuery.mockResolvedValueOnce({ 
        rows: [
          { alpaca_id: 'alpaca-1' },
          { alpaca_id: 'alpaca-2' }
        ]
      });

      const result = await repository.update('test-activity-1', updateInput);

      expect(result).toEqual(mockActivity);
    });

    it('should return null when activity not found', async () => {
      const updateInput: UpdateManagementActivityInput = { description: 'Updated description' };
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE returns no rows
        .mockResolvedValueOnce({}); // ROLLBACK

      const result = await repository.update('nonexistent-id', updateInput);

      expect(result).toBeNull();
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should rollback transaction on error', async () => {
      const updateInput: UpdateManagementActivityInput = { description: 'Updated description' };
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // UPDATE fails

      await expect(repository.update('test-activity-1', updateInput)).rejects.toThrow('Database error');

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete activity successfully', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('test-activity-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM management_activities WHERE id = $1',
        ['test-activity-1']
      );
    });

    it('should return false when activity not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.delete('test-activity-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByAlpaca', () => {
    it('should find activities by alpaca id', async () => {
      const activityRows = [
        { ...mockActivityRow, id: 'activity-1', description: 'Feeding 1' },
        { ...mockActivityRow, id: 'activity-2', description: 'Feeding 2' }
      ];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: activityRows });

      const result = await repository.findByAlpaca('test-alpaca-1');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0].description).toBe('Feeding 1');
      expect(result.data[1].description).toBe('Feeding 2');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM management_activities ma'),
        ['test-alpaca-1']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INNER JOIN activity_alpacas aa ON ma.id = aa.activity_id'),
        ['test-alpaca-1', 20, 0]
      );
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByAlpaca('test-alpaca-1');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findByAlpaca('test-alpaca-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByActivityType', () => {
    it('should find activities by activity type', async () => {
      const feedingActivities = [
        { ...mockActivityRow, id: 'activity-1', description: 'Morning feeding' },
        { ...mockActivityRow, id: 'activity-2', description: 'Evening feeding' }
      ];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: feedingActivities });

      const result = await repository.findByActivityType('feeding');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0].activityType).toBe('feeding');
      expect(result.data[1].activityType).toBe('feeding');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM management_activities WHERE activity_type = $1',
        ['feeding']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ma.activity_type = $1'),
        ['feeding', 20, 0]
      );
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByActivityType('shearing');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findByActivityType('feeding')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByPerformer', () => {
    it('should find activities by performer', async () => {
      const performerActivities = [
        { ...mockActivityRow, id: 'activity-1', description: 'Task 1' },
        { ...mockActivityRow, id: 'activity-2', description: 'Task 2' }
      ];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: performerActivities });

      const result = await repository.findByPerformer('John Doe');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0].performedBy).toBe('John Doe');
      expect(result.data[1].performedBy).toBe('John Doe');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM management_activities WHERE performed_by ILIKE $1',
        ['%John Doe%']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ma.performed_by ILIKE $1'),
        ['%John Doe%', 20, 0]
      );
    });

    it('should handle partial name matching', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockActivityRow] });

      await repository.findByPerformer('John');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM management_activities WHERE performed_by ILIKE $1',
        ['%John%']
      );
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByPerformer('Jane Smith');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findByPerformer('John Doe')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByDateRange', () => {
    it('should find activities within date range', async () => {
      const activityRows = [
        { ...mockActivityRow, id: 'activity-1', date: '2024-01-15T00:00:00.000Z' },
        { ...mockActivityRow, id: 'activity-2', date: '2024-02-15T00:00:00.000Z' }
      ];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: activityRows });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-28');
      const result = await repository.findByDateRange(startDate, endDate);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM management_activities WHERE date BETWEEN $1 AND $2',
        [startDate, endDate]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ma.date BETWEEN $1 AND $2'),
        [startDate, endDate, 20, 0]
      );
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await repository.findByDateRange(startDate, endDate);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      await expect(repository.findByDateRange(startDate, endDate)).rejects.toThrow('Database connection failed');
    });
  });

  describe('mapRowToActivity', () => {
    it('should map database row to activity entity correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [mockActivityRow] });

      const result = await repository.findById('test-activity-1');

      expect(result).toEqual(mockActivity);
    });

    it('should handle null values correctly', async () => {
      const rowWithNulls = {
        ...mockActivityRow,
        notes: null,
        alpaca_ids: null
      };

      mockQuery.mockResolvedValue({ rows: [rowWithNulls] });

      const result = await repository.findById('test-activity-1');

      expect(result?.notes).toBeNull();
      expect(result?.alpacaIds).toEqual([]);
    });

    it('should parse dates correctly', async () => {
      const rowWithDates = {
        ...mockActivityRow,
        date: '2024-01-15T10:30:00.000Z',
        created_at: '2024-01-01T08:00:00.000Z'
      };

      mockQuery.mockResolvedValue({ rows: [rowWithDates] });

      const result = await repository.findById('test-activity-1');

      expect(result?.date).toEqual(new Date('2024-01-15T10:30:00.000Z'));
      expect(result?.createdAt).toEqual(new Date('2024-01-01T08:00:00.000Z'));
    });

    it('should filter null alpaca ids', async () => {
      const rowWithNullAlpacas = {
        ...mockActivityRow,
        alpaca_ids: ['alpaca-1', null, 'alpaca-2', null]
      };

      mockQuery.mockResolvedValue({ rows: [rowWithNullAlpacas] });

      const result = await repository.findById('test-activity-1');

      expect(result?.alpacaIds).toEqual(['alpaca-1', 'alpaca-2']);
    });
  });

  describe('SQL parameter binding', () => {
    it('should properly bind parameters in create query', async () => {
      const createInput = ManagementActivityFactory.createInput({
        activityType: 'feeding',
        date: new Date('2024-01-01'),
        performedBy: 'John Doe',
        description: 'Test feeding',
        notes: 'Test notes'
      });
      const alpacaIds = ['alpaca-1'];

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockActivityRow] }) // INSERT
        .mockResolvedValueOnce({}) // INSERT alpaca
        .mockResolvedValueOnce({}); // COMMIT

      await repository.create(createInput, alpacaIds);

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO management_activities'),
        [
          'feeding',
          createInput.date,
          'John Doe',
          'Test feeding',
          'Test notes'
        ]
      );
    });

    it('should handle null parameters in create query', async () => {
      const minimalInput: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: new Date('2024-01-01'),
        performedBy: 'John Doe',
        description: 'Minimal feeding'
      };
      const alpacaIds: string[] = [];

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockActivityRow] }) // INSERT
        .mockResolvedValueOnce({}); // COMMIT

      await repository.create(minimalInput, alpacaIds);

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO management_activities'),
        [
          'feeding',
          minimalInput.date,
          'John Doe',
          'Minimal feeding',
          null // notes
        ]
      );
    });
  });

  describe('transaction management', () => {
    it('should handle successful transactions', async () => {
      const createInput = ManagementActivityFactory.createInput();
      const alpacaIds = ['alpaca-1'];
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockActivityRow] }) // INSERT
        .mockResolvedValueOnce({}) // INSERT alpaca
        .mockResolvedValueOnce({}); // COMMIT

      await repository.create(createInput, alpacaIds);

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on transaction failure', async () => {
      const createInput = ManagementActivityFactory.createInput();
      const alpacaIds = ['alpaca-1'];
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Transaction failed')); // INSERT fails

      await expect(repository.create(createInput, alpacaIds)).rejects.toThrow('Transaction failed');

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle client acquisition errors', async () => {
      const createInput = ManagementActivityFactory.createInput();
      const alpacaIds = ['alpaca-1'];
      mockGetClient.mockRejectedValue(new Error('Client acquisition failed'));

      await expect(repository.create(createInput, alpacaIds)).rejects.toThrow('Client acquisition failed');
    });
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      const connectionError = new Error('Connection timeout');
      mockQuery.mockRejectedValue(connectionError);

      await expect(repository.findById('test-id')).rejects.toThrow('Connection timeout');
      await expect(repository.findAll()).rejects.toThrow('Connection timeout');
      await expect(repository.delete('test-id')).rejects.toThrow('Connection timeout');
    });

    it('should handle SQL constraint violations', async () => {
      const constraintError = new Error('foreign key constraint violation');
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(constraintError); // INSERT fails

      await expect(repository.create(ManagementActivityFactory.createInput(), ['alpaca-1'])).rejects.toThrow('foreign key constraint violation');
    });

    it('should handle invalid SQL syntax errors', async () => {
      const syntaxError = new Error('syntax error at or near');
      mockQuery.mockRejectedValue(syntaxError);

      await expect(repository.findAll()).rejects.toThrow('syntax error at or near');
    });

    it('should handle invalid activity type errors', async () => {
      const invalidTypeError = new Error('invalid input value for enum activity_type');
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(invalidTypeError); // INSERT fails

      await expect(repository.create(ManagementActivityFactory.createInput(), [])).rejects.toThrow('invalid input value for enum activity_type');
    });

    it('should handle transaction deadlock errors', async () => {
      const deadlockError = new Error('deadlock detected');
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(deadlockError); // Transaction fails

      await expect(repository.create(ManagementActivityFactory.createInput(), ['alpaca-1'])).rejects.toThrow('deadlock detected');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});