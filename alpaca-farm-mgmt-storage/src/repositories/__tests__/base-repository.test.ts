import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AbstractBaseRepository, RepositoryError } from '../base-repository';
import { BaseEntity } from '../../models/common';
import { DatabaseConnection } from '../../database/connection';

// Test entity interface
interface TestEntity extends BaseEntity {
  name: string;
  value: number;
  isActive: boolean;
}

// Mock database connection
const mockConnection: DatabaseConnection = {
  query: vi.fn(),
  execute: vi.fn(),
  close: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true)
};

// Concrete implementation for testing
class TestRepository extends AbstractBaseRepository<TestEntity> {
  constructor() {
    super('test_entities', {
      isActive: 'is_active'
    });
    this.connection = mockConnection;
  }

  protected mapRowToEntity(row: any): TestEntity {
    return {
      id: row.id,
      name: row.name,
      value: row.value,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  protected mapEntityToRow(entity: Partial<TestEntity>): Record<string, any> {
    const row: Record<string, any> = {};
    
    if (entity.id) row.id = entity.id;
    if (entity.name) row.name = entity.name;
    if (entity.value !== undefined) row.value = entity.value;
    if (entity.isActive !== undefined) row.is_active = entity.isActive;
    if (entity.createdAt) row.created_at = entity.createdAt.toISOString();
    if (entity.updatedAt) row.updated_at = entity.updatedAt.toISOString();
    
    return row;
  }
}

describe('AbstractBaseRepository', () => {
  let repository: TestRepository;
  let mockQuery: any;
  let mockExecute: any;

  beforeEach(() => {
    repository = new TestRepository();
    mockQuery = vi.mocked(mockConnection.query);
    mockExecute = vi.mocked(mockConnection.execute);
    
    // Reset mocks
    mockQuery.mockReset();
    mockExecute.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new entity successfully', async () => {
      const entityData = {
        name: 'Test Entity',
        value: 42,
        isActive: true
      };

      const mockResult = [{
        id: 'test-id',
        name: 'Test Entity',
        value: 42,
        is_active: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }];

      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.create(entityData);

      expect(result).toEqual({
        id: 'test-id',
        name: 'Test Entity',
        value: 42,
        isActive: true,
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z')
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_entities'),
        expect.arrayContaining(['Test Entity', 42, true])
      );
    });

    it('should throw RepositoryError when creation fails', async () => {
      const entityData = {
        name: 'Test Entity',
        value: 42,
        isActive: true
      };

      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.create(entityData)).rejects.toThrow(RepositoryError);
      await expect(repository.create(entityData)).rejects.toThrow('Failed to create entity in test_entities');
    });

    it('should throw RepositoryError when no result is returned', async () => {
      const entityData = {
        name: 'Test Entity',
        value: 42,
        isActive: true
      };

      mockQuery.mockResolvedValue([]);

      await expect(repository.create(entityData)).rejects.toThrow(RepositoryError);
      await expect(repository.create(entityData)).rejects.toThrow('Failed to create entity - no result returned');
    });
  });

  describe('findById', () => {
    it('should find entity by id successfully', async () => {
      const mockResult = [{
        id: 'test-id',
        name: 'Test Entity',
        value: 42,
        is_active: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }];

      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.findById('test-id');

      expect(result).toEqual({
        id: 'test-id',
        name: 'Test Entity',
        value: 42,
        isActive: true,
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z')
      });

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM test_entities WHERE id = $1',
        ['test-id']
      );
    });

    it('should return null when entity not found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should throw RepositoryError when query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findById('test-id')).rejects.toThrow(RepositoryError);
    });
  });

  describe('findAll', () => {
    it('should find all entities without options', async () => {
      const mockResult = [
        {
          id: 'test-id-1',
          name: 'Entity 1',
          value: 10,
          is_active: true,
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        },
        {
          id: 'test-id-2',
          name: 'Entity 2',
          value: 20,
          is_active: false,
          created_at: '2023-01-02T00:00:00.000Z',
          updated_at: '2023-01-02T00:00:00.000Z'
        }
      ];

      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Entity 1');
      expect(result[1].name).toBe('Entity 2');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM test_entities',
        []
      );
    });

    it('should apply filters correctly', async () => {
      mockQuery.mockResolvedValue([]);

      await repository.findAll({
        filters: {
          isActive: true,
          value: 42
        }
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = $1 AND value = $2'),
        [true, 42]
      );
    });

    it('should apply sorting correctly', async () => {
      mockQuery.mockResolvedValue([]);

      await repository.findAll({
        sortBy: 'name',
        sortOrder: 'desc'
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY name DESC'),
        []
      );
    });

    it('should apply pagination correctly', async () => {
      mockQuery.mockResolvedValue([]);

      await repository.findAll({
        limit: 10,
        offset: 20
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [10, 20]
      );
    });

    it('should handle array filters with IN clause', async () => {
      mockQuery.mockResolvedValue([]);

      await repository.findAll({
        filters: {
          value: [10, 20, 30]
        }
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE value IN ($1, $2, $3)'),
        [10, 20, 30]
      );
    });

    it('should handle date range filters', async () => {
      mockQuery.mockResolvedValue([]);

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      await repository.findAll({
        filters: {
          createdAt: { startDate, endDate }
        }
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE created_at BETWEEN $1 AND $2'),
        [startDate, endDate]
      );
    });
  });

  describe('update', () => {
    it('should update entity successfully', async () => {
      const existingEntity = {
        id: 'test-id',
        name: 'Original Name',
        value: 10,
        isActive: true,
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z')
      };

      const updatedRow = {
        id: 'test-id',
        name: 'Updated Name',
        value: 20,
        is_active: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T01:00:00.000Z'
      };

      // Mock findById call
      mockQuery.mockResolvedValueOnce([{
        id: 'test-id',
        name: 'Original Name',
        value: 10,
        is_active: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }]);

      // Mock update call
      mockQuery.mockResolvedValueOnce([updatedRow]);

      const result = await repository.update('test-id', {
        name: 'Updated Name',
        value: 20
      });

      expect(result.name).toBe('Updated Name');
      expect(result.value).toBe(20);
      expect(result.updatedAt).toEqual(new Date('2023-01-01T01:00:00.000Z'));

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_entities SET'),
        expect.arrayContaining(['Updated Name', 20])
      );
    });

    it('should throw RepositoryError when entity not found', async () => {
      mockQuery.mockResolvedValue([]);

      await expect(repository.update('non-existent-id', { name: 'New Name' }))
        .rejects.toThrow(RepositoryError);
      await expect(repository.update('non-existent-id', { name: 'New Name' }))
        .rejects.toThrow('Entity with id non-existent-id not found');
    });
  });

  describe('delete', () => {
    it('should delete entity successfully', async () => {
      mockExecute.mockResolvedValue({ changes: 1 });

      const result = await repository.delete('test-id');

      expect(result).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith(
        'DELETE FROM test_entities WHERE id = $1',
        ['test-id']
      );
    });

    it('should return false when entity not found', async () => {
      mockExecute.mockResolvedValue({ changes: 0 });

      const result = await repository.delete('non-existent-id');

      expect(result).toBe(false);
    });

    it('should throw RepositoryError when delete fails', async () => {
      mockExecute.mockRejectedValue(new Error('Database error'));

      await expect(repository.delete('test-id')).rejects.toThrow(RepositoryError);
    });
  });

  describe('count', () => {
    it('should count entities without filters', async () => {
      mockQuery.mockResolvedValue([{ count: 5 }]);

      const result = await repository.count();

      expect(result).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_entities',
        []
      );
    });

    it('should count entities with filters', async () => {
      mockQuery.mockResolvedValue([{ count: 3 }]);

      const result = await repository.count({
        isActive: true
      });

      expect(result).toBe(3);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = $1'),
        [true]
      );
    });

    it('should return 0 when no count result', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.count();

      expect(result).toBe(0);
    });
  });

  describe('field mapping', () => {
    it('should map camelCase to snake_case correctly', async () => {
      mockQuery.mockResolvedValue([]);

      await repository.findAll({
        filters: {
          createdAt: new Date()
        }
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('created_at'),
        expect.any(Array)
      );
    });

    it('should use custom field mappings', async () => {
      mockQuery.mockResolvedValue([]);

      await repository.findAll({
        filters: {
          isActive: true
        }
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active'),
        [true]
      );
    });
  });
});