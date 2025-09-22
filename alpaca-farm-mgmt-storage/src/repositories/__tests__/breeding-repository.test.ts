/**
 * Unit tests for PostgreSQLBreedingRepository
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PostgreSQLBreedingRepository, QueryOptions, PaginatedResult } from '../pg-breeding-repository';
import { BreedingRecord, CreateBreedingRecordInput, UpdateBreedingRecordInput } from '../../models/breeding-record';
import { PostgreSQLConnection } from '../../database/pg-connection';
import { BreedingRecordFactory } from '../../__tests__/data-factories';
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

describe('PostgreSQLBreedingRepository', () => {
  let repository: PostgreSQLBreedingRepository;
  let mockQuery: any;
  let mockGetClient: any;
  let mockClientQuery: any;

  const mockBreedingRecordRow = {
    id: 'test-breeding-1',
    sire_id: 'test-sire-1',
    dam_id: 'test-dam-1',
    breeding_date: '2024-01-01T00:00:00.000Z',
    expected_due_date: '2024-12-01T00:00:00.000Z',
    actual_birth_date: null,
    notes: 'Test breeding record',
    created_at: '2024-01-01T00:00:00.000Z',
    offspring_ids: ['offspring-1', 'offspring-2']
  };

  const mockBreedingRecord: BreedingRecord = BreedingRecordFactory.create({
    id: 'test-breeding-1',
    sireId: 'test-sire-1',
    damId: 'test-dam-1',
    breedingDate: new Date('2024-01-01T00:00:00.000Z'),
    expectedDueDate: new Date('2024-12-01T00:00:00.000Z'),
    actualBirthDate: undefined,
    offspringIds: ['offspring-1', 'offspring-2'],
    notes: 'Test breeding record',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z')
  });

  beforeEach(() => {
    TestEnvironment.setupTestEnv();
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Ensure getClient returns the mockClient
    mockConnection.getClient = vi.fn().mockResolvedValue(mockClient);
    
    repository = new PostgreSQLBreedingRepository(mockConnection);
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
    it('should create breeding record with offspring relationships', async () => {
      const createInput: CreateBreedingRecordInput = BreedingRecordFactory.createInput({
        offspringIds: ['offspring-1', 'offspring-2']
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBreedingRecordRow] }) // INSERT breeding record
        .mockResolvedValueOnce({}) // INSERT offspring relationship 1
        .mockResolvedValueOnce({}) // INSERT offspring relationship 2
        .mockResolvedValueOnce({}); // COMMIT

      const result = await repository.create(createInput);

      expect(result).toEqual(mockBreedingRecord);
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      // Check that the INSERT query was called with correct parameters
      const insertCalls = mockClientQuery.mock.calls.filter(call => 
        call[0] && call[0].includes('INSERT INTO breeding_records')
      );
      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0][1]).toEqual([
        createInput.sireId,
        createInput.damId,
        createInput.breedingDate,
        createInput.expectedDueDate,
        null, // actualBirthDate is converted from undefined to null
        createInput.notes
      ]);
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should create breeding record without offspring', async () => {
      const createInput: CreateBreedingRecordInput = BreedingRecordFactory.createInput({
        offspringIds: []
      });

      const recordWithoutOffspring = { ...mockBreedingRecordRow, offspring_ids: [] };
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [recordWithoutOffspring] }) // INSERT breeding record
        .mockResolvedValueOnce({}); // COMMIT

      const result = await repository.create(createInput);

      expect(result.offspringIds).toEqual([]);
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction on error', async () => {
      const createInput = BreedingRecordFactory.createInput();
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(repository.create(createInput)).rejects.toThrow('Database error');

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find breeding record by id with offspring', async () => {
      mockQuery.mockResolvedValue({ rows: [mockBreedingRecordRow] });

      const result = await repository.findById('test-breeding-1');

      expect(result).toEqual(mockBreedingRecord);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT br.*'),
        ['test-breeding-1']
      );
    });

    it('should return null when breeding record not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findById('test-breeding-1')).rejects.toThrow('Database connection failed');
    });

    it('should map row to breeding record entity correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [mockBreedingRecordRow] });

      const result = await repository.findById('test-breeding-1');

      expect(result?.id).toBe('test-breeding-1');
      expect(result?.sireId).toBe('test-sire-1');
      expect(result?.damId).toBe('test-dam-1');
      expect(result?.breedingDate).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(result?.expectedDueDate).toEqual(new Date('2024-12-01T00:00:00.000Z'));
      expect(result?.actualBirthDate).toBeUndefined();
      expect(result?.offspringIds).toEqual(['offspring-1', 'offspring-2']);
      expect(result?.notes).toBe('Test breeding record');
    });

    it('should handle missing optional fields', async () => {
      const rowWithoutOptionals = {
        ...mockBreedingRecordRow,
        expected_due_date: null,
        actual_birth_date: null,
        notes: null,
        offspring_ids: null
      };

      mockQuery.mockResolvedValue({ rows: [rowWithoutOptionals] });

      const result = await repository.findById('test-breeding-1');

      expect(result?.expectedDueDate).toBeUndefined();
      expect(result?.actualBirthDate).toBeUndefined();
      expect(result?.notes).toBeNull();
      expect(result?.offspringIds).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should find all breeding records with default pagination', async () => {
      const breedingRecordRows = [mockBreedingRecordRow, { ...mockBreedingRecordRow, id: 'breeding-2' }];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
        .mockResolvedValueOnce({ rows: breedingRecordRows }); // data query

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
        .mockResolvedValueOnce({ rows: [mockBreedingRecordRow] });

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
      const options: QueryOptions = { sortBy: 'breeding_date', sortOrder: 'asc' };
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockBreedingRecordRow] });

      await repository.findAll(options);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY br.breeding_date ASC'),
        [20, 0]
      );
    });

    it('should use default sorting for invalid sort fields', async () => {
      const options: QueryOptions = { sortBy: 'invalid_field' };
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockBreedingRecordRow] });

      await repository.findAll(options);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY br.breeding_date DESC, br.created_at DESC'),
        [20, 0]
      );
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findAll()).rejects.toThrow('Database connection failed');
    });
  });

  describe('update', () => {
    it('should update breeding record with offspring relationships', async () => {
      const updateInput: UpdateBreedingRecordInput = {
        notes: 'Updated breeding notes',
        offspringIds: ['new-offspring-1', 'new-offspring-2']
      };
      
      const updatedRow = { ...mockBreedingRecordRow, notes: 'Updated breeding notes' };
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [updatedRow] }) // UPDATE breeding record
        .mockResolvedValueOnce({}) // DELETE old offspring relationships
        .mockResolvedValueOnce({}) // INSERT new offspring relationship 1
        .mockResolvedValueOnce({}) // INSERT new offspring relationship 2
        .mockResolvedValueOnce({}); // COMMIT

      // Mock the offspring query for final result
      mockQuery.mockResolvedValueOnce({ 
        rows: [
          { offspring_id: 'new-offspring-1' },
          { offspring_id: 'new-offspring-2' }
        ]
      });

      const result = await repository.update('test-breeding-1', updateInput);

      expect(result?.notes).toBe('Updated breeding notes');
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE breeding_records'),
        expect.arrayContaining(['Updated breeding notes', 'test-breeding-1'])
      );
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return existing record when no fields to update', async () => {
      const updateInput: UpdateBreedingRecordInput = {};
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBreedingRecordRow] }) // SELECT existing record
        .mockResolvedValueOnce({}); // COMMIT

      mockQuery.mockResolvedValueOnce({ 
        rows: [
          { offspring_id: 'offspring-1' },
          { offspring_id: 'offspring-2' }
        ]
      });

      const result = await repository.update('test-breeding-1', updateInput);

      expect(result).toEqual(mockBreedingRecord);
    });

    it('should return null when breeding record not found', async () => {
      const updateInput: UpdateBreedingRecordInput = { notes: 'Updated notes' };
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE returns no rows
        .mockResolvedValueOnce({}); // ROLLBACK

      const result = await repository.update('nonexistent-id', updateInput);

      expect(result).toBeNull();
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should rollback transaction on error', async () => {
      const updateInput: UpdateBreedingRecordInput = { notes: 'Updated notes' };
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // UPDATE fails

      await expect(repository.update('test-breeding-1', updateInput)).rejects.toThrow('Database error');

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete breeding record successfully', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('test-breeding-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM breeding_records WHERE id = $1',
        ['test-breeding-1']
      );
    });

    it('should return false when breeding record not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.delete('test-breeding-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findBySire', () => {
    it('should find breeding records by sire id', async () => {
      const breedingRecords = [mockBreedingRecordRow, { ...mockBreedingRecordRow, id: 'breeding-2' }];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: breedingRecords });

      const result = await repository.findBySire('test-sire-1');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM breeding_records WHERE sire_id = $1',
        ['test-sire-1']
      );
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.findBySire('test-sire-1');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findBySire('test-sire-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByDam', () => {
    it('should find breeding records by dam id', async () => {
      const breedingRecords = [mockBreedingRecordRow, { ...mockBreedingRecordRow, id: 'breeding-2' }];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: breedingRecords });

      const result = await repository.findByDam('test-dam-1');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM breeding_records WHERE dam_id = $1',
        ['test-dam-1']
      );
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByDam('test-dam-1');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findByDam('test-dam-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByParent', () => {
    it('should find breeding records by parent field and id', async () => {
      const breedingRecords = [mockBreedingRecordRow];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: breedingRecords });

      const result = await repository.findByParent('sire_id', 'test-sire-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM breeding_records WHERE sire_id = $1',
        ['test-sire-1']
      );
    });

    it('should handle dam_id field', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repository.findByParent('dam_id', 'test-dam-1');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM breeding_records WHERE dam_id = $1',
        ['test-dam-1']
      );
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findByParent('sire_id', 'test-sire-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByDateRange', () => {
    it('should find breeding records within date range', async () => {
      const breedingRecords = [
        { ...mockBreedingRecordRow, id: 'breeding-1', breeding_date: '2024-01-15T00:00:00.000Z' },
        { ...mockBreedingRecordRow, id: 'breeding-2', breeding_date: '2024-02-15T00:00:00.000Z' }
      ];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: breedingRecords });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-28');
      const result = await repository.findByDateRange(startDate, endDate);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM breeding_records WHERE breeding_date BETWEEN $1 AND $2',
        [startDate, endDate]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE br.breeding_date BETWEEN $1 AND $2'),
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

  describe('getExpectedBirths', () => {
    it('should find expected births within specified days', async () => {
      const expectedBirthRecords = [
        { ...mockBreedingRecordRow, id: 'breeding-1', expected_due_date: '2024-02-01T00:00:00.000Z', actual_birth_date: null },
        { ...mockBreedingRecordRow, id: 'breeding-2', expected_due_date: '2024-02-15T00:00:00.000Z', actual_birth_date: null }
      ];
      
      mockQuery.mockResolvedValue({ rows: expectedBirthRecords });

      const result = await repository.getExpectedBirths(30);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('breeding-1');
      expect(result[1].id).toBe('breeding-2');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE br.expected_due_date IS NOT NULL'),
        [expect.any(Date)]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND br.actual_birth_date IS NULL'),
        [expect.any(Date)]
      );
    });

    it('should use default 30 days when no parameter provided', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await repository.getExpectedBirths();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND br.expected_due_date BETWEEN CURRENT_DATE AND $1'),
        [expect.any(Date)]
      );
    });

    it('should handle empty results', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.getExpectedBirths(30);

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.getExpectedBirths(30)).rejects.toThrow('Database connection failed');
    });
  });

  describe('mapRowToBreedingRecord', () => {
    it('should map database row to breeding record entity correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [mockBreedingRecordRow] });

      const result = await repository.findById('test-breeding-1');

      expect(result).toEqual(mockBreedingRecord);
    });

    it('should handle null values correctly', async () => {
      const rowWithNulls = {
        ...mockBreedingRecordRow,
        expected_due_date: null,
        actual_birth_date: null,
        notes: null,
        offspring_ids: null
      };

      mockQuery.mockResolvedValue({ rows: [rowWithNulls] });

      const result = await repository.findById('test-breeding-1');

      expect(result?.expectedDueDate).toBeUndefined();
      expect(result?.actualBirthDate).toBeUndefined();
      expect(result?.notes).toBeNull();
      expect(result?.offspringIds).toEqual([]);
    });

    it('should parse dates correctly', async () => {
      const rowWithDates = {
        ...mockBreedingRecordRow,
        breeding_date: '2024-01-15T10:30:00.000Z',
        expected_due_date: '2024-12-15T10:30:00.000Z',
        actual_birth_date: '2024-12-10T08:00:00.000Z',
        created_at: '2024-01-01T08:00:00.000Z'
      };

      mockQuery.mockResolvedValue({ rows: [rowWithDates] });

      const result = await repository.findById('test-breeding-1');

      expect(result?.breedingDate).toEqual(new Date('2024-01-15T10:30:00.000Z'));
      expect(result?.expectedDueDate).toEqual(new Date('2024-12-15T10:30:00.000Z'));
      expect(result?.actualBirthDate).toEqual(new Date('2024-12-10T08:00:00.000Z'));
      expect(result?.createdAt).toEqual(new Date('2024-01-01T08:00:00.000Z'));
    });

    it('should filter null offspring ids', async () => {
      const rowWithNullOffspring = {
        ...mockBreedingRecordRow,
        offspring_ids: ['offspring-1', null, 'offspring-2', null]
      };

      mockQuery.mockResolvedValue({ rows: [rowWithNullOffspring] });

      const result = await repository.findById('test-breeding-1');

      expect(result?.offspringIds).toEqual(['offspring-1', 'offspring-2']);
    });
  });

  describe('SQL parameter binding', () => {
    it('should properly bind parameters in create query', async () => {
      const createInput = BreedingRecordFactory.createInput({
        sireId: 'test-sire-1',
        damId: 'test-dam-1',
        breedingDate: new Date('2024-01-01'),
        expectedDueDate: new Date('2024-12-01'),
        actualBirthDate: undefined,
        notes: 'Test breeding',
        offspringIds: ['offspring-1']
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBreedingRecordRow] }) // INSERT
        .mockResolvedValueOnce({}) // INSERT offspring
        .mockResolvedValueOnce({}); // COMMIT

      await repository.create(createInput);

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO breeding_records'),
        [
          'test-sire-1',
          'test-dam-1',
          createInput.breedingDate,
          createInput.expectedDueDate,
          null, // actualBirthDate is converted from undefined to null
          'Test breeding'
        ]
      );
    });

    it('should handle null parameters in create query', async () => {
      const minimalInput: CreateBreedingRecordInput = {
        sireId: 'test-sire-1',
        damId: 'test-dam-1',
        breedingDate: new Date('2024-01-01')
      };

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBreedingRecordRow] }) // INSERT
        .mockResolvedValueOnce({}); // COMMIT

      await repository.create(minimalInput);

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO breeding_records'),
        [
          'test-sire-1',
          'test-dam-1',
          minimalInput.breedingDate,
          null, // expectedDueDate
          null, // actualBirthDate
          null  // notes
        ]
      );
    });
  });

  describe('transaction management', () => {
    it('should handle successful transactions', async () => {
      const createInput = BreedingRecordFactory.createInput();
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBreedingRecordRow] }) // INSERT
        .mockResolvedValueOnce({}); // COMMIT

      await repository.create(createInput);

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on transaction failure', async () => {
      const createInput = BreedingRecordFactory.createInput();
      
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Transaction failed')); // INSERT fails

      await expect(repository.create(createInput)).rejects.toThrow('Transaction failed');

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle client acquisition errors', async () => {
      const createInput = BreedingRecordFactory.createInput();
      mockGetClient.mockRejectedValue(new Error('Client acquisition failed'));

      await expect(repository.create(createInput)).rejects.toThrow('Client acquisition failed');
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

      await expect(repository.create(BreedingRecordFactory.createInput())).rejects.toThrow('foreign key constraint violation');
    });

    it('should handle invalid SQL syntax errors', async () => {
      const syntaxError = new Error('syntax error at or near');
      mockQuery.mockRejectedValue(syntaxError);

      await expect(repository.findAll()).rejects.toThrow('syntax error at or near');
    });

    it('should handle transaction deadlock errors', async () => {
      const deadlockError = new Error('deadlock detected');
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(deadlockError); // Transaction fails

      await expect(repository.create(BreedingRecordFactory.createInput())).rejects.toThrow('deadlock detected');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});