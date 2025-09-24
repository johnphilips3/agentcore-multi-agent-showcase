/**
 * App Adapter Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Application } from 'express';

// Mock serverless-http
vi.mock('serverless-http', () => ({
  default: vi.fn((app, options) => {
    return vi.fn().mockImplementation((event, context) => {
      // Simulate the response transformation that happens in the actual adapter
      let response = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ success: true })
      };
      
      // Apply the response transformation from options if provided
      if (options && options.response) {
        response = options.response(response, event, context);
      }
      
      return Promise.resolve(response);
    });
  })
}));

describe('App Adapter', () => {
  let mockApp: Application;
  let mockEvent: APIGatewayProxyEvent;
  let mockContext: Context;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApp = {} as Application;
    
    mockEvent = {
      httpMethod: 'GET',
      path: '/health',
      headers: {},
      queryStringParameters: null,
      body: null,
      isBase64Encoded: false,
      requestContext: {
        requestId: 'test-request-id',
        stage: 'test',
        identity: {
          sourceIp: '127.0.0.1'
        }
      }
    } as APIGatewayProxyEvent;

    mockContext = {
      awsRequestId: 'test-aws-request-id',
      callbackWaitsForEmptyEventLoop: true,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
      memoryLimitInMB: '512',
      remainingTimeInMillis: () => 30000
    } as Context;
  });

  it('should create Lambda adapter successfully', async () => {
    const { createLambdaAdapter } = await import('../app-adapter.js');
    
    const adapter = createLambdaAdapter(mockApp);
    
    expect(adapter).toBeDefined();
    expect(typeof adapter).toBe('function');
  });

  it('should handle API Gateway event correctly', async () => {
    const { createLambdaAdapter } = await import('../app-adapter.js');
    
    const adapter = createLambdaAdapter(mockApp);
    const result = await adapter(mockEvent, mockContext);
    
    expect(result).toBeDefined();
    expect(result.statusCode).toBe(200);
    expect(result.headers).toBeDefined();
    expect(result.body).toBeDefined();
  });

  it('should include CORS headers in response', async () => {
    const { createLambdaAdapter } = await import('../app-adapter.js');
    
    const adapter = createLambdaAdapter(mockApp);
    const result = await adapter(mockEvent, mockContext);
    
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('should add request ID to response headers', async () => {
    const { createLambdaAdapter } = await import('../app-adapter.js');
    
    const adapter = createLambdaAdapter(mockApp);
    const result = await adapter(mockEvent, mockContext);
    
    expect(result.headers['X-Request-ID']).toBe(mockContext.awsRequestId);
  });
});