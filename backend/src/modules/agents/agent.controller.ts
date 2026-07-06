import type { Request, Response, NextFunction } from 'express';
import {
  provisionAgent,
  getAgentConfig,
  listAgents,
  getAgentById,
  linkPhoneNumber,
  getPhoneNumber,
} from './agent.service';

/**
 * POST /api/v1/agents/provision
 *
 * Idempotent — safe to call on every ActivatePage mount.
 * Creates the Vapi assistant + local VoiceAgent record on first call;
 * returns cached data on subsequent calls.
 */
export async function provisionAgentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await provisionAgent(req.userId!);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/agents/config
 *
 * Returns { vapiPublicKey, vapiAssistantId, agent } for the authenticated owner.
 * Used by the test call widget to initialise the Vapi browser SDK.
 */
export async function getAgentConfigHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getAgentConfig(req.userId!);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/agents
 *
 * Lists all VoiceAgent records for the authenticated owner's org.
 */
export async function listAgentsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await listAgents(req.userId!);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/agents/:id
 *
 * Returns a single VoiceAgent by its MongoDB _id.
 * 404 if agent doesn't belong to the authenticated owner's org.
 */
export async function getAgentByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const agentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await getAgentById(req.userId!, agentId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/agents/phone-number
 *
 * Body: { vapiPhoneNumberId: string }
 *
 * Links a Vapi phone number (UUID from Vapi dashboard → Phone Numbers) to the
 * authenticated owner's org. This is what the assistant-request webhook uses to
 * route inbound calls to the correct assistant + business-hours config.
 */
export async function linkPhoneNumberHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { vapiPhoneNumberId } = req.body as { vapiPhoneNumberId?: string };
    if (!vapiPhoneNumberId || typeof vapiPhoneNumberId !== 'string') {
      res.status(400).json({ success: false, message: 'vapiPhoneNumberId is required' });
      return;
    }
    const result = await linkPhoneNumber(req.userId!, vapiPhoneNumberId.trim());
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/agents/phone-number
 *
 * Returns the currently linked Vapi phone number ID for the org.
 */
export async function getPhoneNumberHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getPhoneNumber(req.userId!);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
