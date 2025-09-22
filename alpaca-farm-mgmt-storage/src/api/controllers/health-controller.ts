/**
 * Simple Health Controller Implementation
 */

import { Request, Response, NextFunction } from 'express';
import { HealthService } from '../../services/health-service.js';
import { CreateHealthRecordInput, UpdateHealthRecordInput } from '../../models/health-record.js';
import { RecordType } from '../../models/common.js';

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

export class HealthController {
  constructor(private healthService: HealthService) {}

  // GET /api/v1/health-records
  async getAllHealthRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';

      const result = await this.healthService.getAllHealthRecords({
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

  // POST /api/v1/health-records
  async createHealthRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const healthRecordData: CreateHealthRecordInput = req.body;
      
      // Convert date strings to Date objects if needed
      if (typeof healthRecordData.date === 'string') {
        healthRecordData.date = new Date(healthRecordData.date);
      }
      if (healthRecordData.nextDueDate && typeof healthRecordData.nextDueDate === 'string') {
        healthRecordData.nextDueDate = new Date(healthRecordData.nextDueDate);
      }

      const healthRecord = await this.healthService.createHealthRecord(healthRecordData);

      const response: ApiResponse = {
        success: true,
        data: healthRecord
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/health-records/:id
  async getHealthRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const healthRecord = await this.healthService.getHealthRecord(id);

      if (!healthRecord) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Health record not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: healthRecord
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/v1/health-records/:id
  async updateHealthRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateHealthRecordInput = req.body;
      
      // Convert date strings to Date objects if needed
      if (updateData.date && typeof updateData.date === 'string') {
        updateData.date = new Date(updateData.date);
      }
      if (updateData.nextDueDate && typeof updateData.nextDueDate === 'string') {
        updateData.nextDueDate = new Date(updateData.nextDueDate);
      }

      const healthRecord = await this.healthService.updateHealthRecord(id, updateData);

      if (!healthRecord) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Health record not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: healthRecord
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/health-records/:id
  async deleteHealthRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.healthService.deleteHealthRecord(id);

      if (!success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Health record not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { message: 'Health record deleted successfully' }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/health-records/alpaca/:alpacaId
  async getHealthRecordsByAlpaca(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { alpacaId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.healthService.getHealthRecordsByAlpaca(alpacaId, {
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

  // GET /api/v1/health-records/type/:recordType
  async getHealthRecordsByType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { recordType } = req.params;
      
      const validTypes: RecordType[] = ['vaccination', 'checkup', 'treatment', 'medication', 'surgery', 'injury', 'illness', 'other'];
      if (!validTypes.includes(recordType as RecordType)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_RECORD_TYPE',
            message: `Record type must be one of: ${validTypes.join(', ')}`
          }
        };
        res.status(400).json(response);
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.healthService.getHealthRecordsByType(recordType as RecordType, {
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

  // GET /api/v1/health-records/overdue-vaccinations
  async getOverdueVaccinations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overdueRecords = await this.healthService.getOverdueVaccinations();

      const response: ApiResponse = {
        success: true,
        data: overdueRecords
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/health-records/alerts
  async getHealthAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alerts = await this.healthService.getHealthAlerts();

      const response: ApiResponse = {
        success: true,
        data: alerts
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/health-records/summary/:alpacaId
  async getHealthSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { alpacaId } = req.params;
      const summary = await this.healthService.getHealthSummary(alpacaId);

      const response: ApiResponse = {
        success: true,
        data: summary
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}