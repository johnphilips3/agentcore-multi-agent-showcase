import { S3 } from 'aws-sdk';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { getAWSConfigManager, AWSConfigManager } from './config';

export interface S3BackupConfig {
  bucketName: string;
  region: string;
  backupPrefix: string;
  serverSideEncryption: 'AES256' | 'aws:kms';
  kmsKeyId?: string;
  storageClass: 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
  lifecycleRules: S3LifecycleRule[];
  maxRetries: number;
  retryDelay: number;
}

export interface S3LifecycleRule {
  id: string;
  status: 'Enabled' | 'Disabled';
  prefix?: string;
  transitions?: {
    days: number;
    storageClass: 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
  }[];
  expiration?: {
    days: number;
  };
}

export interface BackupMetadata {
  backupId: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  checksum: string;
  description?: string;
  tags?: { [key: string]: string };
}

export interface S3BackupInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  storageClass: string;
  metadata: BackupMetadata;
}

export interface S3UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export class S3BackupError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'S3BackupError';
  }
}

export class S3BackupManager {
  private s3: S3;
  private config: S3BackupConfig;
  private configManager: AWSConfigManager;

  constructor(config?: S3BackupConfig, configManager?: AWSConfigManager) {
    this.configManager = configManager || getAWSConfigManager();
    this.config = config || this.loadConfigFromAWS();
    this.s3 = new S3({ 
      region: this.config.region,
      maxRetries: this.config.maxRetries,
      retryDelayOptions: {
        base: this.config.retryDelay
      }
    });
  }

  /**
   * Load S3 configuration from AWS config manager
   */
  private loadConfigFromAWS(): S3BackupConfig {
    const awsConfig = this.configManager.getConfig();
    
    if (!awsConfig.s3) {
      throw new S3BackupError('S3 configuration not found in AWS config');
    }

    return {
      bucketName: awsConfig.s3.bucketName || '',
      region: awsConfig.s3.region || awsConfig.region,
      backupPrefix: awsConfig.s3.backupPrefix || 'alpaca-herd-backups',
      serverSideEncryption: awsConfig.s3.serverSideEncryption || 'AES256',
      kmsKeyId: awsConfig.s3.kmsKeyId,
      storageClass: awsConfig.s3.storageClass || 'STANDARD',
      lifecycleRules: awsConfig.s3.lifecycleRules || [],
      maxRetries: 3,
      retryDelay: 1000
    };
  }

  /**
   * Initialize S3 backup manager
   */
  async initialize(): Promise<void> {
    try {
      if (!this.configManager.isInitialized()) {
        await this.configManager.initialize();
      }

      // Verify bucket exists and is accessible
      await this.verifyBucket();

      // Setup lifecycle rules if configured
      if (this.config.lifecycleRules.length > 0) {
        await this.setupLifecycleRules();
      }

    } catch (error) {
      throw new S3BackupError(
        `Failed to initialize S3 backup manager: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Verify S3 bucket exists and is accessible
   */
  private async verifyBucket(): Promise<void> {
    try {
      await this.s3.headBucket({ Bucket: this.config.bucketName }).promise();
    } catch (error: any) {
      if (error.code === 'NotFound') {
        throw new S3BackupError(`S3 bucket '${this.config.bucketName}' not found`);
      } else if (error.code === 'Forbidden') {
        throw new S3BackupError(`Access denied to S3 bucket '${this.config.bucketName}'`);
      } else {
        throw new S3BackupError(`Failed to access S3 bucket: ${error.message}`, error);
      }
    }
  }

  /**
   * Setup lifecycle rules for backup retention
   */
  private async setupLifecycleRules(): Promise<void> {
    try {
      const lifecycleConfiguration = {
        Rules: this.config.lifecycleRules.map(rule => ({
          ID: rule.id,
          Status: rule.status,
          Filter: rule.prefix ? { Prefix: rule.prefix } : {},
          Transitions: rule.transitions?.map(transition => ({
            Days: transition.days,
            StorageClass: transition.storageClass
          })) || [],
          Expiration: rule.expiration ? { Days: rule.expiration.days } : undefined
        }))
      };

      await this.s3.putBucketLifecycleConfiguration({
        Bucket: this.config.bucketName,
        LifecycleConfiguration: lifecycleConfiguration
      }).promise();

    } catch (error) {
      console.warn('Failed to setup lifecycle rules:', error);
      // Don't fail initialization if lifecycle rules can't be set
    }
  }

  /**
   * Upload backup file to S3
   */
  async uploadBackup(
    filePath: string, 
    metadata: Omit<BackupMetadata, 'size' | 'checksum'>,
    onProgress?: (progress: S3UploadProgress) => void
  ): Promise<S3BackupInfo> {
    try {
      // Calculate file size and checksum
      const stats = await fs.stat(filePath);
      const checksum = await this.calculateFileChecksum(filePath);

      const fullMetadata: BackupMetadata = {
        ...metadata,
        size: stats.size,
        checksum
      };

      // Generate S3 key
      const key = this.generateBackupKey(fullMetadata);

      // Prepare upload parameters
      const uploadParams: S3.PutObjectRequest = {
        Bucket: this.config.bucketName,
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: stats.size,
        StorageClass: this.config.storageClass,
        ServerSideEncryption: this.config.serverSideEncryption,
        KMSKeyId: this.config.kmsKeyId,
        Metadata: {
          'backup-id': fullMetadata.backupId,
          'backup-type': fullMetadata.type,
          'backup-timestamp': fullMetadata.timestamp.toISOString(),
          'backup-checksum': fullMetadata.checksum,
          'backup-description': fullMetadata.description || '',
          ...Object.entries(fullMetadata.tags || {}).reduce((acc, [k, v]) => {
            acc[`tag-${k}`] = v;
            return acc;
          }, {} as { [key: string]: string })
        },
        Tagging: this.formatTags({
          BackupId: fullMetadata.backupId,
          BackupType: fullMetadata.type,
          Timestamp: fullMetadata.timestamp.toISOString(),
          ...fullMetadata.tags
        })
      };

      // Upload with progress tracking
      const upload = this.s3.upload(uploadParams);
      
      if (onProgress) {
        upload.on('httpUploadProgress', (progress) => {
          onProgress({
            loaded: progress.loaded || 0,
            total: progress.total || stats.size,
            percentage: ((progress.loaded || 0) / (progress.total || stats.size)) * 100
          });
        });
      }

      const result = await upload.promise();

      return {
        key,
        size: stats.size,
        lastModified: new Date(),
        etag: result.ETag || '',
        storageClass: this.config.storageClass,
        metadata: fullMetadata
      };

    } catch (error) {
      throw new S3BackupError(
        `Failed to upload backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Download backup file from S3
   */
  async downloadBackup(
    key: string, 
    localPath: string,
    onProgress?: (progress: S3UploadProgress) => void
  ): Promise<BackupMetadata> {
    try {
      // Ensure local directory exists
      await fs.mkdir(dirname(localPath), { recursive: true });

      // Get object metadata first
      const headResult = await this.s3.headObject({
        Bucket: this.config.bucketName,
        Key: key
      }).promise();

      const metadata = this.parseBackupMetadata(headResult.Metadata || {});
      const totalSize = headResult.ContentLength || 0;

      // Download object
      const downloadParams = {
        Bucket: this.config.bucketName,
        Key: key
      };

      const downloadStream = this.s3.getObject(downloadParams).createReadStream();
      const writeStream = createWriteStream(localPath);

      let downloadedBytes = 0;

      downloadStream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress) {
          onProgress({
            loaded: downloadedBytes,
            total: totalSize,
            percentage: (downloadedBytes / totalSize) * 100
          });
        }
      });

      await new Promise((resolve, reject) => {
        downloadStream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        downloadStream.on('error', reject);
      });

      // Verify checksum
      const downloadedChecksum = await this.calculateFileChecksum(localPath);
      if (downloadedChecksum !== metadata.checksum) {
        throw new S3BackupError('Downloaded file checksum mismatch');
      }

      return metadata;

    } catch (error) {
      throw new S3BackupError(
        `Failed to download backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List available backups
   */
  async listBackups(prefix?: string, maxKeys?: number): Promise<S3BackupInfo[]> {
    try {
      const listParams: S3.ListObjectsV2Request = {
        Bucket: this.config.bucketName,
        Prefix: prefix || this.config.backupPrefix,
        MaxKeys: maxKeys || 1000
      };

      const result = await this.s3.listObjectsV2(listParams).promise();
      const backups: S3BackupInfo[] = [];

      for (const object of result.Contents || []) {
        if (!object.Key) continue;

        try {
          // Get object metadata
          const headResult = await this.s3.headObject({
            Bucket: this.config.bucketName,
            Key: object.Key
          }).promise();

          const metadata = this.parseBackupMetadata(headResult.Metadata || {});

          backups.push({
            key: object.Key,
            size: object.Size || 0,
            lastModified: object.LastModified || new Date(),
            etag: object.ETag || '',
            storageClass: object.StorageClass || 'STANDARD',
            metadata
          });
        } catch (error) {
          console.warn(`Failed to get metadata for ${object.Key}:`, error);
        }
      }

      // Sort by timestamp (newest first)
      return backups.sort((a, b) => b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime());

    } catch (error) {
      throw new S3BackupError(
        `Failed to list backups: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete backup from S3
   */
  async deleteBackup(key: string): Promise<void> {
    try {
      await this.s3.deleteObject({
        Bucket: this.config.bucketName,
        Key: key
      }).promise();
    } catch (error) {
      throw new S3BackupError(
        `Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete multiple backups
   */
  async deleteBackups(keys: string[]): Promise<{ deleted: string[]; errors: { key: string; error: string }[] }> {
    const result = { deleted: [] as string[], errors: [] as { key: string; error: string }[] };

    if (keys.length === 0) {
      return result;
    }

    try {
      // Use batch delete for efficiency
      const deleteParams: S3.DeleteObjectsRequest = {
        Bucket: this.config.bucketName,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false
        }
      };

      const deleteResult = await this.s3.deleteObjects(deleteParams).promise();

      // Process successful deletions
      for (const deleted of deleteResult.Deleted || []) {
        if (deleted.Key) {
          result.deleted.push(deleted.Key);
        }
      }

      // Process errors
      for (const error of deleteResult.Errors || []) {
        if (error.Key) {
          result.errors.push({
            key: error.Key,
            error: error.Message || 'Unknown error'
          });
        }
      }

    } catch (error) {
      // If batch delete fails, try individual deletes
      for (const key of keys) {
        try {
          await this.deleteBackup(key);
          result.deleted.push(key);
        } catch (deleteError) {
          result.errors.push({
            key,
            error: deleteError instanceof Error ? deleteError.message : 'Unknown error'
          });
        }
      }
    }

    return result;
  }

  /**
   * Get backup storage statistics
   */
  async getStorageStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
    storageClassBreakdown: { [storageClass: string]: { count: number; size: number } };
  }> {
    try {
      const backups = await this.listBackups();
      
      const stats = {
        totalBackups: backups.length,
        totalSize: 0,
        oldestBackup: undefined as Date | undefined,
        newestBackup: undefined as Date | undefined,
        storageClassBreakdown: {} as { [storageClass: string]: { count: number; size: number } }
      };

      for (const backup of backups) {
        stats.totalSize += backup.size;

        // Track oldest and newest
        if (!stats.oldestBackup || backup.metadata.timestamp < stats.oldestBackup) {
          stats.oldestBackup = backup.metadata.timestamp;
        }
        if (!stats.newestBackup || backup.metadata.timestamp > stats.newestBackup) {
          stats.newestBackup = backup.metadata.timestamp;
        }

        // Track storage class breakdown
        const storageClass = backup.storageClass;
        if (!stats.storageClassBreakdown[storageClass]) {
          stats.storageClassBreakdown[storageClass] = { count: 0, size: 0 };
        }
        stats.storageClassBreakdown[storageClass].count++;
        stats.storageClassBreakdown[storageClass].size += backup.size;
      }

      return stats;

    } catch (error) {
      throw new S3BackupError(
        `Failed to get storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Cleanup old backups based on retention policy
   */
  async cleanupOldBackups(retentionDays: number): Promise<{ deleted: string[]; errors: { key: string; error: string }[] }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const backups = await this.listBackups();
      const oldBackups = backups.filter(backup => backup.metadata.timestamp < cutoffDate);

      if (oldBackups.length === 0) {
        return { deleted: [], errors: [] };
      }

      const keysToDelete = oldBackups.map(backup => backup.key);
      return await this.deleteBackups(keysToDelete);

    } catch (error) {
      throw new S3BackupError(
        `Failed to cleanup old backups: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate S3 key for backup
   */
  private generateBackupKey(metadata: BackupMetadata): string {
    const date = metadata.timestamp;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${this.config.backupPrefix}/${year}/${month}/${day}/${metadata.backupId}.backup`;
  }

  /**
   * Calculate file checksum
   */
  private async calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Parse backup metadata from S3 object metadata
   */
  private parseBackupMetadata(s3Metadata: { [key: string]: string }): BackupMetadata {
    const tags: { [key: string]: string } = {};
    
    // Extract tags from metadata
    for (const [key, value] of Object.entries(s3Metadata)) {
      if (key.startsWith('tag-')) {
        tags[key.substring(4)] = value;
      }
    }

    return {
      backupId: s3Metadata['backup-id'] || '',
      timestamp: new Date(s3Metadata['backup-timestamp'] || Date.now()),
      type: (s3Metadata['backup-type'] as 'full' | 'incremental') || 'full',
      size: parseInt(s3Metadata['backup-size'] || '0'),
      checksum: s3Metadata['backup-checksum'] || '',
      description: s3Metadata['backup-description'] || undefined,
      tags: Object.keys(tags).length > 0 ? tags : undefined
    };
  }

  /**
   * Format tags for S3
   */
  private formatTags(tags: { [key: string]: string }): string {
    return Object.entries(tags)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Get current configuration
   */
  getConfig(): S3BackupConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<S3BackupConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Test S3 connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.verifyBucket();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Create S3 backup manager with default configuration
 */
export function createS3BackupManager(config?: Partial<S3BackupConfig>): S3BackupManager {
  const configManager = getAWSConfigManager();
  const awsConfig = configManager.getConfig();
  
  const s3Config: S3BackupConfig = {
    bucketName: awsConfig.s3?.bucketName || '',
    region: awsConfig.s3?.region || awsConfig.region,
    backupPrefix: awsConfig.s3?.backupPrefix || 'alpaca-herd-backups',
    serverSideEncryption: awsConfig.s3?.serverSideEncryption || 'AES256',
    kmsKeyId: awsConfig.s3?.kmsKeyId,
    storageClass: awsConfig.s3?.storageClass || 'STANDARD',
    lifecycleRules: awsConfig.s3?.lifecycleRules || [],
    maxRetries: 3,
    retryDelay: 1000,
    ...config
  };

  return new S3BackupManager(s3Config, configManager);
}

// Global S3 backup manager instance
let globalS3BackupManager: S3BackupManager | null = null;

/**
 * Get global S3 backup manager instance
 */
export function getS3BackupManager(config?: Partial<S3BackupConfig>): S3BackupManager {
  if (!globalS3BackupManager) {
    globalS3BackupManager = createS3BackupManager(config);
  }
  return globalS3BackupManager;
}

/**
 * Reset global S3 backup manager instance
 */
export function resetS3BackupManager(): void {
  globalS3BackupManager = null;
}