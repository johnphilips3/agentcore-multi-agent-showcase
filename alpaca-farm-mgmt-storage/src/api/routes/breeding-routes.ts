/**
 * Breeding Records API Routes
 */

import { Router } from 'express';
import { BreedingController } from '../controllers/breeding-controller.js';
import { BreedingService } from '../../services/breeding-service.js';
import { PostgreSQLBreedingRepository } from '../../repositories/pg-breeding-repository.js';
import { PostgreSQLConnection } from '../../database/pg-connection.js';

export function createBreedingRoutes(): Router {
    const router = Router();

    // Initialize dependencies
    const db = PostgreSQLConnection.fromEnvironment();
    const repository = new PostgreSQLBreedingRepository(db);
    const service = new BreedingService(repository);
    const controller = new BreedingController(service);

    // Routes
    router.get('/statistics', controller.getBreedingStatistics.bind(controller));
    router.get('/expected-births', controller.getExpectedBirths.bind(controller));
    router.get('/date-range', controller.getBreedingRecordsByDateRange.bind(controller));
    router.post('/validate-pair', controller.validateBreedingPair.bind(controller));
    router.get('/sire/:sireId', controller.getBreedingRecordsBySire.bind(controller));
    router.get('/dam/:damId', controller.getBreedingRecordsByDam.bind(controller));
    router.get('/parent/:parentId', controller.getBreedingRecordsByParent.bind(controller));
    router.get('/:id', controller.getBreedingRecord.bind(controller));
    router.put('/:id', controller.updateBreedingRecord.bind(controller));
    router.delete('/:id', controller.deleteBreedingRecord.bind(controller));
    router.get('/', controller.getAllBreedingRecords.bind(controller));
    router.post('/', controller.createBreedingRecord.bind(controller));

    return router;
}