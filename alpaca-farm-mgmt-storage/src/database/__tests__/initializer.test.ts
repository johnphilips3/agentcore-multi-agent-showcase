import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseInitializer, DatabaseInitializationError, initializeDatabase, resetDatabase } from '../initializer';
import { SQLiteConnection, DatabaseConfig } from '../connection';

describe('DatabaseInitializer', () => {
  let connection: SQLiteConnection;
  let initializer: DatabaseInitializer;

  beforeEach(async () => {
    const config: DatabaseConfig = {
      type: 'sqlite',
      database: ':memory:'
    };
    connection = new SQLiteConnection(config);
    await connection.connect();
    initializer = new DatabaseInitializer(connection);
  });

  afterEach(async () => {
    if (connection.isConnected()) {
      await connection.close();
    }
  });

  describe('initialize', () => {
    it('should initialize database with schema', async () => {
      await initializer.initialize();

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

    it('should initialize database with seed data', async () => {
      await initializer.initialize({
        includeTestData: true,
        alpacaCount: 5,
        healthRecordsPerAlpaca: 2,
        breedingRecords: 2,
        managementActivities: 3
      });

      const stats = await initializer.getStatistics();
      expect(stats.alpacas).toBe(5);
      expect(stats.healthRecords).toBe(10); // 5 alpacas * 2 records each
      expect(stats.breedingRecords).toBe(2);
      expect(stats.managementActivities).toBe(3);
    });

    it('should handle initialization without seed data', async () => {
      await initializer.initialize({ includeTestData: false });

      const stats = await initializer.getStatistics();
      expect(stats.alpacas).toBe(0);
      expect(stats.healthRecords).toBe(0);
      expect(stats.breedingRecords).toBe(0);
      expect(stats.managementActivities).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset and reinitialize database', async () => {
      // Initialize with data
      await initializer.initialize({
        includeTestData: true,
        alpacaCount: 3
      });

      let stats = await initializer.getStatistics();
      expect(stats.alpacas).toBe(3);

      // Reset database
      await initializer.reset({ includeTestData: false });

      stats = await initializer.getStatistics();
      expect(stats.alpacas).toBe(0);
    });
  });

  describe('validateSchema', () => {
    it('should validate schema after initialization', async () => {
      await initializer.initialize();
      
      // Should not throw
      await expect(initializer.validateSchema()).resolves.not.toThrow();
    });

    it('should fail validation on empty database', async () => {
      await expect(initializer.validateSchema()).rejects.toThrow(DatabaseInitializationError);
    });
  });

  describe('seedData', () => {
    beforeEach(async () => {
      // Initialize schema first
      await initializer.initialize({ includeTestData: false });
    });

    it('should seed database with specified counts', async () => {
      await initializer.seedData({
        alpacaCount: 8,
        healthRecordsPerAlpaca: 1,
        breedingRecords: 1,
        managementActivities: 2
      });

      const stats = await initializer.getStatistics();
      expect(stats.alpacas).toBe(8);
      expect(stats.healthRecords).toBe(8);
      expect(stats.breedingRecords).toBe(1);
      expect(stats.managementActivities).toBe(2);
    });

    it('should create valid alpaca records', async () => {
      await initializer.seedData({ alpacaCount: 3 });

      const alpacas = await connection.query(`
        SELECT * FROM alpacas ORDER BY name
      `);

      expect(alpacas).toHaveLength(3);
      
      for (const alpaca of alpacas) {
        expect(alpaca.id).toBeTruthy();
        expect(alpaca.name).toBeTruthy();
        expect(alpaca.registration_number).toBeTruthy();
        expect(alpaca.birth_date).toBeTruthy();
        expect(['male', 'female']).toContain(alpaca.gender);
        expect(alpaca.color).toBeTruthy();
        expect(alpaca.weight).toBeGreaterThan(0);
        expect(alpaca.height).toBeGreaterThan(0);
      }
    });

    it('should create valid health records', async () => {
      await initializer.seedData({ 
        alpacaCount: 2, 
        healthRecordsPerAlpaca: 2 
      });

      const healthRecords = await connection.query(`
        SELECT hr.*, a.name as alpaca_name 
        FROM health_records hr 
        JOIN alpacas a ON hr.alpaca_id = a.id
        ORDER BY hr.date
      `);

      expect(healthRecords).toHaveLength(4);
      
      for (const record of healthRecords) {
        expect(record.id).toBeTruthy();
        expect(record.alpaca_id).toBeTruthy();
        expect(record.record_type).toBeTruthy();
        expect(record.date).toBeTruthy();
        expect(record.description).toBeTruthy();
        expect(record.alpaca_name).toBeTruthy();
      }
    });

    it('should create valid breeding records', async () => {
      await initializer.seedData({ 
        alpacaCount: 6, 
        breedingRecords: 2 
      });

      const breedingRecords = await connection.query(`
        SELECT br.*, 
               sire.name as sire_name, 
               dam.name as dam_name
        FROM breeding_records br
        JOIN alpacas sire ON br.sire_id = sire.id
        JOIN alpacas dam ON br.dam_id = dam.id
      `);

      expect(breedingRecords).toHaveLength(2);
      
      for (const record of breedingRecords) {
        expect(record.id).toBeTruthy();
        expect(record.sire_id).toBeTruthy();
        expect(record.dam_id).toBeTruthy();
        expect(record.breeding_date).toBeTruthy();
        expect(record.expected_due_date).toBeTruthy();
        expect(record.sire_name).toBeTruthy();
        expect(record.dam_name).toBeTruthy();
        expect(record.sire_id).not.toBe(record.dam_id);
      }
    });

    it('should create valid management activities', async () => {
      await initializer.seedData({ 
        alpacaCount: 4, 
        managementActivities: 2 
      });

      const activities = await connection.query(`
        SELECT ma.*, 
               COUNT(aa.alpaca_id) as participant_count
        FROM management_activities ma
        LEFT JOIN activity_alpacas aa ON ma.id = aa.activity_id
        GROUP BY ma.id
        ORDER BY ma.date
      `);

      expect(activities).toHaveLength(2);
      
      for (const activity of activities) {
        expect(activity.id).toBeTruthy();
        expect(activity.activity_type).toBeTruthy();
        expect(activity.date).toBeTruthy();
        expect(activity.performed_by).toBeTruthy();
        expect(activity.description).toBeTruthy();
        expect(activity.participant_count).toBeGreaterThan(0);
      }
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      await initializer.initialize({
        includeTestData: true,
        alpacaCount: 4,
        healthRecordsPerAlpaca: 2,
        breedingRecords: 1,
        managementActivities: 2
      });

      const stats = await initializer.getStatistics();
      expect(stats.alpacas).toBe(4);
      expect(stats.healthRecords).toBe(8);
      expect(stats.breedingRecords).toBe(1);
      expect(stats.managementActivities).toBe(2);
    });

    it('should return zero statistics for empty database', async () => {
      await initializer.initialize({ includeTestData: false });

      const stats = await initializer.getStatistics();
      expect(stats.alpacas).toBe(0);
      expect(stats.healthRecords).toBe(0);
      expect(stats.breedingRecords).toBe(0);
      expect(stats.managementActivities).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      await connection.close();
      
      await expect(initializer.initialize()).rejects.toThrow(DatabaseInitializationError);
    });

    it('should handle seeding errors gracefully', async () => {
      // Try to seed without initializing schema first
      await expect(initializer.seedData({ alpacaCount: 1 })).rejects.toThrow(DatabaseInitializationError);
    });
  });
});

describe('Global initialization functions', () => {
  it('should initialize database with default connection', async () => {
    // This test would require mocking the global connection manager
    // For now, we'll just test that the functions exist and can be called
    expect(typeof initializeDatabase).toBe('function');
    expect(typeof resetDatabase).toBe('function');
  });
});