/**
 * Management Activities API Routes
 */

import { Router } from 'express';
import { ActivityController } from '../controllers/activity-controller.js';
import { ActivityService } from '../../services/activity-service.js';
import { PostgreSQLActivityRepository } from '../../repositories/pg-activity-repository.js';
import { PostgreSQLConnection } from '../../database/pg-connection.js';

export function createActivityRoutes(): Router {
    const router = Router();

    // Initialize dependencies
    const db = PostgreSQLConnection.fromEnvironment();
    const repository = new PostgreSQLActivityRepository(db);
    const service = new ActivityService(repository);
    const controller = new ActivityController(service);

    // Routes
    router.get('/statistics', controller.getActivityStatistics.bind(controller));
    router.get('/scheduled', controller.getScheduledActivities.bind(controller));
    router.get('/performance-metrics', controller.getPerformanceMetrics.bind(controller));
    router.get('/date-range', controller.getActivitiesByDateRange.bind(controller));
    router.post('/bulk', controller.createBulkActivity.bind(controller));
    router.get('/alpaca/:alpacaId', controller.getActivitiesByAlpaca.bind(controller));
    router.get('/type/:activityType', controller.getActivitiesByType.bind(controller));
    router.get('/performer/:performer', controller.getActivitiesByPerformer.bind(controller));
    router.get('/summary/:alpacaId', controller.getAlpacaActivitySummary.bind(controller));
    router.get('/:id', controller.getActivity.bind(controller));
    router.put('/:id', controller.updateActivity.bind(controller));
    router.delete('/:id', controller.deleteActivity.bind(controller));
    router.get('/', controller.getAllActivities.bind(controller));
    router.post('/', controller.createActivity.bind(controller));

    return router;
}