# Project Timeline - AgentOps Studio MVP

This document details the step-by-step execution timeline for the AgentOps Studio MVP. It is organized into 5 structural development layers.

---

## 1. Timeline Overview

The timeline runs for a total of **35 Days** (5 Weeks).

```text
Layer 1: Platform Foundation   [Days 1 - 7]
  ├── Backend setup & Mongoose
  ├── Frontend shell & Tailwind
  └── CI/CD deployment pipeline

Layer 2: Identity & Onboarding [Days 8 - 14]
  ├── JWT Auth & Onboarding Stepper UI
  ├── Crawler & Markdown Extraction Engine
  ├── KB Manager & LiveKit WebRTC Sandbox
  └── Onboarding State & Middleware Guards

Layer 3: Voice AI              [Days 15 - 22]
  ├── LiveKit room orchestration
  └── Agent prompt configuration

Layer 4: Intelligence          [Days 23 - 29]
  ├── Transcripts storage
  └── BullMQ analysis pipelines

Layer 5: Observability         [Days 30 - 35]
  ├── Dashboard metrics
  └── Audit logs & launch
```

---

## 2. Detailed Execution Layers

### Layer 1: Platform Foundation (Days 1 - 7)
*   **Tasks & Sub-Tasks**:
    *   **T1.1: Backend Infrastructure Setup** (Duration: 3 Days)
        *   Configure Express server with TypeScript and linting.
        *   Establish Mongoose connection patterns to MongoDB Atlas.
        *   Implement centralized error handling and logging utilities.
    *   **T1.2: Frontend Application Bootstrapping** (Duration: 3 Days)
        *   Scaffold React 19 application using Vite and TypeScript.
        *   Integrate TailwindCSS 4 and install shadcn/ui primitives.
        *   Establish React Router routing shell and context providers.
    *   **T1.3: DevOps & Pipeline Automation** (Duration: 2 Days)
        *   Create Dockerfile files for backend and agent runners.
        *   Set up GitHub Actions to deploy frontend to Vercel and backend to AWS ECS.
        *   Configure separate staging and production environment settings.
*   **Dependencies**: None.
*   **Layer 1 Milestone**: SaaS skeleton is running in staging. Frontend routing, Tailwind CSS style templates, and MongoDB connections operate correctly.

---

### Layer 2: Identity & Onboarding (Days 8 - 14)
*   **Tasks & Sub-Tasks**:
    *   **T2.1: Secure Authentication & Onboarding UI Framework** (Duration: 3 Days)
        *   Create register, login, and verify routes on the backend.
        *   Implement HTTP-Only cookie token storage and user activation.
        *   Build `OnboardingLayout` and stepper controller in React.
        *   Build Step 2 Organization Creation and website availability forms.
    *   **T2.2: Website Crawler & Markdown Extraction Engine** (Duration: 3 Days)
        *   Implement headless crawler tasks in Redis/BullMQ.
        *   Integrate Puppeteer/Firecrawl page extraction logic.
        *   Build GPT-4o HTML-to-Markdown structured parsing pipeline.
        *   Implement Server-Sent Events (SSE) crawl status streaming endpoint.
    *   **T2.3: Knowledge Base Manager UI & API** (Duration: 3 Days)
        *   Create `Document` schemas, REST API CRUD endpoints, and sidebar navigation.
        *   Build document list table, visual Markdown previewer, and text editor.
        *   Build document upload drop-zone supporting text/PDF parsing.
    *   **T2.4: LiveKit Client-Side WebRTC Sandbox Tester** (Duration: 2 Days)
        *   Configure onboarding audio room token generator APIs.
        *   Build frontend sandbox microphone WebRTC connectors, visualizers, and sliders.
    *   **T2.5: Access Guards & Multi-Tenant Middleware** (Duration: 2 Days)
        *   Build `validateOrganization` and Onboarding State middleware checks.
        *   Establish Owner memberships and activate workspace upon completion.
*   **Dependencies**: Layer 1 complete.
*   **Layer 2 Milestone**: Users register, activate their accounts, run website crawlers to generate structured Markdown knowledge bases, test their voice agent via browser WebRTC, and unlock the Dashboard.

---

### Layer 3: Voice AI Infrastructure (Days 15 - 22)
*   **Tasks & Sub-Tasks**:
    *   **T3.1: Voice Agent Profile Management** (Duration: 3 Days)
        *   Build Mongoose `voice_agents` configuration collection.
        *   Implement agent creation forms, system prompt editors, and voice selectors.
    *   **T3.2: LiveKit Rooms API Integration** (Duration: 3 Days)
        *   Integrate LiveKit Server SDK to create rooms and generate credentials.
        *   Build token generation endpoint to authorize voice agents joining WebRTC rooms.
    *   **T3.3: LiveKit Voice Agent SDK Implementation** (Duration: 4 Days)
        *   Configure Python/Node agent runner to hook audio streams.
        *   Wire Deepgram (STT), OpenAI Realtime (LLM), and ElevenLabs/Cartesia (TTS) pipelines.
    *   **T3.4: Ingress Routing Rules Validation Webhooks** (Duration: 2 Days)
        *   Implement routing validators ensuring incoming calls route to active voice agents during business hours.
*   **Dependencies**: Layer 2 complete.
*   **Layer 3 Milestone**: An inbound call rings, authorizes the workspace connection, and bridges to the voice agent running the tenant-configured system prompt.

---

### Layer 4: Intelligence & Processing Pipeline (Days 23 - 29)
*   **Tasks & Sub-Tasks**:
    *   **T4.1: Call Logging & Recordings Capture** (Duration: 2 Days)
        *   Capture webhook notifications to record metadata and upload audio files.
        *   Build database collections logging completed calls.
    *   **T4.2: Conversational Transcripts Aggregator** (Duration: 2 Days)
        *   Compile LiveKit turn events and save to `transcripts`.
        *   Build frontend Transcript Viewer displaying alternate bubble streams.
    *   **T4.3: Redis/BullMQ Post-Call Pipelines** (Duration: 3 Days)
        *   Configure BullMQ to queue post-call analysis tasks asynchronously.
        *   Implement OpenAI GPT-4o analysis service to extract summaries, tags, and action items.
    *   **T4.4: Call Log Dashboard** (Duration: 2 Days)
        *   Build paginated Call Log table view on `/calls` route with filter bars.
*   **Dependencies**: Layer 3 complete.
*   **Layer 4 Milestone**: Calls terminate, trigger background summarization jobs in Redis, and output searchable transcripts and summaries on the dashboard.

---

### Layer 5: Observability & Launch (Days 30 - 35)
*   **Tasks & Sub-Tasks**:
    *   **T5.1: Dashboard Analytics Reports** (Duration: 3 Days)
        *   Write MongoDB aggregation pipelines parsing call counts, durations, and outcomes.
        *   Implement frontend dashboard metrics widgets using Recharts.
    *   **T5.2: Immutable Audit Log System** (Duration: 2 Days)
        *   Write hooks logging mutations to the `activity_logs` collection.
        *   Build read-only audit log views.
    *   **T5.3: Workspace Operational Settings** (Duration: 1 Day)
        *   Build views enabling Admins to modify business hours and fallback paths.
    *   **T5.4: System Hardening & Deployment** (Duration: 2 Days)
        *   Conduct cross-tenant isolation testing and API latency verification.
        *   Deploy production build to AWS ECS and Vercel.
*   **Dependencies**: Layer 4 complete.
*   **Layer 5 Milestone**: Analytics reports render correctly, audit logs capture admin mutations, security checks pass, and the platform goes live.
