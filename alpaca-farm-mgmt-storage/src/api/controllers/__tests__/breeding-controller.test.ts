/**
 * Breeding Controller Tests
 * Unit tests for the Breeding Records REST controller
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { BreedingController } from '../breeding-controller.js';
import { BreedingService } from '../../../services/index.js';
import { ApiErrorClass } from '../../errors.js';
import { 
  BreedingRecord, 
  CreateBreedingRecordRequest, 
  UpdateBreedingRecordRequest,
  BreedingCompatibilityRequest,
  BreedingCompatibilityResponse 
} from '../../types.js';

// Mock BreedingService
const mockBreedingService = {
  findAll: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  checkBreedingCompatibility: vi.fn(),
  findBySire: vi.fn(),
  findByDam: vi.fn(),
  findByParent: vi.fn(),
  findByDateRange: vi.fn(),
  getBreedingStats: vi.fn(),
  getBreedingRecommendations: vi.fn(),
  getExpectedBirths: vi.fn(),
  getBreedingHistory: vi.fn(),
  getGeneticDiversityAnalysis: vi.fn(),
  validateBreedingPair: vi.fn()
} as any;

// Mock request and response objects
function createMockRequest(overrides: any = {}): any {
  return {
    params: {},
    query: {},
    body: {},
    validatedBody: undefined,
    validatedQuery: undefined,
    pagination: { page: 1, limit: 20, offset: 0 },
    ...overrides
  };
}

function createMockResponse(): any {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  };
  return res;
}

describe('BreedingController', () => {
  let controller: BreedingController;
  let req: any;
  let res: any;

  beforeEach(() => {
    controller = new BreedingController(mockBreedingService);
    req = createMockRequest();
    res = createMockResponse();
    vi.clearAllMocks();
  });

  describe('listBreedingRecords', () => {
    it('should list breeding records with pagination', async () => {
      const mockBreedingRecords = [
        { 
          id: '1', 
          sireId: 'sire1', 
          damId: 'dam1', 
          breedingDate: '2023-01-01',
          offspringIds: []
        },
        { 
          id: '2', 
          sireId: 'sire2', 
          damId: 'dam2', 
          breedingDate: '2023-01-02',
          offspringIds: ['offspring1']
        }
      ];
      
      mockBreedingService.findAll.mockResolvedValue({
        breedingRecords: mockBreedingRecords,
        total: 2
      });

      await controller.listBreedingRecords(req, res);

      expect(mockBreedingService.findAll).toHaveBeenCalledWith({
        limit: 20,
        offset: 0
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBreedingRecords,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1
        }
      });
    });

    it('should handle query parameters', async () => {
      req.validatedQuery = {
        sireId: 'sire1',
        damId: 'dam1',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      };

      mockBreedingService.findAll.mockResolvedValue({
        breedingRecords: [],
        total: 0
      });

      await controller.listBreedingRecords(req, res);

      expect(mockBreedingService.findAll).toHaveBeenCalledWith({
        sireId: 'sire1',
        damId: 'dam1',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
        limit: 20,
        offset: 0
      });
    });
  });

  describe('createBreedingRecord', () => {
    it('should create a new breeding record', async () => {
      const createRequest: CreateBreedingRecordRequest = {
        sireId: 'sire1',
        damId: 'dam1',
        breedingDate: '2023-01-01',
        expectedDueDate: '2023-12-01'
      };

      const createdBreedingRecord: BreedingRecord = {
        id: 'new-id',
        ...createRequest,
        offspringIds: [],
        createdAt: '2023-01-01T00:00:00Z'
      };

      req.validatedBody = createRequest;
      mockBreedingService.create.mockResolvedValue(createdBreedingRecord);

      await controller.createBreedingRecord(req, res);

      expect(mockBreedingService.create).toHaveBeenCalledWith(createRequest);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdBreedingRecord
      });
    });
  });

  describe('getBreedingRecord', () => {
    it('should get breeding record by ID', async () => {
      const breedingRecord: BreedingRecord = {
        id: 'test-id',
        sireId: 'sire1',
        damId: 'dam1',
        breedingDate: '2023-01-01',
        offspringIds: [],
        createdAt: '2023-01-01T00:00:00Z'
      };

      req.params = { id: 'test-id' };
      mockBreedingService.findById.mockResolvedValue(breedingRecord);

      await controller.getBreedingRecord(req, res);

      expect(mockBreedingService.findById).toHaveBeenCalledWith('test-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: breedingRecord
      });
    });

    it('should throw not found error when breeding record does not exist', async () => {
      req.params = { id: 'non-existent-id' };
      mockBreedingService.findById.mockResolvedValue(null);

      await expect(controller.getBreedingRecord(req, res)).rejects.toThrow(ApiErrorClass);
      
      expect(mockBreedingService.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('updateBreedingRecord', () => {
    it('should update breeding record', async () => {
      const updateRequest: UpdateBreedingRecordRequest = {
        actualBirthDate: '2023-11-15',
        offspringIds: ['offspring1', 'offspring2']
      };

      const updatedBreedingRecord: BreedingRecord = {
        id: 'test-id',
        sireId: 'sire1',
        damId: 'dam1',
        breedingDate: '2023-01-01',
        actualBirthDate: '2023-11-15',
        offspringIds: ['offspring1', 'offspring2'],
        createdAt: '2023-01-01T00:00:00Z'
      };

      req.params = { id: 'test-id' };
      req.validatedBody = updateRequest;
      mockBreedingService.update.mockResolvedValue(updatedBreedingRecord);

      await controller.updateBreedingRecord(req, res);

      expect(mockBreedingService.update).toHaveBeenCalledWith('test-id', updateRequest);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedBreedingRecord
      });
    });
  });

  describe('deleteBreedingRecord', () => {
    it('should delete breeding record', async () => {
      req.params = { id: 'test-id' };
      mockBreedingService.delete.mockResolvedValue(true);

      await controller.deleteBreedingRecord(req, res);

      expect(mockBreedingService.delete).toHaveBeenCalledWith('test-id');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should throw not found error when breeding record does not exist', async () => {
      req.params = { id: 'non-existent-id' };
      mockBreedingService.delete.mockResolvedValue(false);

      await expect(controller.deleteBreedingRecord(req, res)).rejects.toThrow(ApiErrorClass);
      
      expect(mockBreedingService.delete).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('checkBreedingCompatibility', () => {
    it('should check breeding compatibility', async () => {
      const compatibilityRequest: BreedingCompatibilityRequest = {
        sireId: 'sire1',
        damId: 'dam1'
      };

      const compatibilityResponse: BreedingCompatibilityResponse = {
        compatible: true,
        reason: undefined,
        relationshipDegree: undefined
      };

      req.validatedBody = compatibilityRequest;
      mockBreedingService.checkBreedingCompatibility.mockResolvedValue(compatibilityResponse);

      await controller.checkBreedingCompatibility(req, res);

      expect(mockBreedingService.checkBreedingCompatibility).toHaveBeenCalledWith('sire1', 'dam1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: compatibilityResponse
      });
    });

    it('should return incompatible result with reason', async () => {
      const compatibilityRequest: BreedingCompatibilityRequest = {
        sireId: 'sire1',
        damId: 'dam1'
      };

      const compatibilityResponse: BreedingCompatibilityResponse = {
        compatible: false,
        reason: 'Too closely related',
        relationshipDegree: 2
      };

      req.validatedBody = compatibilityRequest;
      mockBreedingService.checkBreedingCompatibility.mockResolvedValue(compatibilityResponse);

      await controller.checkBreedingCompatibility(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: compatibilityResponse
      });
    });
  });

  describe('getAlpacaBreedingRecords', () => {
    it('should get breeding records for alpaca as both sire and dam', async () => {
      const breedingRecords = [
        { 
          id: '1', 
          sireId: 'alpaca1', 
          damId: 'dam1', 
          breedingDate: '2023-01-01',
          offspringIds: []
        }
      ];

      req.params = { id: 'alpaca1' };
      req.query = { role: 'both' };
      mockBreedingService.findByParent.mockResolvedValue(breedingRecords);

      await controller.getAlpacaBreedingRecords(req, res);

      expect(mockBreedingService.findByParent).toHaveBeenCalledWith('alpaca1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: breedingRecords
      });
    });

    it('should get breeding records for alpaca as sire only', async () => {
      const breedingRecords = [];

      req.params = { id: 'alpaca1' };
      req.query = { role: 'sire' };
      mockBreedingService.findBySire.mockResolvedValue(breedingRecords);

      await controller.getAlpacaBreedingRecords(req, res);

      expect(mockBreedingService.findBySire).toHaveBeenCalledWith('alpaca1');
    });

    it('should get breeding records for alpaca as dam only', async () => {
      const breedingRecords = [];

      req.params = { id: 'alpaca1' };
      req.query = { role: 'dam' };
      mockBreedingService.findByDam.mockResolvedValue(breedingRecords);

      await controller.getAlpacaBreedingRecords(req, res);

      expect(mockBreedingService.findByDam).toHaveBeenCalledWith('alpaca1');
    });
  });

  describe('getBreedingRecordsByDateRange', () => {
    it('should get breeding records by date range', async () => {
      const breedingRecords = [
        { 
          id: '1', 
          sireId: 'sire1', 
          damId: 'dam1', 
          breedingDate: '2023-06-01',
          offspringIds: []
        }
      ];

      req.query = {
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      };
      mockBreedingService.findByDateRange.mockResolvedValue(breedingRecords);

      await controller.getBreedingRecordsByDateRange(req, res);

      expect(mockBreedingService.findByDateRange).toHaveBeenCalledWith('2023-01-01', '2023-12-31');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: breedingRecords
      });
    });

    it('should require dateFrom and dateTo parameters', async () => {
      req.query = { dateFrom: '2023-01-01' }; // Missing dateTo

      await expect(controller.getBreedingRecordsByDateRange(req, res)).rejects.toThrow(ApiErrorClass);
    });
  });

  describe('getAlpacaBreedingStats', () => {
    it('should get breeding statistics for alpaca', async () => {
      const stats = {
        totalBreedings: 5,
        successfulBreedings: 4,
        totalOffspring: 8,
        averageOffspringPerBreeding: 2,
        lastBreedingDate: '2023-06-01',
        nextExpectedBirth: '2024-01-01'
      };

      req.params = { id: 'alpaca1' };
      mockBreedingService.getBreedingStats.mockResolvedValue(stats);

      await controller.getAlpacaBreedingStats(req, res);

      expect(mockBreedingService.getBreedingStats).toHaveBeenCalledWith('alpaca1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: stats
      });
    });
  });

  describe('getBreedingRecommendations', () => {
    it('should get breeding recommendations for alpaca', async () => {
      const recommendations = [
        { 
          alpacaId: 'candidate1', 
          compatibilityScore: 0.95, 
          reasons: ['Good genetic diversity', 'Complementary traits']
        }
      ];

      req.params = { id: 'alpaca1' };
      req.query = { gender: 'female' };
      mockBreedingService.getBreedingRecommendations.mockResolvedValue(recommendations);

      await controller.getBreedingRecommendations(req, res);

      expect(mockBreedingService.getBreedingRecommendations).toHaveBeenCalledWith('alpaca1', 'female');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: recommendations
      });
    });
  });

  describe('getExpectedBirths', () => {
    it('should get expected births with default days', async () => {
      const expectedBirths = [
        { 
          id: '1', 
          sireId: 'sire1', 
          damId: 'dam1', 
          expectedDueDate: '2023-12-15',
          breedingDate: '2023-01-01'
        }
      ];

      req.query = {};
      mockBreedingService.getExpectedBirths.mockResolvedValue(expectedBirths);

      await controller.getExpectedBirths(req, res);

      expect(mockBreedingService.getExpectedBirths).toHaveBeenCalledWith(90);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expectedBirths
      });
    });

    it('should get expected births with custom days', async () => {
      const expectedBirths = [];

      req.query = { days: '30' };
      mockBreedingService.getExpectedBirths.mockResolvedValue(expectedBirths);

      await controller.getExpectedBirths(req, res);

      expect(mockBreedingService.getExpectedBirths).toHaveBeenCalledWith(30);
    });
  });

  describe('getAlpacaBreedingHistory', () => {
    it('should get breeding history for alpaca', async () => {
      const history = {
        alpacaId: 'alpaca1',
        totalBreedings: 3,
        breedingRecords: [
          { id: '1', breedingDate: '2023-01-01', offspring: ['child1'] }
        ]
      };

      req.params = { id: 'alpaca1' };
      mockBreedingService.getBreedingHistory.mockResolvedValue(history);

      await controller.getAlpacaBreedingHistory(req, res);

      expect(mockBreedingService.getBreedingHistory).toHaveBeenCalledWith('alpaca1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: history
      });
    });
  });

  describe('getGeneticDiversityAnalysis', () => {
    it('should get genetic diversity analysis', async () => {
      const analysis = {
        totalAlpacas: 100,
        uniqueLineages: 25,
        diversityIndex: 0.85,
        inbreedingRisk: 'Low',
        recommendations: ['Introduce new bloodlines']
      };

      mockBreedingService.getGeneticDiversityAnalysis.mockResolvedValue(analysis);

      await controller.getGeneticDiversityAnalysis(req, res);

      expect(mockBreedingService.getGeneticDiversityAnalysis).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: analysis
      });
    });
  });

  describe('validateBreedingPair', () => {
    it('should validate breeding pair with detailed report', async () => {
      const validationRequest: BreedingCompatibilityRequest = {
        sireId: 'sire1',
        damId: 'dam1'
      };

      const validation = {
        compatible: true,
        geneticDiversity: 0.9,
        inbreedingCoefficient: 0.05,
        recommendations: ['Excellent genetic match'],
        warnings: []
      };

      req.validatedBody = validationRequest;
      mockBreedingService.validateBreedingPair.mockResolvedValue(validation);

      await controller.validateBreedingPair(req, res);

      expect(mockBreedingService.validateBreedingPair).toHaveBeenCalledWith('sire1', 'dam1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: validation
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockBreedingService.findAll.mockRejectedValue(error);

      await expect(controller.listBreedingRecords(req, res)).rejects.toThrow(error);
    });

    it('should handle API errors', async () => {
      const apiError = ApiErrorClass.validation('Invalid data');
      mockBreedingService.create.mockRejectedValue(apiError);

      req.validatedBody = { sireId: 'test' };

      await expect(controller.createBreedingRecord(req, res)).rejects.toThrow(apiError);
    });
  });
});