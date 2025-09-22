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

describe('Data Consistency and Cross-Entity Relationship Tests', () => {
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

  describe('Foreign Key Constraint Validation', () => {
    it('should enforce referential integrity for health records', async () => {
      // Create alpaca
      const alpacaResult = await alpacaService.registerAlpaca({
        name: 'Integrity Test',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'brown'
      });

      const alpaca = alpacaResult.alpaca!;

      // Create health record
      const healthRecord = await healthService.createHealthRecord({
        alpacaId: alpaca.id,
        recordType: 'vaccination',
        date: new Date('2024-01-15'),
        description: 'Test vaccination'
      });

      expect(healthRecord.alpacaId).toBe(alpaca.id);

      // Attempt to create health record with non-existent alpaca ID
      await expect(
        healthService.createHealthRecord({
          alpacaId: 'non-existent-id',
          recordType: 'vaccination',
          date: new Date('2024-01-15'),
          description: 'Invalid vaccination'
        })
      ).rejects.toThrow();
    });

    it('should enforce referential integrity for breeding records', async () => {
      const sireResult = await alpacaService.registerAlpaca({
        name: 'Test Sire',
        birthDate: new Date('2020-01-01'),
        gender: 'male',
        color: 'black'
      });

      const damResult = await alpacaService.registerAlpaca({
        name: 'Test Dam',
        birthDate: new Date('2020-06-01'),
        gender: 'female',
        color: 'white'
      });

      const sire = sireResult.alpaca!;
      const dam = damResult.alpaca!;

      // Valid breeding record
      const breeding = await breedingService.createBreedingRecord({
        sireId: sire.id,
        damId: dam.id,
        breedingDate: new Date('2024-01-01')
      });

      expect(breeding.sireId).toBe(sire.id);
      expect(breeding.damId).toBe(dam.id);

      // Invalid breeding record with non-existent sire
      await expect(
        breedingService.createBreedingRecord({
          sireId: 'non-existent-sire',
          damId: dam.id,
          breedingDate: new Date('2024-01-01')
        })
      ).rejects.toThrow();
    });

    it('should handle cascading deletes properly', async () => {
      const alpacaResult = await alpacaService.registerAlpaca({
        name: 'Cascade Test',
        birthDate: new Date('2021-01-01'),
        gender: 'male',
        color: 'grey'
      });

      const alpaca = alpacaResult.alpaca!;

      // Create related records
      const healthRecord = await healthService.createHealthRecord({
        alpacaId: alpaca.id,
        recordType: 'checkup',
        date: new Date('2024-01-01'),
        description: 'Pre-deletion checkup'
      });

      const activity = await activityService.createActivity({
        activityType: 'weighing',
        date: new Date('2024-01-01'),
        alpacaIds: [alpaca.id],
        performedBy: 'Test User',
        description: 'Weight measurement'
      });

      // Verify records exist
      const healthRecords = await healthService.getAlpacaHealthRecords(alpaca.id);
      const activities = await activityService.getAlpacaActivities(alpaca.id);
      
      expect(healthRecords.length).toBe(1);
      expect(activities.length).toBe(1);

      // Delete alpaca
      await alpacaService.removeAlpaca(alpaca.id);

      // Verify cascading deletes
      const remainingHealth = await healthService.getAlpacaHealthRecords(alpaca.id);
      expect(remainingHealth.length).toBe(0);

      // Activities should still exist but with empty alpaca references
      const remainingActivities = await activityService.getAllActivities();
      const activityWithDeletedAlpaca = remainingActivities.find(a => a.id === activity.id);
      expect(activityWithDeletedAlpaca?.alpacaIds).not.toContain(alpaca.id);
    });
  });

  describe('Complex Relationship Validation', () => {
    it('should maintain lineage consistency across generations', async () => {
      // Create grandparents
      const grandSireResult = await alpacaService.registerAlpaca({
        name: 'Grand Sire',
        birthDate: new Date('2018-01-01'),
        gender: 'male',
        color: 'black'
      });

      const grandDamResult = await alpacaService.registerAlpaca({
        name: 'Grand Dam',
        birthDate: new Date('2018-06-01'),
        gender: 'female',
        color: 'white'
      });

      const grandSire = grandSireResult.alpaca!;
      const grandDam = grandDamResult.alpaca!;

      // Create parents
      const sireResult = await alpacaService.registerAlpaca({
        name: 'Sire',
        birthDate: new Date('2020-01-01'),
        gender: 'male',
        color: 'grey',
        sireId: grandSire.id,
        damId: grandDam.id
      });

      const damResult = await alpacaService.registerAlpaca({
        name: 'Dam',
        birthDate: new Date('2020-06-01'),
        gender: 'female',
        color: 'brown'
      });

      const sire = sireResult.alpaca!;
      const dam = damResult.alpaca!;

      // Create offspring
      const offspringResult = await alpacaService.registerAlpaca({
        name: 'Offspring',
        birthDate: new Date('2023-01-01'),
        gender: 'female',
        color: 'mixed',
        sireId: sire.id,
        damId: dam.id
      });

      const offspring = offspringResult.alpaca!;

      // Verify lineage relationships
      const offspringLineage = await alpacaService.getLineage(offspring.id, 3);
      expect(offspringLineage.parents.length).toBe(2);
      expect(offspringLineage.grandparents.length).toBe(2); // Only from sire's side

      const sireLineage = await alpacaService.getLineage(sire.id, 2);
      expect(sireLineage.parents.length).toBe(2);

      // Test inbreeding detection across generations
      const compatibilityCheck = await breedingService.checkBreedingCompatibility(grandSire.id, offspring.id);
      expect(compatibilityCheck.compatible).toBe(false);
      expect(compatibilityCheck.riskLevel).toBe('high');
    });

    it('should handle complex multi-alpaca activities consistently', async () => {
      // Create multiple alpacas
      const alpacaResults = await Promise.all([
        alpacaService.registerAlpaca({
          name: 'Herd Member 1',
          birthDate: new Date('2021-01-01'),
          gender: 'male',
          color: 'brown'
        }),
        alpacaService.registerAlpaca({
          name: 'Herd Member 2',
          birthDate: new Date('2021-02-01'),
          gender: 'female',
          color: 'white'
        }),
        alpacaService.registerAlpaca({
          name: 'Herd Member 3',
          birthDate: new Date('2021-03-01'),
          gender: 'female',
          color: 'grey'
        })
      ]);

      const alpacas = alpacaResults.map(result => result.alpaca!);

      const alpacaIds = alpacas.map(a => a.id);

      // Create herd-wide activity
      const herdActivity = await activityService.createActivity({
        activityType: 'shearing',
        date: new Date('2024-05-01'),
        alpacaIds: alpacaIds,
        performedBy: 'Shearing Team',
        description: 'Annual shearing event'
      });

      // Verify all alpacas are associated
      expect(herdActivity.alpacaIds).toHaveLength(3);
      alpacaIds.forEach(id => {
        expect(herdActivity.alpacaIds).toContain(id);
      });

      // Test activity queries for each alpaca
      for (const alpaca of alpacas) {
        const activities = await activityService.getAlpacaActivities(alpaca.id);
        expect(activities).toHaveLength(1);
        expect(activities[0].id).toBe(herdActivity.id);
      }

      // Test bulk activity updates
      const updatedActivity = await activityService.updateActivity(herdActivity.id, {
        notes: 'Completed successfully, all alpacas handled well'
      });

      expect(updatedActivity.notes).toBe('Completed successfully, all alpacas handled well');
      expect(updatedActivity.alpacaIds).toHaveLength(3);
    });
  });

  describe('Transaction Consistency', () => {
    it('should maintain data consistency during concurrent operations', async () => {
      const alpacaResult = await alpacaService.registerAlpaca({
        name: 'Concurrent Test',
        birthDate: new Date('2022-01-01'),
        gender: 'male',
        color: 'black'
      });

      const alpaca = alpacaResult.alpaca!;

      // Simulate concurrent health record creation
      const concurrentHealthPromises = Array.from({ length: 5 }, (_, i) =>
        healthService.createHealthRecord({
          alpacaId: alpaca.id,
          recordType: 'observation',
          date: new Date(`2024-01-${i + 1}`),
          description: `Concurrent observation ${i + 1}`
        })
      );

      const healthRecords = await Promise.all(concurrentHealthPromises);
      expect(healthRecords).toHaveLength(5);

      // Verify all records were created successfully
      const allHealthRecords = await healthService.getAlpacaHealthRecords(alpaca.id);
      expect(allHealthRecords).toHaveLength(5);

      // Verify each record has unique ID and correct alpaca reference
      const uniqueIds = new Set(allHealthRecords.map(r => r.id));
      expect(uniqueIds.size).toBe(5);
      
      allHealthRecords.forEach(record => {
        expect(record.alpacaId).toBe(alpaca.id);
      });
    });

    it('should handle transaction rollback on validation failures', async () => {
      const alpacaResult = await alpacaService.registerAlpaca({
        name: 'Rollback Test',
        birthDate: new Date('2022-01-01'),
        gender: 'female',
        color: 'white'
      });

      const alpaca = alpacaResult.alpaca!;

      // Get initial count
      const initialHealthRecords = await healthService.getAlpacaHealthRecords(alpaca.id);
      const initialCount = initialHealthRecords.length;

      // Attempt to create multiple records with one invalid
      const mixedPromises = [
        healthService.createHealthRecord({
          alpacaId: alpaca.id,
          recordType: 'vaccination',
          date: new Date('2024-01-01'),
          description: 'Valid vaccination'
        }),
        healthService.createHealthRecord({
          alpacaId: 'invalid-alpaca-id',
          recordType: 'vaccination',
          date: new Date('2024-01-02'),
          description: 'Invalid vaccination'
        }).catch(error => ({ error }))
      ];

      const results = await Promise.all(mixedPromises);
      
      // Verify one succeeded and one failed
      expect(results[0]).not.toHaveProperty('error');
      expect(results[1]).toHaveProperty('error');

      // Verify database state is consistent
      const finalHealthRecords = await healthService.getAlpacaHealthRecords(alpaca.id);
      expect(finalHealthRecords.length).toBe(initialCount + 1);
    });
  });
});