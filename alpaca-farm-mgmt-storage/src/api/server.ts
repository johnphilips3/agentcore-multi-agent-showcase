/**
 * Express Server Setup
 * Base API infrastructure for the Alpaca Herd Management API
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ApiErrorClass, formatErrorResponse, getErrorStatusCode, isApiError } from './errors.js';
import { requestValidationMiddleware } from './middleware.js';
import { requestLoggingMiddleware } from './logging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Server configuration interface
 */
export interface ServerConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  enableSwaggerUI: boolean;
  logLevel: 'combined' | 'common' | 'dev' | 'short' | 'tiny';
  trustProxy: boolean;
}

/**
 * Default server configuration
 */
export const defaultServerConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  enableSwaggerUI: process.env.ENABLE_SWAGGER_UI !== 'false',
  logLevel: (process.env.LOG_LEVEL as any) || 'combined',
  trustProxy: process.env.TRUST_PROXY === 'true'
};

/**
 * Create and configure Express application
 */
export function createApp(config: Partial<ServerConfig> = {}): Application {
  const appConfig = { ...defaultServerConfig, ...config };
  const app = express();

  // Trust proxy if configured (for load balancers, reverse proxies)
  if (appConfig.trustProxy) {
    app.set('trust proxy', 1);
  }

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false
  }));

  // CORS configuration
  app.use(cors({
    origin: appConfig.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Compression middleware
  app.use(compression());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: appConfig.rateLimitWindowMs,
    max: appConfig.rateLimitMaxRequests,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Request parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging middleware
  app.use(morgan(appConfig.logLevel));
  app.use(requestLoggingMiddleware);

  // Request validation middleware
  app.use(requestValidationMiddleware);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  });

  // API documentation with Swagger UI
  if (appConfig.enableSwaggerUI) {
    try {
      const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Alpaca Herd Management API Documentation'
      }));
    } catch (error) {
      console.warn('Failed to load OpenAPI specification for Swagger UI:', error);
    }
  }

  // API routes will be added here by controllers
  // This is a placeholder for route registration
  app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
    // This middleware will be replaced by actual route handlers
    next();
  });

  // 404 handler for API routes
  app.use('/api/*', (req: Request, res: Response) => {
    const error = ApiErrorClass.notFound('Endpoint', req.path);
    res.status(error.statusCode).json(formatErrorResponse(error));
  });

  // Global error handler
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    // Log the error
    console.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Format and send error response
    const statusCode = getErrorStatusCode(error);
    const errorResponse = formatErrorResponse(error);
    
    res.status(statusCode).json(errorResponse);
  });

  return app;
}

/**
 * Start the server
 */
export function startServer(app: Application, config: Partial<ServerConfig> = {}): Promise<void> {
  const appConfig = { ...defaultServerConfig, ...config };
  
  return new Promise((resolve, reject) => {
    const server = app.listen(appConfig.port, appConfig.host, () => {
      console.log(`🦙 Alpaca Herd Management API server running on http://${appConfig.host}:${appConfig.port}`);
      console.log(`📚 API Documentation available at http://${appConfig.host}:${appConfig.port}/api-docs`);
      console.log(`🏥 Health check available at http://${appConfig.host}:${appConfig.port}/health`);
      resolve();
    });

    server.on('error', (error: Error) => {
      console.error('Failed to start server:', error);
      reject(error);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  });
}

/**
 * Create and start server with default configuration
 */
export async function createAndStartServer(config: Partial<ServerConfig> = {}): Promise<Application> {
  const app = createApp(config);
  await startServer(app, config);
  return app;
}