# MVP Development Roadmap - AgentOps Studio

The AgentOps Studio MVP is structured as a 5-week execution strategy, grouping features into clean, testable phases.

---

## 1. Development Phases

```text
Phase 1: Foundation     Phase 2: Onboarding     Phase 3: Voice AI       Phase 4: Intelligence   Phase 5: Observability
   [ Week 1 ]              [ Week 2 ]              [ Week 3 ]              [ Week 4 ]              [ Week 5 ]
  Repository setup        Authentication          LiveKit setup           Transcripts             Dashboard charts
  DB configurations       Onboarding wizard       Voice configurations    AI summarizations       Audit logs
  Tailwind design system  Crawler & KB editor     Webhook integrations    BullMQ workflows        Production deployment
```

### Phase 1 — Foundation (Week 1)
*   **Focus**: Establish repository structures, tooling, pipeline automation, and base design tokens.
*   **Tasks**:
    *   Setup repository structure with TypeScript, ESLint, and configuration parameters.
    *   Establish database connection configurations (MongoDB Atlas, Redis connection wrappers).
    *   Configure CI/CD pipelines (GitHub Actions building Docker containers and pushing to Vercel/AWS).
    *   Implement frontend design system tokens using TailwindCSS 4 and shadcn/ui.
*   **Deliverable**: Working SaaS Skeleton (authenticated routers and database status checks active).

### Phase 2 — Identity & Onboarding (Week 2)
*   **Focus**: User authentication, multi-step organization onboarding wizard, website crawling, knowledge base generation, dynamic configs, and LiveKit audio sandbox testing.
*   **Tasks**:
    *   Implement Registration & Email Verification endpoints (FR-001, FR-004) redirecting users to `/onboarding`.
    *   Develop the 5-step Onboarding Wizard UI (stepper, forms, and step controllers).
    *   Build the website crawler and OpenAI GPT-4o HTML-to-Markdown parser (A-017).
    *   Build the Knowledge Base editor, document viewer, and manual uploader dashboard interface (A-018).
    *   Implement dynamic business configuration forms adapting inputs to the user's selected industry (A-019).
    *   Integrate the LiveKit WebRTC client sandbox for immediate voice agent audio testing (A-020).
    *   Build multi-tenant auth middleware (`validateOrganization()`) and onboarding state guards.
*   **Deliverable**: Onboarding-Complete SaaS Core (users register, generate structured knowledge bases from websites, test their auto-provisioned voice agent, and activate their dashboard).

### Phase 3 — Voice Infrastructure (Week 3)
*   **Focus**: Integrate real-time audio streams, voice configuration tables, and LiveKit SDK runtime hooks.
*   **Tasks**:
    *   Implement Voice Agent configuration endpoints (FR-030 - FR-035).
    *   Integrate LiveKit Rooms API and token generation services.
    *   Configure LiveKit Agents SDK to run conversational loops (STT Deepgram -> LLM OpenAI Realtime -> TTS ElevenLabs).
    *   Setup LiveKit webhook authentication and event listeners (`call.started`, `call.completed`).
*   **Deliverable**: Operational Voice Agent Pipeline (agents connect to incoming lines and execute system prompts).

### Phase 4 — Calls & Intelligence (Week 4)
*   **Focus**: Post-call data ingestion, transcription processing, and AI summarization queue workflows.
*   **Tasks**:
    *   Develop completed call logs storage models (FR-040 - FR-042).
    *   Implement conversational turn aggregation and transcript storage (FR-043).
    *   Create BullMQ workflows in Redis to trigger post-call analysis asynchronously.
    *   Integrate OpenAI GPT-4o JSON models to extract call summaries, action items, and intent badges (FR-044).
    *   Build frontend paginated Call Logs, search matching highlights, and Transcript Detail views.
*   **Deliverable**: Call Intelligence Layer (transcripts and summaries attached to completed calls).

### Phase 5 — Analytics & Observability (Week 5)
*   **Focus**: Performance visualization, workspace settings updates, and security logs.
*   **Tasks**:
    *   Build dashboard analytics card metrics and aggregate trends charts using Recharts (FR-050 - FR-054).
    *   Implement immutable Security Audit Logging hooks (FR-060) across backend controllers.
    *   Create workspace settings modules to update falling backup routes and active business hours (FR-014).
    *   Perform performance checks, load audits, and launch production instances.
*   **Deliverable**: MVP Complete (fully functional, secure, multi-tenant AI Voice Operations Platform).

---

## 2. Key Milestones

1.  **Milestone 1 (End of Week 1)**: CI/CD deployment green. Frontend displays base dashboard shell.
2.  **Milestone 2 (End of Week 2)**: Registration and multi-tenant workspace context operates securely. Cross-tenant queries are blocked.
3.  **Milestone 3 (End of Week 3)**: Audio connection verified. Call is answered by the AI agent utilizing the tenant's system prompt instructions.
4.  **Milestone 4 (End of Week 4)**: Call completes, triggers BullMQ job, and generates accurate transcripts and summaries.
5.  **Milestone 5 (End of Week 5)**: Analytics dashboard renders charts. System is successfully deployed to Vercel + AWS ECS.

---

## 3. Risk Assessment & Mitigations

| Risk Identified | Potential Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Voice Connection Latency** | Caller experiences delays or silent gaps during routing decisions. | Perform timezone checks and fallback checks in database before starting LLM. Keep agent runtime geographically close to SIP provider regions. |
| **Multi-Tenant Data Leaks** | A tenant views transcripts or configs belonging to another organization. | Enforce `organizationId` matching in backend validation middleware and add automated database schema level query guards. |
| **AI Operational Costs** | OpenAI Realtime API usage spikes billing budgets quickly. | Enforce maximum duration limits (e.g., auto-disconnect calls at 15 minutes) and optimize system prompts to reduce token counts. |
| **Webhook Packet Drops** | Latency spikes cause Express webhooks to timeout, missing call logging records. | Ensure webhook receivers return a fast `HTTP 200 OK` response immediately, deferring processing to Redis/BullMQ queues. |
| **LiveKit Room Failures** | Audio routing fails due to third-party outages. | Implement direct SIP redirect headers routing calls to secondary mobile numbers in case of platform disconnects. |

---

## 4. Dependencies

*   **Vapi vs LiveKit SDK**: The project moves from Vapi (used in Missional Agents) to the LiveKit Agent SDK. Development is dependent on setting up LiveKit Cloud API access keys early in Week 3.
*   **Resend Domain Verification**: Sending emails requires domain DNS configurations to prevent emails landing in spam folders (must be verified by the end of Week 1).
*   **OpenAI Rate Limits**: The production system uses GPT-4o and Realtime APIs. OpenAI accounts must be pre-funded to avoid rate limiting blocks during early testing.
