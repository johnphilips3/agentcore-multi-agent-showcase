/**
 * API Validation Utilities
 * Request validation functions for the Alpaca Herd Management API
 */

import { 
  CreateAlpacaRequest, 
  UpdateAlpacaRequest,
  CreateHealthRecordRequest,
  UpdateHealthRecordRequest,
  CreateBreedingRecordRequest,
  UpdateBreedingRecordRequest,
  CreateActivityRequest,
  UpdateActivityRequest,
  BulkActivityRequest,
  BreedingCompatibilityRequest,
  AlpacaSearchQuery,
  HealthRecordQuery,
  BreedingRecordQuery,
  ActivityQuery,
  PaginationQuery,
  ALPACA_GENDERS,
  HEALTH_RECORD_TYPES,
  ACTIVITY_TYPES,
  FIBER_CRIMP_TYPES,
  FIBER_DENSITY_TYPES,
  SORT_ORDERS,
  VALIDATION_LIMITS
} from './types.js';
import { ApiErrorClass, ValidationError } from './errors.js';

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * ISO date validation regex (YYYY-MM-DD)
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate UUID format
 */
export function validateUUID(value: string, field: string): void {
  if (!UUID_REGEX.test(value)) {
    throw ValidationError.uuidFormat(field, value);
  }
}

/**
 * Validate ISO date format
 */
export function validateISODate(value: string, field: string): void {
  if (!ISO_DATE_REGEX.test(value)) {
    throw ValidationError.dateFormat(field, value);
  }
  
  // Additional check to ensure it's a valid date
  const date = new Date(value);
  if (isNaN(date.getTime()) || date.toISOString().split('T')[0] !== value) {
    throw ValidationError.dateFormat(field, value);
  }
}

/**
 * Validate string length
 */
export function validateStringLength(value: string, field: string, min?: number, max?: number): void {
  if (min && value.length < min) {
    throw ValidationError.stringLength(field, value, min, max);
  }
  if (max && value.length > max) {
    throw ValidationError.stringLength(field, value, min, max);
  }
}

/**
 * Validate number range
 */
export function validateNumberRange(value: number, field: string, min?: number, max?: number): void {
  if (min !== undefined && value < min) {
    throw ValidationError.numberRange(field, value, min, max);
  }
  if (max !== undefined && value > max) {
    throw ValidationError.numberRange(field, value, min, max);
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends readonly string[]>(
  value: string, 
  field: string, 
  allowedValues: T
): void {
  if (!allowedValues.includes(value as any)) {
    throw ValidationError.enum(field, value, allowedValues);
  }
}

/**
 * Validate array minimum items
 */
export function validateArrayMinItems<T>(value: T[], field: string, minItems: number): void {
  if (value.length < minItems) {
    throw ValidationError.arrayMinItems(field, value, minItems);
  }
}

/**
 * Validate pagination query parameters
 */
export function validatePaginationQuery(query: PaginationQuery): void {
  if (query.page !== undefined) {
    if (!Number.isInteger(query.page) || query.page < 1) {
      throw ValidationError.numberRange('page', query.page, 1);
    }
  }

  if (query.limit !== undefined) {
    if (!Number.isInteger(query.limit) || query.limit < VALIDATION_LIMITS.PAGE_SIZE_MIN || query.limit > VALIDATION_LIMITS.PAGE_SIZE_MAX) {
      throw ValidationError.numberRange('limit', query.limit, VALIDATION_LIMITS.PAGE_SIZE_MIN, VALIDATION_LIMITS.PAGE_SIZE_MAX);
    }
  }

  if (query.sortOrder !== undefined) {
    validateEnum(query.sortOrder, 'sortOrder', SORT_ORDERS);
  }
}

/**
 * Validate CreateAlpacaRequest
 */
export function validateCreateAlpacaRequest(request: CreateAlpacaRequest): void {
  // Required fields
  if (!request.name) {
    throw ValidationError.required('name');
  }
  if (!request.birthDate) {
    throw ValidationError.required('birthDate');
  }
  if (!request.gender) {
    throw ValidationError.required('gender');
  }
  if (!request.color) {
    throw ValidationError.required('color');
  }

  // Field validations
  validateStringLength(request.name, 'name', 1, VALIDATION_LIMITS.ALPACA_NAME_MAX_LENGTH);
  validateISODate(request.birthDate, 'birthDate');
  validateEnum(request.gender, 'gender', ALPACA_GENDERS);
  validateStringLength(request.color, 'color', 1, VALIDATION_LIMITS.COLOR_MAX_LENGTH);

  // Optional field validations
  if (request.registrationNumber) {
    validateStringLength(request.registrationNumber, 'registrationNumber', 1, VALIDATION_LIMITS.REGISTRATION_NUMBER_MAX_LENGTH);
  }

  if (request.weight !== undefined) {
    validateNumberRange(request.weight, 'weight', 0, VALIDATION_LIMITS.WEIGHT_MAX);
  }

  if (request.height !== undefined) {
    validateNumberRange(request.height, 'height', 0, VALIDATION_LIMITS.HEIGHT_MAX);
  }

  if (request.fiberQuality) {
    validateFiberQuality(request.fiberQuality);
  }

  if (request.sireId) {
    validateUUID(request.sireId, 'sireId');
  }

  if (request.damId) {
    validateUUID(request.damId, 'damId');
  }

  // Business logic validations
  if (request.sireId && request.damId && request.sireId === request.damId) {
    throw ApiErrorClass.invalidRelationship('Sire and dam cannot be the same alpaca');
  }

  // Birth date cannot be in the future
  const birthDate = new Date(request.birthDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  if (birthDate > today) {
    throw ValidationError.futureDate('birthDate', request.birthDate);
  }
}

/**
 * Validate UpdateAlpacaRequest
 */
export function validateUpdateAlpacaRequest(request: UpdateAlpacaRequest): void {
  // All fields are optional for updates, but validate if present
  if (request.name !== undefined) {
    validateStringLength(request.name, 'name', 1, VALIDATION_LIMITS.ALPACA_NAME_MAX_LENGTH);
  }

  if (request.birthDate !== undefined) {
    validateISODate(request.birthDate, 'birthDate');
    const birthDate = new Date(request.birthDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (birthDate > today) {
      throw ValidationError.futureDate('birthDate', request.birthDate);
    }
  }

  if (request.gender !== undefined) {
    validateEnum(request.gender, 'gender', ALPACA_GENDERS);
  }

  if (request.color !== undefined) {
    validateStringLength(request.color, 'color', 1, VALIDATION_LIMITS.COLOR_MAX_LENGTH);
  }

  if (request.registrationNumber !== undefined) {
    validateStringLength(request.registrationNumber, 'registrationNumber', 1, VALIDATION_LIMITS.REGISTRATION_NUMBER_MAX_LENGTH);
  }

  if (request.weight !== undefined) {
    validateNumberRange(request.weight, 'weight', 0, VALIDATION_LIMITS.WEIGHT_MAX);
  }

  if (request.height !== undefined) {
    validateNumberRange(request.height, 'height', 0, VALIDATION_LIMITS.HEIGHT_MAX);
  }

  if (request.fiberQuality !== undefined) {
    validateFiberQuality(request.fiberQuality);
  }

  if (request.sireId !== undefined) {
    validateUUID(request.sireId, 'sireId');
  }

  if (request.damId !== undefined) {
    validateUUID(request.damId, 'damId');
  }

  // Business logic validations
  if (request.sireId && request.damId && request.sireId === request.damId) {
    throw ApiErrorClass.invalidRelationship('Sire and dam cannot be the same alpaca');
  }
}

/**
 * Validate fiber quality object
 */
function validateFiberQuality(fiberQuality: any): void {
  if (fiberQuality.micronCount !== undefined) {
    validateNumberRange(fiberQuality.micronCount, 'fiberQuality.micronCount', VALIDATION_LIMITS.FIBER_MICRON_MIN, VALIDATION_LIMITS.FIBER_MICRON_MAX);
  }

  if (fiberQuality.stapleLength !== undefined) {
    validateNumberRange(fiberQuality.stapleLength, 'fiberQuality.stapleLength', VALIDATION_LIMITS.FIBER_STAPLE_MIN, VALIDATION_LIMITS.FIBER_STAPLE_MAX);
  }

  if (fiberQuality.crimp !== undefined) {
    validateEnum(fiberQuality.crimp, 'fiberQuality.crimp', FIBER_CRIMP_TYPES);
  }

  if (fiberQuality.density !== undefined) {
    validateEnum(fiberQuality.density, 'fiberQuality.density', FIBER_DENSITY_TYPES);
  }
}

/**
 * Validate CreateHealthRecordRequest
 */
export function validateCreateHealthRecordRequest(request: CreateHealthRecordRequest): void {
  // Required fields
  if (!request.alpacaId) {
    throw ValidationError.required('alpacaId');
  }
  if (!request.recordType) {
    throw ValidationError.required('recordType');
  }
  if (!request.date) {
    throw ValidationError.required('date');
  }
  if (!request.description) {
    throw ValidationError.required('description');
  }

  // Field validations
  validateUUID(request.alpacaId, 'alpacaId');
  validateEnum(request.recordType, 'recordType', HEALTH_RECORD_TYPES);
  validateISODate(request.date, 'date');
  validateStringLength(request.description, 'description', 1, VALIDATION_LIMITS.HEALTH_DESCRIPTION_MAX_LENGTH);

  // Optional field validations
  if (request.veterinarian) {
    validateStringLength(request.veterinarian, 'veterinarian', 1, VALIDATION_LIMITS.VETERINARIAN_MAX_LENGTH);
  }

  if (request.nextDueDate) {
    validateISODate(request.nextDueDate, 'nextDueDate');
  }

  if (request.notes) {
    validateStringLength(request.notes, 'notes', 0, VALIDATION_LIMITS.HEALTH_NOTES_MAX_LENGTH);
  }

  // Business logic validations
  const recordDate = new Date(request.date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (recordDate > today) {
    throw ValidationError.futureDate('date', request.date);
  }

  if (request.nextDueDate) {
    const nextDueDate = new Date(request.nextDueDate);
    if (nextDueDate <= recordDate) {
      throw ApiErrorClass.validation('nextDueDate must be after the record date', 'nextDueDate', request.nextDueDate);
    }
  }
}

/**
 * Validate UpdateHealthRecordRequest
 */
export function validateUpdateHealthRecordRequest(request: UpdateHealthRecordRequest): void {
  // All fields are optional for updates, but validate if present
  if (request.alpacaId !== undefined) {
    validateUUID(request.alpacaId, 'alpacaId');
  }

  if (request.recordType !== undefined) {
    validateEnum(request.recordType, 'recordType', HEALTH_RECORD_TYPES);
  }

  if (request.date !== undefined) {
    validateISODate(request.date, 'date');
    const recordDate = new Date(request.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (recordDate > today) {
      throw ValidationError.futureDate('date', request.date);
    }
  }

  if (request.description !== undefined) {
    validateStringLength(request.description, 'description', 1, VALIDATION_LIMITS.HEALTH_DESCRIPTION_MAX_LENGTH);
  }

  if (request.veterinarian !== undefined) {
    validateStringLength(request.veterinarian, 'veterinarian', 1, VALIDATION_LIMITS.VETERINARIAN_MAX_LENGTH);
  }

  if (request.nextDueDate !== undefined) {
    validateISODate(request.nextDueDate, 'nextDueDate');
  }

  if (request.notes !== undefined) {
    validateStringLength(request.notes, 'notes', 0, VALIDATION_LIMITS.HEALTH_NOTES_MAX_LENGTH);
  }

  // Business logic validations
  if (request.date && request.nextDueDate) {
    const recordDate = new Date(request.date);
    const nextDueDate = new Date(request.nextDueDate);
    if (nextDueDate <= recordDate) {
      throw ApiErrorClass.validation('nextDueDate must be after the record date', 'nextDueDate', request.nextDueDate);
    }
  }
}

/**
 * Validate CreateBreedingRecordRequest
 */
export function validateCreateBreedingRecordRequest(request: CreateBreedingRecordRequest): void {
  // Required fields
  if (!request.sireId) {
    throw ValidationError.required('sireId');
  }
  if (!request.damId) {
    throw ValidationError.required('damId');
  }
  if (!request.breedingDate) {
    throw ValidationError.required('breedingDate');
  }

  // Field validations
  validateUUID(request.sireId, 'sireId');
  validateUUID(request.damId, 'damId');
  validateISODate(request.breedingDate, 'breedingDate');

  // Optional field validations
  if (request.expectedDueDate) {
    validateISODate(request.expectedDueDate, 'expectedDueDate');
  }

  if (request.notes) {
    validateStringLength(request.notes, 'notes', 0, VALIDATION_LIMITS.BREEDING_NOTES_MAX_LENGTH);
  }

  // Business logic validations
  if (request.sireId === request.damId) {
    throw ApiErrorClass.invalidRelationship('Sire and dam cannot be the same alpaca');
  }

  const breedingDate = new Date(request.breedingDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (breedingDate > today) {
    throw ValidationError.futureDate('breedingDate', request.breedingDate);
  }

  if (request.expectedDueDate) {
    const expectedDueDate = new Date(request.expectedDueDate);
    if (expectedDueDate <= breedingDate) {
      throw ApiErrorClass.validation('expectedDueDate must be after the breeding date', 'expectedDueDate', request.expectedDueDate);
    }
  }
}

/**
 * Validate UpdateBreedingRecordRequest
 */
export function validateUpdateBreedingRecordRequest(request: UpdateBreedingRecordRequest): void {
  // All fields are optional for updates, but validate if present
  if (request.sireId !== undefined) {
    validateUUID(request.sireId, 'sireId');
  }

  if (request.damId !== undefined) {
    validateUUID(request.damId, 'damId');
  }

  if (request.breedingDate !== undefined) {
    validateISODate(request.breedingDate, 'breedingDate');
    const breedingDate = new Date(request.breedingDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (breedingDate > today) {
      throw ValidationError.futureDate('breedingDate', request.breedingDate);
    }
  }

  if (request.expectedDueDate !== undefined) {
    validateISODate(request.expectedDueDate, 'expectedDueDate');
  }

  if (request.actualBirthDate !== undefined) {
    validateISODate(request.actualBirthDate, 'actualBirthDate');
  }

  if (request.offspringIds !== undefined) {
    validateArrayMinItems(request.offspringIds, 'offspringIds', 0);
    request.offspringIds.forEach((id, index) => {
      validateUUID(id, `offspringIds[${index}]`);
    });
  }

  if (request.notes !== undefined) {
    validateStringLength(request.notes, 'notes', 0, VALIDATION_LIMITS.BREEDING_NOTES_MAX_LENGTH);
  }

  // Business logic validations
  if (request.sireId && request.damId && request.sireId === request.damId) {
    throw ApiErrorClass.invalidRelationship('Sire and dam cannot be the same alpaca');
  }
}

/**
 * Validate CreateActivityRequest
 */
export function validateCreateActivityRequest(request: CreateActivityRequest): void {
  // Required fields
  if (!request.activityType) {
    throw ValidationError.required('activityType');
  }
  if (!request.date) {
    throw ValidationError.required('date');
  }
  if (!request.alpacaIds) {
    throw ValidationError.required('alpacaIds');
  }
  if (!request.performedBy) {
    throw ValidationError.required('performedBy');
  }
  if (!request.description) {
    throw ValidationError.required('description');
  }

  // Field validations
  validateEnum(request.activityType, 'activityType', ACTIVITY_TYPES);
  validateISODate(request.date, 'date');
  validateArrayMinItems(request.alpacaIds, 'alpacaIds', 1);
  validateStringLength(request.performedBy, 'performedBy', 1, VALIDATION_LIMITS.PERFORMER_MAX_LENGTH);
  validateStringLength(request.description, 'description', 1, VALIDATION_LIMITS.ACTIVITY_DESCRIPTION_MAX_LENGTH);

  // Validate alpaca IDs
  request.alpacaIds.forEach((id, index) => {
    validateUUID(id, `alpacaIds[${index}]`);
  });

  // Optional field validations
  if (request.notes) {
    validateStringLength(request.notes, 'notes', 0, VALIDATION_LIMITS.ACTIVITY_NOTES_MAX_LENGTH);
  }

  // Business logic validations
  const activityDate = new Date(request.date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (activityDate > today) {
    throw ValidationError.futureDate('date', request.date);
  }
}

/**
 * Validate UpdateActivityRequest
 */
export function validateUpdateActivityRequest(request: UpdateActivityRequest): void {
  // All fields are optional for updates, but validate if present
  if (request.activityType !== undefined) {
    validateEnum(request.activityType, 'activityType', ACTIVITY_TYPES);
  }

  if (request.date !== undefined) {
    validateISODate(request.date, 'date');
    const activityDate = new Date(request.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (activityDate > today) {
      throw ValidationError.futureDate('date', request.date);
    }
  }

  if (request.alpacaIds !== undefined) {
    validateArrayMinItems(request.alpacaIds, 'alpacaIds', 1);
    request.alpacaIds.forEach((id, index) => {
      validateUUID(id, `alpacaIds[${index}]`);
    });
  }

  if (request.performedBy !== undefined) {
    validateStringLength(request.performedBy, 'performedBy', 1, VALIDATION_LIMITS.PERFORMER_MAX_LENGTH);
  }

  if (request.description !== undefined) {
    validateStringLength(request.description, 'description', 1, VALIDATION_LIMITS.ACTIVITY_DESCRIPTION_MAX_LENGTH);
  }

  if (request.notes !== undefined) {
    validateStringLength(request.notes, 'notes', 0, VALIDATION_LIMITS.ACTIVITY_NOTES_MAX_LENGTH);
  }
}

/**
 * Validate BulkActivityRequest
 */
export function validateBulkActivityRequest(request: BulkActivityRequest): void {
  // Same validation as CreateActivityRequest
  validateCreateActivityRequest(request);
}

/**
 * Validate BreedingCompatibilityRequest
 */
export function validateBreedingCompatibilityRequest(request: BreedingCompatibilityRequest): void {
  // Required fields
  if (!request.sireId) {
    throw ValidationError.required('sireId');
  }
  if (!request.damId) {
    throw ValidationError.required('damId');
  }

  // Field validations
  validateUUID(request.sireId, 'sireId');
  validateUUID(request.damId, 'damId');

  // Business logic validations
  if (request.sireId === request.damId) {
    throw ApiErrorClass.invalidRelationship('Sire and dam cannot be the same alpaca');
  }
}

/**
 * Validate AlpacaSearchQuery
 */
export function validateAlpacaSearchQuery(query: AlpacaSearchQuery): void {
  validatePaginationQuery(query);

  if (query.gender !== undefined) {
    validateEnum(query.gender, 'gender', ALPACA_GENDERS);
  }

  if (query.birthDateFrom !== undefined) {
    validateISODate(query.birthDateFrom, 'birthDateFrom');
  }

  if (query.birthDateTo !== undefined) {
    validateISODate(query.birthDateTo, 'birthDateTo');
  }

  // Business logic validations
  if (query.birthDateFrom && query.birthDateTo) {
    const fromDate = new Date(query.birthDateFrom);
    const toDate = new Date(query.birthDateTo);
    if (fromDate > toDate) {
      throw ApiErrorClass.validation('birthDateFrom must be before or equal to birthDateTo', 'birthDateFrom', query.birthDateFrom);
    }
  }
}

/**
 * Validate HealthRecordQuery
 */
export function validateHealthRecordQuery(query: HealthRecordQuery): void {
  validatePaginationQuery(query);

  if (query.alpacaId !== undefined) {
    validateUUID(query.alpacaId, 'alpacaId');
  }

  if (query.recordType !== undefined) {
    validateEnum(query.recordType, 'recordType', HEALTH_RECORD_TYPES);
  }

  if (query.dateFrom !== undefined) {
    validateISODate(query.dateFrom, 'dateFrom');
  }

  if (query.dateTo !== undefined) {
    validateISODate(query.dateTo, 'dateTo');
  }

  // Business logic validations
  if (query.dateFrom && query.dateTo) {
    const fromDate = new Date(query.dateFrom);
    const toDate = new Date(query.dateTo);
    if (fromDate > toDate) {
      throw ApiErrorClass.validation('dateFrom must be before or equal to dateTo', 'dateFrom', query.dateFrom);
    }
  }
}

/**
 * Validate BreedingRecordQuery
 */
export function validateBreedingRecordQuery(query: BreedingRecordQuery): void {
  validatePaginationQuery(query);

  if (query.sireId !== undefined) {
    validateUUID(query.sireId, 'sireId');
  }

  if (query.damId !== undefined) {
    validateUUID(query.damId, 'damId');
  }

  if (query.dateFrom !== undefined) {
    validateISODate(query.dateFrom, 'dateFrom');
  }

  if (query.dateTo !== undefined) {
    validateISODate(query.dateTo, 'dateTo');
  }

  // Business logic validations
  if (query.dateFrom && query.dateTo) {
    const fromDate = new Date(query.dateFrom);
    const toDate = new Date(query.dateTo);
    if (fromDate > toDate) {
      throw ApiErrorClass.validation('dateFrom must be before or equal to dateTo', 'dateFrom', query.dateFrom);
    }
  }
}

/**
 * Validate ActivityQuery
 */
export function validateActivityQuery(query: ActivityQuery): void {
  validatePaginationQuery(query);

  if (query.activityType !== undefined) {
    validateEnum(query.activityType, 'activityType', ACTIVITY_TYPES);
  }

  if (query.alpacaId !== undefined) {
    validateUUID(query.alpacaId, 'alpacaId');
  }

  if (query.dateFrom !== undefined) {
    validateISODate(query.dateFrom, 'dateFrom');
  }

  if (query.dateTo !== undefined) {
    validateISODate(query.dateTo, 'dateTo');
  }

  // Business logic validations
  if (query.dateFrom && query.dateTo) {
    const fromDate = new Date(query.dateFrom);
    const toDate = new Date(query.dateTo);
    if (fromDate > toDate) {
      throw ApiErrorClass.validation('dateFrom must be before or equal to dateTo', 'dateFrom', query.dateFrom);
    }
  }
}