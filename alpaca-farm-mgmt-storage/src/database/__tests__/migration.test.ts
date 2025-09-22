import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MigrationRunner, MigrationError, MigrationStatus } from '../migration';
import { DatabaseConnection } from '../connection';
import { Migration } from '../schema';

// Mock external dependencies
vi.mock('../schema', async () => {
  const actual = await vi.importActual('../schema') as any;
  return {
    ...actual,
    migrations: [
      {
        version: 1,
        name: 'create_alpacas_table',
        up: ['CREATE TABLE alpacas (id TEXT PRIMARY KEY)'],
        down: ['DROP TABLE alpacas']
      },
      {
        version: 2,
        name: 'create_health_records_table',
        up: ['CREATE TABLE health_records (id TEXT PRIMARY KEY, alpaca_id TEXT)'],
        down: ['DROP TABLE health_records']
      },
      {
        version: 3,
        name: 'create_breeding_records_table',
        up: ['CREATE TABLE breeding_records (id TEXT PRIMARY KEY)'],
        down: ['DROP TABLE breeding_records']
      }
    ],
    getLatestMigrationVersion: vi.fn().mockReturnValue(3),
    getMigrationByVersion: vi.fn(),
    getMigrationsUpTo: vi.fn(),
    getMigrationsFromTo: vi.fn()
  };
});

describe('MigrationRunner', () => {
  let mockConnection: DatabaseConnection;
  let migrationRunner: MigrationRunner;
  let mockMigrations: Migration[];

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock database connection
    mockConnection = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true)
    };

    // Setup mock migrations
    mockMigrations = [
      {
        version: 1,
        name: 'create_alpacas_table',
        up: ['CREATE TABLE alpacas (id TEXT PRIMARY KEY)'],
        down: ['DROP TABLE alpacas']
      },
      {
        version: 2,
        name: 'create_health_records_table',
        up: ['CREATE TABLE health_records (id TEXT PRIMARY KEY, alpaca_id TEXT)'],
        down: ['DROP TABLE health_records']
      },
      {
        version: 3,
        name: 'create_breeding_records_table',
        up: ['CREATE TABLE breeding_records (id TEXT PRIMARY KEY)'],
        down: ['DROP TABLE breeding_records']
      }
    ];

    // Mock schema functions
    const schema = await import('../schema');
    vi.mocked(schema.getMigrationByVersion).mockImplementation((version: number) => 
      mockMigrations.find(m => m.version === version)
    );
    vi.mocked(schema.getMigrationsUpTo).mockImplementation((version: number) => 
      mockMigrations.filter(m => m.version <= version)
    );
    vi.mocked(schema.getMigrationsFromTo).mockImplementation((from: number, to: number) => 
      mockMigrations.filter(m => m.version > to && m.version <= from).reverse()
    );

    migrationRunner = new MigrationRunner(mockConnection);
  });

  describe('getCurrentVersion', () => {
    it('should return 0 for fresh database', async () => {
      // Mock table doesn't exist error
      const tableError = new Error('no such table: schema_migrations');
      mockConnection.query.mockRejectedValueOnce(tableError);

      const version = await migrationRunner.getCurrentVersion();
      expect(version).toBe(0);
    });

    it('should return correct version after migrations', async () => {
      mockConnection.query.mockResolvedValueOnce([{ version: 2 }]);

      const version = await migrationRunner.getCurrentVersion();
      expect(version).toBe(2);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT MAX(version) as version FROM schema_migrations')
      );
    });

    it('should return 0 when no migrations applied', async () => {
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);

      const version = await migrationRunner.getCurrentVersion();
      expect(version).toBe(0);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockConnection.query.mockRejectedValue(dbError);

      await expect(migrationRunner.getCurrentVersion()).rejects.toThrow(MigrationError);
      await expect(migrationRunner.getCurrentVersion()).rejects.toThrow('Failed to get current version: Database connection failed');
    });

    it('should handle PostgreSQL table not exists error', async () => {
      const pgError = new Error('relation "schema_migrations" does not exist');
      mockConnection.query.mockRejectedValueOnce(pgError);

      const version = await migrationRunner.getCurrentVersion();
      expect(version).toBe(0);
    });
  });

  describe('getAppliedMigrations', () => {
    it('should return empty array for fresh database', async () => {
      // Mock getCurrentVersion to return 0
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);

      const applied = await migrationRunner.getAppliedMigrations();
      expect(applied).toEqual([]);
    });

    it('should return applied migrations', async () => {
      // Mock getCurrentVersion to return 2
      mockConnection.query
        .mockResolvedValueOnce([{ version: 2 }]) // getCurrentVersion call
        .mockResolvedValueOnce([
          { version: 1, name: 'create_alpacas_table', appliedAt: '2023-01-01T00:00:00.000Z' },
          { version: 2, name: 'create_health_records_table', appliedAt: '2023-01-02T00:00:00.000Z' }
        ]);

      const applied = await migrationRunner.getAppliedMigrations();
      
      expect(applied).toHaveLength(2);
      expect(applied[0].version).toBe(1);
      expect(applied[0].name).toBe('create_alpacas_table');
      expect(applied[0].appliedAt).toBeInstanceOf(Date);
      expect(applied[1].version).toBe(2);
      expect(applied[1].name).toBe('create_health_records_table');
      expect(applied[1].appliedAt).toBeInstanceOf(Date);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Query failed');
      mockConnection.query.mockRejectedValue(dbError);

      await expect(migrationRunner.getAppliedMigrations()).rejects.toThrow(MigrationError);
      await expect(migrationRunner.getAppliedMigrations()).rejects.toThrow('Failed to get applied migrations');
    });

    it('should properly convert date strings to Date objects', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ version: 1 }])
        .mockResolvedValueOnce([
          { version: 1, name: 'test_migration', appliedAt: '2023-06-15T10:30:00.000Z' }
        ]);

      const applied = await migrationRunner.getAppliedMigrations();
      
      expect(applied[0].appliedAt).toBeInstanceOf(Date);
      expect(applied[0].appliedAt.toISOString()).toBe('2023-06-15T10:30:00.000Z');
    });
  });

  describe('getPendingMigrations', () => {
    it('should return all migrations for fresh database', async () => {
      // Mock getCurrentVersion to return 0
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);

      const pending = await migrationRunner.getPendingMigrations();
      
      expect(pending).toHaveLength(3);
      expect(pending[0].version).toBe(1);
      expect(pending[1].version).toBe(2);
      expect(pending[2].version).toBe(3);
    });

    it('should return only pending migrations', async () => {
      // Mock getCurrentVersion to return 1
      mockConnection.query.mockResolvedValueOnce([{ version: 1 }]);

      const pending = await migrationRunner.getPendingMigrations();
      
      expect(pending).toHaveLength(2);
      expect(pending[0].version).toBe(2);
      expect(pending[1].version).toBe(3);
    });

    it('should return empty array when all migrations applied', async () => {
      // Mock getCurrentVersion to return 3 (latest)
      mockConnection.query.mockResolvedValueOnce([{ version: 3 }]);

      const pending = await migrationRunner.getPendingMigrations();
      
      expect(pending).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockConnection.query.mockRejectedValue(dbError);

      await expect(migrationRunner.getPendingMigrations()).rejects.toThrow(MigrationError);
      await expect(migrationRunner.getPendingMigrations()).rejects.toThrow('Failed to get pending migrations: Database error');
    });

    it('should sort pending migrations by version', async () => {
      // Mock getCurrentVersion to return 0
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);

      const pending = await migrationRunner.getPendingMigrations();
      
      expect(pending).toHaveLength(3);
      for (let i = 1; i < pending.length; i++) {
        expect(pending[i].version).toBeGreaterThan(pending[i - 1].version);
      }
    });
  });

  describe('migrate', () => {
    it('should run all pending migrations', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock getCurrentVersion to return 0 (fresh database)
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);
      mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      await migrationRunner.migrate();

      // Should execute all migration statements
      expect(mockConnection.execute).toHaveBeenCalledWith('CREATE TABLE alpacas (id TEXT PRIMARY KEY)');
      expect(mockConnection.execute).toHaveBeenCalledWith('CREATE TABLE health_records (id TEXT PRIMARY KEY, alpaca_id TEXT)');
      expect(mockConnection.execute).toHaveBeenCalledWith('CREATE TABLE breeding_records (id TEXT PRIMARY KEY)');
      
      // Should record migrations
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO schema_migrations'),
        expect.arrayContaining([1, 'create_alpacas_table'])
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle no pending migrations', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock getCurrentVersion to return 3 (all migrations applied)
      mockConnection.query.mockResolvedValueOnce([{ version: 3 }]);

      await migrationRunner.migrate();

      expect(consoleSpy).toHaveBeenCalledWith('No pending migrations to run');
      expect(mockConnection.execute).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle migration execution errors', async () => {
      // Mock getCurrentVersion to return 0
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);
      
      const executionError = new Error('SQL execution failed');
      mockConnection.execute.mockRejectedValue(executionError);

      await expect(migrationRunner.migrate()).rejects.toThrow(MigrationError);
      await expect(migrationRunner.migrate()).rejects.toThrow('Migration failed: SQL execution failed');
    });

    it('should log migration progress', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);
      mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      await migrationRunner.migrate();

      expect(consoleSpy).toHaveBeenCalledWith('Running 3 pending migrations...');
      expect(consoleSpy).toHaveBeenCalledWith('All migrations completed successfully');
      
      consoleSpy.mockRestore();
    });

    it('should ensure migration table exists before recording', async () => {
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);
      mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      await migrationRunner.migrate();

      // Should create migration table
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
      );
    });
  });

  describe('migrateTo', () => {
    it('should migrate up to specific version', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock getCurrentVersion to return 0
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);
      mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const { getMigrationsUpTo } = require('../schema');
      getMigrationsUpTo.mockReturnValue(mockMigrations.slice(0, 2)); // First 2 migrations

      await migrationRunner.migrateTo(2);

      expect(consoleSpy).toHaveBeenCalledWith('Migrating up from version 0 to 2...');
      expect(mockConnection.execute).toHaveBeenCalledWith('CREATE TABLE alpacas (id TEXT PRIMARY KEY)');
      expect(mockConnection.execute).toHaveBeenCalledWith('CREATE TABLE health_records (id TEXT PRIMARY KEY, alpaca_id TEXT)');
      
      consoleSpy.mockRestore();
    });

    it('should handle migrating to current version', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock getCurrentVersion to return 2
      mockConnection.query.mockResolvedValueOnce([{ version: 2 }]);

      await migrationRunner.migrateTo(2);

      expect(consoleSpy).toHaveBeenCalledWith('Already at version 2');
      expect(mockConnection.execute).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should rollback to lower version', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock getCurrentVersion to return 3
      mockConnection.query.mockResolvedValueOnce([{ version: 3 }]);
      mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const { getMigrationsFromTo } = require('../schema');
      getMigrationsFromTo.mockReturnValue([mockMigrations[2]]); // Migration 3 to rollback

      await migrationRunner.migrateTo(2);

      expect(consoleSpy).toHaveBeenCalledWith('Rolling back from version 3 to 2...');
      expect(mockConnection.execute).toHaveBeenCalledWith('DROP TABLE breeding_records');
      
      consoleSpy.mockRestore();
    });

    it('should handle migration errors', async () => {
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);
      
      const migrationError = new Error('Migration failed');
      mockConnection.execute.mockRejectedValue(migrationError);

      await expect(migrationRunner.migrateTo(1)).rejects.toThrow(MigrationError);
      await expect(migrationRunner.migrateTo(1)).rejects.toThrow('Migration to version 1 failed: Migration failed');
    });

    it('should log completion message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);
      mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const { getMigrationsUpTo } = require('../schema');
      getMigrationsUpTo.mockReturnValue([mockMigrations[0]]);

      await migrationRunner.migrateTo(1);

      expect(consoleSpy).toHaveBeenCalledWith('Migration to version 1 completed successfully');
      
      consoleSpy.mockRestore();
    });
  });

  describe('rollback', () => {
    it('should rollback last migration', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock getCurrentVersion to return 2
      mockConnection.query.mockResolvedValueOnce([{ version: 2 }]);
      mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const { getMigrationByVersion } = require('../schema');
      getMigrationByVersion.mockReturnValue(mockMigrations[1]); // Migration version 2

      await migrationRunner.rollback();

      expect(consoleSpy).toHaveBeenCalledWith('Rolling back migration: create_health_records_table (version 2)');
      expect(mockConnection.execute).toHaveBeenCalledWith('DROP TABLE health_records');
      
      consoleSpy.mockRestore();
    });

    it('should handle no migrations to rollback', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock getCurrentVersion to return 0
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);

      await migrationRunner.rollback();

      expect(consoleSpy).toHaveBeenCalledWith('No migrations to rollback');
      expect(mockConnection.execute).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle missing migration', async () => {
      // Mock getCurrentVersion to return 5 (non-existent migration)
      mockConnection.query.mockResolvedValueOnce([{ version: 5 }]);

      const { getMigrationByVersion } = require('../schema');
      getMigrationByVersion.mockReturnValue(null);

      await expect(migrationRunner.rollback()).rejects.toThrow(MigrationError);
      await expect(migrationRunner.rollback()).rejects.toThrow('Migration version 5 not found');
    });

    it('should handle rollback errors', async () => {
      mockConnection.query.mockResolvedValueOnce([{ version: 1 }]);
      
      const rollbackError = new Error('Rollback failed');
      mockConnection.execute.mockRejectedValue(rollbackError);

      const { getMigrationByVersion } = require('../schema');
      getMigrationByVersion.mockReturnValue(mockMigrations[0]);

      await expect(migrationRunner.rollback()).rejects.toThrow(MigrationError);
      await expect(migrationRunner.rollback()).rejects.toThrow('Rollback failed: Rollback failed');
    });

    it('should log completion message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockConnection.query.mockResolvedValueOnce([{ version: 1 }]);
      mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const { getMigrationByVersion } = require('../schema');
      getMigrationByVersion.mockReturnValue(mockMigrations[0]);

      await migrationRunner.rollback();

      expect(consoleSpy).toHaveBeenCalledWith('Rollback completed successfully');
      
      consoleSpy.mockRestore();
    });
  });

  describe('reset', () => {
    it('should reset database to initial state', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock getCurrentVersion to return 3
      mockConnection.query.mockResolvedValueOnce([{ version: 3 }]);
      mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      // Mock migrateTo method
      const migrateToSpy = vi.spyOn(migrationRunner, 'migrateTo').mockResolvedValue();

      await migrationRunner.reset();

      expect(migrateToSpy).toHaveBeenCalledWith(0);
      expect(consoleSpy).toHaveBeenCalledWith('Database reset completed successfully');
      
      migrateToSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should handle already reset database', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock getCurrentVersion to return 0
      mockConnection.query.mockResolvedValueOnce([{ version: null }]);

      await migrationRunner.reset();

      expect(consoleSpy).toHaveBeenCalledWith('Database is already at initial state');
      
      consoleSpy.mockRestore();
    });

    it('should handle reset errors', async () => {
      mockConnection.query.mockResolvedValueOnce([{ version: 2 }]);
      
      const resetError = new Error('Reset failed');
      const migrateToSpy = vi.spyOn(migrationRunner, 'migrateTo').mockRejectedValue(resetError);

      await expect(migrationRunner.reset()).rejects.toThrow(MigrationError);
      await expect(migrationRunner.reset()).rejects.toThrow('Database reset failed: Reset failed');
      
      migrateToSpy.mockRestore();
    });
  });

  describe('validateMigrations', () => {
    it('should validate migration integrity successfully', async () => {
      const result = await migrationRunner.validateMigrations();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect duplicate migration versions', async () => {
      // Mock migrations with duplicate versions
      const { migrations } = require('../schema');
      migrations.push({
        version: 2, // Duplicate version
        name: 'duplicate_migration',
        up: ['CREATE TABLE duplicate (id TEXT)'],
        down: ['DROP TABLE duplicate']
      });

      const result = await migrationRunner.validateMigrations();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate migration versions found: 2');
    });

    it('should detect gaps in migration versions', async () => {
      // Mock migrations with gap (missing version 2)
      const { migrations } = require('../schema');
      migrations.splice(1, 1); // Remove version 2
      migrations.push({
        version: 4, // Creates gap between 1 and 4
        name: 'gap_migration',
        up: ['CREATE TABLE gap (id TEXT)'],
        down: ['DROP TABLE gap']
      });

      const result = await migrationRunner.validateMigrations();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Gap in migration versions between 1 and 3');
    });

    it('should detect migrations without up statements', async () => {
      // Mock migration without up statements
      const { migrations } = require('../schema');
      migrations[0].up = [];

      const result = await migrationRunner.validateMigrations();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Migration create_alpacas_table (version 1) has no up statements');
    });

    it('should detect migrations without down statements', async () => {
      // Mock migration without down statements
      const { migrations } = require('../schema');
      migrations[1].down = [];

      const result = await migrationRunner.validateMigrations();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Migration create_health_records_table (version 2) has no down statements');
    });

    it('should handle validation errors', async () => {
      // Mock an error during validation
      const { migrations } = require('../schema');
      Object.defineProperty(migrations, 'length', {
        get() { throw new Error('Validation error'); }
      });

      const result = await migrationRunner.validateMigrations();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Validation failed: Validation error');
    });

    it('should detect multiple validation issues', async () => {
      // Mock multiple issues
      const { migrations } = require('../schema');
      migrations[0].up = []; // Missing up statements
      migrations[1].down = []; // Missing down statements
      migrations.push({
        version: 1, // Duplicate version
        name: 'duplicate',
        up: ['CREATE TABLE dup (id TEXT)'],
        down: ['DROP TABLE dup']
      });

      const result = await migrationRunner.validateMigrations();
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('private methods', () => {
    describe('recordMigration', () => {
      it('should record migration in schema_migrations table', async () => {
        mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        const migration = mockMigrations[0];
        await (migrationRunner as any).recordMigration(migration);

        // Should ensure migration table exists
        expect(mockConnection.execute).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
        );

        // Should insert migration record
        expect(mockConnection.execute).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO schema_migrations'),
          expect.arrayContaining([1, 'create_alpacas_table'])
        );
      });
    });

    describe('removeMigrationRecord', () => {
      it('should remove migration record', async () => {
        mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        await (migrationRunner as any).removeMigrationRecord(2);

        expect(mockConnection.execute).toHaveBeenCalledWith(
          'DELETE FROM schema_migrations WHERE version = ?',
          [2]
        );
      });
    });

    describe('ensureMigrationTableExists', () => {
      it('should create migration table if not exists', async () => {
        mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        await (migrationRunner as any).ensureMigrationTableExists();

        expect(mockConnection.execute).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
        );
      });

      it('should handle table creation errors', async () => {
        const tableError = new Error('Table creation failed');
        mockConnection.execute.mockRejectedValue(tableError);

        await expect((migrationRunner as any).ensureMigrationTableExists()).rejects.toThrow(MigrationError);
        await expect((migrationRunner as any).ensureMigrationTableExists()).rejects.toThrow('Failed to create migration table: Table creation failed');
      });
    });

    describe('runMigration', () => {
      it('should run migration up', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        const migration = mockMigrations[0];
        await (migrationRunner as any).runMigration(migration, 'up');

        expect(consoleSpy).toHaveBeenCalledWith('Applying migration: create_alpacas_table (version 1)');
        expect(mockConnection.execute).toHaveBeenCalledWith('CREATE TABLE alpacas (id TEXT PRIMARY KEY)');
        
        consoleSpy.mockRestore();
      });

      it('should run migration down', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        mockConnection.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        const migration = mockMigrations[0];
        await (migrationRunner as any).runMigration(migration, 'down');

        expect(consoleSpy).toHaveBeenCalledWith('Rolling back migration: create_alpacas_table (version 1)');
        expect(mockConnection.execute).toHaveBeenCalledWith('DROP TABLE alpacas');
        
        consoleSpy.mockRestore();
      });

      it('should handle migration execution errors', async () => {
        const executionError = new Error('SQL execution failed');
        mockConnection.execute.mockRejectedValue(executionError);

        const migration = mockMigrations[0];
        await expect((migrationRunner as any).runMigration(migration, 'up')).rejects.toThrow(MigrationError);
        await expect((migrationRunner as any).runMigration(migration, 'up')).rejects.toThrow('Failed to run migration create_alpacas_table (up): SQL execution failed');
      });
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      const connectionError = new Error('Connection lost');
      mockConnection.query.mockRejectedValue(connectionError);
      
      await expect(migrationRunner.getCurrentVersion()).rejects.toThrow(MigrationError);
      await expect(migrationRunner.getCurrentVersion()).rejects.toThrow('Failed to get current version: Connection lost');
    });

    it('should handle invalid SQL in migrations', async () => {
      const sqlError = new Error('SQL syntax error');
      mockConnection.execute.mockRejectedValue(sqlError);

      await expect(migrationRunner.migrate()).rejects.toThrow(MigrationError);
    });

    it('should wrap unknown errors properly', async () => {
      const unknownError = 'String error';
      mockConnection.query.mockRejectedValue(unknownError);

      await expect(migrationRunner.getCurrentVersion()).rejects.toThrow(MigrationError);
      await expect(migrationRunner.getCurrentVersion()).rejects.toThrow('Failed to get current version: Unknown error');
    });
  });
});