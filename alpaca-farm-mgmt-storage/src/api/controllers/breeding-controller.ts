/**
 * Simple Breeding Controller Implementation
 */

import { Request, Response, NextFunction } from 'express';
import { BreedingService } from '../../services/breeding-service.js';
import { CreateBreedingRecordInput, UpdateBreedingRecordInput } from '../../models/breeding-record.js';

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

export class BreedingController {
  constructor(private breedingService: BreedingService) {}

  // GET /api/v1/breeding-records
  async getAllBreedingRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';

      const result = await this.breedingService.getAllBreedingRecords({
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

  // POST /api/v1/breeding-records
  async createBreedingRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const breedingData: CreateBreedingRecordInput = req.body;
      
      // Convert date strings to Date objects if needed
      if (typeof breedingData.breedingDate === 'string') {
        breedingData.breedingDate = new Date(breedingData.breedingDate);
      }
      if (breedingData.expectedDueDate && typeof breedingData.expectedDueDate === 'string') {
        breedingData.expectedDueDate = new Date(breedingData.expectedDueDate);
      }
      if (breedingData.actualBirthDate && typeof breedingData.actualBirthDate === 'string') {
        breedingData.actualBirthDate = new Date(breedingData.actualBirthDate);
      }

      const breedingRecord = await this.breedingService.createBreedingRecord(breedingData);

      const response: ApiResponse = {
        success: true,
        data: breedingRecord
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/breeding-records/:id
  async getBreedingRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const breedingRecord = await this.breedingService.getBreedingRecord(id);

      if (!breedingRecord) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Breeding record not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: breedingRecord
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/v1/breeding-records/:id
  async updateBreedingRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateBreedingRecordInput = req.body;
      
      // Convert date strings to Date objects if needed
      if (updateData.breedingDate && typeof updateData.breedingDate === 'string') {
        updateData.breedingDate = new Date(updateData.breedingDate);
      }
      if (updateData.expectedDueDate && typeof updateData.expectedDueDate === 'string') {
        updateData.expectedDueDate = new Date(updateData.expectedDueDate);
      }
      if (updateData.actualBirthDate && typeof updateData.actualBirthDate === 'string') {
        updateData.actualBirthDate = new Date(updateData.actualBirthDate);
      }

      const breedingRecord = await this.breedingService.updateBreedingRecord(id, updateData);

      if (!breedingRecord) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Breeding record not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: breedingRecord
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/breeding-records/:id
  async deleteBreedingRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.breedingService.deleteBreedingRecord(id);

      if (!success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Breeding record not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { message: 'Breeding record deleted successfully' }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/breeding-records/sire/:sireId
  async getBreedingRecordsBySire(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sireId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.breedingService.getBreedingRecordsBySire(sireId, {
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

  // GET /api/v1/breeding-records/dam/:damId
  async getBreedingRecordsByDam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { damId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.breedingService.getBreedingRecordsByDam(damId, {
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

  // GET /api/v1/breeding-records/parent/:parentId
  async getBreedingRecordsByParent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.breedingService.getBreedingRecordsByParent(parentId, {
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

  // GET /api/v1/breeding-records/expected-births?days=30
  async getExpectedBirths(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const daysAhead = parseInt(req.query.days as string) || 30;
      const expectedBirths = await this.breedingService.getExpectedBirths(daysAhead);

      const response: ApiResponse = {
        success: true,
        data: expectedBirths
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/breeding-records/statistics
  async getBreedingStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.breedingService.getBreedingStatistics();

      const response: ApiResponse = {
        success: true,
        data: stats
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/breeding-records/date-range?startDate=2024-01-01&endDate=2024-12-31
  async getBreedingRecordsByDateRange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;

      if (!startDateStr || !endDateStr) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Both startDate and endDate are required'
          }
        };
        res.status(400).json(response);
        return;
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_DATE',
            message: 'Invalid date format. Use YYYY-MM-DD'
          }
        };
        res.status(400).json(response);
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.breedingService.getBreedingRecordsByDateRange(startDate, endDate, {
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

  // POST /api/v1/breeding-records/validate-pair
  async validateBreedingPair(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sireId, damId } = req.body;

      if (!sireId || !damId) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Both sireId and damId are required'
          }
        };
        res.status(400).json(response);
        return;
      }

      const validation = await this.breedingService.validateBreedingPair(sireId, damId);

      const response: ApiResponse = {
        success: true,
        data: validation
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}