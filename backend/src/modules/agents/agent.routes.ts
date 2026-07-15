import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  provisionAgentHandler,
  getAgentConfigHandler,
  listAgentsHandler,
  getAgentByIdHandler,
  linkPhoneNumberHandler,
  getPhoneNumberHandler,
} from './agent.controller';

export const agentsRouter = Router();

// All routes require a valid session
agentsRouter.use(authenticate);

/**
 * GET /api/v1/agents
 * Lists all voice agents for the authenticated owner's org.
 * NOTE: must be declared BEFORE /:id to avoid literal strings matching the param.
 */
agentsRouter.get('/', listAgentsHandler);

/**
 * GET /api/v1/agents/config
 * Returns { vapiPublicKey, vapiAssistantId, agent } for the test call widget.
 */
agentsRouter.get('/config', getAgentConfigHandler);

/**
 * POST /api/v1/agents/provision
 * Idempotent — creates Vapi assistant + local record on first call,
 * returns cached data thereafter.
 */
agentsRouter.post('/provision', provisionAgentHandler);

/**
 * GET  /api/v1/agents/phone-number   — returns the linked Vapi phone number ID
 * POST /api/v1/agents/phone-number   — links a Vapi phone number ID to this org
 *
 * Body (POST): { vapiPhoneNumberId: string }
 * This is the UUID from Vapi dashboard → Phone Numbers.
 * Used by the assistant-request webhook to route inbound calls.
 */
agentsRouter.get('/phone-number',  getPhoneNumberHandler);
agentsRouter.post('/phone-number', linkPhoneNumberHandler);

/**
 * GET /api/v1/agents/:id
 * Returns a single voice agent by its MongoDB _id.
 * MUST remain after all literal-segment routes.
 */
agentsRouter.get('/:id', getAgentByIdHandler);
