/**
 * Mock repository factory functions for consistent mocking patterns
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { vi } from 'vitest';
import { 
  Alpaca, 
  CreateAlpacaInput, 
  UpdateAlpacaInput 
} from '../models/alpaca';
import { 
  HealthRecord, 
  CreateHealthRecordInput, 
  UpdateHealthRecordInput 
} from '../models/health-record';
import { 
  BreedingRecord, 
  CreateBreedingRecordInput, 
  UpdateBreedingRecordInput 
} from '../models/breeding-record';
import { 
  ManagementActivity, 
  CreateManagementActivityInput, 
  UpdateManagementActivityInput 
} from '../models/management-activity';
import { QueryOptions } from '../models/common';
import { PaginatedResult } from '../repositories/pg-alpaca-repository';

/**
 * Interface definitions for repository mocks
 */
export interface MockAlpacaRepository {
  create: ReturnType<typeof vi.fn<(input: CreateAlpacaInput) => Promise<Alpaca>>>;
  findById: ReturnType<typeof vi.fn<(id: string) => Promise<Alpaca | null>>>;
  findAll: ReturnType<typeof vi.fn<(options?: QueryOptions) => Promise<PaginatedResult<Alpaca>>>>;
  update: ReturnType<typeof vi.fn<(id: string, input: UpdateAlpacaInput) => Promise<Alpaca | null>>>;
  delete: ReturnType<typeof vi.fn<(id: string) => Promise<boolean>>>;
  search: ReturnType<typeof vi.fn<(query: string, options?: QueryOptions) => Promise<PaginatedResult<Alpaca>>>>;
  findByGender: ReturnType<typeof vi.fn<(gender: 'male' | 'female', options?: QueryOptions) => Promise<PaginatedResult<Alpaca>>>>;
}

export interface MockHealthRepository {
  create: ReturnType<typeof vi.fn<(input: CreateHealthRecordInput) => Promise<HealthRecord>>>;
  findById: ReturnType<typeof vi.fn<(id: string) => Promise<HealthRecord | null>>>;
  findAll: ReturnType<typeof vi.fn<(options?: QueryOptions) => Promise<PaginatedResult<HealthRecord>>>>;
  update: ReturnType<typeof vi.fn<(id: string, input: UpdateHealthRecordInput) => Promise<HealthRecord | null>>>;
  delete: ReturnType<typeof vi.fn<(id: string) => Promise<boolean>>>;
  findByAlpaca: ReturnType<typeof vi.fn<(alpacaId: string, options?: QueryOptions) => Promise<PaginatedResult<HealthRecord>>>>;
  findByRecordType: ReturnType<typeof vi.fn<(recordType: string, options?: QueryOptions) => Promise<PaginatedResult<HealthRecord>>>>;
  getOverdueVaccinations: ReturnType<typeof vi.fn<() => Promise<HealthRecord[]>>>;
  findByDateRange: ReturnType<typeof vi.fn<(startDate: Date, endDate: Date, options?: QueryOptions) => Promise<PaginatedResult<HealthRecord>>>>;
}

export interface MockBreedingRepository {
  create: ReturnType<typeof vi.fn<(input: CreateBreedingRecordInput) => Promise<BreedingRecord>>>;
  findById: ReturnType<typeof vi.fn<(id: string) => Promise<BreedingRecord | null>>>;
  findAll: ReturnType<typeof vi.fn<(options?: QueryOptions) => Promise<PaginatedResult<BreedingRecord>>>>;
  update: ReturnType<typeof vi.fn<(id: string, input: UpdateBreedingRecordInput) => Promise<BreedingRecord | null>>>;
  delete: ReturnType<typeof vi.fn<(id: string) => Promise<boolean>>>;
  findBySire: ReturnType<typeof vi.fn<(sireId: string, options?: QueryOptions) => Promise<PaginatedResult<BreedingRecord>>>>;
  findByDam: ReturnType<typeof vi.fn<(damId: string, options?: QueryOptions) => Promise<PaginatedResult<BreedingRecord>>>>;
  findByParent: ReturnType<typeof vi.fn<(parentField: 'sire_id' | 'dam_id', parentId: string, options?: QueryOptions) => Promise<PaginatedResult<BreedingRecord>>>>;
  findByDateRange: ReturnType<typeof vi.fn<(startDate: Date, endDate: Date, options?: QueryOptions) => Promise<PaginatedResult<BreedingRecord>>>>;
  getExpectedBirths: ReturnType<typeof vi.fn<(daysAhead?: number) => Promise<BreedingRecord[]>>>;
}

export interface MockActivityRepository {
  create: ReturnType<typeof vi.fn<(input: CreateManagementActivityInput, alpacaIds: string[]) => Promise<ManagementActivity>>>;
  findById: ReturnType<typeof vi.fn<(id: string) => Promise<ManagementActivity | null>>>;
  findAll: ReturnType<typeof vi.fn<(options?: QueryOptions) => Promise<PaginatedResult<ManagementActivity>>>>;
  update: ReturnType<typeof vi.fn<(id: string, input: UpdateManagementActivityInput, alpacaIds?: string[]) => Promise<ManagementActivity | null>>>;
  delete: ReturnType<typeof vi.fn<(id: string) => Promise<boolean>>>;
  findByAlpaca: ReturnType<typeof vi.fn<(alpacaId: string, options?: QueryOptions) => Promise<PaginatedResult<ManagementActivity>>>>;
  findByActivityType: ReturnType<typeof vi.fn<(activityType: string, options?: QueryOptions) => Promise<PaginatedResult<ManagementActivity>>>>;
  findByPerformer: ReturnType<typeof vi.fn<(performer: string, options?: QueryOptions) => Promise<PaginatedResult<ManagementActivity>>>>;
  findByDateRange: ReturnType<typeof vi.fn<(startDate: Date, endDate: Date, options?: QueryOptions) => Promise<PaginatedResult<ManagementActivity>>>>;
}

/**
 * Factory for creating mock Alpaca repository
 */
export class MockAlpacaRepositoryFactory {
  /**
   * Creates a mock alpaca repository with all methods
   */
  static create(): MockAlpacaRepository {
    return {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
      findByGender: vi.fn()
    };
  }

  /**
   * Creates a mock repository with successful default implementations
   */
  static createWithDefaults(mockData: {
    alpacas?: Alpaca[];
    defaultAlpaca?: Alpaca;
  } = {}): MockAlpacaRepository {
    const { alpacas = [], defaultAlpaca } = mockData;
    const mock = this.create();

    const paginatedResult = {
      data: alpacas,
      total: alpacas.length,
      page: 1,
      limit: 20,
      totalPages: Math.ceil(alpacas.length / 20)
    };

    // Default successful implementations
    mock.create.mockResolvedValue(defaultAlpaca || alpacas[0]);
    mock.findById.mockImplementation(async (id: string) => 
      alpacas.find(a => a.id === id) || null
    );
    mock.findAll.mockResolvedValue(paginatedResult);
    mock.update.mockResolvedValue(defaultAlpaca || alpacas[0]);
    mock.delete.mockResolvedValue(true);
    mock.search.mockResolvedValue(paginatedResult);
    mock.findByGender.mockImplementation(async (gender: 'male' | 'female') => ({
      data: alpacas.filter(a => a.gender === gender),
      total: alpacas.filter(a => a.gender === gender).length,
      page: 1,
      limit: 20,
      totalPages: 1
    }));

    return mock;
  }

  /**
   * Creates a mock repository that throws errors
   */
  static createWithErrors(): MockAlpacaRepository {
    const mock = this.create();
    const error = new Error('Database connection failed');

    Object.values(mock).forEach(mockFn => {
      mockFn.mockRejectedValue(error);
    });

    return mock;
  }
}

/**
 * Factory for creating mock Health repository
 */
export class MockHealthRepositoryFactory {
  /**
   * Creates a mock health repository with all methods
   */
  static create(): MockHealthRepository {
    return {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByAlpaca: vi.fn(),
      findByRecordType: vi.fn(),
      getOverdueVaccinations: vi.fn(),
      findByDateRange: vi.fn()
    };
  }

  /**
   * Creates a mock repository with successful default implementations
   */
  static createWithDefaults(mockData: {
    healthRecords?: HealthRecord[];
    defaultRecord?: HealthRecord;
  } = {}): MockHealthRepository {
    const { healthRecords = [], defaultRecord } = mockData;
    const mock = this.create();

    const paginatedResult = {
      data: healthRecords,
      total: healthRecords.length,
      page: 1,
      limit: 20,
      totalPages: Math.ceil(healthRecords.length / 20)
    };

    mock.create.mockResolvedValue(defaultRecord || healthRecords[0]);
    mock.findById.mockImplementation(async (id: string) =>
      healthRecords.find(r => r.id === id) || null
    );
    mock.findAll.mockResolvedValue(paginatedResult);
    mock.update.mockResolvedValue(defaultRecord || healthRecords[0]);
    mock.delete.mockResolvedValue(true);
    mock.findByAlpaca.mockImplementation(async (alpacaId: string) => ({
      data: healthRecords.filter(r => r.alpacaId === alpacaId),
      total: healthRecords.filter(r => r.alpacaId === alpacaId).length,
      page: 1,
      limit: 20,
      totalPages: 1
    }));
    mock.findByRecordType.mockImplementation(async (recordType: string) => ({
      data: healthRecords.filter(r => r.recordType === recordType),
      total: healthRecords.filter(r => r.recordType === recordType).length,
      page: 1,
      limit: 20,
      totalPages: 1
    }));
    mock.getOverdueVaccinations.mockResolvedValue(
      healthRecords.filter(r => r.nextDueDate && r.nextDueDate < new Date())
    );
    mock.findByDateRange.mockResolvedValue(paginatedResult);

    return mock;
  }

  /**
   * Creates a mock repository that throws errors
   */
  static createWithErrors(): MockHealthRepository {
    const mock = this.create();
    const error = new Error('Database connection failed');

    Object.values(mock).forEach(mockFn => {
      mockFn.mockRejectedValue(error);
    });

    return mock;
  }
}

/**
 * Factory for creating mock Breeding repository
 */
export class MockBreedingRepositoryFactory {
  /**
   * Creates a mock breeding repository with all methods
   */
  static create(): MockBreedingRepository {
    return {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findBySire: vi.fn(),
      findByDam: vi.fn(),
      findByParent: vi.fn(),
      findByDateRange: vi.fn(),
      getExpectedBirths: vi.fn()
    };
  }

  /**
   * Creates a mock repository with successful default implementations
   */
  static createWithDefaults(mockData: {
    breedingRecords?: BreedingRecord[];
    defaultRecord?: BreedingRecord;
  } = {}): MockBreedingRepository {
    const { breedingRecords = [], defaultRecord } = mockData;
    const mock = this.create();

    const paginatedResult = {
      data: breedingRecords,
      total: breedingRecords.length,
      page: 1,
      limit: 20,
      totalPages: Math.ceil(breedingRecords.length / 20)
    };

    mock.create.mockResolvedValue(defaultRecord || breedingRecords[0]);
    mock.findById.mockImplementation(async (id: string) =>
      breedingRecords.find(r => r.id === id) || null
    );
    mock.findAll.mockResolvedValue(paginatedResult);
    mock.update.mockResolvedValue(defaultRecord || breedingRecords[0]);
    mock.delete.mockResolvedValue(true);
    mock.findBySire.mockImplementation(async (sireId: string) => ({
      data: breedingRecords.filter(r => r.sireId === sireId),
      total: breedingRecords.filter(r => r.sireId === sireId).length,
      page: 1,
      limit: 20,
      totalPages: 1
    }));
    mock.findByDam.mockImplementation(async (damId: string) => ({
      data: breedingRecords.filter(r => r.damId === damId),
      total: breedingRecords.filter(r => r.damId === damId).length,
      page: 1,
      limit: 20,
      totalPages: 1
    }));
    mock.findByParent.mockResolvedValue(paginatedResult);
    mock.findByDateRange.mockResolvedValue(paginatedResult);
    mock.getExpectedBirths.mockResolvedValue(breedingRecords.filter(r => r.expectedDueDate && !r.actualBirthDate));

    return mock;
  }

  /**
   * Creates a mock repository that throws errors
   */
  static createWithErrors(): MockBreedingRepository {
    const mock = this.create();
    const error = new Error('Database connection failed');

    Object.values(mock).forEach(mockFn => {
      mockFn.mockRejectedValue(error);
    });

    return mock;
  }
}

/**
 * Factory for creating mock Activity repository
 */
export class MockActivityRepositoryFactory {
  /**
   * Creates a mock activity repository with all methods
   */
  static create(): MockActivityRepository {
    return {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByAlpaca: vi.fn(),
      findByActivityType: vi.fn(),
      findByPerformer: vi.fn(),
      findByDateRange: vi.fn()
    };
  }

  /**
   * Creates a mock repository with successful default implementations
   */
  static createWithDefaults(mockData: {
    activities?: ManagementActivity[];
    defaultActivity?: ManagementActivity;
  } = {}): MockActivityRepository {
    const { activities = [], defaultActivity } = mockData;
    const mock = this.create();

    const paginatedResult = {
      data: activities,
      total: activities.length,
      page: 1,
      limit: 20,
      totalPages: Math.ceil(activities.length / 20)
    };

    mock.create.mockResolvedValue(defaultActivity || activities[0]);
    mock.findById.mockImplementation(async (id: string) =>
      activities.find(a => a.id === id) || null
    );
    mock.findAll.mockResolvedValue(paginatedResult);
    mock.update.mockResolvedValue(defaultActivity || activities[0]);
    mock.delete.mockResolvedValue(true);
    mock.findByAlpaca.mockImplementation(async (alpacaId: string) => ({
      data: activities.filter(a => a.alpacaIds.includes(alpacaId)),
      total: activities.filter(a => a.alpacaIds.includes(alpacaId)).length,
      page: 1,
      limit: 20,
      totalPages: 1
    }));
    mock.findByActivityType.mockImplementation(async (activityType: string) => ({
      data: activities.filter(a => a.activityType === activityType),
      total: activities.filter(a => a.activityType === activityType).length,
      page: 1,
      limit: 20,
      totalPages: 1
    }));
    mock.findByPerformer.mockImplementation(async (performer: string) => ({
      data: activities.filter(a => a.performedBy === performer),
      total: activities.filter(a => a.performedBy === performer).length,
      page: 1,
      limit: 20,
      totalPages: 1
    }));
    mock.findByDateRange.mockImplementation(async (startDate: Date, endDate: Date) => ({
      data: activities.filter(a => a.date >= startDate && a.date <= endDate),
      total: activities.filter(a => a.date >= startDate && a.date <= endDate).length,
      page: 1,
      limit: 20,
      totalPages: 1
    }));

    return mock;
  }

  /**
   * Creates a mock repository that throws errors
   */
  static createWithErrors(): MockActivityRepository {
    const mock = this.create();
    const error = new Error('Database connection failed');

    Object.values(mock).forEach(mockFn => {
      mockFn.mockRejectedValue(error);
    });

    return mock;
  }
}

/**
 * Factory for creating mock service dependencies
 */
export class MockServiceFactory {
  /**
   * Creates mock AWS services
   */
  static createAWSMocks() {
    return {
      s3: {
        upload: vi.fn(),
        download: vi.fn(),
        delete: vi.fn(),
        listObjects: vi.fn()
      },
      rds: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        query: vi.fn(),
        transaction: vi.fn()
      },
      config: {
        getConfig: vi.fn(),
        validateConfig: vi.fn()
      }
    };
  }

  /**
   * Creates mock database connection
   */
  static createDatabaseMock() {
    return {
      query: vi.fn(),
      transaction: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true)
    };
  }

  /**
   * Creates mock Express request object
   */
  static createMockRequest(overrides: any = {}) {
    return {
      params: {},
      query: {},
      body: {},
      headers: {},
      user: null,
      ...overrides
    };
  }

  /**
   * Creates mock Express response object
   */
  static createMockResponse() {
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      locals: {}
    };
    return res;
  }

  /**
   * Creates mock Express next function
   */
  static createMockNext() {
    return vi.fn();
  }
}

/**
 * Utility for setting up common mock scenarios
 */
export class MockScenarios {
  /**
   * Sets up a successful repository operation scenario
   */
  static setupSuccessScenario<T>(
    mockRepo: any,
    method: string,
    returnValue: T
  ): void {
    mockRepo[method].mockResolvedValue(returnValue);
  }

  /**
   * Sets up a repository error scenario
   */
  static setupErrorScenario(
    mockRepo: any,
    method: string,
    error: Error = new Error('Repository error')
  ): void {
    mockRepo[method].mockRejectedValue(error);
  }

  /**
   * Sets up a not found scenario
   */
  static setupNotFoundScenario(mockRepo: any, method: string): void {
    mockRepo[method].mockResolvedValue(null);
  }

  /**
   * Sets up validation error scenario
   */
  static setupValidationErrorScenario(
    mockRepo: any,
    method: string,
    validationErrors: string[]
  ): void {
    const error = new Error('Validation failed');
    (error as any).validationErrors = validationErrors;
    mockRepo[method].mockRejectedValue(error);
  }

  /**
   * Resets all mocks in a repository
   */
  static resetRepositoryMocks(mockRepo: any): void {
    Object.values(mockRepo).forEach((mockFn: any) => {
      if (typeof mockFn.mockReset === 'function') {
        mockFn.mockReset();
      }
    });
  }
}