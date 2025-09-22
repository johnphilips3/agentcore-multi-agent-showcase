import { RDS } from 'aws-sdk';
import { Pool, PoolConfig, Client } from 'pg';
import { getAWSConfigManager, AWSConfigManager } from './config';

export interface RDSConnectionConfig {
  instanceIdentifier: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  useIAM: boolean;
  ssl: boolean;
  maxConnections: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  region: string;
}

export interface RDSInstanceInfo {
  identifier: string;
  status: string;
  engine: string;
  engineVersion: string;
  instanceClass: string;
  availabilityZone: string;
  endpoint?: {
    address: string;
    port: number;
  };
  storageEncrypted: boolean;
  backupRetentionPeriod: number;
  multiAZ: boolean;
  performanceInsightsEnabled: boolean;
  monitoringInterval: number;
  allocatedStorage: number;
  storageType: string;
  iops?: number;
}

export interface RDSHealthStatus {
  healthy: boolean;
  status: string;
  latency?: number;
  error?: string;
  connectionCount?: number;
  cpuUtilization?: number;
  databaseConnections?: number;
  freeStorageSpace?: number;
}

export class RDSConnectionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'RDSConnectionError';
  }
}

export class RDSManager {
  private rds: RDS;
  private pool: Pool | null = null;
  private config: RDSConnectionConfig;
  private configManager: AWSConfigManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: RDSHealthStatus | null = null;

  constructor(config?: RDSConnectionConfig, configManager?: AWSConfigManager) {
    this.configManager = configManager || getAWSConfigManager();
    this.config = config || this.loadConfigFromAWS();
    this.rds = new RDS({ region: this.config.region });
  }

  /**
   * Load RDS configuration from AWS config manager
   */
  private loadConfigFromAWS(): RDSConnectionConfig {
    const awsConfig = this.configManager.getConfig();
    
    if (!awsConfig.rds) {
      throw new RDSConnectionError('RDS configuration not found in AWS config');
    }

    return {
      instanceIdentifier: awsConfig.rds.instanceIdentifier || '',
      host: awsConfig.rds.host || '',
      port: awsConfig.rds.port || 5432,
      database: awsConfig.rds.database || 'postgres',
      username: awsConfig.rds.username || '',
      password: awsConfig.rds.password,
      useIAM: awsConfig.rds.useIAM || false,
      ssl: awsConfig.rds.ssl !== false, // Default to true
      maxConnections: awsConfig.rds.maxConnections || 10,
      connectionTimeout: awsConfig.rds.connectionTimeout || 10000,
      retryAttempts: 3,
      retryDelay: 1000,
      region: awsConfig.region
    };
  }

  /**
   * Initialize RDS connection with IAM authentication if configured
   */
  async initialize(): Promise<void> {
    try {
      if (!this.configManager.isInitialized()) {
        await this.configManager.initialize();
      }

      // Get RDS instance information
      const instanceInfo = await this.getInstanceInfo();
      
      if (!instanceInfo) {
        throw new RDSConnectionError(`RDS instance '${this.config.instanceIdentifier}' not found`);
      }

      if (instanceInfo.status !== 'available') {
        throw new RDSConnectionError(`RDS instance '${this.config.instanceIdentifier}' is not available (status: ${instanceInfo.status})`);
      }

      // Update config with actual endpoint if not provided
      if (!this.config.host && instanceInfo.endpoint) {
        this.config.host = instanceInfo.endpoint.address;
        this.config.port = instanceInfo.endpoint.port;
      }

      // Create connection pool
      await this.createConnectionPool();

      // Start health monitoring
      this.startHealthMonitoring();

    } catch (error) {
      throw new RDSConnectionError(
        `Failed to initialize RDS connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create PostgreSQL connection pool with RDS-specific configuration
   */
  private async createConnectionPool(): Promise<void> {
    let password = this.config.password;

    // Generate IAM authentication token if configured
    if (this.config.useIAM) {
      password = await this.generateIAMToken();
    }

    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: password,
      ssl: this.config.ssl ? {
        rejectUnauthorized: false, // RDS certificates are trusted
        ca: undefined // Use system CA bundle
      } : false,
      max: this.config.maxConnections,
      connectionTimeoutMillis: this.config.connectionTimeout,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
      application_name: 'alpaca-herd-storage'
    };

    this.pool = new Pool(poolConfig);

    // Test the connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  /**
   * Generate IAM authentication token for RDS
   */
  private async generateIAMToken(): Promise<string> {
    const params = {
      hostname: this.config.host,
      port: this.config.port,
      username: this.config.username,
      region: this.config.region
    };

    return new Promise((resolve, reject) => {
      this.rds.getAuthToken(params, (err, token) => {
        if (err) {
          reject(new RDSConnectionError(`Failed to generate IAM token: ${err.message}`, err));
          return;
        }
        resolve(token);
      });
    });
  }

  /**
   * Get RDS instance information
   */
  async getInstanceInfo(): Promise<RDSInstanceInfo | null> {
    try {
      const result = await this.rds.describeDBInstances({
        DBInstanceIdentifier: this.config.instanceIdentifier
      }).promise();

      const instance = result.DBInstances?.[0];
      if (!instance) {
        return null;
      }

      return {
        identifier: instance.DBInstanceIdentifier!,
        status: instance.DBInstanceStatus!,
        engine: instance.Engine!,
        engineVersion: instance.EngineVersion!,
        instanceClass: instance.DBInstanceClass!,
        availabilityZone: instance.AvailabilityZone!,
        endpoint: instance.Endpoint ? {
          address: instance.Endpoint.Address!,
          port: instance.Endpoint.Port!
        } : undefined,
        storageEncrypted: instance.StorageEncrypted || false,
        backupRetentionPeriod: instance.BackupRetentionPeriod || 0,
        multiAZ: instance.MultiAZ || false,
        performanceInsightsEnabled: instance.PerformanceInsightsEnabled || false,
        monitoringInterval: instance.MonitoringInterval || 0,
        allocatedStorage: instance.AllocatedStorage || 0,
        storageType: instance.StorageType || 'gp2',
        iops: instance.Iops
      };
    } catch (error) {
      throw new RDSConnectionError(
        `Failed to get RDS instance info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get connection pool for database operations
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new RDSConnectionError('RDS connection not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Execute a query using the connection pool
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const pool = this.getPool();
    
    try {
      const result = await pool.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      throw new RDSConnectionError(
        `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a client from the connection pool for transactions
   */
  async getClient(): Promise<Client> {
    const pool = this.getPool();
    return pool.connect();
  }

  /**
   * Perform health check on RDS instance and connection
   */
  async performHealthCheck(): Promise<RDSHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Check RDS instance status
      const instanceInfo = await this.getInstanceInfo();
      if (!instanceInfo) {
        return {
          healthy: false,
          status: 'not-found',
          error: 'RDS instance not found'
        };
      }

      // Check database connectivity
      const pool = this.getPool();
      const client = await pool.connect();
      
      try {
        await client.query('SELECT 1');
        
        // Get connection statistics
        const statsResult = await client.query(`
          SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active_connections
          FROM pg_stat_activity 
          WHERE datname = current_database()
        `);

        const latency = Date.now() - startTime;
        
        const healthStatus: RDSHealthStatus = {
          healthy: instanceInfo.status === 'available',
          status: instanceInfo.status,
          latency,
          connectionCount: parseInt(statsResult.rows[0]?.total_connections || '0'),
          databaseConnections: parseInt(statsResult.rows[0]?.active_connections || '0')
        };

        this.lastHealthCheck = healthStatus;
        return healthStatus;
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      const healthStatus: RDSHealthStatus = {
        healthy: false,
        status: 'error',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.lastHealthCheck = healthStatus;
      return healthStatus;
    }
  }

  /**
   * Get CloudWatch metrics for RDS instance
   */
  async getCloudWatchMetrics(startTime: Date, endTime: Date): Promise<{ [metricName: string]: number }> {
    try {
      const clients = this.configManager.getClients();
      const cloudWatch = clients.cloudWatch;

      const metrics = ['CPUUtilization', 'DatabaseConnections', 'FreeStorageSpace', 'ReadLatency', 'WriteLatency'];
      const metricData: { [key: string]: number } = {};

      for (const metricName of metrics) {
        try {
          const result = await cloudWatch.getMetricStatistics({
            Namespace: 'AWS/RDS',
            MetricName: metricName,
            Dimensions: [
              {
                Name: 'DBInstanceIdentifier',
                Value: this.config.instanceIdentifier
              }
            ],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300, // 5 minutes
            Statistics: ['Average']
          }).promise();

          const datapoints = result.Datapoints || [];
          if (datapoints.length > 0) {
            // Get the most recent datapoint
            const latest = datapoints.sort((a, b) => b.Timestamp!.getTime() - a.Timestamp!.getTime())[0];
            metricData[metricName] = latest.Average || 0;
          }
        } catch (error) {
          console.warn(`Failed to get metric ${metricName}:`, error);
        }
      }

      return metricData;
    } catch (error) {
      throw new RDSConnectionError(
        `Failed to get CloudWatch metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck(): RDSHealthStatus | null {
    return this.lastHealthCheck;
  }

  /**
   * Test connection with retry logic
   */
  async testConnection(): Promise<boolean> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const pool = this.getPool();
        const client = await pool.connect();
        
        try {
          await client.query('SELECT 1');
          return true;
        } finally {
          client.release();
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.config.retryAttempts) {
          console.warn(`Connection attempt ${attempt} failed, retrying in ${this.config.retryDelay}ms...`);
          await this.delay(this.config.retryDelay);
        }
      }
    }
    
    throw new RDSConnectionError(
      `Connection failed after ${this.config.retryAttempts} attempts: ${lastError?.message}`,
      lastError
    );
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    this.stopHealthMonitoring();
    
    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
      } catch (error) {
        console.error('Error closing connection pool:', error);
      }
    }
  }

  /**
   * Update RDS configuration
   */
  updateConfig(updates: Partial<RDSConnectionConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): RDSConnectionConfig {
    return { ...this.config };
  }

  /**
   * Check if RDS manager is initialized
   */
  isInitialized(): boolean {
    return this.pool !== null;
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create RDS manager with default configuration
 */
export function createRDSManager(config?: Partial<RDSConnectionConfig>): RDSManager {
  const configManager = getAWSConfigManager();
  const awsConfig = configManager.getConfig();
  
  const rdsConfig: RDSConnectionConfig = {
    instanceIdentifier: awsConfig.rds?.instanceIdentifier || '',
    host: awsConfig.rds?.host || '',
    port: awsConfig.rds?.port || 5432,
    database: awsConfig.rds?.database || 'postgres',
    username: awsConfig.rds?.username || '',
    password: awsConfig.rds?.password,
    useIAM: awsConfig.rds?.useIAM || false,
    ssl: awsConfig.rds?.ssl !== false,
    maxConnections: awsConfig.rds?.maxConnections || 10,
    connectionTimeout: awsConfig.rds?.connectionTimeout || 10000,
    retryAttempts: 3,
    retryDelay: 1000,
    region: awsConfig.region,
    ...config
  };

  return new RDSManager(rdsConfig, configManager);
}

// Global RDS manager instance
let globalRDSManager: RDSManager | null = null;

/**
 * Get global RDS manager instance
 */
export function getRDSManager(config?: Partial<RDSConnectionConfig>): RDSManager {
  if (!globalRDSManager) {
    globalRDSManager = createRDSManager(config);
  }
  return globalRDSManager;
}

/**
 * Reset global RDS manager instance
 */
export function resetRDSManager(): void {
  if (globalRDSManager) {
    globalRDSManager.close().catch(console.error);
    globalRDSManager = null;
  }
}