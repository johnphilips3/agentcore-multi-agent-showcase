import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackupService, BackupConfig, BackupError, createBackupConfig } from '../backup-service';

// Mock AWS SDK
const mockS3GetObject = vi.fn().mockReturnValue({
  promise: vi.fn().mockResolvedValue({ Body: Buffer.from('test content') })
});

vi.mock('aws-sdk', () => ({
  S3: vi.fn().mockImplementation(() => ({
    upload: vi.fn().mockReturnValue({
      promise: vi.fn().mockResolvedValue({ Location: 'https://s3.amazonaws.com/test-bucket/test-key' })
    }),
    putBucketLifecycleConfiguration: vi.fn().mockReturnValue({
      promise: vi.fn().mockResolvedValue({})
    }),
    getObject: mockS3GetObject
  })),
  RDS: vi.fn().mockImplementation(() => ({
    createDBSnapshot: vi.fn().mockReturnValue({
      promise: vi.fn().mockResolvedValue({
        DBSnapshot: {
          DBSnapshotIdentifier: 'test-snapshot',
          Status: 'creating'
        }
      })
    }),
    restoreDBInstanceToPointInTime: vi.fn().mockReturnValue({
      promise: vi.fn().mockResolvedValue({
        DBInstance: {
          DBInstanceArn: 'arn:aws:rds:us-east-1:123456789012:db:recovered-instance',
          Endpoint: {
            Address: 'recovered-instance.cluster-xyz.us-east-1.rds.amazonaws.com'
          }
        }
      })
    })
  }))
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined)
}));

// Mock connection manager
vi.mock('../../database/connection', () => ({
  getConnectionManager: vi.fn().mockReturnValue({
    getConnection: vi.fn().mockResolvedValue({
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true)
    })
  })
}));

describe('BackupService', () => {
  let backupService: BackupService;
  let mockConfig: BackupConfig;

  beforeEach(() => {
    mockConfig = {
      s3BucketName: 'test-backup-bucket',
      s3Region: 'us-east-1',
      s3KeyPrefix: 'test-backups/',
      backupRetentionDays: 30,
      incrementalBackupIntervalHours: 4,
      fullBackupIntervalHours: 24,
      enableCompression: true,
      enableEncryption: false
    };

    backupService = new BackupService(mockConfig);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (backupService) {
      backupService.stopScheduledBackups();
    }
  });

  describe('createFullBackup', () => {
    it('should create a full backup successfully', async () => {
      // Mock database query responses
      const mockAlpacas = [
        { id: '1', name: 'Test Alpaca', created_at: '2024-01-01T00:00:00Z' }
      ];
      const mockHealthRecords = [
        { id: '1', alpaca_id: '1', record_type: 'vaccination', created_at: '2024-01-01T00:00:00Z' }
      ];

      const { getConnectionManager } = await import('../../database/connection');
      const mockConnectionManager = getConnectionManager();
      const mockConnection = await mockConnectionManager.getConnection();
      
      (mockConnection.query as any)
        .mockResolvedValueOnce(mockAlpacas) // alpacas table
        .mockResolvedValueOnce(mockHealthRecords) // health_records table
        .mockResolvedValueOnce([]) // breeding_records table
        .mockResolvedValueOnce([]) // breeding_offspring table
        .mockResolvedValueOnce([]) // management_activities table
        .mockResolvedValueOnce([]); // activity_alpacas table

      const metadata = await backupService.createFullBackup();

      expect(metadata).toMatchObject({
        type: 'full',
        compressed: true,
        encrypted: false,
        tables: ['alpacas', 'health_records', 'breeding_records', 'breeding_offspring', 'management_activities', 'activity_alpacas'],
        recordCounts: {
          alpacas: 1,
          health_records: 1,
          breeding_records: 0,
          breeding_offspring: 0,
          management_activities: 0,
          activity_alpacas: 0
        }
      });

      expect(metadata.id).toMatch(/^full-/);
      expect(metadata.timestamp).toBeInstanceOf(Date);
      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.checksum).toBeTruthy();
      expect(metadata.s3Key).toMatch(/^test-backups\/full\//);
    });

    it('should handle database query errors gracefully', async () => {
      const { getConnectionManager } = await import('../../database/connection');
      const mockConnectionManager = getConnectionManager();
      const mockConnection = await mockConnectionManager.getConnection();
      
      (mockConnection.query as any)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce([]) // health_records table
        .mockResolvedValueOnce([]) // breeding_records table
        .mockResolvedValueOnce([]) // breeding_offspring table
        .mockResolvedValueOnce([]) // management_activities table
        .mockResolvedValueOnce([]); // activity_alpacas table

      const metadata = await backupService.createFullBackup();

      expect(metadata.recordCounts.alpacas).toBe(0);
      expect(metadata.tables).toContain('alpacas');
    });
  });

  describe('createIncrementalBackup', () => {
    it('should create an incremental backup successfully', async () => {
      const lastBackupTimestamp = new Date('2024-01-01T00:00:00Z');
      
      // Mock database query responses for incremental data
      const mockAlpacas = [
        { id: '2', name: 'New Alpaca', created_at: '2024-01-02T00:00:00Z' }
      ];

      const { getConnectionManager } = await import('../../database/connection');
      const mockConnectionManager = getConnectionManager();
      const mockConnection = await mockConnectionManager.getConnection();
      
      (mockConnection.query as any)
        .mockResolvedValueOnce(mockAlpacas) // alpacas table
        .mockResolvedValueOnce([]) // health_records table
        .mockResolvedValueOnce([]) // breeding_records table
        .mockResolvedValueOnce([]); // management_activities table

      const metadata = await backupService.createIncrementalBackup(lastBackupTimestamp);

      expect(metadata).toMatchObject({
        type: 'incremental',
        compressed: true,
        encrypted: false,
        tables: ['alpacas', 'health_records', 'breeding_records', 'management_activities'],
        recordCounts: {
          alpacas: 1,
          health_records: 0,
          breeding_records: 0,
          management_activities: 0
        }
      });

      expect(metadata.id).toMatch(/^incremental-/);
      expect(metadata.s3Key).toMatch(/^test-backups\/incremental\//);
    });
  });

  describe('createRDSSnapshot', () => {
    it('should create RDS snapshot successfully', async () => {
      const configWithRDS = {
        ...mockConfig,
        rdsInstanceIdentifier: 'test-rds-instance',
        rdsSnapshotPrefix: 'test-snapshot'
      };

      const backupServiceWithRDS = new BackupService(configWithRDS);
      const metadata = await backupServiceWithRDS.createRDSSnapshot();

      expect(metadata).toMatchObject({
        type: 'rds-snapshot',
        size: 0,
        checksum: '',
        compressed: false,
        encrypted: false,
        tables: [],
        recordCounts: {}
      });

      expect(metadata.id).toMatch(/^rds-snapshot-/);
      expect(metadata.rdsSnapshotId).toMatch(/^test-snapshot-/);
    });

    it('should throw error when RDS instance identifier not configured', async () => {
      await expect(backupService.createRDSSnapshot()).rejects.toThrow(
        new BackupError('RDS instance identifier not configured')
      );
    });
  });

  describe('scheduleBackups', () => {
    it('should schedule full and incremental backups', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      await backupService.scheduleBackups();

      expect(setIntervalSpy).toHaveBeenCalledTimes(2);
      
      setIntervalSpy.mockRestore();
    });

    it('should stop scheduled backups', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      await backupService.scheduleBackups();
      backupService.stopScheduledBackups();

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
      
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('configureS3LifecycleRules', () => {
    it('should configure S3 lifecycle rules successfully', async () => {
      await backupService.configureS3LifecycleRules();

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('backup with encryption', () => {
    it('should create encrypted backup when encryption is enabled', async () => {
      const encryptedConfig = {
        ...mockConfig,
        enableEncryption: true,
        encryptionKey: 'test-encryption-key'
      };

      const encryptedBackupService = new BackupService(encryptedConfig);
      
      // Mock database queries
      const { getConnectionManager } = await import('../../database/connection');
      const mockConnectionManager = getConnectionManager();
      const mockConnection = await mockConnectionManager.getConnection();
      (mockConnection.query as any).mockResolvedValue([]);

      const metadata = await encryptedBackupService.createFullBackup();

      expect(metadata.encrypted).toBe(true);
    });
  });

  describe('backup with local storage', () => {
    it('should save backup locally when local path is configured', async () => {
      const localConfig = {
        ...mockConfig,
        localBackupPath: '/tmp/backups'
      };

      const localBackupService = new BackupService(localConfig);
      
      // Mock database queries
      const { getConnectionManager } = await import('../../database/connection');
      const mockConnectionManager = getConnectionManager();
      const mockConnection = await mockConnectionManager.getConnection();
      (mockConnection.query as any).mockResolvedValue([]);

      const metadata = await localBackupService.createFullBackup();

      expect(metadata.localPath).toMatch(/^\/tmp\/backups\//);
      
      const fs = await import('fs/promises');
      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/backups', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('verifyBackup', () => {
    it('should verify a valid backup successfully', async () => {
      // Create a simple metadata object for testing
      const validBackupContent = JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'full',
        tables: {
          alpacas: [],
          health_records: [],
          breeding_records: [],
          breeding_offspring: [],
          management_activities: [],
          activity_alpacas: []
        },
        recordCounts: {
          alpacas: 0,
          health_records: 0,
          breeding_records: 0,
          breeding_offspring: 0,
          management_activities: 0,
          activity_alpacas: 0
        }
      });

      // Calculate the correct checksum for the content
      const crypto = await import('crypto');
      const correctChecksum = crypto.createHash('sha256').update(validBackupContent).digest('hex');

      const metadata = {
        id: 'test-backup',
        type: 'full' as const,
        timestamp: new Date(),
        size: validBackupContent.length,
        checksum: correctChecksum,
        s3Key: 'test-key',
        compressed: false,
        encrypted: false,
        tables: ['alpacas', 'health_records', 'breeding_records', 'breeding_offspring', 'management_activities', 'activity_alpacas'],
        recordCounts: {
          alpacas: 0,
          health_records: 0,
          breeding_records: 0,
          breeding_offspring: 0,
          management_activities: 0,
          activity_alpacas: 0
        }
      };

      // Mock S3 getObject to return the backup content
      mockS3GetObject.mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          Body: Buffer.from(validBackupContent)
        })
      });

      const verificationResult = await backupService.verifyBackup(metadata);

      expect(verificationResult.isValid).toBe(true);
      expect(verificationResult.checksumValid).toBe(true);
      expect(verificationResult.contentValid).toBe(true);
      expect(verificationResult.restorable).toBe(true);
      expect(verificationResult.errors).toHaveLength(0);
    });

    it('should detect checksum mismatch', async () => {
      const backupContent = '{"timestamp":"2024-01-01","tables":{"alpacas":[]}}';
      
      const metadata = {
        id: 'test-backup',
        type: 'full' as const,
        timestamp: new Date(),
        size: 100,
        checksum: 'invalid-checksum',
        s3Key: 'test-key',
        compressed: false,
        encrypted: false,
        tables: ['alpacas'],
        recordCounts: { alpacas: 0 }
      };

      // Mock S3 getObject to return content
      mockS3GetObject.mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          Body: Buffer.from(backupContent)
        })
      });

      const verificationResult = await backupService.verifyBackup(metadata);

      expect(verificationResult.isValid).toBe(false);
      expect(verificationResult.checksumValid).toBe(false);
      expect(verificationResult.errors.some(error => error.includes('Checksum mismatch'))).toBe(true);
    });
  });

  describe('detectCorruption', () => {
    it('should detect missing backup file', async () => {
      const metadata = {
        id: 'missing-backup',
        type: 'full' as const,
        timestamp: new Date(),
        size: 100,
        checksum: 'test-checksum',
        s3Key: 'missing-key',
        compressed: false,
        encrypted: false,
        tables: ['alpacas'],
        recordCounts: { alpacas: 0 }
      };

      // Mock S3 getObject to throw error
      mockS3GetObject.mockReturnValue({
        promise: vi.fn().mockRejectedValue(new Error('NoSuchKey'))
      });

      const corruptionResult = await backupService.detectCorruption(metadata);

      expect(corruptionResult.isCorrupted).toBe(true);
      expect(corruptionResult.corruptionType).toContain('file_missing');
      expect(corruptionResult.details).toContain('Backup file is missing or inaccessible');
    });

    it('should detect invalid JSON format', async () => {
      const metadata = {
        id: 'corrupt-backup',
        type: 'full' as const,
        timestamp: new Date(),
        size: 100,
        checksum: 'test-checksum',
        s3Key: 'corrupt-key',
        compressed: false,
        encrypted: false,
        tables: ['alpacas'],
        recordCounts: { alpacas: 0 }
      };

      // Mock S3 getObject to return invalid JSON
      mockS3GetObject.mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          Body: Buffer.from('invalid json content')
        })
      });

      const corruptionResult = await backupService.detectCorruption(metadata);

      expect(corruptionResult.isCorrupted).toBe(true);
      expect(corruptionResult.corruptionType).toContain('format_invalid');
      expect(corruptionResult.details).toContain('Backup content is not valid JSON');
    });
  });

  describe('testBackupRestoration', () => {
    it('should test restoration successfully', async () => {
      const metadata = {
        id: 'test-backup',
        type: 'full' as const,
        timestamp: new Date(),
        size: 100,
        checksum: 'test-checksum',
        compressed: false,
        encrypted: false,
        tables: ['alpacas'],
        recordCounts: { alpacas: 1 }
      };

      const backupContent = JSON.stringify({
        timestamp: new Date().toISOString(),
        tables: {
          alpacas: [{ id: '1', name: 'Test Alpaca' }]
        },
        recordCounts: { alpacas: 1 }
      });

      const restorationResult = await backupService.testBackupRestoration(backupContent, metadata);

      expect(restorationResult.isRestorable).toBe(true);
      expect(restorationResult.errors).toHaveLength(0);
      expect(restorationResult.estimatedRestoreTime).toBeGreaterThan(0);
    });

    it('should detect invalid backup structure', async () => {
      const metadata = {
        id: 'invalid-backup',
        type: 'full' as const,
        timestamp: new Date(),
        size: 100,
        checksum: 'test-checksum',
        compressed: false,
        encrypted: false,
        tables: ['alpacas'],
        recordCounts: { alpacas: 0 }
      };

      const invalidBackupContent = JSON.stringify({
        timestamp: new Date().toISOString()
        // Missing tables structure
      });

      const restorationResult = await backupService.testBackupRestoration(invalidBackupContent, metadata);

      expect(restorationResult.isRestorable).toBe(false);
      expect(restorationResult.errors).toContain('Invalid backup data structure: missing tables');
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore data from backup successfully', async () => {
      const backupContent = JSON.stringify({
        timestamp: new Date().toISOString(),
        tables: {
          alpacas: [
            { id: '1', name: 'Test Alpaca', gender: 'female', birth_date: '2020-01-01' }
          ],
          health_records: [
            { id: '1', alpaca_id: '1', record_type: 'vaccination', date: '2024-01-01' }
          ]
        },
        recordCounts: { alpacas: 1, health_records: 1 }
      });

      const metadata = {
        id: 'test-backup',
        type: 'full' as const,
        timestamp: new Date(),
        size: backupContent.length,
        checksum: 'test-checksum',
        s3Key: 'test-key',
        compressed: false,
        encrypted: false,
        tables: ['alpacas', 'health_records'],
        recordCounts: { alpacas: 1, health_records: 1 }
      };

      // Mock S3 getObject to return backup content
      mockS3GetObject.mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          Body: Buffer.from(backupContent)
        })
      });

      // Mock database connection
      const { getConnectionManager } = await import('../../database/connection');
      const mockConnectionManager = getConnectionManager();
      const mockConnection = await mockConnectionManager.getConnection();
      (mockConnection.execute as any).mockResolvedValue({ changes: 1 });

      const restoreResult = await backupService.restoreFromBackup(metadata, {
        skipValidation: true,
        useTransaction: false
      });

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.tablesRestored).toContain('alpacas');
      expect(restoreResult.tablesRestored).toContain('health_records');
      expect(restoreResult.recordsRestored).toBe(2);
      expect(restoreResult.errors).toHaveLength(0);
    });

    it('should handle restore errors gracefully', async () => {
      const metadata = {
        id: 'missing-backup',
        type: 'full' as const,
        timestamp: new Date(),
        size: 100,
        checksum: 'test-checksum',
        s3Key: 'missing-key',
        compressed: false,
        encrypted: false,
        tables: ['alpacas'],
        recordCounts: { alpacas: 0 }
      };

      // Mock S3 getObject to return null (file not found)
      mockS3GetObject.mockReturnValue({
        promise: vi.fn().mockRejectedValue(new Error('NoSuchKey'))
      });

      const restoreResult = await backupService.restoreFromBackup(metadata);

      expect(restoreResult.success).toBe(false);
      expect(restoreResult.errors).toContain('Backup file not found or inaccessible');
    });
  });

  describe('selectiveRestore', () => {
    it('should restore only specified tables', async () => {
      const backupContent = JSON.stringify({
        timestamp: new Date().toISOString(),
        tables: {
          alpacas: [{ id: '1', name: 'Test Alpaca' }],
          health_records: [{ id: '1', alpaca_id: '1', record_type: 'vaccination' }]
        },
        recordCounts: { alpacas: 1, health_records: 1 }
      });

      const metadata = {
        id: 'test-backup',
        type: 'full' as const,
        timestamp: new Date(),
        size: backupContent.length,
        checksum: 'test-checksum',
        s3Key: 'test-key',
        compressed: false,
        encrypted: false,
        tables: ['alpacas', 'health_records'],
        recordCounts: { alpacas: 1, health_records: 1 }
      };

      // Mock S3 getObject
      mockS3GetObject.mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          Body: Buffer.from(backupContent)
        })
      });

      // Mock database connection
      const { getConnectionManager } = await import('../../database/connection');
      const mockConnectionManager = getConnectionManager();
      const mockConnection = await mockConnectionManager.getConnection();
      (mockConnection.execute as any).mockResolvedValue({ changes: 1 });

      const restoreResult = await backupService.selectiveRestore(metadata, {
        tables: ['alpacas'], // Only restore alpacas table
        skipValidation: true
      });

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.tablesRestored).toContain('alpacas');
      expect(restoreResult.tablesRestored).not.toContain('health_records');
      expect(restoreResult.recordsRestored).toBe(1);
    });
  });

  describe('rollbackToBackup', () => {
    it('should rollback to previous backup state', async () => {
      const backupContent = JSON.stringify({
        timestamp: new Date().toISOString(),
        tables: {
          alpacas: [{ id: '1', name: 'Original Alpaca' }]
        },
        recordCounts: { alpacas: 1 }
      });

      const metadata = {
        id: 'rollback-backup',
        type: 'full' as const,
        timestamp: new Date(),
        size: backupContent.length,
        checksum: 'test-checksum',
        s3Key: 'test-key',
        compressed: false,
        encrypted: false,
        tables: ['alpacas'],
        recordCounts: { alpacas: 1 }
      };

      // Mock S3 getObject
      mockS3GetObject.mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          Body: Buffer.from(backupContent)
        })
      });

      // Mock database connection
      const { getConnectionManager } = await import('../../database/connection');
      const mockConnectionManager = getConnectionManager();
      const mockConnection = await mockConnectionManager.getConnection();
      (mockConnection.execute as any).mockResolvedValue({ changes: 1 });

      const rollbackResult = await backupService.rollbackToBackup(metadata);

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.tablesRestored).toContain('alpacas');
      expect(rollbackResult.recordsRestored).toBe(1);
    });
  });

  describe('createRDSPointInTimeRecovery', () => {
    it('should create RDS point-in-time recovery successfully', async () => {
      const configWithRDS = {
        ...mockConfig,
        rdsInstanceIdentifier: 'source-rds-instance'
      };

      const backupServiceWithRDS = new BackupService(configWithRDS);

      const recoveryOptions = {
        targetInstanceId: 'recovered-instance',
        restoreTime: new Date('2024-01-01T12:00:00Z'),
        subnetGroupName: 'test-subnet-group'
      };

      const recoveryResult = await backupServiceWithRDS.createRDSPointInTimeRecovery(recoveryOptions);

      expect(recoveryResult.targetInstanceId).toBe('recovered-instance');
      expect(recoveryResult.restoreTime).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(recoveryResult.status).toBe('creating');
    });

    it('should throw error when RDS instance not configured', async () => {
      const recoveryOptions = {
        targetInstanceId: 'recovered-instance',
        restoreTime: new Date()
      };

      await expect(backupService.createRDSPointInTimeRecovery(recoveryOptions)).rejects.toThrow(
        new BackupError('RDS instance identifier not configured')
      );
    });
  });

  describe('validateRecovery', () => {
    it('should validate recovery successfully', async () => {
      const restoreResult = {
        id: 'test-restore',
        backupId: 'test-backup',
        timestamp: new Date(),
        success: true,
        tablesRestored: ['alpacas', 'health_records'],
        recordsRestored: 10,
        errors: [],
        warnings: []
      };

      // Mock database connection for validation queries
      const { getConnectionManager } = await import('../../database/connection');
      const mockConnectionManager = getConnectionManager();
      const mockConnection = await mockConnectionManager.getConnection();
      (mockConnection.query as any)
        .mockResolvedValueOnce([{ count: 5 }]) // alpacas count
        .mockResolvedValueOnce([{ count: 5 }]) // health_records count
        .mockResolvedValueOnce([{ count: 5 }]) // alpacas count for integrity check
        .mockResolvedValueOnce([{ count: 5 }]); // health_records count for integrity check

      const validationResult = await backupService.validateRecovery(restoreResult);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.dataIntegrityValid).toBe(true);
      expect(validationResult.recordCountsValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });
  });
});

describe('createBackupConfig', () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.BACKUP_S3_BUCKET;
    delete process.env.BACKUP_S3_REGION;
    delete process.env.BACKUP_RETENTION_DAYS;
  });

  it('should create config with default values', () => {
    const config = createBackupConfig();

    expect(config).toEqual({
      s3BucketName: 'alpaca-herd-backups',
      s3Region: 'us-east-1',
      s3KeyPrefix: 'alpaca-herd-backups/',
      backupRetentionDays: 30,
      incrementalBackupIntervalHours: 4,
      fullBackupIntervalHours: 24,
      localBackupPath: undefined,
      rdsInstanceIdentifier: undefined,
      rdsSnapshotPrefix: 'alpaca-herd',
      enableCompression: false,
      enableEncryption: false,
      encryptionKey: undefined
    });
  });

  it('should create config with environment variables', () => {
    process.env.BACKUP_S3_BUCKET = 'custom-bucket';
    process.env.BACKUP_S3_REGION = 'eu-west-1';
    process.env.BACKUP_RETENTION_DAYS = '60';
    process.env.BACKUP_ENABLE_COMPRESSION = 'true';
    process.env.BACKUP_ENABLE_ENCRYPTION = 'true';
    process.env.BACKUP_ENCRYPTION_KEY = 'secret-key';

    const config = createBackupConfig();

    expect(config.s3BucketName).toBe('custom-bucket');
    expect(config.s3Region).toBe('eu-west-1');
    expect(config.backupRetentionDays).toBe(60);
    expect(config.enableCompression).toBe(true);
    expect(config.enableEncryption).toBe(true);
    expect(config.encryptionKey).toBe('secret-key');
  });
});