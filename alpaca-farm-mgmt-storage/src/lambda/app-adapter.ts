/**
 * Express to Lambda Adapter
 * 
 * This module provides functionality to adapt an Express application
 * to work with AWS Lambda and API Gateway events using serverless-http.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Application } from 'express';
import serverless from 'serverless-http';

/**
 * Create a Lambda-compatible handler from an Express application
 */
export function createLambdaAdapter(app: Application) {
  // Use serverless-http to create the adapter
  const serverlessHandler = serverless(app, {
    // Configure serverless-http options for Swagger UI support
    binary: ['image/*', 'application/javascript', 'text/css', 'application/octet-stream'],
    request: (request: any, event: APIGatewayProxyEvent, context: Context) => {
      // Add custom request properties
      request.apiGateway = {
        event,
        context
      };
      
      // Add request ID for tracing
      request.requestId = context.awsRequestId;
      
      // Add source IP from API Gateway
      request.sourceIp = event.requestContext?.identity?.sourceIp || 'unknown';
      
      return request;
    },
    response: (response: APIGatewayProxyResult, event: APIGatewayProxyEvent, context: Context) => {
      // Add CORS headers if not already present
      if (!response.headers) {
        response.headers = {};
      }
      
      // Ensure CORS headers are set
      if (!response.headers['Access-Control-Allow-Origin']) {
        response.headers['Access-Control-Allow-Origin'] = '*';
      }
      
      if (!response.headers['Access-Control-Allow-Headers']) {
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token';
      }
      
      if (!response.headers['Access-Control-Allow-Methods']) {
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
      }
      
      // Add request ID to response headers for tracing
      response.headers['X-Request-ID'] = context.awsRequestId;
      
      return response;
    }
  });
  
  return serverlessHandler;
}

