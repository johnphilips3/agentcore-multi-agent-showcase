import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PerformanceTestSetup, PerformanceCollector, PerformanceTestConfig } from './performance-setup';
import { AlpacaServiceImpl } from '../../services/alpaca-service';
import { HealthServiceImpl } from '../../services/health-service';
import { BreedingServiceImpl } from '../../services/breeding-service';
import { ActivityServiceImpl } from '../../services/activity-service';

describe('Query Performance Tests', () => {
  let testSetup: PerformanceTestSetup;
  let performanceCollector: PerformanceCollector;
  let alpacaService: AlpacaServiceImpl;
  let healthService: HealthServiceImpl;
  let breedingService: BreedingServiceImpl;
  let activityService: ActivityServiceImpl;

  const LARGE_DATASET_CONFIG: PerformanceTestConfig = {
    alpacaCount: 1000,
    healthRecordsPerAlpaca: 10,
    breedingRecords: 200,
    activitiesPerAlpaca: 5,
    concurrentOperations: 10
  };

  beforeAll(async () => {
    testSetup = new PerformanceTestSetup(LARGE_DATASET_CONFIG);
    await testSetup.setup();

    const repos = testSetup.getRepositories();
    alpacaService = new AlpacaServiceImpl(repos.alpacaRepo, repos.breedingRepo);
    healthService = new HealthServiceImpl(repos.healthRepo, repos.alpacaRepo);
    breedingService = new BreedingServiceImpl(repos.breedingRepo, repos.alpacaRepo);
    activityService = new ActivityServiceImpl(repos.activityRepo, repos.alpacaRepo);

    performanceCollector = new PerformanceCollector();
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    await testSetup.teardown();
    console.log('\n' + performanceCollector.generateReport());
  });  describe
('Large Dataset Query Performance', () => {
    it('should retrieve all alpacas within performance threshold', async () => {
      const { result, metrics } = await performanceCollector.measureOperation(
        'getAllAlpacas',
        LARGE_DATASET_CONFIG.alpacaCount,
        () => alpacaService.getAllAlpacas()
      );

      expect(result.length).toBe(LARGE_DATASET_CONFIG.alpacaCount);
      expect(metrics.duration).toBeLessThan(1000); // Should complete within 1 second
      expect(metrics.throughput).toBeGreaterThan(500); // At least 500 records/sec
    });

    it('should perform paginated queries efficiently', async () => {
      const pageSize = 50;
      const totalPages = Math.ceil(LARGE_DATASET_CONFIG.alpacaCount / pageSize);
      
      const { result, metrics } = await performanceCollector.measureOperation(
        'paginatedAlpacaQuery',
        totalPages,
        async () => {
          const results = [];
          for (let page = 0; page < totalPages; page++) {
            const alpacas = await alpacaService.getAllAlpacas({
              limit: pageSize,
              offset: page * pageSize
            });
            results.push(...alpacas);
          }
          return results;
        }
      );

      expect(result.length).toBe(LARGE_DATASET_CONFIG.alpacaCount);
      expect(metrics.duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should filter alpacas by gender efficiently', async () => {
      const { result, metrics } = await performanceCollector.measureOperation(
        'filterAlpacasByGender',
        LARGE_DATASET_CONFIG.alpacaCount,
        () => alpacaService.getAlpacasByGender('female')
      );

      expect(result.length).toBeGreaterThan(0);
      expect(metrics.duration).toBeLessThan(500); // Should complete within 500ms
      expect(metrics.throughput).toBeGreaterThan(1000); // At least 1000 records/sec
    });

    it('should retrieve health records by date range efficiently', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2024-12-31');
      
      const { result, metrics } = await performanceCollector.measureOperation(
        'healthRecordsByDateRange',
        LARGE_DATASET_CONFIG.alpacaCount * LARGE_DATASET_CONFIG.healthRecordsPerAlpaca,
        () => healthService.getHealthRecordsByDateRange(startDate, endDate)
      );

      expect(result.length).toBeGreaterThan(0);
      expect(metrics.duration).toBeLessThan(1500); // Should complete within 1.5 seconds
    });
  });  descr
ibe('Complex Query Performance', () => {
    it('should generate lineage trees efficiently', async () => {
      // Get a few alpacas to test lineage generation
      const alpacas = await alpacaService.getAllAlpacas({ limit: 10 });
      
      const { result, metrics } = await performanceCollector.measureOperation(
        'lineageGeneration',
        10,
        async () => {
          const lineages = [];
          for (const alpaca of alpacas) {
            const lineage = await alpacaService.getLineage(alpaca.id, 3);
            if (lineage) lineages.push(lineage);
          }
          return lineages;
        }
      );

      expect(metrics.duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should perform breeding compatibility checks efficiently', async () => {
      const males = await alpacaService.getAlpacasByGender('male');
      const females = await alpacaService.getAlpacasByGender('female');
      
      const testPairs = Math.min(20, males.length, females.length);
      
      const { result, metrics } = await performanceCollector.measureOperation(
        'breedingCompatibilityChecks',
        testPairs,
        async () => {
          const results = [];
          for (let i = 0; i < testPairs; i++) {
            const compatibility = await breedingService.checkBreedingCompatibility(
              males[i].id,
              females[i].id
            );
            results.push(compatibility);
          }
          return results;
        }
      );

      expect(result.length).toBe(testPairs);
      expect(metrics.duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should aggregate activity data efficiently', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2024-12-31');
      
      const { result, metrics } = await performanceCollector.measureOperation(
        'activityAggregation',
        LARGE_DATASET_CONFIG.alpacaCount * LARGE_DATASET_CONFIG.activitiesPerAlpaca,
        async () => {
          const activities = await activityService.getActivitiesByDateRange(startDate, endDate);
          
          // Perform aggregation
          const aggregation = activities.reduce((acc, activity) => {
            acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          return aggregation;
        }
      );

      expect(Object.keys(result).length).toBeGreaterThan(0);
      expect(metrics.duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});