/**
 * Full Express Server with Controllers for Alpaca Herd Management API
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createApiRoutes } from './routes/index.js';

/**
 * Server configuration interface
 */
export interface ServerConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  logLevel: 'combined' | 'common' | 'dev' | 'short' | 'tiny';
  trustProxy: boolean;
}

/**
 * Default server configuration
 */
export const defaultConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  logLevel: (process.env.LOG_LEVEL as any) || 'combined',
  trustProxy: process.env.TRUST_PROXY === 'true'
};

/**
 * Create and configure Express application with full controllers
 */
export function createFullApp(config: Partial<ServerConfig> = {}): Application {
  const appConfig = { ...defaultConfig, ...config };
  const app = express();

  // Trust proxy if configured
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

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: {
          type: process.env.RDS_HOST ? 'RDS PostgreSQL' : 'PostgreSQL',
          host: process.env.RDS_HOST || 'localhost',
          connected: true // TODO: Add actual connection test
        },
        features: {
          alpacas: 'enabled',
          healthRecords: 'enabled',
          breedingRecords: 'enabled',
          activities: 'enabled'
        }
      }
    });
  });

  // Mount API routes
  app.use('/api/v1', createApiRoutes());

  // 404 handler for API routes
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.path} not found`
      }
    });
  });

  // Global error handler
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Determine status code based on error type
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    
    if (error.message.includes('required') || error.message.includes('cannot be empty')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (error.message.includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: error.message
      }
    });
  });

  return app;
}

/**
 * Start the server
 */
export function startFullServer(app: Application, config: Partial<ServerConfig> = {}): Promise<void> {
  const appConfig = { ...defaultConfig, ...config };
  
  return new Promise((resolve, reject) => {
    const server = app.listen(appConfig.port, appConfig.host, () => {
      console.log(`🦙 Alpaca Herd Management API server running on http://${appConfig.host}:${appConfig.port}`);
      console.log(`🏥 Health check available at http://${appConfig.host}:${appConfig.port}/health`);
      console.log(`📋 API endpoints available at http://${appConfig.host}:${appConfig.port}/api/v1`);
      console.log(`🐾 Alpacas: http://${appConfig.host}:${appConfig.port}/api/v1/alpacas`);
      console.log(`🏥 Health Records: http://${appConfig.host}:${appConfig.port}/api/v1/health-records`);
      console.log(`💕 Breeding Records: http://${appConfig.host}:${appConfig.port}/api/v1/breeding-records`);
      console.log(`📋 Activities: http://${appConfig.host}:${appConfig.port}/api/v1/activities`);
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
 * Create and start server with full controllers
 */
export async function createAndStartFullServer(config: Partial<ServerConfig> = {}): Promise<Application> {
  const app = createFullApp(config);
  await startFullServer(app, config);
  return app;
}