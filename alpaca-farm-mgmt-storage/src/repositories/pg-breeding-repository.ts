/**
 * PostgreSQL Breeding Repository implementation
 */

import { BreedingRecord, CreateBreedingRecordInput, UpdateBreedingRecordInput } from '../models/breeding-record.js';
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

export class PostgreSQLBreedingRepository {
    constructor(private db: PostgreSQLConnection) { }

    async create(input: CreateBreedingRecordInput): Promise<BreedingRecord> {
        const client = await this.db.getClient();

        try {
            await client.query('BEGIN');

            // Insert breeding record
            const breedingQuery = `
        INSERT INTO breeding_records (
          sire_id, dam_id, breeding_date, expected_due_date, 
          actual_birth_date, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

            const breedingValues = [
                input.sireId,
                input.damId,
                input.breedingDate,
                input.expectedDueDate || null,
                input.actualBirthDate || null,
                input.notes || null
            ];

            const breedingResult = await client.query(breedingQuery, breedingValues);
            const breedingRecord = breedingResult.rows[0];

            // Insert offspring relationships if provided
            if (input.offspringIds && input.offspringIds.length > 0) {
                const offspringQuery = `
          INSERT INTO breeding_offspring (breeding_id, offspring_id)
          VALUES ($1, $2)
        `;

                for (const offspringId of input.offspringIds) {
                    await client.query(offspringQuery, [breedingRecord.id, offspringId]);
                }
            }

            await client.query('COMMIT');
            return this.mapRowToBreedingRecord(breedingRecord, input.offspringIds || []);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async findById(id: string): Promise<BreedingRecord | null> {
        const query = `
      SELECT br.*, 
             array_agg(bo.offspring_id) FILTER (WHERE bo.offspring_id IS NOT NULL) as offspring_ids
      FROM breeding_records br
      LEFT JOIN breeding_offspring bo ON br.id = bo.breeding_id
      WHERE br.id = $1
      GROUP BY br.id
    `;

        const result = await this.db.query(query, [id]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return this.mapRowToBreedingRecord(row, row.offspring_ids || []);
    }

    async findAll(options: QueryOptions = {}): Promise<PaginatedResult<BreedingRecord>> {
        const limit = options.limit || 20;
        const offset = options.offset || 0;
        const page = Math.floor(offset / limit) + 1;

        // Build ORDER BY clause (default to newest first)
        let orderBy = 'ORDER BY br.breeding_date DESC, br.created_at DESC';
        if (options.sortBy) {
            const sortOrder = options.sortOrder || 'desc';
            const validSortFields = ['breeding_date', 'expected_due_date', 'actual_birth_date', 'created_at'];
            if (validSortFields.includes(options.sortBy)) {
                orderBy = `ORDER BY br.${options.sortBy} ${sortOrder.toUpperCase()}`;
            }
        }

        // Get total count
        const countResult = await this.db.query('SELECT COUNT(*) FROM breeding_records');
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data with offspring
        const dataQuery = `
      SELECT br.*, 
             array_agg(bo.offspring_id) FILTER (WHERE bo.offspring_id IS NOT NULL) as offspring_ids
      FROM breeding_records br
      LEFT JOIN breeding_offspring bo ON br.id = bo.breeding_id
      GROUP BY br.id
      ${orderBy}
      LIMIT $1 OFFSET $2
    `;
        const dataResult = await this.db.query(dataQuery, [limit, offset]);

        const data = dataResult.rows.map((row: any) =>
            this.mapRowToBreedingRecord(row, row.offspring_ids || [])
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

    async update(id: string, input: UpdateBreedingRecordInput): Promise<BreedingRecord | null> {
        const client = await this.db.getClient();

        try {
            await client.query('BEGIN');

            // Build dynamic update query for breeding record
            const updateFields: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (input.sireId !== undefined) {
                updateFields.push(`sire_id = $${paramCount++}`);
                values.push(input.sireId);
            }
            if (input.damId !== undefined) {
                updateFields.push(`dam_id = $${paramCount++}`);
                values.push(input.damId);
            }
            if (input.breedingDate !== undefined) {
                updateFields.push(`breeding_date = $${paramCount++}`);
                values.push(input.breedingDate);
            }
            if (input.expectedDueDate !== undefined) {
                updateFields.push(`expected_due_date = $${paramCount++}`);
                values.push(input.expectedDueDate);
            }
            if (input.actualBirthDate !== undefined) {
                updateFields.push(`actual_birth_date = $${paramCount++}`);
                values.push(input.actualBirthDate);
            }
            if (input.notes !== undefined) {
                updateFields.push(`notes = $${paramCount++}`);
                values.push(input.notes);
            }

            let breedingRecord;
            if (updateFields.length > 0) {
                values.push(id);
                const query = `
          UPDATE breeding_records 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;
                const result = await client.query(query, values);

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return null;
                }
                breedingRecord = result.rows[0];
            } else {
                // No breeding record fields to update, get existing record
                const result = await client.query('SELECT * FROM breeding_records WHERE id = $1', [id]);
                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return null;
                }
                breedingRecord = result.rows[0];
            }

            // Update offspring relationships if provided
            if (input.offspringIds !== undefined) {
                // Delete existing offspring relationships
                await client.query('DELETE FROM breeding_offspring WHERE breeding_id = $1', [id]);

                // Insert new offspring relationships
                if (input.offspringIds.length > 0) {
                    const offspringQuery = `
            INSERT INTO breeding_offspring (breeding_id, offspring_id)
            VALUES ($1, $2)
          `;
                    for (const offspringId of input.offspringIds) {
                        await client.query(offspringQuery, [id, offspringId]);
                    }
                }
            }

            await client.query('COMMIT');

            // Get current offspring IDs
            const offspringResult = await this.db.query(
                'SELECT offspring_id FROM breeding_offspring WHERE breeding_id = $1',
                [id]
            );
            const offspringIds = offspringResult.rows.map((row: any) => row.offspring_id);

            return this.mapRowToBreedingRecord(breedingRecord, offspringIds);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async delete(id: string): Promise<boolean> {
        const query = 'DELETE FROM breeding_records WHERE id = $1';
        const result = await this.db.query(query, [id]);
        return result.rowCount > 0;
    }

    async findBySire(sireId: string, options: QueryOptions = {}): Promise<PaginatedResult<BreedingRecord>> {
        return this.findByParent('sire_id', sireId, options);
    }

    async findByDam(damId: string, options: QueryOptions = {}): Promise<PaginatedResult<BreedingRecord>> {
        return this.findByParent('dam_id', damId, options);
    }

    async findByParent(parentField: 'sire_id' | 'dam_id', parentId: string, options: QueryOptions = {}): Promise<PaginatedResult<BreedingRecord>> {
        const limit = options.limit || 20;
        const offset = options.offset || 0;
        const page = Math.floor(offset / limit) + 1;

        // Get total count
        const countQuery = `SELECT COUNT(*) FROM breeding_records WHERE ${parentField} = $1`;
        const countResult = await this.db.query(countQuery, [parentId]);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        const dataQuery = `
      SELECT br.*, 
             array_agg(bo.offspring_id) FILTER (WHERE bo.offspring_id IS NOT NULL) as offspring_ids
      FROM breeding_records br
      LEFT JOIN breeding_offspring bo ON br.id = bo.breeding_id
      WHERE br.${parentField} = $1
      GROUP BY br.id
      ORDER BY br.breeding_date DESC
      LIMIT $2 OFFSET $3
    `;
        const dataResult = await this.db.query(dataQuery, [parentId, limit, offset]);

        const data = dataResult.rows.map((row: any) =>
            this.mapRowToBreedingRecord(row, row.offspring_ids || [])
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

    async findByDateRange(startDate: Date, endDate: Date, options: QueryOptions = {}): Promise<PaginatedResult<BreedingRecord>> {
        const limit = options.limit || 20;
        const offset = options.offset || 0;
        const page = Math.floor(offset / limit) + 1;

        // Get total count
        const countQuery = 'SELECT COUNT(*) FROM breeding_records WHERE breeding_date BETWEEN $1 AND $2';
        const countResult = await this.db.query(countQuery, [startDate, endDate]);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        const dataQuery = `
      SELECT br.*, 
             array_agg(bo.offspring_id) FILTER (WHERE bo.offspring_id IS NOT NULL) as offspring_ids
      FROM breeding_records br
      LEFT JOIN breeding_offspring bo ON br.id = bo.breeding_id
      WHERE br.breeding_date BETWEEN $1 AND $2
      GROUP BY br.id
      ORDER BY br.breeding_date DESC
      LIMIT $3 OFFSET $4
    `;
        const dataResult = await this.db.query(dataQuery, [startDate, endDate, limit, offset]);

        const data = dataResult.rows.map((row: any) =>
            this.mapRowToBreedingRecord(row, row.offspring_ids || [])
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

    async getExpectedBirths(daysAhead: number = 30): Promise<BreedingRecord[]> {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + daysAhead);

        const query = `
      SELECT br.*, 
             array_agg(bo.offspring_id) FILTER (WHERE bo.offspring_id IS NOT NULL) as offspring_ids
      FROM breeding_records br
      LEFT JOIN breeding_offspring bo ON br.id = bo.breeding_id
      WHERE br.expected_due_date IS NOT NULL 
        AND br.actual_birth_date IS NULL
        AND br.expected_due_date BETWEEN CURRENT_DATE AND $1
      GROUP BY br.id
      ORDER BY br.expected_due_date ASC
    `;

        const result = await this.db.query(query, [endDate]);
        return result.rows.map((row: any) =>
            this.mapRowToBreedingRecord(row, row.offspring_ids || [])
        );
    }

    private mapRowToBreedingRecord(row: any, offspringIds: string[]): BreedingRecord {
        return {
            id: row.id,
            sireId: row.sire_id,
            damId: row.dam_id,
            breedingDate: new Date(row.breeding_date),
            expectedDueDate: row.expected_due_date ? new Date(row.expected_due_date) : undefined,
            actualBirthDate: row.actual_birth_date ? new Date(row.actual_birth_date) : undefined,
            notes: row.notes,
            offspringIds: offspringIds.filter(id => id !== null),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.created_at) // breeding_records table doesn't have updated_at
        };
    }
}