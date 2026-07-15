import { Router } from 'express';
import { vapiWebhookHandler } from './webhook.controller';

export const vapiWebhookRouter = Router();

/**
 * POST /api/v1/webhooks/vapi
 *
 * No authenticate middleware — webhook uses x-vapi-secret header auth.
 * Body is pre-parsed by the global express.json() in app.ts.
 */
vapiWebhookRouter.post('/', vapiWebhookHandler);
