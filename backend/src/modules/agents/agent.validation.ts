import { z } from 'zod';

/**
 * PATCH /api/v1/agents/:id/config
 *
 * Updates the agent's name and/or business description.
 * Either field is optional, but at least one is expected.
 * The service always regenerates the system prompt and pushes it to Vapi.
 */
export const UpdateAgentConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Name must not be empty')
    .max(100, 'Name must be 100 characters or fewer')
    .trim()
    .optional(),
  businessDescription: z
    .string()
    .max(5000, 'Business description must be 5000 characters or fewer')
    .trim()
    .optional(),
});

export type UpdateAgentConfigDto = z.infer<typeof UpdateAgentConfigSchema>;
