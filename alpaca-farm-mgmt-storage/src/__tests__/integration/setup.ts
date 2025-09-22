import { DatabaseConnection, getConnectionManager, DatabaseConfig } from '../../database/connection';
import { DatabaseInitializer } from '../../database/initializer';
import { MigrationRunner } from '../../database/migration';

export class IntegrationTestSetup {
  private connection: DatabaseConnection | null = null;
  private initializer: DatabaseInitializer | null = null;
  private migration: MigrationRunner | null = null;

  constructor() {
    // Configuration will be set up in setup() method
  }

  async setup(): Promise<void> {
    const config: DatabaseConfig = {
      type: 'sqlite',
      database: ':memory:'
    };
    
    const connectionManager = getConnectionManager(config);
    this.connection = await connectionManager.getConnection();
    
    this.migration = new MigrationRunner(this.connection);
    this.initializer = new DatabaseInitializer(this.connection);
    
    await this.migration.migrate();
    await this.initializer.seedData({ includeTestData: true, alpacaCount: 5 });
  }

  async teardown(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }

  getConnection(): DatabaseConnection {
    if (!this.connection) {
      throw new Error('Connection not initialized. Call setup() first.');
    }
    return this.connection;
  }
}

export const createTestSetup = () => new IntegrationTestSetup();