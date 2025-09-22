/**
 * Simple Breeding Service Implementation
 */

import { BreedingRecord, CreateBreedingRecordInput, UpdateBreedingRecordInput } from '../models/breeding-record.js';
import { PostgreSQLBreedingRepository, QueryOptions, PaginatedResult } from '../repositories/pg-breeding-repository.js';

export interface BreedingStatistics {
  totalBreedings: number;
  successfulBreedings: number;
  expectedBirths: number;
  averageGestationDays: number;
  breedingsByYear: { year: number; count: number }[];
}

export interface BreedingCompatibility {
  compatible: boolean;
  reasons: string[];
  warnings: string[];
}

export class BreedingService {
  constructor(private repository: PostgreSQLBreedingRepository) {}

  async createBreedingRecord(input: CreateBreedingRecordInput): Promise<BreedingRecord> {
    // Basic validation
    if (!input.sireId || input.sireId.trim().length === 0) {
      throw new Error('Sire ID is required');
    }
    
    if (!input.damId || input.damId.trim().length === 0) {
      throw new Error('Dam ID is required');
    }
    
    if (!input.breedingDate) {
      throw new Error('Breeding date is required');
    }

    if (input.sireId === input.damId) {
      throw new Error('Sire and dam cannot be the same alpaca');
    }

    return await this.repository.create(input);
  }

  async getBreedingRecord(id: string): Promise<BreedingRecord | null> {
    if (!id || id.trim().length === 0) {
      throw new Error('Breeding record ID is required');
    }
    
    return await this.repository.findById(id);
  }

  async getAllBreedingRecords(options: QueryOptions = {}): Promise<PaginatedResult<BreedingRecord>> {
    return await this.repository.findAll(options);
  }

  async updateBreedingRecord(id: string, input: UpdateBreedingRecordInput): Promise<BreedingRecord | null> {
    if (!id || id.trim().length === 0) {
      throw new Error('Breeding record ID is required');
    }

    // Validate input if provided
    if (input.sireId !== undefined && input.sireId.trim().length === 0) {
      throw new Error('Sire ID cannot be empty');
    }
    
    if (input.damId !== undefined && input.damId.trim().length === 0) {
      throw new Error('Dam ID cannot be empty');
    }

    if (input.sireId && input.damId && input.sireId === input.damId) {
      throw new Error('Sire and dam cannot be the same alpaca');
    }

    return await this.repository.update(id, input);
  }

  async deleteBreedingRecord(id: string): Promise<boolean> {
    if (!id || id.trim().length === 0) {
      throw new Error('Breeding record ID is required');
    }
    
    return await this.repository.delete(id);
  }

  async getBreedingRecordsBySire(sireId: string, options: QueryOptions = {}): Promise<PaginatedResult<BreedingRecord>> {
    if (!sireId || sireId.trim().length === 0) {
      throw new Error('Sire ID is required');
    }
    
    return await this.repository.findBySire(sireId, options);
  }

  async getBreedingRecordsByDam(damId: string, options: QueryOptions = {}): Promise<PaginatedResult<BreedingRecord>> {
    if (!damId || damId.trim().length === 0) {
      throw new Error('Dam ID is required');
    }
    
    return await this.repository.findByDam(damId, options);
  }

  async getBreedingRecordsByParent(parentId: string, options: QueryOptions = {}): Promise<PaginatedResult<BreedingRecord>> {
    if (!parentId || parentId.trim().length === 0) {
      throw new Error('Parent ID is required');
    }
    
    // Get records where the alpaca is either sire or dam
    const sireRecords = await this.repository.findBySire(parentId, options);
    const damRecords = await this.repository.findByDam(parentId, options);
    
    // Combine and deduplicate results
    const allRecords = [...sireRecords.data, ...damRecords.data];
    const uniqueRecords = allRecords.filter((record, index, self) => 
      index === self.findIndex(r => r.id === record.id)
    );
    
    // Sort by breeding date (newest first)
    uniqueRecords.sort((a, b) => b.breedingDate.getTime() - a.breedingDate.getTime());
    
    const total = uniqueRecords.length;
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    const data = uniqueRecords.slice(offset, offset + limit);
    const totalPages = Math.ceil(total / limit);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async getBreedingRecordsByDateRange(startDate: Date, endDate: Date, options: QueryOptions = {}): Promise<PaginatedResult<BreedingRecord>> {
    return await this.repository.findByDateRange(startDate, endDate, options);
  }

  async getExpectedBirths(daysAhead: number = 30): Promise<BreedingRecord[]> {
    if (daysAhead < 0) {
      throw new Error('Days ahead must be a positive number');
    }
    
    return await this.repository.getExpectedBirths(daysAhead);
  }

  async getBreedingStatistics(): Promise<BreedingStatistics> {
    const allRecords = await this.repository.findAll({ limit: 1000 }); // Get all for stats
    const records = allRecords.data;
    
    const totalBreedings = records.length;
    const successfulBreedings = records.filter(r => r.actualBirthDate).length;
    const expectedBirths = records.filter(r => 
      r.expectedDueDate && 
      !r.actualBirthDate && 
      r.expectedDueDate > new Date()
    ).length;
    
    // Calculate average gestation days for completed pregnancies
    const completedPregnancies = records.filter(r => r.actualBirthDate && r.breedingDate);
    const totalGestationDays = completedPregnancies.reduce((sum, record) => {
      const gestationMs = record.actualBirthDate!.getTime() - record.breedingDate.getTime();
      const gestationDays = gestationMs / (1000 * 60 * 60 * 24);
      return sum + gestationDays;
    }, 0);
    
    const averageGestationDays = completedPregnancies.length > 0 ? 
      Math.round(totalGestationDays / completedPregnancies.length) : 0;
    
    // Group breedings by year
    const breedingsByYear: { [year: number]: number } = {};
    records.forEach(record => {
      const year = record.breedingDate.getFullYear();
      breedingsByYear[year] = (breedingsByYear[year] || 0) + 1;
    });
    
    const breedingsByYearArray = Object.entries(breedingsByYear)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => b.year - a.year);
    
    return {
      totalBreedings,
      successfulBreedings,
      expectedBirths,
      averageGestationDays,
      breedingsByYear: breedingsByYearArray
    };
  }

  async validateBreedingPair(sireId: string, damId: string): Promise<BreedingCompatibility> {
    if (!sireId || !damId) {
      return {
        compatible: false,
        reasons: ['Both sire and dam IDs are required'],
        warnings: []
      };
    }

    if (sireId === damId) {
      return {
        compatible: false,
        reasons: ['Sire and dam cannot be the same alpaca'],
        warnings: []
      };
    }

    // TODO: Add more sophisticated breeding compatibility checks
    // - Check if alpacas exist
    // - Check genders
    // - Check ages
    // - Check genetic relationships
    // - Check breeding history

    return {
      compatible: true,
      reasons: [],
      warnings: ['Basic validation passed - detailed genetic analysis not yet implemented']
    };
  }

  // Note: Sample data initialization is handled by database scripts
}