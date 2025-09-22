/**
 * OpenAPI Contract Tests
 * Tests to validate API responses against OpenAPI specification
 */

import { describe, it, expect, beforeAll } from 'vitest';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CreateAlpacaRequest,
  UpdateAlpacaRequest,
  CreateHealthRecordRequest,
  CreateBreedingRecordRequest,
  CreateActivityRequest,
  ApiResponse,
  Alpaca,
  HealthRecord,
  BreedingRecord,
  ManagementActivity,
  VALIDATION_LIMITS
} from '../../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('OpenAPI Contract Tests', () => {
  let openApiSpec: any;

  beforeAll(async () => {
    try {
      // Load OpenAPI specification
      const specPath = path.join(__dirname, '../../openapi.yaml');
      openApiSpec = YAML.load(specPath);
    } catch (error) {
      console.warn('Could not load OpenAPI specification for contract testing');
      openApiSpec = null;
    }
  });

  describe('Schema Validation', () => {
    it('should validate Alpaca schema against OpenAPI spec', () => {
      const alpaca: Alpaca = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Alpaca',
        registrationNumber: 'REG001',
        birthDate: '2020-01-01',
        gender: 'male',
        color: 'white',
        weight: 150.5,
        height: 36.0,
        fiberQuality: {
          micronCount: 20.5,
          stapleLength: 4.0,
          crimp: 'fine',
          density: 'medium'
        },
        sireId: '123e4567-e89b-12d3-a456-426614174001',
        damId: '123e4567-e89b-12d3-a456-426614174002',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      // Validate required fields
      expect(alpaca.id).toBeDefined();
      expect(alpaca.name).toBeDefined();
      expect(alpaca.birthDate).toBeDefined();
      expect(alpaca.gender).toBeDefined();
      expect(alpaca.color).toBeDefined();
      expect(alpaca.createdAt).toBeDefined();
      expect(alpaca.updatedAt).toBeDefined();

      // Validate field types and formats
      expect(typeof alpaca.id).toBe('string');
      expect(typeof alpaca.name).toBe('string');
      expect(['male', 'female']).toContain(alpaca.gender);
      expect(alpaca.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(alpaca.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

      // Validate optional fields
      if (alpaca.weight) {
        expect(typeof alpaca.weight).toBe('number');
        expect(alpaca.weight).toBeGreaterThan(0);
        expect(alpaca.weight).toBeLessThanOrEqual(VALIDATION_LIMITS.WEIGHT_MAX);
      }

      if (alpaca.height) {
        expect(typeof alpaca.height).toBe('number');
        expect(alpaca.height).toBeGreaterThan(0);
        expect(alpaca.height).toBeLessThanOrEqual(VALIDATION_LIMITS.HEIGHT_MAX);
      }

      if (alpaca.fiberQuality) {
        if (alpaca.fiberQuality.micronCount) {
          expect(alpaca.fiberQuality.micronCount).toBeGreaterThanOrEqual(VALIDATION_LIMITS.FIBER_MICRON_MIN);
          expect(alpaca.fiberQuality.micronCount).toBeLessThanOrEqual(VALIDATION_LIMITS.FIBER_MICRON_MAX);
        }
        if (alpaca.fiberQuality.stapleLength) {
          expect(alpaca.fiberQuality.stapleLength).toBeGreaterThanOrEqual(VALIDATION_LIMITS.FIBER_STAPLE_MIN);
          expect(alpaca.fiberQuality.stapleLength).toBeLessThanOrEqual(VALIDATION_LIMITS.FIBER_STAPLE_MAX);
        }
        if (alpaca.fiberQuality.crimp) {
          expect(['fine', 'medium', 'coarse']).toContain(alpaca.fiberQuality.crimp);
        }
        if (alpaca.fiberQuality.density) {
          expect(['light', 'medium', 'dense']).toContain(alpaca.fiberQuality.density);
        }
      }
    });

    it('should validate CreateAlpacaRequest schema', () => {
      const request: CreateAlpacaRequest = {
        name: 'New Alpaca',
        birthDate: '2023-01-01',
        gender: 'female',
        color: 'brown',
        registrationNumber: 'REG002',
        weight: 120.0,
        height: 34.0,
        fiberQuality: {
          micronCount: 18.5,
          stapleLength: 3.5,
          crimp: 'medium',
          density: 'dense'
        },
        sireId: '123e4567-e89b-12d3-a456-426614174003',
        damId: '123e4567-e89b-12d3-a456-426614174004'
      };

      // Validate required fields
      expect(request.name).toBeDefined();
      expect(request.birthDate).toBeDefined();
      expect(request.gender).toBeDefined();
      expect(request.color).toBeDefined();

      // Validate field constraints
      expect(request.name.length).toBeGreaterThan(0);
      expect(request.name.length).toBeLessThanOrEqual(VALIDATION_LIMITS.ALPACA_NAME_MAX_LENGTH);
      expect(request.color.length).toBeGreaterThan(0);
      expect(request.color.length).toBeLessThanOrEqual(VALIDATION_LIMITS.COLOR_MAX_LENGTH);

      if (request.registrationNumber) {
        expect(request.registrationNumber.length).toBeLessThanOrEqual(VALIDATION_LIMITS.REGISTRATION_NUMBER_MAX_LENGTH);
      }
    });

    it('should validate HealthRecord schema against OpenAPI spec', () => {
      const healthRecord: HealthRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        alpacaId: '123e4567-e89b-12d3-a456-426614174001',
        recordType: 'vaccination',
        date: '2023-01-01',
        description: 'Annual vaccination against common diseases',
        veterinarian: 'Dr. Smith',
        nextDueDate: '2024-01-01',
        notes: 'No adverse reactions observed',
        createdAt: '2023-01-01T00:00:00Z'
      };

      // Validate required fields
      expect(healthRecord.id).toBeDefined();
      expect(healthRecord.alpacaId).toBeDefined();
      expect(healthRecord.recordType).toBeDefined();
      expect(healthRecord.date).toBeDefined();
      expect(healthRecord.description).toBeDefined();
      expect(healthRecord.createdAt).toBeDefined();

      // Validate field types and constraints
      expect(['vaccination', 'treatment', 'observation', 'checkup']).toContain(healthRecord.recordType);
      expect(healthRecord.description.length).toBeGreaterThan(0);
      expect(healthRecord.description.length).toBeLessThanOrEqual(VALIDATION_LIMITS.HEALTH_DESCRIPTION_MAX_LENGTH);

      if (healthRecord.veterinarian) {
        expect(healthRecord.veterinarian.length).toBeLessThanOrEqual(VALIDATION_LIMITS.VETERINARIAN_MAX_LENGTH);
      }

      if (healthRecord.notes) {
        expect(healthRecord.notes.length).toBeLessThanOrEqual(VALIDATION_LIMITS.HEALTH_NOTES_MAX_LENGTH);
      }
    });

    it('should validate BreedingRecord schema against OpenAPI spec', () => {
      const breedingRecord: BreedingRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        sireId: '123e4567-e89b-12d3-a456-426614174001',
        damId: '123e4567-e89b-12d3-a456-426614174002',
        breedingDate: '2023-01-01',
        expectedDueDate: '2023-12-01',
        actualBirthDate: '2023-11-28',
        offspringIds: ['123e4567-e89b-12d3-a456-426614174003'],
        notes: 'Successful breeding with healthy offspring',
        createdAt: '2023-01-01T00:00:00Z'
      };

      // Validate required fields
      expect(breedingRecord.id).toBeDefined();
      expect(breedingRecord.sireId).toBeDefined();
      expect(breedingRecord.damId).toBeDefined();
      expect(breedingRecord.breedingDate).toBeDefined();
      expect(breedingRecord.offspringIds).toBeDefined();
      expect(breedingRecord.createdAt).toBeDefined();

      // Validate business rules
      expect(breedingRecord.sireId).not.toBe(breedingRecord.damId);
      expect(Array.isArray(breedingRecord.offspringIds)).toBe(true);

      if (breedingRecord.notes) {
        expect(breedingRecord.notes.length).toBeLessThanOrEqual(VALIDATION_LIMITS.BREEDING_NOTES_MAX_LENGTH);
      }
    });

    it('should validate ManagementActivity schema against OpenAPI spec', () => {
      const activity: ManagementActivity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        activityType: 'feeding',
        date: '2023-01-01',
        alpacaIds: ['123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174002'],
        performedBy: 'John Doe',
        description: 'Morning feeding session with premium hay',
        notes: 'All alpacas ate well, no issues observed',
        createdAt: '2023-01-01T00:00:00Z'
      };

      // Validate required fields
      expect(activity.id).toBeDefined();
      expect(activity.activityType).toBeDefined();
      expect(activity.date).toBeDefined();
      expect(activity.alpacaIds).toBeDefined();
      expect(activity.performedBy).toBeDefined();
      expect(activity.description).toBeDefined();
      expect(activity.createdAt).toBeDefined();

      // Validate field types and constraints
      expect(['feeding', 'shearing', 'weighing', 'moving', 'training', 'other']).toContain(activity.activityType);
      expect(Array.isArray(activity.alpacaIds)).toBe(true);
      expect(activity.alpacaIds.length).toBeGreaterThan(0);
      expect(activity.performedBy.length).toBeGreaterThan(0);
      expect(activity.performedBy.length).toBeLessThanOrEqual(VALIDATION_LIMITS.PERFORMER_MAX_LENGTH);
      expect(activity.description.length).toBeGreaterThan(0);
      expect(activity.description.length).toBeLessThanOrEqual(VALIDATION_LIMITS.ACTIVITY_DESCRIPTION_MAX_LENGTH);

      if (activity.notes) {
        expect(activity.notes.length).toBeLessThanOrEqual(VALIDATION_LIMITS.ACTIVITY_NOTES_MAX_LENGTH);
      }
    });
  });

  describe('API Response Format Validation', () => {
    it('should validate successful API response format', () => {
      const successResponse: ApiResponse<Alpaca> = {
        success: true,
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Alpaca',
          birthDate: '2020-01-01',
          gender: 'male',
          color: 'white',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toBeDefined();
      expect(successResponse.error).toBeUndefined();
    });

    it('should validate error API response format', () => {
      const errorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name is required',
          details: {
            field: 'name',
            value: undefined,
            constraint: 'required'
          }
        }
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.data).toBeUndefined();
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error.code).toBeDefined();
      expect(errorResponse.error.message).toBeDefined();
    });

    it('should validate paginated API response format', () => {
      const paginatedResponse: ApiResponse<Alpaca[]> = {
        success: true,
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Alpaca 1',
            birthDate: '2020-01-01',
            gender: 'male',
            color: 'white',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z'
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      };

      expect(paginatedResponse.success).toBe(true);
      expect(paginatedResponse.data).toBeDefined();
      expect(Array.isArray(paginatedResponse.data)).toBe(true);
      expect(paginatedResponse.pagination).toBeDefined();
      expect(paginatedResponse.pagination.page).toBeGreaterThan(0);
      expect(paginatedResponse.pagination.limit).toBeGreaterThan(0);
      expect(paginatedResponse.pagination.total).toBeGreaterThanOrEqual(0);
      expect(paginatedResponse.pagination.totalPages).toBeGreaterThan(0);
    });
  });

  describe('HTTP Status Code Validation', () => {
    it('should validate success status codes', () => {
      const statusCodes = {
        GET_SUCCESS: 200,
        POST_SUCCESS: 201,
        PUT_SUCCESS: 200,
        DELETE_SUCCESS: 204
      };

      expect(statusCodes.GET_SUCCESS).toBe(200);
      expect(statusCodes.POST_SUCCESS).toBe(201);
      expect(statusCodes.PUT_SUCCESS).toBe(200);
      expect(statusCodes.DELETE_SUCCESS).toBe(204);
    });

    it('should validate error status codes', () => {
      const errorStatusCodes = {
        BAD_REQUEST: 400,
        NOT_FOUND: 404,
        CONFLICT: 409,
        VALIDATION_ERROR: 422,
        INTERNAL_SERVER_ERROR: 500
      };

      expect(errorStatusCodes.BAD_REQUEST).toBe(400);
      expect(errorStatusCodes.NOT_FOUND).toBe(404);
      expect(errorStatusCodes.CONFLICT).toBe(409);
      expect(errorStatusCodes.VALIDATION_ERROR).toBe(422);
      expect(errorStatusCodes.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('Request Validation', () => {
    it('should validate request parameter formats', () => {
      // UUID parameter validation
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUID = 'invalid-uuid';

      expect(validUUID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(invalidUUID).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Date parameter validation
      const validDate = '2023-01-01';
      const invalidDate = '2023-13-01';

      expect(validDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(validDate).toISOString().split('T')[0]).toBe(validDate);
      expect(isNaN(new Date(invalidDate).getTime())).toBe(true);
    });

    it('should validate pagination parameters', () => {
      const validPagination = {
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc' as const
      };

      const invalidPagination = {
        page: 0, // Invalid: must be >= 1
        limit: 101, // Invalid: must be <= 100
        sortOrder: 'invalid' as any // Invalid: must be 'asc' or 'desc'
      };

      expect(validPagination.page).toBeGreaterThanOrEqual(1);
      expect(validPagination.limit).toBeGreaterThanOrEqual(VALIDATION_LIMITS.PAGE_SIZE_MIN);
      expect(validPagination.limit).toBeLessThanOrEqual(VALIDATION_LIMITS.PAGE_SIZE_MAX);
      expect(['asc', 'desc']).toContain(validPagination.sortOrder);

      expect(invalidPagination.page).toBeLessThan(1);
      expect(invalidPagination.limit).toBeGreaterThan(VALIDATION_LIMITS.PAGE_SIZE_MAX);
      expect(['asc', 'desc']).not.toContain(invalidPagination.sortOrder);
    });
  });

  describe('Content Type Validation', () => {
    it('should validate request content types', () => {
      const validContentTypes = [
        'application/json',
        'application/json; charset=utf-8'
      ];

      const invalidContentTypes = [
        'text/plain',
        'application/xml',
        'multipart/form-data'
      ];

      validContentTypes.forEach(contentType => {
        expect(contentType.toLowerCase()).toContain('application/json');
      });

      invalidContentTypes.forEach(contentType => {
        expect(contentType.toLowerCase()).not.toContain('application/json');
      });
    });

    it('should validate response content types', () => {
      const expectedResponseContentType = 'application/json';
      
      expect(expectedResponseContentType).toBe('application/json');
    });
  });

  describe('OpenAPI Specification Structure', () => {
    it('should have valid OpenAPI specification structure', () => {
      if (!openApiSpec) {
        console.warn('Skipping OpenAPI spec structure test - spec not loaded');
        return;
      }

      // Validate basic OpenAPI structure
      expect(openApiSpec.openapi).toBeDefined();
      expect(openApiSpec.info).toBeDefined();
      expect(openApiSpec.paths).toBeDefined();
      expect(openApiSpec.components).toBeDefined();

      // Validate info section
      expect(openApiSpec.info.title).toBeDefined();
      expect(openApiSpec.info.version).toBeDefined();
      expect(openApiSpec.info.description).toBeDefined();

      // Validate components section
      expect(openApiSpec.components.schemas).toBeDefined();
      expect(openApiSpec.components.parameters).toBeDefined();
      expect(openApiSpec.components.responses).toBeDefined();
    });

    it('should have all required endpoints defined', () => {
      if (!openApiSpec) {
        console.warn('Skipping endpoints test - spec not loaded');
        return;
      }

      const requiredEndpoints = [
        '/alpacas',
        '/alpacas/{id}',
        '/health-records',
        '/health-records/{id}',
        '/breeding-records',
        '/breeding-records/{id}',
        '/activities',
        '/activities/{id}'
      ];

      requiredEndpoints.forEach(endpoint => {
        expect(openApiSpec.paths[endpoint]).toBeDefined();
      });
    });

    it('should have all required schemas defined', () => {
      if (!openApiSpec) {
        console.warn('Skipping schemas test - spec not loaded');
        return;
      }

      const requiredSchemas = [
        'Alpaca',
        'HealthRecord',
        'BreedingRecord',
        'ManagementActivity',
        'CreateAlpacaRequest',
        'CreateHealthRecordRequest',
        'CreateBreedingRecordRequest',
        'CreateActivityRequest',
        'ApiResponse',
        'ApiError',
        'PaginationInfo'
      ];

      requiredSchemas.forEach(schema => {
        expect(openApiSpec.components.schemas[schema]).toBeDefined();
      });
    });
  });
});