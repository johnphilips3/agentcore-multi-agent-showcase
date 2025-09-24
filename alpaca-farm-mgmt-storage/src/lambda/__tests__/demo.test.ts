/**
 * Lambda Handler Demo Test
 * 
 * This test demonstrates that the Lambda handler and Express adapter work correctly
 * by mocking the database dependencies and testing the actual serverless-http integration.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock the connection manager to avoid database dependencies
vi.mock('../connection-manager.js', () => ({
  initializeLambdaEnvironment: vi.fn().mockResolvedValue(undefined),
  testConnection: vi.fn().mockResolvedValue(undefined),
  getPoolStatus: vi.fn().mockReturnValue({ totalCount: 1, idleCount: 1, waitingCount: 0 })
}));

// Mock the database repositories to return test data
vi.mock('../../repositories/index.js', () => ({
  // Mock repository implementations would go here
}));

describe('Lambda Handler Demo', () => {
  let handler: any;
  let mockContext: Context;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.RDS_HOST = 'localhost';
    process.env.RDS_USERNAME = 'test';
    process.env.RDS_PASSWORD = 'test';
    
    // Import handler after mocks are set up
    const handlerModule = await import('../handler.js');
    handler = handlerModule.handler;

    mockContext = {
      awsRequestId: 'demo-request-id',
      callbackWaitsForEmptyEventLoop: true,
      functionName: 'alpaca-api-demo',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:alpaca-api-demo',
      memoryLimitInMB: '512',
      remainingTimeInMillis: () => 30000
    } as Context;
  });

  it('should successfully process health check through serverless-http', async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: 'GET',
      path: '/health',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'lambda-demo/1.0'
      },
      queryStringParameters: null,
      pathParameters: null,
      body: null,
      isBase64Encoded: false,
      requestContext: {
        requestId: 'demo-health-request',
        stage: 'demo',
        resourcePath: '/health',
        httpMethod: 'GET',
        path: '/demo/health',
        accountId: '123456789012',
        resourceId: 'demo-resource',
        apiId: 'demo-api',
        identity: {
          sourceIp: '127.0.0.1',
          userAgent: 'lambda-demo/1.0'
        },
        requestTime: '01/Jan/2023:00:00:00 +0000',
        requestTimeEpoch: 1672531200000
      }
    } as APIGatewayProxyEvent;

    console.log('🧪 Testing Lambda handler with health check request...');
    
    const result = await handler(event, mockContext);

    console.log('✅ Lambda handler response:', {
      statusCode: result.statusCode,
      headers: Object.keys(result.headers || {}),
      bodyLength: result.body?.length || 0
    });

    // Verify the response structure
    expect(result).toBeDefined();
    expect(result.statusCode).toBe(200);
    expect(result.headers).toBeDefined();
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(result.headers['X-Request-ID']).toBe(mockContext.awsRequestId);
    expect(result.body).toBeDefined();

    // Verify the response body
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe('healthy');
    expect(body.data.timestamp).toBeDefined();
    expect(body.data.version).toBeDefined();
    expect(body.data.environment).toBe('test');

    console.log('🎉 Health check response body:', body.data);
  });

  it('should demonstrate proper event/response transformation', async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: 'GET',
      path: '/api/v1',
      headers: {
        'Accept': 'application/json',
        'X-Custom-Header': 'demo-value'
      },
      queryStringParameters: {
        'demo': 'true',
        'version': '1.0'
      },
      pathParameters: null,
      body: null,
      isBase64Encoded: false,
      requestContext: {
        requestId: 'demo-api-info-request',
        stage: 'demo',
        resourcePath: '/api/v1',
        httpMethod: 'GET',
        path: '/demo/api/v1',
        accountId: '123456789012',
        resourceId: 'demo-resource',
        apiId: 'demo-api',
        identity: {
          sourceIp: '192.168.1.100'
        },
        requestTime: '01/Jan/2023:00:00:00 +0000',
        requestTimeEpoch: 1672531200000
      }
    } as APIGatewayProxyEvent;

    console.log('🧪 Testing API Gateway event transformation...');
    console.log('📥 Input event:', {
      method: event.httpMethod,
      path: event.path,
      queryParams: event.queryStringParameters,
      headers: Object.keys(event.headers || {})
    });

    const result = await handler(event, mockContext);

    console.log('📤 Output result:', {
      statusCode: result.statusCode,
      headers: Object.keys(result.headers || {}),
      hasBody: !!result.body
    });

    // Verify proper transformation
    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/json');
    
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Alpaca Herd Management API');
    expect(body.data.endpoints).toBeDefined();

    console.log('🎉 API info response:', {
      name: body.data.name,
      endpoints: Object.keys(body.data.endpoints)
    });
  });

  it('should handle Lambda context correctly', async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: 'GET',
      path: '/health',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: null,
      isBase64Encoded: false,
      requestContext: {
        requestId: 'context-test-request',
        stage: 'demo',
        resourcePath: '/health',
        httpMethod: 'GET',
        path: '/demo/health',
        accountId: '123456789012',
        resourceId: 'demo-resource',
        apiId: 'demo-api',
        identity: {
          sourceIp: '127.0.0.1'
        },
        requestTime: '01/Jan/2023:00:00:00 +0000',
        requestTimeEpoch: 1672531200000
      }
    } as APIGatewayProxyEvent;

    console.log('🧪 Testing Lambda context handling...');
    
    const originalCallbackWaits = mockContext.callbackWaitsForEmptyEventLoop;
    
    await handler(event, mockContext);

    // Verify context was modified correctly
    expect(mockContext.callbackWaitsForEmptyEventLoop).toBe(false);
    
    console.log('✅ Lambda context configured correctly:', {
      callbackWaitsForEmptyEventLoop: mockContext.callbackWaitsForEmptyEventLoop,
      originalValue: originalCallbackWaits
    });
  });
});