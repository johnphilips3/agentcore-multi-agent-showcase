/**
 * Unit tests for PostgreSQLAlpacaRepository
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PostgreSQLAlpacaRepository, QueryOptions, PaginatedResult } from '../pg-alpaca-repository';
import { Alpaca, CreateAlpacaInput, UpdateAlpacaInput } from '../../models/alpaca';
import { PostgreSQLConnection } from '../../database/pg-connection';
import { AlpacaFactory } from '../../__tests__/data-factories';
import { MockUtils, TestEnvironment } from '../../__tests__/test-utils';

// Mock PostgreSQL connection
const mockConnection: PostgreSQLConnection = {
  query: vi.fn(),
  getClient: vi.fn(),
  close: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true)
};

describe('PostgreSQLAlpacaRepository', () => {
  let repository: PostgreSQLAlpacaRepository;
  let mockQuery: any;

  const mockAlpacaRow = {
    id: 'test-alpaca-1',
    name: 'Test Alpaca',
    registration_number: 'REG001',
    birth_date: '2020-01-01T00:00:00.000Z',
    gender: 'female',
    color: 'white',
    weight: 150,
    height: 90,
    fiber_micron_count: 20,
    fiber_staple_length: 4,
    fiber_crimp: 'fine',
    fiber_density: 'high',
    sire_id: 'sire-1',
    dam_id: 'dam-1',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  };

  const mockAlpaca: Alpaca = AlpacaFactory.create({
    id: 'test-alpaca-1',
    name: 'Test Alpaca',
    registrationNumber: 'REG001',
    birthDate: new Date('2020-01-01T00:00:00.000Z'),
    gender: 'female',
    color: 'white',
    weight: 150,
    height: 90,
    fiberQuality: {
      micronCount: 20,
      stapleLength: 4,
      crimp: 'fine',
      density: 'high'
    },
    sireId: 'sire-1',
    damId: 'dam-1',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z')
  });

  beforeEach(() => {
    TestEnvironment.setupTestEnv();
    repository = new PostgreSQLAlpacaRepository(mockConnection);
    mockQuery = vi.mocked(mockConnection.query);
    MockUtils.clearAllMocks();
  });

  afterEach(() => {
    TestEnvironment.cleanupTestEnv();
    MockUtils.restoreAllMocks();
  });

  describe('create', () => {
    it('should create alpaca with all fields', async () => {
      const createInput: CreateAlpacaInput = AlpacaFactory.createInput();
      mockQuery.mockResolvedValue({ rows: [mockAlpacaRow] });

      const result = await repository.create(createInput);

      expect(result).toEqual(mockAlpaca);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alpacas'),
        expect.arrayContaining([
          createInput.name,
          createInput.registrationNumber,
          createInput.birthDate,
          createInput.gender,
          createInput.color,
          createInput.weight,
          createInput.height,
          createInput.fiberQuality?.micronCount,
          createInput.fiberQuality?.stapleLength,
          createInput.fiberQuality?.crimp,
          createInput.fiberQuality?.density,
          createInput.sireId,
          createInput.damId
        ])
      );
    });

    it('should create alpaca with minimal fields', async () => {
      const minimalInput: CreateAlpacaInput = {
        name: 'Minimal Alpaca',
        birthDate: new Date('2021-01-01'),
        gender: 'male',
        color: 'brown'
      };
      
      const minimalRow = {
        ...mockAlpacaRow,
        name: 'Minimal Alpaca',
        registration_number: null,
        weight: null,
        height: null,
        fiber_micron_count: null,
        fiber_staple_length: null,
        fiber_crimp: null,
        fiber_density: null,
        sire_id: null,
        dam_id: null
      };

      mockQuery.mockResolvedValue({ rows: [minimalRow] });

      const result = await repository.create(minimalInput);

      expect(result.name).toBe('Minimal Alpaca');
      expect(result.registrationNumber).toBeUndefined();
      expect(result.weight).toBeUndefined();
      expect(result.fiberQuality).toEqual({
        micronCount: undefined,
        stapleLength: undefined,
        crimp: undefined,
        density: undefined
      });
    });

    it('should handle database errors during creation', async () => {
      const createInput = AlpacaFactory.createInput();
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.create(createInput)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findById', () => {
    it('should find alpaca by id', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAlpacaRow] });

      const result = await repository.findById('test-alpaca-1');

      expect(result).toEqual(mockAlpaca);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM alpacas WHERE id = $1',
        ['test-alpaca-1']
      );
    });

    it('should return null when alpaca not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findById('test-alpaca-1')).rejects.toThrow('Database connection failed');
    });

    it('should map row to alpaca entity correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAlpacaRow] });

      const result = await repository.findById('test-alpaca-1');

      expect(result?.id).toBe('test-alpaca-1');
      expect(result?.name).toBe('Test Alpaca');
      expect(result?.registrationNumber).toBe('REG001');
      expect(result?.birthDate).toEqual(new Date('2020-01-01T00:00:00.000Z'));
      expect(result?.gender).toBe('female');
      expect(result?.color).toBe('white');
      expect(result?.weight).toBe(150);
      expect(result?.height).toBe(90);
      expect(result?.fiberQuality).toEqual({
        micronCount: 20,
        stapleLength: 4,
        crimp: 'fine',
        density: 'high'
      });
      expect(result?.sireId).toBe('sire-1');
      expect(result?.damId).toBe('dam-1');
    });

    it('should handle missing fiber quality fields', async () => {
      const rowWithoutFiber = {
        ...mockAlpacaRow,
        fiber_micron_count: null,
        fiber_staple_length: null,
        fiber_crimp: null,
        fiber_density: null
      };

      mockQuery.mockResolvedValue({ rows: [rowWithoutFiber] });

      const result = await repository.findById('test-alpaca-1');

      expect(result?.fiberQuality).toEqual({
        micronCount: undefined,
        stapleLength: undefined,
        crimp: undefined,
        density: undefined
      });
    });
  });

  describe('findAll', () => {
    it('should find all alpacas with default pagination', async () => {
      const alpacaRows = [mockAlpacaRow, { ...mockAlpacaRow, id: 'alpaca-2', name: 'Alpaca 2' }];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
        .mockResolvedValueOnce({ rows: alpacaRows }); // data query

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
        .mockResolvedValueOnce({ rows: [mockAlpacaRow] });

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
      const options: QueryOptions = { sortBy: 'name', sortOrder: 'asc' };
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockAlpacaRow] });

      await repository.findAll(options);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY name ASC'),
        [20, 0]
      );
    });

    it('should use default sorting for invalid sort fields', async () => {
      const options: QueryOptions = { sortBy: 'invalid_field' };
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockAlpacaRow] });

      await repository.findAll(options);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [20, 0]
      );
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findAll()).rejects.toThrow('Database connection failed');
    });
  });

  describe('update', () => {
    it('should update alpaca with provided fields', async () => {
      const updateInput: UpdateAlpacaInput = {
        name: 'Updated Alpaca',
        weight: 160,
        height: 95
      };
      
      const updatedRow = { ...mockAlpacaRow, name: 'Updated Alpaca', weight: 160, height: 95 };
      mockQuery.mockResolvedValue({ rows: [updatedRow] });

      const result = await repository.update('test-alpaca-1', updateInput);

      expect(result?.name).toBe('Updated Alpaca');
      expect(result?.weight).toBe(160);
      expect(result?.height).toBe(95);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE alpacas SET'),
        expect.arrayContaining(['Updated Alpaca', 160, 95, 'test-alpaca-1'])
      );
    });

    it('should return existing record when no fields to update', async () => {
      const updateInput: UpdateAlpacaInput = {};
      
      mockQuery.mockResolvedValue({ rows: [mockAlpacaRow] });

      const result = await repository.update('test-alpaca-1', updateInput);

      expect(result).toEqual(mockAlpaca);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM alpacas WHERE id = $1',
        ['test-alpaca-1']
      );
    });

    it('should return null when alpaca not found', async () => {
      const updateInput: UpdateAlpacaInput = { name: 'Updated Name' };
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.update('nonexistent-id', updateInput);

      expect(result).toBeNull();
    });

    it('should handle fiber quality updates', async () => {
      const updateInput: UpdateAlpacaInput = {
        fiberQuality: {
          micronCount: 22,
          stapleLength: 5,
          crimp: 'medium',
          density: 'medium'
        }
      };
      
      const updatedRow = {
        ...mockAlpacaRow,
        fiber_micron_count: 22,
        fiber_staple_length: 5,
        fiber_crimp: 'medium',
        fiber_density: 'medium'
      };
      
      mockQuery.mockResolvedValue({ rows: [updatedRow] });

      const result = await repository.update('test-alpaca-1', updateInput);

      expect(result?.fiberQuality?.micronCount).toBe(22);
      expect(result?.fiberQuality?.stapleLength).toBe(5);
      expect(result?.fiberQuality?.crimp).toBe('medium');
      expect(result?.fiberQuality?.density).toBe('medium');
    });

    it('should handle database errors', async () => {
      const updateInput: UpdateAlpacaInput = { name: 'Updated Name' };
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.update('test-alpaca-1', updateInput)).rejects.toThrow('Database connection failed');
    });
  });

  describe('delete', () => {
    it('should delete alpaca successfully', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('test-alpaca-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM alpacas WHERE id = $1',
        ['test-alpaca-1']
      );
    });

    it('should return false when alpaca not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.delete('test-alpaca-1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('search', () => {
    it('should search alpacas by query string', async () => {
      const searchQuery = 'fluffy';
      const searchResults = [mockAlpacaRow, { ...mockAlpacaRow, id: 'alpaca-2', name: 'Fluffy Jr' }];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
        .mockResolvedValueOnce({ rows: searchResults }); // data query

      const result = await repository.search(searchQuery);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE LOWER(name) LIKE $1'),
        ['%fluffy%', 20, 0]
      );
    });

    it('should search by registration number', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockAlpacaRow] });

      await repository.search('REG001');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(registration_number) LIKE $1'),
        ['%reg001%', 20, 0]
      );
    });

    it('should handle empty search results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.search('nonexistent');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.search('test')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByGender', () => {
    it('should find alpacas by gender', async () => {
      const femaleAlpacas = [mockAlpacaRow, { ...mockAlpacaRow, id: 'female-2', name: 'Female 2' }];
      
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: femaleAlpacas });

      const result = await repository.findByGender('female');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM alpacas WHERE gender = $1',
        ['female']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE gender = $1'),
        ['female', 20, 0]
      );
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByGender('male');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findByGender('female')).rejects.toThrow('Database connection failed');
    });
  });

  describe('mapRowToAlpaca', () => {
    it('should map database row to alpaca entity correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAlpacaRow] });

      const result = await repository.findById('test-alpaca-1');

      expect(result).toEqual(mockAlpaca);
    });

    it('should handle null values correctly', async () => {
      const rowWithNulls = {
        ...mockAlpacaRow,
        registration_number: null,
        weight: null,
        height: null,
        fiber_micron_count: null,
        fiber_staple_length: null,
        fiber_crimp: null,
        fiber_density: null,
        sire_id: null,
        dam_id: null
      };

      mockQuery.mockResolvedValue({ rows: [rowWithNulls] });

      const result = await repository.findById('test-alpaca-1');

      expect(result?.registrationNumber).toBeUndefined();
      expect(result?.weight).toBeUndefined();
      expect(result?.height).toBeUndefined();
      expect(result?.sireId).toBeUndefined();
      expect(result?.damId).toBeUndefined();
      expect(result?.fiberQuality).toEqual({
        micronCount: undefined,
        stapleLength: undefined,
        crimp: undefined,
        density: undefined
      });
    });

    it('should parse numeric values correctly', async () => {
      const rowWithStrings = {
        ...mockAlpacaRow,
        weight: '150.5',
        height: '90.2',
        fiber_micron_count: '20.1',
        fiber_staple_length: '4.5'
      };

      mockQuery.mockResolvedValue({ rows: [rowWithStrings] });

      const result = await repository.findById('test-alpaca-1');

      expect(result?.weight).toBe(150.5);
      expect(result?.height).toBe(90.2);
      expect(result?.fiberQuality?.micronCount).toBe(20.1);
      expect(result?.fiberQuality?.stapleLength).toBe(4.5);
    });
  });

  describe('SQL parameter binding', () => {
    it('should properly bind parameters in create query', async () => {
      const createInput = AlpacaFactory.createInput({
        name: 'Test Alpaca',
        registrationNumber: 'TEST123',
        birthDate: new Date('2021-01-01'),
        gender: 'female',
        color: 'white',
        weight: 150,
        height: 90,
        fiberQuality: {
          micronCount: 20,
          stapleLength: 4,
          crimp: 'fine',
          density: 'high'
        },
        sireId: 'sire-1',
        damId: 'dam-1'
      });

      mockQuery.mockResolvedValue({ rows: [mockAlpacaRow] });

      await repository.create(createInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alpacas'),
        [
          'Test Alpaca',
          'TEST123',
          createInput.birthDate,
          'female',
          'white',
          150,
          90,
          20,
          4,
          'fine',
          'high',
          'sire-1',
          'dam-1'
        ]
      );
    });

    it('should handle null parameters in create query', async () => {
      const minimalInput: CreateAlpacaInput = {
        name: 'Minimal Alpaca',
        birthDate: new Date('2021-01-01'),
        gender: 'male',
        color: 'brown'
      };

      mockQuery.mockResolvedValue({ rows: [mockAlpacaRow] });

      await repository.create(minimalInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alpacas'),
        [
          'Minimal Alpaca',
          null, // registrationNumber
          minimalInput.birthDate,
          'male',
          'brown',
          null, // weight
          null, // height
          null, // fiber_micron_count
          null, // fiber_staple_length
          null, // fiber_crimp
          null, // fiber_density
          null, // sire_id
          null  // dam_id
        ]
      );
    });
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      const connectionError = new Error('Connection timeout');
      mockQuery.mockRejectedValue(connectionError);

      await expect(repository.findById('test-id')).rejects.toThrow('Connection timeout');
      await expect(repository.create(AlpacaFactory.createInput())).rejects.toThrow('Connection timeout');
      await expect(repository.update('test-id', {})).rejects.toThrow('Connection timeout');
      await expect(repository.delete('test-id')).rejects.toThrow('Connection timeout');
    });

    it('should handle SQL constraint violations', async () => {
      const constraintError = new Error('duplicate key value violates unique constraint');
      mockQuery.mockRejectedValue(constraintError);

      await expect(repository.create(AlpacaFactory.createInput())).rejects.toThrow('duplicate key value violates unique constraint');
    });

    it('should handle invalid SQL syntax errors', async () => {
      const syntaxError = new Error('syntax error at or near');
      mockQuery.mockRejectedValue(syntaxError);

      await expect(repository.findAll()).rejects.toThrow('syntax error at or near');
    });
  });
});