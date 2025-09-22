/**
 * Unit tests for ManagementActivity model
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ManagementActivityModel, 
  ManagementActivityValidation, 
  ManagementActivity, 
  CreateManagementActivityInput, 
  UpdateManagementActivityInput 
} from '../management-activity';
import { ActivityType } from '../common';
import { 
  ManagementActivityFactory
} from '../../__tests__/data-factories';
import { 
  generateTestUUID, 
  generateTestDate,
  generateFutureTestDate,
  MockUtils,
  TestAssertions,
  createMockDate
} from '../../__tests__/test-utils';

describe('ManagementActivityModel', () => {
  let activityData: ManagementActivity;
  let activityModel: ManagementActivityModel;

  beforeEach(() => {
    MockUtils.clearAllMocks();
    activityData = ManagementActivityFactory.create();
    activityModel = new ManagementActivityModel(activityData);
  });

  describe('constructor', () => {
    it('should create a management activity model with all properties', () => {
      expect(activityModel.id).toBe(activityData.id);
      expect(activityModel.activityType).toBe(activityData.activityType);
      expect(activityModel.date).toBe(activityData.date);
      expect(activityModel.alpacaIds).toEqual(activityData.alpacaIds);
      expect(activityModel.performedBy).toBe(activityData.performedBy);
      expect(activityModel.description).toBe(activityData.description);
      expect(activityModel.notes).toBe(activityData.notes);
      expect(activityModel.createdAt).toBe(activityData.createdAt);
      expect(activityModel.updatedAt).toBe(activityData.updatedAt);
    });

    it('should create a copy of alpaca IDs array to prevent mutation', () => {
      const originalAlpacaIds = ['alpaca1', 'alpaca2'];
      const dataWithAlpacas = { ...activityData, alpacaIds: originalAlpacaIds };
      const model = new ManagementActivityModel(dataWithAlpacas);

      expect(model.alpacaIds).toEqual(originalAlpacaIds);
      expect(model.alpacaIds).not.toBe(originalAlpacaIds); // Should be a copy
    });

    it('should initialize empty alpaca array when not provided', () => {
      const dataWithoutAlpacas = { ...activityData, alpacaIds: undefined };
      const model = new ManagementActivityModel(dataWithoutAlpacas as ManagementActivity);

      expect(model.alpacaIds).toEqual([]);
    });

    it('should handle all activity types correctly', () => {
      const activityTypes: ActivityType[] = ['feeding', 'shearing', 'weighing', 'moving', 'training', 'other'];
      
      activityTypes.forEach(activityType => {
        const data = { ...activityData, activityType };
        const model = new ManagementActivityModel(data);
        expect(model.activityType).toBe(activityType);
      });
    });
  });

  describe('validate', () => {
    it('should return valid result for valid management activity data', () => {
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for activity with invalid activity type', () => {
      activityModel.activityType = 'invalid' as ActivityType;
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Activity type must be one of:');
    });

    it('should return invalid result for activity with future date', () => {
      const futureDate = generateFutureTestDate(1);
      activityModel.date = futureDate;
      
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Date must be a valid date not in the future'])).toBe(true);
    });

    it('should return invalid result for activity with empty alpaca IDs', () => {
      activityModel.alpacaIds = [];
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['At least one alpaca ID is required'])).toBe(true);
    });

    it('should return invalid result for activity with invalid alpaca ID', () => {
      activityModel.alpacaIds = ['invalid-uuid'];
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Invalid alpaca ID: invalid-uuid');
    });

    it('should return invalid result for activity with duplicate alpaca IDs', () => {
      const duplicateId = generateTestUUID();
      activityModel.alpacaIds = [duplicateId, duplicateId];
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Duplicate alpaca IDs are not allowed'])).toBe(true);
    });

    it('should return invalid result for activity with empty performed by', () => {
      activityModel.performedBy = '';
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Performed by is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for activity with whitespace-only performed by', () => {
      activityModel.performedBy = '   ';
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Performed by is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for activity with empty description', () => {
      activityModel.description = '';
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Description is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for activity with whitespace-only description', () => {
      activityModel.description = '   ';
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Description is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for empty notes when provided', () => {
      activityModel.notes = '   ';
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationFailure(result, ['Notes must be non-empty if provided'])).toBe(true);
    });

    it('should return valid result when notes are undefined', () => {
      activityModel.notes = undefined;
      const result = activityModel.validate();
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });
  });

  describe('update', () => {
    it('should update management activity with valid data and return success', () => {
      const originalUpdatedAt = activityModel.updatedAt;
      vi.setSystemTime(new Date('2024-02-01T00:00:00Z'));
      
      const updates: UpdateManagementActivityInput = {
        description: 'Updated description',
        performedBy: 'Updated performer',
        notes: 'Updated notes'
      };
      
      const result = activityModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(activityModel.description).toBe('Updated description');
      expect(activityModel.performedBy).toBe('Updated performer');
      expect(activityModel.notes).toBe('Updated notes');
      expect(activityModel.updatedAt).not.toBe(originalUpdatedAt);
      
      vi.useRealTimers();
    });

    it('should not update management activity with invalid data and return failure', () => {
      const originalDescription = activityModel.description;
      const originalPerformedBy = activityModel.performedBy;
      const originalUpdatedAt = activityModel.updatedAt;
      
      const updates: UpdateManagementActivityInput = {
        description: '',
        performedBy: ''
      };
      
      const result = activityModel.update(updates);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(activityModel.description).toBe(originalDescription); // Should not change
      expect(activityModel.performedBy).toBe(originalPerformedBy); // Should not change
      expect(activityModel.updatedAt).toBe(originalUpdatedAt); // Should not change
      expect(result.errors).toContain('Description must be non-empty if provided');
      expect(result.errors).toContain('Performed by must be non-empty if provided');
    });

    it('should update alpaca IDs array correctly', () => {
      const newAlpacaIds = [generateTestUUID(), generateTestUUID()];
      const updates: UpdateManagementActivityInput = {
        alpacaIds: newAlpacaIds
      };
      
      const result = activityModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(activityModel.alpacaIds).toEqual(newAlpacaIds);
      expect(activityModel.alpacaIds).not.toBe(newAlpacaIds); // Should be a copy
    });

    it('should update activity type correctly', () => {
      const updates: UpdateManagementActivityInput = {
        activityType: 'shearing'
      };
      
      const result = activityModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(activityModel.activityType).toBe('shearing');
    });

    it('should update date correctly', () => {
      const newDate = generateTestDate(0.5);
      const updates: UpdateManagementActivityInput = {
        date: newDate
      };
      
      const result = activityModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(activityModel.date).toBe(newDate);
    });

    it('should handle partial updates correctly', () => {
      const originalDescription = activityModel.description;
      const updates: UpdateManagementActivityInput = {
        performedBy: 'New performer'
      };
      
      const result = activityModel.update(updates);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(activityModel.performedBy).toBe('New performer');
      expect(activityModel.description).toBe(originalDescription); // Should remain unchanged
    });

    it('should validate future date in updates', () => {
      const futureDate = generateFutureTestDate(1);
      const updates: UpdateManagementActivityInput = {
        date: futureDate
      };
      
      const result = activityModel.update(updates);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors).toContain('Date must be a valid date not in the future if provided');
    });

    it('should validate invalid activity type in updates', () => {
      const updates: UpdateManagementActivityInput = {
        activityType: 'invalid' as ActivityType
      };
      
      const result = activityModel.update(updates);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Activity type must be one of:');
    });
  });

  describe('addAlpaca', () => {
    it('should add valid alpaca ID successfully', () => {
      const alpacaId = generateTestUUID();
      const originalCount = activityModel.alpacaIds.length;
      
      const result = activityModel.addAlpaca(alpacaId);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(activityModel.alpacaIds).toContain(alpacaId);
      expect(activityModel.alpacaIds.length).toBe(originalCount + 1);
      expect(activityModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should return error for invalid alpaca ID', () => {
      const originalAlpacaIds = [...activityModel.alpacaIds];
      const result = activityModel.addAlpaca('invalid-uuid');
      
      expect(TestAssertions.isValidationFailure(result, ['Alpaca ID must be a valid UUID'])).toBe(true);
      expect(activityModel.alpacaIds).toEqual(originalAlpacaIds); // Should not change
    });

    it('should return error when adding duplicate alpaca', () => {
      const alpacaId = generateTestUUID();
      activityModel.alpacaIds = [alpacaId];
      
      const result = activityModel.addAlpaca(alpacaId);
      
      expect(TestAssertions.isValidationFailure(result, ['Alpaca is already associated with this activity'])).toBe(true);
      expect(activityModel.alpacaIds.filter(id => id === alpacaId)).toHaveLength(1);
    });

    it('should update updatedAt timestamp on successful addition', () => {
      const originalUpdatedAt = activityModel.updatedAt;
      vi.setSystemTime(new Date('2024-02-01T00:00:00Z'));
      
      const alpacaId = generateTestUUID();
      activityModel.addAlpaca(alpacaId);
      
      expect(activityModel.updatedAt).not.toBe(originalUpdatedAt);
      
      vi.useRealTimers();
    });
  });

  describe('removeAlpaca', () => {
    it('should remove existing alpaca ID successfully when multiple alpacas exist', () => {
      const alpaca1 = generateTestUUID();
      const alpaca2 = generateTestUUID();
      activityModel.alpacaIds = [alpaca1, alpaca2];
      
      const result = activityModel.removeAlpaca(alpaca1);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(activityModel.alpacaIds).toEqual([alpaca2]);
      expect(activityModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should return error when removing non-existent alpaca', () => {
      const originalAlpacaIds = [...activityModel.alpacaIds];
      const alpacaId = generateTestUUID();
      
      const result = activityModel.removeAlpaca(alpacaId);
      
      expect(TestAssertions.isValidationFailure(result, ['Alpaca is not associated with this activity'])).toBe(true);
      expect(activityModel.alpacaIds).toEqual(originalAlpacaIds); // Should not change
    });

    it('should return error when trying to remove the last alpaca', () => {
      const alpacaId = generateTestUUID();
      activityModel.alpacaIds = [alpacaId];
      
      const result = activityModel.removeAlpaca(alpacaId);
      
      expect(TestAssertions.isValidationFailure(result, ['Activity must have at least one alpaca associated'])).toBe(true);
      expect(activityModel.alpacaIds).toEqual([alpacaId]); // Should remain unchanged
    });

    it('should update updatedAt timestamp on successful removal', () => {
      const alpaca1 = generateTestUUID();
      const alpaca2 = generateTestUUID();
      activityModel.alpacaIds = [alpaca1, alpaca2];
      
      const originalUpdatedAt = activityModel.updatedAt;
      vi.setSystemTime(new Date('2024-02-01T00:00:00Z'));
      
      activityModel.removeAlpaca(alpaca1);
      
      expect(activityModel.updatedAt).not.toBe(originalUpdatedAt);
      
      vi.useRealTimers();
    });

    it('should handle removal from middle of array correctly', () => {
      const alpaca1 = generateTestUUID();
      const alpaca2 = generateTestUUID();
      const alpaca3 = generateTestUUID();
      activityModel.alpacaIds = [alpaca1, alpaca2, alpaca3];
      
      const result = activityModel.removeAlpaca(alpaca2);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(activityModel.alpacaIds).toEqual([alpaca1, alpaca3]);
    });
  });

  describe('addAlpacasBulk', () => {
    it('should add multiple valid alpaca IDs successfully', () => {
      const newAlpacaIds = [generateTestUUID(), generateTestUUID()];
      const originalCount = activityModel.alpacaIds.length;
      
      const result = activityModel.addAlpacasBulk(newAlpacaIds);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      newAlpacaIds.forEach(id => {
        expect(activityModel.alpacaIds).toContain(id);
      });
      expect(activityModel.alpacaIds.length).toBe(originalCount + newAlpacaIds.length);
      expect(activityModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should return error for invalid bulk operation input', () => {
      const originalAlpacaIds = [...activityModel.alpacaIds];
      const result = activityModel.addAlpacasBulk(['invalid-uuid']);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(activityModel.alpacaIds).toEqual(originalAlpacaIds); // Should not change
    });

    it('should return error when some alpacas are already associated', () => {
      const existingAlpaca = generateTestUUID();
      const newAlpaca = generateTestUUID();
      activityModel.alpacaIds = [existingAlpaca];
      
      const result = activityModel.addAlpacasBulk([existingAlpaca, newAlpaca]);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain(`Alpaca ${existingAlpaca} is already associated with this activity`);
      expect(activityModel.alpacaIds).not.toContain(newAlpaca); // Should not add any if validation fails
    });

    it('should add only new alpacas when validation passes', () => {
      const existingAlpaca = generateTestUUID();
      const newAlpacas = [generateTestUUID(), generateTestUUID()];
      activityModel.alpacaIds = [existingAlpaca];
      
      const result = activityModel.addAlpacasBulk(newAlpacas);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      expect(activityModel.alpacaIds).toEqual([existingAlpaca, ...newAlpacas]);
    });

    it('should handle empty array input', () => {
      const originalAlpacaIds = [...activityModel.alpacaIds];
      const result = activityModel.addAlpacasBulk([]);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(activityModel.alpacaIds).toEqual(originalAlpacaIds);
    });

    it('should update updatedAt timestamp on successful bulk addition', () => {
      const originalUpdatedAt = activityModel.updatedAt;
      vi.setSystemTime(new Date('2024-02-01T00:00:00Z'));
      
      const newAlpacaIds = [generateTestUUID(), generateTestUUID()];
      activityModel.addAlpacasBulk(newAlpacaIds);
      
      expect(activityModel.updatedAt).not.toBe(originalUpdatedAt);
      
      vi.useRealTimers();
    });
  });

  describe('getAlpacaCount', () => {
    it('should return correct count of alpacas', () => {
      const alpacaIds = [generateTestUUID(), generateTestUUID(), generateTestUUID()];
      activityModel.alpacaIds = alpacaIds;
      
      const count = activityModel.getAlpacaCount();
      
      expect(count).toBe(3);
    });

    it('should return 0 when no alpacas are associated', () => {
      activityModel.alpacaIds = [];
      
      const count = activityModel.getAlpacaCount();
      
      expect(count).toBe(0);
    });

    it('should return 1 for single alpaca activity', () => {
      activityModel.alpacaIds = [generateTestUUID()];
      
      const count = activityModel.getAlpacaCount();
      
      expect(count).toBe(1);
    });
  });

  describe('isBulkActivity', () => {
    it('should return true when multiple alpacas are involved', () => {
      activityModel.alpacaIds = [generateTestUUID(), generateTestUUID()];
      
      const isBulk = activityModel.isBulkActivity();
      
      expect(isBulk).toBe(true);
    });

    it('should return false when only one alpaca is involved', () => {
      activityModel.alpacaIds = [generateTestUUID()];
      
      const isBulk = activityModel.isBulkActivity();
      
      expect(isBulk).toBe(false);
    });

    it('should return false when no alpacas are involved', () => {
      activityModel.alpacaIds = [];
      
      const isBulk = activityModel.isBulkActivity();
      
      expect(isBulk).toBe(false);
    });

    it('should return true for large bulk activities', () => {
      const manyAlpacas = Array.from({ length: 10 }, () => generateTestUUID());
      activityModel.alpacaIds = manyAlpacas;
      
      const isBulk = activityModel.isBulkActivity();
      
      expect(isBulk).toBe(true);
    });
  });

  describe('involvesAlpaca', () => {
    it('should return true when alpaca is involved in activity', () => {
      const alpacaId = generateTestUUID();
      activityModel.alpacaIds = [alpacaId, generateTestUUID()];
      
      const involves = activityModel.involvesAlpaca(alpacaId);
      
      expect(involves).toBe(true);
    });

    it('should return false when alpaca is not involved in activity', () => {
      const alpacaId = generateTestUUID();
      activityModel.alpacaIds = [generateTestUUID(), generateTestUUID()];
      
      const involves = activityModel.involvesAlpaca(alpacaId);
      
      expect(involves).toBe(false);
    });

    it('should return true when alpaca is the only one involved', () => {
      const alpacaId = generateTestUUID();
      activityModel.alpacaIds = [alpacaId];
      
      const involves = activityModel.involvesAlpaca(alpacaId);
      
      expect(involves).toBe(true);
    });

    it('should return false for empty alpaca list', () => {
      const alpacaId = generateTestUUID();
      activityModel.alpacaIds = [];
      
      const involves = activityModel.involvesAlpaca(alpacaId);
      
      expect(involves).toBe(false);
    });
  });

  describe('getActivityAge', () => {
    it('should calculate correct age in days', () => {
      // Mock current date to 2024-01-11
      vi.setSystemTime(new Date('2024-01-11T00:00:00Z'));
      
      // Set activity date to 2024-01-01 (10 days ago)
      activityModel.date = new Date('2024-01-01T00:00:00Z');
      
      const age = activityModel.getActivityAge();
      
      expect(age).toBe(10);
      
      vi.useRealTimers();
    });

    it('should return 0 for activity on the same day', () => {
      const sameDate = new Date('2024-01-01T00:00:00Z');
      
      // Mock current date
      vi.setSystemTime(sameDate);
      
      activityModel.date = sameDate;
      
      const age = activityModel.getActivityAge();
      
      expect(age).toBe(0);
      
      vi.useRealTimers();
    });

    it('should handle partial days correctly', () => {
      // Mock current date to 2024-01-01 18:00
      vi.setSystemTime(new Date('2024-01-01T18:00:00Z'));
      
      // Set activity date to 2024-01-01 06:00 (12 hours ago, same day)
      activityModel.date = new Date('2024-01-01T06:00:00Z');
      
      const age = activityModel.getActivityAge();
      
      expect(age).toBe(0); // Should be 0 for same day
      
      vi.useRealTimers();
    });

    it('should handle activities from different months', () => {
      // Mock current date to 2024-02-15
      vi.setSystemTime(new Date('2024-02-15T00:00:00Z'));
      
      // Set activity date to 2024-01-15 (31 days ago)
      activityModel.date = new Date('2024-01-15T00:00:00Z');
      
      const age = activityModel.getActivityAge();
      
      expect(age).toBe(31);
      
      vi.useRealTimers();
    });

    it('should handle activities from different years', () => {
      // Mock current date to 2024-01-01
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      
      // Set activity date to 2023-12-31 (1 day ago)
      activityModel.date = new Date('2023-12-31T00:00:00Z');
      
      const age = activityModel.getActivityAge();
      
      expect(age).toBe(1);
      
      vi.useRealTimers();
    });
  });

  describe('isRecent', () => {
    it('should return true for activity within default 7 days', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-08T00:00:00Z'));
      
      // Set activity date to 5 days ago
      activityModel.date = new Date('2024-01-03T00:00:00Z');
      
      const isRecent = activityModel.isRecent();
      
      expect(isRecent).toBe(true);
      
      vi.useRealTimers();
    });

    it('should return false for activity older than default 7 days', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-15T00:00:00Z'));
      
      // Set activity date to 10 days ago
      activityModel.date = new Date('2024-01-05T00:00:00Z');
      
      const isRecent = activityModel.isRecent();
      
      expect(isRecent).toBe(false);
      
      vi.useRealTimers();
    });

    it('should return true for activity within custom days threshold', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-16T00:00:00Z'));
      
      // Set activity date to 10 days ago
      activityModel.date = new Date('2024-01-06T00:00:00Z');
      
      const isRecent = activityModel.isRecent(15); // Custom 15-day threshold
      
      expect(isRecent).toBe(true);
      
      vi.useRealTimers();
    });

    it('should return false for activity older than custom days threshold', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-16T00:00:00Z'));
      
      // Set activity date to 10 days ago
      activityModel.date = new Date('2024-01-06T00:00:00Z');
      
      const isRecent = activityModel.isRecent(5); // Custom 5-day threshold
      
      expect(isRecent).toBe(false);
      
      vi.useRealTimers();
    });

    it('should return true for activity exactly at threshold', () => {
      // Mock current date
      vi.setSystemTime(new Date('2024-01-08T00:00:00Z'));
      
      // Set activity date to exactly 7 days ago
      activityModel.date = new Date('2024-01-01T00:00:00Z');
      
      const isRecent = activityModel.isRecent(7);
      
      expect(isRecent).toBe(true);
      
      vi.useRealTimers();
    });

    it('should return true for activity on same day', () => {
      const today = new Date('2024-01-01T00:00:00Z');
      vi.setSystemTime(today);
      
      activityModel.date = today;
      
      const isRecent = activityModel.isRecent();
      
      expect(isRecent).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('validateAlpacaRelationships', () => {
    it('should return valid result when all alpacas exist', () => {
      const alpaca1 = generateTestUUID();
      const alpaca2 = generateTestUUID();
      activityModel.alpacaIds = [alpaca1, alpaca2];
      
      const result = activityModel.validateAlpacaRelationships([alpaca1, alpaca2]);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result when some alpacas do not exist', () => {
      const alpaca1 = generateTestUUID();
      const alpaca2 = generateTestUUID();
      const alpaca3 = generateTestUUID();
      activityModel.alpacaIds = [alpaca1, alpaca2, alpaca3];
      
      const result = activityModel.validateAlpacaRelationships([alpaca1]); // Only alpaca1 exists
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain(`Alpaca with ID ${alpaca2} does not exist`);
      expect(result.errors[1]).toContain(`Alpaca with ID ${alpaca3} does not exist`);
    });

    it('should return invalid result when no alpacas exist', () => {
      const alpaca1 = generateTestUUID();
      activityModel.alpacaIds = [alpaca1];
      
      const result = activityModel.validateAlpacaRelationships([]); // No alpacas exist
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain(`Alpaca with ID ${alpaca1} does not exist`);
    });

    it('should return valid result when activity has no alpacas', () => {
      activityModel.alpacaIds = [];
      
      const result = activityModel.validateAlpacaRelationships([generateTestUUID()]);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should handle large lists of alpacas correctly', () => {
      const manyAlpacas = Array.from({ length: 10 }, () => generateTestUUID());
      activityModel.alpacaIds = manyAlpacas;
      
      const result = activityModel.validateAlpacaRelationships(manyAlpacas);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return correct summary for single alpaca activity', () => {
      activityModel.activityType = 'feeding';
      activityModel.alpacaIds = [generateTestUUID()];
      activityModel.date = new Date('2024-06-15T12:00:00Z');
      
      const summary = activityModel.getSummary();
      
      expect(summary).toContain('feeding activity for 1 alpaca on');
      expect(summary).toContain('2024');
    });

    it('should return correct summary for multiple alpaca activity', () => {
      activityModel.activityType = 'shearing';
      activityModel.alpacaIds = [generateTestUUID(), generateTestUUID(), generateTestUUID()];
      activityModel.date = new Date('2024-01-15');
      
      const summary = activityModel.getSummary();
      
      expect(summary).toContain('shearing activity for 3 alpacas on');
      expect(summary).toContain('2024');
    });

    it('should handle different activity types correctly', () => {
      const activityTypes: ActivityType[] = ['feeding', 'shearing', 'weighing', 'moving', 'training', 'other'];
      
      activityTypes.forEach(activityType => {
        activityModel.activityType = activityType;
        activityModel.alpacaIds = [generateTestUUID()];
        activityModel.date = new Date('2024-01-01');
        
        const summary = activityModel.getSummary();
        
        expect(summary).toContain(activityType);
        expect(summary).toContain('1 alpaca');
      });
    });

    it('should use correct singular/plural form for alpaca count', () => {
      // Test singular
      activityModel.alpacaIds = [generateTestUUID()];
      let summary = activityModel.getSummary();
      expect(summary).toContain('1 alpaca');
      expect(summary).not.toContain('alpacas');
      
      // Test plural
      activityModel.alpacaIds = [generateTestUUID(), generateTestUUID()];
      summary = activityModel.getSummary();
      expect(summary).toContain('2 alpacas');
      expect(summary).not.toContain('2 alpaca ');
    });

    it('should handle zero alpacas correctly', () => {
      activityModel.alpacaIds = [];
      activityModel.date = new Date('2024-01-01');
      
      const summary = activityModel.getSummary();
      
      expect(summary).toContain('0 alpacas');
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with all management activity properties', () => {
      const json = activityModel.toJSON();
      
      expect(json).toEqual({
        id: activityModel.id,
        activityType: activityModel.activityType,
        date: activityModel.date,
        alpacaIds: activityModel.alpacaIds,
        performedBy: activityModel.performedBy,
        description: activityModel.description,
        notes: activityModel.notes,
        createdAt: activityModel.createdAt,
        updatedAt: activityModel.updatedAt
      });
    });

    it('should return object without methods', () => {
      const json = activityModel.toJSON();
      
      expect(typeof json.validate).toBe('undefined');
      expect(typeof json.update).toBe('undefined');
      expect(typeof json.addAlpaca).toBe('undefined');
      expect(typeof json.removeAlpaca).toBe('undefined');
      expect(typeof json.addAlpacasBulk).toBe('undefined');
      expect(typeof json.getAlpacaCount).toBe('undefined');
      expect(typeof json.isBulkActivity).toBe('undefined');
      expect(typeof json.involvesAlpaca).toBe('undefined');
      expect(typeof json.getActivityAge).toBe('undefined');
      expect(typeof json.isRecent).toBe('undefined');
      expect(typeof json.getSummary).toBe('undefined');
    });

    it('should create a copy of alpaca IDs array to prevent mutation', () => {
      const json = activityModel.toJSON();
      
      expect(json.alpacaIds).toEqual(activityModel.alpacaIds);
      expect(json.alpacaIds).not.toBe(activityModel.alpacaIds); // Should be a copy
    });

    it('should handle undefined optional properties', () => {
      activityModel.notes = undefined;
      
      const json = activityModel.toJSON();
      
      expect(json.notes).toBeUndefined();
    });

    it('should preserve all data types correctly', () => {
      const json = activityModel.toJSON();
      
      expect(typeof json.id).toBe('string');
      expect(typeof json.activityType).toBe('string');
      expect(json.date).toBeInstanceOf(Date);
      expect(Array.isArray(json.alpacaIds)).toBe(true);
      expect(typeof json.performedBy).toBe('string');
      expect(typeof json.description).toBe('string');
      expect(json.createdAt).toBeInstanceOf(Date);
      expect(json.updatedAt).toBeInstanceOf(Date);
    });
  });
});

describe('ManagementActivityValidation', () => {
  describe('validateCreateInput', () => {
    let validInput: CreateManagementActivityInput;

    beforeEach(() => {
      validInput = ManagementActivityFactory.createInput();
    });

    it('should return valid result for valid create input', () => {
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for invalid activity type', () => {
      validInput.activityType = 'invalid' as ActivityType;
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Activity type must be one of:');
    });

    it('should validate all valid activity types', () => {
      const validActivityTypes: ActivityType[] = ['feeding', 'shearing', 'weighing', 'moving', 'training', 'other'];
      
      validActivityTypes.forEach(activityType => {
        validInput.activityType = activityType;
        const result = ManagementActivityValidation.validateCreateInput(validInput);
        expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      });
    });

    it('should return invalid result for future date', () => {
      const futureDate = generateFutureTestDate(1);
      validInput.date = futureDate;
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Date must be a valid date not in the future'])).toBe(true);
    });

    it('should return valid result for current date', () => {
      validInput.date = new Date();
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return valid result for past date', () => {
      validInput.date = generateTestDate(1);
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty alpaca IDs array', () => {
      validInput.alpacaIds = [];
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['At least one alpaca ID is required'])).toBe(true);
    });

    it('should return invalid result for undefined alpaca IDs', () => {
      validInput.alpacaIds = undefined as any;
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['At least one alpaca ID is required'])).toBe(true);
    });

    it('should return invalid result for invalid alpaca ID in array', () => {
      validInput.alpacaIds = [generateTestUUID(), 'invalid-uuid'];
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Invalid alpaca ID: invalid-uuid');
    });

    it('should return invalid result for multiple invalid alpaca IDs', () => {
      validInput.alpacaIds = ['invalid-1', 'invalid-2'];
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.some(error => error.includes('invalid-1'))).toBe(true);
      expect(result.errors.some(error => error.includes('invalid-2'))).toBe(true);
    });

    it('should return invalid result for duplicate alpaca IDs', () => {
      const duplicateId = generateTestUUID();
      validInput.alpacaIds = [duplicateId, duplicateId];
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Duplicate alpaca IDs are not allowed'])).toBe(true);
    });

    it('should return invalid result for multiple duplicate alpaca IDs', () => {
      const duplicateId1 = generateTestUUID();
      const duplicateId2 = generateTestUUID();
      validInput.alpacaIds = [duplicateId1, duplicateId2, duplicateId1, duplicateId2];
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Duplicate alpaca IDs are not allowed'])).toBe(true);
    });

    it('should return valid result for single alpaca ID', () => {
      validInput.alpacaIds = [generateTestUUID()];
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return valid result for multiple unique alpaca IDs', () => {
      validInput.alpacaIds = [generateTestUUID(), generateTestUUID(), generateTestUUID()];
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty performed by', () => {
      validInput.performedBy = '';
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Performed by is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for whitespace-only performed by', () => {
      validInput.performedBy = '   ';
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Performed by is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for undefined performed by', () => {
      validInput.performedBy = undefined as any;
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Performed by is required and must be non-empty'])).toBe(true);
    });

    it('should return valid result for valid performed by', () => {
      validInput.performedBy = 'John Doe';
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty description', () => {
      validInput.description = '';
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Description is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for whitespace-only description', () => {
      validInput.description = '   ';
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Description is required and must be non-empty'])).toBe(true);
    });

    it('should return invalid result for undefined description', () => {
      validInput.description = undefined as any;
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Description is required and must be non-empty'])).toBe(true);
    });

    it('should return valid result for valid description', () => {
      validInput.description = 'Daily feeding activity';
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty notes when provided', () => {
      validInput.notes = '   ';
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Notes must be non-empty if provided'])).toBe(true);
    });

    it('should return valid result when notes are undefined', () => {
      validInput.notes = undefined;
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return valid result for valid notes', () => {
      validInput.notes = 'Activity completed successfully';
      
      const result = ManagementActivityValidation.validateCreateInput(validInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should handle minimal valid input', () => {
      const minimalInput: CreateManagementActivityInput = {
        activityType: 'feeding',
        date: generateTestDate(0.1),
        alpacaIds: [generateTestUUID()],
        performedBy: 'John Doe',
        description: 'Daily feeding'
      };
      
      const result = ManagementActivityValidation.validateCreateInput(minimalInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should accumulate multiple validation errors', () => {
      const invalidInput: CreateManagementActivityInput = {
        activityType: 'invalid' as ActivityType,
        date: generateFutureTestDate(1),
        alpacaIds: [],
        performedBy: '',
        description: '',
        notes: '   '
      };
      
      const result = ManagementActivityValidation.validateCreateInput(invalidInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(4);
      expect(result.errors.some(error => error.includes('Activity type'))).toBe(true);
      expect(result.errors.some(error => error.includes('Date must be'))).toBe(true);
      expect(result.errors.some(error => error.includes('At least one alpaca'))).toBe(true);
      expect(result.errors.some(error => error.includes('Performed by'))).toBe(true);
      expect(result.errors.some(error => error.includes('Description'))).toBe(true);
      expect(result.errors.some(error => error.includes('Notes must be'))).toBe(true);
    });

    it('should validate complex scenarios with mixed valid and invalid data', () => {
      const mixedInput: CreateManagementActivityInput = {
        activityType: 'feeding', // Valid
        date: generateFutureTestDate(1), // Invalid - future date
        alpacaIds: [generateTestUUID(), 'invalid-uuid'], // Mixed - one valid, one invalid
        performedBy: 'John Doe', // Valid
        description: '', // Invalid - empty
        notes: 'Valid notes' // Valid
      };
      
      const result = ManagementActivityValidation.validateCreateInput(mixedInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBe(3); // Future date, invalid UUID, empty description
    });
  });

  describe('validateUpdateInput', () => {
    it('should return valid result for valid update input', () => {
      const updateInput: UpdateManagementActivityInput = {
        description: 'Updated description',
        performedBy: 'Updated performer',
        notes: 'Updated notes'
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return valid result for empty update input', () => {
      const updateInput: UpdateManagementActivityInput = {};
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for invalid activity type when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        activityType: 'invalid' as ActivityType
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Activity type must be one of:');
    });

    it('should return valid result for valid activity type when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        activityType: 'shearing'
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for future date when provided', () => {
      const futureDate = generateFutureTestDate(1);
      
      const updateInput: UpdateManagementActivityInput = {
        date: futureDate
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Date must be a valid date not in the future if provided'])).toBe(true);
    });

    it('should return valid result for valid date when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        date: generateTestDate(0.5)
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty alpaca IDs array when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        alpacaIds: []
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['At least one alpaca ID is required if alpaca IDs are provided'])).toBe(true);
    });

    it('should return valid result for valid alpaca IDs when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        alpacaIds: [generateTestUUID(), generateTestUUID()]
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for invalid alpaca ID when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        alpacaIds: [generateTestUUID(), 'invalid-uuid']
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Invalid alpaca ID: invalid-uuid');
    });

    it('should return invalid result for duplicate alpaca IDs when provided', () => {
      const duplicateId = generateTestUUID();
      const updateInput: UpdateManagementActivityInput = {
        alpacaIds: [duplicateId, duplicateId]
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Duplicate alpaca IDs are not allowed'])).toBe(true);
    });

    it('should return invalid result for empty performed by when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        performedBy: ''
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Performed by must be non-empty if provided'])).toBe(true);
    });

    it('should return invalid result for whitespace-only performed by when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        performedBy: '   '
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Performed by must be non-empty if provided'])).toBe(true);
    });

    it('should return valid result for valid performed by when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        performedBy: 'Jane Smith'
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty description when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        description: ''
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Description must be non-empty if provided'])).toBe(true);
    });

    it('should return invalid result for whitespace-only description when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        description: '   '
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Description must be non-empty if provided'])).toBe(true);
    });

    it('should return valid result for valid description when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        description: 'Updated activity description'
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty notes when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        notes: '   '
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result, ['Notes must be non-empty if provided'])).toBe(true);
    });

    it('should return valid result for valid notes when provided', () => {
      const updateInput: UpdateManagementActivityInput = {
        notes: 'Updated notes'
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should handle partial updates with mixed valid and invalid fields', () => {
      const updateInput: UpdateManagementActivityInput = {
        activityType: 'weighing', // Valid
        date: generateFutureTestDate(1), // Invalid
        description: 'Valid description', // Valid
        performedBy: '' // Invalid
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(updateInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBe(2); // Future date and empty performedBy
      expect(result.errors.some(error => error.includes('Date must be'))).toBe(true);
      expect(result.errors.some(error => error.includes('Performed by'))).toBe(true);
    });

    it('should validate all activity types when provided', () => {
      const validActivityTypes: ActivityType[] = ['feeding', 'shearing', 'weighing', 'moving', 'training', 'other'];
      
      validActivityTypes.forEach(activityType => {
        const updateInput: UpdateManagementActivityInput = { activityType };
        const result = ManagementActivityValidation.validateUpdateInput(updateInput);
        expect(TestAssertions.isValidationSuccess(result)).toBe(true);
      });
    });

    it('should accumulate multiple validation errors in updates', () => {
      const invalidUpdateInput: UpdateManagementActivityInput = {
        activityType: 'invalid' as ActivityType,
        date: generateFutureTestDate(1),
        alpacaIds: ['invalid-uuid'],
        performedBy: '',
        description: '',
        notes: '   '
      };
      
      const result = ManagementActivityValidation.validateUpdateInput(invalidUpdateInput);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(4);
    });
  });

  describe('validateBulkOperation', () => {
    it('should return valid result for valid bulk operation', () => {
      const alpacaIds = [generateTestUUID(), generateTestUUID(), generateTestUUID()];
      
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for empty alpaca IDs array', () => {
      const result = ManagementActivityValidation.validateBulkOperation([]);
      
      expect(TestAssertions.isValidationFailure(result, ['At least one alpaca ID is required for bulk operations'])).toBe(true);
    });

    it('should return invalid result for undefined alpaca IDs', () => {
      const result = ManagementActivityValidation.validateBulkOperation(undefined as any);
      
      expect(TestAssertions.isValidationFailure(result, ['At least one alpaca ID is required for bulk operations'])).toBe(true);
    });

    it('should return invalid result when exceeding max bulk size', () => {
      const manyAlpacaIds = Array.from({ length: 101 }, () => generateTestUUID());
      
      const result = ManagementActivityValidation.validateBulkOperation(manyAlpacaIds);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Bulk operations are limited to 100 alpacas at once');
    });

    it('should return valid result for max bulk size', () => {
      const maxAlpacaIds = Array.from({ length: 100 }, () => generateTestUUID());
      
      const result = ManagementActivityValidation.validateBulkOperation(maxAlpacaIds);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for custom max bulk size exceeded', () => {
      const alpacaIds = Array.from({ length: 6 }, () => generateTestUUID());
      
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds, 5);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Bulk operations are limited to 5 alpacas at once');
    });

    it('should return valid result for custom max bulk size', () => {
      const alpacaIds = Array.from({ length: 5 }, () => generateTestUUID());
      
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds, 5);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should return invalid result for invalid alpaca ID in bulk operation', () => {
      const alpacaIds = [generateTestUUID(), 'invalid-uuid', generateTestUUID()];
      
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors[0]).toContain('Invalid alpaca ID in bulk operation: invalid-uuid');
    });

    it('should return invalid result for multiple invalid alpaca IDs in bulk operation', () => {
      const alpacaIds = ['invalid-1', 'invalid-2'];
      
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.some(error => error.includes('invalid-1'))).toBe(true);
      expect(result.errors.some(error => error.includes('invalid-2'))).toBe(true);
    });

    it('should return invalid result for duplicate alpaca IDs in bulk operation', () => {
      const duplicateId = generateTestUUID();
      const alpacaIds = [duplicateId, generateTestUUID(), duplicateId];
      
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds);
      
      expect(TestAssertions.isValidationFailure(result, ['Duplicate alpaca IDs are not allowed in bulk operations'])).toBe(true);
    });

    it('should return valid result for single alpaca in bulk operation', () => {
      const alpacaIds = [generateTestUUID()];
      
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds);
      
      expect(TestAssertions.isValidationSuccess(result)).toBe(true);
    });

    it('should accumulate multiple validation errors in bulk operations', () => {
      const duplicateId = generateTestUUID();
      const alpacaIds = Array.from({ length: 101 }, (_, index) => 
        index === 0 ? duplicateId : 
        index === 1 ? duplicateId : 
        index === 2 ? 'invalid-uuid' : 
        generateTestUUID()
      );
      
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(2);
      expect(result.errors.some(error => error.includes('limited to 100'))).toBe(true);
      expect(result.errors.some(error => error.includes('invalid-uuid'))).toBe(true);
      expect(result.errors.some(error => error.includes('Duplicate alpaca IDs'))).toBe(true);
    });

    it('should handle edge case with exactly one duplicate and one invalid', () => {
      const duplicateId = generateTestUUID();
      const alpacaIds = [duplicateId, 'invalid-uuid', duplicateId];
      
      const result = ManagementActivityValidation.validateBulkOperation(alpacaIds);
      
      expect(TestAssertions.isValidationFailure(result)).toBe(true);
      expect(result.errors.length).toBe(2); // One for invalid UUID, one for duplicates
    });
  });
});