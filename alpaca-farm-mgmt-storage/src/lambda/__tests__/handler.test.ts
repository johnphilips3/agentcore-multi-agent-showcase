/**
 * Lambda Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock the dependencies
vi.mock('../connection-manager.js', () => ({
  initializeLambdaEnvironment: vi.fn().mockResolvedValue(undefined),
  testConnection: vi.fn().mockResolvedValue(undefined),
  getPoolStatus: vi.fn().mockReturnValue({ totalCount: 1, idleCount: 1, waitingCount: 0 }),
  LambdaDbUtils: {
    initialize: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue(undefined),
    getInfo: vi.fn().mockReturnValue({
      isInitialized: true,
      poolStatus: { totalCount: 1, idleCount: 1, waitingCount: 0 },
      environment: { host: 'localhost', database: 'test' },
      lastHealthCheck: Date.now(),
      connectionAttempts: 1
    })
  }
}));

vi.mock('../app-adapter.js', () => ({
  createLambdaAdapter: vi.fn().mockReturnValue(vi.fn().mockResolvedValue({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data: { status: 'healthy' } })
  }))
}));

vi.mock('../../api/full-server.js', () => ({
  createFullApp: vi.fn().mockReturnValue({})
}));

vi.mock('../environment-setup.js', () => ({
  setupLambdaEnvironment: vi.fn().mockResolvedValue(undefined),
  logEnvironmentInfo: vi.fn()
}));

describe('Lambda Handler', () => {
  let mockEvent: APIGatewayProxyEvent;
  let mockContext: Context;

  beforeEach(() => {
    vi.clearAllMocks();
    
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
      logGroupName: '/aws/lambda/test-function',
      logStreamName: '2023/01/01/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: vi.fn(),
      fail: vi.fn(),
      succeed: vi.fn()
    } as Context;
  });

  it('should handle health check request successfully', async () => {
    // Import handler after mocks are set up
    const { handler } = await import('../handler.js');
    
    const result = await handler(mockEvent, mockContext);
    
    expect(result).toBeDefined();
    expect(result.statusCode).toBe(200);
    expect(result.headers).toBeDefined();
    expect(result.body).toBeDefined();
    
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    // Mock an error in the adapter
    const { createLambdaAdapter } = await import('../app-adapter.js');
    vi.mocked(createLambdaAdapter).mockReturnValue(
      vi.fn().mockRejectedValue(new Error('Test error'))
    );
    
    // Re-import to get fresh handler with error
    vi.resetModules();
    const { handler } = await import('../handler.js');
    
    const result = await handler(mockEvent, mockContext);
    
    expect(result.statusCode).toBe(500);
    expect(result.headers['Content-Type']).toBe('application/json');
    
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.requestId).toBe(mockContext.awsRequestId);
  });

  it('should set callbackWaitsForEmptyEventLoop to false', async () => {
    const { handler } = await import('../handler.js');
    
    await handler(mockEvent, mockContext);
    
    expect(mockContext.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('should include CORS headers in response', async () => {
    const { handler } = await import('../handler.js');
    
    const result = await handler(mockEvent, mockContext);
    
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(result.headers['Access-Control-Allow-Headers']).toBeDefined();
    expect(result.headers['Access-Control-Allow-Methods']).toBeDefined();
  });
});