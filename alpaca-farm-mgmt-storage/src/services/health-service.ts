/**
 * Simple Health Service Implementation
 */

import { HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput } from '../models/health-record.js';
import { RecordType } from '../models/common.js';
import { PostgreSQLHealthRepository, QueryOptions, PaginatedResult } from '../repositories/pg-health-repository.js';

export interface HealthAlert {
  id: string;
  alpacaId: string;
  recordType: RecordType;
  description: string;
  dueDate: Date;
  daysOverdue: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface HealthSummary {
  alpacaId: string;
  totalRecords: number;
  lastCheckup?: Date;
  lastVaccination?: Date;
  lastTreatment?: Date;
  upcomingVaccinations: number;
  overdueVaccinations: number;
}

export class HealthService {
  constructor(private repository: PostgreSQLHealthRepository) {}

  async createHealthRecord(input: CreateHealthRecordInput): Promise<HealthRecord> {
    // Basic validation
    if (!input.alpacaId || input.alpacaId.trim().length === 0) {
      throw new Error('Alpaca ID is required');
    }
    
    if (!input.recordType) {
      throw new Error('Record type is required');
    }
    
    if (!input.date) {
      throw new Error('Date is required');
    }
    
    if (!input.description || input.description.trim().length === 0) {
      throw new Error('Description is required');
    }

    return await this.repository.create(input);
  }

  async getHealthRecord(id: string): Promise<HealthRecord | null> {
    if (!id || id.trim().length === 0) {
      throw new Error('Health record ID is required');
    }
    
    return await this.repository.findById(id);
  }

  async getAllHealthRecords(options: QueryOptions = {}): Promise<PaginatedResult<HealthRecord>> {
    return await this.repository.findAll(options);
  }

  async updateHealthRecord(id: string, input: UpdateHealthRecordInput): Promise<HealthRecord | null> {
    if (!id || id.trim().length === 0) {
      throw new Error('Health record ID is required');
    }

    // Validate input if provided
    if (input.alpacaId !== undefined && input.alpacaId.trim().length === 0) {
      throw new Error('Alpaca ID cannot be empty');
    }
    
    if (input.description !== undefined && input.description.trim().length === 0) {
      throw new Error('Description cannot be empty');
    }

    return await this.repository.update(id, input);
  }

  async deleteHealthRecord(id: string): Promise<boolean> {
    if (!id || id.trim().length === 0) {
      throw new Error('Health record ID is required');
    }
    
    return await this.repository.delete(id);
  }

  async getHealthRecordsByAlpaca(alpacaId: string, options: QueryOptions = {}): Promise<PaginatedResult<HealthRecord>> {
    if (!alpacaId || alpacaId.trim().length === 0) {
      throw new Error('Alpaca ID is required');
    }
    
    return await this.repository.findByAlpaca(alpacaId, options);
  }

  async getHealthRecordsByType(recordType: RecordType, options: QueryOptions = {}): Promise<PaginatedResult<HealthRecord>> {
    return await this.repository.findByRecordType(recordType, options);
  }

  async getOverdueVaccinations(): Promise<HealthRecord[]> {
    return await this.repository.getOverdueVaccinations();
  }

  async getHealthAlerts(): Promise<HealthAlert[]> {
    const overdueVaccinations = await this.getOverdueVaccinations();
    const now = new Date();
    
    return overdueVaccinations.map(record => {
      const daysOverdue = Math.floor((now.getTime() - record.nextDueDate!.getTime()) / (1000 * 60 * 60 * 24));
      
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (daysOverdue > 90) priority = 'critical';
      else if (daysOverdue > 30) priority = 'high';
      else if (daysOverdue > 7) priority = 'medium';
      
      return {
        id: record.id,
        alpacaId: record.alpacaId,
        recordType: record.recordType,
        description: `Overdue ${record.recordType}: ${record.description}`,
        dueDate: record.nextDueDate!,
        daysOverdue,
        priority
      };
    });
  }

  async getHealthSummary(alpacaId: string): Promise<HealthSummary> {
    if (!alpacaId || alpacaId.trim().length === 0) {
      throw new Error('Alpaca ID is required');
    }
    
    const allRecords = await this.repository.findByAlpaca(alpacaId, { limit: 1000 });
    const records = allRecords.data;
    
    const checkups = records.filter(r => r.recordType === 'checkup');
    const vaccinations = records.filter(r => r.recordType === 'vaccination');
    const treatments = records.filter(r => r.recordType === 'treatment');
    
    const lastCheckup = checkups.length > 0 ? 
      checkups.sort((a, b) => b.date.getTime() - a.date.getTime())[0].date : undefined;
    
    const lastVaccination = vaccinations.length > 0 ? 
      vaccinations.sort((a, b) => b.date.getTime() - a.date.getTime())[0].date : undefined;
    
    const lastTreatment = treatments.length > 0 ? 
      treatments.sort((a, b) => b.date.getTime() - a.date.getTime())[0].date : undefined;
    
    const now = new Date();
    const upcomingVaccinations = vaccinations.filter(v => 
      v.nextDueDate && v.nextDueDate > now && v.nextDueDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    ).length;
    
    const overdueVaccinations = vaccinations.filter(v => 
      v.nextDueDate && v.nextDueDate < now
    ).length;
    
    return {
      alpacaId,
      totalRecords: records.length,
      lastCheckup,
      lastVaccination,
      lastTreatment,
      upcomingVaccinations,
      overdueVaccinations
    };
  }

  // Note: Sample data initialization is handled by database scripts
}