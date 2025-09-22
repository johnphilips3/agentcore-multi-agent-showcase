import { DatabaseConnection } from './connection';
import { 
  Migration, 
  migrations, 
  getLatestMigrationVersion, 
  getMigrationByVersion,
  getMigrationsUpTo,
  getMigrationsFromTo 
} from './schema';

export class MigrationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'MigrationError';
  }
}

export interface MigrationStatus {
  version: number;
  name: string;
  appliedAt: Date;
}

export class MigrationRunner {
  constructor(private connection: DatabaseConnection) {}

  /**
   * Get the current database schema version
   */
  async getCurrentVersion(): Promise<number> {
    try {
      // Check if migration table exists by trying to query it
      try {
        const result = await this.connection.query<{ version: number }>(`
          SELECT MAX(version) as version FROM schema_migrations
        `);
        return result[0]?.version || 0;
      } catch (tableError) {
        // If table doesn't exist, return 0
        if (tableError instanceof Error && 
            (tableError.message.includes('no such table') || 
             tableError.message.includes('does not exist'))) {
          return 0;
        }
        throw tableError;
      }
    } catch (error) {
      throw new MigrationError(`Failed to get current version: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get all applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationStatus[]> {
    try {
      const currentVersion = await this.getCurrentVersion();
      if (currentVersion === 0) {
        return [];
      }

      const result = await this.connection.query<MigrationStatus>(`
        SELECT version, name, applied_at as appliedAt 
        FROM schema_migrations 
        ORDER BY version ASC
      `);

      return result.map(row => ({
        ...row,
        appliedAt: new Date(row.appliedAt)
      }));
    } catch (error) {
      throw new MigrationError(`Failed to get applied migrations: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    try {
      const currentVersion = await this.getCurrentVersion();
      const latestVersion = getLatestMigrationVersion();
      
      return migrations
        .filter(m => m.version > currentVersion && m.version <= latestVersion)
        .sort((a, b) => a.version - b.version);
    } catch (error) {
      throw new MigrationError(`Failed to get pending migrations: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    try {
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        console.log('No pending migrations to run');
        return;
      }

      console.log(`Running ${pendingMigrations.length} pending migrations...`);

      for (const migration of pendingMigrations) {
        await this.runMigration(migration, 'up');
      }

      console.log('All migrations completed successfully');
    } catch (error) {
      throw new MigrationError(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Migrate to a specific version
   */
  async migrateTo(targetVersion: number): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion();
      
      if (targetVersion === currentVersion) {
        console.log(`Already at version ${targetVersion}`);
        return;
      }

      if (targetVersion > currentVersion) {
        // Migrate up
        const migrationsToRun = getMigrationsUpTo(targetVersion)
          .filter(m => m.version > currentVersion);
        
        console.log(`Migrating up from version ${currentVersion} to ${targetVersion}...`);
        
        for (const migration of migrationsToRun) {
          await this.runMigration(migration, 'up');
        }
      } else {
        // Migrate down (rollback)
        const migrationsToRollback = getMigrationsFromTo(currentVersion, targetVersion);
        
        console.log(`Rolling back from version ${currentVersion} to ${targetVersion}...`);
        
        for (const migration of migrationsToRollback) {
          await this.runMigration(migration, 'down');
        }
      }

      console.log(`Migration to version ${targetVersion} completed successfully`);
    } catch (error) {
      throw new MigrationError(`Migration to version ${targetVersion} failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Rollback the last migration
   */
  async rollback(): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion();
      
      if (currentVersion === 0) {
        console.log('No migrations to rollback');
        return;
      }

      const migration = getMigrationByVersion(currentVersion);
      if (!migration) {
        throw new MigrationError(`Migration version ${currentVersion} not found`);
      }

      console.log(`Rolling back migration: ${migration.name} (version ${migration.version})`);
      await this.runMigration(migration, 'down');
      console.log('Rollback completed successfully');
    } catch (error) {
      throw new MigrationError(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Reset database (rollback all migrations)
   */
  async reset(): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion();
      
      if (currentVersion === 0) {
        console.log('Database is already at initial state');
        return;
      }

      await this.migrateTo(0);
      console.log('Database reset completed successfully');
    } catch (error) {
      throw new MigrationError(`Database reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration, direction: 'up' | 'down'): Promise<void> {
    try {
      const statements = direction === 'up' ? migration.up : migration.down;
      
      console.log(`${direction === 'up' ? 'Applying' : 'Rolling back'} migration: ${migration.name} (version ${migration.version})`);

      // Execute all statements in the migration
      for (const statement of statements) {
        await this.connection.execute(statement);
      }

      // Update migration tracking
      if (direction === 'up') {
        await this.recordMigration(migration);
      } else {
        await this.removeMigrationRecord(migration.version);
      }

      console.log(`Migration ${migration.name} ${direction === 'up' ? 'applied' : 'rolled back'} successfully`);
    } catch (error) {
      throw new MigrationError(`Failed to run migration ${migration.name} (${direction}): ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Record a migration as applied
   */
  private async recordMigration(migration: Migration): Promise<void> {
    // First ensure the migration table exists
    await this.ensureMigrationTableExists();
    
    await this.connection.execute(`
      INSERT INTO schema_migrations (version, name, applied_at) 
      VALUES (?, ?, ?)
    `, [migration.version, migration.name, new Date().toISOString()]);
  }

  /**
   * Remove a migration record
   */
  private async removeMigrationRecord(version: number): Promise<void> {
    await this.connection.execute(`
      DELETE FROM schema_migrations WHERE version = ?
    `, [version]);
  }

  /**
   * Ensure the migration tracking table exists
   */
  private async ensureMigrationTableExists(): Promise<void> {
    try {
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      throw new MigrationError(`Failed to create migration table: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Validate migration integrity
   */
  async validateMigrations(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check for duplicate versions
      const versions = migrations.map(m => m.version);
      const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
      if (duplicates.length > 0) {
        errors.push(`Duplicate migration versions found: ${duplicates.join(', ')}`);
      }

      // Check for missing versions (gaps in sequence)
      const sortedVersions = [...new Set(versions)].sort((a, b) => a - b);
      for (let i = 1; i < sortedVersions.length; i++) {
        if (sortedVersions[i] !== sortedVersions[i - 1] + 1) {
          errors.push(`Gap in migration versions between ${sortedVersions[i - 1]} and ${sortedVersions[i]}`);
        }
      }

      // Check that each migration has both up and down statements
      for (const migration of migrations) {
        if (!migration.up || migration.up.length === 0) {
          errors.push(`Migration ${migration.name} (version ${migration.version}) has no up statements`);
        }
        if (!migration.down || migration.down.length === 0) {
          errors.push(`Migration ${migration.name} (version ${migration.version}) has no down statements`);
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }
}