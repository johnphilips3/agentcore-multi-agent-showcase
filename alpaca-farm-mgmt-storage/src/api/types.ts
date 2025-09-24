/**
 * API Types and Interfaces
 * Generated from OpenAPI specification for Alpaca Herd Management API
 */

// Base API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: PaginationInfo;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: {
    field?: string;
    value?: any;
    constraint?: string;
    originalError?: string;
  };
}

export type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DUPLICATE_REGISTRATION'
  | 'INVALID_RELATIONSHIP'
  | 'DATABASE_ERROR'
  | 'INBREEDING_DETECTED';

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Core Entity Types
export interface FiberQuality {
  micronCount?: number;
  stapleLength?: number;
  crimp?: 'fine' | 'medium' | 'coarse';
  density?: 'light' | 'medium' | 'dense';
}

export interface Alpaca {
  id: string;
  name: string;
  registrationNumber?: string;
  birthDate: string; // ISO date string
  gender: 'male' | 'female';
  color: string;
  weight?: number;
  height?: number;
  fiberQuality?: FiberQuality;
  sireId?: string;
  damId?: string;
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
}

export interface HealthRecord {
  id: string;
  alpacaId: string;
  recordType: 'vaccination' | 'treatment' | 'observation' | 'checkup';
  date: string; // ISO date string
  description: string;
  veterinarian?: string;
  nextDueDate?: string; // ISO date string
  notes?: string;
  createdAt: string; // ISO datetime string
}

export interface BreedingRecord {
  id: string;
  sireId: string;
  damId: string;
  breedingDate: string; // ISO date string
  expectedDueDate?: string; // ISO date string
  actualBirthDate?: string; // ISO date string
  offspringIds: string[];
  notes?: string;
  createdAt: string; // ISO datetime string
}

export interface ManagementActivity {
  id: string;
  activityType: 'feeding' | 'shearing' | 'weighing' | 'moving' | 'training' | 'other';
  date: string; // ISO date string
  alpacaIds: string[];
  performedBy: string;
  description: string;
  notes?: string;
  createdAt: string; // ISO datetime string
}

// Request Types
export interface CreateAlpacaRequest {
  name: string;
  registrationNumber?: string;
  birthDate: string; // ISO date string
  gender: 'male' | 'female';
  color: string;
  weight?: number;
  height?: number;
  fiberQuality?: FiberQuality;
  sireId?: string;
  damId?: string;
}

export interface UpdateAlpacaRequest {
  name?: string;
  registrationNumber?: string;
  birthDate?: string; // ISO date string
  gender?: 'male' | 'female';
  color?: string;
  weight?: number;
  height?: number;
  fiberQuality?: FiberQuality;
  sireId?: string;
  damId?: string;
}

export interface CreateHealthRecordRequest {
  alpacaId: string;
  recordType: 'vaccination' | 'treatment' | 'observation' | 'checkup';
  date: string; // ISO date string
  description: string;
  veterinarian?: string;
  nextDueDate?: string; // ISO date string
  notes?: string;
}

export interface UpdateHealthRecordRequest {
  alpacaId?: string;
  recordType?: 'vaccination' | 'treatment' | 'observation' | 'checkup';
  date?: string; // ISO date string
  description?: string;
  veterinarian?: string;
  nextDueDate?: string; // ISO date string
  notes?: string;
}

export interface CreateBreedingRecordRequest {
  sireId: string;
  damId: string;
  breedingDate: string; // ISO date string
  expectedDueDate?: string; // ISO date string
  notes?: string;
}

export interface UpdateBreedingRecordRequest {
  sireId?: string;
  damId?: string;
  breedingDate?: string; // ISO date string
  expectedDueDate?: string; // ISO date string
  actualBirthDate?: string; // ISO date string
  offspringIds?: string[];
  notes?: string;
}

export interface CreateActivityRequest {
  activityType: 'feeding' | 'shearing' | 'weighing' | 'moving' | 'training' | 'other';
  date: string; // ISO date string
  alpacaIds: string[];
  performedBy: string;
  description: string;
  notes?: string;
}

export interface UpdateActivityRequest {
  activityType?: 'feeding' | 'shearing' | 'weighing' | 'moving' | 'training' | 'other';
  date?: string; // ISO date string
  alpacaIds?: string[];
  performedBy?: string;
  description?: string;
  notes?: string;
}

export interface BulkActivityRequest {
  activityType: 'feeding' | 'shearing' | 'weighing' | 'moving' | 'training' | 'other';
  date: string; // ISO date string
  alpacaIds: string[];
  performedBy: string;
  description: string;
  notes?: string;
}

// Query Types
export interface AlpacaSearchQuery extends PaginationQuery {
  name?: string;
  gender?: 'male' | 'female';
  color?: string;
  registrationNumber?: string;
  birthDateFrom?: string; // ISO date string
  birthDateTo?: string; // ISO date string;
  q?: string; // General search query
}

export interface HealthRecordQuery extends PaginationQuery {
  alpacaId?: string;
  recordType?: 'vaccination' | 'treatment' | 'observation' | 'checkup';
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  veterinarian?: string;
}

export interface BreedingRecordQuery extends PaginationQuery {
  sireId?: string;
  damId?: string;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
}

export interface ActivityQuery extends PaginationQuery {
  activityType?: 'feeding' | 'shearing' | 'weighing' | 'moving' | 'training' | 'other';
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  performedBy?: string;
  alpacaId?: string;
}

// Response Types
export interface LineageGeneration {
  generation: number;
  alpacas: Alpaca[];
}

export interface LineageResponse {
  alpaca: Alpaca;
  ancestors: LineageGeneration[];
  descendants: LineageGeneration[];
}

export interface BreedingCompatibilityRequest {
  sireId: string;
  damId: string;
}

export interface BreedingCompatibilityResponse {
  compatible: boolean;
  reason?: string;
  relationshipDegree?: number;
}

// API Response Types
export type AlpacaListResponse = ApiResponse<Alpaca[]>;
export type AlpacaResponse = ApiResponse<Alpaca>;
export type LineageApiResponse = ApiResponse<LineageResponse>;
export type OffspringResponse = ApiResponse<Alpaca[]>;

export type HealthRecordListResponse = ApiResponse<HealthRecord[]>;
export type HealthRecordResponse = ApiResponse<HealthRecord>;

export type BreedingRecordListResponse = ApiResponse<BreedingRecord[]>;
export type BreedingRecordResponse = ApiResponse<BreedingRecord>;
export type BreedingCompatibilityApiResponse = ApiResponse<BreedingCompatibilityResponse>;

export type ActivityListResponse = ApiResponse<ManagementActivity[]>;
export type ActivityResponse = ApiResponse<ManagementActivity>;

// Error Response Types
export type ErrorResponse = ApiResponse<never>;

// Constants
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_REGISTRATION: 'DUPLICATE_REGISTRATION',
  INVALID_RELATIONSHIP: 'INVALID_RELATIONSHIP',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INBREEDING_DETECTED: 'INBREEDING_DETECTED'
} as const;

export const ALPACA_GENDERS = ['male', 'female'] as const;
export const HEALTH_RECORD_TYPES = ['vaccination', 'treatment', 'observation', 'checkup'] as const;
export const ACTIVITY_TYPES = ['feeding', 'shearing', 'weighing', 'moving', 'training', 'other'] as const;
export const FIBER_CRIMP_TYPES = ['fine', 'medium', 'coarse'] as const;
export const FIBER_DENSITY_TYPES = ['light', 'medium', 'dense'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

// Validation Constants
export const VALIDATION_LIMITS = {
  ALPACA_NAME_MAX_LENGTH: 100,
  REGISTRATION_NUMBER_MAX_LENGTH: 50,
  COLOR_MAX_LENGTH: 50,
  WEIGHT_MAX: 500,
  HEIGHT_MAX: 100,
  HEALTH_DESCRIPTION_MAX_LENGTH: 1000,
  HEALTH_NOTES_MAX_LENGTH: 2000,
  VETERINARIAN_MAX_LENGTH: 100,
  BREEDING_NOTES_MAX_LENGTH: 2000,
  ACTIVITY_DESCRIPTION_MAX_LENGTH: 1000,
  ACTIVITY_NOTES_MAX_LENGTH: 2000,
  PERFORMER_MAX_LENGTH: 100,
  FIBER_MICRON_MIN: 10,
  FIBER_MICRON_MAX: 40,
  FIBER_STAPLE_MIN: 1,
  FIBER_STAPLE_MAX: 8,
  PAGE_SIZE_MIN: 1,
  PAGE_SIZE_MAX: 100,
  PAGE_SIZE_DEFAULT: 20,
  LINEAGE_GENERATIONS_MIN: 1,
  LINEAGE_GENERATIONS_MAX: 10,
  LINEAGE_GENERATIONS_DEFAULT: 3
} as const;