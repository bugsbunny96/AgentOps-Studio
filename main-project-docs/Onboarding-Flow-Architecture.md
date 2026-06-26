# Onboarding Flow Architecture - AgentOps Studio

## 1. Purpose
The onboarding module guides a new user from account creation to a fully activated organization in five controlled steps: Connect, Learn, Configure, Customize, and Activate. The experience must support save/resume, error recovery, role-aware permissions, and tenant isolation.

## 2. Functional Workflow

### Step 1 - Connect
* User Registration
* Email Verification
* Organization Creation
* Initial Account Setup

### Step 2 - Learn
* Website Analysis
* Knowledge Base Generation
* Business Niche Selection from dropdown
* Business Information Collection
* Industry-Specific Configuration

### Step 3 - Configure
* Voice Agent Configuration
* AI Settings
* Language Selection
* Business Hours
* Call Routing Rules
* Agent Prompt Configuration

### Step 4 - Customize
* Branding
* Voice Selection
* Knowledge Base Editing
* Agent Personality
* Custom Instructions

### Step 5 - Activate
* Test Voice Agent
* Validation Checks
* Final Review
* Go Live

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
