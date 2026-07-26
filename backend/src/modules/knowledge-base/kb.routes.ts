import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  listDocsHandler,
  createDocHandler,
  statusHandler,
  resyncHandler,
  categoriesHandler,
  getDocHandler,
  updateDocHandler,
  deleteDocHandler,
} from './kb.controller';

export const kbRouter = Router();

kbRouter.use(authenticate);

// Collection routes
kbRouter.get('/',         listDocsHandler);
kbRouter.post('/',        createDocHandler);

// Named sub-routes BEFORE /:id to avoid param shadowing
kbRouter.get('/status',      statusHandler);
kbRouter.post('/re-sync',    resyncHandler);
kbRouter.get('/categories',  categoriesHandler);

// Single-document routes
kbRouter.get('/:id',      getDocHandler);
kbRouter.patch('/:id',    updateDocHandler);
kbRouter.delete('/:id',   deleteDocHandler);
