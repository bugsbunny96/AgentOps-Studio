# Product Requirements Document (PRD) - AgentOps Studio

## 1. Vision & Executive Summary
AgentOps Studio is an enterprise-ready, multi-tenant AI Operations Platform that enables organizations to deploy, manage, monitor, and optimize AI Voice Agents. 

Moving beyond basic analytics dashboards, AgentOps Studio operates as a comprehensive SaaS platform. It provides organizations with the tools to manage voice routing, customize agent personas and voice settings, view call histories with transcripts and AI-generated summaries, and monitor platform activity in real-time. By automating the provisioning pipeline and decoupling dynamic operational data from voice runtime configurations, AgentOps Studio ensures scalable, zero-latency, and highly secure voice operations.

---

## 2. Product Goals & Objectives

### Business Goals
*   **BG-001 (Market Penetration)**: Acquire the first 20 paying organizations within 90 days of launching the MVP.
*   **BG-002 (Operational Efficiency)**: Reduce manual receptionist and operational call workloads for participating organizations by an average of 60%.
*   **BG-003 (Cost Reduction)**: Lower overall telephony and administrative overhead for tenants by 65% compared to standard human answering services.

### Product Platform Goals
*   **G1 (Organization Management)**: Deliver robust multi-tenant organization creation, invitation workflows, and membership management.
*   **G2 (AI Agent Management)**: Provide a clean prompt and voice configuration editor to control agent personas, rules, and triggers.
*   **G3 (Call Management)**: Real-time call logging, search, filtering, transcript storage, and summary extraction.
*   **G4 (Team Collaboration)**: Granular Role-Based Access Control (RBAC) to allow secure team collaboration.
*   **G5 (Analytics & Insights)**: Dashboard metrics displaying call volumes, durations, agent utilization, and outcomes.

---

## 3. User Personas

### Persona 1: Organization Owner (e.g., Senior Executives, Church Network Directors)
*   **Bio**: High-level decision-maker who manages organization accounts, budgets, and overall staff allocations.
*   **Responsibilities**:
    *   Creates and configures the organization workspace.
    *   Manages subscription plans, billing, and credential settings.
    *   Invites key administrators and manages global team access.
    *   Creates initial AI Voice Agents to represent the organization.
*   **Pain Points**:
    *   High staffing cost for 24/7 call coverage.
    *   Missing emergency or critical inquiries during off-hours, leading to community friction or lost revenue.
    *   Difficulty scaling support during peak call volume periods.

### Persona 2: Operations Manager (e.g., Office Administrators, Church Ops Leads)
*   **Bio**: Mid-level supervisor responsible for day-to-day operations, scheduling, and staff-caller communications.
*   **Responsibilities**:
    *   Monitors active calls, reviews transcripts, and checks call outcome logs.
    *   Updates active voice agent configurations, announcements, and daily commands.
    *   Manages team invitations and coordinates shift schedules.
*   **Pain Points**:
    *   Lack of visibility into call patterns, query resolution rates, or agent performance.
    *   Inefficient manual triage of repetitive queries (service hours, giving instructions, event directions).

### Persona 3: Team Member (e.g., Volunteer Coordinators, Support Staff)
*   **Bio**: Front-line operator who reviews specific cases, follows up on messages, and updates records.
*   **Responsibilities**:
    *   Reviews call recordings and transcripts referred by the AI.
    *   Coordinates responses for benevolence, emergencies, or volunteer sign-ups.
    *   Updates specific, localized details in the database settings.
*   **Pain Points**:
    *   Lack of contextual information when taking over a caller's issue.
    *   Wasted hours answering spam or solicitations.

---

## 4. Core User Flows

### Flow 1: Organization Onboarding & Creation
```text
Step 1: User Registration
   → [Signup Page] Enter Name, Email, & Password
   → [Submit Form] → Backend creates User record ("Pending Verification" status)
   → Dispatch email verification link with secure token
   → [Email Link Clicked] → Token verified, user activated
   → Redirected to Onboarding Process

Step 2: Organization Creation
   → [Create Organization Page] Enter Org Name, Slug, Timezone, and Industry/Business Type
   → Answer Question: "Do you have a website?" (Yes / No)

Step 3: Website Knowledge Base Creation
   ├── If User selects "Yes":
   │     → Enter Website URL
   │     → Backend validates URL and triggers Headless Crawler
   │     → Extraction of business info & website page texts
   │     → LLM processes text into structured Markdown (.md) documents
   │     → Store Markdown documents & associate with organization
   └── If User selects "No":
         → Skip crawl; proceed to manual configuration/document upload

Step 4: Business Configuration
   → [Business Configuration Page] Collect business description, services, FAQs, business hours, contact details, locations, supported languages, and industry-specific information.
   → Form displays dynamic fields based on selected industry.

Step 5: AI Voice Agent Setup & Testing (using LiveKit)
   → Backend generates initial voice agent configuration and links knowledge base.
   → System prompt, language settings, and voice settings are configured.
   │     → [Test Agent Widget] User starts test conversation via WebRTC.
   │     → User speaks with AI voice agent, reviews responses, and updates configurations.

Step 6: Dashboard Activation
   → User clicks [Complete Onboarding]
   → Backend creates organization record, assigns Owner role, creates default workspace, creates default voice agent, and attaches generated knowledge base.
   → Redirect user to [Dashboard].
```

### Flow 2: Team Member Invitation
```text
[Dashboard] → Navigate to [Team Settings]
   → Click "Invite Member"
   → Enter Invitee's Email & Select Role (Admin or Member)
   → Click [Send Invitation]
   → Background queue sends email containing secure token
   → Invitee clicks link: /accept-invite/:token
   → Invitee registers or logs in
   → Membership collection updated with user link & selected role
```

### Flow 3: AI Voice Agent Creation & Configuration
```text
[Dashboard] → Navigate to [Voice Agents]
   → Click "Create New Agent"
   → Input Agent Name and select Voice Model (e.g., OpenAI Realtime / ElevenLabs)
   → Input System Prompt (defining behavioral guardrails and identity)
   → Click [Save Configuration]
   → Backend creates database representation
   → Clicking "Activate" registers or wires the LiveKit pipeline mapping the inbound line
```

### Flow 4: Call Review & Intelligence Inspection
```text
[Dashboard] → Navigate to [Call Log]
   → View list of all inbound/outbound calls (duration, status, agent name, date)
   → Click on a specific [Call Record]
   → Open Detail view:
       ├── Audio playback of call recording
       ├── Complete line-by-line Transcript Viewer
       ├── AI-Generated Call Summary
       └── Extracted Intent Badges (e.g., Emergency, Benevolence, Donation)
```

---

## 5. Functional Requirements (FR)

### 5.1 Authentication (FR-001 - FR-004)
*   **FR-001 (User Registration)**: Users must be able to sign up using an email address, name, and strong password.
*   **FR-002 (Secure Login)**: Users must login to receive JWT tokens. Tokens must be stored securely in HTTP-only cookies.
*   **FR-003 (Password Recovery)**: Users must be able to request a password reset email generating a short-lived token.
*   **FR-004 (Email Verification)**: Accounts must remain pending until email ownership is verified via link.

### 5.2 Organizations (FR-010 - FR-014)
*   **FR-010 (Create Organization)**: Authenticated users can create a new organization, specifying Name, unique Slug, Timezone, Industry / Business Type, and answering the website availability question.
*   **FR-011 (Edit Organization)**: Authorized users can update name, default fallback numbers, timezone, operational hours, and industry-specific business fields.
*   **FR-012 (Invite Members)**: Workspace Owners and Admins can send invitations containing role selection (Admin/Member).
*   **FR-013 (Accept Invitation)**: Invitees can click the registration link with token to join the specific organization database context.
*   **FR-014 (Remove Member)**: Owners/Admins can revoke organization memberships, immediately invalidating active user sessions.

### 5.3 Roles & Permissions (FR-020 - FR-022)
*   **FR-020 (Owner)**: Full permissions including billing management, role updates, agent edits, and organization deletion.
*   **FR-021 (Admin)**: Permission to manage agents, invite team members, read calls, and update settings. Cannot modify billing or delete the organization.
*   **FR-022 (Member)**: Read-only access to dashboards, analytics, and call transcripts. Cannot modify voice configurations or invite users.

### 5.4 Voice Agents (FR-030 - FR-035)
*   **FR-030 (Create Agent)**: Users can instantiate agents specifying system instructions.
*   **FR-031 (Update Agent)**: Users can edit prompts, temperature settings, and base LLM attributes.
*   **FR-032 (Delete Agent)**: Users can remove agents, which terminates associated routing entries.
*   **FR-033 (Activate/Deactivate)**: Fast toggle to enable or disable incoming route handling.
*   **FR-034 (Prompt Management)**: Interface for managing versioned system prompt strings.
*   **FR-035 (Voice Configuration)**: Voice provider selection (ElevenLabs, Cartesia) and speech parameters (speed, pitch).

### 5.5 Calls (FR-040 - FR-046)
*   **FR-040 (Inbound Calls)**: Handle incoming WebRTC/PSTN sessions routing to the active LiveKit agent.
*   **FR-041 (Outbound Calls)**: Ability to trigger agent-initiated dial-out loops via backend API.
*   **FR-042 (Recording Metadata)**: Capture start time, end time, duration, cost, termination reasons, and audio files.
*   **FR-043 (Transcript Storage)**: Parse and store conversational turn-by-turn text blocks.
*   **FR-044 (Call Summaries)**: Generate an structured short summary of the call details.
*   **FR-045 (Call Search)**: Search transcripts and summaries using keywords.
*   **FR-046 (Call History)**: Paginated table view showing logs sorted chronologically.

### 5.6 Analytics & Insights (FR-050 - FR-054)
*   **FR-050 (Total Calls)**: Displays aggregate call count trends over selected time periods (day, week, month).
*   **FR-051 (Average Duration)**: Line charts representing average call times.
*   **FR-052 (Agent Utilization)**: Displays active vs. idle durations of configured voice lines.
*   **FR-053 (Call Outcomes)**: Pie chart displaying resolution statuses (Resolved, Transferred, Abandoned).
*   **FR-054 (Daily Trends)**: Bar charts plotting call volume hourly spikes.

### 5.7 Audit Logs (FR-060)
*   **FR-060 (Activity Tracking)**: Capture audit records including actor ID, action details, target resource, timestamp, and IP address for all mutations.

### 5.8 Onboarding & Knowledge Base (FR-070 - FR-078)
*   **FR-070 (Website Knowledge Base Generation)**: If the website option is "Yes", users can provide a Website URL. The system validates the URL before starting extraction.
*   **FR-071 (Headless Crawling)**: The backend schedules and executes website crawling of verified pages, extracting text and structural content.
*   **FR-072 (Markdown KB Conversion)**: The system parses extracted texts into structured Markdown (.md) documents and associates them with the organization.
*   **FR-073 (KB Dashboard Management)**: Dashboard provides a Sidebar Navigation Item leading to the Knowledge Base, including:
    *   **Knowledge Base List**: Shows all documents linked to the organization.
    *   **Document Viewer**: Allows viewing document text and structure.
    *   **Document Editor**: Standard text editor to directly modify Markdown document contents.
*   **FR-074 (KB Re-sync & Document Upload)**: Users can trigger website re-crawling ("Re-sync Website") or manually upload additional documents (.pdf, .txt, .md) to expand the knowledge base.
*   **FR-075 (Dynamic Business Configuration)**: During onboarding, the system collects Business Description, Services, FAQs, Business Hours, Contact Details, Locations, Supported Languages, and Industry-Specific Information, rendering form inputs dynamically based on the selected Industry/Business Type.
*   **FR-076 (LiveKit Agent Auto-Provisioning)**: The system auto-generates the initial LiveKit Voice Agent configuration (name, pre-configured system prompt based on business configuration/KB, language settings, and voice settings).
*   **FR-077 (LiveKit WebRTC Agent Sandbox)**: Users can test the provisioned AI agent using browser WebRTC directly in the onboarding wizard, checking real-time response quality and adjusting system settings.
*   **FR-078 (Onboarding Activation)**: Completing onboarding registers the organization record, links the Owner role to the registering user, establishes the default workspace, sets up the default voice agent with the attached knowledge base, and redirects the user to the active Dashboard.

---

## 6. Non-Functional Requirements (NFR)

### 6.1 Performance & Latency
*   **API Response Time**: 95% of standard REST API requests must respond within less than 300ms.
*   **UI Page Load Time**: Initial dashboard shell and core elements must load in under 2 seconds.
*   **SIP/Voice Ingress Latency**: Pre-call webhook routing validations must resolve within 500ms to avoid call connection delay.

### 6.2 Scalability
*   The architecture must support a minimum of 1,000 distinct tenant organizations concurrently.
*   The system must ingest and process up to 100,000 completed call reports per day without degrading performance.

### 6.3 Availability & Reliability
*   The platform must maintain a minimum uptime SLA of 99.9% (excluding scheduled maintenance).
*   Automatic failover routing to secondary fallback PSTN numbers if the voice gateway services experience disruptions.

### 6.4 Security & Data Privacy
*   **Isolation**: No database query must be allowed to run without an active `organizationId` filter.
*   **Cookies**: Access tokens must be transmitted only via `HttpOnly`, `Secure`, and `SameSite=Strict` cookies.
*   **Compliance**: All call recordings and transcript text blocks containing sensitive user data must be encrypted at rest using AES-256.

---

## 7. Success Metrics

### Business Metrics
*   **MRR Growth**: Reach target monthly recurring revenue from first 20 paid tenants.
*   **Customer Retention Rate**: Maintain a monthly churn rate of less than 2% for active tenants.
*   **Lead-to-Paying Conversion**: Achieve a 15% conversion rate for organizations moving from the free trial to paid plans.

### Product Metrics
*   **Call Containment Rate**: Percentage of inbound calls resolved by the AI voice agents without human transfer. Target is >70%.
*   **Voice Quality Rating (MOS)**: Maintain an average Mean Opinion Score of 4.2/5.0 based on network jitter and TTS quality metrics.
*   **User Adoption Rate**: Active daily logins of team members to check transcripts and update settings. Target is >80% active member logins weekly.
