import { z } from 'zod';

// ─── Industry options (shared with frontend) ───────────────────────────────
// Exported so the frontend can import the same list to keep them in sync.
export const INDUSTRY_OPTIONS = [
  'Technology',
  'Healthcare',
  'Real Estate',
  'Logistics & Delivery',
  'Finance & BFSI',
  'Education & EdTech',
  'Retail',
  'Hospitality & Food',
  'Legal',
  'Manufacturing',
  'Other',
] as const;

export type Industry = (typeof INDUSTRY_OPTIONS)[number];

// ─── Supported language codes ──────────────────────────────────────────────
export const SUPPORTED_LANGUAGE_CODES = ['en-US', 'hi-IN', 'pa-IN'] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

// ─── Step 1: Create Organization ──────────────────────────────────────────
export const CreateOrgSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  industry: z.enum(INDUSTRY_OPTIONS, {
    errorMap: () => ({ message: 'Select a valid industry' }),
  }),
  timezone: z.string().min(1).default('Asia/Kolkata'),
});

export type CreateOrgDto = z.infer<typeof CreateOrgSchema>;

// ─── Step 2: Learn — website + knowledge base ──────────────────────────────
const LearnStepSchema = z.object({
  step: z.literal('learn'),
  hasWebsite: z.boolean(),
  websiteUrl: z
    .string()
    .url('Enter a valid URL (e.g. https://example.com)')
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
});

// ─── Step 3: Configure — business details ──────────────────────────────────
const ConfigureStepSchema = z.object({
  step: z.literal('configure'),
  businessDescription: z.string().max(500, 'Max 500 characters').optional(),
  services: z.array(z.string().max(100)).max(20).optional().default([]),
  businessHours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format (e.g. 09:00)'),
      end: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format (e.g. 18:00)'),
    })
    .optional(),
  contactDetails: z
    .object({
      email: z
        .string()
        .email('Enter a valid email')
        .optional()
        .or(z.literal(''))
        .transform((v) => v || undefined),
      phone: z.string().optional(),
    })
    .optional(),
  locations: z.array(z.string().max(200)).max(10).optional().default([]),
});

// ─── Step 4: Customize — voice and language ────────────────────────────────
const CustomizeStepSchema = z.object({
  step: z.literal('customize'),
  supportedLanguages: z
    .array(z.enum(SUPPORTED_LANGUAGE_CODES))
    .min(1, 'Select at least one language'),
  fallbackNumber: z.string().optional(),
});

// ─── Union ─────────────────────────────────────────────────────────────────
export const UpdateOrgSchema = z.discriminatedUnion('step', [
  LearnStepSchema,
  ConfigureStepSchema,
  CustomizeStepSchema,
]);

export type UpdateOrgDto = z.infer<typeof UpdateOrgSchema>;
