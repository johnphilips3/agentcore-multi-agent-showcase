import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PerformanceTestSetup, PerformanceCollector, PerformanceTestConfig } from './performance-setup';
import { AlpacaServiceImpl } from '../../services/alpaca-service';
import { HealthServiceImpl } from '../../services/health-service';

describe('Memory Usage Profiling', () => {
  let testSetup: PerformanceTestSetup;
  let performanceCollector: PerformanceCollector;
  let alpacaService: AlpacaServiceImpl;
  let healthService: HealthServiceImpl;

  const MEMORY_TEST_CONFIG: PerformanceTestConfig = {
    alpacaCount: 2000,
    healthRecordsPerAlpaca: 15,
    breedingRecords: 300,
    activitiesPerAlpaca: 8,
    concurrentOperations: 5
  };

  beforeAll(async () => {
    testSetup = new PerformanceTestSetup(MEMORY_TEST_CONFIG);
    await testSetup.setup();

    const repos = testSetup.getRepositories();
    alpacaService = new AlpacaServiceImpl(repos.alpacaRepo, repos.breedingRepo);
    healthService = new HealthServiceImpl(repos.healthRepo, repos.alpacaRepo);

    performanceCollector = new PerformanceCollector();
  }, 120000); // 2 minute timeout for large dataset

  afterAll(async () => {
    await testSetup.teardown();
    console.log('\n' + performanceCollector.generateReport());
  });  des
cribe('Large Dataset Memory Usage', () => {
    it('should handle large alpaca dataset without excessive memory usage', async () => {
      const { result, metrics } = await performanceCollector.measureOperation(
        'largeAlpacaDatasetQuery',
        MEMORY_TEST_CONFIG.alpacaCount,
        () => alpacaService.getAllAlpacas()
      );

      expect(result.length).toBe(MEMORY_TEST_CONFIG.alpacaCount);
      
      // Memory usage should be reasonable (less than 100MB for 2000 records)
      const memoryUsageMB = (metrics.memoryUsage?.heapUsed || 0) / 1024 / 1024;
      expect(memoryUsageMB).toBeLessThan(100);
      
      console.log(`Memory usage for ${MEMORY_TEST_CONFIG.alpacaCount} alpacas: ${memoryUsageMB.toFixed(2)}MB`);
    });

    it('should handle large health record dataset efficiently', async () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2024-12-31');
      
      const { result, metrics } = await performanceCollector.measureOperation(
        'largeHealthRecordQuery',
        MEMORY_TEST_CONFIG.alpacaCount * MEMORY_TEST_CONFIG.healthRecordsPerAlpaca,
        () => healthService.getHealthRecordsByDateRange(startDate, endDate)
      );

      expect(result.length).toBeGreaterThan(0);
      
      // Memory usage should be reasonable for health records
      const memoryUsageMB = (metrics.memoryUsage?.heapUsed || 0) / 1024 / 1024;
      expect(memoryUsageMB).toBeLessThan(200);
      
      console.log(`Memory usage for ${result.length} health records: ${memoryUsageMB.toFixed(2)}MB`);
    });

    it('should handle paginated queries with consistent memory usage', async () => {
      const pageSize = 100;
      const totalPages = Math.ceil(MEMORY_TEST_CONFIG.alpacaCount / pageSize);
      let maxMemoryUsage = 0;
      let totalRecords = 0;

      for (let page = 0; page < Math.min(totalPages, 10); page++) {
        const { result, metrics } = await performanceCollector.measureOperation(
          `paginatedQuery_page_${page}`,
          pageSize,
          () => alpacaService.getAllAlpacas({
            limit: pageSize,
            offset: page * pageSize
          })
        );

        totalRecords += result.length;
        const memoryUsageMB = (metrics.memoryUsage?.heapUsed || 0) / 1024 / 1024;
        maxMemoryUsage = Math.max(maxMemoryUsage, memoryUsageMB);
      }

      // Memory usage should remain consistent across pages
      expect(maxMemoryUsage).toBeLessThan(50); // Should not exceed 50MB per page
      expect(totalRecords).toBeGreaterThan(0);
      
      console.log(`Max memory usage per page: ${maxMemoryUsage.toFixed(2)}MB`);
    });
  });