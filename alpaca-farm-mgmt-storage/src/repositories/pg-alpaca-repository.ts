/**
 * PostgreSQL Alpaca Repository implementation
 */

import { Alpaca, CreateAlpacaInput, UpdateAlpacaInput } from '../models/alpaca.js';
import { PostgreSQLConnection } from '../database/pg-connection.js';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PostgreSQLAlpacaRepository {
  constructor(private db: PostgreSQLConnection) {}

  async create(input: CreateAlpacaInput): Promise<Alpaca> {
    const query = `
      INSERT INTO alpacas (
        name, registration_number, birth_date, gender, color, 
        weight, height, fiber_micron_count, fiber_staple_length, 
        fiber_crimp, fiber_density, sire_id, dam_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      input.name,
      input.registrationNumber || null,
      input.birthDate,
      input.gender,
      input.color,
      input.weight || null,
      input.height || null,
      input.fiberQuality?.micronCount || null,
      input.fiberQuality?.stapleLength || null,
      input.fiberQuality?.crimp || null,
      input.fiberQuality?.density || null,
      input.sireId || null,
      input.damId || null
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToAlpaca(result.rows[0]);
  }

  async findById(id: string): Promise<Alpaca | null> {
    const query = 'SELECT * FROM alpacas WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToAlpaca(result.rows[0]);
  }

  async findAll(options: QueryOptions = {}): Promise<PaginatedResult<Alpaca>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    
    // Build ORDER BY clause
    let orderBy = 'ORDER BY created_at DESC';
    if (options.sortBy) {
      const sortOrder = options.sortOrder || 'asc';
      const validSortFields = ['name', 'birth_date', 'gender', 'color', 'created_at'];
      if (validSortFields.includes(options.sortBy)) {
        orderBy = `ORDER BY ${options.sortBy} ${sortOrder.toUpperCase()}`;
      }
    }

    // Get total count
    const countResult = await this.db.query('SELECT COUNT(*) FROM alpacas');
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataQuery = `
      SELECT * FROM alpacas 
      ${orderBy}
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await this.db.query(dataQuery, [limit, offset]);

    const data = dataResult.rows.map((row: any) => this.mapRowToAlpaca(row));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async update(id: string, input: UpdateAlpacaInput): Promise<Alpaca | null> {
    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(input.name);
    }
    if (input.registrationNumber !== undefined) {
      updateFields.push(`registration_number = $${paramCount++}`);
      values.push(input.registrationNumber);
    }
    if (input.birthDate !== undefined) {
      updateFields.push(`birth_date = $${paramCount++}`);
      values.push(input.birthDate);
    }
    if (input.gender !== undefined) {
      updateFields.push(`gender = $${paramCount++}`);
      values.push(input.gender);
    }
    if (input.color !== undefined) {
      updateFields.push(`color = $${paramCount++}`);
      values.push(input.color);
    }
    if (input.weight !== undefined) {
      updateFields.push(`weight = $${paramCount++}`);
      values.push(input.weight);
    }
    if (input.height !== undefined) {
      updateFields.push(`height = $${paramCount++}`);
      values.push(input.height);
    }
    if (input.fiberQuality?.micronCount !== undefined) {
      updateFields.push(`fiber_micron_count = $${paramCount++}`);
      values.push(input.fiberQuality.micronCount);
    }
    if (input.fiberQuality?.stapleLength !== undefined) {
      updateFields.push(`fiber_staple_length = $${paramCount++}`);
      values.push(input.fiberQuality.stapleLength);
    }
    if (input.fiberQuality?.crimp !== undefined) {
      updateFields.push(`fiber_crimp = $${paramCount++}`);
      values.push(input.fiberQuality.crimp);
    }
    if (input.fiberQuality?.density !== undefined) {
      updateFields.push(`fiber_density = $${paramCount++}`);
      values.push(input.fiberQuality.density);
    }
    if (input.sireId !== undefined) {
      updateFields.push(`sire_id = $${paramCount++}`);
      values.push(input.sireId);
    }
    if (input.damId !== undefined) {
      updateFields.push(`dam_id = $${paramCount++}`);
      values.push(input.damId);
    }

    if (updateFields.length === 0) {
      // No fields to update, return existing record
      return await this.findById(id);
    }

    // Add updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add id parameter
    values.push(id);

    const query = `
      UPDATE alpacas 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToAlpaca(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM alpacas WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }

  async search(query: string, options: QueryOptions = {}): Promise<PaginatedResult<Alpaca>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    const searchQuery = `%${query.toLowerCase()}%`;
    
    // Get total count
    const countSql = `
      SELECT COUNT(*) FROM alpacas 
      WHERE LOWER(name) LIKE $1 
         OR LOWER(registration_number) LIKE $1 
         OR LOWER(color) LIKE $1
    `;
    const countResult = await this.db.query(countSql, [searchQuery]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataSql = `
      SELECT * FROM alpacas 
      WHERE LOWER(name) LIKE $1 
         OR LOWER(registration_number) LIKE $1 
         OR LOWER(color) LIKE $1
      ORDER BY name ASC
      LIMIT $2 OFFSET $3
    `;
    const dataResult = await this.db.query(dataSql, [searchQuery, limit, offset]);

    const data = dataResult.rows.map((row: any) => this.mapRowToAlpaca(row));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async findByGender(gender: 'male' | 'female', options: QueryOptions = {}): Promise<PaginatedResult<Alpaca>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Get total count
    const countResult = await this.db.query('SELECT COUNT(*) FROM alpacas WHERE gender = $1', [gender]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataQuery = `
      SELECT * FROM alpacas 
      WHERE gender = $1
      ORDER BY name ASC
      LIMIT $2 OFFSET $3
    `;
    const dataResult = await this.db.query(dataQuery, [gender, limit, offset]);

    const data = dataResult.rows.map((row: any) => this.mapRowToAlpaca(row));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  private mapRowToAlpaca(row: any): Alpaca {
    return {
      id: row.id,
      name: row.name,
      registrationNumber: row.registration_number,
      birthDate: new Date(row.birth_date),
      gender: row.gender,
      color: row.color,
      weight: row.weight ? parseFloat(row.weight) : undefined,
      height: row.height ? parseFloat(row.height) : undefined,
      fiberQuality: {
        micronCount: row.fiber_micron_count ? parseFloat(row.fiber_micron_count) : undefined,
        stapleLength: row.fiber_staple_length ? parseFloat(row.fiber_staple_length) : undefined,
        crimp: row.fiber_crimp,
        density: row.fiber_density
      },
      sireId: row.sire_id,
      damId: row.dam_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}