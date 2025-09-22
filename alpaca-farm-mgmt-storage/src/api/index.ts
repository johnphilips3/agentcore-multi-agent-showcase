/**
 * API Module Index
 * Exports all API types, validation, and error handling utilities
 */

// Types
export * from './types.js';

// Error handling
export * from './errors.js';

// Validation
export * from './validation.js';

// Re-export commonly used items for convenience
export {
  ApiResponse,
  ApiError,
  ErrorCode,
  PaginationInfo,
  PaginationQuery,
  Alpaca,
  HealthRecord,
  BreedingRecord,
  ManagementActivity,
  CreateAlpacaRequest,
  UpdateAlpacaRequest,
  CreateHealthRecordRequest,
  UpdateHealthRecordRequest,
  CreateBreedingRecordRequest,
  UpdateBreedingRecordRequest,
  CreateActivityRequest,
  UpdateActivityRequest,
  BulkActivityRequest,
  LineageResponse,
  BreedingCompatibilityRequest,
  BreedingCompatibilityResponse,
  ERROR_CODES,
  VALIDATION_LIMITS
} from './types.js';

export {
  ApiErrorClass,
  ValidationError,
  formatErrorResponse,
  formatSuccessResponse,
  isApiError,
  getErrorStatusCode
} from './errors.js';

export {
  validateCreateAlpacaRequest,
  validateUpdateAlpacaRequest,
  validateCreateHealthRecordRequest,
  validateUpdateHealthRecordRequest,
  validateCreateBreedingRecordRequest,
  validateUpdateBreedingRecordRequest,
  validateCreateActivityRequest,
  validateUpdateActivityRequest,
  validateBulkActivityRequest,
  validateBreedingCompatibilityRequest,
  validateAlpacaSearchQuery,
  validateHealthRecordQuery,
  validateBreedingRecordQuery,
  validateActivityQuery,
  validatePaginationQuery,
  validateUUID,
  validateISODate
} from './validation.js';