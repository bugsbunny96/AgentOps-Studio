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
//
// Three paths (locked — Session 4 product review):
//   Path A: hasWebsite=true, crawlEnabled=true, websiteUrl=https://...  → queue crawl
//   Path B: hasWebsite=true, crawlEnabled=false                         → manual KB entry
//   Path C: hasWebsite=false, crawlEnabled=false                        → describe in Configure
//
// URL validation:
//   • HTTPS-only (http:// crawls fail silently on most hosts)
//   • Required only when crawlEnabled=true (enforced via superRefine on the union)
//
// NOTE: superRefine is NOT applied here — z.discriminatedUnion requires plain ZodObject
// members (no ZodEffects wrapper). Cross-field validation is done on the union below.
const LearnStepSchema = z.object({
  step: z.literal('learn'),
  hasWebsite: z.boolean(),
  crawlEnabled: z.boolean().default(false),
  websiteUrl: z
    .union([
      z
        .string()
        .url('Enter a valid HTTPS URL (e.g. https://yourcompany.com)')
        .refine(
          (url) => url.startsWith('https://'),
          { message: 'Website URL must use HTTPS (e.g. https://yourcompany.com)' },
        ),
      z.literal(''),
    ])
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
});

// ─── Step 3: Configure — business details ──────────────────────────────────
const ConfigureStepSchema = z.object({
  step: z.literal('configure'),
  // Agent identity
  agentName: z.string().max(50, 'Agent name must be at most 50 characters').optional(),
  // Business context — no character limit; user controls length
  businessDescription: z.string().optional(),
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
  // FAQs — voice-friendly Q&A pairs the AI will use to answer caller questions
  faqs: z
    .array(
      z.object({
        question: z.string().max(200, 'Question max 200 chars'),
        answer: z.string().max(300, 'Answer max 300 chars'),
      }),
    )
    .max(10, 'Max 10 FAQs')
    .optional()
    .default([]),
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
// superRefine on the discriminated union — cross-field validation for the learn step.
// (Cannot apply superRefine directly on LearnStepSchema because ZodEffects breaks
//  discriminatedUnion's discriminator-key introspection in Zod v3.)
export const UpdateOrgSchema = z
  .discriminatedUnion('step', [
    LearnStepSchema,
    ConfigureStepSchema,
    CustomizeStepSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.step === 'learn' && data.crawlEnabled && !data.websiteUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['websiteUrl'],
        message: 'A website URL is required when crawling is enabled',
      });
    }
  });

export type UpdateOrgDto = z.infer<typeof UpdateOrgSchema>;
