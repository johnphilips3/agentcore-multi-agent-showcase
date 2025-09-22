/**
 * Unit tests for AlpacaController
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { AlpacaController, ApiResponse } from '../alpaca-controller';
import { AlpacaService } from '../../../services/alpaca-service';
import { AlpacaFactory } from '../../../__tests__/data-factories';
import { MockServiceFactory } from '../../../__tests__/mock-factories';
import { CreateAlpacaInput, UpdateAlpacaInput } from '../../../models/alpaca';

// Mock the AlpacaService
vi.mock('../../../services/alpaca-service');

describe('AlpacaController', () => {
  let controller: AlpacaController;
  let mockAlpacaService: jest.Mocked<AlpacaService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock service
    mockAlpacaService = {
      getAllAlpacas: vi.fn(),
      createAlpaca: vi.fn(),
      getAlpaca: vi.fn(),
      updateAlpaca: vi.fn(),
      deleteAlpaca: vi.fn(),
      searchAlpacas: vi.fn(),
      getHerdStatistics: vi.fn(),
      getAlpacasByGender: vi.fn()
    } as any;

    // Create controller instance
    controller = new AlpacaController(mockAlpacaService);

    // Create mock Express objects
    mockRequest = MockServiceFactory.createMockRequest();
    mockResponse = MockServiceFactory.createMockResponse();
    mockNext = MockServiceFactory.createMockNext();
  });

  describe('getAllAlpacas', () => {
    it('should return paginated alpacas with default pagination', async () => {
      // Arrange
      const mockAlpacas = AlpacaFactory.createMultiple(3);
      const mockResult = {
        data: mockAlpacas,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockAlpacaService.getAllAlpacas.mockResolvedValue(mockResult);
      mockRequest.query = {};

      // Act
      await controller.getAllAlpacas(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.getAllAlpacas).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        sortBy: undefined,
        sortOrder: 'asc'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAlpacas,
        pagination: {
          page: mockResult.page,
          limit: mockResult.limit,
          total: mockResult.total,
          totalPages: mockResult.totalPages
        }
      });
    });

    it('should handle custom pagination parameters', async () => {
      // Arrange
      const mockAlpacas = AlpacaFactory.createMultiple(2);
      const mockResult = {
        data: mockAlpacas,
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      mockAlpacaService.getAllAlpacas.mockResolvedValue(mockResult);
      mockRequest.query = {
        page: '2',
        limit: '10',
        sortBy: 'name',
        sortOrder: 'desc'
      };

      // Act
      await controller.getAllAlpacas(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.getAllAlpacas).toHaveBeenCalledWith({
        limit: 10,
        offset: 10,
        sortBy: 'name',
        sortOrder: 'desc'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAlpacas,
        pagination: {
          page: mockResult.page,
          limit: mockResult.limit,
          total: mockResult.total,
          totalPages: mockResult.totalPages
        }
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockAlpacaService.getAllAlpacas.mockRejectedValue(error);
      mockRequest.query = {};

      // Act
      await controller.getAllAlpacas(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle invalid pagination parameters gracefully', async () => {
      // Arrange
      const mockAlpacas = AlpacaFactory.createMultiple(1);
      const mockResult = {
        data: mockAlpacas,
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      };
      mockAlpacaService.getAllAlpacas.mockResolvedValue(mockResult);
      mockRequest.query = {
        page: 'invalid',
        limit: 'invalid'
      };

      // Act
      await controller.getAllAlpacas(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.getAllAlpacas).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        sortBy: undefined,
        sortOrder: 'asc'
      });
    });
  });

  describe('createAlpaca', () => {
    it('should create alpaca successfully', async () => {
      // Arrange
      const inputData = AlpacaFactory.createInput();
      const createdAlpaca = AlpacaFactory.create(inputData);
      mockAlpacaService.createAlpaca.mockResolvedValue(createdAlpaca);
      mockRequest.body = inputData;

      // Act
      await controller.createAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.createAlpaca).toHaveBeenCalledWith(inputData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdAlpaca
      });
    });

    it('should handle string birthDate conversion', async () => {
      // Arrange
      const inputData = AlpacaFactory.createInput();
      const inputWithStringDate = {
        ...inputData,
        birthDate: '2020-01-01T00:00:00.000Z'
      };
      const createdAlpaca = AlpacaFactory.create(inputData);
      mockAlpacaService.createAlpaca.mockResolvedValue(createdAlpaca);
      mockRequest.body = inputWithStringDate;

      // Act
      await controller.createAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedInput = {
        ...inputWithStringDate,
        birthDate: new Date('2020-01-01T00:00:00.000Z')
      };
      expect(mockAlpacaService.createAlpaca).toHaveBeenCalledWith(expectedInput);
    });

    it('should handle service validation errors', async () => {
      // Arrange
      const inputData = AlpacaFactory.createInput();
      const validationError = new Error('Invalid alpaca data');
      mockAlpacaService.createAlpaca.mockRejectedValue(validationError);
      mockRequest.body = inputData;

      // Act
      await controller.createAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(validationError);
    });
  });

  describe('getAlpaca', () => {
    it('should return alpaca when found', async () => {
      // Arrange
      const alpaca = AlpacaFactory.create();
      mockAlpacaService.getAlpaca.mockResolvedValue(alpaca);
      mockRequest.params = { id: alpaca.id };

      // Act
      await controller.getAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.getAlpaca).toHaveBeenCalledWith(alpaca.id);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: alpaca
      });
    });

    it('should return 404 when alpaca not found', async () => {
      // Arrange
      const alpacaId = 'non-existent-id';
      mockAlpacaService.getAlpaca.mockResolvedValue(null);
      mockRequest.params = { id: alpacaId };

      // Act
      await controller.getAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.getAlpaca).toHaveBeenCalledWith(alpacaId);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Alpaca not found'
        }
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      const alpacaId = 'test-id';
      const error = new Error('Database error');
      mockAlpacaService.getAlpaca.mockRejectedValue(error);
      mockRequest.params = { id: alpacaId };

      // Act
      await controller.getAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateAlpaca', () => {
    it('should update alpaca successfully', async () => {
      // Arrange
      const alpacaId = 'test-id';
      const updateData = AlpacaFactory.updateInput();
      const updatedAlpaca = AlpacaFactory.create({ id: alpacaId, ...updateData });
      mockAlpacaService.updateAlpaca.mockResolvedValue(updatedAlpaca);
      mockRequest.params = { id: alpacaId };
      mockRequest.body = updateData;

      // Act
      await controller.updateAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.updateAlpaca).toHaveBeenCalledWith(alpacaId, updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedAlpaca
      });
    });

    it('should handle string birthDate conversion in updates', async () => {
      // Arrange
      const alpacaId = 'test-id';
      const updateData = {
        ...AlpacaFactory.updateInput(),
        birthDate: '2020-01-01T00:00:00.000Z'
      };
      const updatedAlpaca = AlpacaFactory.create({ id: alpacaId });
      mockAlpacaService.updateAlpaca.mockResolvedValue(updatedAlpaca);
      mockRequest.params = { id: alpacaId };
      mockRequest.body = updateData;

      // Act
      await controller.updateAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const expectedUpdateData = {
        ...updateData,
        birthDate: new Date('2020-01-01T00:00:00.000Z')
      };
      expect(mockAlpacaService.updateAlpaca).toHaveBeenCalledWith(alpacaId, expectedUpdateData);
    });

    it('should return 404 when alpaca not found for update', async () => {
      // Arrange
      const alpacaId = 'non-existent-id';
      const updateData = AlpacaFactory.updateInput();
      mockAlpacaService.updateAlpaca.mockResolvedValue(null);
      mockRequest.params = { id: alpacaId };
      mockRequest.body = updateData;

      // Act
      await controller.updateAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Alpaca not found'
        }
      });
    });

    it('should handle service errors during update', async () => {
      // Arrange
      const alpacaId = 'test-id';
      const updateData = AlpacaFactory.updateInput();
      const error = new Error('Update failed');
      mockAlpacaService.updateAlpaca.mockRejectedValue(error);
      mockRequest.params = { id: alpacaId };
      mockRequest.body = updateData;

      // Act
      await controller.updateAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteAlpaca', () => {
    it('should delete alpaca successfully', async () => {
      // Arrange
      const alpacaId = 'test-id';
      mockAlpacaService.deleteAlpaca.mockResolvedValue(true);
      mockRequest.params = { id: alpacaId };

      // Act
      await controller.deleteAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.deleteAlpaca).toHaveBeenCalledWith(alpacaId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Alpaca deleted successfully' }
      });
    });

    it('should return 404 when alpaca not found for deletion', async () => {
      // Arrange
      const alpacaId = 'non-existent-id';
      mockAlpacaService.deleteAlpaca.mockResolvedValue(false);
      mockRequest.params = { id: alpacaId };

      // Act
      await controller.deleteAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Alpaca not found'
        }
      });
    });

    it('should handle service errors during deletion', async () => {
      // Arrange
      const alpacaId = 'test-id';
      const error = new Error('Deletion failed');
      mockAlpacaService.deleteAlpaca.mockRejectedValue(error);
      mockRequest.params = { id: alpacaId };

      // Act
      await controller.deleteAlpaca(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('searchAlpacas', () => {
    it('should search alpacas with query', async () => {
      // Arrange
      const searchQuery = 'test alpaca';
      const mockAlpacas = AlpacaFactory.createMultiple(2);
      const mockResult = {
        data: mockAlpacas,
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1
      };
      mockAlpacaService.searchAlpacas.mockResolvedValue(mockResult);
      mockRequest.query = { q: searchQuery };

      // Act
      await controller.searchAlpacas(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.searchAlpacas).toHaveBeenCalledWith(searchQuery, {
        limit: 20,
        offset: 0
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAlpacas,
        pagination: {
          page: mockResult.page,
          limit: mockResult.limit,
          total: mockResult.total,
          totalPages: mockResult.totalPages
        }
      });
    });

    it('should handle empty search query', async () => {
      // Arrange
      const mockResult = {
        data: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      };
      mockAlpacaService.searchAlpacas.mockResolvedValue(mockResult);
      mockRequest.query = {};

      // Act
      await controller.searchAlpacas(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.searchAlpacas).toHaveBeenCalledWith('', {
        limit: 20,
        offset: 0
      });
    });

    it('should handle search with pagination', async () => {
      // Arrange
      const searchQuery = 'alpaca';
      const mockResult = {
        data: [],
        page: 2,
        limit: 10,
        total: 15,
        totalPages: 2
      };
      mockAlpacaService.searchAlpacas.mockResolvedValue(mockResult);
      mockRequest.query = {
        q: searchQuery,
        page: '2',
        limit: '10'
      };

      // Act
      await controller.searchAlpacas(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.searchAlpacas).toHaveBeenCalledWith(searchQuery, {
        limit: 10,
        offset: 10
      });
    });

    it('should handle search service errors', async () => {
      // Arrange
      const error = new Error('Search failed');
      mockAlpacaService.searchAlpacas.mockRejectedValue(error);
      mockRequest.query = { q: 'test' };

      // Act
      await controller.searchAlpacas(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getHerdStatistics', () => {
    it('should return herd statistics', async () => {
      // Arrange
      const mockStats = {
        totalAlpacas: 25,
        maleCount: 10,
        femaleCount: 15,
        averageAge: 3.5,
        breedingEligible: 18
      };
      mockAlpacaService.getHerdStatistics.mockResolvedValue(mockStats);

      // Act
      await controller.getHerdStatistics(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.getHerdStatistics).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    it('should handle statistics service errors', async () => {
      // Arrange
      const error = new Error('Statistics calculation failed');
      mockAlpacaService.getHerdStatistics.mockRejectedValue(error);

      // Act
      await controller.getHerdStatistics(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getAlpacasByGender', () => {
    it('should return alpacas filtered by gender', async () => {
      // Arrange
      const gender = 'female';
      const mockAlpacas = AlpacaFactory.createMultiple(3, { gender: 'female' });
      const mockResult = {
        data: mockAlpacas,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      };
      mockAlpacaService.getAlpacasByGender.mockResolvedValue(mockResult);
      mockRequest.params = { gender };
      mockRequest.query = {};

      // Act
      await controller.getAlpacasByGender(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.getAlpacasByGender).toHaveBeenCalledWith('female', {
        limit: 20,
        offset: 0
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAlpacas,
        pagination: {
          page: mockResult.page,
          limit: mockResult.limit,
          total: mockResult.total,
          totalPages: mockResult.totalPages
        }
      });
    });

    it('should return 400 for invalid gender', async () => {
      // Arrange
      const invalidGender = 'invalid';
      mockRequest.params = { gender: invalidGender };

      // Act
      await controller.getAlpacasByGender(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_GENDER',
          message: 'Gender must be either "male" or "female"'
        }
      });
      expect(mockAlpacaService.getAlpacasByGender).not.toHaveBeenCalled();
    });

    it('should handle male gender filter', async () => {
      // Arrange
      const gender = 'male';
      const mockAlpacas = AlpacaFactory.createMultiple(2, { gender: 'male' });
      const mockResult = {
        data: mockAlpacas,
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1
      };
      mockAlpacaService.getAlpacasByGender.mockResolvedValue(mockResult);
      mockRequest.params = { gender };
      mockRequest.query = {};

      // Act
      await controller.getAlpacasByGender(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.getAlpacasByGender).toHaveBeenCalledWith('male', {
        limit: 20,
        offset: 0
      });
    });

    it('should handle pagination with gender filter', async () => {
      // Arrange
      const gender = 'female';
      const mockResult = {
        data: [],
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      mockAlpacaService.getAlpacasByGender.mockResolvedValue(mockResult);
      mockRequest.params = { gender };
      mockRequest.query = {
        page: '2',
        limit: '10'
      };

      // Act
      await controller.getAlpacasByGender(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAlpacaService.getAlpacasByGender).toHaveBeenCalledWith('female', {
        limit: 10,
        offset: 10
      });
    });

    it('should handle service errors for gender filtering', async () => {
      // Arrange
      const gender = 'male';
      const error = new Error('Gender filtering failed');
      mockAlpacaService.getAlpacasByGender.mockRejectedValue(error);
      mockRequest.params = { gender };
      mockRequest.query = {};

      // Act
      await controller.getAlpacasByGender(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});