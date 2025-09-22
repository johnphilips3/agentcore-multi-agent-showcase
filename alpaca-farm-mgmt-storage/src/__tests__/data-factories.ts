/**
 * Data factories for creating consistent test data objects
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { 
  Alpaca, 
  CreateAlpacaInput, 
  UpdateAlpacaInput,
  FiberQuality
} from '../models/alpaca';
import { 
  HealthRecord, 
  CreateHealthRecordInput, 
  UpdateHealthRecordInput 
} from '../models/health-record';
import { 
  BreedingRecord, 
  CreateBreedingRecordInput, 
  UpdateBreedingRecordInput 
} from '../models/breeding-record';
import { 
  ManagementActivity, 
  CreateManagementActivityInput, 
  UpdateManagementActivityInput 
} from '../models/management-activity';
import { 
  Gender, 
  RecordType, 
  ActivityType 
} from '../models/common';
import { 
  generateTestUUID, 
  generateTestDate, 
  generateFutureTestDate,
  TestDataUtils 
} from './test-utils';

/**
 * Factory for creating Alpaca test data
 */
export class AlpacaFactory {
  /**
   * Creates a complete Alpaca entity with all fields populated
   */
  static create(overrides: Partial<Alpaca> = {}): Alpaca {
    const baseDate = new Date('2024-01-01T00:00:00Z');
    
    return {
      id: generateTestUUID(),
      name: TestDataUtils.generateAlpacaName(),
      registrationNumber: TestDataUtils.generateRegistrationNumber(),
      birthDate: generateTestDate(3),
      gender: 'female' as Gender,
      color: TestDataUtils.generateColor(),
      weight: TestDataUtils.generateWeight(),
      height: TestDataUtils.generateHeight(),
      fiberQuality: this.createFiberQuality(),
      sireId: generateTestUUID(),
      damId: generateTestUUID(),
      createdAt: baseDate,
      updatedAt: baseDate,
      ...overrides
    };
  }

  /**
   * Creates a minimal Alpaca entity with only required fields
   */
  static createMinimal(overrides: Partial<Alpaca> = {}): Alpaca {
    const baseDate = new Date('2024-01-01T00:00:00Z');
    
    return {
      id: generateTestUUID(),
      name: TestDataUtils.generateAlpacaName(),
      birthDate: generateTestDate(2),
      gender: 'male' as Gender,
      color: TestDataUtils.generateColor(),
      createdAt: baseDate,
      updatedAt: baseDate,
      ...overrides
    };
  }

  /**
   * Creates CreateAlpacaInput for testing creation operations
   */
  static createInput(overrides: Partial<CreateAlpacaInput> = {}): CreateAlpacaInput {
    return {
      name: TestDataUtils.generateAlpacaName(),
      registrationNumber: TestDataUtils.generateRegistrationNumber(),
      birthDate: generateTestDate(2),
      gender: 'female' as Gender,
      color: TestDataUtils.generateColor(),
      weight: TestDataUtils.generateWeight(),
      height: TestDataUtils.generateHeight(),
      fiberQuality: this.createFiberQuality(),
      sireId: generateTestUUID(),
      damId: generateTestUUID(),
      ...overrides
    };
  }

  /**
   * Creates UpdateAlpacaInput for testing update operations
   */
  static updateInput(overrides: Partial<UpdateAlpacaInput> = {}): UpdateAlpacaInput {
    return {
      name: TestDataUtils.generateAlpacaName(),
      weight: TestDataUtils.generateWeight(),
      height: TestDataUtils.generateHeight(),
      ...overrides
    };
  }

  /**
   * Creates FiberQuality data
   */
  static createFiberQuality(overrides: Partial<FiberQuality> = {}): FiberQuality {
    return {
      micronCount: TestDataUtils.generateMicronCount(),
      stapleLength: TestDataUtils.generateStapleLength(),
      crimp: 'fine',
      density: 'high',
      ...overrides
    };
  }

  /**
   * Creates a breeding pair (sire and dam)
   */
  static createBreedingPair(): { sire: Alpaca; dam: Alpaca } {
    const sire = this.create({
      gender: 'male' as Gender,
      birthDate: generateTestDate(4) // Older male
    });
    
    const dam = this.create({
      gender: 'female' as Gender,
      birthDate: generateTestDate(3) // Younger female
    });

    return { sire, dam };
  }

  /**
   * Creates multiple alpacas for bulk testing
   */
  static createMultiple(count: number, overrides: Partial<Alpaca> = {}): Alpaca[] {
    return Array.from({ length: count }, (_, index) => 
      this.create({
        name: `${TestDataUtils.generateAlpacaName()}-${index + 1}`,
        ...overrides
      })
    );
  }
}

/**
 * Factory for creating HealthRecord test data
 */
export class HealthRecordFactory {
  /**
   * Creates a complete HealthRecord entity
   */
  static create(overrides: Partial<HealthRecord> = {}): HealthRecord {
    const baseDate = new Date('2024-01-01T00:00:00Z');
    
    return {
      id: generateTestUUID(),
      alpacaId: generateTestUUID(),
      recordType: 'vaccination' as RecordType,
      date: generateTestDate(1),
      description: 'Annual vaccination',
      veterinarian: TestDataUtils.generateVeterinarianName(),
      nextDueDate: generateFutureTestDate(12),
      notes: 'Routine vaccination completed successfully',
      createdAt: baseDate,
      updatedAt: baseDate,
      ...overrides
    };
  }

  /**
   * Creates a minimal HealthRecord entity with only required fields
   */
  static createMinimal(overrides: Partial<HealthRecord> = {}): HealthRecord {
    const baseDate = new Date('2024-01-01T00:00:00Z');
    
    return {
      id: generateTestUUID(),
      alpacaId: generateTestUUID(),
      recordType: 'checkup' as RecordType,
      date: generateTestDate(0.5),
      description: 'Health checkup',
      createdAt: baseDate,
      updatedAt: baseDate,
      ...overrides
    };
  }

  /**
   * Creates CreateHealthRecordInput for testing creation operations
   */
  static createInput(overrides: Partial<CreateHealthRecordInput> = {}): CreateHealthRecordInput {
    return {
      alpacaId: generateTestUUID(),
      recordType: 'vaccination' as RecordType,
      date: generateTestDate(0.1),
      description: 'Vaccination record',
      veterinarian: TestDataUtils.generateVeterinarianName(),
      nextDueDate: generateFutureTestDate(12),
      notes: 'Vaccination administered without complications',
      ...overrides
    };
  }

  /**
   * Creates UpdateHealthRecordInput for testing update operations
   */
  static updateInput(overrides: Partial<UpdateHealthRecordInput> = {}): UpdateHealthRecordInput {
    return {
      description: 'Updated health record description',
      notes: 'Updated notes',
      ...overrides
    };
  }

  /**
   * Creates health records for different record types
   */
  static createByType(recordType: RecordType, overrides: Partial<HealthRecord> = {}): HealthRecord {
    const descriptions: Record<RecordType, string> = {
      vaccination: 'Annual vaccination administered',
      checkup: 'Routine health checkup performed',
      treatment: 'Medical treatment provided',
      medication: 'Medication administered',
      surgery: 'Surgical procedure performed',
      injury: 'Injury treatment and care',
      illness: 'Illness diagnosis and treatment',
      other: 'Other health-related activity'
    };

    return this.create({
      recordType,
      description: descriptions[recordType],
      ...overrides
    });
  }

  /**
   * Creates multiple health records for testing
   */
  static createMultiple(count: number, alpacaId?: string, overrides: Partial<HealthRecord> = {}): HealthRecord[] {
    const targetAlpacaId = alpacaId || generateTestUUID();
    
    return Array.from({ length: count }, (_, index) => 
      this.create({
        alpacaId: targetAlpacaId,
        date: generateTestDate(index * 0.1),
        ...overrides
      })
    );
  }
}

/**
 * Factory for creating BreedingRecord test data
 */
export class BreedingRecordFactory {
  /**
   * Creates a complete BreedingRecord entity
   */
  static create(overrides: Partial<BreedingRecord> = {}): BreedingRecord {
    const baseDate = new Date('2024-01-01T00:00:00Z');
    const breedingDate = generateTestDate(1);
    
    return {
      id: generateTestUUID(),
      sireId: generateTestUUID(),
      damId: generateTestUUID(),
      breedingDate,
      expectedDueDate: this.calculateExpectedDueDate(breedingDate),
      actualBirthDate: undefined,
      offspringIds: [],
      notes: 'Breeding record created',
      createdAt: baseDate,
      updatedAt: baseDate,
      ...overrides
    };
  }

  /**
   * Creates a breeding record with offspring
   */
  static createWithOffspring(offspringCount: number = 1, overrides: Partial<BreedingRecord> = {}): BreedingRecord {
    const breedingDate = generateTestDate(1.5);
    const actualBirthDate = this.calculateActualBirthDate(breedingDate);
    const offspringIds = Array.from({ length: offspringCount }, () => generateTestUUID());
    
    return this.create({
      breedingDate,
      actualBirthDate,
      offspringIds,
      notes: `Successful breeding with ${offspringCount} offspring`,
      ...overrides
    });
  }

  /**
   * Creates CreateBreedingRecordInput for testing creation operations
   */
  static createInput(overrides: Partial<CreateBreedingRecordInput> = {}): CreateBreedingRecordInput {
    const breedingDate = generateTestDate(0.5);
    
    return {
      sireId: generateTestUUID(),
      damId: generateTestUUID(),
      breedingDate,
      expectedDueDate: this.calculateExpectedDueDate(breedingDate),
      offspringIds: [],
      notes: 'New breeding record',
      ...overrides
    };
  }

  /**
   * Creates UpdateBreedingRecordInput for testing update operations
   */
  static updateInput(overrides: Partial<UpdateBreedingRecordInput> = {}): UpdateBreedingRecordInput {
    return {
      notes: 'Updated breeding record notes',
      ...overrides
    };
  }

  /**
   * Creates a breeding record for specific alpacas
   */
  static createForAlpacas(sireId: string, damId: string, overrides: Partial<BreedingRecord> = {}): BreedingRecord {
    return this.create({
      sireId,
      damId,
      ...overrides
    });
  }

  /**
   * Calculates expected due date (11 months after breeding)
   */
  private static calculateExpectedDueDate(breedingDate: Date): Date {
    const dueDate = new Date(breedingDate);
    dueDate.setMonth(dueDate.getMonth() + 11);
    return dueDate;
  }

  /**
   * Calculates actual birth date (around expected due date)
   */
  private static calculateActualBirthDate(breedingDate: Date): Date {
    const birthDate = new Date(breedingDate);
    // Add 11 months plus/minus a few days for realism
    birthDate.setMonth(birthDate.getMonth() + 11);
    birthDate.setDate(birthDate.getDate() + (Math.random() * 14 - 7)); // +/- 7 days
    return birthDate;
  }

  /**
   * Creates multiple breeding records for testing
   */
  static createMultiple(count: number, overrides: Partial<BreedingRecord> = {}): BreedingRecord[] {
    return Array.from({ length: count }, (_, index) => 
      this.create({
        breedingDate: generateTestDate(index * 0.5 + 0.5),
        ...overrides
      })
    );
  }
}

/**
 * Factory for creating ManagementActivity test data
 */
export class ManagementActivityFactory {
  /**
   * Creates a complete ManagementActivity entity
   */
  static create(overrides: Partial<ManagementActivity> = {}): ManagementActivity {
    const baseDate = new Date('2024-01-01T00:00:00Z');
    
    return {
      id: generateTestUUID(),
      activityType: 'feeding' as ActivityType,
      date: generateTestDate(0.1),
      alpacaIds: [generateTestUUID()],
      performedBy: TestDataUtils.generatePerformerName(),
      description: 'Daily feeding activity',
      notes: 'Activity completed successfully',
      createdAt: baseDate,
      updatedAt: baseDate,
      ...overrides
    };
  }

  /**
   * Creates a bulk activity affecting multiple alpacas
   */
  static createBulkActivity(alpacaCount: number = 5, overrides: Partial<ManagementActivity> = {}): ManagementActivity {
    const alpacaIds = Array.from({ length: alpacaCount }, () => generateTestUUID());
    
    return this.create({
      activityType: 'shearing' as ActivityType,
      alpacaIds,
      description: `Bulk shearing activity for ${alpacaCount} alpacas`,
      notes: `Shearing completed for ${alpacaCount} alpacas`,
      ...overrides
    });
  }

  /**
   * Creates CreateManagementActivityInput for testing creation operations
   */
  static createInput(overrides: Partial<CreateManagementActivityInput> = {}): CreateManagementActivityInput {
    return {
      activityType: 'weighing' as ActivityType,
      date: generateTestDate(0.05),
      alpacaIds: [generateTestUUID()],
      performedBy: TestDataUtils.generatePerformerName(),
      description: 'Weight measurement activity',
      notes: 'Weight recorded successfully',
      ...overrides
    };
  }

  /**
   * Creates UpdateManagementActivityInput for testing update operations
   */
  static updateInput(overrides: Partial<UpdateManagementActivityInput> = {}): UpdateManagementActivityInput {
    return {
      description: 'Updated activity description',
      notes: 'Updated activity notes',
      ...overrides
    };
  }

  /**
   * Creates activities for different activity types
   */
  static createByType(activityType: ActivityType, overrides: Partial<ManagementActivity> = {}): ManagementActivity {
    const descriptions: Record<ActivityType, string> = {
      feeding: 'Daily feeding routine',
      shearing: 'Annual shearing activity',
      weighing: 'Weight measurement and recording',
      moving: 'Alpaca relocation activity',
      training: 'Training and behavioral work',
      other: 'Other management activity'
    };

    return this.create({
      activityType,
      description: descriptions[activityType],
      ...overrides
    });
  }

  /**
   * Creates activities for specific alpacas
   */
  static createForAlpacas(alpacaIds: string[], overrides: Partial<ManagementActivity> = {}): ManagementActivity {
    return this.create({
      alpacaIds: [...alpacaIds],
      description: `Activity for ${alpacaIds.length} alpaca(s)`,
      ...overrides
    });
  }

  /**
   * Creates multiple management activities for testing
   */
  static createMultiple(count: number, overrides: Partial<ManagementActivity> = {}): ManagementActivity[] {
    return Array.from({ length: count }, (_, index) => 
      this.create({
        date: generateTestDate(index * 0.1),
        ...overrides
      })
    );
  }
}

/**
 * Combined factory for creating related test data
 */
export class TestDataFactory {
  /**
   * Creates a complete alpaca with related health records
   */
  static createAlpacaWithHealthRecords(healthRecordCount: number = 3): {
    alpaca: Alpaca;
    healthRecords: HealthRecord[];
  } {
    const alpaca = AlpacaFactory.create();
    const healthRecords = HealthRecordFactory.createMultiple(healthRecordCount, alpaca.id);
    
    return { alpaca, healthRecords };
  }

  /**
   * Creates a breeding scenario with sire, dam, and breeding record
   */
  static createBreedingScenario(): {
    sire: Alpaca;
    dam: Alpaca;
    breedingRecord: BreedingRecord;
  } {
    const { sire, dam } = AlpacaFactory.createBreedingPair();
    const breedingRecord = BreedingRecordFactory.createForAlpacas(sire.id, dam.id);
    
    return { sire, dam, breedingRecord };
  }

  /**
   * Creates a complete herd with various relationships
   */
  static createTestHerd(size: number = 10): {
    alpacas: Alpaca[];
    healthRecords: HealthRecord[];
    breedingRecords: BreedingRecord[];
    activities: ManagementActivity[];
  } {
    const alpacas = AlpacaFactory.createMultiple(size);
    const healthRecords: HealthRecord[] = [];
    const breedingRecords: BreedingRecord[] = [];
    const activities: ManagementActivity[] = [];

    // Create health records for each alpaca
    alpacas.forEach(alpaca => {
      healthRecords.push(...HealthRecordFactory.createMultiple(2, alpaca.id));
    });

    // Create some breeding records
    for (let i = 0; i < Math.floor(size / 3); i++) {
      const sire = alpacas.find(a => a.gender === 'male');
      const dam = alpacas.find(a => a.gender === 'female');
      if (sire && dam) {
        breedingRecords.push(BreedingRecordFactory.createForAlpacas(sire.id, dam.id));
      }
    }

    // Create management activities
    activities.push(ManagementActivityFactory.createForAlpacas(alpacas.map(a => a.id)));
    activities.push(...ManagementActivityFactory.createMultiple(3));

    return { alpacas, healthRecords, breedingRecords, activities };
  }
}