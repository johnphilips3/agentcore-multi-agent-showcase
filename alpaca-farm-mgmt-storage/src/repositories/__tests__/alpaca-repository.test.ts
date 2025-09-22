import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AlpacaRepositoryImpl, LineageTree } from '../alpaca-repository';
import { Alpaca, Gender } from '../../models';
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

describe('AlpacaRepositoryImpl', () => {
  let repository: AlpacaRepositoryImpl;
  let mockQuery: any;

  const mockAlpacaRow = {
    id: 'alpaca-1',
    name: 'Fluffy',
    registration_number: 'REG123',
    birth_date: '2020-01-01T00:00:00.000Z',
    gender: 'female',
    color: 'white',
    weight: 150,
    height: 90,
    fiber_micron_count: 20,
    fiber_staple_length: 4,
    fiber_crimp: 'high',
    fiber_density: 'dense',
    sire_id: 'sire-1',
    dam_id: 'dam-1',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z'
  };

  const mockAlpaca: Alpaca = {
    id: 'alpaca-1',
    name: 'Fluffy',
    registrationNumber: 'REG123',
    birthDate: new Date('2020-01-01T00:00:00.000Z'),
    gender: 'female' as Gender,
    color: 'white',
    weight: 150,
    height: 90,
    fiberQuality: {
      micronCount: 20,
      stapleLength: 4,
      crimp: 'high',
      density: 'dense'
    },
    sireId: 'sire-1',
    damId: 'dam-1',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z')
  };

  beforeEach(() => {
    repository = new AlpacaRepositoryImpl();
    mockQuery = vi.mocked(mockConnection.query);
    mockQuery.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mapRowToEntity', () => {
    it('should map database row to alpaca entity correctly', async () => {
      mockQuery.mockResolvedValue([mockAlpacaRow]);

      const result = await repository.findById('alpaca-1');

      expect(result).toEqual(mockAlpaca);
    });

    it('should handle missing fiber quality fields', async () => {
      const rowWithoutFiber = {
        ...mockAlpacaRow,
        fiber_micron_count: null,
        fiber_staple_length: null,
        fiber_crimp: null,
        fiber_density: null
      };

      mockQuery.mockResolvedValue([rowWithoutFiber]);

      const result = await repository.findById('alpaca-1');

      expect(result?.fiberQuality).toBeUndefined();
    });

    it('should handle partial fiber quality fields', async () => {
      const rowWithPartialFiber = {
        ...mockAlpacaRow,
        fiber_micron_count: 20,
        fiber_staple_length: null,
        fiber_crimp: null,
        fiber_density: null
      };

      mockQuery.mockResolvedValue([rowWithPartialFiber]);

      const result = await repository.findById('alpaca-1');

      expect(result?.fiberQuality).toEqual({
        micronCount: 20,
        stapleLength: null,
        crimp: null,
        density: null
      });
    });
  });

  describe('findByRegistrationNumber', () => {
    it('should find alpaca by registration number', async () => {
      mockQuery.mockResolvedValue([mockAlpacaRow]);

      const result = await repository.findByRegistrationNumber('REG123');

      expect(result).toEqual(mockAlpaca);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM alpacas WHERE registration_number = $1',
        ['REG123']
      );
    });

    it('should return null when alpaca not found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findByRegistrationNumber('NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByRegistrationNumber('REG123'))
        .rejects.toThrow('Failed to find alpaca by registration number');
    });
  });

  describe('findByParent', () => {
    it('should find offspring by parent id', async () => {
      const offspring1 = { ...mockAlpacaRow, id: 'offspring-1', name: 'Child 1' };
      const offspring2 = { ...mockAlpacaRow, id: 'offspring-2', name: 'Child 2' };
      
      mockQuery.mockResolvedValue([offspring1, offspring2]);

      const result = await repository.findByParent('parent-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Child 1');
      expect(result[1].name).toBe('Child 2');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM alpacas WHERE sire_id = $1 OR dam_id = $1 ORDER BY birth_date',
        ['parent-1']
      );
    });

    it('should return empty array when no offspring found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findByParent('parent-1');

      expect(result).toEqual([]);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByParent('parent-1'))
        .rejects.toThrow('Failed to find alpacas by parent');
    });
  });

  describe('findByGender', () => {
    it('should find alpacas by gender', async () => {
      const female1 = { ...mockAlpacaRow, id: 'female-1', name: 'Female 1' };
      const female2 = { ...mockAlpacaRow, id: 'female-2', name: 'Female 2' };
      
      mockQuery.mockResolvedValue([female1, female2]);

      const result = await repository.findByGender('female');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Female 1');
      expect(result[1].name).toBe('Female 2');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM alpacas WHERE gender = $1 ORDER BY name',
        ['female']
      );
    });

    it('should return empty array when no alpacas found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.findByGender('male');

      expect(result).toEqual([]);
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByGender('female'))
        .rejects.toThrow('Failed to find alpacas by gender');
    });
  });

  describe('getLineage', () => {
    it('should return null when alpaca not found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await repository.getLineage('nonexistent', 2);

      expect(result).toBeNull();
    });

    it('should build lineage tree with parents and offspring', async () => {
      const sireRow = { ...mockAlpacaRow, id: 'sire-1', name: 'Sire', gender: 'male' };
      const damRow = { ...mockAlpacaRow, id: 'dam-1', name: 'Dam', gender: 'female' };
      const offspringRow = { ...mockAlpacaRow, id: 'offspring-1', name: 'Offspring' };

      // Mock the sequence of calls
      mockQuery
        .mockResolvedValueOnce([mockAlpacaRow]) // findById for root alpaca
        .mockResolvedValueOnce([sireRow]) // findById for sire
        .mockResolvedValueOnce([damRow]) // findById for dam
        .mockResolvedValueOnce([offspringRow]); // findByParent for offspring

      const result = await repository.getLineage('alpaca-1', 1);

      expect(result).toBeDefined();
      expect(result?.alpaca.name).toBe('Fluffy');
      expect(result?.sire?.alpaca.name).toBe('Sire');
      expect(result?.dam?.alpaca.name).toBe('Dam');
      expect(result?.offspring).toHaveLength(1);
      expect(result?.offspring?.[0].alpaca.name).toBe('Offspring');
    });

    it('should respect generation limits', async () => {
      const grandSireRow = { ...mockAlpacaRow, id: 'grandsire-1', name: 'GrandSire', gender: 'male' };
      const sireRow = { ...mockAlpacaRow, id: 'sire-1', name: 'Sire', gender: 'male', sire_id: 'grandsire-1' };

      mockQuery
        .mockResolvedValueOnce([mockAlpacaRow]) // findById for root alpaca
        .mockResolvedValueOnce([sireRow]) // findById for sire
        .mockResolvedValueOnce([]) // findById for dam (not found)
        .mockResolvedValueOnce([]); // findByParent for offspring

      const result = await repository.getLineage('alpaca-1', 1);

      expect(result?.sire?.alpaca.name).toBe('Sire');
      // Should not have grandsire due to generation limit
      expect(result?.sire?.sire).toBeUndefined();
    });

    it('should handle missing parents gracefully', async () => {
      const alpacaWithoutParents = {
        ...mockAlpacaRow,
        sire_id: null,
        dam_id: null
      };

      mockQuery
        .mockResolvedValueOnce([alpacaWithoutParents]) // findById for root alpaca
        .mockResolvedValueOnce([]); // findByParent for offspring

      const result = await repository.getLineage('alpaca-1', 2);

      expect(result?.alpaca.name).toBe('Fluffy');
      expect(result?.sire).toBeUndefined();
      expect(result?.dam).toBeUndefined();
    });

    it('should throw RepositoryError on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.getLineage('alpaca-1', 2))
        .rejects.toThrow('Failed to get lineage for alpaca');
    });
  });

  describe('mapEntityToRow', () => {
    it('should map entity to database row correctly', async () => {
      const createData = {
        name: 'New Alpaca',
        registrationNumber: 'REG456',
        birthDate: new Date('2021-01-01'),
        gender: 'male' as Gender,
        color: 'brown',
        weight: 160,
        height: 95,
        fiberQuality: {
          micronCount: 18,
          stapleLength: 5,
          crimp: 'medium',
          density: 'medium'
        },
        sireId: 'sire-2',
        damId: 'dam-2'
      };

      const mockResult = [{
        id: 'new-alpaca-id',
        name: 'New Alpaca',
        registration_number: 'REG456',
        birth_date: '2021-01-01T00:00:00.000Z',
        gender: 'male',
        color: 'brown',
        weight: 160,
        height: 95,
        fiber_micron_count: 18,
        fiber_staple_length: 5,
        fiber_crimp: 'medium',
        fiber_density: 'medium',
        sire_id: 'sire-2',
        dam_id: 'dam-2',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }];

      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.create(createData);

      expect(result.name).toBe('New Alpaca');
      expect(result.registrationNumber).toBe('REG456');
      expect(result.fiberQuality?.micronCount).toBe(18);
      
      // Verify the SQL call includes the mapped fields
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alpacas'),
        expect.arrayContaining(['New Alpaca', 'REG456', 'male', 'brown'])
      );
    });

    it('should handle undefined fiber quality', async () => {
      const createData = {
        name: 'Simple Alpaca',
        birthDate: new Date('2021-01-01'),
        gender: 'female' as Gender,
        color: 'black'
      };

      const mockResult = [{
        id: 'simple-alpaca-id',
        name: 'Simple Alpaca',
        registration_number: null,
        birth_date: '2021-01-01T00:00:00.000Z',
        gender: 'female',
        color: 'black',
        weight: null,
        height: null,
        fiber_micron_count: null,
        fiber_staple_length: null,
        fiber_crimp: null,
        fiber_density: null,
        sire_id: null,
        dam_id: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      }];

      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.create(createData);

      expect(result.name).toBe('Simple Alpaca');
      expect(result.fiberQuality).toBeUndefined();
    });
  });
});