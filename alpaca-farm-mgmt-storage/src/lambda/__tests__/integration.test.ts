/**
 * Lambda Handler Integration Tests
 * 
 * These tests verify that the Lambda handler can process real API Gateway events
 * and return proper responses for the alpaca management API endpoints.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.RDS_HOST = 'localhost';
process.env.RDS_PORT = '5432';
process.env.RDS_DATABASE = 'alpaca_herd_test';
process.env.RDS_USERNAME = 'test_user';
process.env.RDS_PASSWORD = 'test_password';
process.env.RDS_SSL = 'false';

describe('Lambda Handler Integration Tests', () => {
  let handler: any;
  let mockContext: Context;

  beforeAll(async () => {
    // Import handler after environment is set up
    const handlerModule = await import('../handler.js');
    handler = handlerModule.handler;

    mockContext = {
      awsRequestId: 'test-integration-request-id',
      callbackWaitsForEmptyEventLoop: true,
      functionName: 'alpaca-api-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:alpaca-api-function',
      memoryLimitInMB: '512',
      remainingTimeInMillis: () => 30000,
      logGroupName: '/aws/lambda/alpaca-api-function',
      logStreamName: '2023/01/01/[$LATEST]test'
    } as Context;
  });

  afterAll(async () => {
    // Clean up any resources if needed
  });

  describe('Health Check Endpoint', () => {
    it('should handle GET /health request', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'test-client/1.0'
        },
        queryStringParameters: null,
        pathParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-health-request',
          stage: 'test',
          resourcePath: '/health',
          httpMethod: 'GET',
          path: '/test/health',
          accountId: '123456789012',
          resourceId: 'resource-id',
          apiId: 'api-id',
          identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'test-client/1.0'
          },
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1672531200000
        }
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('healthy');
      expect(body.data.timestamp).toBeDefined();
    });
  });

  describe('API Info Endpoint', () => {
    it('should handle GET /api/v1 request', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/api/v1',
        headers: {
          'Content-Type': 'application/json'
        },
        queryStringParameters: null,
        pathParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-api-info-request',
          stage: 'test',
          resourcePath: '/api/v1',
          httpMethod: 'GET',
          path: '/test/api/v1',
          accountId: '123456789012',
          resourceId: 'resource-id',
          apiId: 'api-id',
          identity: {
            sourceIp: '127.0.0.1'
          },
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1672531200000
        }
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Alpaca Herd Management API');
      expect(body.data.endpoints).toBeDefined();
      expect(body.data.endpoints.alpacas).toBe('/api/v1/alpacas');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/api/v1/unknown-endpoint',
        headers: {},
        queryStringParameters: null,
        pathParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-404-request',
          stage: 'test',
          resourcePath: '/api/v1/unknown-endpoint',
          httpMethod: 'GET',
          path: '/test/api/v1/unknown-endpoint',
          accountId: '123456789012',
          resourceId: 'resource-id',
          apiId: 'api-id',
          identity: {
            sourceIp: '127.0.0.1'
          },
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1672531200000
        }
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(result.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should handle OPTIONS requests for CORS', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'OPTIONS',
        path: '/api/v1/alpacas',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        },
        queryStringParameters: null,
        pathParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-options-request',
          stage: 'test',
          resourcePath: '/api/v1/alpacas',
          httpMethod: 'OPTIONS',
          path: '/test/api/v1/alpacas',
          accountId: '123456789012',
          resourceId: 'resource-id',
          apiId: 'api-id',
          identity: {
            sourceIp: '127.0.0.1'
          },
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1672531200000
        }
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      // Should handle CORS preflight
      expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(result.headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(result.headers['Access-Control-Allow-Headers']).toBeDefined();
    });
  });

  describe('Request Context', () => {
    it('should set callbackWaitsForEmptyEventLoop to false', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        queryStringParameters: null,
        pathParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-context-request',
          stage: 'test',
          resourcePath: '/health',
          httpMethod: 'GET',
          path: '/test/health',
          accountId: '123456789012',
          resourceId: 'resource-id',
          apiId: 'api-id',
          identity: {
            sourceIp: '127.0.0.1'
          },
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1672531200000
        }
      } as APIGatewayProxyEvent;

      await handler(event, mockContext);

      expect(mockContext.callbackWaitsForEmptyEventLoop).toBe(false);
    });

    it('should include request ID in response headers', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        queryStringParameters: null,
        pathParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-id-header',
          stage: 'test',
          resourcePath: '/health',
          httpMethod: 'GET',
          path: '/test/health',
          accountId: '123456789012',
          resourceId: 'resource-id',
          apiId: 'api-id',
          identity: {
            sourceIp: '127.0.0.1'
          },
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1672531200000
        }
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.headers['X-Request-ID']).toBe(mockContext.awsRequestId);
    });
  });
});