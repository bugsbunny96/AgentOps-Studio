import type { Request, Response, NextFunction } from 'express';
import {
  verifyVapiSecret,
  handleAssistantRequest,
  handleCallStarted,
  type VapiWebhookEvent,
  type VapiAssistantRequestEvent,
  type VapiEndOfCallReportEvent,
} from './webhook.service';
import { callReportQueue } from '../../jobs/callReport.queue';
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

    // ── 2b. call-started — lightweight, fire-and-forget inline ──────────────
    // Creating the Call record is a fast single-document upsert; inline is fine.
    if (msgType === 'call-started') {
      res.status(200).json({ success: true });
      handleCallStarted((body.message as Parameters<typeof handleCallStarted>[0])).catch(
        (err: unknown) => {
          logger.error('call-started handler error', {
            error: err instanceof Error ? err.message : String(err),
          });
        },
      );
      return;
    }

    // ── 2c. end-of-call-report — push to BullMQ for reliable async processing ─
    // Transcript parsing + summary writes can be slow or fail under load.
    // BullMQ gives us retry-with-backoff, persistence across restarts,
    // and dead-letter visibility — none of which exist in a plain fire-and-forget.
    if (msgType === 'end-of-call-report') {
      res.status(200).json({ success: true });
      const ev = body.message as VapiEndOfCallReportEvent;
      callReportQueue.add('process-end-of-call', {
        vapiCallId:     ev.call.id,
        assistantId:    ev.call.assistantId,
        callType:       ev.call.type,
        callerNumber:   ev.call.customer?.number,
        endedReason:    ev.call.endedReason,
        durationSeconds: ev.durationSeconds,
        recordingUrl:   ev.recordingUrl,
        transcript:     ev.transcript,
        messages:       ev.messages,
        summary:        ev.summary,
        cost:           ev.cost,
      }).catch((err: unknown) => {
        logger.error('Failed to enqueue call report job', {
          vapiCallId: ev.call.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
      return;
    }

    // ── 2d. Unknown event types — acknowledge and ignore ────────────────────
    res.status(200).json({ success: true });
    logger.debug('Unhandled Vapi event type acknowledged', { type: msgType });
  } catch (err) {
    next(err);
  }
}
