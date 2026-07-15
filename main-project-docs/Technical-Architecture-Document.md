# Technical Architecture Document (TAD) - AgentOps Studio

## 1. System Architecture Overview

AgentOps Studio is a multi-tenant SaaS application built on a modern distributed web architecture. The system decouples interactive client operations from the high-throughput, low-latency AI voice processing runtime.

### System Topology Diagram
```
             +-------------------------------------------------+
             |                 Client Layer                    |
             |       (React 19 / Vite / TailwindCSS 4)         |
             +-----------------------+-------------------------+
                                     |
                                     | HTTPS / WSS (Auth & CRUD)
                                     v
             +-------------------------------------------------+
             |                API Gateway &                    |
             |            Backend Application                  |
             |         (Express.js / Node.js / TS)             |
             +--------+-----------------------+--------+--------+
                      |                       |        |
         Mongoose CRUD|                       |        | BullMQ Job Push
                      v                       |        v
             +--------+--------+              |  +-----+--------+
             |  MongoDB Atlas  |              |  |  Redis Cloud |
             | (Tenant Data)   |              |  | (Job Queue & |
             +-----------------+              |  |  Session Cache)|
                                              |  +-----+--------+
                               Webhook Events |        |
                                              |        | Job Pull
                                              v        v
             +--------------------------------+--------+--------+
             |           Exotel Telephony Platform              |
             |   (Indian Virtual / Toll-free / City Numbers)    |
             +-----------------------+-------------------------+
                                     |
                                     | SIP Trunk
                                     v
             +-------------------------------------------------+
             |              Vapi AI Agent Platform             |
             |          (Hosted Voice Agent Runtime)           |
             |   - STT: Deepgram                               |
             |   - LLM: OpenAI (GPT-4o)                        |
             |   - TTS: ElevenLabs / Cartesia                  |
             |   - Languages: English / Hindi / Punjabi         |
             +-------------------------------------------------+
```

---

## 2. Frontend Architecture

The frontend is a Single Page Application (SPA) built using a component-driven architecture with clean state boundaries.

### Technology Stack
*   **Core Framework**: React 19 (leveraging compiler-driven optimizations and asset loading).
*   **Build Tool**: Vite (configured for rapid HMR and module splitting).
*   **Language**: TypeScript (strict mode enabled).
*   **Styling**: TailwindCSS 4 (CSS-first configurations) and shadcn/ui primitives.
*   **State Management**:
    *   **Global Client State**: Redux Toolkit (auth credentials, active tenant/organization selection, user profile).
    *   **Server State (Caching & Sync)**: TanStack Query v5 (managing calls history, voice agent metadata, and team directories).
*   **Form Handling**: React Hook Form with Zod schemas for client-side validation.

### Sidebar Navigation Architecture
The sidebar is a first-class application surface and should be resolved from backend configuration at runtime.
*   **Navigation Model**: Hierarchical tree with four top-level groups: Command Center, AI Management, Administration, Support & Training.
*   **Rendering Rules**: The frontend renders sections from a normalized navigation payload and applies local UI state for collapse, expansion, and active route highlighting.
*   **Responsive Behavior**: Desktop shows a persistent rail, tablet shows a compact icon rail, and mobile uses a slide-over drawer with route selection closing the drawer automatically.
*   **State Persistence**: Collapse state, pinned state, and last expanded group should persist per user and organization.
*   **Accessibility**: Roving tab index, ARIA-expanded attributes, and keyboard shortcuts are required for nested menus.

---

## 3. Backend Architecture

The backend is built as a modular monolithic Express application written in TypeScript. It follows a Clean Layered Architecture pattern to isolate business rules from external frameworks.

### Code Organization Structure
```text
src/
├── config/             # Database connection, environment variables, Vapi/Exotel setup
├── middleware/         # Auth verification, RBAC check, multi-tenant gating
└── modules/
    ├── auth/           # Login, registration, token refresh
    ├── organization/   # Tenants, memberships, onboarding, and invitations
    ├── crawler/        # Headless crawler service and text extraction pipelines
    ├── document/       # Knowledge base Markdown documents and manual uploads
    ├── agent/          # Voice agent configuration profiles and sandbox tests
    ├── call/           # Call logs, Webhooks, recording storage records
    └── analytics/      # Statistics, aggregation pipelines
        ├── routes.ts       # Express endpoint definitions
        ├── controller.ts   # HTTP request mapping & validation
        ├── service.ts      # Pure business logic and transaction orchestration
        └── repository.ts   # Data access queries using Mongoose models
    └── navigation/    # Sidebar config retrieval, feature gating, and menu access logging
        ├── routes.ts
        ├── controller.ts
        ├── service.ts
        └── repository.ts
```

---

## 4. Database Design (MongoDB/Mongoose)

AgentOps Studio implements a logical multi-tenancy model. Every resource document contains an `organizationId` reference. Indexes are configured with `organizationId` as a prefix to guarantee isolation and rapid query resolution.

### Schema Definitions

#### 4.1 Users Collection (`users`)
Tracks login accounts and verification states.
```typescript
const UserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  status: { type: String, enum: ['Active', 'Suspended', 'Pending'], default: 'Pending' }
}, { timestamps: true });
```

#### 4.2 Organizations Collection (`organizations`)
Represents the tenant instance.
```typescript
const OrganizationSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timezone: { type: String, default: 'America/New_York' },
  industry: { type: String, required: true },
  hasWebsite: { type: Boolean, default: false },
  websiteUrl: { type: String, trim: true },
  onboardingStatus: {
    type: String,
    enum: ['REGISTRATION', 'ORG_CREATION', 'WEBSITE_CRAWL', 'BUSINESS_CONFIG', 'VOICE_SETUP', 'COMPLETED'],
    default: 'REGISTRATION'
  },
  businessDescription: { type: String },
  services: [{ type: String }],
  faqs: [{
    question: { type: String },
    answer: { type: String }
  }],
  fallbackNumber: { type: String }, // E.164 format, made optional during onboarding
  contactDetails: {
    email: { type: String },
    phone: { type: String }
  },
  locations: [{ type: String }],
  supportedLanguages: [{ type: String, default: ['en-US'] }],
  industrySpecificFields: { type: Schema.Types.Map, of: String }, // Dynamic fields for industry-specific data
  businessHours: {
    start: { type: String, default: '09:00' }, // 24hr HH:MM format
    end: { type: String, default: '17:00' }
  }
}, { timestamps: true });
```

#### 4.3 Memberships Collection (`memberships`)
Associates users to tenants with specific permissions.
```typescript
const MembershipSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  role: { type: String, enum: ['Owner', 'Admin', 'Member'], required: true }
}, { timestamps: true });
// Compound index to prevent duplicate entries
MembershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
```

#### 4.4 Onboarding Sessions Collection (`onboarding_sessions`)
Stores step progress, draft payloads, and recovery metadata.
```typescript
const OnboardingSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
  currentStep: { type: String, enum: ['Connect', 'Learn', 'Configure', 'Customize', 'Activate'], required: true },
  stepStatus: { type: String, enum: ['NotStarted', 'InProgress', 'Blocked', 'Completed'], default: 'NotStarted' },
  draftPayload: { type: Schema.Types.Mixed, default: {} },
  lastCompletedStep: { type: String },
  resumeToken: { type: String, unique: true },
  expiresAt: { type: Date }
}, { timestamps: true });
```

#### 4.5 Invitations Collection (`invitations`)
Tracks pending workspace joins.
```typescript
const InvitationSchema = new Schema({
  email: { type: String, required: true, lowercase: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  role: { type: String, enum: ['Admin', 'Member'], required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL Index
}, { timestamps: true });
```

#### 4.6 Voice Agents Collection (`voice_agents`)
Stores configuration templates. During call initialization, these attributes feed the Vapi Agent prompt context.
```typescript
const VoiceAgentSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  systemPrompt: { type: String, required: true },
  voiceModel: { type: String, default: 'gpt-4o' },
  // Primary language defaults to English; agent auto-detects and switches to Hindi or Punjabi
  // based on customer speech mid-conversation via Vapi's language detection feature
  supportedLanguages: { type: [String], default: ['en-US', 'hi-IN', 'pa-IN'] },
  primaryLanguage: { type: String, default: 'en-US' },
  voiceSettings: {
    provider: { type: String, enum: ['elevenlabs', 'cartesia'], default: 'elevenlabs' },
    voiceId: { type: String, required: true },
    speed: { type: Number, default: 1.0 },
    pitch: { type: Number, default: 1.0 }
  },
  // Vapi-specific configuration
  vapiAssistantId: { type: String }, // Vapi assistant ID once provisioned
  exotelPhoneNumber: { type: String }, // Exotel Indian number assigned to this agent
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Inactive' }
}, { timestamps: true });
```

#### 4.7 Calls Collection (`calls`)
```typescript
const CallSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'VoiceAgent', required: true, index: true },
  vapiCallId: { type: String, required: true, unique: true }, // Vapi's unique call session ID
  direction: { type: String, enum: ['Inbound', 'Outbound'], required: true },
  duration: { type: Number, default: 0 }, // in seconds
  status: { type: String, enum: ['active', 'completed', 'failed'], default: 'active' },
  callerNumber: { type: String, required: true }, // E.164 format
  recordingUrl: { type: String },
  cost: { type: Number, default: 0 }
}, { timestamps: true });
```

#### 4.8 Transcripts Collection (`transcripts`)
Turn-by-turn log of the conversation. Stored separately to optimize parent Call table queries.
```typescript
const TranscriptSchema = new Schema({
  callId: { type: Schema.Types.ObjectId, ref: 'Call', required: true, unique: true, index: true },
  turns: [{
    speaker: { type: String, enum: ['agent', 'user'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });
```

#### 4.9 Summaries Collection (`summaries`)
AI-extracted intelligence details.
```typescript
const SummarySchema = new Schema({
  callId: { type: Schema.Types.ObjectId, ref: 'Call', required: true, unique: true, index: true },
  summaryText: { type: String, required: true },
  intentDetected: { type: [String], default: [] }, // e.g., ['Emergency', 'Giving']
  actionItems: [{ type: String }],
  resolutionState: { type: String, enum: ['Resolved', 'Transferred', 'Needs_Followup'], default: 'Resolved' }
}, { timestamps: true });
```

#### 4.10 Activity Logs Collection (`activity_logs`)
Audit records for security compliance tracking.
```typescript
const ActivityLogSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., 'AGENT_UPDATE', 'MEMBER_INVITE'
  resource: { type: String, required: true }, // e.g., 'VoiceAgent', 'Membership'
  metadata: { type: Schema.Types.Map, of: String }, // Extra audit details
  ipAddress: { type: String }
}, { timestamps: true });

#### 4.11 Navigation Configurations Collection (`navigation_configurations`)
Stores organization-specific sidebar overrides and visibility rules.
```typescript
const NavigationConfigurationSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  scope: { type: String, enum: ['Default', 'OrganizationOverride'], default: 'OrganizationOverride' },
  sections: [{
    key: { type: String, required: true },
    label: { type: String, required: true },
    order: { type: Number, required: true },
    items: [{
      key: { type: String, required: true },
      label: { type: String, required: true },
      route: { type: String, required: true },
      requiredRoles: [{ type: String, enum: ['Owner', 'Admin', 'Member'] }],
      featureFlagKey: { type: String },
      isVisible: { type: Boolean, default: true }
    }]
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
```

#### 4.12 Feature Flags Collection (`feature_flags`)
Controls rollout and org-specific availability.
```typescript
const FeatureFlagSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  key: { type: String, required: true, index: true },
  enabled: { type: Boolean, default: false },
  rolloutStrategy: { type: String, enum: ['All', 'RolesOnly', 'Percent', 'ExplicitUsers'], default: 'All' },
  targetRoles: [{ type: String, enum: ['Owner', 'Admin', 'Member'] }],
  metadata: { type: Schema.Types.Map, of: String }
}, { timestamps: true });
```

#### 4.13 Subscription Plans Collection (`subscription_plans`)
Represents tiered entitlements that affect navigation visibility.
```typescript
const SubscriptionPlanSchema = new Schema({
  key: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  featureAccess: [{ type: String }],
  maxUsers: { type: Number, default: 5 },
  maxAgents: { type: Number, default: 3 },
  billingCadence: { type: String, enum: ['Monthly', 'Annual'], default: 'Monthly' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
```

### Sidebar Data Relationships
*   Organization 1:1 Navigation Configuration
*   Organization 1:N Feature Flags
*   Subscription Plan 1:N Organizations
*   User N:N Organizations through Memberships
*   Role is stored on Membership and used by navigation access services

### Onboarding Data Relationships
*   User 1:N Onboarding Sessions
*   Organization 1:N Onboarding Sessions
*   Onboarding Session 1:1 draft payload progression
*   Onboarding Session 1:N documents and knowledge base artifacts
*   Organization 1:1 activation status

// New Collection representing Website Knowledge Base pages and manual documents
const DocumentSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: true },
  content: { type: String, required: true }, // Saved in Markdown format
  sourceUrl: { type: String }, // Set if crawled from website URL
  contentType: { type: String, enum: ['crawled', 'uploaded', 'manual'], default: 'manual' },
  lastSyncedAt: { type: Date }
}, { timestamps: true });
const DocumentModel = model('Document', DocumentSchema);
```

---

## 5. API Design

### 5.1 Authentication Module
*   `POST /auth/register`: Register a new user, hashes password, and creates record in `Pending Verification` status.
    *   *Body*: `{ "name": "...", "email": "...", "password": "..." }`
*   `POST /auth/verify-email`: Validates verification token, activates user account, and returns initial session.
    *   *Body*: `{ "token": "..." }`
*   `POST /auth/login`: Authenticate credentials, set HTTP-Only cookies.
    *   *Body*: `{ "email": "...", "password": "..." }`
*   `POST /auth/logout`: Revoke active JWT session.

### 5.2 Onboarding & Organizations Module
*   `POST /onboarding/organization`: Initialize organization during onboarding (Step 2).
    *   *Body*: `{ "name": "...", "slug": "...", "timezone": "...", "industry": "...", "hasWebsite": true|false }`
*   `POST /onboarding/website/crawl`: Initiates background crawl of the website URL (Step 3).
    *   *Body*: `{ "websiteUrl": "..." }`
*   `GET /onboarding/website/crawl/status`: Polling or Server-Sent Events (SSE) endpoint to retrieve crawling progress.
*   `POST /onboarding/business-config`: Save description, hours, supported languages, and custom industry fields (Step 4).
    *   *Body*: `{ "businessDescription": "...", "services": [...], "faqs": [...], "supportedLanguages": [...], "industrySpecificFields": {...} }`
*   `POST /onboarding/voice-agent/setup`: Automatically provision initial voice agent config (Step 5).
    *   *Body*: `{ "name": "...", "voiceId": "...", "provider": "..." }`
*   `POST /onboarding/voice-agent/test-call`: Initiates a Vapi test call via the Exotel SIP trunk for sandbox testing of the provisioned agent.
*   `POST /onboarding/complete`: Finalizes onboarding, creates default workspace, marks organization status as complete, and assigns Owner role (Step 6).
*   `POST /onboarding/save-progress`: Persist current onboarding step and draft data.
*   `GET /onboarding/resume`: Restore onboarding session state for the active user and organization.

### 5.3 Knowledge Base Documents Module
*   `GET /knowledge-base`: Retrieve list of all documents for the active organization.
*   `GET /knowledge-base/:id`: View a specific document's detailed Markdown content.
*   `PATCH /knowledge-base/:id`: Edit Markdown content of a specific document.
*   `DELETE /knowledge-base/:id`: Delete a document.
*   `POST /knowledge-base/upload`: Manually upload text/PDF files to convert and add to the knowledge base.
*   `POST /knowledge-base/re-sync`: Re-trigger the website crawler to synchronize pages.

### 5.4 Members Module
*   `POST /members/invite`: Invite member.
*   `GET /members`: List organization memberships.

### 5.5 Sidebar & Access Module
*   `GET /navigation/sidebar`: Retrieve the role-aware sidebar tree for the active organization.
  *   *Headers*: `X-Organization-ID`
  *   *Response*: Normalized sections, items, route, label, icon, visibility, and active state metadata.
*   `GET /navigation/permissions`: Retrieve effective permissions for the current user and organization.
  *   *Response*: Role, allowed actions, feature flags, and restricted modules.
*   `POST /navigation/access-check`: Validate whether a target route is visible for the current user.
  *   *Body*: `{ "route": "/agents", "organizationId": "..." }`
  *   *Response*: `allowed`, `deniedReason`
*   `GET /feature-flags`: Retrieve effective feature flags for the active organization.
*   `GET /organizations/:id/settings`: Retrieve organization settings that influence sidebar visibility.
*   `DELETE /members/:id`: Remove staff access.

### 5.5 Voice Agents Module
*   `POST /agents`: Create new agent.
*   `GET /agents`: Fetch organization's agents.
*   `PATCH /agents/:id`: Update settings, prompts, language settings, or status.
*   `DELETE /agents/:id`: Soft-delete agent.

### 5.6 Calls Module
*   `GET /calls`: Retrieve paginated calls history.
*   `GET /calls/:id`: Retrieve single call details, transcripts, and summary details.

---

## 6. Integrations & Event Flow

### Website Crawler & Knowledge Base Parser Pipeline
1. **Trigger**: User inputs a website URL in Step 3. Backend triggers a task in Redis/BullMQ.
2. **Headless Crawling**: The crawler worker uses a headless browser (e.g., Puppeteer/Playwright) or Firecrawl API to extract HTML content from pages, skipping media and third-party links.
3. **Markdown Processing**: The raw HTML is converted into clean, readable Markdown text.
4. **Structured Information Extraction**: The text content is sent to OpenAI GPT-4o to parse core business facts, services, FAQs, hours, and contact details, outputting structured JSON for the organization database fields.
5. **Knowledge Base Storage**: Indivdual web pages are saved as documents in the `documents` collection with `contentType: 'crawled'`.
6. **Attachment**: The generated documents are linked to the organization workspace context and are made editable from the dashboard.

### Vapi + Exotel Voice Agent Runtime Pipeline
1.  **Call Ingress**: An inbound call hits the customer's assigned Exotel Indian virtual number (virtual, toll-free, or local city number).
2.  **SIP Routing**: Exotel routes the call via SIP Trunk to the Vapi AI platform.
3.  **Vapi Call Initialization**: Vapi receives the SIP call, looks up the active assistant configuration, and begins the conversational session.
4.  **Webhook Trigger**: Vapi issues `call.started` webhook notifications to the Express Backend.
5.  **Agent Config Fetch**: The Backend receives the webhook, fetches the active agent configuration, and reads associated Markdown pages in the `documents` collection to use as the agent's knowledge base context (injected into the system prompt).
6.  **LLM Execution**: Vapi executes the conversational loop:
    *   **STT**: Deepgram captures user spoken audio and streams transcription tokens.
    *   **Language Detection**: Vapi detects the customer's spoken language mid-conversation. The agent starts in English (primary), and automatically switches to Hindi (`hi-IN`) or Punjabi (`pa-IN`) if the customer speaks in those languages.
    *   **LLM Engine**: OpenAI GPT-4o processes transcription context. The system prompt is dynamically enriched with the organization's business description, knowledge base Markdown files, and multi-lingual response instructions.
    *   **TTS**: ElevenLabs / Cartesia converts response tokens back to natural speech in the detected language.
7.  **Pipeline Events**:
    *   `call.started`: Logged in database via Vapi webhook.
    *   `call.completed`: Telephony session closes; Exotel SIP session terminates.
    *   `transcript.completed`: Vapi aggregates turn-by-turn transcript and pushes to Redis/BullMQ.
    *   `summary.generated`: A background BullMQ worker feeds the transcript to GPT-4o, saving the resulting summary, action items, and outcome badges to Mongoose.

---

## 7. Deployment Strategy

The application leverages containerized scaling and serverless static caching.

```text
               [ Cloudflare DNS & Edge Network ]
                 ├── SSL Termination & WAF Rules
                 ├── Rate Limiting
                 └── Route Path Routing
                      ├── /api/*  => AWS Application Load Balancer
                      └── /*      => Vercel CDN (React Static Build)

          [ AWS ECS / Fargate Cluster ]         [ MongoDB Atlas Cloud ]
            └── Docker Containers                 └── Primary + Secondary Replica
            └── Node.js Express App               └── Auto-scaling storage
            └── Vapi AI Agent Runtime (Hosted)    
                                                [ Redis Cloud Cluster ]
                                                  └── BullMQ task queue
                                                  └── Session stores
```
*   **Frontend**: Built and served from Vercel's global Edge CDN, utilizing cached assets and environment variable injection during CI/CD.
*   **Backend Server**: Implemented as Dockerized containers running on AWS ECS (Fargate) behind an Application Load Balancer, configured to auto-scale based on memory and request throughput thresholds.
*   **Database**: Managed MongoDB Atlas replica sets with multi-region replication and daily encrypted snapshots.
*   **Queues & Session**: Redis Cloud instance handles BullMQ delayed tasks (summarization jobs, notification SMS sends via Resend/Twilio API) and caching user authentication states.
