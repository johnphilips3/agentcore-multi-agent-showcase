import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseInitializer, DatabaseInitializationError, initializeDatabase, resetDatabase, SeedDataOptions } from '../initializer';
import { DatabaseConnection } from '../connection';
import { MigrationRunner } from '../migration';

// Mock external dependencies
vi.mock('../migration');

describe('DatabaseInitializer', () => {
  let mockConnection: DatabaseConnection;
  let mockMigrationRunner: any;
  let initializer: DatabaseInitializer;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock database connection
    mockConnection = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true)
    };

    // Mock migration runner
    mockMigrationRunner = {
      migrate: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn().mockResolvedValue(undefined)
    };
    
    (MigrationRunner as any) = vi.fn().mockImplementation(() => mockMigrationRunner);

    initializer = new DatabaseInitializer(mockConnection);
  });

  describe('initialize', () => {
    it('should initialize database with schema only', async () => {
      // Mock successful table validation
      mockConnection.query = vi.fn()
        .mockResolvedValueOnce([]) // First call for table validation
        .mockResolvedValueOnce([]) // Subsequent calls for other tables
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await initializer.initialize();

      expect(MigrationRunner).toHaveBeenCalledWith(mockConnection);
      expect(mockMigrationRunner.migrate).toHaveBeenCalled();
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT 1 FROM alpacas LIMIT 0');
    });

    it('should initialize database with seed data', async () => {
      // Mock successful validation and seeding
      mockConnection.query = vi.fn()
        .mockResolvedValueOnce([]) // Table validation calls
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 5 }]) // Statistics calls
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([{ count: 3 }]);

      mockConnection.execute = vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const options: SeedDataOptions = {
        includeTestData: true,
        alpacaCount: 5,
        healthRecordsPerAlpaca: 2,
        breedingRecords: 2,
        managementActivities: 3
      };

      await initializer.initialize(options);

      expect(mockMigrationRunner.migrate).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalled(); // Should have seeded data
    });

    it('should handle initialization without seed data', async () => {
      // Mock successful validation only
      mockConnection.query = vi.fn()
        .mockResolvedValueOnce([]) // Table validation calls
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await initializer.initialize({ includeTestData: false });

      expect(mockMigrationRunner.migrate).toHaveBeenCalled();
      expect(mockConnection.execute).not.toHaveBeenCalled(); // Should not seed data
    });

    it('should handle migration errors', async () => {
      const migrationError = new Error('Migration failed');
      mockMigrationRunner.migrate.mockRejectedValue(migrationError);

      await expect(initializer.initialize()).rejects.toThrow(DatabaseInitializationError);
      await expect(initializer.initialize()).rejects.toThrow('Database initialization failed: Migration failed');
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Table does not exist');
      mockConnection.query.mockRejectedValue(validationError);

      await expect(initializer.initialize()).rejects.toThrow(DatabaseInitializationError);
    });
  });

  describe('reset', () => {
    it('should reset and reinitialize database', async () => {
      // Mock successful reset and reinitialization
      mockConnection.query = vi.fn()
        .mockResolvedValue([]); // Table validation calls

      await initializer.reset({ includeTestData: false });

      expect(mockMigrationRunner.reset).toHaveBeenCalled();
      expect(mockMigrationRunner.migrate).toHaveBeenCalled();
    });

    it('should handle reset errors', async () => {
      const resetError = new Error('Reset failed');
      mockMigrationRunner.reset.mockRejectedValue(resetError);

      await expect(initializer.reset()).rejects.toThrow(DatabaseInitializationError);
      await expect(initializer.reset()).rejects.toThrow('Database reset failed: Reset failed');
    });

    it('should reinitialize with seed data after reset', async () => {
      // Mock successful reset and seeding
      mockConnection.query = vi.fn()
        .mockResolvedValue([]); // Table validation calls
      mockConnection.execute = vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      await initializer.reset({ 
        includeTestData: true, 
        alpacaCount: 2 
      });

      expect(mockMigrationRunner.reset).toHaveBeenCalled();
      expect(mockMigrationRunner.migrate).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalled(); // Should seed data
    });
  });

  describe('validateSchema', () => {
    it('should validate schema successfully', async () => {
      // Mock successful table queries
      mockConnection.query = vi.fn()
        .mockResolvedValueOnce([]) // alpacas table
        .mockResolvedValueOnce([]) // health_records table
        .mockResolvedValueOnce([]) // breeding_records table
        .mockResolvedValueOnce([]) // breeding_offspring table
        .mockResolvedValueOnce([]) // management_activities table
        .mockResolvedValueOnce([]) // activity_alpacas table
        .mockResolvedValueOnce([]) // schema_migrations table
        .mockResolvedValueOnce([{ foreign_keys: 1 }]); // PRAGMA foreign_keys

      await expect(initializer.validateSchema()).resolves.not.toThrow();
      
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT 1 FROM alpacas LIMIT 0');
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT 1 FROM health_records LIMIT 0');
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT 1 FROM breeding_records LIMIT 0');
    });

    it('should fail validation when table is missing', async () => {
      const tableError = new Error('no such table: alpacas');
      mockConnection.query = vi.fn()
        .mockRejectedValueOnce(tableError);

      await expect(initializer.validateSchema()).rejects.toThrow(DatabaseInitializationError);
      await expect(initializer.validateSchema()).rejects.toThrow("Required table 'alpacas' does not exist");
    });

    it('should handle foreign key check gracefully', async () => {
      // Mock successful table queries but foreign key check fails
      mockConnection.query = vi.fn()
        .mockResolvedValueOnce([]) // All table checks pass
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('PRAGMA not supported')); // Foreign key check fails

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(initializer.validateSchema()).resolves.not.toThrow();
      
      consoleSpy.mockRestore();
    });

    it('should warn about disabled foreign keys', async () => {
      // Mock successful table queries with foreign keys disabled
      mockConnection.query = vi.fn()
        .mockResolvedValueOnce([]) // All table checks pass
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ foreign_keys: 0 }]); // Foreign keys disabled

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await initializer.validateSchema();
      
      expect(consoleSpy).toHaveBeenCalledWith('Foreign key constraints are not enabled');
      consoleSpy.mockRestore();
    });

    it('should handle database connection errors', async () => {
      const connectionError = new Error('Database connection lost');
      mockConnection.query.mockRejectedValue(connectionError);

      await expect(initializer.validateSchema()).rejects.toThrow(DatabaseInitializationError);
      await expect(initializer.validateSchema()).rejects.toThrow('Schema validation failed: Database connection lost');
    });
  });

  describe('seedData', () => {
    it('should seed database with specified counts', async () => {
      mockConnection.execute = vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      await initializer.seedData({
        alpacaCount: 3,
        healthRecordsPerAlpaca: 2,
        breedingRecords: 1,
        managementActivities: 2
      });

      // Should have called execute for alpacas (3), health records (6), breeding records (1), activities (2), and activity links
      expect(mockConnection.execute).toHaveBeenCalled();
      expect(mockConnection.execute.mock.calls.length).toBeGreaterThan(10); // Multiple inserts
    });

    it('should use default seed data options', async () => {
      mockConnection.execute = vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      await initializer.seedData();

      // Should use defaults: 10 alpacas, 3 health records per alpaca, 3 breeding records, 5 activities
      expect(mockConnection.execute).toHaveBeenCalled();
      expect(mockConnection.execute.mock.calls.length).toBeGreaterThan(40); // Many inserts with defaults
    });

    it('should generate valid alpaca data', async () => {
      const executeCalls: any[] = [];
      mockConnection.execute = vi.fn().mockImplementation((sql, params) => {
        executeCalls.push({ sql, params });
        return Promise.resolve({ changes: 1, lastInsertRowid: 1 });
      });

      await initializer.seedData({ alpacaCount: 2 });

      // Find alpaca insert calls
      const alpacaInserts = executeCalls.filter(call => 
        call.sql.includes('INSERT INTO alpacas')
      );

      expect(alpacaInserts).toHaveLength(2);
      
      for (const insert of alpacaInserts) {
        const params = insert.params;
        expect(params[0]).toBeTruthy(); // id
        expect(params[1]).toBeTruthy(); // name
        expect(params[2]).toBeTruthy(); // registration_number
        expect(params[3]).toBeTruthy(); // birth_date
        expect(['male', 'female']).toContain(params[4]); // gender
        expect(params[5]).toBeTruthy(); // color
        expect(typeof params[6]).toBe('number'); // weight
        expect(typeof params[7]).toBe('number'); // height
      }
    });

    it('should generate health records for each alpaca', async () => {
      const executeCalls: any[] = [];
      mockConnection.execute = vi.fn().mockImplementation((sql, params) => {
        executeCalls.push({ sql, params });
        return Promise.resolve({ changes: 1, lastInsertRowid: 1 });
      });

      await initializer.seedData({ 
        alpacaCount: 2, 
        healthRecordsPerAlpaca: 3 
      });

      const healthInserts = executeCalls.filter(call => 
        call.sql.includes('INSERT INTO health_records')
      );

      expect(healthInserts).toHaveLength(6); // 2 alpacas * 3 records each
      
      for (const insert of healthInserts) {
        const params = insert.params;
        expect(params[0]).toBeTruthy(); // id
        expect(params[1]).toBeTruthy(); // alpaca_id
        expect(params[2]).toBeTruthy(); // record_type
        expect(params[3]).toBeTruthy(); // date
        expect(params[4]).toBeTruthy(); // description
      }
    });

    it('should generate breeding records with valid relationships', async () => {
      const executeCalls: any[] = [];
      mockConnection.execute = vi.fn().mockImplementation((sql, params) => {
        executeCalls.push({ sql, params });
        return Promise.resolve({ changes: 1, lastInsertRowid: 1 });
      });

      await initializer.seedData({ 
        alpacaCount: 6, 
        breedingRecords: 2 
      });

      const breedingInserts = executeCalls.filter(call => 
        call.sql.includes('INSERT INTO breeding_records')
      );

      expect(breedingInserts).toHaveLength(2);
      
      for (const insert of breedingInserts) {
        const params = insert.params;
        expect(params[0]).toBeTruthy(); // id
        expect(params[1]).toBeTruthy(); // sire_id
        expect(params[2]).toBeTruthy(); // dam_id
        expect(params[3]).toBeTruthy(); // breeding_date
        expect(params[4]).toBeTruthy(); // expected_due_date
        expect(params[1]).not.toBe(params[2]); // sire_id !== dam_id
      }
    });

    it('should generate management activities with participants', async () => {
      const executeCalls: any[] = [];
      mockConnection.execute = vi.fn().mockImplementation((sql, params) => {
        executeCalls.push({ sql, params });
        return Promise.resolve({ changes: 1, lastInsertRowid: 1 });
      });

      await initializer.seedData({ 
        alpacaCount: 4, 
        managementActivities: 2 
      });

      const activityInserts = executeCalls.filter(call => 
        call.sql.includes('INSERT INTO management_activities')
      );
      const participantInserts = executeCalls.filter(call => 
        call.sql.includes('INSERT INTO activity_alpacas')
      );

      expect(activityInserts).toHaveLength(2);
      expect(participantInserts.length).toBeGreaterThan(0); // Should have participants
      
      for (const insert of activityInserts) {
        const params = insert.params;
        expect(params[0]).toBeTruthy(); // id
        expect(params[1]).toBeTruthy(); // activity_type
        expect(params[2]).toBeTruthy(); // date
        expect(params[3]).toBeTruthy(); // performed_by
        expect(params[4]).toBeTruthy(); // description
      }
    });

    it('should handle seeding errors', async () => {
      const seedError = new Error('Insert failed');
      mockConnection.execute.mockRejectedValue(seedError);

      await expect(initializer.seedData({ alpacaCount: 1 })).rejects.toThrow(DatabaseInitializationError);
      await expect(initializer.seedData({ alpacaCount: 1 })).rejects.toThrow('Data seeding failed: Insert failed');
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      mockConnection.query = vi.fn()
        .mockResolvedValueOnce([{ count: 4 }])  // alpacas count
        .mockResolvedValueOnce([{ count: 8 }])  // health_records count
        .mockResolvedValueOnce([{ count: 1 }])  // breeding_records count
        .mockResolvedValueOnce([{ count: 2 }]); // management_activities count

      const stats = await initializer.getStatistics();
      
      expect(stats.alpacas).toBe(4);
      expect(stats.healthRecords).toBe(8);
      expect(stats.breedingRecords).toBe(1);
      expect(stats.managementActivities).toBe(2);
      
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM alpacas');
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM health_records');
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM breeding_records');
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM management_activities');
    });

    it('should return zero statistics for empty database', async () => {
      mockConnection.query = vi.fn()
        .mockResolvedValueOnce([{ count: 0 }])  // alpacas count
        .mockResolvedValueOnce([{ count: 0 }])  // health_records count
        .mockResolvedValueOnce([{ count: 0 }])  // breeding_records count
        .mockResolvedValueOnce([{ count: 0 }]); // management_activities count

      const stats = await initializer.getStatistics();
      
      expect(stats.alpacas).toBe(0);
      expect(stats.healthRecords).toBe(0);
      expect(stats.breedingRecords).toBe(0);
      expect(stats.managementActivities).toBe(0);
    });

    it('should handle statistics query errors', async () => {
      const queryError = new Error('Query failed');
      mockConnection.query.mockRejectedValue(queryError);

      await expect(initializer.getStatistics()).rejects.toThrow(DatabaseInitializationError);
      await expect(initializer.getStatistics()).rejects.toThrow('Failed to get statistics: Query failed');
    });

    it('should handle missing count results', async () => {
      mockConnection.query = vi.fn()
        .mockResolvedValueOnce([]) // Empty result
        .mockResolvedValueOnce([{ count: 5 }])
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([{ count: 1 }]);

      const stats = await initializer.getStatistics();
      
      expect(stats.alpacas).toBeUndefined(); // Should handle missing count gracefully
      expect(stats.healthRecords).toBe(5);
      expect(stats.breedingRecords).toBe(2);
      expect(stats.managementActivities).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors during initialization', async () => {
      const connectionError = new Error('Connection lost');
      mockMigrationRunner.migrate.mockRejectedValue(connectionError);
      
      await expect(initializer.initialize()).rejects.toThrow(DatabaseInitializationError);
      await expect(initializer.initialize()).rejects.toThrow('Database initialization failed: Connection lost');
    });

    it('should handle seeding errors gracefully', async () => {
      const seedError = new Error('Seeding failed');
      mockConnection.execute.mockRejectedValue(seedError);

      await expect(initializer.seedData({ alpacaCount: 1 })).rejects.toThrow(DatabaseInitializationError);
      await expect(initializer.seedData({ alpacaCount: 1 })).rejects.toThrow('Data seeding failed: Seeding failed');
    });

    it('should handle validation errors during initialization', async () => {
      const validationError = new Error('Table missing');
      mockConnection.query.mockRejectedValue(validationError);

      await expect(initializer.initialize()).rejects.toThrow(DatabaseInitializationError);
    });

    it('should wrap unknown errors properly', async () => {
      const unknownError = 'String error';
      mockMigrationRunner.migrate.mockRejectedValue(unknownError);

      await expect(initializer.initialize()).rejects.toThrow(DatabaseInitializationError);
      await expect(initializer.initialize()).rejects.toThrow('Database initialization failed: Unknown error');
    });
  });

  describe('console logging', () => {
    it('should log initialization progress', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockConnection.query = vi.fn().mockResolvedValue([]);

      await initializer.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('Initializing database...');
      expect(consoleSpy).toHaveBeenCalledWith('Database initialization completed successfully');
      
      consoleSpy.mockRestore();
    });

    it('should log reset progress', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockConnection.query = vi.fn().mockResolvedValue([]);

      await initializer.reset();

      expect(consoleSpy).toHaveBeenCalledWith('Resetting database...');
      expect(consoleSpy).toHaveBeenCalledWith('Database reset completed successfully');
      
      consoleSpy.mockRestore();
    });

    it('should log seeding progress', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockConnection.execute = vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      await initializer.seedData({ alpacaCount: 2 });

      expect(consoleSpy).toHaveBeenCalledWith('Seeding database with test data...');
      expect(consoleSpy).toHaveBeenCalledWith('Seeded database with 2 alpacas and related data');
      
      consoleSpy.mockRestore();
    });

    it('should log validation progress', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockConnection.query = vi.fn().mockResolvedValue([]);

      await initializer.validateSchema();

      expect(consoleSpy).toHaveBeenCalledWith('Schema validation completed successfully');
      
      consoleSpy.mockRestore();
    });
  });
});

describe('Global initialization functions', () => {
  let mockConnectionManager: any;
  let mockConnection: DatabaseConnection;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConnection = {
      query: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 }),
      close: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true)
    };

    mockConnectionManager = {
      getConnection: vi.fn().mockResolvedValue(mockConnection)
    };

    // Mock the getConnectionManager function
    vi.doMock('../connection', () => ({
      getConnectionManager: vi.fn().mockReturnValue(mockConnectionManager)
    }));
  });

  describe('initializeDatabase', () => {
    it('should initialize database with default connection', async () => {
      // Mock the module to avoid actual database operations
      const { getConnectionManager } = await import('../connection');
      (getConnectionManager as any).mockReturnValue(mockConnectionManager);

      await expect(initializeDatabase()).resolves.not.toThrow();
      
      expect(mockConnectionManager.getConnection).toHaveBeenCalled();
    });

    it('should pass options to initializer', async () => {
      const { getConnectionManager } = await import('../connection');
      (getConnectionManager as any).mockReturnValue(mockConnectionManager);

      const options: SeedDataOptions = { 
        includeTestData: true, 
        alpacaCount: 5 
      };

      await expect(initializeDatabase(options)).resolves.not.toThrow();
    });
  });

  describe('resetDatabase', () => {
    it('should reset database with default connection', async () => {
      const { getConnectionManager } = await import('../connection');
      (getConnectionManager as any).mockReturnValue(mockConnectionManager);

      await expect(resetDatabase()).resolves.not.toThrow();
      
      expect(mockConnectionManager.getConnection).toHaveBeenCalled();
    });

    it('should pass options to reset', async () => {
      const { getConnectionManager } = await import('../connection');
      (getConnectionManager as any).mockReturnValue(mockConnectionManager);

      const options: SeedDataOptions = { 
        includeTestData: false 
      };

      await expect(resetDatabase(options)).resolves.not.toThrow();
    });
  });
});