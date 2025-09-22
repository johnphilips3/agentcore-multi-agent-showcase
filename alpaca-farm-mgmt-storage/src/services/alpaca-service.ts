/**
 * Simple Alpaca Service Implementation
 */

import { Alpaca, CreateAlpacaInput, UpdateAlpacaInput } from '../models/alpaca.js';
import { PostgreSQLAlpacaRepository, QueryOptions, PaginatedResult } from '../repositories/pg-alpaca-repository.js';

export interface HerdStatistics {
  totalCount: number;
  maleCount: number;
  femaleCount: number;
  averageAge: number;
  registeredCount: number;
}

export class AlpacaService {
  constructor(private repository: PostgreSQLAlpacaRepository) {}

  async createAlpaca(input: CreateAlpacaInput): Promise<Alpaca> {
    // Basic validation
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Alpaca name is required');
    }
    
    if (!input.birthDate) {
      throw new Error('Birth date is required');
    }
    
    if (!input.gender || !['male', 'female'].includes(input.gender)) {
      throw new Error('Valid gender (male/female) is required');
    }
    
    if (!input.color || input.color.trim().length === 0) {
      throw new Error('Color is required');
    }

    return await this.repository.create(input);
  }

  async getAlpaca(id: string): Promise<Alpaca | null> {
    if (!id || id.trim().length === 0) {
      throw new Error('Alpaca ID is required');
    }
    
    return await this.repository.findById(id);
  }

  async getAllAlpacas(options: QueryOptions = {}): Promise<PaginatedResult<Alpaca>> {
    return await this.repository.findAll(options);
  }

  async updateAlpaca(id: string, input: UpdateAlpacaInput): Promise<Alpaca | null> {
    if (!id || id.trim().length === 0) {
      throw new Error('Alpaca ID is required');
    }

    // Validate input if provided
    if (input.name !== undefined && input.name.trim().length === 0) {
      throw new Error('Alpaca name cannot be empty');
    }
    
    if (input.gender !== undefined && !['male', 'female'].includes(input.gender)) {
      throw new Error('Valid gender (male/female) is required');
    }
    
    if (input.color !== undefined && input.color.trim().length === 0) {
      throw new Error('Color cannot be empty');
    }

    return await this.repository.update(id, input);
  }

  async deleteAlpaca(id: string): Promise<boolean> {
    if (!id || id.trim().length === 0) {
      throw new Error('Alpaca ID is required');
    }
    
    return await this.repository.delete(id);
  }

  async searchAlpacas(query: string, options: QueryOptions = {}): Promise<PaginatedResult<Alpaca>> {
    if (!query || query.trim().length === 0) {
      return await this.repository.findAll(options);
    }
    
    return await this.repository.search(query.trim(), options);
  }

  async getAlpacasByGender(gender: 'male' | 'female', options: QueryOptions = {}): Promise<PaginatedResult<Alpaca>> {
    return await this.repository.findByGender(gender, options);
  }

  async getHerdStatistics(): Promise<HerdStatistics> {
    const allAlpacas = await this.repository.findAll({ limit: 1000 }); // Get all for stats
    const alpacas = allAlpacas.data;
    
    const totalCount = alpacas.length;
    const maleCount = alpacas.filter(a => a.gender === 'male').length;
    const femaleCount = alpacas.filter(a => a.gender === 'female').length;
    const registeredCount = alpacas.filter(a => a.registrationNumber).length;
    
    // Calculate average age
    const now = new Date();
    const totalAgeInYears = alpacas.reduce((sum, alpaca) => {
      const ageInMs = now.getTime() - alpaca.birthDate.getTime();
      const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25);
      return sum + ageInYears;
    }, 0);
    
    const averageAge = totalCount > 0 ? totalAgeInYears / totalCount : 0;
    
    return {
      totalCount,
      maleCount,
      femaleCount,
      averageAge: Math.round(averageAge * 100) / 100, // Round to 2 decimal places
      registeredCount
    };
  }

  // Note: Sample data initialization is handled by database scripts
}