import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { S3 } from 'aws-sdk';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { createHash } from 'crypto';
import {
  S3BackupManager,
  S3BackupError,
  createS3BackupManager,
  getS3BackupManager,
  resetS3BackupManager,
  S3BackupConfig,
  BackupMetadata,
  S3BackupInfo
} from '../s3';
import { AWSConfigManager } from '../config';

// Mock fs module
vi.mock('fs', () => ({
  createReadStream: vi.fn(),
  createWriteStream: vi.fn(),
  promises: {
    stat: vi.fn(),
    mkdir: vi.fn()
  }
}));

// Mock crypto module
vi.mock('crypto', () => ({
  createHash: vi.fn()
}));

// Mock AWS SDK
vi.mock('aws-sdk', () => ({
  S3: vi.fn()
}));

// Mock config module
vi.mock('../config', () => ({
  getAWSConfigManager: vi.fn(),
  AWSConfigManager: vi.fn()
}));

describe('S3BackupManager', () => {
  let s3Manager: S3BackupManager;
  let mockS3: any;
  let mockConfigManager: any;
  let mockConfig: S3BackupConfig;
  let mockUpload: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock S3
    mockUpload = {
      promise: vi.fn(),
      on: vi.fn()
    };
    mockS3 = {
      headBucket: vi.fn().mockReturnValue({
        promise: vi.fn()
      }),
      upload: vi.fn().mockReturnValue(mockUpload),
      getObject: vi.fn(),
      listObjectsV2: vi.fn().mockReturnValue({
        promise: vi.fn()
      }),
      headObject: vi.fn().mockReturnValue({
        promise: vi.fn()
      }),
      deleteObject: vi.fn().mockReturnValue({
        promise: vi.fn()
      }),
      deleteObjects: vi.fn().mockReturnValue({
        promise: vi.fn()
      }),
      putBucketLifecycleConfiguration: vi.fn().mockReturnValue({
        promise: vi.fn()
      })
    };
    (S3 as any).mockImplementation(() => mockS3);

    // Setup mock config manager
    mockConfigManager = {
      getConfig: vi.fn(),
      isInitialized: vi.fn().mockReturnValue(true),
      initialize: vi.fn()
    };
    (AWSConfigManager as any).mockImplementation(() => mockConfigManager);

    // Default S3 config
    mockConfig = {
      bucketName: 'test-backup-bucket',
      region: 'us-east-1',
      backupPrefix: 'test-backups',
      serverSideEncryption: 'AES256',
      storageClass: 'STANDARD',
      lifecycleRules: [],
      maxRetries: 3,
      retryDelay: 1000
    };

    mockConfigManager.getConfig.mockReturnValue({
      region: 'us-east-1',
      s3: mockConfig
    });

    resetS3BackupManager();
  });

  afterEach(() => {
    resetS3BackupManager();
  });

  describe('constructor', () => {
    it('should create instance with provided config', () => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
      
      expect(s3Manager.getConfig()).toEqual(mockConfig);
      expect(S3).toHaveBeenCalledWith({
        region: 'us-east-1',
        maxRetries: 3,
        retryDelayOptions: { base: 1000 }
      });
    });

    it('should load config from AWS config manager when not provided', () => {
      s3Manager = new S3BackupManager(undefined, mockConfigManager);
      
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
      expect(s3Manager.getConfig()).toEqual(expect.objectContaining({
        bucketName: 'test-backup-bucket',
        region: 'us-east-1'
      }));
    });

    it('should throw error when S3 config not found in AWS config', () => {
      mockConfigManager.getConfig.mockReturnValue({ region: 'us-east-1' });
      
      expect(() => new S3BackupManager(undefined, mockConfigManager)).toThrow(S3BackupError);
      expect(() => new S3BackupManager(undefined, mockConfigManager)).toThrow('S3 configuration not found');
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
    });

    it('should initialize successfully with accessible bucket', async () => {
      mockS3.headBucket.mockResolvedValue({});
      mockS3.putBucketLifecycleConfiguration.mockResolvedValue({});

      await s3Manager.initialize();

      expect(mockConfigManager.initialize).toHaveBeenCalled();
      expect(mockS3.headBucket).toHaveBeenCalledWith({ Bucket: 'test-backup-bucket' });
    });

    it('should setup lifecycle rules when configured', async () => {
      const configWithRules = {
        ...mockConfig,
        lifecycleRules: [{
          id: 'test-rule',
          status: 'Enabled' as const,
          prefix: 'test/',
          transitions: [{ days: 30, storageClass: 'GLACIER' as const }],
          expiration: { days: 365 }
        }]
      };
      s3Manager = new S3BackupManager(configWithRules, mockConfigManager);

      mockS3.headBucket.mockResolvedValue({});
      mockS3.putBucketLifecycleConfiguration.mockResolvedValue({});

      await s3Manager.initialize();

      expect(mockS3.putBucketLifecycleConfiguration).toHaveBeenCalledWith({
        Bucket: 'test-backup-bucket',
        LifecycleConfiguration: {
          Rules: [{
            ID: 'test-rule',
            Status: 'Enabled',
            Filter: { Prefix: 'test/' },
            Transitions: [{ Days: 30, StorageClass: 'GLACIER' }],
            Expiration: { Days: 365 }
          }]
        }
      });
    });

    it('should throw error when bucket not found', async () => {
      mockS3.headBucket.mockRejectedValue({ code: 'NotFound' });

      await expect(s3Manager.initialize()).rejects.toThrow(S3BackupError);
      await expect(s3Manager.initialize()).rejects.toThrow("S3 bucket 'test-backup-bucket' not found");
    });

    it('should throw error when access denied', async () => {
      mockS3.headBucket.mockRejectedValue({ code: 'Forbidden' });

      await expect(s3Manager.initialize()).rejects.toThrow(S3BackupError);
      await expect(s3Manager.initialize()).rejects.toThrow("Access denied to S3 bucket 'test-backup-bucket'");
    });

    it('should handle lifecycle rule setup failure gracefully', async () => {
      const configWithRules = {
        ...mockConfig,
        lifecycleRules: [{ id: 'test-rule', status: 'Enabled' as const }]
      };
      s3Manager = new S3BackupManager(configWithRules, mockConfigManager);

      mockS3.headBucket.mockResolvedValue({});
      mockS3.putBucketLifecycleConfiguration.mockRejectedValue(new Error('Lifecycle error'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await s3Manager.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to setup lifecycle rules:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('uploadBackup', () => {
    beforeEach(() => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
    });

    it('should upload backup successfully', async () => {
      const filePath = '/path/to/backup.sql';
      const metadata: Omit<BackupMetadata, 'size' | 'checksum'> = {
        backupId: 'backup-123',
        timestamp: new Date('2023-01-01T00:00:00Z'),
        type: 'full',
        description: 'Test backup'
      };

      // Mock file operations
      (fs.stat as any).mockResolvedValue({ size: 1024 });
      const mockHash = { update: vi.fn(), digest: vi.fn().mockReturnValue('abc123') };
      (createHash as any).mockReturnValue(mockHash);
      const mockReadStream = { on: vi.fn() };
      (createReadStream as any).mockReturnValue(mockReadStream);

      mockUpload.promise.mockResolvedValue({ ETag: 'etag123' });

      const result = await s3Manager.uploadBackup(filePath, metadata);

      expect(fs.stat).toHaveBeenCalledWith(filePath);
      expect(createReadStream).toHaveBeenCalledWith(filePath);
      expect(mockS3.upload).toHaveBeenCalledWith({
        Bucket: 'test-backup-bucket',
        Key: 'test-backups/2023/01/01/backup-123.backup',
        Body: mockReadStream,
        ContentLength: 1024,
        StorageClass: 'STANDARD',
        ServerSideEncryption: 'AES256',
        KMSKeyId: undefined,
        Metadata: expect.objectContaining({
          'backup-id': 'backup-123',
          'backup-type': 'full',
          'backup-timestamp': '2023-01-01T00:00:00.000Z',
          'backup-checksum': 'abc123',
          'backup-description': 'Test backup'
        }),
        Tagging: expect.stringContaining('BackupId=backup-123')
      });

      expect(result).toEqual({
        key: 'test-backups/2023/01/01/backup-123.backup',
        size: 1024,
        lastModified: expect.any(Date),
        etag: 'etag123',
        storageClass: 'STANDARD',
        metadata: expect.objectContaining({
          backupId: 'backup-123',
          type: 'full',
          size: 1024,
          checksum: 'abc123'
        })
      });
    });

    it('should handle upload progress tracking', async () => {
      const filePath = '/path/to/backup.sql';
      const metadata: Omit<BackupMetadata, 'size' | 'checksum'> = {
        backupId: 'backup-123',
        timestamp: new Date(),
        type: 'full'
      };
      const onProgress = vi.fn();

      (fs.stat as any).mockResolvedValue({ size: 1000 });
      const mockHash = { update: vi.fn(), digest: vi.fn().mockReturnValue('abc123') };
      (createHash as any).mockReturnValue(mockHash);
      (createReadStream as any).mockReturnValue({ on: vi.fn() });

      mockUpload.on.mockImplementation((event, callback) => {
        if (event === 'httpUploadProgress') {
          callback({ loaded: 500, total: 1000 });
        }
        return mockUpload;
      });
      mockUpload.promise.mockResolvedValue({ ETag: 'etag123' });

      await s3Manager.uploadBackup(filePath, metadata, onProgress);

      expect(onProgress).toHaveBeenCalledWith({
        loaded: 500,
        total: 1000,
        percentage: 50
      });
    });

    it('should handle upload failure', async () => {
      const filePath = '/path/to/backup.sql';
      const metadata: Omit<BackupMetadata, 'size' | 'checksum'> = {
        backupId: 'backup-123',
        timestamp: new Date(),
        type: 'full'
      };

      (fs.stat as any).mockResolvedValue({ size: 1024 });
      const mockHash = { update: vi.fn(), digest: vi.fn().mockReturnValue('abc123') };
      (createHash as any).mockReturnValue(mockHash);
      (createReadStream as any).mockReturnValue({ on: vi.fn() });

      mockUpload.promise.mockRejectedValue(new Error('Upload failed'));

      await expect(s3Manager.uploadBackup(filePath, metadata)).rejects.toThrow(S3BackupError);
      await expect(s3Manager.uploadBackup(filePath, metadata)).rejects.toThrow('Failed to upload backup');
    });
  });

  describe('downloadBackup', () => {
    beforeEach(() => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
    });

    it('should download backup successfully', async () => {
      const key = 'test-backups/2023/01/01/backup-123.backup';
      const localPath = '/local/path/backup.sql';

      mockS3.headObject.mockResolvedValue({
        ContentLength: 1024,
        Metadata: {
          'backup-id': 'backup-123',
          'backup-type': 'full',
          'backup-timestamp': '2023-01-01T00:00:00.000Z',
          'backup-checksum': 'abc123',
          'backup-size': '1024'
        }
      });

      const mockDownloadStream = {
        pipe: vi.fn(),
        on: vi.fn()
      };
      mockS3.getObject.mockReturnValue({
        createReadStream: vi.fn().mockReturnValue(mockDownloadStream)
      });

      const mockWriteStream = {
        on: vi.fn()
      };
      (createWriteStream as any).mockReturnValue(mockWriteStream);
      (fs.mkdir as any).mockResolvedValue(undefined);

      // Mock checksum calculation
      const mockHash = { update: vi.fn(), digest: vi.fn().mockReturnValue('abc123') };
      (createHash as any).mockReturnValue(mockHash);
      const mockReadStream = { on: vi.fn() };
      (createReadStream as any).mockReturnValue(mockReadStream);

      // Simulate successful download
      mockDownloadStream.pipe.mockImplementation((writeStream) => {
        setTimeout(() => writeStream.on.mock.calls.find(call => call[0] === 'finish')?.[1](), 0);
        return writeStream;
      });

      const result = await s3Manager.downloadBackup(key, localPath);

      expect(mockS3.headObject).toHaveBeenCalledWith({
        Bucket: 'test-backup-bucket',
        Key: key
      });
      expect(fs.mkdir).toHaveBeenCalledWith('/local/path', { recursive: true });
      expect(result).toEqual({
        backupId: 'backup-123',
        timestamp: new Date('2023-01-01T00:00:00.000Z'),
        type: 'full',
        size: 1024,
        checksum: 'abc123'
      });
    });

    it('should handle checksum mismatch', async () => {
      const key = 'test-backups/backup-123.backup';
      const localPath = '/local/path/backup.sql';

      mockS3.headObject.mockResolvedValue({
        ContentLength: 1024,
        Metadata: {
          'backup-id': 'backup-123',
          'backup-checksum': 'expected-checksum'
        }
      });

      const mockDownloadStream = { pipe: vi.fn(), on: vi.fn() };
      mockS3.getObject.mockReturnValue({
        createReadStream: vi.fn().mockReturnValue(mockDownloadStream)
      });

      const mockWriteStream = { on: vi.fn() };
      (createWriteStream as any).mockReturnValue(mockWriteStream);
      (fs.mkdir as any).mockResolvedValue(undefined);

      // Mock checksum calculation with different result
      const mockHash = { update: vi.fn(), digest: vi.fn().mockReturnValue('actual-checksum') };
      (createHash as any).mockReturnValue(mockHash);
      (createReadStream as any).mockReturnValue({ on: vi.fn() });

      mockDownloadStream.pipe.mockImplementation((writeStream) => {
        setTimeout(() => writeStream.on.mock.calls.find(call => call[0] === 'finish')?.[1](), 0);
        return writeStream;
      });

      await expect(s3Manager.downloadBackup(key, localPath)).rejects.toThrow(S3BackupError);
      await expect(s3Manager.downloadBackup(key, localPath)).rejects.toThrow('Downloaded file checksum mismatch');
    });

    it('should handle download failure', async () => {
      const key = 'test-backups/backup-123.backup';
      const localPath = '/local/path/backup.sql';

      mockS3.headObject.mockRejectedValue(new Error('Object not found'));

      await expect(s3Manager.downloadBackup(key, localPath)).rejects.toThrow(S3BackupError);
      await expect(s3Manager.downloadBackup(key, localPath)).rejects.toThrow('Failed to download backup');
    });
  });

  describe('listBackups', () => {
    beforeEach(() => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
    });

    it('should list backups successfully', async () => {
      const mockObjects = [
        {
          Key: 'test-backups/2023/01/01/backup-1.backup',
          Size: 1024,
          LastModified: new Date('2023-01-01'),
          ETag: 'etag1',
          StorageClass: 'STANDARD'
        },
        {
          Key: 'test-backups/2023/01/02/backup-2.backup',
          Size: 2048,
          LastModified: new Date('2023-01-02'),
          ETag: 'etag2',
          StorageClass: 'GLACIER'
        }
      ];

      mockS3.listObjectsV2.mockResolvedValue({ Contents: mockObjects });
      mockS3.headObject
        .mockResolvedValueOnce({
          Metadata: {
            'backup-id': 'backup-1',
            'backup-type': 'full',
            'backup-timestamp': '2023-01-01T00:00:00.000Z',
            'backup-checksum': 'checksum1',
            'backup-size': '1024'
          }
        })
        .mockResolvedValueOnce({
          Metadata: {
            'backup-id': 'backup-2',
            'backup-type': 'incremental',
            'backup-timestamp': '2023-01-02T00:00:00.000Z',
            'backup-checksum': 'checksum2',
            'backup-size': '2048'
          }
        });

      const result = await s3Manager.listBackups();

      expect(mockS3.listObjectsV2).toHaveBeenCalledWith({
        Bucket: 'test-backup-bucket',
        Prefix: 'test-backups',
        MaxKeys: 1000
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        key: 'test-backups/2023/01/02/backup-2.backup',
        size: 2048,
        lastModified: new Date('2023-01-02'),
        etag: 'etag2',
        storageClass: 'GLACIER',
        metadata: {
          backupId: 'backup-2',
          timestamp: new Date('2023-01-02T00:00:00.000Z'),
          type: 'incremental',
          size: 2048,
          checksum: 'checksum2'
        }
      });
    });

    it('should handle empty backup list', async () => {
      mockS3.listObjectsV2.mockResolvedValue({ Contents: [] });

      const result = await s3Manager.listBackups();

      expect(result).toHaveLength(0);
    });

    it('should handle metadata retrieval errors gracefully', async () => {
      const mockObjects = [{
        Key: 'test-backups/backup-1.backup',
        Size: 1024,
        LastModified: new Date('2023-01-01'),
        ETag: 'etag1'
      }];

      mockS3.listObjectsV2.mockResolvedValue({ Contents: mockObjects });
      mockS3.headObject.mockRejectedValue(new Error('Metadata error'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await s3Manager.listBackups();

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get metadata for test-backups/backup-1.backup:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('deleteBackup', () => {
    beforeEach(() => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
    });

    it('should delete backup successfully', async () => {
      const key = 'test-backups/backup-123.backup';
      mockS3.deleteObject.mockResolvedValue({});

      await s3Manager.deleteBackup(key);

      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'test-backup-bucket',
        Key: key
      });
    });

    it('should handle delete failure', async () => {
      const key = 'test-backups/backup-123.backup';
      mockS3.deleteObject.mockRejectedValue(new Error('Delete failed'));

      await expect(s3Manager.deleteBackup(key)).rejects.toThrow(S3BackupError);
      await expect(s3Manager.deleteBackup(key)).rejects.toThrow('Failed to delete backup');
    });
  });

  describe('deleteBackups', () => {
    beforeEach(() => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
    });

    it('should delete multiple backups successfully', async () => {
      const keys = ['backup-1.backup', 'backup-2.backup'];
      
      mockS3.deleteObjects.mockResolvedValue({
        Deleted: [{ Key: 'backup-1.backup' }, { Key: 'backup-2.backup' }],
        Errors: []
      });

      const result = await s3Manager.deleteBackups(keys);

      expect(mockS3.deleteObjects).toHaveBeenCalledWith({
        Bucket: 'test-backup-bucket',
        Delete: {
          Objects: [{ Key: 'backup-1.backup' }, { Key: 'backup-2.backup' }],
          Quiet: false
        }
      });

      expect(result.deleted).toEqual(['backup-1.backup', 'backup-2.backup']);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial deletion failures', async () => {
      const keys = ['backup-1.backup', 'backup-2.backup'];
      
      mockS3.deleteObjects.mockResolvedValue({
        Deleted: [{ Key: 'backup-1.backup' }],
        Errors: [{ Key: 'backup-2.backup', Message: 'Access denied' }]
      });

      const result = await s3Manager.deleteBackups(keys);

      expect(result.deleted).toEqual(['backup-1.backup']);
      expect(result.errors).toEqual([{
        key: 'backup-2.backup',
        error: 'Access denied'
      }]);
    });

    it('should return empty result for empty key list', async () => {
      const result = await s3Manager.deleteBackups([]);

      expect(result.deleted).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockS3.deleteObjects).not.toHaveBeenCalled();
    });

    it('should fallback to individual deletes on batch failure', async () => {
      const keys = ['backup-1.backup', 'backup-2.backup'];
      
      mockS3.deleteObjects.mockRejectedValue(new Error('Batch delete failed'));
      mockS3.deleteObject
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Individual delete failed'));

      const result = await s3Manager.deleteBackups(keys);

      expect(result.deleted).toEqual(['backup-1.backup']);
      expect(result.errors).toEqual([{
        key: 'backup-2.backup',
        error: 'Individual delete failed'
      }]);
    });
  });

  describe('getStorageStats', () => {
    beforeEach(() => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
    });

    it('should calculate storage statistics', async () => {
      const mockBackups: S3BackupInfo[] = [
        {
          key: 'backup-1',
          size: 1000,
          lastModified: new Date('2023-01-01'),
          etag: 'etag1',
          storageClass: 'STANDARD',
          metadata: {
            backupId: 'backup-1',
            timestamp: new Date('2023-01-01'),
            type: 'full',
            size: 1000,
            checksum: 'checksum1'
          }
        },
        {
          key: 'backup-2',
          size: 2000,
          lastModified: new Date('2023-01-02'),
          etag: 'etag2',
          storageClass: 'GLACIER',
          metadata: {
            backupId: 'backup-2',
            timestamp: new Date('2023-01-02'),
            type: 'incremental',
            size: 2000,
            checksum: 'checksum2'
          }
        }
      ];

      vi.spyOn(s3Manager, 'listBackups').mockResolvedValue(mockBackups);

      const result = await s3Manager.getStorageStats();

      expect(result).toEqual({
        totalBackups: 2,
        totalSize: 3000,
        oldestBackup: new Date('2023-01-01'),
        newestBackup: new Date('2023-01-02'),
        storageClassBreakdown: {
          STANDARD: { count: 1, size: 1000 },
          GLACIER: { count: 1, size: 2000 }
        }
      });
    });

    it('should handle empty backup list', async () => {
      vi.spyOn(s3Manager, 'listBackups').mockResolvedValue([]);

      const result = await s3Manager.getStorageStats();

      expect(result).toEqual({
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: undefined,
        newestBackup: undefined,
        storageClassBreakdown: {}
      });
    });
  });

  describe('cleanupOldBackups', () => {
    beforeEach(() => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
    });

    it('should cleanup old backups', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      const mockBackups: S3BackupInfo[] = [
        {
          key: 'old-backup',
          size: 1000,
          lastModified: oldDate,
          etag: 'etag1',
          storageClass: 'STANDARD',
          metadata: {
            backupId: 'old-backup',
            timestamp: oldDate,
            type: 'full',
            size: 1000,
            checksum: 'checksum1'
          }
        },
        {
          key: 'recent-backup',
          size: 2000,
          lastModified: recentDate,
          etag: 'etag2',
          storageClass: 'STANDARD',
          metadata: {
            backupId: 'recent-backup',
            timestamp: recentDate,
            type: 'full',
            size: 2000,
            checksum: 'checksum2'
          }
        }
      ];

      vi.spyOn(s3Manager, 'listBackups').mockResolvedValue(mockBackups);
      vi.spyOn(s3Manager, 'deleteBackups').mockResolvedValue({
        deleted: ['old-backup'],
        errors: []
      });

      const result = await s3Manager.cleanupOldBackups(7); // 7 days retention

      expect(result.deleted).toEqual(['old-backup']);
      expect(result.errors).toHaveLength(0);
    });

    it('should return empty result when no old backups found', async () => {
      vi.spyOn(s3Manager, 'listBackups').mockResolvedValue([]);

      const result = await s3Manager.cleanupOldBackups(7);

      expect(result.deleted).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
    });

    it('should return true on successful connection test', async () => {
      mockS3.headBucket.mockResolvedValue({});

      const result = await s3Manager.testConnection();

      expect(result).toBe(true);
      expect(mockS3.headBucket).toHaveBeenCalledWith({ Bucket: 'test-backup-bucket' });
    });

    it('should return false on connection failure', async () => {
      mockS3.headBucket.mockRejectedValue(new Error('Connection failed'));

      const result = await s3Manager.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('updateConfig', () => {
    beforeEach(() => {
      s3Manager = new S3BackupManager(mockConfig, mockConfigManager);
    });

    it('should update configuration', () => {
      const updates = { bucketName: 'new-bucket', region: 'us-west-2' };
      
      s3Manager.updateConfig(updates);
      const updatedConfig = s3Manager.getConfig();

      expect(updatedConfig.bucketName).toBe('new-bucket');
      expect(updatedConfig.region).toBe('us-west-2');
      expect(updatedConfig.backupPrefix).toBe('test-backups'); // Original value preserved
    });
  });
});

describe('Global S3 Backup Manager', () => {
  beforeEach(() => {
    resetS3BackupManager();
  });

  afterEach(() => {
    resetS3BackupManager();
  });

  describe('createS3BackupManager', () => {
    it('should create S3 backup manager with default configuration', () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          region: 'us-east-1',
          s3: {
            bucketName: 'test-bucket',
            backupPrefix: 'backups',
            region: 'us-east-1'
          }
        })
      };
      (AWSConfigManager as any).mockImplementation(() => mockConfigManager);

      const manager = createS3BackupManager();

      expect(manager).toBeInstanceOf(S3BackupManager);
      expect(manager.getConfig()).toEqual(expect.objectContaining({
        bucketName: 'test-bucket',
        backupPrefix: 'backups'
      }));
    });

    it('should create S3 backup manager with custom configuration', () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          region: 'us-east-1',
          s3: { bucketName: 'default-bucket' }
        })
      };
      (AWSConfigManager as any).mockImplementation(() => mockConfigManager);

      const customConfig = { bucketName: 'custom-bucket', maxRetries: 5 };
      const manager = createS3BackupManager(customConfig);

      expect(manager.getConfig().bucketName).toBe('custom-bucket');
      expect(manager.getConfig().maxRetries).toBe(5);
    });
  });

  describe('getS3BackupManager', () => {
    it('should return singleton instance', () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          region: 'us-east-1',
          s3: { bucketName: 'test-bucket' }
        })
      };
      (AWSConfigManager as any).mockImplementation(() => mockConfigManager);

      const manager1 = getS3BackupManager();
      const manager2 = getS3BackupManager();

      expect(manager1).toBe(manager2);
    });
  });

  describe('resetS3BackupManager', () => {
    it('should reset global instance', () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          region: 'us-east-1',
          s3: { bucketName: 'test-bucket' }
        })
      };
      (AWSConfigManager as any).mockImplementation(() => mockConfigManager);

      const manager1 = getS3BackupManager();
      resetS3BackupManager();
      const manager2 = getS3BackupManager();

      expect(manager1).not.toBe(manager2);
    });
  });
});

describe('S3BackupError', () => {
  it('should create error with message', () => {
    const error = new S3BackupError('Test error');

    expect(error.name).toBe('S3BackupError');
    expect(error.message).toBe('Test error');
    expect(error.cause).toBeUndefined();
  });

  it('should create error with cause', () => {
    const cause = new Error('Original error');
    const error = new S3BackupError('Test error', cause);

    expect(error.name).toBe('S3BackupError');
    expect(error.message).toBe('Test error');
    expect(error.cause).toBe(cause);
  });
});