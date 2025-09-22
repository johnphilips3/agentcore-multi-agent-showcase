import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegrationTestSetup } from './setup';
import { AlpacaServiceImpl } from '../../services/alpaca-service';
import { HealthServiceImpl } from '../../services/health-service';
import { BreedingServiceImpl } from '../../services/breeding-service';
import { ActivityServiceImpl } from '../../services/activity-service';
import { AlpacaRepositoryImpl } from '../../repositories/alpaca-repository';
import { HealthRepositoryImpl } from '../../repositories/health-repository';
import { BreedingRepositoryImpl } from '../../repositories/breeding-repository';
import { ActivityRepositoryImpl } from '../../repositories/activity-repository';
import { Alpaca, HealthRecord, BreedingRecord, ManagementActivity } from '../../models';

describe('Alpaca Management Workflow Integration Tests', () => {
  let testSetup: IntegrationTestSetup;
  let alpacaService: AlpacaServiceImpl;
  let healthService: HealthServiceImpl;
  let breedingService: BreedingServiceImpl;
  let activityService: ActivityServiceImpl;

  beforeEach(async () => {
    testSetup = new IntegrationTestSetup();
    await testSetup.setup();

    const alpacaRepo = new AlpacaRepositoryImpl();
    const healthRepo = new HealthRepositoryImpl();
    const breedingRepo = new BreedingRepositoryImpl();
    const activityRepo = new ActivityRepositoryImpl();

    alpacaService = new AlpacaServiceImpl(alpacaRepo, breedingRepo);
    healthService = new HealthServiceImpl(healthRepo, alpacaRepo);
    breedingService = new BreedingServiceImpl(breedingRepo, alpacaRepo);
    activityService = new ActivityServiceImpl(activityRepo, alpacaRepo);
  });

  afterEach(async () => {
    await testSetup.teardown();
  });

  describe('Complete Alpaca Lifecycle Management', () => {
    it('should handle complete alpaca registration and management workflow', async () => {
      // Step 1: Register new alpacas
      const sireResult = await alpacaService.registerAlpaca({
        name: 'Thunder',
        birthDate: new Date('2020-05-15'),
        gender: 'male',
        color: 'brown',
        registrationNumber: 'ALF001'
      });

      const damResult = await alpacaService.registerAlpaca({
        name: 'Lightning',
        birthDate: new Date('2019-03-20'),
        gender: 'female',
        color: 'white',
        registrationNumber: 'ALF002'
      });

      expect(sireResult.success).toBe(true);
      expect(damResult.success).toBe(true);
      const sire = sireResult.alpaca!;
      const dam = damResult.alpaca!;

      expect(sire.id).toBeDefined();
      expect(dam.id).toBeDefined();
      expect(sire.name).toBe('Thunder');
      expect(dam.name).toBe('Lightning');

      // Step 2: Record initial health records
      const sireVaccination = await healthService.createHealthRecord({
        alpacaId: sire.id,
        recordType: 'vaccination',
        date: new Date('2024-01-15'),
        description: 'Annual vaccination',
        veterinarian: 'Dr. Smith',
        nextDueDate: new Date('2025-01-15')
      });

      const damCheckup = await healthService.createHealthRecord({
        alpacaId: dam.id,
        recordType: 'checkup',
        date: new Date('2024-01-20'),
        description: 'Pre-breeding health check',
        veterinarian: 'Dr. Smith'
      });

      expect(sireVaccination.alpacaId).toBe(sire.id);
      expect(damCheckup.alpacaId).toBe(dam.id);

      // Step 3: Record breeding activity
      const breedingRecord = await breedingService.createBreedingRecord({
        sireId: sire.id,
        damId: dam.id,
        breedingDate: new Date('2024-02-01'),
        expectedDueDate: new Date('2024-12-15'),
        notes: 'First breeding attempt'
      });

      expect(breedingRecord.sireId).toBe(sire.id);
      expect(breedingRecord.damId).toBe(dam.id);

      // Step 4: Record management activities
      const feedingActivity = await activityService.createActivity({
        activityType: 'feeding',
        date: new Date('2024-02-05'),
        alpacaIds: [sire.id, dam.id],
        performedBy: 'Farm Manager',
        description: 'Special breeding diet started'
      });

      expect(feedingActivity.alpacaIds).toContain(sire.id);
      expect(feedingActivity.alpacaIds).toContain(dam.id);

      // Step 5: Verify cross-entity relationships
      const sireHealthRecords = await healthService.getAlpacaHealthRecords(sire.id);
      const damBreedingHistory = await breedingService.getBreedingRecordsByParent(dam.id);
      const recentActivities = await activityService.getActivitiesByDateRange(
        new Date('2024-02-01'),
        new Date('2024-02-10')
      );

      expect(sireHealthRecords).toHaveLength(1);
      expect(damBreedingHistory).toHaveLength(1);
      expect(recentActivities).toHaveLength(1);
    });
  });

  describe('Breeding Program Management', () => {
    it('should handle complete breeding program workflow with offspring tracking', async () => {
      // Create parent alpacas
      const sireResult = await alpacaService.registerAlpaca({
        name: 'Champion',
        birthDate: new Date('2018-04-10'),
        gender: 'male',
        color: 'black',
        registrationNumber: 'CHM001'
      });

      const damResult = await alpacaService.registerAlpaca({
        name: 'Beauty',
        birthDate: new Date('2019-06-15'),
        gender: 'female',
        color: 'grey',
        registrationNumber: 'BTY001'
      });

      const sire = sireResult.alpaca!;
      const dam = damResult.alpaca!;

      // Record breeding
      const breeding = await breedingService.createBreedingRecord({
        sireId: sire.id,
        damId: dam.id,
        breedingDate: new Date('2023-03-01'),
        expectedDueDate: new Date('2023-12-15')
      });

      // Create offspring
      const offspringResult = await alpacaService.registerAlpaca({
        name: 'Little Star',
        birthDate: new Date('2023-12-10'),
        gender: 'female',
        color: 'dark grey',
        sireId: sire.id,
        damId: dam.id
      });

      const offspring = offspringResult.alpaca!;

      // Update breeding record with actual birth
      const updatedBreeding = await breedingService.updateBreedingRecord(breeding.id, {
        actualBirthDate: new Date('2023-12-10'),
        offspringIds: [offspring.id]
      });

      // Verify lineage tracking
      const lineage = await alpacaService.getLineage(offspring.id, 2);
      expect(lineage.parents).toHaveLength(2);
      expect(lineage.parents.some(p => p.id === sire.id)).toBe(true);
      expect(lineage.parents.some(p => p.id === dam.id)).toBe(true);

      // Test inbreeding prevention
      const compatibilityCheck = await breedingService.checkBreedingCompatibility(sire.id, offspring.id);
      expect(compatibilityCheck.compatible).toBe(false);
      expect(compatibilityCheck.riskLevel).toBe('critical');

      // Verify breeding history
      const sireOffspring = await alpacaService.getOffspring(sire.id);
      const damOffspring = await alpacaService.getOffspring(dam.id);
      
      expect(sireOffspring).toHaveLength(1);
      expect(damOffspring).toHaveLength(1);
      expect(sireOffspring[0].id).toBe(offspring.id);
    });
  });

  describe('Health Management Workflow', () => {
    it('should handle comprehensive health tracking and alerts', async () => {
      // Create test alpaca
      const alpacaResult = await alpacaService.registerAlpaca({
        name: 'Healthy',
        birthDate: new Date('2022-07-20'),
        gender: 'female',
        color: 'white'
      });

      const alpaca = alpacaResult.alpaca!;

      // Record initial vaccination
      const vaccination = await healthService.createHealthRecord({
        alpacaId: alpaca.id,
        recordType: 'vaccination',
        date: new Date('2024-01-15'),
        description: 'CDT vaccination',
        veterinarian: 'Dr. Johnson',
        nextDueDate: new Date('2025-01-15')
      });

      // Record treatment
      const treatment = await healthService.createHealthRecord({
        alpacaId: alpaca.id,
        recordType: 'treatment',
        date: new Date('2024-02-10'),
        description: 'Antibiotic treatment for minor infection',
        veterinarian: 'Dr. Johnson'
      });

      // Record observation
      const observation = await healthService.createHealthRecord({
        alpacaId: alpaca.id,
        recordType: 'observation',
        date: new Date('2024-02-20'),
        description: 'Full recovery observed, eating well'
      });

      // Test health record retrieval
      const healthHistory = await healthService.getAlpacaHealthRecords(alpaca.id);
      expect(healthHistory).toHaveLength(3);

      // Test date range queries
      const februaryRecords = await healthService.getHealthRecordsByDateRange(
        new Date('2024-02-01'),
        new Date('2024-02-28')
      );
      expect(februaryRecords).toHaveLength(2);

      // Test overdue vaccination detection
      const overdueVaccinations = await healthService.getOverdueVaccinations();
      expect(overdueVaccinations).toHaveLength(0); // Should be empty as vaccination is current

      // Create overdue vaccination scenario
      const overdueResult = await alpacaService.registerAlpaca({
        name: 'Overdue',
        birthDate: new Date('2021-05-10'),
        gender: 'male',
        color: 'brown'
      });

      const overdueAlpaca = overdueResult.alpaca!;

      await healthService.createHealthRecord({
        alpacaId: overdueAlpaca.id,
        recordType: 'vaccination',
        date: new Date('2023-01-15'),
        description: 'Last vaccination',
        nextDueDate: new Date('2024-01-15') // Past due
      });

      const nowOverdue = await healthService.getOverdueVaccinations();
      expect(nowOverdue).toHaveLength(1);
      expect(nowOverdue[0].alpacaId).toBe(overdueAlpaca.id);
    });
  });
});