/**
 * PostgreSQL Health Repository implementation
 */

import { HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput } from '../models/health-record.js';
import { RecordType } from '../models/common.js';
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

export class PostgreSQLHealthRepository {
  constructor(private db: PostgreSQLConnection) {}

  async create(input: CreateHealthRecordInput): Promise<HealthRecord> {
    const query = `
      INSERT INTO health_records (
        alpaca_id, record_type, date, description, 
        veterinarian, next_due_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      input.alpacaId,
      input.recordType,
      input.date,
      input.description,
      input.veterinarian || null,
      input.nextDueDate || null,
      input.notes || null
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToHealthRecord(result.rows[0]);
  }

  async findById(id: string): Promise<HealthRecord | null> {
    const query = 'SELECT * FROM health_records WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToHealthRecord(result.rows[0]);
  }

  async findAll(options: QueryOptions = {}): Promise<PaginatedResult<HealthRecord>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    
    // Build ORDER BY clause (default to newest first)
    let orderBy = 'ORDER BY date DESC, created_at DESC';
    if (options.sortBy) {
      const sortOrder = options.sortOrder || 'desc';
      const validSortFields = ['date', 'record_type', 'veterinarian', 'created_at'];
      if (validSortFields.includes(options.sortBy)) {
        orderBy = `ORDER BY ${options.sortBy} ${sortOrder.toUpperCase()}`;
      }
    }

    // Get total count
    const countResult = await this.db.query('SELECT COUNT(*) FROM health_records');
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataQuery = `
      SELECT * FROM health_records 
      ${orderBy}
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await this.db.query(dataQuery, [limit, offset]);

    const data = dataResult.rows.map((row: any) => this.mapRowToHealthRecord(row));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async update(id: string, input: UpdateHealthRecordInput): Promise<HealthRecord | null> {
    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.alpacaId !== undefined) {
      updateFields.push(`alpaca_id = $${paramCount++}`);
      values.push(input.alpacaId);
    }
    if (input.recordType !== undefined) {
      updateFields.push(`record_type = $${paramCount++}`);
      values.push(input.recordType);
    }
    if (input.date !== undefined) {
      updateFields.push(`date = $${paramCount++}`);
      values.push(input.date);
    }
    if (input.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(input.description);
    }
    if (input.veterinarian !== undefined) {
      updateFields.push(`veterinarian = $${paramCount++}`);
      values.push(input.veterinarian);
    }
    if (input.nextDueDate !== undefined) {
      updateFields.push(`next_due_date = $${paramCount++}`);
      values.push(input.nextDueDate);
    }
    if (input.notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      values.push(input.notes);
    }

    if (updateFields.length === 0) {
      // No fields to update, return existing record
      return await this.findById(id);
    }

    // Add id parameter
    values.push(id);

    const query = `
      UPDATE health_records 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToHealthRecord(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM health_records WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }

  async findByAlpaca(alpacaId: string, options: QueryOptions = {}): Promise<PaginatedResult<HealthRecord>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Get total count
    const countResult = await this.db.query('SELECT COUNT(*) FROM health_records WHERE alpaca_id = $1', [alpacaId]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data (newest first)
    const dataQuery = `
      SELECT * FROM health_records 
      WHERE alpaca_id = $1
      ORDER BY date DESC, created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const dataResult = await this.db.query(dataQuery, [alpacaId, limit, offset]);

    const data = dataResult.rows.map((row: any) => this.mapRowToHealthRecord(row));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async findByRecordType(recordType: RecordType, options: QueryOptions = {}): Promise<PaginatedResult<HealthRecord>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Get total count
    const countResult = await this.db.query('SELECT COUNT(*) FROM health_records WHERE record_type = $1', [recordType]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data (newest first)
    const dataQuery = `
      SELECT * FROM health_records 
      WHERE record_type = $1
      ORDER BY date DESC, created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const dataResult = await this.db.query(dataQuery, [recordType, limit, offset]);

    const data = dataResult.rows.map((row: any) => this.mapRowToHealthRecord(row));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async getOverdueVaccinations(): Promise<HealthRecord[]> {
    const query = `
      SELECT * FROM health_records 
      WHERE record_type = 'vaccination' 
        AND next_due_date IS NOT NULL 
        AND next_due_date < CURRENT_DATE
      ORDER BY next_due_date ASC
    `;
    
    const result = await this.db.query(query);
    return result.rows.map((row: any) => this.mapRowToHealthRecord(row));
  }

  async findByDateRange(startDate: Date, endDate: Date, options: QueryOptions = {}): Promise<PaginatedResult<HealthRecord>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Get total count
    const countQuery = 'SELECT COUNT(*) FROM health_records WHERE date BETWEEN $1 AND $2';
    const countResult = await this.db.query(countQuery, [startDate, endDate]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataQuery = `
      SELECT * FROM health_records 
      WHERE date BETWEEN $1 AND $2
      ORDER BY date DESC
      LIMIT $3 OFFSET $4
    `;
    const dataResult = await this.db.query(dataQuery, [startDate, endDate, limit, offset]);

    const data = dataResult.rows.map((row: any) => this.mapRowToHealthRecord(row));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  private mapRowToHealthRecord(row: any): HealthRecord {
    return {
      id: row.id,
      alpacaId: row.alpaca_id,
      recordType: row.record_type as RecordType,
      date: new Date(row.date),
      description: row.description,
      veterinarian: row.veterinarian,
      nextDueDate: row.next_due_date ? new Date(row.next_due_date) : undefined,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.created_at) // health_records table doesn't have updated_at
    };
  }
}