/**
 * Health Records API Routes
 */

import { Router } from 'express';
import { HealthController } from '../controllers/health-controller.js';
import { HealthService } from '../../services/health-service.js';
import { PostgreSQLHealthRepository } from '../../repositories/pg-health-repository.js';
import { PostgreSQLConnection } from '../../database/pg-connection.js';

export function createHealthRoutes(): Router {
  const router = Router();
  
  // Initialize dependencies
  const db = PostgreSQLConnection.fromEnvironment();
  const repository = new PostgreSQLHealthRepository(db);
  const service = new HealthService(repository);
  const controller = new HealthController(service);

  // Routes
  router.get('/overdue-vaccinations', controller.getOverdueVaccinations.bind(controller));
  router.get('/alerts', controller.getHealthAlerts.bind(controller));
  router.get('/alpaca/:alpacaId', controller.getHealthRecordsByAlpaca.bind(controller));
  router.get('/type/:recordType', controller.getHealthRecordsByType.bind(controller));
  router.get('/summary/:alpacaId', controller.getHealthSummary.bind(controller));
  router.get('/:id', controller.getHealthRecord.bind(controller));
  router.put('/:id', controller.updateHealthRecord.bind(controller));
  router.delete('/:id', controller.deleteHealthRecord.bind(controller));
  router.get('/', controller.getAllHealthRecords.bind(controller));
  router.post('/', controller.createHealthRecord.bind(controller));

  return router;
}