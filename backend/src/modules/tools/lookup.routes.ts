/**
 * POST /api/v1/tools/lookup — Vapi tool-call webhook for search_catalog and
 * search_knowledge_base (attached inline by agents/assistant-config.ts only when
 * an org's catalog or KB is too large to keep in the prompt).
 *
 * Auth: same shared secret as submit_order (x-webhook-secret / x-vapi-secret),
 * fails closed in production. Mounted before the global /api/v1 rate limiter in
 * app.ts — every Vapi call shares a few egress IPs (see gaps.md CORE-03).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { verifyToolWebhookSecret } from '../orders/order.routes';
import { resolveOrgByAssistantId } from '../orders/order.service';
import { searchCatalog, searchKnowledgeBase } from './lookup.service';
import { logger } from '../../utils/logger';

export const toolsRouter = Router();
const router = toolsRouter;

interface ToolCall {
  id: string;
  function?: { name?: string; arguments?: string | Record<string, unknown> };
}

function parseQuery(args: unknown): string {
  try {
    const obj = typeof args === 'string' ? JSON.parse(args) : (args ?? {});
    return typeof obj?.query === 'string' ? obj.query.slice(0, 200) : '';
  } catch {
    return '';
  }
}

router.post('/lookup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!verifyToolWebhookSecret(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const toolCalls = (req.body?.message?.toolCallList ?? []) as ToolCall[];
    const assistantId: string | undefined = req.body?.message?.call?.assistantId;
    if (!toolCalls.length) {
      res.status(400).json({ error: 'toolCallList is required' });
      return;
    }

    const orgId = assistantId ? await resolveOrgByAssistantId(assistantId) : null;
    if (!orgId) {
      logger.warn('tools/lookup: could not resolve org', { assistantId });
      res.status(200).json({
        results: toolCalls.map((tc) => ({ toolCallId: tc.id, result: 'Lookup unavailable right now. Offer a callback.' })),
      });
      return;
    }

    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        const name  = tc.function?.name;
        const query = parseQuery(tc.function?.arguments);
        let result: string;
        if (!query) result = 'No search keywords were given. Ask the caller what they are looking for.';
        else if (name === 'search_catalog') result = await searchCatalog(orgId, query);
        else if (name === 'search_knowledge_base') result = await searchKnowledgeBase(orgId, query);
        else result = `Unknown tool "${name}".`;
        return { toolCallId: tc.id, result };
      }),
    );

    logger.info('tools/lookup: answered', {
      orgId: orgId.toString(),
      calls: toolCalls.map((tc) => tc.function?.name),
    });
    res.status(200).json({ results });
  } catch (err) {
    next(err);
  }
});

