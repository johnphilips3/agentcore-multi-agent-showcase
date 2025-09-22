import { DatabaseConnection, getConnectionManager } from './connection';
import { MigrationRunner } from './migration';
import { Alpaca } from '../models/alpaca';
import { HealthRecord } from '../models/health-record';
import { BreedingRecord } from '../models/breeding-record';
import { ManagementActivity } from '../models/management-activity';

export class DatabaseInitializationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseInitializationError';
  }
}

export interface SeedDataOptions {
  alpacaCount?: number;
  healthRecordsPerAlpaca?: number;
  breedingRecords?: number;
  managementActivities?: number;
  includeTestData?: boolean;
}

export class DatabaseInitializer {
  constructor(private connection: DatabaseConnection) {}

  /**
   * Initialize the database with schema and optionally seed data
   */
  async initialize(options: SeedDataOptions = {}): Promise<void> {
    try {
      console.log('Initializing database...');
      
      // Run migrations to set up schema
      const migrationRunner = new MigrationRunner(this.connection);
      await migrationRunner.migrate();
      
      // Validate schema integrity
      await this.validateSchema();
      
      // Seed data if requested
      if (options.includeTestData) {
        await this.seedData(options);
      }
      
      console.log('Database initialization completed successfully');
    } catch (error) {
      throw new DatabaseInitializationError(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Reset database and reinitialize
   */
  async reset(options: SeedDataOptions = {}): Promise<void> {
    try {
      console.log('Resetting database...');
      
      // Reset migrations
      const migrationRunner = new MigrationRunner(this.connection);
      await migrationRunner.reset();
      
      // Reinitialize
      await this.initialize(options);
      
      console.log('Database reset completed successfully');
    } catch (error) {
      throw new DatabaseInitializationError(`Database reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Validate database schema
   */
  async validateSchema(): Promise<void> {
    try {
      const requiredTables = [
        'alpacas',
        'health_records',
        'breeding_records',
        'breeding_offspring',
        'management_activities',
        'activity_alpacas',
        'schema_migrations'
      ];

      // Check that all required tables exist
      for (const tableName of requiredTables) {
        try {
          // Try to query the table to see if it exists
          await this.connection.query(`SELECT 1 FROM ${tableName} LIMIT 0`);
        } catch (error) {
          if (error instanceof Error && 
              (error.message.includes('no such table') || 
               error.message.includes('does not exist'))) {
            throw new Error(`Required table '${tableName}' does not exist`);
          }
          // If it's a different error, the table exists but there might be other issues
          // We'll continue with validation
        }
      }

      // Validate foreign key constraints are enabled (SQLite specific)
      try {
        const fkResult = await this.connection.query('PRAGMA foreign_keys');
        if (fkResult.length > 0 && fkResult[0].foreign_keys === 0) {
          console.warn('Foreign key constraints are not enabled');
        }
      } catch {
        // Ignore if not SQLite
      }

      console.log('Schema validation completed successfully');
    } catch (error) {
      throw new DatabaseInitializationError(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Seed database with test data
   */
  async seedData(options: SeedDataOptions = {}): Promise<void> {
    try {
      console.log('Seeding database with test data...');
      
      const {
        alpacaCount = 10,
        healthRecordsPerAlpaca = 3,
        breedingRecords = 3,
        managementActivities = 5
      } = options;

      // Generate alpacas
      const alpacas = await this.generateAlpacas(alpacaCount);
      
      // Generate health records
      await this.generateHealthRecords(alpacas, healthRecordsPerAlpaca);
      
      // Generate breeding records
      await this.generateBreedingRecords(alpacas, breedingRecords);
      
      // Generate management activities
      await this.generateManagementActivities(alpacas, managementActivities);
      
      console.log(`Seeded database with ${alpacaCount} alpacas and related data`);
    } catch (error) {
      throw new DatabaseInitializationError(`Data seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Generate sample alpacas
   */
  private async generateAlpacas(count: number): Promise<string[]> {
    const alpacaIds: string[] = [];
    const colors = ['white', 'brown', 'black', 'gray', 'fawn', 'beige'];
    const names = [
      'Luna', 'Stella', 'Cocoa', 'Snowball', 'Caramel', 'Shadow',
      'Buttercup', 'Mocha', 'Pearl', 'Dusty', 'Honey', 'Storm',
      'Cream', 'Copper', 'Silver', 'Rusty', 'Velvet', 'Marble'
    ];

    for (let i = 0; i < count; i++) {
      const id = `alpaca-${Date.now()}-${i}`;
      const name = names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : '');
      const birthDate = new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000); // Random age up to 5 years
      const gender = Math.random() > 0.5 ? 'male' : 'female';
      const color = colors[Math.floor(Math.random() * colors.length)];
      const weight = 60 + Math.random() * 40; // 60-100 kg
      const height = 80 + Math.random() * 20; // 80-100 cm

      await this.connection.execute(`
        INSERT INTO alpacas (
          id, name, registration_number, birth_date, gender, color, 
          weight, height, fiber_micron_count, fiber_staple_length,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        name,
        `REG-${String(i + 1).padStart(4, '0')}`,
        birthDate.toISOString().split('T')[0],
        gender,
        color,
        Math.round(weight * 10) / 10,
        Math.round(height * 10) / 10,
        18 + Math.random() * 12, // 18-30 microns
        8 + Math.random() * 4, // 8-12 cm
        new Date().toISOString(),
        new Date().toISOString()
      ]);

      alpacaIds.push(id);
    }

    return alpacaIds;
  }

  /**
   * Generate sample health records
   */
  private async generateHealthRecords(alpacaIds: string[], recordsPerAlpaca: number): Promise<void> {
    const recordTypes = ['vaccination', 'treatment', 'observation', 'checkup'];
    const descriptions = [
      'Annual vaccination',
      'Deworming treatment',
      'Hoof trimming',
      'General health checkup',
      'Vitamin injection',
      'Dental examination',
      'Weight monitoring',
      'Fiber quality assessment'
    ];
    const veterinarians = ['Dr. Smith', 'Dr. Johnson', 'Dr. Williams', 'Dr. Brown'];

    for (const alpacaId of alpacaIds) {
      for (let i = 0; i < recordsPerAlpaca; i++) {
        const id = `health-${Date.now()}-${alpacaId}-${i}`;
        const recordType = recordTypes[Math.floor(Math.random() * recordTypes.length)];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const date = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000); // Random date within last year
        const veterinarian = veterinarians[Math.floor(Math.random() * veterinarians.length)];
        const nextDueDate = recordType === 'vaccination' ? 
          new Date(date.getTime() + 365 * 24 * 60 * 60 * 1000) : null; // Next year for vaccinations

        await this.connection.execute(`
          INSERT INTO health_records (
            id, alpaca_id, record_type, date, description, 
            veterinarian, next_due_date, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          alpacaId,
          recordType,
          date.toISOString().split('T')[0],
          description,
          veterinarian,
          nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
          `Sample notes for ${description}`,
          new Date().toISOString()
        ]);
      }
    }
  }

  /**
   * Generate sample breeding records
   */
  private async generateBreedingRecords(alpacaIds: string[], recordCount: number): Promise<void> {
    const males = alpacaIds.slice(0, Math.ceil(alpacaIds.length * 0.3)); // 30% males
    const females = alpacaIds.slice(Math.ceil(alpacaIds.length * 0.3)); // 70% females

    for (let i = 0; i < recordCount && females.length > 0; i++) {
      const id = `breeding-${Date.now()}-${i}`;
      const sireId = males[Math.floor(Math.random() * males.length)];
      const damId = females[Math.floor(Math.random() * females.length)];
      const breedingDate = new Date(Date.now() - Math.random() * 2 * 365 * 24 * 60 * 60 * 1000); // Random date within last 2 years
      const expectedDueDate = new Date(breedingDate.getTime() + 335 * 24 * 60 * 60 * 1000); // ~11 months gestation
      const actualBirthDate = Math.random() > 0.3 ? 
        new Date(expectedDueDate.getTime() + (Math.random() - 0.5) * 14 * 24 * 60 * 60 * 1000) : null; // ±7 days

      await this.connection.execute(`
        INSERT INTO breeding_records (
          id, sire_id, dam_id, breeding_date, expected_due_date, 
          actual_birth_date, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        sireId,
        damId,
        breedingDate.toISOString().split('T')[0],
        expectedDueDate.toISOString().split('T')[0],
        actualBirthDate ? actualBirthDate.toISOString().split('T')[0] : null,
        `Breeding record for ${sireId} and ${damId}`,
        new Date().toISOString()
      ]);
    }
  }

  /**
   * Generate sample management activities
   */
  private async generateManagementActivities(alpacaIds: string[], activityCount: number): Promise<void> {
    const activityTypes = ['feeding', 'shearing', 'weighing', 'moving', 'training', 'other'];
    const descriptions = [
      'Daily feeding routine',
      'Annual shearing',
      'Monthly weight check',
      'Moved to new pasture',
      'Halter training session',
      'Herd health inspection',
      'Pasture rotation',
      'Shelter maintenance'
    ];
    const performers = ['John Smith', 'Mary Johnson', 'Bob Wilson', 'Sarah Davis'];

    for (let i = 0; i < activityCount; i++) {
      const id = `activity-${Date.now()}-${i}`;
      const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      const description = descriptions[Math.floor(Math.random() * descriptions.length)];
      const date = new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000); // Random date within last 6 months
      const performedBy = performers[Math.floor(Math.random() * performers.length)];
      
      // Select random alpacas for this activity (1-5 alpacas)
      const participantCount = Math.min(Math.ceil(Math.random() * 5), alpacaIds.length);
      const participants = alpacaIds
        .sort(() => Math.random() - 0.5)
        .slice(0, participantCount);

      await this.connection.execute(`
        INSERT INTO management_activities (
          id, activity_type, date, performed_by, description, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        activityType,
        date.toISOString().split('T')[0],
        performedBy,
        description,
        `Activity involving ${participants.length} alpacas`,
        new Date().toISOString()
      ]);

      // Link alpacas to this activity
      for (const alpacaId of participants) {
        await this.connection.execute(`
          INSERT INTO activity_alpacas (activity_id, alpaca_id) VALUES (?, ?)
        `, [id, alpacaId]);
      }
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    alpacas: number;
    healthRecords: number;
    breedingRecords: number;
    managementActivities: number;
    lastInitialized?: Date;
  }> {
    try {
      const [alpacaCount] = await this.connection.query<{ count: number }>('SELECT COUNT(*) as count FROM alpacas');
      const [healthCount] = await this.connection.query<{ count: number }>('SELECT COUNT(*) as count FROM health_records');
      const [breedingCount] = await this.connection.query<{ count: number }>('SELECT COUNT(*) as count FROM breeding_records');
      const [activityCount] = await this.connection.query<{ count: number }>('SELECT COUNT(*) as count FROM management_activities');

      return {
        alpacas: alpacaCount.count,
        healthRecords: healthCount.count,
        breedingRecords: breedingCount.count,
        managementActivities: activityCount.count
      };
    } catch (error) {
      throw new DatabaseInitializationError(`Failed to get statistics: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }
}

/**
 * Initialize database with default connection
 */
export async function initializeDatabase(options: SeedDataOptions = {}): Promise<void> {
  const connectionManager = getConnectionManager();
  const connection = await connectionManager.getConnection();
  const initializer = new DatabaseInitializer(connection);
  await initializer.initialize(options);
}

/**
 * Reset database with default connection
 */
export async function resetDatabase(options: SeedDataOptions = {}): Promise<void> {
  const connectionManager = getConnectionManager();
  const connection = await connectionManager.getConnection();
  const initializer = new DatabaseInitializer(connection);
  await initializer.reset(options);
}