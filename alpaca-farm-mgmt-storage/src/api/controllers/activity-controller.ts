/**
 * Simple Activity Controller Implementation
 */

import { Request, Response, NextFunction } from 'express';
import { ActivityService } from '../../services/activity-service.js';
import { CreateManagementActivityInput, UpdateManagementActivityInput } from '../../models/management-activity.js';
import { ActivityType } from '../../models/common.js';

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

export class ActivityController {
  constructor(private activityService: ActivityService) {}

  // GET /api/v1/activities
  async getAllActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';

      const result = await this.activityService.getAllActivities({
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

  // POST /api/v1/activities
  async createActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activityData: CreateManagementActivityInput = req.body;
      
      // Convert date string to Date if needed
      if (typeof activityData.date === 'string') {
        activityData.date = new Date(activityData.date);
      }

      if (!activityData.alpacaIds || !Array.isArray(activityData.alpacaIds) || activityData.alpacaIds.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'MISSING_ALPACAS',
            message: 'At least one alpaca ID must be provided'
          }
        };
        res.status(400).json(response);
        return;
      }

      const activity = await this.activityService.createActivity(activityData, activityData.alpacaIds);

      const response: ApiResponse = {
        success: true,
        data: activity
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/activities/:id
  async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const activity = await this.activityService.getActivity(id);

      if (!activity) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Activity not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: activity
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/v1/activities/:id
  async updateActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateManagementActivityInput = req.body;
      const alpacaIds = updateData.alpacaIds;
      
      // Convert date string to Date if needed
      if (updateData.date && typeof updateData.date === 'string') {
        updateData.date = new Date(updateData.date);
      }

      const activity = await this.activityService.updateActivity(id, updateData, alpacaIds);

      if (!activity) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Activity not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: activity
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/activities/:id
  async deleteActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.activityService.deleteActivity(id);

      if (!success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Activity not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { message: 'Activity deleted successfully' }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/activities/alpaca/:alpacaId
  async getActivitiesByAlpaca(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { alpacaId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.activityService.getActivitiesByAlpaca(alpacaId, {
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

  // GET /api/v1/activities/type/:activityType
  async getActivitiesByType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activityType } = req.params;
      
      const validTypes: ActivityType[] = ['feeding', 'shearing', 'weighing', 'moving', 'training', 'other'];
      if (!validTypes.includes(activityType as ActivityType)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_ACTIVITY_TYPE',
            message: `Activity type must be one of: ${validTypes.join(', ')}`
          }
        };
        res.status(400).json(response);
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.activityService.getActivitiesByType(activityType as ActivityType, {
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

  // GET /api/v1/activities/performer/:performer
  async getActivitiesByPerformer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { performer } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const result = await this.activityService.getActivitiesByPerformer(performer, {
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

  // GET /api/v1/activities/statistics
  async getActivityStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.activityService.getActivityStatistics();

      const response: ApiResponse = {
        success: true,
        data: stats
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/activities/summary/:alpacaId
  async getAlpacaActivitySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { alpacaId } = req.params;
      const summary = await this.activityService.getAlpacaActivitySummary(alpacaId);

      const response: ApiResponse = {
        success: true,
        data: summary
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/activities/date-range?startDate=2024-01-01&endDate=2024-12-31
  async getActivitiesByDateRange(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const result = await this.activityService.getActivitiesByDateRange(startDate, endDate, {
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

  // POST /api/v1/activities/bulk
  async createBulkActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activityData: CreateManagementActivityInput = req.body;
      
      // Convert date string to Date if needed
      if (typeof activityData.date === 'string') {
        activityData.date = new Date(activityData.date);
      }

      const activity = await this.activityService.createBulkActivity(activityData, activityData.alpacaIds);

      const response: ApiResponse = {
        success: true,
        data: activity
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/activities/scheduled?days=7
  async getScheduledActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const daysAhead = parseInt(req.query.days as string) || 7;
      const activities = await this.activityService.getScheduledActivities(daysAhead);

      const response: ApiResponse = {
        success: true,
        data: activities
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/activities/performance-metrics
  async getPerformanceMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: any = {};
      
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      if (req.query.activityType) {
        filters.activityType = req.query.activityType as ActivityType;
      }
      if (req.query.performer) {
        filters.performer = req.query.performer as string;
      }

      const metrics = await this.activityService.getPerformanceMetrics(filters);

      const response: ApiResponse = {
        success: true,
        data: metrics
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}