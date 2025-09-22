import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { S3BackupManager, createS3BackupManager, getS3BackupManager, resetS3BackupManager, S3BackupError } from '../s3';
import { AWSConfigManager } from '../config';
import { promises as fs } from 'fs';

// Mock AWS SDK and fs
vi.mock('aws-sdk', () => ({
  S3: vi.fn(() => ({
    headBucket: vi.fn(() => ({
      promise: vi.fn().mockResolvedValue({})
    })),
    putBucketLifecycleConfiguration: vi.fn(() => ({
      promise: vi.fn().mockResolvedValue({})
    })),
    upload: vi.fn(() => ({
      promise: vi.fn().mockResolvedValue({
        ETag: '"mock-etag"',
        Location: 'https://bucket.s3.amazonaws.com/key'
      }),
      on: vi.fn()
    })),
    getObject: vi.fn(() => ({
      createReadStream: vi.fn(() => ({
        pipe: vi.fn(),
        on: vi.fn()
      }))
    })),
    headObject: vi.fn(() => ({
      promise: vi.fn().mockResolvedValue({
        ContentLength: 1024,
        Metadata: {
          'backup-id': 'test-backup-123',
          'backup-type': 'full',
          'backup-timestamp': '2023-01-01T00:00:00.000Z',
          'backup-checksum': 'mock-checksum',
          'backup-description': 'Test backup'
        }
      })
    })),
    listObjectsV2: vi.fn(() => ({
      promise: vi.fn().mockResolvedValue({
        Contents: [
          {
            Key: 'alpaca-herd-backups/2023/01/01/test-backup-123.backup',
            Size: 1024,
            LastModified: new Date('2023-01-01T00:00:00.000Z'),
            ETag: '"mock-etag"',
            StorageClass: 'STANDARD'
          }
        ]
      })
    })),
    deleteObject: vi.fn(() => ({
      promise: vi.fn().mockResolvedValue({})
    })),
    deleteObjects: vi.fn(() => ({
      promise: vi.fn().mockResolvedValue({
        Deleted: [{ Key: 'test-key' }],
        Errors: []
      })
    }))
  }))
}));

vi.mock('fs', () => ({
  createReadStream: vi.fn(() => ({
    on: vi.fn(),
    pipe: vi.fn()
  })),
  createWriteStream: vi.fn(() => ({
    on: vi.fn()
  })),
  promises: {
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
    mkdir: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(),
    digest: vi.fn().mockReturnValue('mock-checksum')
  }))
}));

describe('S3BackupManager', () => {
  let mockConfigManager: AWSConfigManager;
  let s3BackupManager: S3BackupManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetS3BackupManager();

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        region: 'us-east-1',
        s3: {
          bucketName: 'test-backup-bucket',
          region: 'us-east-1',
          backupPrefix: 'alpaca-herd-backups',
          serverSideEncryption: 'AES256',
          storageClass: 'STANDARD',
          lifecycleRules: [
            {
              id: 'backup-lifecycle',
              status: 'Enabled',
              prefix: 'alpaca-herd-backups/',
              transitions: [
                { days: 30, storageClass: 'STANDARD_IA' },
                { days: 90, storageClass: 'GLACIER' }
              ],
              expiration: { days: 365 }
            }
          ]
        }
      }),
      isInitialized: vi.fn().mockReturnValue(true),
      initialize: vi.fn().mockResolvedValue(undefined)
    } as any;

    s3BackupManager = new S3BackupManager(undefined, mockConfigManager);
  });

  afterEach(() => {
    resetS3BackupManager();
  });

  describe('constructor', () => {
    it('should create S3 backup manager with provided config', () => {
      const config = {
        bucketName: 'custom-bucket',
        region: 'us-west-2',
        backupPrefix: 'custom-backups',
        serverSideEncryption: 'aws:kms' as const,
        kmsKeyId: 'custom-key-id',
        storageClass: 'STANDARD_IA' as const,
        lifecycleRules: [],
        maxRetries: 5,
        retryDelay: 2000
      };

      const manager = new S3BackupManager(config, mockConfigManager);
      expect(manager.getConfig()).toEqual(config);
    });

    it('should load config from AWS config manager when no config provided', () => {
      const manager = new S3BackupManager(undefined, mockConfigManager);
      const config = manager.getConfig();

      expect(config.bucketName).toBe('test-backup-bucket');
      expect(config.region).toBe('us-east-1');
      expect(config.backupPrefix).toBe('alpaca-herd-backups');
    });

    it('should throw error when S3 config not found in AWS config', () => {
      const mockConfigManagerNoS3 = {
        getConfig: vi.fn().mockReturnValue({
          region: 'us-east-1'
          // No s3 config
        })
      } as any;

      expect(() => new S3BackupManager(undefined, mockConfigManagerNoS3)).toThrow('S3 configuration not found in AWS config');
    });
  });

  describe('initialize', () => {
    it('should initialize S3 backup manager successfully', async () => {
      // Mock isInitialized to return false so initialize gets called
      vi.mocked(mockConfigManager.isInitialized).mockReturnValue(false);
      
      await s3BackupManager.initialize();

      expect(mockConfigManager.initialize).toHaveBeenCalled();
    });

    it('should throw error when bucket not found', async () => {
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.headBucket = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue({ code: 'NotFound' })
      }));

      await expect(s3BackupManager.initialize()).rejects.toThrow("S3 bucket 'test-backup-bucket' not found");
    });

    it('should throw error when access denied', async () => {
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.headBucket = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue({ code: 'Forbidden' })
      }));

      await expect(s3BackupManager.initialize()).rejects.toThrow("Access denied to S3 bucket 'test-backup-bucket'");
    });

    it('should setup lifecycle rules when configured', async () => {
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      
      await s3BackupManager.initialize();

      expect(mockS3.putBucketLifecycleConfiguration).toHaveBeenCalledWith({
        Bucket: 'test-backup-bucket',
        LifecycleConfiguration: {
          Rules: [
            {
              ID: 'backup-lifecycle',
              Status: 'Enabled',
              Filter: { Prefix: 'alpaca-herd-backups/' },
              Transitions: [
                { Days: 30, StorageClass: 'STANDARD_IA' },
                { Days: 90, StorageClass: 'GLACIER' }
              ],
              Expiration: { Days: 365 }
            }
          ]
        }
      });
    });
  });

  describe('uploadBackup', () => {
    it('should upload backup successfully', async () => {
      const timestamp = new Date('2023-01-01T00:00:00.000Z');
      const metadata = {
        backupId: 'test-backup-123',
        timestamp,
        type: 'full' as const,
        description: 'Test backup'
      };

      // Mock the upload method to avoid complex stream handling
      vi.spyOn(s3BackupManager as any, 'calculateFileChecksum').mockResolvedValue('mock-checksum');

      const result = await s3BackupManager.uploadBackup('/path/to/backup.sql', metadata);

      // The key should be based on the timestamp
      expect(result.key).toContain('test-backup-123.backup');
      expect(result.size).toBe(1024);
      expect(result.etag).toBe('"mock-etag"');
      expect(result.metadata.backupId).toBe('test-backup-123');
    });

    it('should handle upload errors', async () => {
      // Mock fs.stat to throw an error
      const { promises: fs } = await import('fs');
      vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

      const metadata = {
        backupId: 'test-backup-123',
        timestamp: new Date(),
        type: 'full' as const
      };

      await expect(s3BackupManager.uploadBackup('/path/to/backup.sql', metadata))
        .rejects.toThrow('Failed to upload backup');
    });

    it('should track upload progress', async () => {
      // Reset fs.stat mock to return success
      const { promises: fs } = await import('fs');
      vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      const mockUpload = {
        promise: vi.fn().mockResolvedValue({ ETag: '"mock-etag"' }),
        on: vi.fn()
      };
      mockS3.upload = vi.fn(() => mockUpload);

      // Mock checksum calculation
      vi.spyOn(s3BackupManager as any, 'calculateFileChecksum').mockResolvedValue('mock-checksum');

      const metadata = {
        backupId: 'test-backup-123',
        timestamp: new Date(),
        type: 'full' as const
      };

      const mockProgress = vi.fn();
      await s3BackupManager.uploadBackup('/path/to/backup.sql', metadata, mockProgress);

      expect(mockUpload.on).toHaveBeenCalledWith('httpUploadProgress', expect.any(Function));
    });
  });

  describe('downloadBackup', () => {
    it('should download backup successfully', async () => {
      // Mock the checksum calculation to match
      vi.spyOn(s3BackupManager as any, 'calculateFileChecksum').mockResolvedValue('mock-checksum');

      // Mock stream handling by directly calling the callback
      const mockStream = {
        pipe: vi.fn((writeStream) => {
          // Simulate successful pipe
          setTimeout(() => writeStream.emit('finish'), 0);
          return writeStream;
        }),
        on: vi.fn()
      };
      
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.getObject = vi.fn(() => ({
        createReadStream: vi.fn(() => mockStream)
      }));

      const mockWriteStream = {
        on: vi.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 0);
          }
        }),
        emit: vi.fn()
      };

      const { createWriteStream } = await import('fs');
      vi.mocked(createWriteStream).mockReturnValue(mockWriteStream as any);

      const result = await s3BackupManager.downloadBackup(
        'alpaca-herd-backups/2023/01/01/test-backup-123.backup',
        '/path/to/download.sql'
      );

      expect(result.backupId).toBe('test-backup-123');
      expect(result.checksum).toBe('mock-checksum');
    });

    it('should handle download errors', async () => {
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.headObject = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('Object not found'))
      }));

      await expect(s3BackupManager.downloadBackup('invalid-key', '/path/to/download.sql'))
        .rejects.toThrow('Failed to download backup: Object not found');
    });

    it('should verify checksum after download', async () => {
      // Mock different checksum to trigger mismatch
      vi.spyOn(s3BackupManager as any, 'calculateFileChecksum').mockResolvedValue('different-checksum');

      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.headObject = vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({
          ContentLength: 1024,
          Metadata: {
            'backup-id': 'test-backup-123',
            'backup-type': 'full',
            'backup-timestamp': '2023-01-01T00:00:00.000Z',
            'backup-checksum': 'expected-checksum'
          }
        })
      }));

      const mockStream = {
        pipe: vi.fn((writeStream) => {
          setTimeout(() => writeStream.emit('finish'), 0);
          return writeStream;
        }),
        on: vi.fn()
      };
      
      mockS3.getObject = vi.fn(() => ({
        createReadStream: vi.fn(() => mockStream)
      }));

      const mockWriteStream = {
        on: vi.fn((event, callback) => {
          if (event === 'finish') setTimeout(callback, 0);
        }),
        emit: vi.fn()
      };

      const { createWriteStream } = await import('fs');
      vi.mocked(createWriteStream).mockReturnValue(mockWriteStream as any);

      await expect(s3BackupManager.downloadBackup('test-key', '/path/to/download.sql'))
        .rejects.toThrow('Downloaded file checksum mismatch');
    });
  });

  describe('listBackups', () => {
    it('should list backups successfully', async () => {
      const backups = await s3BackupManager.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0]).toEqual({
        key: 'alpaca-herd-backups/2023/01/01/test-backup-123.backup',
        size: 1024,
        lastModified: new Date('2023-01-01T00:00:00.000Z'),
        etag: '"mock-etag"',
        storageClass: 'STANDARD',
        metadata: {
          backupId: 'test-backup-123',
          timestamp: new Date('2023-01-01T00:00:00.000Z'),
          type: 'full',
          size: 0,
          checksum: 'mock-checksum',
          description: 'Test backup'
        }
      });
    });

    it('should handle list errors', async () => {
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.listObjectsV2 = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('List failed'))
      }));

      await expect(s3BackupManager.listBackups()).rejects.toThrow('Failed to list backups: List failed');
    });

    it('should sort backups by timestamp', async () => {
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.listObjectsV2 = vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({
          Contents: [
            { Key: 'backup1', Size: 100, LastModified: new Date('2023-01-01') },
            { Key: 'backup2', Size: 200, LastModified: new Date('2023-01-02') }
          ]
        })
      }));

      // Mock headObject to return different timestamps with promise chain
      mockS3.headObject = vi.fn()
        .mockReturnValueOnce({
          promise: vi.fn().mockResolvedValue({
            ContentLength: 100,
            Metadata: {
              'backup-id': 'backup1',
              'backup-type': 'full',
              'backup-timestamp': '2023-01-01T00:00:00.000Z',
              'backup-checksum': 'checksum1'
            }
          })
        })
        .mockReturnValueOnce({
          promise: vi.fn().mockResolvedValue({
            ContentLength: 200,
            Metadata: {
              'backup-id': 'backup2',
              'backup-type': 'full',
              'backup-timestamp': '2023-01-02T00:00:00.000Z',
              'backup-checksum': 'checksum2'
            }
          })
        });

      const backups = await s3BackupManager.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0].metadata.backupId).toBe('backup2'); // Newer first
      expect(backups[1].metadata.backupId).toBe('backup1');
    });
  });

  describe('deleteBackup', () => {
    it('should delete single backup successfully', async () => {
      await s3BackupManager.deleteBackup('test-key');

      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'test-backup-bucket',
        Key: 'test-key'
      });
    });

    it('should handle delete errors', async () => {
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.deleteObject = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('Delete failed'))
      }));

      await expect(s3BackupManager.deleteBackup('test-key'))
        .rejects.toThrow('Failed to delete backup: Delete failed');
    });
  });

  describe('deleteBackups', () => {
    it('should delete multiple backups successfully', async () => {
      const result = await s3BackupManager.deleteBackups(['key1', 'key2']);

      expect(result.deleted).toEqual(['test-key']);
      expect(result.errors).toEqual([]);
    });

    it('should handle batch delete errors', async () => {
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.deleteObjects = vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({
          Deleted: [{ Key: 'key1' }],
          Errors: [{ Key: 'key2', Message: 'Access denied' }]
        })
      }));

      const result = await s3BackupManager.deleteBackups(['key1', 'key2']);

      expect(result.deleted).toEqual(['key1']);
      expect(result.errors).toEqual([{ key: 'key2', error: 'Access denied' }]);
    });

    it('should fallback to individual deletes on batch failure', async () => {
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.deleteObjects = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('Batch delete failed'))
      }));
      mockS3.deleteObject = vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({})
      }));

      const result = await s3BackupManager.deleteBackups(['key1', 'key2']);

      expect(result.deleted).toEqual(['key1', 'key2']);
      expect(mockS3.deleteObject).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStorageStats', () => {
    it('should calculate storage statistics', async () => {
      const stats = await s3BackupManager.getStorageStats();

      expect(stats).toEqual({
        totalBackups: 1,
        totalSize: 1024,
        oldestBackup: new Date('2023-01-01T00:00:00.000Z'),
        newestBackup: new Date('2023-01-01T00:00:00.000Z'),
        storageClassBreakdown: {
          STANDARD: { count: 1, size: 1024 }
        }
      });
    });
  });

  describe('cleanupOldBackups', () => {
    it('should cleanup old backups based on retention policy', async () => {
      // Mock old backup
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.headObject = vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({
          ContentLength: 1024,
          Metadata: {
            'backup-id': 'old-backup',
            'backup-type': 'full',
            'backup-timestamp': '2022-01-01T00:00:00.000Z', // Old backup
            'backup-checksum': 'checksum'
          }
        })
      }));

      const result = await s3BackupManager.cleanupOldBackups(30); // 30 days retention

      expect(result.deleted).toEqual(['test-key']);
    });

    it('should not delete recent backups', async () => {
      // Mock recent backup
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.headObject = vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({
          ContentLength: 1024,
          Metadata: {
            'backup-id': 'recent-backup',
            'backup-type': 'full',
            'backup-timestamp': new Date().toISOString(), // Recent backup
            'backup-checksum': 'checksum'
          }
        })
      }));

      const result = await s3BackupManager.cleanupOldBackups(30);

      expect(result.deleted).toEqual([]);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const updates = {
        storageClass: 'GLACIER' as const,
        maxRetries: 5
      };

      s3BackupManager.updateConfig(updates);
      const config = s3BackupManager.getConfig();

      expect(config.storageClass).toBe('GLACIER');
      expect(config.maxRetries).toBe(5);
    });

    it('should return current configuration', () => {
      const config = s3BackupManager.getConfig();

      expect(config).toHaveProperty('bucketName');
      expect(config).toHaveProperty('region');
      expect(config).toHaveProperty('backupPrefix');
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      const result = await s3BackupManager.testConnection();
      expect(result).toBe(true);
    });

    it('should return false for failed connection', async () => {
      const mockS3 = vi.mocked(s3BackupManager as any).s3;
      mockS3.headBucket = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('Connection failed'))
      }));

      const result = await s3BackupManager.testConnection();
      expect(result).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    resetS3BackupManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetS3BackupManager();
  });

  describe('createS3BackupManager', () => {
    it('should create S3 backup manager with custom config', () => {
      const config = {
        bucketName: 'custom-bucket',
        storageClass: 'GLACIER' as const
      };

      const manager = createS3BackupManager(config);
      const managerConfig = manager.getConfig();

      expect(managerConfig.bucketName).toBe('custom-bucket');
      expect(managerConfig.storageClass).toBe('GLACIER');
    });

    it('should create S3 backup manager with default config', () => {
      const manager = createS3BackupManager();
      expect(manager).toBeInstanceOf(S3BackupManager);
    });
  });

  describe('getS3BackupManager', () => {
    it('should return same instance for global manager', () => {
      const manager1 = getS3BackupManager();
      const manager2 = getS3BackupManager();

      expect(manager1).toBe(manager2);
    });

    it('should create new instance after reset', () => {
      const manager1 = getS3BackupManager();
      resetS3BackupManager();
      const manager2 = getS3BackupManager();

      expect(manager1).not.toBe(manager2);
    });
  });
});