import type { Request, Response, NextFunction } from 'express';
import {
  provisionAgent,
  getAgentConfig,
  listAgents,
  getAgentById,
  updateAgentVoice,
  updateAgentConfig,
  linkPhoneNumber,
  getPhoneNumber,
} from './agent.service';
import { UpdateAgentConfigSchema } from './agent.validation';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

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
 * PATCH /api/v1/agents/:id
 *
 * Body: { voiceProvider, voiceId, supportedLanguages? }
 *
 * Updates voice provider + voiceId on the local VoiceAgent record and
 * syncs the change to Vapi immediately. Returns the updated agent.
 */
export async function updateAgentVoiceHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const agentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { voiceProvider, voiceId, supportedLanguages } = req.body as {
      voiceProvider?: string;
      voiceId?: string;
      supportedLanguages?: string[];
    };

    if (!voiceProvider || !voiceId) {
      res.status(400).json({ success: false, message: 'voiceProvider and voiceId are required' });
      return;
    }

    const result = await updateAgentVoice(req.userId!, agentId, {
      voiceProvider,
      voiceId,
      supportedLanguages,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/agents/voice-preview?provider=openai&voiceId=nova
 *
 * Streams a short TTS audio clip so the user can preview a voice before selecting.
 *
 * Supported providers:
 *   openai   — uses OPENAI_API_KEY, returns audio/mpeg
 *   deepgram — uses DEEPGRAM_API_KEY, model: aura-{voiceId}-en, returns audio/mpeg
 *
 * Other providers (elevenlabs, playht, azure) return 400 — they require provider-specific
 * API keys that are configured in the Vapi dashboard, not our backend. Users should
 * save their selection and use a test call to hear those voices.
 *
 * Returns:
 *   Content-Type: audio/mpeg (on success)
 *   400 — provider not supported for server-side preview
 *   503 — required API key not configured
 *   402 — OpenAI quota exceeded
 *   502 — upstream TTS error
 */
export async function voicePreviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { provider = 'openai', voiceId = 'nova' } = req.query as Record<string, string>;
    const previewText =
      `Hello! I'm ${voiceId.charAt(0).toUpperCase() + voiceId.slice(1)}, ` +
      `your AI voice assistant. I'm here to help your customers with any questions they have. ` +
      `How does my voice sound?`;

    // ── OpenAI TTS ─────────────────────────────────────────────────────────────
    if (provider === 'openai') {
      if (!env.OPENAI_API_KEY) {
        res.status(503).json({
          success: false,
          message: 'OPENAI_API_KEY is not configured — OpenAI voice preview unavailable',
        });
        return;
      }

      // All OpenAI TTS voices supported by Vapi (from OpenAIVoice.voiceId in @vapi-ai/web SDK)
      const VALID_OPENAI_VOICES = ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer', 'marin', 'cedar'] as const;
      type OpenAIVoice = (typeof VALID_OPENAI_VOICES)[number];
      const safeVoice: OpenAIVoice = VALID_OPENAI_VOICES.includes(voiceId as OpenAIVoice)
        ? (voiceId as OpenAIVoice)
        : 'nova';

      const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: previewText,
          voice: safeVoice,
          response_format: 'mp3',
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text().catch(() => '');
        logger.error('OpenAI TTS preview failed', { status: openaiRes.status, body: errText.slice(0, 200) });
        if (openaiRes.status === 429) {
          res.status(402).json({
            success: false,
            message: 'OpenAI quota exceeded — add credits at platform.openai.com to enable voice preview',
          });
        } else {
          res.status(502).json({ success: false, message: 'Voice preview failed — OpenAI TTS error' });
        }
        return;
      }

      const buffer = await openaiRes.arrayBuffer();
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.end(Buffer.from(buffer));
      return;
    }

    // ── Deepgram Aura TTS ──────────────────────────────────────────────────────
    // Model format: aura-{voiceId}-en  (e.g. aura-asteria-en, aura-luna-en)
    if (provider === 'deepgram') {
      if (!env.DEEPGRAM_API_KEY) {
        res.status(503).json({
          success: false,
          message: 'DEEPGRAM_API_KEY is not configured — Deepgram voice preview unavailable',
        });
        return;
      }

      // Validate against known Aura voice IDs from Vapi SDK
      const VALID_DEEPGRAM_VOICES = [
        'asteria', 'luna', 'stella', 'athena', 'hera',
        'orion', 'arcas', 'perseus', 'angus', 'orpheus', 'helios', 'zeus',
        'thalia', 'andromeda',
      ] as const;
      type DeepgramVoice = (typeof VALID_DEEPGRAM_VOICES)[number];
      const safeVoice: string = VALID_DEEPGRAM_VOICES.includes(voiceId as DeepgramVoice)
        ? voiceId
        : 'asteria';

      const model = `aura-${safeVoice}-en`;

      const dgRes = await fetch(
        `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: previewText }),
        },
      );

      if (!dgRes.ok) {
        const errText = await dgRes.text().catch(() => '');
        logger.error('Deepgram TTS preview failed', { status: dgRes.status, body: errText.slice(0, 200), model });
        if (dgRes.status === 401 || dgRes.status === 403) {
          res.status(503).json({
            success: false,
            message: 'Deepgram API key invalid — check DEEPGRAM_API_KEY',
          });
        } else if (dgRes.status === 400) {
          res.status(400).json({
            success: false,
            message: `Voice "${voiceId}" not found in Deepgram Aura — check voice ID`,
          });
        } else {
          res.status(502).json({ success: false, message: 'Deepgram voice preview failed' });
        }
        return;
      }

      const buffer = await dgRes.arrayBuffer();
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.end(Buffer.from(buffer));
      return;
    }

    // ── Unsupported provider ────────────────────────────────────────────────────
    // ElevenLabs, PlayHT, Azure require provider-specific keys configured in Vapi.
    // We don't have those keys server-side, so preview is not available.
    const providerLabel: Record<string, string> = {
      elevenlabs: 'ElevenLabs',
      playht: 'PlayHT',
      azure: 'Azure',
      cartesia: 'Cartesia',
    };
    res.status(400).json({
      success: false,
      message: `${providerLabel[provider] ?? provider} voices cannot be previewed server-side. Save your selection and make a test call to hear this voice.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/agents/:id/config
 *
 * Body: { name?, businessDescription? }
 *
 * Updates the agent's display name and/or the org's business description,
 * regenerates the system prompt using existing generateSystemPrompt() + current
 * KB context, then pushes the new prompt (and optional name) to Vapi.
 */
export async function updateAgentConfigHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const agentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const dto = UpdateAgentConfigSchema.parse(req.body);
    const result = await updateAgentConfig(req.userId!, agentId, dto);
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
