/**
 * API Test Runner
 * Comprehensive test suite runner for all API components
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Import all test suites
import './errors.test.js';
import './middleware.test.js';
import './validation.test.js';
import './controllers/__tests__/alpaca-controller.test.js';
import './controllers/__tests__/health-controller.test.js';
import './controllers/__tests__/breeding-controller.test.js';
import './controllers/__tests__/activity-controller.test.js';
import './integration/api-integration.test.js';
import './contract/openapi-contract.test.js';

/**
 * Test configuration and setup
 */
export const testConfig = {
    timeout: 30000, // 30 seconds
    retries: 2,
    parallel: true
};

/**
 * Test utilities for API testing
 */
export class ApiTestUtils {
    /**
     * Generate test UUID
     */
    static generateTestUUID(): string {
        return '123e4567-e89b-12d3-a456-426614174000';
    }

    /**
     * Generate test date string
     */
    static generateTestDate(daysFromNow: number = 0): string {
        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);
        return date.toISOString().split('T')[0];
    }

    /**
     * Generate test alpaca data
     */
    static generateTestAlpaca(overrides: any = {}) {
        return {
            id: this.generateTestUUID(),
            name: 'Test Alpaca',
            birthDate: this.generateTestDate(-365), // 1 year ago
            gender: 'male' as const,
            color: 'white',
            registrationNumber: 'TEST001',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...overrides
        };
    }

    /**
     * Generate test health record data
     */
    static generateTestHealthRecord(alpacaId?: string, overrides: any = {}) {
        return {
            id: this.generateTestUUID(),
            alpacaId: alpacaId || this.generateTestUUID(),
            recordType: 'vaccination' as const,
            date: this.generateTestDate(-30), // 30 days ago
            description: 'Test vaccination',
            veterinarian: 'Dr. Test',
            createdAt: new Date().toISOString(),
            ...overrides
        };
    }

    /**
     * Generate test breeding record data
     */
    static generateTestBreedingRecord(sireId?: string, damId?: string, overrides: any = {}) {
        return {
            id: this.generateTestUUID(),
            sireId: sireId || this.generateTestUUID(),
            damId: damId || this.generateTestUUID(),
            breedingDate: this.generateTestDate(-60), // 60 days ago
            offspringIds: [],
            createdAt: new Date().toISOString(),
            ...overrides
        };
    }

    /**
     * Generate test activity data
     */
    static generateTestActivity(alpacaIds?: string[], overrides: any = {}) {
        return {
            id: this.generateTestUUID(),
            activityType: 'feeding' as const,
            date: this.generateTestDate(-1), // Yesterday
            alpacaIds: alpacaIds || [this.generateTestUUID()],
            performedBy: 'Test User',
            description: 'Test activity',
            createdAt: new Date().toISOString(),
            ...overrides
        };
    }

    /**
     * Validate API response format
     */
    static validateApiResponse(response: any, expectData: boolean = true) {
        expect(response).toBeDefined();
        expect(typeof response.success).toBe('boolean');

        if (response.success) {
            if (expectData) {
                expect(response.data).toBeDefined();
            }
            expect(response.error).toBeUndefined();
        } else {
            expect(response.error).toBeDefined();
            expect(response.error.code).toBeDefined();
            expect(response.error.message).toBeDefined();
            expect(response.data).toBeUndefined();
        }
    }

    /**
     * Validate pagination info
     */
    static validatePaginationInfo(pagination: any) {
        expect(pagination).toBeDefined();
        expect(typeof pagination.page).toBe('number');
        expect(typeof pagination.limit).toBe('number');
        expect(typeof pagination.total).toBe('number');
        expect(typeof pagination.totalPages).toBe('number');
        expect(pagination.page).toBeGreaterThan(0);
        expect(pagination.limit).toBeGreaterThan(0);
        expect(pagination.total).toBeGreaterThanOrEqual(0);
        expect(pagination.totalPages).toBeGreaterThan(0);
    }

    /**
     * Validate UUID format
     */
    static validateUUID(uuid: string) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(uuid).toMatch(uuidRegex);
    }

    /**
     * Validate ISO date format
     */
    static validateISODate(dateString: string) {
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        expect(dateString).toMatch(isoDateRegex);

        const date = new Date(dateString);
        expect(isNaN(date.getTime())).toBe(false);
        expect(date.toISOString().split('T')[0]).toBe(dateString);
    }

    /**
     * Validate ISO datetime format
     */
    static validateISODateTime(datetimeString: string) {
        const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
        expect(datetimeString).toMatch(isoDateTimeRegex);

        const date = new Date(datetimeString);
        expect(isNaN(date.getTime())).toBe(false);
    }

    /**
     * Create mock request object
     */
    static createMockRequest(overrides: any = {}) {
        return {
            params: {},
            query: {},
            body: {},
            headers: {},
            method: 'GET',
            url: '/test',
            ip: '127.0.0.1',
            get: (header: string) => overrides.headers?.[header.toLowerCase()],
            ...overrides
        };
    }

    /**
     * Create mock response object
     */
    static createMockResponse() {
        const res: any = {
            statusCode: 200,
            headers: {},
            headersSent: false
        };

        res.status = (code: number) => {
            res.statusCode = code;
            return res;
        };

        res.json = (data: any) => {
            res.body = data;
            return res;
        };

        res.send = (data?: any) => {
            res.body = data;
            return res;
        };

        res.header = (name: string, value: string) => {
            res.headers[name.toLowerCase()] = value;
            return res;
        };

        res.get = (name: string) => {
            return res.headers[name.toLowerCase()];
        };

        res.removeHeader = (name: string) => {
            delete res.headers[name.toLowerCase()];
            return res;
        };

        res.on = () => res;
        res.end = () => res;

        return res;
    }

    /**
     * Sleep utility for async tests
     */
    static async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate random string
     */
    static generateRandomString(length: number = 10): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Generate random number within range
     */
    static generateRandomNumber(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

/**
 * Test data factory
 */
export class TestDataFactory {
    /**
     * Create test alpaca with realistic data
     */
    static createAlpaca(overrides: any = {}) {
        const colors = ['white', 'brown', 'black', 'gray', 'fawn', 'beige'];
        const names = ['Snowball', 'Cocoa', 'Shadow', 'Luna', 'Sunny', 'Storm'];

        return ApiTestUtils.generateTestAlpaca({
            name: names[Math.floor(Math.random() * names.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            weight: ApiTestUtils.generateRandomNumber(100, 200),
            height: ApiTestUtils.generateRandomNumber(30, 40),
            registrationNumber: `REG${ApiTestUtils.generateRandomNumber(1000, 9999)}`,
            ...overrides
        });
    }

    /**
     * Create test health record with realistic data
     */
    static createHealthRecord(alpacaId?: string, overrides: any = {}) {
        const recordTypes = ['vaccination', 'treatment', 'observation', 'checkup'];
        const veterinarians = ['Dr. Smith', 'Dr. Johnson', 'Dr. Brown', 'Dr. Davis'];
        const descriptions = [
            'Annual vaccination',
            'Routine checkup',
            'Treatment for minor injury',
            'Health observation'
        ];

        return ApiTestUtils.generateTestHealthRecord(alpacaId, {
            recordType: recordTypes[Math.floor(Math.random() * recordTypes.length)],
            veterinarian: veterinarians[Math.floor(Math.random() * veterinarians.length)],
            description: descriptions[Math.floor(Math.random() * descriptions.length)],
            ...overrides
        });
    }

    /**
     * Create test breeding record with realistic data
     */
    static createBreedingRecord(sireId?: string, damId?: string, overrides: any = {}) {
        return ApiTestUtils.generateTestBreedingRecord(sireId, damId, {
            expectedDueDate: ApiTestUtils.generateTestDate(300), // ~10 months from breeding
            ...overrides
        });
    }

    /**
     * Create test activity with realistic data
     */
    static createActivity(alpacaIds?: string[], overrides: any = {}) {
        const activityTypes = ['feeding', 'shearing', 'weighing', 'moving', 'training'];
        const performers = ['John Doe', 'Jane Smith', 'Farm Manager', 'Veterinarian'];
        const descriptions = [
            'Morning feeding session',
            'Annual shearing',
            'Monthly weighing',
            'Pasture rotation',
            'Basic training session'
        ];

        return ApiTestUtils.generateTestActivity(alpacaIds, {
            activityType: activityTypes[Math.floor(Math.random() * activityTypes.length)],
            performedBy: performers[Math.floor(Math.random() * performers.length)],
            description: descriptions[Math.floor(Math.random() * descriptions.length)],
            ...overrides
        });
    }
}

/**
 * Performance test utilities
 */
export class PerformanceTestUtils {
    /**
     * Measure execution time
     */
    static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        return { result, duration: end - start };
    }

    /**
     * Run performance benchmark
     */
    static async runBenchmark(
        name: string,
        fn: () => Promise<any>,
        iterations: number = 100
    ): Promise<{ name: string; averageTime: number; minTime: number; maxTime: number }> {
        const times: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const { duration } = await this.measureExecutionTime(fn);
            times.push(duration);
        }

        const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);

        return { name, averageTime, minTime, maxTime };
    }
}

// Main test suite runner
describe('API Test Suite', () => {
    beforeAll(async () => {
        console.log('🦙 Starting Alpaca Herd Management API Test Suite');
        console.log('📊 Running comprehensive tests for all API components');
    });

    afterAll(async () => {
        console.log('✅ API Test Suite completed successfully');
    });

    it('should have all test utilities available', () => {
        expect(ApiTestUtils).toBeDefined();
        expect(TestDataFactory).toBeDefined();
        expect(PerformanceTestUtils).toBeDefined();
    });

    it('should generate valid test data', () => {
        const alpaca = TestDataFactory.createAlpaca();
        const healthRecord = TestDataFactory.createHealthRecord();
        const breedingRecord = TestDataFactory.createBreedingRecord();
        const activity = TestDataFactory.createActivity();

        ApiTestUtils.validateUUID(alpaca.id);
        ApiTestUtils.validateISODate(alpaca.birthDate);
        ApiTestUtils.validateUUID(healthRecord.id);
        ApiTestUtils.validateUUID(breedingRecord.id);
        ApiTestUtils.validateUUID(activity.id);
    });
});

export default {
    ApiTestUtils,
    TestDataFactory,
    PerformanceTestUtils,
    testConfig
};