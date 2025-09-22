/**
 * Main API Routes
 */

import { Router } from 'express';
import { createAlpacaRoutes } from './alpaca-routes.js';
import { createHealthRoutes } from './health-routes.js';
import { createBreedingRoutes } from './breeding-routes.js';
import { createActivityRoutes } from './activity-routes.js';

export function createApiRoutes(): Router {
  const router = Router();

  // Mount route modules
  router.use('/alpacas', createAlpacaRoutes());
  router.use('/health-records', createHealthRoutes());
  router.use('/breeding-records', createBreedingRoutes());
  router.use('/activities', createActivityRoutes());

  // API info endpoint
  router.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        name: 'Alpaca Herd Management API',
        version: '1.0.0',
        description: 'API for managing alpaca herds, health records, breeding information, and management activities',
        endpoints: {
          alpacas: '/api/v1/alpacas',
          health_records: '/api/v1/health-records',
          breeding_records: '/api/v1/breeding-records',
          activities: '/api/v1/activities'
        },
        documentation: '/api-docs',
        features: {
          alpacas: 'Full CRUD, search, statistics, gender filtering',
          health_records: 'Full CRUD, alerts, overdue vaccinations, summaries',
          breeding_records: 'Full CRUD, statistics, expected births, validation',
          activities: 'Full CRUD, bulk operations, performance metrics, scheduling'
        }
      }
    });
  });

  return router;
}