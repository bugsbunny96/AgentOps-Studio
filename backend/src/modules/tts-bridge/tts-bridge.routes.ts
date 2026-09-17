/**
 * TTS Bridge Routes — implements Vapi's custom-voice webhook protocol.
 *
 * Mounted at /api/tts (see app.ts).
 *
 * POST /api/tts/synthesize
 *   Vapi POSTs: { message: { text: string, sampleRate?: number } }
 *   Returns:    Raw PCM16LE mono (application/octet-stream)
 *
 * GET  /api/tts/healthz
 *   Returns "ok" — used by Vapi to probe the bridge before routing calls.
 *
 * This route is NOT behind the `authenticate` middleware because Vapi calls it
 * from its internal synthesis infrastructure — there is no user session.
 * The SARVAM_BRIDGE_URL env var acts as an enable switch; Vapi is configured
 * to call this endpoint only when that var is set.
 *
 * Protocol reference: https://docs.vapi.ai/customization/custom-voices/custom-tts
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { synthesize } from './tts-bridge.service';

const router = Router();

// ── GET /api/tts/healthz ──────────────────────────────────────────────────────

router.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).send('ok');
});

// ── POST /api/tts/synthesize ──────────────────────────────────────────────────

router.post('/synthesize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Vapi custom-voice protocol:
    // { message: { text: string, sampleRate?: number } }
    const text: string | undefined = req.body?.message?.text;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'missing or empty message.text' });
      return;
    }

    const sampleRate: number =
      Number(req.body?.message?.sampleRate) || 24000;

    const { pcm, elapsedMs, usedSarvam } = await synthesize({ text, sampleRate });

    // Log synthesis latency — useful for monitoring TTS latency on voice calls
    logger.debug('[tts/synthesize]', {
      chars: text.length,
      sampleRate,
      elapsedMs,
      usedSarvam,
      pcmBytes: pcm.length,
    });

    // Return raw PCM as required by Vapi's custom-voice protocol
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-TTS-Elapsed-Ms', String(elapsedMs));
    res.status(200).end(pcm);
  } catch (err) {
    logger.error('[tts/synthesize] unexpected error', { err });
    next(err);
  }
});

export { router as ttsBridgeRouter };
