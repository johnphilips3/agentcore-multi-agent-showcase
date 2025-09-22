/**
 * PostgreSQL Management Activity Repository implementation
 */

import { ManagementActivity, CreateManagementActivityInput, UpdateManagementActivityInput } from '../models/management-activity.js';
import { ActivityType } from '../models/common.js';
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

export class PostgreSQLActivityRepository {
  constructor(private db: PostgreSQLConnection) {}

  async create(input: CreateManagementActivityInput, alpacaIds: string[]): Promise<ManagementActivity> {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');

      // Insert management activity
      const activityQuery = `
        INSERT INTO management_activities (
          activity_type, date, performed_by, description, notes
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const activityValues = [
        input.activityType,
        input.date,
        input.performedBy,
        input.description,
        input.notes || null
      ];

      const activityResult = await client.query(activityQuery, activityValues);
      const activity = activityResult.rows[0];

      // Insert alpaca associations
      if (alpacaIds && alpacaIds.length > 0) {
        const alpacaQuery = `
          INSERT INTO activity_alpacas (activity_id, alpaca_id)
          VALUES ($1, $2)
        `;

        for (const alpacaId of alpacaIds) {
          await client.query(alpacaQuery, [activity.id, alpacaId]);
        }
      }

      await client.query('COMMIT');
      return this.mapRowToActivity(activity, alpacaIds);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<ManagementActivity | null> {
    const query = `
      SELECT ma.*, 
             array_agg(aa.alpaca_id) FILTER (WHERE aa.alpaca_id IS NOT NULL) as alpaca_ids
      FROM management_activities ma
      LEFT JOIN activity_alpacas aa ON ma.id = aa.activity_id
      WHERE ma.id = $1
      GROUP BY ma.id
    `;
    
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return this.mapRowToActivity(row, row.alpaca_ids || []);
  }

  async findAll(options: QueryOptions = {}): Promise<PaginatedResult<ManagementActivity>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    
    // Build ORDER BY clause (default to newest first)
    let orderBy = 'ORDER BY ma.date DESC, ma.created_at DESC';
    if (options.sortBy) {
      const sortOrder = options.sortOrder || 'desc';
      const validSortFields = ['date', 'activity_type', 'performed_by', 'created_at'];
      if (validSortFields.includes(options.sortBy)) {
        orderBy = `ORDER BY ma.${options.sortBy} ${sortOrder.toUpperCase()}`;
      }
    }

    // Get total count
    const countResult = await this.db.query('SELECT COUNT(*) FROM management_activities');
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data with alpacas
    const dataQuery = `
      SELECT ma.*, 
             array_agg(aa.alpaca_id) FILTER (WHERE aa.alpaca_id IS NOT NULL) as alpaca_ids
      FROM management_activities ma
      LEFT JOIN activity_alpacas aa ON ma.id = aa.activity_id
      GROUP BY ma.id
      ${orderBy}
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await this.db.query(dataQuery, [limit, offset]);

    const data = dataResult.rows.map((row: any) => 
      this.mapRowToActivity(row, row.alpaca_ids || [])
    );
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async update(id: string, input: UpdateManagementActivityInput, alpacaIds?: string[]): Promise<ManagementActivity | null> {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');

      // Build dynamic update query for activity
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (input.activityType !== undefined) {
        updateFields.push(`activity_type = $${paramCount++}`);
        values.push(input.activityType);
      }
      if (input.date !== undefined) {
        updateFields.push(`date = $${paramCount++}`);
        values.push(input.date);
      }
      if (input.performedBy !== undefined) {
        updateFields.push(`performed_by = $${paramCount++}`);
        values.push(input.performedBy);
      }
      if (input.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        values.push(input.description);
      }
      if (input.notes !== undefined) {
        updateFields.push(`notes = $${paramCount++}`);
        values.push(input.notes);
      }

      let activity;
      if (updateFields.length > 0) {
        values.push(id);
        const query = `
          UPDATE management_activities 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;
        const result = await client.query(query, values);
        
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return null;
        }
        activity = result.rows[0];
      } else {
        // No activity fields to update, get existing record
        const result = await client.query('SELECT * FROM management_activities WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return null;
        }
        activity = result.rows[0];
      }

      // Update alpaca associations if provided
      if (alpacaIds !== undefined) {
        // Delete existing alpaca associations
        await client.query('DELETE FROM activity_alpacas WHERE activity_id = $1', [id]);
        
        // Insert new alpaca associations
        if (alpacaIds.length > 0) {
          const alpacaQuery = `
            INSERT INTO activity_alpacas (activity_id, alpaca_id)
            VALUES ($1, $2)
          `;
          for (const alpacaId of alpacaIds) {
            await client.query(alpacaQuery, [id, alpacaId]);
          }
        }
      }

      await client.query('COMMIT');
      
      // Get current alpaca IDs
      const alpacaResult = await this.db.query(
        'SELECT alpaca_id FROM activity_alpacas WHERE activity_id = $1',
        [id]
      );
      const currentAlpacaIds = alpacaResult.rows.map((row: any) => row.alpaca_id);
      
      return this.mapRowToActivity(activity, currentAlpacaIds);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM management_activities WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }

  async findByAlpaca(alpacaId: string, options: QueryOptions = {}): Promise<PaginatedResult<ManagementActivity>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT ma.id) 
      FROM management_activities ma
      INNER JOIN activity_alpacas aa ON ma.id = aa.activity_id
      WHERE aa.alpaca_id = $1
    `;
    const countResult = await this.db.query(countQuery, [alpacaId]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataQuery = `
      SELECT ma.*, 
             array_agg(aa2.alpaca_id) FILTER (WHERE aa2.alpaca_id IS NOT NULL) as alpaca_ids
      FROM management_activities ma
      INNER JOIN activity_alpacas aa ON ma.id = aa.activity_id
      LEFT JOIN activity_alpacas aa2 ON ma.id = aa2.activity_id
      WHERE aa.alpaca_id = $1
      GROUP BY ma.id
      ORDER BY ma.date DESC
      LIMIT $2 OFFSET $3
    `;
    const dataResult = await this.db.query(dataQuery, [alpacaId, limit, offset]);

    const data = dataResult.rows.map((row: any) => 
      this.mapRowToActivity(row, row.alpaca_ids || [])
    );
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async findByActivityType(activityType: ActivityType, options: QueryOptions = {}): Promise<PaginatedResult<ManagementActivity>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Get total count
    const countResult = await this.db.query('SELECT COUNT(*) FROM management_activities WHERE activity_type = $1', [activityType]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataQuery = `
      SELECT ma.*, 
             array_agg(aa.alpaca_id) FILTER (WHERE aa.alpaca_id IS NOT NULL) as alpaca_ids
      FROM management_activities ma
      LEFT JOIN activity_alpacas aa ON ma.id = aa.activity_id
      WHERE ma.activity_type = $1
      GROUP BY ma.id
      ORDER BY ma.date DESC
      LIMIT $2 OFFSET $3
    `;
    const dataResult = await this.db.query(dataQuery, [activityType, limit, offset]);

    const data = dataResult.rows.map((row: any) => 
      this.mapRowToActivity(row, row.alpaca_ids || [])
    );
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async findByPerformer(performer: string, options: QueryOptions = {}): Promise<PaginatedResult<ManagementActivity>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Get total count
    const countResult = await this.db.query('SELECT COUNT(*) FROM management_activities WHERE performed_by ILIKE $1', [`%${performer}%`]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataQuery = `
      SELECT ma.*, 
             array_agg(aa.alpaca_id) FILTER (WHERE aa.alpaca_id IS NOT NULL) as alpaca_ids
      FROM management_activities ma
      LEFT JOIN activity_alpacas aa ON ma.id = aa.activity_id
      WHERE ma.performed_by ILIKE $1
      GROUP BY ma.id
      ORDER BY ma.date DESC
      LIMIT $2 OFFSET $3
    `;
    const dataResult = await this.db.query(dataQuery, [`%${performer}%`, limit, offset]);

    const data = dataResult.rows.map((row: any) => 
      this.mapRowToActivity(row, row.alpaca_ids || [])
    );
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async findByDateRange(startDate: Date, endDate: Date, options: QueryOptions = {}): Promise<PaginatedResult<ManagementActivity>> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Get total count
    const countQuery = 'SELECT COUNT(*) FROM management_activities WHERE date BETWEEN $1 AND $2';
    const countResult = await this.db.query(countQuery, [startDate, endDate]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataQuery = `
      SELECT ma.*, 
             array_agg(aa.alpaca_id) FILTER (WHERE aa.alpaca_id IS NOT NULL) as alpaca_ids
      FROM management_activities ma
      LEFT JOIN activity_alpacas aa ON ma.id = aa.activity_id
      WHERE ma.date BETWEEN $1 AND $2
      GROUP BY ma.id
      ORDER BY ma.date DESC
      LIMIT $3 OFFSET $4
    `;
    const dataResult = await this.db.query(dataQuery, [startDate, endDate, limit, offset]);

    const data = dataResult.rows.map((row: any) => 
      this.mapRowToActivity(row, row.alpaca_ids || [])
    );
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  private mapRowToActivity(row: any, alpacaIds: string[]): ManagementActivity {
    return {
      id: row.id,
      activityType: row.activity_type as ActivityType,
      date: new Date(row.date),
      performedBy: row.performed_by,
      description: row.description,
      notes: row.notes,
      alpacaIds: alpacaIds.filter(id => id !== null),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.created_at) // management_activities table doesn't have updated_at
    };
  }
}