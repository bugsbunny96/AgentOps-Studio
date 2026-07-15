import type { Request, Response, NextFunction } from 'express';
import {
  verifyVapiSecret,
  dispatchWebhookEvent,
  handleAssistantRequest,
  type VapiWebhookEvent,
  type VapiAssistantRequestEvent,
} from './webhook.service';
import { logger } from '../../utils/logger';

/**
 * POST /api/v1/webhooks/vapi
 *
 * Handles all Vapi call lifecycle events.
 * No session auth — uses shared-secret header (x-vapi-secret) for
 * request authentication.
 *
 * TWO response modes:
 *
 *   assistant-request  → SYNCHRONOUS: we must await the handler and return
 *                        the assistant config (or after-hours config) in the
 *                        response body BEFORE Vapi times out (~5 s).
 *
 *   all other events   → FIRE-AND-FORGET: return 200 immediately, then
 *                        process DB writes async. Prevents Vapi retry storms.
 */
export async function vapiWebhookHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // ── 1. Verify shared secret ─────────────────────────────────────────────
    const incoming = req.headers['x-vapi-secret'] as string | undefined;
    if (!verifyVapiSecret(incoming)) {
      logger.warn('Vapi webhook: invalid secret', { ip: req.ip });
      res.status(401).json({ success: false, message: 'Invalid webhook secret' });
      return;
    }

    const body    = req.body as VapiWebhookEvent;
    const msgType = (body?.message as { type?: string })?.type;

    // ── 2a. assistant-request — MUST be synchronous ─────────────────────────
    if (msgType === 'assistant-request') {
      try {
        const event    = body.message as VapiAssistantRequestEvent;
        const response = await handleAssistantRequest(event);
        logger.info('Vapi assistant-request handled', {
          callId: event.call.id,
          hasAssistantId: 'assistantId' in response,
        });
        res.status(200).json(response);
      } catch (err) {
        // If we crash here Vapi will retry — log and return a safe fallback
        logger.error('assistant-request handler failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        // Return a minimal error message so the call doesn't hang silently
        res.status(200).json({
          message:
            'We are experiencing technical difficulties. Please call back shortly. Goodbye!',
        });
      }
      return;
    }

    // ── 2b. All other events — fire-and-forget ──────────────────────────────
    res.status(200).json({ success: true });

    dispatchWebhookEvent(body).catch((err: unknown) => {
      logger.error('Vapi webhook dispatch error', {
        error: err instanceof Error ? err.message : String(err),
        eventType: msgType,
      });
    });
  } catch (err) {
    next(err);
  }
}
