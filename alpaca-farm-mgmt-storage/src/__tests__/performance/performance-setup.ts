import { DatabaseConnection, getConnectionManager, DatabaseConfig } from '../../database/connection';
import { DatabaseInitializer } from '../../database/initializer';
import { MigrationRunner } from '../../database/migration';
import { AlpacaRepositoryImpl } from '../../repositories/alpaca-repository';
import { HealthRepositoryImpl } from '../../repositories/health-repository';
import { BreedingRepositoryImpl } from '../../repositories/breeding-repository';
import { ActivityRepositoryImpl } from '../../repositories/activity-repository';

export interface PerformanceTestConfig {
  alpacaCount: number;
  healthRecordsPerAlpaca: number;
  breedingRecords: number;
  activitiesPerAlpaca: number;
  concurrentOperations: number;
}

export class PerformanceTestSetup {
  private connection: DatabaseConnection | null = null;
  private initializer: DatabaseInitializer | null = null;
  private migration: MigrationRunner | null = null;

  constructor(private config: PerformanceTestConfig) {}

  async setup(): Promise<void> {
    const dbConfig: DatabaseConfig = {
      type: 'sqlite',
      database: ':memory:'
    };
    
    const connectionManager = getConnectionManager(dbConfig);
    this.connection = await connectionManager.getConnection();
    
    this.migration = new MigrationRunner(this.connection);
    this.initializer = new DatabaseInitializer(this.connection);
    
    await this.migration.migrate();
    
    // Generate large dataset for performance testing
    await this.initializer.seedData({
      alpacaCount: this.config.alpacaCount,
      healthRecordsPerAlpaca: this.config.healthRecordsPerAlpaca,
      breedingRecords: this.config.breedingRecords,
      managementActivities: this.config.activitiesPerAlpaca * this.config.alpacaCount,
      includeTestData: true
    });
  }  async 
teardown(): Promise<void> {
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

  getRepositories() {
    return {
      alpacaRepo: new AlpacaRepositoryImpl(),
      healthRepo: new HealthRepositoryImpl(),
      breedingRepo: new BreedingRepositoryImpl(),
      activityRepo: new ActivityRepositoryImpl()
    };
  }
}

export const createPerformanceTestSetup = (config: PerformanceTestConfig) => 
  new PerformanceTestSetup(config);

// Performance measurement utilities
export class PerformanceTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  stop(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  getElapsed(): number {
    return this.endTime - this.startTime;
  }
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  recordCount: number;
  throughput: number; // records per second
  memoryUsage?: NodeJS.MemoryUsage;
}

export class PerformanceCollector {
  private metrics: PerformanceMetrics[] = [];

  async measureOperation<T>(
    operation: string,
    recordCount: number,
    fn: () => Promise<T>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const timer = new PerformanceTimer();
    const memoryBefore = process.memoryUsage();
    
    timer.start();
    const result = await fn();
    const duration = timer.stop();
    
    const memoryAfter = process.memoryUsage();
    const memoryUsage = {
      rss: memoryAfter.rss - memoryBefore.rss,
      heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
      external: memoryAfter.external - memoryBefore.external,
      arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers
    };

    const metrics: PerformanceMetrics = {
      operation,
      duration,
      recordCount,
      throughput: recordCount / (duration / 1000),
      memoryUsage
    };

    this.metrics.push(metrics);
    return { result, metrics };
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  clear(): void {
    this.metrics = [];
  }

  generateReport(): string {
    const report = ['Performance Test Report', '='.repeat(50)];
    
    this.metrics.forEach(metric => {
      report.push(`\nOperation: ${metric.operation}`);
      report.push(`Duration: ${metric.duration.toFixed(2)}ms`);
      report.push(`Records: ${metric.recordCount}`);
      report.push(`Throughput: ${metric.throughput.toFixed(2)} records/sec`);
      
      if (metric.memoryUsage) {
        report.push(`Memory Delta: ${(metric.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }
    });

    return report.join('\n');
  }
}