/**
 * PostgreSQL Database Connection Utility
 */

import { Pool, PoolClient, PoolConfig } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export class PostgreSQLConnection {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    // Configure SSL for RDS
    if (config.ssl) {
      poolConfig.ssl = {
        rejectUnauthorized: false
      };
    }

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('Database connection successful:', result.rows[0]);
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // Create connection from environment variables
  static fromEnvironment(): PostgreSQLConnection {
    const config: DatabaseConfig = {
      host: process.env.RDS_HOST || 'localhost',
      port: parseInt(process.env.RDS_PORT || '5432'),
      database: process.env.RDS_DATABASE || 'alpaca_herd',
      user: process.env.RDS_USERNAME || 'postgres',
      password: process.env.RDS_PASSWORD || '',
      ssl: process.env.RDS_SSL === 'true',
      maxConnections: parseInt(process.env.RDS_MAX_CONNECTIONS || '20')
    };

    return new PostgreSQLConnection(config);
  }
}