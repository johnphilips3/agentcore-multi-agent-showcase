import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegrationTestSetup } from './setup';
import { BackupService } from '../../services/backup-service';
import { AlpacaServiceImpl } from '../../services/alpaca-service';
import { HealthServiceImpl } from '../../services/health-service';
import { AlpacaRepositoryImpl } from '../../repositories/alpaca-repository';
import { HealthRepositoryImpl } from '../../repositories/health-repository';
import { BreedingRepositoryImpl } from '../../repositories/breeding-repository';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Backup and Recovery Integration Tests', () => {
  let testSetup: IntegrationTestSetup;
  let backupService: BackupService;
  let alpacaService: AlpacaServiceImpl;
  let healthService: HealthServiceImpl;
  let testBackupDir: string;

  beforeEach(async () => {
    testSetup = new IntegrationTestSetup();
    await testSetup.setup();

    const alpacaRepo = new AlpacaRepositoryImpl();
    const healthRepo = new HealthRepositoryImpl();
    const breedingRepo = new BreedingRepositoryImpl();

    alpacaService = new AlpacaServiceImpl(alpacaRepo, breedingRepo);
    healthService = new HealthServiceImpl(healthRepo, alpacaRepo);

    testBackupDir = path.join(process.cwd(), 'test-backups');
    backupService = new BackupService(connection, {
      backupDirectory: testBackupDir,
      retentionDays: 7
    });

    // Ensure backup directory exists
    try {
      await fs.mkdir(testBackupDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterEach(async () => {
    await testSetup.teardown();
    
    // Clean up test backup files
    try {
      await fs.rm(testBackupDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('Backup Creation and Verification', () => {
    it('should create and verify complete database backup', async () => {
      // Create test data
      const alpaca1Result = await alpacaService.registerAlpaca({
        name: 'Backup Test 1',
        birthDate: new Date('2022-01-15'),
        gender: 'male',
        color: 'brown',
        registrationNumber: 'BT001'
      });

      const alpaca2Result = await alpacaService.registerAlpaca({
        name: 'Backup Test 2',
        birthDate: new Date('2021-06-20'),
        gender: 'female',
        color: 'white',
        registrationNumber: 'BT002'
      });

      const alpaca1 = alpaca1Result.alpaca!;
      const alpaca2 = alpaca2Result.alpaca!;

      await healthService.createHealthRecord({
        alpacaId: alpaca1.id,
        recordType: 'vaccination',
        date: new Date('2024-01-15'),
        description: 'Test vaccination',
        veterinarian: 'Dr. Test'
      });

      // Create backup
      const backupResult = await backupService.createBackup();
      expect(backupResult.success).toBe(true);
      expect(backupResult.backupPath).toBeDefined();

      // Verify backup file exists
      const backupExists = await fs.access(backupResult.backupPath!)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);

      // Verify backup integrity
      const verificationResult = await backupService.verifyBackup(backupResult.backupPath!);
      expect(verificationResult.isValid).toBe(true);
      expect(verificationResult.recordCounts.alpacas).toBe(2);
      expect(verificationResult.recordCounts.healthRecords).toBe(1);
    });

    it('should handle incremental backup creation', async () => {
      // Create initial data and backup
      const alpacaResult = await alpacaService.registerAlpaca({
        name: 'Incremental Test',
        birthDate: new Date('2022-05-10'),
        gender: 'female',
        color: 'grey'
      });

      const alpaca = alpacaResult.alpaca!;

      const fullBackup = await backupService.createBackup();
      expect(fullBackup.success).toBe(true);

      // Add more data
      await healthService.createHealthRecord({
        alpacaId: alpaca.id,
        recordType: 'checkup',
        date: new Date('2024-02-01'),
        description: 'Regular checkup'
      });

      // Create incremental backup
      const incrementalBackup = await backupService.createIncrementalBackup(fullBackup.timestamp!);
      expect(incrementalBackup.success).toBe(true);
      expect(incrementalBackup.backupType).toBe('incremental');

      // Verify incremental backup contains only new data
      const verification = await backupService.verifyBackup(incrementalBackup.backupPath!);
      expect(verification.isValid).toBe(true);
      expect(verification.recordCounts.healthRecords).toBe(1);
    });
  });

  describe('Data Recovery and Restoration', () => {
    it('should restore data from backup successfully', async () => {
      // Create original data
      const originalResult = await alpacaService.registerAlpaca({
        name: 'Recovery Test',
        birthDate: new Date('2021-08-15'),
        gender: 'male',
        color: 'black',
        registrationNumber: 'RT001'
      });

      const originalAlpaca = originalResult.alpaca!;

      const originalHealth = await healthService.createHealthRecord({
        alpacaId: originalAlpaca.id,
        recordType: 'vaccination',
        date: new Date('2024-01-10'),
        description: 'Pre-backup vaccination'
      });

      // Create backup
      const backup = await backupService.createBackup();
      expect(backup.success).toBe(true);

      // Simulate data loss by creating new data
      await alpacaService.registerAlpaca({
        name: 'Post Backup',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'white'
      });

      // Verify we have more data now
      const allAlpacasBefore = await alpacaService.getAllAlpacas();
      expect(allAlpacasBefore.length).toBe(2);

      // Restore from backup
      const restoreResult = await backupService.restoreFromBackup(backup.backupPath!);
      expect(restoreResult.success).toBe(true);

      // Verify restoration
      const allAlpacasAfter = await alpacaService.getAllAlpacas();
      expect(allAlpacasAfter.length).toBe(1);
      expect(allAlpacasAfter[0].name).toBe('Recovery Test');
      expect(allAlpacasAfter[0].registrationNumber).toBe('RT001');

      const healthRecords = await healthService.getHealthRecordsByAlpaca(allAlpacasAfter[0].id);
      expect(healthRecords.length).toBe(1);
      expect(healthRecords[0].description).toBe('Pre-backup vaccination');
    });

    it('should handle selective data recovery', async () => {
      // Create test data across multiple entities
      const alpaca1Result = await alpacaService.registerAlpaca({
        name: 'Selective 1',
        birthDate: new Date('2021-01-01'),
        gender: 'male',
        color: 'brown'
      });

      const alpaca2Result = await alpacaService.registerAlpaca({
        name: 'Selective 2',
        birthDate: new Date('2021-02-01'),
        gender: 'female',
        color: 'white'
      });

      const alpaca1 = alpaca1Result.alpaca!;
      const alpaca2 = alpaca2Result.alpaca!;

      await healthService.createHealthRecord({
        alpacaId: alpaca1.id,
        recordType: 'vaccination',
        date: new Date('2024-01-01'),
        description: 'Alpaca 1 vaccination'
      });

      await healthService.createHealthRecord({
        alpacaId: alpaca2.id,
        recordType: 'checkup',
        date: new Date('2024-01-02'),
        description: 'Alpaca 2 checkup'
      });

      // Create backup
      const backup = await backupService.createBackup();

      // Simulate partial data corruption (delete health records only)
      const healthRecords = await healthService.getHealthRecordsByDateRange(
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      for (const record of healthRecords) {
        await healthService.removeHealthRecord(record.id);
      }

      // Verify health records are gone but alpacas remain
      const remainingHealth = await healthService.getHealthRecordsByDateRange(
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      const remainingAlpacas = await alpacaService.getAllAlpacas();
      expect(remainingHealth.length).toBe(0);
      expect(remainingAlpacas.length).toBe(2);

      // Perform selective recovery (health records only)
      const selectiveRestore = await backupService.restoreFromBackup(backup.backupPath!, {
        entities: ['health_records']
      });
      expect(selectiveRestore.success).toBe(true);

      // Verify selective restoration
      const restoredHealth = await healthService.getHealthRecordsByDateRange(
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      const unchangedAlpacas = await alpacaService.getAllAlpacas();
      
      expect(restoredHealth.length).toBe(2);
      expect(unchangedAlpacas.length).toBe(2);
    });
  });
});