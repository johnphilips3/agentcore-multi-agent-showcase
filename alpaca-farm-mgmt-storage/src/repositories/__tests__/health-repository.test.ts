/**
 * Unit tests for PostgreSQLHealthRepository
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PostgreSQLHealthRepository, QueryOptions, PaginatedResult } from '../pg-health-repository';
import { HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput } from '../../models/health-record';
import { RecordType } from '../../models/common';
import { PostgreSQLConnection } from '../../database/pg-connection';
import { HealthRecordFactory } from '../../__tests__/data-factories';
import { MockUtils, TestEnvironment } from '../../__tests__/test-utils';

// Mock PostgreSQL connection
const mockConnection: PostgreSQLConnection = {
  query: vi.fn(),
  getClient: vi.fn(),
  close: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true)
};

describe('PostgreSQLHealthRepository', () => {
  let repository: PostgreSQLHealthRepository;
  let mockQuery: any;

  const mockHealthRecordRow = {
    id: 'test-health-1',
    alpaca_id: 'test-alpaca-1',
    record_type: 'vaccination',
    date: '2024-01-01T00:00:00.000Z',
    description: 'Annual vaccination',
    veterinarian: 'Dr. Smith',
    next_due_date: '2025-01-01T00:00:00.000Z',
    notes: 'No adverse reactions',
    created_at: '2024-01-01T00:00:00.000Z'
  };

  const mockHealthRecord: HealthRecord = HealthRecordFactory.create({
    id: 'test-health-1',
    alpacaId: 'test-alpaca-1',
    recordType: 'vaccination',
    date: new Date('2024-01-01T00:00:00.000Z'),
    description: 'Annual vaccination',
    veterinarian: 'Dr. Smith',
    nextDueDate: new Date('2025-01-01T00:00:00.000Z'),
    notes: 'No adverse reactions',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z')
  });

  beforeEach(() => {
    TestEnvironment.setupTestEnv();
    repository = new PostgreSQLHealthRepository(mockConnection);
    mockQuery = vi.mocked(mockConnection.query);
    MockUtils.clearAllMocks();
  });

  afterEach(() => {
    TestEnvironment.cleanupTestEnv();
    MockUtils.restoreAllMocks();
  });

  describe('create', () => {
    it('should create health record with all fields', async () => {
      const createInput: CreateHealthRecordInput = HealthRecordFactory.createInput();
      mockQuery.mockResolvedValue({ rows: [mockHealthRecordRow] });

      const result = await repository.create(createInput);

      expect(result).toEqual(mockHealthRecord);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO health_records'),
        expect.arrayContaining([
          createInput.alpacaId,
          createInput.recordType,
          createInput.date,
          createInput.description,
          createInput.veterinarian,
          createInput.nextDueDate,
          createInput.notes
        ])
      );
    });

    it('should create health record with minimal fields', async () => {
      const minimalInput: CreateHealthRecordInput = {
        alpacaId: 'test-alpaca-1',
        recordType: 'checkup',
        date: new Date('2024-01-01'),
        description: 'Routine checkup'
      };
      
      const minimalRow = {
        ...mockHealthRecordRow,
        record_type: 'checkup',
        description: 'Routine checkup',
        veterinarian: null,
        next_due_date: null,
        notes: null
      };

      mockQuery.mockResolvedValue({ rows: [minimalRow] });

      const result = await repository.create(minimalInput);

      expect(result.recordType).toBe('checkup');
      expect(result.description).toBe('Routine checkup');
      expect(result.veterinarian).toBeNull();
      expect(result.nextDueDate).toBeUndefined();
      expect(result.notes).toBeNull();
    });

    it('should handle database errors during creation', async () => {
      const createInput = HealthRecordFactory.createInput();
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.create(createInput)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findById', () => {
    it('should find health record by id', async () => {
      mockQuery.mockResolvedValue({ rows: [mockHealthRecordRow] });

      const result = await repository.findById('test-health-1');

      expect(result).toEqual(mockHealthRecord);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM health_records WHERE id = $1',
        ['test-health-1']
      );
    });

    it('should return null when health record not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findById('test-health-1')).rejects.toThrow('Database connection failed');
    });

    it('should map row to health record entity correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [mockHealthRecordRow] });

      const result = await repository.findById('test-health-1');

      expect(result?.id).toBe('test-health-1');
      expect(result?.alpacaId).toBe('test-alpaca-1');
      expect(result?.recordType).toBe('vaccination');
      expect(result?.date).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(result?.description).toBe('Annual vaccination');
      expect(result?.veterinarian).toBe('Dr. Smith');
      expect(result?.nextDueDate).toEqual(new Date('2025-01-01T00:00:00.000Z'));
      expect(result?.notes).toBe('No adverse reactions');
    });

    it('should handle missing optional fields', async () => {
      const rowWithoutOptionals = {
        ...mockHealthRecordRow,
        veterinarian: null,
        next_due_date: null,
        notes: null
      };

      mockQuery.mockResolvedValue({ rows: [rowWithoutOptionals] });

      const result = await repository.findById('test-health-1');

      expect(result?.veterinarian).toBeNull();
      expect(result?.nextDueDate).toBeUndefined();
      expect(result?.notes).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all health records with default pagination', async () => {
      const healthRecordRows = [mockHealthRecordRow, { ...mockHealthRecordRow, id: 'health-2', description: 'Checkup' }];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
        .mockResolvedValueOnce({ rows: healthRecordRows }); // data query

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
        .mockResolvedValueOnce({ rows: [mockHealthRecordRow] });

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
        .mockResolvedValueOnce({ rows: [mockHealthRecordRow] });

      await repository.findAll(options);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY date ASC'),
        [20, 0]
      );
    });

    it('should use default sorting for invalid sort fields', async () => {
      const options: QueryOptions = { sortBy: 'invalid_field' };
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockHealthRecordRow] });

      await repository.findAll(options);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY date DESC, created_at DESC'),
        [20, 0]
      );
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findAll()).rejects.toThrow('Database connection failed');
    });
  });

  describe('update', () => {
    it('should update health record with provided fields', async () => {
      const updateInput: UpdateHealthRecordInput = {
        description: 'Updated vaccination',
        notes: 'Updated notes'
      };
      
      const updatedRow = { ...mockHealthRecordRow, description: 'Updated vaccination', notes: 'Updated notes' };
      mockQuery.mockResolvedValue({ rows: [updatedRow] });

      const result = await repository.update('test-health-1', updateInput);

      expect(result?.description).toBe('Updated vaccination');
      expect(result?.notes).toBe('Updated notes');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE health_records SET'),
        expect.arrayContaining(['Updated vaccination', 'Updated notes', 'test-health-1'])
      );
    });

    it('should return existing record when no fields to update', async () => {
      const updateInput: UpdateHealthRecordInput = {};
      
      mockQuery.mockResolvedValue({ rows: [mockHealthRecordRow] });

      const result = await repository.update('test-health-1', updateInput);

      expect(result).toEqual(mockHealthRecord);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM health_records WHERE id = $1',
        ['test-health-1']
      );
    });

    it('should return null when health record not found', async () => {
      const updateInput: UpdateHealthRecordInput = { description: 'Updated description' };
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.update('nonexistent-id', updateInput);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const updateInput: UpdateHealthRecordInput = { description: 'Updated description' };
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.update('test-health-1', updateInput)).rejects.toThrow('Database connection failed');
    });
  });

  describe('delete', () => {
    it('should delete health record successfully', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('test-health-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM health_records WHERE id = $1',
        ['test-health-1']
      );
    });

    it('should return false when health record not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.delete('test-health-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByAlpaca', () => {
    it('should find health records by alpaca id', async () => {
      const healthRecordRows = [
        { ...mockHealthRecordRow, id: 'health-1', description: 'Vaccination 1' },
        { ...mockHealthRecordRow, id: 'health-2', description: 'Vaccination 2' }
      ];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: healthRecordRows });

      const result = await repository.findByAlpaca('test-alpaca-1');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0].description).toBe('Vaccination 1');
      expect(result.data[1].description).toBe('Vaccination 2');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM health_records WHERE alpaca_id = $1',
        ['test-alpaca-1']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE alpaca_id = $1'),
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

  describe('findByRecordType', () => {
    it('should find health records by record type', async () => {
      const vaccinationRecords = [
        { ...mockHealthRecordRow, id: 'health-1', description: 'Vaccination 1' },
        { ...mockHealthRecordRow, id: 'health-2', description: 'Vaccination 2' }
      ];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: vaccinationRecords });

      const result = await repository.findByRecordType('vaccination');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0].recordType).toBe('vaccination');
      expect(result.data[1].recordType).toBe('vaccination');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM health_records WHERE record_type = $1',
        ['vaccination']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE record_type = $1'),
        ['vaccination', 20, 0]
      );
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByRecordType('treatment');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findByRecordType('vaccination')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getOverdueVaccinations', () => {
    it('should find overdue vaccinations', async () => {
      const overdueVaccination = {
        ...mockHealthRecordRow,
        id: 'health-1',
        record_type: 'vaccination',
        next_due_date: '2023-12-01T00:00:00.000Z', // Past date
        description: 'Overdue vaccination'
      };
      
      const anotherOverdueVaccination = {
        ...mockHealthRecordRow,
        id: 'health-2',
        record_type: 'vaccination',
        next_due_date: '2023-11-01T00:00:00.000Z', // Past date
        description: 'Another overdue vaccination'
      };
      
      mockQuery.mockResolvedValue({ rows: [anotherOverdueVaccination, overdueVaccination] }); // Ordered by next_due_date ASC

      const result = await repository.getOverdueVaccinations();

      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('Another overdue vaccination');
      expect(result[1].description).toBe('Overdue vaccination');
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE record_type = 'vaccination'"),
        []
      );
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND next_due_date IS NOT NULL'),
        []
      );
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND next_due_date < CURRENT_DATE'),
        []
      );
    });

    it('should return empty array when no overdue vaccinations', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.getOverdueVaccinations();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.getOverdueVaccinations()).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByDateRange', () => {
    it('should find health records within date range', async () => {
      const record1 = { ...mockHealthRecordRow, id: 'health-1', date: '2024-01-15T00:00:00.000Z' };
      const record2 = { ...mockHealthRecordRow, id: 'health-2', date: '2024-02-15T00:00:00.000Z' };
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [record1, record2] });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-28');
      const result = await repository.findByDateRange(startDate, endDate);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM health_records WHERE date BETWEEN $1 AND $2',
        [startDate, endDate]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE date BETWEEN $1 AND $2'),
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

  describe('mapRowToHealthRecord', () => {
    it('should map database row to health record entity correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [mockHealthRecordRow] });

      const result = await repository.findById('test-health-1');

      expect(result).toEqual(mockHealthRecord);
    });

    it('should handle null values correctly', async () => {
      const rowWithNulls = {
        ...mockHealthRecordRow,
        veterinarian: null,
        next_due_date: null,
        notes: null
      };

      mockQuery.mockResolvedValue({ rows: [rowWithNulls] });

      const result = await repository.findById('test-health-1');

      expect(result?.veterinarian).toBeNull();
      expect(result?.nextDueDate).toBeUndefined();
      expect(result?.notes).toBeNull();
    });

    it('should parse dates correctly', async () => {
      const rowWithDates = {
        ...mockHealthRecordRow,
        date: '2024-01-15T10:30:00.000Z',
        next_due_date: '2025-01-15T10:30:00.000Z',
        created_at: '2024-01-01T08:00:00.000Z'
      };

      mockQuery.mockResolvedValue({ rows: [rowWithDates] });

      const result = await repository.findById('test-health-1');

      expect(result?.date).toEqual(new Date('2024-01-15T10:30:00.000Z'));
      expect(result?.nextDueDate).toEqual(new Date('2025-01-15T10:30:00.000Z'));
      expect(result?.createdAt).toEqual(new Date('2024-01-01T08:00:00.000Z'));
    });
  });

  describe('SQL parameter binding', () => {
    it('should properly bind parameters in create query', async () => {
      const createInput = HealthRecordFactory.createInput({
        alpacaId: 'test-alpaca-1',
        recordType: 'vaccination',
        date: new Date('2024-01-01'),
        description: 'Test vaccination',
        veterinarian: 'Dr. Test',
        nextDueDate: new Date('2025-01-01'),
        notes: 'Test notes'
      });

      mockQuery.mockResolvedValue({ rows: [mockHealthRecordRow] });

      await repository.create(createInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO health_records'),
        [
          'test-alpaca-1',
          'vaccination',
          createInput.date,
          'Test vaccination',
          'Dr. Test',
          createInput.nextDueDate,
          'Test notes'
        ]
      );
    });

    it('should handle null parameters in create query', async () => {
      const minimalInput: CreateHealthRecordInput = {
        alpacaId: 'test-alpaca-1',
        recordType: 'checkup',
        date: new Date('2024-01-01'),
        description: 'Minimal checkup'
      };

      mockQuery.mockResolvedValue({ rows: [mockHealthRecordRow] });

      await repository.create(minimalInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO health_records'),
        [
          'test-alpaca-1',
          'checkup',
          minimalInput.date,
          'Minimal checkup',
          null, // veterinarian
          null, // nextDueDate
          null  // notes
        ]
      );
    });
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      const connectionError = new Error('Connection timeout');
      mockQuery.mockRejectedValue(connectionError);

      await expect(repository.findById('test-id')).rejects.toThrow('Connection timeout');
      await expect(repository.create(HealthRecordFactory.createInput())).rejects.toThrow('Connection timeout');
      await expect(repository.update('test-id', {})).rejects.toThrow('Connection timeout');
      await expect(repository.delete('test-id')).rejects.toThrow('Connection timeout');
    });

    it('should handle SQL constraint violations', async () => {
      const constraintError = new Error('foreign key constraint violation');
      mockQuery.mockRejectedValue(constraintError);

      await expect(repository.create(HealthRecordFactory.createInput())).rejects.toThrow('foreign key constraint violation');
    });

    it('should handle invalid SQL syntax errors', async () => {
      const syntaxError = new Error('syntax error at or near');
      mockQuery.mockRejectedValue(syntaxError);

      await expect(repository.findAll()).rejects.toThrow('syntax error at or near');
    });

    it('should handle invalid record type errors', async () => {
      const invalidTypeError = new Error('invalid input value for enum record_type');
      mockQuery.mockRejectedValue(invalidTypeError);

      await expect(repository.findByRecordType('invalid_type' as RecordType)).rejects.toThrow('invalid input value for enum record_type');
    });
  });
});