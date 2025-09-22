import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MigrationRunner, MigrationError } from '../migration';
import { SQLiteConnection, DatabaseConfig } from '../connection';
import { migrations, getLatestMigrationVersion } from '../schema';

describe('MigrationRunner', () => {
  let connection: SQLiteConnection;
  let migrationRunner: MigrationRunner;

  beforeEach(async () => {
    const config: DatabaseConfig = {
      type: 'sqlite',
      database: ':memory:'
    };
    connection = new SQLiteConnection(config);
    await connection.connect();
    migrationRunner = new MigrationRunner(connection);
  });

  afterEach(async () => {
    if (connection.isConnected()) {
      await connection.close();
    }
  });

  describe('getCurrentVersion', () => {
    it('should return 0 for fresh database', async () => {
      const version = await migrationRunner.getCurrentVersion();
      expect(version).toBe(0);
    });

    it('should return correct version after migrations', async () => {
      // Apply first migration manually
      await connection.execute(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await connection.execute(`
        INSERT INTO schema_migrations (version, name) VALUES (1, 'test_migration')
      `);

      const version = await migrationRunner.getCurrentVersion();
      expect(version).toBe(1);
    });
  });

  describe('getAppliedMigrations', () => {
    it('should return empty array for fresh database', async () => {
      const applied = await migrationRunner.getAppliedMigrations();
      expect(applied).toEqual([]);
    });

    it('should return applied migrations', async () => {
      // Setup migration table and add a migration
      await connection.execute(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await connection.execute(`
        INSERT INTO schema_migrations (version, name, applied_at) 
        VALUES (1, 'test_migration', '2023-01-01T00:00:00.000Z')
      `);

      const applied = await migrationRunner.getAppliedMigrations();
      expect(applied).toHaveLength(1);
      expect(applied[0].version).toBe(1);
      expect(applied[0].name).toBe('test_migration');
      expect(applied[0].appliedAt).toBeInstanceOf(Date);
    });
  });

  describe('getPendingMigrations', () => {
    it('should return all migrations for fresh database', async () => {
      const pending = await migrationRunner.getPendingMigrations();
      expect(pending).toHaveLength(migrations.length);
      expect(pending[0].version).toBe(1);
    });

    it('should return only pending migrations', async () => {
      // Setup migration table and mark first migration as applied
      await connection.execute(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await connection.execute(`
        INSERT INTO schema_migrations (version, name) VALUES (1, 'create_alpacas_table')
      `);

      const pending = await migrationRunner.getPendingMigrations();
      expect(pending).toHaveLength(migrations.length - 1);
      expect(pending[0].version).toBe(2);
    });
  });

  describe('migrate', () => {
    it('should run all pending migrations', async () => {
      await migrationRunner.migrate();

      const currentVersion = await migrationRunner.getCurrentVersion();
      expect(currentVersion).toBe(getLatestMigrationVersion());

      const applied = await migrationRunner.getAppliedMigrations();
      expect(applied).toHaveLength(migrations.length);
    });

    it('should handle no pending migrations', async () => {
      // Run migrations twice
      await migrationRunner.migrate();
      await migrationRunner.migrate(); // Should not throw

      const currentVersion = await migrationRunner.getCurrentVersion();
      expect(currentVersion).toBe(getLatestMigrationVersion());
    });

    it('should create tables correctly', async () => {
      await migrationRunner.migrate();

      // Check that tables were created
      const tables = await connection.query(`
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
      `);
      
      const tableNames = tables.map((t: any) => t.name);
      expect(tableNames).toContain('alpacas');
      expect(tableNames).toContain('health_records');
      expect(tableNames).toContain('breeding_records');
      expect(tableNames).toContain('management_activities');
      expect(tableNames).toContain('schema_migrations');
    });
  });

  describe('migrateTo', () => {
    it('should migrate to specific version', async () => {
      await migrationRunner.migrateTo(2);

      const currentVersion = await migrationRunner.getCurrentVersion();
      expect(currentVersion).toBe(2);

      const applied = await migrationRunner.getAppliedMigrations();
      expect(applied).toHaveLength(2);
    });

    it('should handle migrating to current version', async () => {
      await migrationRunner.migrateTo(2);
      await migrationRunner.migrateTo(2); // Should not throw

      const currentVersion = await migrationRunner.getCurrentVersion();
      expect(currentVersion).toBe(2);
    });

    it('should rollback to lower version', async () => {
      await migrationRunner.migrate(); // Migrate to latest
      await migrationRunner.migrateTo(2); // Rollback to version 2

      const currentVersion = await migrationRunner.getCurrentVersion();
      expect(currentVersion).toBe(2);

      const applied = await migrationRunner.getAppliedMigrations();
      expect(applied).toHaveLength(2);
    });
  });

  describe('rollback', () => {
    it('should rollback last migration', async () => {
      await migrationRunner.migrateTo(3);
      await migrationRunner.rollback();

      const currentVersion = await migrationRunner.getCurrentVersion();
      expect(currentVersion).toBe(2);
    });

    it('should handle no migrations to rollback', async () => {
      await migrationRunner.rollback(); // Should not throw
      
      const currentVersion = await migrationRunner.getCurrentVersion();
      expect(currentVersion).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset database to initial state', async () => {
      await migrationRunner.migrate();
      await migrationRunner.reset();

      const currentVersion = await migrationRunner.getCurrentVersion();
      expect(currentVersion).toBe(0);

      const applied = await migrationRunner.getAppliedMigrations();
      expect(applied).toEqual([]);
    });
  });

  describe('validateMigrations', () => {
    it('should validate migration integrity', async () => {
      const result = await migrationRunner.validateMigrations();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      await connection.close();
      
      await expect(migrationRunner.getCurrentVersion()).rejects.toThrow(MigrationError);
    });

    it('should handle invalid SQL in migrations', async () => {
      // This would require mocking the migration to have invalid SQL
      // For now, we'll test that the error is properly wrapped
      const invalidConnection = {
        query: () => Promise.reject(new Error('SQL error')),
        execute: () => Promise.reject(new Error('SQL error')),
        close: () => Promise.resolve(),
        isConnected: () => true
      };

      const invalidRunner = new MigrationRunner(invalidConnection as any);
      await expect(invalidRunner.getCurrentVersion()).rejects.toThrow(MigrationError);
    });
  });
});