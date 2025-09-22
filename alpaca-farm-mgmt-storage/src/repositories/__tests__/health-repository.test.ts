import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthRepositoryImpl } from '../health-repository';
import { HealthRecord, RecordType } from '../../models';
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

describe('HealthRepositoryImpl', () => {
  let repository: HealthRepositoryImpl;
  let mockQuery: any;

  const mockHealthRecordRow = {
    id: 'health-1',
    alpaca_id: 'alpaca-1',
    record_type: 'vaccination',
    date: '2023-01-01T00:00:00.000Z',
    description: 'Annual vaccination',
    veterinarian: 'Dr. Smith',
    next_due_date: '2024-01-01T00:00:00.000Z',
    notes: 'No adverse reactions',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z'
  };

  const mockHealthRecord: HealthRecord = {
    id: 'health-1',
    alpacaId: 'alpaca-1',
    recordType: 'vaccination' as RecordType,
    date: new Date('2023-01-01T00:00:00.000Z'),
    description: 'Annual vaccination',
    veterinarian: 'Dr. Smith',
    nextDueDate: new Date('2024-01-01T00:00:00.000Z'),
    notes: 'No adverse reactions',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z')
  };

  beforeEach(() => {
    repository = new HealthRepositoryImpl();
    mockQuery = vi.mocked(mockConnection.query);
    mockQuery.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mapRowToEntity', () => {
    it('should map database row to health record entity correctly', async () => {
      mockQuery.mockResolvedValue([mockHealthRecordRow]);

      const result = await repository.findById('health-1');

      expect(result).toEqual(mockHealthRecord);
    });

    it('should handle missing optional fields', async () => {
      const rowWithoutOptionals = {
        ...mockHealthRecordRow,
        veterinarian: null,
        next_due_date: null,
        notes: null
      };

      mockQuery.mockResolvedValue([rowWithoutOptionals]);

      const result = await repository.findById('health-1');

      expect(result?.veterinarian).toBeNull();
      expect(result?.nextDueDate).toBeUndefined();
      expect(result?.notes).toBeNull();
    });
  });

  describe('findByAlpaca', () => {
    it('should find health records by alpaca id', async () => {
      const record1 = { ...mockHealthRecordRow, id: 'health-1', description: 'Vaccination 1' };
      const record2 = { ...mockHealthRecordRow, id: 'health-2', description: 'Vaccination 2' };
      
      mockQuery.mockResolvedValue([record1, record2]);

      const result = await repository.findByAlpaca('alpaca-1');

      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('Vaccination 1');
      expect(result[1].description).toBe('Vaccination 2');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM health_records WHERE alpaca_id = $1 ORDER BY date DESC',
        ['alpaca-1']
      );
    });

    it('should return empty array when no records found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findByAlpaca('alpaca-1');

      expect(result).toEqual([]);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByAlpaca('alpaca-1'))
        .rejects.toThrow('Failed to find health records by alpaca');
    });
  });

  describe('findByDateRange', () => {
    it('should find health records within date range', async () => {
      const record1 = { ...mockHealthRecordRow, id: 'health-1', date: '2023-01-15T00:00:00.000Z' };
      const record2 = { ...mockHealthRecordRow, id: 'health-2', date: '2023-02-15T00:00:00.000Z' };
      
      mockQuery.mockResolvedValue([record1, record2]);

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-02-28');
      const result = await repository.findByDateRange(startDate, endDate);

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM health_records WHERE date BETWEEN $1 AND $2 ORDER BY date DESC',
        [startDate.toISOString(), endDate.toISOString()]
      );
    });

    it('should return empty array when no records in range', async () => {
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
        .rejects.toThrow('Failed to find health records by date range');
    });
  });

  describe('findByRecordType', () => {
    it('should find health records by record type', async () => {
      const vaccination1 = { ...mockHealthRecordRow, id: 'health-1', description: 'Vaccination 1' };
      const vaccination2 = { ...mockHealthRecordRow, id: 'health-2', description: 'Vaccination 2' };
      
      mockQuery.mockResolvedValue([vaccination1, vaccination2]);

      const result = await repository.findByRecordType('vaccination');

      expect(result).toHaveLength(2);
      expect(result[0].recordType).toBe('vaccination');
      expect(result[1].recordType).toBe('vaccination');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM health_records WHERE record_type = $1 ORDER BY date DESC',
        ['vaccination']
      );
    });

    it('should return empty array when no records of type found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findByRecordType('treatment');

      expect(result).toEqual([]);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByRecordType('vaccination'))
        .rejects.toThrow('Failed to find health records by type');
    });
  });

  describe('findOverdueVaccinations', () => {
    it('should find overdue vaccinations and treatments', async () => {
      const overdueVaccination = {
        ...mockHealthRecordRow,
        id: 'health-1',
        record_type: 'vaccination',
        next_due_date: '2022-12-01T00:00:00.000Z', // Past date
        description: 'Overdue vaccination'
      };
      
      const overdueTreatment = {
        ...mockHealthRecordRow,
        id: 'health-2',
        record_type: 'treatment',
        next_due_date: '2022-11-01T00:00:00.000Z', // Past date
        description: 'Overdue treatment'
      };
      
      mockQuery.mockResolvedValue([overdueTreatment, overdueVaccination]); // Ordered by next_due_date ASC

      const result = await repository.findOverdueVaccinations();

      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('Overdue treatment');
      expect(result[1].description).toBe('Overdue vaccination');
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE next_due_date IS NOT NULL'),
        expect.arrayContaining([expect.any(String)])
      );
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("record_type IN ('vaccination', 'treatment')"),
        expect.any(Array)
      );
    });

    it('should return empty array when no overdue records', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findOverdueVaccinations();

      expect(result).toEqual([]);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findOverdueVaccinations())
        .rejects.toThrow('Failed to find overdue vaccinations');
    });
  });

  describe('mapEntityToRow', () => {
    it('should map entity to database row correctly', async () => {
      const createData = {
        alpacaId: 'alpaca-1',
        recordType: 'treatment' as RecordType,
        date: new Date('2023-03-01'),
        description: 'Deworming treatment',
        veterinarian: 'Dr. Johnson',
        nextDueDate: new Date('2023-09-01'),
        notes: 'Follow-up needed'
      };

      const mockResult = [{
        id: 'new-health-id',
        alpaca_id: 'alpaca-1',
        record_type: 'treatment',
        date: '2023-03-01T00:00:00.000Z',
        description: 'Deworming treatment',
        veterinarian: 'Dr. Johnson',
        next_due_date: '2023-09-01T00:00:00.000Z',
        notes: 'Follow-up needed',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }];

      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.create(createData);

      expect(result.alpacaId).toBe('alpaca-1');
      expect(result.recordType).toBe('treatment');
      expect(result.description).toBe('Deworming treatment');
      expect(result.veterinarian).toBe('Dr. Johnson');
      
      // Verify the SQL call includes the mapped fields
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO health_records'),
        expect.arrayContaining(['alpaca-1', 'treatment', 'Deworming treatment'])
      );
    });

    it('should handle undefined optional fields', async () => {
      const createData = {
        alpacaId: 'alpaca-1',
        recordType: 'observation' as RecordType,
        date: new Date('2023-03-01'),
        description: 'General observation'
      };

      const mockResult = [{
        id: 'simple-health-id',
        alpaca_id: 'alpaca-1',
        record_type: 'observation',
        date: '2023-03-01T00:00:00.000Z',
        description: 'General observation',
        veterinarian: null,
        next_due_date: null,
        notes: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }];

      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.create(createData);

      expect(result.alpacaId).toBe('alpaca-1');
      expect(result.recordType).toBe('observation');
      expect(result.veterinarian).toBeNull();
      expect(result.nextDueDate).toBeUndefined();
      expect(result.notes).toBeNull();
    });

    it('should handle null nextDueDate correctly', async () => {
      const createData = {
        alpacaId: 'alpaca-1',
        recordType: 'checkup' as RecordType,
        date: new Date('2023-03-01'),
        description: 'Routine checkup',
        nextDueDate: undefined
      };

      const mockResult = [{
        id: 'checkup-id',
        alpaca_id: 'alpaca-1',
        record_type: 'checkup',
        date: '2023-03-01T00:00:00.000Z',
        description: 'Routine checkup',
        veterinarian: null,
        next_due_date: null,
        notes: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }];

      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.create(createData);

      expect(result.nextDueDate).toBeUndefined();
    });
  });
});