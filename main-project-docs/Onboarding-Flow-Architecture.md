# Onboarding Flow Architecture - AgentOps Studio

## 1. Purpose
The onboarding module guides a new user from account creation to a fully activated organization in five controlled steps: Connect, Learn, Configure, Customize, and Activate. The experience must support save/resume, error recovery, role-aware permissions, and tenant isolation.

## 2. Functional Workflow

> **Design Review Notes** (Session 4 — 2026-06-26): Steps reviewed by Senior Product Architect.
> All step names are locked. Only content, fields, and flow within each step may change.
> Decisions marked [LOCKED] are finalized and implemented.

### Step 1 — Connect [LOCKED]

**Purpose**: Establish org identity. Creates the Organization, Membership (Owner), and OnboardingSession records.

**Fields**:
* `Business name` (required) — min 2, max 100 chars. Seeds AI greeting ("Thank you for calling {name}"), slug, KB title, all emails.
* `Industry` (required) — predefined dropdown, 11 options. Drives Configure defaults (suggested services, terminology, tone). No free text.
* `Timezone` (required, visible) — auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`; curated dropdown shown to user as a collapsed confirm chip (editable). Fallback: `Asia/Kolkata`. Drives business hours in Configure step.

**Removed / Deferred**:
* Logo → auto-fetched from domain (Clearbit) after Step 2. No form field.
* Agent persona name → Step 4 — Customize
* Primary phone number → Step 4 — Customize (fallback number) or post-onboarding
* Primary language → Step 4 — Customize

**UX Decisions** [LOCKED]:
* Page heading: "Let's set up your AI receptionist" (not "Connect your business")
* Sub-heading: "First, tell us about your business."
* Business name autofocused on mount
* Industry hint: "This helps your AI use the right language and terminology for your sector."
* CTA button: "Create my workspace →" (not "Continue")
* No Skip — all fields are mandatory
* Layout personalises from Step 2: "Setting up your AI agent for [Business Name]" appears below progress bar

**Backend**:
* `POST /api/v1/onboarding/org` → creates `Organization`, `Membership` (Owner), `OnboardingSession`
* Slug auto-generated from name; collision-safe (counter suffix up to 20 attempts)
* 1-org limit enforced: `409 ORG_LIMIT_REACHED` if user already has an Owner Membership

**Data reuse downstream**:
* `Organization.name` → AI greeting, dashboard, KB title, all system prompts
* `Organization.industry` → Configure step pre-fills services + FAQ; AI system prompt terminology
* `Organization.timezone` → Configure step pre-fills business hours; AI runtime routing

---

### Step 2 — Learn [LOCKED]

**Purpose**: Determine website presence and crawl intent. Route to appropriate Configure experience based on the chosen path. Queue the website crawl job immediately when Path A is selected.

**Three explicit paths** (not a Yes/No toggle):

| Path | Selection | `hasWebsite` | `crawlEnabled` | `websiteUrl` | Effect |
|---|---|---|---|---|---|
| A | "Yes, scan my website" | true | true | required (https://) | BullMQ crawl queued; Configure pre-populated from results |
| B | "I'll add content manually" | true | false | — | Configure shows manual-entry prompts |
| C | "No website yet" | false | false | — | Configure shows "describe your business" prompt |

**Fields**:
* `hasWebsite` (bool, required) — stored on Org
* `crawlEnabled` (bool, required, default false) — NEW field on Org; true only for Path A
* `websiteUrl` (string, optional unless crawlEnabled=true) — HTTPS-only; validated as public URL

**Removed**:
* Old Yes/No 2-button toggle → replaced by 3-path card selector
* "Skip" button → removed; Path C ("No website yet") is the explicit no-website choice

**Schema change**: `Organization.crawlEnabled: Boolean, default: false` — added to model, Zod schema, service, frontend types.

**URL validation** (locked):
* Must be valid URL format
* Must start with `https://` — http:// rejected with clear error
* Required only when `crawlEnabled: true` (enforced via Zod `superRefine`)
* Head-check pre-flight (L2.F5 scope): non-blocking reachability warning surfaced before navigation

**UX decisions** (locked):
* Path A card shown first with "Recommended" badge — leads with automation
* Path B copy: "I'll add content manually" (not "skip website")
* Path C copy: "No website yet" (not "skip" — intentional and non-judgmental)
* Contextual message shown below selection confirming consequence of each path
* URL field appears inline below selection when Path A chosen (no modal, no separate screen)
* Continue button disabled until a path is selected
* Crawl status shown as "Crawling…" spinner on Step 2 circle in progress bar after submission

**Automation triggered by Path A** (queued at submit, not at Activate):
* BullMQ crawl job created immediately; `KnowledgeBase` record created with `status: 'crawling'`
* Clearbit logo backfill fires within 5s of URL save
* Configure step receives crawl results as pre-populated suggestions (editable) as they arrive
* Industry auto-validation: GPT-4o classifies crawl text and surfaces soft prompt if industry differs from Step 1 selection

**Backend**:
* `PATCH /api/v1/onboarding/org` `{ step: 'learn', hasWebsite, crawlEnabled, websiteUrl? }`
* Service: persists `hasWebsite`, `crawlEnabled`, `websiteUrl` on Organization; advances `onboardingStatus → WEBSITE_CRAWL`

**Data reuse downstream**:
* `crawlEnabled` → KB module determines whether to run crawl pipeline or prompt manual entry
* `websiteUrl` → KB source record; Clearbit logo; industry auto-suggest; AI context ("visit us at {url}")
* Crawl documents → Configure pre-population; KB module; AI RAG retrieval

---

### Step 3 — Configure

**Purpose**: Collect business description, services, business hours, and contact details. Pre-populated from industry (Step 1) and crawl results (Step 2) where available.

**Status**: Under design review — see session notes.

---

### Step 4 — Customize

**Purpose**: Select AI agent languages and set fallback call-transfer number. Agent persona name scoped here.

**Fields confirmed**:
* `Supported languages` (required, min 1) — en-US, hi-IN, pa-IN checkboxes
* `Fallback number` (optional) — transfer destination when AI can't handle the call
* Agent persona name (TBD — under review)

**Status**: Under design review — see session notes.

---

### Step 5 — Activate

**Purpose**: Confirm setup is complete and launch the AI agent. Vapi test-call widget placeholder until L3 (Voice AI).

**Current CTA**: "Launch my AI agent" → `POST /api/v1/onboarding/complete` → sets `onboardingStatus: COMPLETED` → navigates to `/dashboard`.

**Status**: L3 placeholder in place. Full Vapi sandbox widget deferred to L3.F2.

## 3. User Flow
* **New User Journey**: register, verify email, create organization, complete onboarding, reach dashboard.
* **Organization Owner Journey**: approve settings, configure brand and routing, test agent, activate workspace.
* **Team Invitation Flow**: invitee joins after verification and inherits onboarding-complete access based on membership role.
* **Voice Agent Setup Flow**: owner/admin configures prompt, language, routing, and test calls.
* **Knowledge Base Creation Flow**: website scan or upload sources generate documents, then owner reviews and edits content.
* **Activation Flow**: final validation gates confirm readiness before the organization is marked live.
* **Recovery Scenarios**: users can resume after refresh, retry crawl failures, rerun agent tests, or revisit incomplete steps without losing saved data.

## 4. Backend Flow
* Registration processing creates a pending user and secure verification token.
* Email verification logic activates the account and unlocks onboarding routes.
* Organization creation logic initializes tenant records, default owner membership, and onboarding session state.
* Website crawling workflow validates the URL, crawls allowed pages, extracts text, and queues enrichment jobs.
* Knowledge base generation pipeline converts extracted content to structured documents and stores version history.
* Agent provisioning workflow creates a draft agent with baseline prompt, language, and routing settings.
* Vapi + Exotel integration flow provisions the AI assistant, initiates a test call via SIP trunk, and validates agent connectivity and multi-lingual response quality.
* Activation workflow runs final readiness checks, persists activation status, and publishes the workspace as live.
* Audit logging records every major mutation, failed validation, and activation event.

## 5. Database Requirements

### Users
* `name`
* `email`
* `passwordHash`
* `status`
* `emailVerifiedAt`

### Organizations
* `name`
* `slug`
* `timezone`
* `industry`
* `hasWebsite`
* `onboardingStatus`

### Memberships
* `userId`
* `organizationId`
* `role`

### Invitations
* `email`
* `organizationId`
* `role`
* `token`
* `expiresAt`

### Onboarding Sessions
* `userId`
* `organizationId`
* `currentStep`
* `stepStatus`
* `draftPayload`
* `lastCompletedAt`

### Knowledge Bases
* `organizationId`
* `title`
* `sourceType`
* `status`

### Documents
* `organizationId`
* `title`
* `content`
* `sourceUrl`
* `contentType`

### Agents
* `organizationId`
* `name`
* `status`
* `voiceProvider`
* `languageCode`

### Agent Configurations
* `agentId`
* `promptVersion`
* `businessHours`
* `routingRules`
* `customInstructions`

### Activation Status
* `organizationId`
* `isLive`
* `activatedAt`
* `activatedBy`
* `validationSummary`

## 6. API Requirements

### Authentication
* `POST /api/v1/auth/register`
* `POST /api/v1/auth/login`
* `POST /api/v1/auth/verify-email`
* `POST /api/v1/auth/password-reset`

### Organization
* `POST /api/v1/organizations`
* `PATCH /api/v1/organizations/:id`
* `GET /api/v1/organizations/:id`

### Knowledge Base
* `POST /api/v1/onboarding/website-scan`
* `POST /api/v1/onboarding/knowledge-base/generate`
* `PATCH /api/v1/knowledge-bases/:id`

### Voice Agents
* `POST /api/v1/agents`
* `PATCH /api/v1/agents/:id/configure`
* `POST /api/v1/agents/:id/test`
* `POST /api/v1/agents/:id/activate`

### Onboarding
* `POST /api/v1/onboarding/save-progress`
* `GET /api/v1/onboarding/resume`
* `POST /api/v1/onboarding/complete`

## 7. Validation Rules
* Registration requires unique email, valid password strength, and accepted terms.
* Email verification must reject expired, reused, or malformed tokens.
* Organization slug must be unique per tenant namespace and normalized to lowercase.
* Website URL must use HTTP or HTTPS and reject private-network or malformed URLs.
* Knowledge base generation must block empty scans, unsupported file types, and duplicate sources.
* Agent configuration must validate required prompt variables, language codes, and business hours order.
* Activation readiness must fail when required steps are incomplete, crawl jobs fail, or agent tests fail.

## 8. Acceptance Criteria
* Registration completes in under 2 minutes for a typical user.
* Organization creation persists tenant, owner membership, and onboarding session atomically.
* Website scanning produces usable documents or a clear failure state with retry options.
* Knowledge base creation stores source metadata and supports edit/resync flows.
* Voice agent setup creates a testable draft agent before activation.
* Onboarding progress survives refresh and device size changes.
* Agent testing returns actionable pass/fail feedback.
* Activation only succeeds when all readiness checks pass.

## 9. Missing Requirements Discovered
* Explicit onboarding session persistence is not yet modeled in the existing docs.
* Draft vs live agent states need separate lifecycle definitions.
* Final activation validation should include crawl completion, document presence, and agent test success.
* Error recovery states for crawl and test failures need clearer ownership and retry rules.
* Save/resume requires a versioned draft payload store, not just client-side state.

## 10. Recommendations
* Persist onboarding progress on the server, not only in Redux.
* Treat onboarding as a state machine with explicit per-step status.
* Add retry-safe crawl and test operations with idempotency keys.
* Show completion confidence indicators so users know what still blocks activation.
* Use progressive disclosure so the user sees only the next required action, not the whole implementation surface at once.
