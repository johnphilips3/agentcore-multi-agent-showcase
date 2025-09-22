import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BreedingRepositoryImpl } from '../breeding-repository';
import { BreedingRecord } from '../../models';
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

describe('BreedingRepositoryImpl', () => {
  let repository: BreedingRepositoryImpl;
  let mockQuery: any;
  let mockExecute: any;

  const mockBreedingRecordRow = {
    id: 'breeding-1',
    sire_id: 'sire-1',
    dam_id: 'dam-1',
    breeding_date: '2023-01-01T00:00:00.000Z',
    expected_due_date: '2023-12-01T00:00:00.000Z',
    actual_birth_date: '2023-11-30T00:00:00.000Z',
    offspring_ids: '["offspring-1", "offspring-2"]',
    notes: 'Successful breeding',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z'
  };

  const mockBreedingRecord: BreedingRecord = {
    id: 'breeding-1',
    sireId: 'sire-1',
    damId: 'dam-1',
    breedingDate: new Date('2023-01-01T00:00:00.000Z'),
    expectedDueDate: new Date('2023-12-01T00:00:00.000Z'),
    actualBirthDate: new Date('2023-11-30T00:00:00.000Z'),
    offspringIds: ['offspring-1', 'offspring-2'],
    notes: 'Successful breeding',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z')
  };

  beforeEach(() => {
    repository = new BreedingRepositoryImpl();
    mockQuery = vi.mocked(mockConnection.query);
    mockExecute = vi.mocked(mockConnection.execute);
    
    mockQuery.mockReset();
    mockExecute.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mapRowToEntity', () => {
    it('should map database row to breeding record entity correctly', async () => {
      mockQuery.mockResolvedValue([mockBreedingRecordRow]);

      const result = await repository.findById('breeding-1');

      expect(result).toEqual(mockBreedingRecord);
    });

    it('should handle missing optional fields', async () => {
      const rowWithoutOptionals = {
        ...mockBreedingRecordRow,
        expected_due_date: null,
        actual_birth_date: null,
        offspring_ids: null,
        notes: null
      };

      mockQuery.mockResolvedValue([rowWithoutOptionals]);

      const result = await repository.findById('breeding-1');

      expect(result?.expectedDueDate).toBeUndefined();
      expect(result?.actualBirthDate).toBeUndefined();
      expect(result?.offspringIds).toEqual([]);
      expect(result?.notes).toBeNull();
    });

    it('should handle invalid JSON in offspring_ids', async () => {
      const rowWithInvalidJson = {
        ...mockBreedingRecordRow,
        offspring_ids: 'invalid-json'
      };

      mockQuery.mockResolvedValue([rowWithInvalidJson]);

      const result = await repository.findById('breeding-1');

      expect(result?.offspringIds).toEqual([]);
    });
  });

  describe('findByParent', () => {
    it('should find breeding records by parent id', async () => {
      const breeding1 = { ...mockBreedingRecordRow, id: 'breeding-1', sire_id: 'parent-1' };
      const breeding2 = { ...mockBreedingRecordRow, id: 'breeding-2', dam_id: 'parent-1' };
      
      mockQuery.mockResolvedValue([breeding1, breeding2]);

      const result = await repository.findByParent('parent-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('breeding-1');
      expect(result[1].id).toBe('breeding-2');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM breeding_records WHERE sire_id = $1 OR dam_id = $1 ORDER BY breeding_date DESC',
        ['parent-1']
      );
    });

    it('should return empty array when no records found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findByParent('parent-1');

      expect(result).toEqual([]);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByParent('parent-1'))
        .rejects.toThrow('Failed to find breeding records by parent');
    });
  });

  describe('findByDateRange', () => {
    it('should find breeding records within date range', async () => {
      const breeding1 = { ...mockBreedingRecordRow, id: 'breeding-1', breeding_date: '2023-01-15T00:00:00.000Z' };
      const breeding2 = { ...mockBreedingRecordRow, id: 'breeding-2', breeding_date: '2023-02-15T00:00:00.000Z' };
      
      mockQuery.mockResolvedValue([breeding1, breeding2]);

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-02-28');
      const result = await repository.findByDateRange(startDate, endDate);

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM breeding_records WHERE breeding_date BETWEEN $1 AND $2 ORDER BY breeding_date DESC',
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
        .rejects.toThrow('Failed to find breeding records by date range');
    });
  });

  describe('checkInbreeding', () => {
    it('should return true for direct parent-child relationship', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: 1 }]) // Direct relationship found
        .mockResolvedValueOnce([{ count: 0 }]) // No sibling relationship
        .mockResolvedValueOnce([{ count: 0 }]); // No grandparent relationship

      const result = await repository.checkInbreeding('sire-1', 'dam-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM alpacas'),
        ['sire-1', 'dam-1']
      );
    });

    it('should return true for sibling relationship', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: 0 }]) // No direct relationship
        .mockResolvedValueOnce([{ count: 1 }]) // Sibling relationship found
        .mockResolvedValueOnce([{ count: 0 }]); // No grandparent relationship

      const result = await repository.checkInbreeding('sire-1', 'dam-1');

      expect(result).toBe(true);
    });

    it('should return true for grandparent-grandchild relationship', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: 0 }]) // No direct relationship
        .mockResolvedValueOnce([{ count: 0 }]) // No sibling relationship
        .mockResolvedValueOnce([{ count: 1 }]); // Grandparent relationship found

      const result = await repository.checkInbreeding('sire-1', 'dam-1');

      expect(result).toBe(true);
    });

    it('should return false when no inbreeding detected', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: 0 }]) // No direct relationship
        .mockResolvedValueOnce([{ count: 0 }]) // No sibling relationship
        .mockResolvedValueOnce([{ count: 0 }]); // No grandparent relationship

      const result = await repository.checkInbreeding('sire-1', 'dam-1');

      expect(result).toBe(false);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.checkInbreeding('sire-1', 'dam-1'))
        .rejects.toThrow('Failed to check inbreeding');
    });
  });

  describe('create with offspring relationships', () => {
    it('should create breeding record and handle offspring relationships', async () => {
      const createData = {
        sireId: 'sire-1',
        damId: 'dam-1',
        breedingDate: new Date('2023-01-01'),
        offspringIds: ['offspring-1', 'offspring-2']
      };

      // Mock the create call from parent class
      mockQuery.mockResolvedValue([{
        id: 'new-breeding-id',
        sire_id: 'sire-1',
        dam_id: 'dam-1',
        breeding_date: '2023-01-01T00:00:00.000Z',
        expected_due_date: null,
        actual_birth_date: null,
        offspring_ids: '["offspring-1", "offspring-2"]',
        notes: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }]);

      mockExecute.mockResolvedValue({ changes: 1 });

      const result = await repository.create(createData);

      expect(result.sireId).toBe('sire-1');
      expect(result.damId).toBe('dam-1');
      expect(result.offspringIds).toEqual(['offspring-1', 'offspring-2']);

      // Verify offspring relationships were created
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO breeding_offspring (breeding_id, offspring_id) VALUES ($1, $2)',
        ['new-breeding-id', 'offspring-1']
      );
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO breeding_offspring (breeding_id, offspring_id) VALUES ($1, $2)',
        ['new-breeding-id', 'offspring-2']
      );
    });

    it('should create breeding record without offspring relationships', async () => {
      const createData = {
        sireId: 'sire-1',
        damId: 'dam-1',
        breedingDate: new Date('2023-01-01'),
        offspringIds: []
      };

      mockQuery.mockResolvedValue([{
        id: 'new-breeding-id',
        sire_id: 'sire-1',
        dam_id: 'dam-1',
        breeding_date: '2023-01-01T00:00:00.000Z',
        expected_due_date: null,
        actual_birth_date: null,
        offspring_ids: '[]',
        notes: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }]);

      const result = await repository.create(createData);

      expect(result.offspringIds).toEqual([]);
      // Should not call execute for offspring relationships
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('update with offspring relationships', () => {
    it('should update breeding record and handle offspring relationships', async () => {
      const existingRecord = {
        id: 'breeding-1',
        sire_id: 'sire-1',
        dam_id: 'dam-1',
        breeding_date: '2023-01-01T00:00:00.000Z',
        expected_due_date: null,
        actual_birth_date: null,
        offspring_ids: '["old-offspring"]',
        notes: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const updatedRecord = {
        ...existingRecord,
        offspring_ids: '["new-offspring-1", "new-offspring-2"]',
        updated_at: '2023-01-01T01:00:00.000Z'
      };

      // Mock findById call
      mockQuery.mockResolvedValueOnce([existingRecord]);
      // Mock update call
      mockQuery.mockResolvedValueOnce([updatedRecord]);

      mockExecute.mockResolvedValue({ changes: 1 });

      const result = await repository.update('breeding-1', {
        offspringIds: ['new-offspring-1', 'new-offspring-2']
      });

      expect(result.offspringIds).toEqual(['new-offspring-1', 'new-offspring-2']);

      // Verify old relationships were deleted
      expect(mockExecute).toHaveBeenCalledWith(
        'DELETE FROM breeding_offspring WHERE breeding_id = $1',
        ['breeding-1']
      );

      // Verify new relationships were created
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO breeding_offspring (breeding_id, offspring_id) VALUES ($1, $2)',
        ['breeding-1', 'new-offspring-1']
      );
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO breeding_offspring (breeding_id, offspring_id) VALUES ($1, $2)',
        ['breeding-1', 'new-offspring-2']
      );
    });
  });

  describe('mapEntityToRow', () => {
    it('should map entity to database row correctly', async () => {
      const createData = {
        sireId: 'sire-2',
        damId: 'dam-2',
        breedingDate: new Date('2023-03-01'),
        expectedDueDate: new Date('2024-02-01'),
        offspringIds: ['offspring-3'],
        notes: 'Test breeding'
      };

      const mockResult = [{
        id: 'new-breeding-id',
        sire_id: 'sire-2',
        dam_id: 'dam-2',
        breeding_date: '2023-03-01T00:00:00.000Z',
        expected_due_date: '2024-02-01T00:00:00.000Z',
        actual_birth_date: null,
        offspring_ids: '["offspring-3"]',
        notes: 'Test breeding',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }];

      mockQuery.mockResolvedValue(mockResult);
      mockExecute.mockResolvedValue({ changes: 1 });

      const result = await repository.create(createData);

      expect(result.sireId).toBe('sire-2');
      expect(result.damId).toBe('dam-2');
      expect(result.expectedDueDate).toEqual(new Date('2024-02-01T00:00:00.000Z'));
      expect(result.offspringIds).toEqual(['offspring-3']);
      expect(result.notes).toBe('Test breeding');
      
      // Verify the SQL call includes the mapped fields
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO breeding_records'),
        expect.arrayContaining(['sire-2', 'dam-2'])
      );
    });

    it('should handle undefined optional fields', async () => {
      const createData = {
        sireId: 'sire-3',
        damId: 'dam-3',
        breedingDate: new Date('2023-03-01'),
        offspringIds: []
      };

      const mockResult = [{
        id: 'simple-breeding-id',
        sire_id: 'sire-3',
        dam_id: 'dam-3',
        breeding_date: '2023-03-01T00:00:00.000Z',
        expected_due_date: null,
        actual_birth_date: null,
        offspring_ids: '[]',
        notes: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }];

      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.create(createData);

      expect(result.sireId).toBe('sire-3');
      expect(result.damId).toBe('dam-3');
      expect(result.expectedDueDate).toBeUndefined();
      expect(result.actualBirthDate).toBeUndefined();
      expect(result.offspringIds).toEqual([]);
      expect(result.notes).toBeNull();
    });
  });
});