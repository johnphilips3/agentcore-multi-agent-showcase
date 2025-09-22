/**
 * Simple Activity Service Implementation
 */

import { ManagementActivity, CreateManagementActivityInput, UpdateManagementActivityInput } from '../models/management-activity.js';
import { ActivityType } from '../models/common.js';
import { PostgreSQLActivityRepository, QueryOptions, PaginatedResult } from '../repositories/pg-activity-repository.js';

export interface ActivityStatistics {
  totalActivities: number;
  activitiesByType: { type: ActivityType; count: number }[];
  activitiesByPerformer: { performer: string; count: number }[];
  recentActivities: number; // Last 30 days
  mostActiveAlpaca?: string;
}

export interface AlpacaActivitySummary {
  alpacaId: string;
  totalActivities: number;
  lastActivity?: Date;
  activitiesByType: { type: ActivityType; count: number }[];
  recentActivities: number; // Last 30 days
}

export class ActivityService {
  constructor(private repository: PostgreSQLActivityRepository) {}

  async createActivity(input: CreateManagementActivityInput, alpacaIds: string[]): Promise<ManagementActivity> {
    // Basic validation
    if (!input.activityType) {
      throw new Error('Activity type is required');
    }
    
    if (!input.date) {
      throw new Error('Date is required');
    }
    
    if (!input.performedBy || input.performedBy.trim().length === 0) {
      throw new Error('Performed by is required');
    }
    
    if (!input.description || input.description.trim().length === 0) {
      throw new Error('Description is required');
    }

    if (!alpacaIds || alpacaIds.length === 0) {
      throw new Error('At least one alpaca must be associated with the activity');
    }

    return await this.repository.create(input, alpacaIds);
  }

  async getActivity(id: string): Promise<ManagementActivity | null> {
    if (!id || id.trim().length === 0) {
      throw new Error('Activity ID is required');
    }
    
    return await this.repository.findById(id);
  }

  async getAllActivities(options: QueryOptions = {}): Promise<PaginatedResult<ManagementActivity>> {
    return await this.repository.findAll(options);
  }

  async updateActivity(id: string, input: UpdateManagementActivityInput, alpacaIds?: string[]): Promise<ManagementActivity | null> {
    if (!id || id.trim().length === 0) {
      throw new Error('Activity ID is required');
    }

    // Validate input if provided
    if (input.performedBy !== undefined && input.performedBy.trim().length === 0) {
      throw new Error('Performed by cannot be empty');
    }
    
    if (input.description !== undefined && input.description.trim().length === 0) {
      throw new Error('Description cannot be empty');
    }

    return await this.repository.update(id, input, alpacaIds);
  }

  async deleteActivity(id: string): Promise<boolean> {
    if (!id || id.trim().length === 0) {
      throw new Error('Activity ID is required');
    }
    
    return await this.repository.delete(id);
  }

  async getActivitiesByAlpaca(alpacaId: string, options: QueryOptions = {}): Promise<PaginatedResult<ManagementActivity>> {
    if (!alpacaId || alpacaId.trim().length === 0) {
      throw new Error('Alpaca ID is required');
    }
    
    return await this.repository.findByAlpaca(alpacaId, options);
  }

  async getActivitiesByType(activityType: ActivityType, options: QueryOptions = {}): Promise<PaginatedResult<ManagementActivity>> {
    return await this.repository.findByActivityType(activityType, options);
  }

  async getActivitiesByPerformer(performer: string, options: QueryOptions = {}): Promise<PaginatedResult<ManagementActivity>> {
    if (!performer || performer.trim().length === 0) {
      throw new Error('Performer name is required');
    }
    
    return await this.repository.findByPerformer(performer, options);
  }

  async getActivitiesByDateRange(startDate: Date, endDate: Date, options: QueryOptions = {}): Promise<PaginatedResult<ManagementActivity>> {
    if (startDate > endDate) {
      throw new Error('Start date must be before end date');
    }
    
    return await this.repository.findByDateRange(startDate, endDate, options);
  }

  async getActivityStatistics(): Promise<ActivityStatistics> {
    const allActivities = await this.repository.findAll({ limit: 1000 }); // Get all for stats
    const activities = allActivities.data;
    
    const totalActivities = activities.length;
    
    // Activities by type
    const typeCount: { [key: string]: number } = {};
    activities.forEach(activity => {
      typeCount[activity.activityType] = (typeCount[activity.activityType] || 0) + 1;
    });
    
    const activitiesByType = Object.entries(typeCount)
      .map(([type, count]) => ({ type: type as ActivityType, count }))
      .sort((a, b) => b.count - a.count);
    
    // Activities by performer
    const performerCount: { [key: string]: number } = {};
    activities.forEach(activity => {
      performerCount[activity.performedBy] = (performerCount[activity.performedBy] || 0) + 1;
    });
    
    const activitiesByPerformer = Object.entries(performerCount)
      .map(([performer, count]) => ({ performer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 performers
    
    // Recent activities (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentActivities = activities.filter(activity => 
      activity.date >= thirtyDaysAgo
    ).length;
    
    // Most active alpaca (alpaca with most activities)
    const alpacaActivityCount: { [key: string]: number } = {};
    activities.forEach(activity => {
      activity.alpacaIds.forEach(alpacaId => {
        alpacaActivityCount[alpacaId] = (alpacaActivityCount[alpacaId] || 0) + 1;
      });
    });
    
    const mostActiveAlpaca = Object.entries(alpacaActivityCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    return {
      totalActivities,
      activitiesByType,
      activitiesByPerformer,
      recentActivities,
      mostActiveAlpaca
    };
  }

  async getAlpacaActivitySummary(alpacaId: string): Promise<AlpacaActivitySummary> {
    if (!alpacaId || alpacaId.trim().length === 0) {
      throw new Error('Alpaca ID is required');
    }
    
    const allActivities = await this.repository.findByAlpaca(alpacaId, { limit: 1000 });
    const activities = allActivities.data;
    
    const totalActivities = activities.length;
    
    // Last activity date
    const lastActivity = activities.length > 0 ? 
      activities.sort((a, b) => b.date.getTime() - a.date.getTime())[0].date : undefined;
    
    // Activities by type
    const typeCount: { [key: string]: number } = {};
    activities.forEach(activity => {
      typeCount[activity.activityType] = (typeCount[activity.activityType] || 0) + 1;
    });
    
    const activitiesByType = Object.entries(typeCount)
      .map(([type, count]) => ({ type: type as ActivityType, count }))
      .sort((a, b) => b.count - a.count);
    
    // Recent activities (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentActivities = activities.filter(activity => 
      activity.date >= thirtyDaysAgo
    ).length;
    
    return {
      alpacaId,
      totalActivities,
      lastActivity,
      activitiesByType,
      recentActivities
    };
  }

  async createBulkActivity(input: CreateManagementActivityInput, alpacaIds: string[]): Promise<ManagementActivity> {
    // Validate bulk activity
    if (!alpacaIds || alpacaIds.length === 0) {
      throw new Error('At least one alpaca must be selected for bulk activity');
    }

    if (alpacaIds.length > 50) {
      throw new Error('Bulk activities are limited to 50 alpacas at once');
    }

    // Create single activity associated with multiple alpacas
    return await this.createActivity(input, alpacaIds);
  }

  async getScheduledActivities(daysAhead: number = 7): Promise<ManagementActivity[]> {
    // Note: This is a placeholder implementation
    // In a real system, you might have a separate scheduled_activities table
    // For now, we'll return activities from the next few days as "scheduled"
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);
    
    const result = await this.repository.findByDateRange(startDate, endDate, { limit: 100 });
    return result.data;
  }

  async getPerformanceMetrics(filters?: { 
    startDate?: Date; 
    endDate?: Date; 
    activityType?: ActivityType;
    performer?: string;
  }): Promise<{
    totalActivities: number;
    averageActivitiesPerDay: number;
    mostProductiveDay: string;
    completionRate: number; // Placeholder - would need scheduled vs completed data
  }> {
    let activities: ManagementActivity[];
    
    if (filters?.startDate && filters?.endDate) {
      const result = await this.repository.findByDateRange(filters.startDate, filters.endDate, { limit: 1000 });
      activities = result.data;
    } else {
      const result = await this.repository.findAll({ limit: 1000 });
      activities = result.data;
    }
    
    // Apply additional filters
    if (filters?.activityType) {
      activities = activities.filter(a => a.activityType === filters.activityType);
    }
    
    if (filters?.performer) {
      activities = activities.filter(a => 
        a.performedBy.toLowerCase().includes(filters.performer!.toLowerCase())
      );
    }
    
    const totalActivities = activities.length;
    
    // Calculate date range for average
    const dates = activities.map(a => a.date.toDateString());
    const uniqueDates = [...new Set(dates)];
    const averageActivitiesPerDay = uniqueDates.length > 0 ? 
      totalActivities / uniqueDates.length : 0;
    
    // Find most productive day
    const dayCount: { [key: string]: number } = {};
    activities.forEach(activity => {
      const day = activity.date.toDateString();
      dayCount[day] = (dayCount[day] || 0) + 1;
    });
    
    const mostProductiveDay = Object.entries(dayCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'No activities';
    
    return {
      totalActivities,
      averageActivitiesPerDay: Math.round(averageActivitiesPerDay * 100) / 100,
      mostProductiveDay,
      completionRate: 100 // Placeholder - would need actual scheduled vs completed data
    };
  }

  // Note: Sample data initialization is handled by database scripts
}