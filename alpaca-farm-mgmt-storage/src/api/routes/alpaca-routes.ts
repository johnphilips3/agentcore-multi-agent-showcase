/**
 * Alpaca API Routes
 */

import { Router } from 'express';
import { AlpacaController } from '../controllers/alpaca-controller.js';
import { AlpacaService } from '../../services/alpaca-service.js';
import { PostgreSQLAlpacaRepository } from '../../repositories/pg-alpaca-repository.js';
import { PostgreSQLConnection } from '../../database/pg-connection.js';

export function createAlpacaRoutes(): Router {
    const router = Router();

    // Initialize dependencies
    const db = PostgreSQLConnection.fromEnvironment();
    const repository = new PostgreSQLAlpacaRepository(db);
    const service = new AlpacaService(repository);
    const controller = new AlpacaController(service);

    // Routes
    router.get('/statistics', controller.getHerdStatistics.bind(controller));
    router.get('/search', controller.searchAlpacas.bind(controller));
    router.get('/gender/:gender', controller.getAlpacasByGender.bind(controller));
    router.get('/:id', controller.getAlpaca.bind(controller));
    router.put('/:id', controller.updateAlpaca.bind(controller));
    router.delete('/:id', controller.deleteAlpaca.bind(controller));
    router.get('/', controller.getAllAlpacas.bind(controller));
    router.post('/', controller.createAlpaca.bind(controller));

    return router;
}