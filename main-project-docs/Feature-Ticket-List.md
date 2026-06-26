# Feature Ticket List - AgentOps Studio MVP

This document contains detailed Jira-style development tickets for all 15 core features identified for the AgentOps Studio MVP.

---

### A-001: Authentication System (Sign up, Log in, Log out)
*   **Priority**: P0
*   **Estimated Effort**: 5 Days
*   **Dependencies**: None (Base Framework Setup)
*   **Description**: 
    Implement JWT-based authentication system. Users must be able to register an account, log in securely, and log out. Tokens must be stored in HTTP-Only, Secure, SameSite=Strict cookies to protect against XSS and CSRF.
*   **Acceptance Criteria**:
    1. Register endpoint accepts name, email, and password, hashes passwords with bcrypt (12 rounds), and saves user as `Pending`.
    2. Log in endpoint validates credentials and returns access token (15m expiry) and refresh token (7d expiry) via HTTP-Only cookies.
    3. Log out endpoint clears both cookies and blacklists the refresh token in Redis.
    4. Frontend forms include Zod validation, displaying error messages on invalid input.

---

### A-002: Password Reset & Email Verification
*   **Priority**: P0
*   **Estimated Effort**: 2 Days
*   **Dependencies**: A-001, A-015
*   **Description**:
    Provide password recovery and verification routes. Email verification is mandatory before access to the onboarding flow is granted.
*   **Acceptance Criteria**:
    1. Registering sends an email verification link with a secure, random token (expires in 24 hours).
    2. Verification route validates token, updates user status to `Active`.
    3. User is automatically logged in and redirected to the onboarding process (`/onboarding/org-creation`).
    4. Forgot-password endpoint accepts email, generates a token (expires in 1 hour), and dispatches a reset link.
    5. Reset-password endpoint validates token and updates password hash.

---

### A-003: Onboarding Organization Workspace Creation
*   **Priority**: P0
*   **Estimated Effort**: 2 Days
*   **Dependencies**: A-001
*   **Description**:
    Implement Step 2 of onboarding. Allow verified users to create an organization by entering basic details and answering the website availability question.
*   **Acceptance Criteria**:
    1. POST endpoint `/onboarding/organization` validates name, unique slug, timezone, industry / business type, and hasWebsite boolean.
    2. Auto-generates organization record in `REGISTRATION` status (associated with creator as temporary Owner).
    3. Prevents slug collisions by auto-incrementing suffixes on duplicates.
    4. UI displays step 2 forms and handles transitions; if hasWebsite is true, redirects to Step 3 (`/onboarding/website-crawl`), otherwise skips to Step 4 (`/onboarding/business-config`).

---

### A-004: Team Member Invitations
*   **Priority**: P0
*   **Estimated Effort**: 3 Days
*   **Dependencies**: A-003, A-015
*   **Description**:
    Allow Owners and Admins to invite team members to join their organization by entering their email address and assigning a role.
*   **Acceptance Criteria**:
    1. Invite modal accepts email address and role selection (Admin, Member).
    2. Generates an invitation token (expires in 7 days) and sends an invite email.
    3. Accept route `/accept-invite/:token` allows the invitee to register or log in, then links them to the organization memberships.
    4. Inviting a user who is already a member of the organization throws a 409 Conflict.

---

### A-005: Role-Based Access Control (RBAC)
*   **Priority**: P0
*   **Estimated Effort**: 2 Days
*   **Dependencies**: A-001, A-004
*   **Description**:
    Implement backend guards and frontend components visibility scoping based on user roles (Owner, Admin, Member).
*   **Acceptance Criteria**:
    1. Express middleware `checkRole(['Owner', 'Admin'])` evaluates membership contexts.
    2. Accessing restricted API routes with insufficient roles returns HTTP 403 Forbidden.
    3. Frontend hides action buttons (e.g., "Invite Member", "Edit Agent") for users with `Member` roles.
    4. Owners can manage billing settings; Admins and Members are restricted.

---

### A-006: Multi-Tenant Query Middleware
*   **Priority**: P0
*   **Estimated Effort**: 3 Days
*   **Dependencies**: A-003, A-005
*   **Description**:
    Implement routing and database-level middleware to ensure complete isolation of tenant data across all API requests.
*   **Acceptance Criteria**:
    1. Middleware validates that the active user belongs to the organization passed in the `X-Organization-ID` header.
    2. Injects the tenant organization ID (`req.orgId`) into the Express request object.
    3. Rejects requests lacking organization association with an HTTP 403.
    4. Mongoose queries strictly scope lookups using `organizationId` parameter.

---

### A-007: Voice Agent CRUD Management
*   **Priority**: P0
*   **Estimated Effort**: 4 Days
*   **Dependencies**: A-006
*   **Description**:
    Create administrative UI and backend endpoints to manage AI voice agents, including system prompts and voice models.
*   **Acceptance Criteria**:
    1. Provides standard CRUD operations: Create, Read, Update, Delete.
    2. Form inputs include: Agent Name, System Prompt, Voice Provider (ElevenLabs, Cartesia), and Voice ID.
    3. Agent state updates (Active vs Inactive) toggle routing permissions.
    4. Prompts are validated to confirm that required variables are defined.

---

### A-008: Vapi + Exotel Voice Gateway Integration
*   **Priority**: P0
*   **Estimated Effort**: 7 Days
*   **Dependencies**: A-007
*   **Description**:
    Integrate backend with Vapi and Exotel APIs to handle inbound SIP call connections, provision AI agents, and manage voice agent runs. Exotel provides Indian virtual/toll-free/city numbers with SIP trunking; Vapi handles the AI agent runtime (STT → LLM → TTS pipeline).
*   **Acceptance Criteria**:
    1. Inbound Vapi webhooks are verified using cryptographic signatures.
    2. Validates operational hours and fallback paths before starting a call session.
    3. Vapi assistant is provisioned and linked to the active organization's voice agent configuration and knowledge base.
    4. Vapi pipeline bridges Deepgram STT, OpenAI GPT-4o LLM, and ElevenLabs/Cartesia TTS.
    5. Agent supports multi-lingual conversations: starts in English, auto-detects and switches to Hindi or Punjabi based on customer speech.

---

### A-009: Call History Logs
*   **Priority**: P0
*   **Estimated Effort**: 3 Days
*   **Dependencies**: A-008
*   **Description**:
    Store and display call logs detailing call direction, caller number, duration, associated agent, and timestamp.
*   **Acceptance Criteria**:
    1. Webhook `call.completed` writes records into Mongoose `calls` collection.
    2. Renders a paginated, sortable, and filterable table on the `/calls` route.
    3. Displays status badges indicating call outcomes (Resolved, Transferred, Abandoned).
    4. Multi-tenant checks prevent viewing calls outside authorized organizations.

---

### A-010: Conversational Transcripts
*   **Priority**: P0
*   **Estimated Effort**: 3 Days
*   **Dependencies**: A-009
*   **Description**:
    Store turn-by-turn conversational blocks and render them in a responsive transcript viewer.
*   **Acceptance Criteria**:
    1. Vapi call outputs turn events via webhook, which are aggregated and saved to the `transcripts` collection.
    2. UI displays alternative chat-bubble bubbles: Left (Caller) vs Right (Agent).
    3. Renders timestamps for each conversational turn.
    4. Search bar highlights text matches in real time.

---

### A-011: AI-Generated Call Summaries
*   **Priority**: P0
*   **Estimated Effort**: 3 Days
*   **Dependencies**: A-010
*   **Description**:
    Feed finished call transcripts to OpenAI GPT-4o to extract text summaries, action items, outcomes, and intent tags.
*   **Acceptance Criteria**:
    1. Completed call triggers a BullMQ worker job to generate summaries.
    2. The job uses OpenAI structured JSON output to extract summary text and intent arrays.
    3. Saves generated metadata into the `summaries` collection.
    4. Detailed call view displays summaries, action items, and intent tags.

---

### A-012: Dashboard Analytics
*   **Priority**: P1
*   **Estimated Effort**: 4 Days
*   **Dependencies**: A-009, A-011
*   **Description**:
    Aggregate call data and render charts displaying call volumes, average durations, agent utilization, and outcomes.
*   **Acceptance Criteria**:
    1. MongoDB aggregation queries calculate daily call counts and average durations.
    2. Charts render using Recharts (or similar library) with support for date range filters.
    3. Display key performance cards (e.g., total calls, average duration, call resolution rate).
    4. Metrics strictly respect tenant organization boundaries.

---

### A-013: Security Audit Logs
*   **Priority**: P1
*   **Estimated Effort**: 2 Days
*   **Dependencies**: A-006
*   **Description**:
    Record and list security events and administrative actions (logins, invitations, agent updates).
*   **Acceptance Criteria**:
    1. Backend interceptor or service method logs mutations to the `activity_logs` collection.
    2. Captures actor ID, action name, targeted resource, timestamp, and client IP address.
    3. Renders a read-only tabular audit viewer accessible to Owners and Admins.
    4. Logs are immutable; backend API prevents update/delete requests.

---

### A-014: Workspace Settings Module
*   **Priority**: P1
*   **Estimated Effort**: 2 Days
*   **Dependencies**: A-006
*   **Description**:
    Provide forms for updating organization details, timezone configurations, operating hours, and fallback numbers.
*   **Acceptance Criteria**:
    1. Settings page allows editing organization metadata.
    2. Form inputs are validated (e.g., checking fallback phone numbers match E.164 formats).
    3. Operating hours inputs validate start time is before end time.
    4. Updates are audited under `SETTING_FALLBACK_ROUTE_UPDATE` activity logging.

---

### A-015: Email Notification Service
*   **Priority**: P1
*   **Estimated Effort**: 3 Days
*   **Dependencies**: None (Infrastructure Setup)
*   **Description**:
    Integrate Resend API to handle transaction email sends (verification, password resets, team invitations).
*   **Acceptance Criteria**:
    1. Setup Resend mail transit configurations using environment variables.
    2. Templates render using react-email or simple HTML.
    3. Email dispatch tasks are queued via BullMQ to avoid locking request threads.
    4. Tracks dispatch success and logs failed attempts for monitoring.

---

### A-016: Onboarding Wizard UI Framework
*   **Priority**: P0
*   **Estimated Effort**: 3 Days
*   **Dependencies**: A-001, A-002
*   **Description**:
    Create a multi-step onboarding wizard layout (`OnboardingLayout`) and step controller to manage registration-to-dashboard progression (Steps 2-6).
*   **Acceptance Criteria**:
    1. Stepper indicator visually communicates the user's progress through the onboarding phases.
    2. Onboarding state machine persists user progress in Redux; reloading does not lose inputted step details.
    3. Handles forward/backward step transitions with form state validations using React Hook Form and Zod.
    4. Restricts user access to general dashboard features until onboarding is marked complete.

---

### A-017: Website Crawler & Markdown Extraction Engine
*   **Priority**: P0
*   **Estimated Effort**: 4 Days
*   **Dependencies**: A-003, A-016
*   **Description**:
    Build Step 3 crawling engine. Allow users selecting website "Yes" to crawl their pages, extract text content, and parse it to structured Markdown (.md).
*   **Acceptance Criteria**:
    1. UI provides URL input with client-side regex URL validation.
    2. Submitting triggers a backend crawl task in Redis/BullMQ.
    3. Crawler uses Puppeteer or Firecrawl to extract page texts, ignoring headers, footers, and scripts.
    4. Passes page text to OpenAI GPT-4o to output structured Markdown documents saved in `documents` collection.
    5. SSE endpoint `/onboarding/website/crawl/status` allows the frontend to display real-time crawling status logs.

---

### A-018: Knowledge Base Management API & Dashboard UI
*   **Priority**: P1
*   **Estimated Effort**: 4 Days
*   **Dependencies**: A-006, A-017
*   **Description**:
    Build the Knowledge Base management dashboard where users can view, edit, re-sync website documents, or upload new files.
*   **Acceptance Criteria**:
    1. Create a `documents` database collection and API CRUD routes (`GET /knowledge-base`, `PATCH /knowledge-base/:id`, etc.).
    2. Add Knowledge Base sidebar navigation item and layout displaying a list of documents.
    3. Implement Document Viewer and inline Markdown Document Editor.
    4. Triggering "Re-sync Website" schedules a new crawl, overriding existing pages.
    5. "Upload Documents" accepts and parses text and PDF documents, appending them to the knowledge base.

---

### A-019: Dynamic Industry Configuration Forms
*   **Priority**: P1
*   **Estimated Effort**: 2 Days
*   **Dependencies**: A-003, A-016
*   **Description**:
    Build Step 4 configuration page to collect general business details, operating hours, FAQs, and dynamic fields customized for the selected industry.
*   **Acceptance Criteria**:
    1. Collects business description, services, FAQs, business hours, locations, and languages.
    2. Dynamic form renders custom input fields based on selected industry (e.g. clinic specifications for Healthcare, booking details for Travel).
    3. Form inputs validated via Zod schemas matched to the specific industry type.
    4. Submits payload to `/onboarding/business-config`, saving to the organization's database record.

---

### A-020: Vapi Test Call Sandbox Widget
*   **Priority**: P0
*   **Estimated Effort**: 4 Days
*   **Dependencies**: A-008, A-016
*   **Description**:
    Build Step 5 testing sandbox. Allow users to initiate a Vapi test call to speak with the auto-provisioned AI agent. The test call is routed via Exotel SIP trunk so it replicates the real production call path.
*   **Acceptance Criteria**:
    1. Auto-provisions an initial Vapi assistant config using the extracted business configuration and knowledge base documents.
    2. Backend endpoint `POST /onboarding/voice-agent/test-call` triggers a Vapi outbound test call to the user's registered phone number.
    3. Sandbox UI includes: Initiate Test Call button, live call status indicator, real-time transcript box, and language indicator showing active language (English / Hindi / Punjabi).
    4. Sandbox configuration panel allows updating agent settings (speed, pitch, prompt, supported languages) and re-provisioning the Vapi assistant instantly.
    5. Clicking "Complete Onboarding" activates the organization, registers Owner memberships, and redirects the user to `/dashboard`.

---

### A-021: Sidebar Navigation System
*   **Priority**: P0
*   **Estimated Effort**: 4 Days
*   **Dependencies**: A-005, A-006, A-014, A-018
*   **Description**:
    Build the role-aware sidebar navigation shell for all authenticated routes, including collapse behavior, organization-specific menu resolution, and mobile drawer support.
*   **Acceptance Criteria**:
    1. Sidebar renders the approved hierarchy: Command Center, AI Management, Administration, and Support & Training.
    2. Menu items are filtered by role, organization, onboarding status, subscription plan, and feature flags.
    3. Desktop supports expanded and collapsed states; mobile uses a drawer with focus trap and close-on-select behavior.
    4. Active route state persists across reloads and deep links.
    5. Navigation events are logged for analytics and audit visibility.
    6. Keyboard navigation and screen-reader labels are validated for accessibility.

---

### A-022: Guided Onboarding Flow System
*   **Priority**: P0
*   **Estimated Effort**: 6 Days
*   **Dependencies**: A-001, A-002, A-003, A-017, A-018, A-020
*   **Description**:
    Build the five-step onboarding state machine with save/resume, validation gates, progress persistence, and activation controls.
*   **Acceptance Criteria**:
    1. Onboarding persists step status and draft payloads server-side for Connect, Learn, Configure, Customize, and Activate.
    2. Users can save progress, refresh, sign out, and resume without losing work.
    3. Each step blocks progression until required validations pass.
    4. Activation is disabled until knowledge base, agent, and test validations succeed.
    5. Failed crawl or test states expose retry and recovery actions.
    6. Progress indicators and completion states are visible on mobile and desktop.
