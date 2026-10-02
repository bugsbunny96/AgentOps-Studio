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
import { orgContext, requirePermission } from '../../middleware/orgContext';

export const kbRouter = Router();

kbRouter.use(authenticate, orgContext);   // SEC-05

// Collection routes
kbRouter.get('/',         listDocsHandler);
kbRouter.post('/',        requirePermission('knowledgeBase'), createDocHandler);

// Named sub-routes BEFORE /:id to avoid param shadowing
kbRouter.get('/status',      statusHandler);
kbRouter.post('/re-sync',    requirePermission('knowledgeBase'), resyncHandler);
kbRouter.get('/categories',  categoriesHandler);

// Single-document routes
kbRouter.get('/:id',      getDocHandler);
kbRouter.patch('/:id',    requirePermission('knowledgeBase'), updateDocHandler);
kbRouter.delete('/:id',   requirePermission('knowledgeBase'), deleteDocHandler);
