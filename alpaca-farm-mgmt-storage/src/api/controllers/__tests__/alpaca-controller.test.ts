/**
 * Alpaca Controller Tests
 * Unit tests for the Alpaca REST controller
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { AlpacaController } from '../alpaca-controller.js';
import { AlpacaService } from '../../../services/index.js';
import { ApiErrorClass } from '../../errors.js';
import { Alpaca, CreateAlpacaRequest, UpdateAlpacaRequest } from '../../types.js';

// Mock AlpacaService
const mockAlpacaService = {
  findAll: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getLineage: vi.fn(),
  getOffspring: vi.fn(),
  search: vi.fn()
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

describe('AlpacaController', () => {
  let controller: AlpacaController;
  let req: any;
  let res: any;

  beforeEach(() => {
    controller = new AlpacaController(mockAlpacaService);
    req = createMockRequest();
    res = createMockResponse();
    vi.clearAllMocks();
  });

  describe('listAlpacas', () => {
    it('should list alpacas with pagination', async () => {
      const mockAlpacas = [
        { id: '1', name: 'Alpaca 1', gender: 'male', color: 'white' },
        { id: '2', name: 'Alpaca 2', gender: 'female', color: 'brown' }
      ];
      
      mockAlpacaService.findAll.mockResolvedValue({
        alpacas: mockAlpacas,
        total: 2
      });

      await controller.listAlpacas(req, res);

      expect(mockAlpacaService.findAll).toHaveBeenCalledWith({
        limit: 20,
        offset: 0
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAlpacas,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1
        }
      });
    });

    it('should handle search query parameters', async () => {
      req.validatedQuery = {
        name: 'test',
        gender: 'male',
        color: 'white'
      };

      mockAlpacaService.findAll.mockResolvedValue({
        alpacas: [],
        total: 0
      });

      await controller.listAlpacas(req, res);

      expect(mockAlpacaService.findAll).toHaveBeenCalledWith({
        name: 'test',
        gender: 'male',
        color: 'white',
        limit: 20,
        offset: 0
      });
    });
  });

  describe('createAlpaca', () => {
    it('should create a new alpaca', async () => {
      const createRequest: CreateAlpacaRequest = {
        name: 'New Alpaca',
        birthDate: '2023-01-01',
        gender: 'male',
        color: 'white'
      };

      const createdAlpaca: Alpaca = {
        id: 'new-id',
        ...createRequest,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      req.validatedBody = createRequest;
      mockAlpacaService.create.mockResolvedValue(createdAlpaca);

      await controller.createAlpaca(req, res);

      expect(mockAlpacaService.create).toHaveBeenCalledWith(createRequest);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdAlpaca
      });
    });
  });

  describe('getAlpaca', () => {
    it('should get alpaca by ID', async () => {
      const alpaca: Alpaca = {
        id: 'test-id',
        name: 'Test Alpaca',
        birthDate: '2023-01-01',
        gender: 'male',
        color: 'white',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      req.params = { id: 'test-id' };
      mockAlpacaService.findById.mockResolvedValue(alpaca);

      await controller.getAlpaca(req, res);

      expect(mockAlpacaService.findById).toHaveBeenCalledWith('test-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: alpaca
      });
    });

    it('should throw not found error when alpaca does not exist', async () => {
      req.params = { id: 'non-existent-id' };
      mockAlpacaService.findById.mockResolvedValue(null);

      await expect(controller.getAlpaca(req, res)).rejects.toThrow(ApiErrorClass);
      
      expect(mockAlpacaService.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('updateAlpaca', () => {
    it('should update alpaca', async () => {
      const updateRequest: UpdateAlpacaRequest = {
        name: 'Updated Alpaca',
        color: 'brown'
      };

      const updatedAlpaca: Alpaca = {
        id: 'test-id',
        name: 'Updated Alpaca',
        birthDate: '2023-01-01',
        gender: 'male',
        color: 'brown',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T01:00:00Z'
      };

      req.params = { id: 'test-id' };
      req.validatedBody = updateRequest;
      mockAlpacaService.update.mockResolvedValue(updatedAlpaca);

      await controller.updateAlpaca(req, res);

      expect(mockAlpacaService.update).toHaveBeenCalledWith('test-id', updateRequest);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedAlpaca
      });
    });
  });

  describe('deleteAlpaca', () => {
    it('should delete alpaca', async () => {
      req.params = { id: 'test-id' };
      mockAlpacaService.delete.mockResolvedValue(true);

      await controller.deleteAlpaca(req, res);

      expect(mockAlpacaService.delete).toHaveBeenCalledWith('test-id');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should throw not found error when alpaca does not exist', async () => {
      req.params = { id: 'non-existent-id' };
      mockAlpacaService.delete.mockResolvedValue(false);

      await expect(controller.deleteAlpaca(req, res)).rejects.toThrow(ApiErrorClass);
      
      expect(mockAlpacaService.delete).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('getAlpacaLineage', () => {
    it('should get alpaca lineage with default generations', async () => {
      const lineage = {
        alpaca: { id: 'test-id', name: 'Test Alpaca' },
        ancestors: [],
        descendants: []
      };

      req.params = { id: 'test-id' };
      req.query = {};
      mockAlpacaService.getLineage.mockResolvedValue(lineage);

      await controller.getAlpacaLineage(req, res);

      expect(mockAlpacaService.getLineage).toHaveBeenCalledWith('test-id', 3);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: lineage
      });
    });

    it('should get alpaca lineage with custom generations', async () => {
      const lineage = {
        alpaca: { id: 'test-id', name: 'Test Alpaca' },
        ancestors: [],
        descendants: []
      };

      req.params = { id: 'test-id' };
      req.query = { generations: '5' };
      mockAlpacaService.getLineage.mockResolvedValue(lineage);

      await controller.getAlpacaLineage(req, res);

      expect(mockAlpacaService.getLineage).toHaveBeenCalledWith('test-id', 5);
    });

    it('should validate generations parameter', async () => {
      req.params = { id: 'test-id' };
      req.query = { generations: '15' }; // Too high

      await expect(controller.getAlpacaLineage(req, res)).rejects.toThrow(ApiErrorClass);
    });
  });

  describe('getAlpacaOffspring', () => {
    it('should get alpaca offspring', async () => {
      const offspring = [
        { id: 'child1', name: 'Child 1' },
        { id: 'child2', name: 'Child 2' }
      ];

      req.params = { id: 'test-id' };
      mockAlpacaService.getOffspring.mockResolvedValue(offspring);

      await controller.getAlpacaOffspring(req, res);

      expect(mockAlpacaService.getOffspring).toHaveBeenCalledWith('test-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: offspring
      });
    });
  });

  describe('searchAlpacas', () => {
    it('should search alpacas with query parameters', async () => {
      const searchResults = {
        alpacas: [
          { id: '1', name: 'Found Alpaca', gender: 'male', color: 'white' }
        ],
        total: 1
      };

      req.validatedQuery = {
        q: 'Found',
        gender: 'male'
      };

      mockAlpacaService.search.mockResolvedValue(searchResults);

      await controller.searchAlpacas(req, res);

      expect(mockAlpacaService.search).toHaveBeenCalledWith({
        q: 'Found',
        gender: 'male',
        limit: 20,
        offset: 0
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: searchResults.alpacas,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockAlpacaService.findAll.mockRejectedValue(error);

      await expect(controller.listAlpacas(req, res)).rejects.toThrow(error);
    });

    it('should handle API errors', async () => {
      const apiError = ApiErrorClass.validation('Invalid data');
      mockAlpacaService.create.mockRejectedValue(apiError);

      req.validatedBody = { name: 'Test' };

      await expect(controller.createAlpaca(req, res)).rejects.toThrow(apiError);
    });
  });
});