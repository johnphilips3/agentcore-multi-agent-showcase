import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PerformanceTestSetup, PerformanceCollector, PerformanceTestConfig } from './performance-setup';
import { AlpacaServiceImpl } from '../../services/alpaca-service';
import { HealthServiceImpl } from '../../services/health-service';
import { ActivityServiceImpl } from '../../services/activity-service';

describe('Load Testing - Concurrent Operations', () => {
  let testSetup: PerformanceTestSetup;
  let performanceCollector: PerformanceCollector;
  let alpacaService: AlpacaServiceImpl;
  let healthService: HealthServiceImpl;
  let activityService: ActivityServiceImpl;

  const LOAD_TEST_CONFIG: PerformanceTestConfig = {
    alpacaCount: 500,
    healthRecordsPerAlpaca: 5,
    breedingRecords: 100,
    activitiesPerAlpaca: 3,
    concurrentOperations: 20
  };

  beforeAll(async () => {
    testSetup = new PerformanceTestSetup(LOAD_TEST_CONFIG);
    await testSetup.setup();

    const repos = testSetup.getRepositories();
    alpacaService = new AlpacaServiceImpl(repos.alpacaRepo, repos.breedingRepo);
    healthService = new HealthServiceImpl(repos.healthRepo, repos.alpacaRepo);
    activityService = new ActivityServiceImpl(repos.activityRepo, repos.alpacaRepo);

    performanceCollector = new PerformanceCollector();
  }, 60000);

  afterAll(async () => {
    await testSetup.teardown();
    console.log('\n' + performanceCollector.generateReport());
  });  
describe('Concurrent Read Operations', () => {
    it('should handle concurrent alpaca queries', async () => {
      const concurrentQueries = Array.from({ length: LOAD_TEST_CONFIG.concurrentOperations }, 
        (_, i) => () => alpacaService.getAllAlpacas({ 
          limit: 50, 
          offset: i * 25 
        })
      );

      const { result, metrics } = await performanceCollector.measureOperation(
        'concurrentAlpacaQueries',
        LOAD_TEST_CONFIG.concurrentOperations,
        () => Promise.all(concurrentQueries.map(query => query()))
      );

      expect(result.length).toBe(LOAD_TEST_CONFIG.concurrentOperations);
      expect(metrics.duration).toBeLessThan(3000); // Should complete within 3 seconds
      
      // Verify all queries returned results
      result.forEach(queryResult => {
        expect(queryResult.length).toBeGreaterThan(0);
      });
    });

    it('should handle concurrent health record queries', async () => {
      // Get some alpaca IDs for testing
      const alpacas = await alpacaService.getAllAlpacas({ limit: LOAD_TEST_CONFIG.concurrentOperations });
      
      const concurrentQueries = alpacas.map(alpaca => 
        () => healthService.getAlpacaHealthRecords(alpaca.id)
      );

      const { result, metrics } = await performanceCollector.measureOperation(
        'concurrentHealthQueries',
        LOAD_TEST_CONFIG.concurrentOperations,
        () => Promise.all(concurrentQueries.map(query => query()))
      );

      expect(result.length).toBe(LOAD_TEST_CONFIG.concurrentOperations);
      expect(metrics.duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent activity queries', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2024-12-31');
      
      const concurrentQueries = Array.from({ length: LOAD_TEST_CONFIG.concurrentOperations }, 
        () => () => activityService.getActivitiesByDateRange(startDate, endDate)
      );

      const { result, metrics } = await performanceCollector.measureOperation(
        'concurrentActivityQueries',
        LOAD_TEST_CONFIG.concurrentOperations,
        () => Promise.all(concurrentQueries.map(query => query()))
      );

      expect(result.length).toBe(LOAD_TEST_CONFIG.concurrentOperations);
      expect(metrics.duration).toBeLessThan(4000); // Should complete within 4 seconds
    });
  }); 
 describe('Concurrent Write Operations', () => {
    it('should handle concurrent alpaca registrations', async () => {
      const concurrentRegistrations = Array.from({ length: 10 }, (_, i) => 
        () => alpacaService.registerAlpaca({
          name: `Load Test Alpaca ${i}`,
          birthDate: new Date('2024-01-01'),
          gender: i % 2 === 0 ? 'male' : 'female',
          color: 'test-color'
        })
      );

      const { result, metrics } = await performanceCollector.measureOperation(
        'concurrentAlpacaRegistrations',
        10,
        () => Promise.all(concurrentRegistrations.map(reg => reg()))
      );

      expect(result.length).toBe(10);
      expect(metrics.duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify all registrations were successful
      result.forEach(regResult => {
        expect(regResult.success).toBe(true);
        expect(regResult.alpaca).toBeDefined();
      });
    });

    it('should handle concurrent health record creation', async () => {
      // Get some alpacas for testing
      const alpacas = await alpacaService.getAllAlpacas({ limit: 10 });
      
      const concurrentHealthRecords = alpacas.map((alpaca, i) => 
        () => healthService.createHealthRecord({
          alpacaId: alpaca.id,
          recordType: 'observation',
          date: new Date('2024-01-01'),
          description: `Load test observation ${i}`
        })
      );

      const { result, metrics } = await performanceCollector.measureOperation(
        'concurrentHealthRecordCreation',
        10,
        () => Promise.all(concurrentHealthRecords.map(create => create()))
      );

      expect(result.length).toBe(10);
      expect(metrics.duration).toBeLessThan(3000); // Should complete within 3 seconds
      
      // Verify all health records were created
      result.forEach(healthRecord => {
        expect(healthRecord.id).toBeDefined();
        expect(healthRecord.description).toContain('Load test observation');
      });
    });

    it('should handle mixed read/write operations', async () => {
      const alpacas = await alpacaService.getAllAlpacas({ limit: 5 });
      
      const mixedOperations = [
        // Read operations
        ...Array.from({ length: 5 }, () => () => alpacaService.getAllAlpacas({ limit: 10 })),
        // Write operations
        ...alpacas.map((alpaca, i) => () => healthService.createHealthRecord({
          alpacaId: alpaca.id,
          recordType: 'observation',
          date: new Date('2024-01-01'),
          description: `Mixed operation test ${i}`
        }))
      ];

      const { result, metrics } = await performanceCollector.measureOperation(
        'mixedReadWriteOperations',
        mixedOperations.length,
        () => Promise.all(mixedOperations.map(op => op()))
      );

      expect(result.length).toBe(mixedOperations.length);
      expect(metrics.duration).toBeLessThan(4000); // Should complete within 4 seconds
    });
  });
});