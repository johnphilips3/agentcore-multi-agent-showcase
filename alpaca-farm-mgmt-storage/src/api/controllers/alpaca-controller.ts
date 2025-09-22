/**
 * Simple Alpaca Controller Implementation
 */

import { Request, Response, NextFunction } from 'express';
import { AlpacaService } from '../../services/alpaca-service.js';
import { CreateAlpacaInput, UpdateAlpacaInput } from '../../models/alpaca.js';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class AlpacaController {
  constructor(private alpacaService: AlpacaService) {}

  // GET /api/v1/alpacas
  async getAllAlpacas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'asc';

      const result = await this.alpacaService.getAllAlpacas({
        limit,
        offset,
        sortBy,
        sortOrder
      });

      const response: ApiResponse = {
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/alpacas
  async createAlpaca(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alpacaData: CreateAlpacaInput = req.body;
      
      // Convert birthDate string to Date if needed
      if (typeof alpacaData.birthDate === 'string') {
        alpacaData.birthDate = new Date(alpacaData.birthDate);
      }

      const alpaca = await this.alpacaService.createAlpaca(alpacaData);

      const response: ApiResponse = {
        success: true,
        data: alpaca
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/alpacas/:id
  async getAlpaca(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const alpaca = await this.alpacaService.getAlpaca(id);

      if (!alpaca) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alpaca not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: alpaca
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/v1/alpacas/:id
  async updateAlpaca(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateAlpacaInput = req.body;
      
      // Convert birthDate string to Date if needed
      if (updateData.birthDate && typeof updateData.birthDate === 'string') {
        updateData.birthDate = new Date(updateData.birthDate);
      }

      const alpaca = await this.alpacaService.updateAlpaca(id, updateData);

      if (!alpaca) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alpaca not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: alpaca
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/alpacas/:id
  async deleteAlpaca(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.alpacaService.deleteAlpaca(id);

      if (!success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alpaca not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { message: 'Alpaca deleted successfully' }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/alpacas/search?q=query
  async searchAlpacas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query.q as string || '';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.alpacaService.searchAlpacas(query, {
        limit,
        offset
      });

      const response: ApiResponse = {
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/alpacas/statistics
  async getHerdStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.alpacaService.getHerdStatistics();

      const response: ApiResponse = {
        success: true,
        data: stats
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/alpacas/gender/:gender
  async getAlpacasByGender(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gender } = req.params;
      
      if (!['male', 'female'].includes(gender)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_GENDER',
            message: 'Gender must be either "male" or "female"'
          }
        };
        res.status(400).json(response);
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.alpacaService.getAlpacasByGender(gender as 'male' | 'female', {
        limit,
        offset
      });

      const response: ApiResponse = {
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}