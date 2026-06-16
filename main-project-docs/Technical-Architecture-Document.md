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
             |                 LiveKit Cloud                    |
             |       (SIP Gateways / WebRTC Room Gateway)       |
             +-----------------------+-------------------------+
                                     |
                                     | WebRTC Audio Streams
                                     v
             +-------------------------------------------------+
             |              LiveKit Agent SDK                  |
             |       (Python/Node Runtime on AWS ECS)          |
             |   - STT: Deepgram                               |
             |   - LLM: OpenAI Realtime (GPT-4o)               |
             |   - TTS: ElevenLabs / Cartesia                  |
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

---

## 3. Backend Architecture

The backend is built as a modular monolithic Express application written in TypeScript. It follows a Clean Layered Architecture pattern to isolate business rules from external frameworks.

### Code Organization Structure
```text
src/
├── config/             # Database connection, environment variables, LiveKit setup
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

#### 4.4 Invitations Collection (`invitations`)
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

#### 4.5 Voice Agents Collection (`voice_agents`)
Stores configuration templates. During call initialization, these attributes feed the LiveKit Agent prompt context.
```typescript
const VoiceAgentSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  systemPrompt: { type: String, required: true },
  voiceModel: { type: String, default: 'gpt-4o-realtime' },
  languageCode: { type: String, default: 'en-US' }, // Language configuration setting
  voiceSettings: {
    provider: { type: String, enum: ['elevenlabs', 'cartesia'], default: 'elevenlabs' },
    voiceId: { type: String, required: true },
    speed: { type: Number, default: 1.0 },
    pitch: { type: Number, default: 1.0 }
  },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Inactive' }
}, { timestamps: true });
```

#### 4.6 Calls Collection (`calls`)
```typescript
const CallSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'VoiceAgent', required: true, index: true },
  livekitRoomId: { type: String, required: true, unique: true },
  direction: { type: String, enum: ['Inbound', 'Outbound'], required: true },
  duration: { type: Number, default: 0 }, // in seconds
  status: { type: String, enum: ['active', 'completed', 'failed'], default: 'active' },
  callerNumber: { type: String, required: true }, // E.164 format
  recordingUrl: { type: String },
  cost: { type: Number, default: 0 }
}, { timestamps: true });
```

#### 4.7 Transcripts Collection (`transcripts`)
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

#### 4.8 Summaries Collection (`summaries`)
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

#### 4.9 Activity Logs Collection (`activity_logs`)
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
*   `POST /onboarding/voice-agent/test-token`: Generates a short-lived LiveKit room token for WebRTC testing in the sandbox.
*   `POST /onboarding/complete`: Finalizes onboarding, creates default workspace, marks organization status as complete, and assigns Owner role (Step 6).

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

### LiveKit Voice Agent Runtime Pipeline
1.  **Call Ingress**: An inbound call hits the SIP Gateway (e.g., Twilio or Telnyx).
2.  **Room Creation**: Telephony triggers LiveKit Cloud, spawning a WebRTC room.
3.  **Webhook Trigger**: LiveKit issues room creation notifications to the Express Backend.
4.  **Agent Spawn**: The Backend authorizes the agent, fetches the active agent configuration, reads associated Markdown pages in the `documents` collection to append as the agent's knowledge base context, and signals the LiveKit Agent Runner.
5.  **LLM Execution**: The runner executes the conversational loop:
    *   **STT**: Deepgram captures user spoken audio, streams token outputs.
    *   **LLM Engine**: OpenAI Realtime API processes transcription context. The system prompt is dynamically enriched with the organization's business description and the corresponding knowledge base Markdown files.
    *   **TTS**: ElevenLabs / Cartesia converts response tokens back to natural speech.
6.  **Pipeline Events**:
    *   `call.started`: Logged in database.
    *   `call.completed`: Telephony session closes.
    *   `transcript.completed`: The LiveKit SDK aggregates turns and pushes to Redis/BullMQ.
    *   `summary.generated`: A background BullMQ worker feeds the transcript to GPT-4o, saving the resulting summary, actions items, and outcome badges to Mongoose.

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
            └── Python LiveKit Agent Runners      
                                                [ Redis Cloud Cluster ]
                                                  └── BullMQ task queue
                                                  └── Session stores
```
*   **Frontend**: Built and served from Vercel's global Edge CDN, utilizing cached assets and environment variable injection during CI/CD.
*   **Backend Server**: Implemented as Dockerized containers running on AWS ECS (Fargate) behind an Application Load Balancer, configured to auto-scale based on memory and request throughput thresholds.
*   **Database**: Managed MongoDB Atlas replica sets with multi-region replication and daily encrypted snapshots.
*   **Queues & Session**: Redis Cloud instance handles BullMQ delayed tasks (summarization jobs, notification SMS sends via Resend/Twilio API) and caching user authentication states.
