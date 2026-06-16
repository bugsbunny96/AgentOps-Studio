# Frontend Specification Document - AgentOps Studio

## 1. Application Folder Structure

The client application follows a feature-grouped directory layout within a Vite + React project structure, ensuring separation of concerns and high scalability.

```text
src/
├── assets/             # Global static images, svgs, and fonts
├── components/         # Global reusable UI blocks (Button, Input, Table, etc.)
├── features/           # Domain-driven features (Dashboard, Agents, Calls, Team)
│   ├── agents/
│   │   ├── components/ # Local features components (AgentCard, PromptEditor)
│   │   ├── hooks/      # Local hooks (useAgentMutations)
│   │   ├── services/   # Local API client requests
│   │   └── agentSlice.ts
│   ├── calls/
│   └── team/
├── hooks/              # Global custom hooks (useAuth, useLocalStorage)
├── layouts/            # Page templates (AuthLayout, DashboardLayout)
├── routes/             # React Router configuration & guards
├── store/              # Redux Toolkit global store configuration
│   ├── rootReducer.ts
│   └── index.ts
├── styles/             # Global CSS and Tailwind directives
├── types/              # Global TypeScript interfaces
└── utils/              # Helper utilities (date formatters, API client)
```

---

## 2. Routing Configuration

Routing is managed via **React Router** (DOM v6/v7) utilizing data routers. Nested routes enforce authentication states.

### Route Map
*   **Public Routes (Unauthenticated)**:
    *   `/login`: User access portal.
    *   `/register`: Create user account (redirects to onboarding after email activation).
    *   `/forgot-password`: Password recovery interface.
    *   `/accept-invite/:token`: Accept membership invitation path.
*   **Private Routes (Authenticated - Requires Auth Guard)**:
    *   `/onboarding`: Multi-step onboarding wizard layout.
        *   `/onboarding/org-creation`: Step 2 (Enter Name, Slug, Timezone, Industry, Website Q).
        *   `/onboarding/website-crawl`: Step 3 (Website URL, Crawling progress tracker).
        *   `/onboarding/business-config`: Step 4 (Description, services, hours, locations, dynamic fields).
        *   `/onboarding/voice-setup`: Step 5 (Voice settings selection and LiveKit sandbox tester).
*   **Organization-Scoped Private Routes (Requires Organization Guard & Completed Onboarding)**:
    *   `/dashboard`: Core activity metrics landing page.
    *   `/knowledge-base`: Markdown knowledge base manager dashboard (list, view, edit).
    *   `/team`: Team directory grid and invitation hub.
    *   `/agents`: Voice agent list grid.
    *   `/agents/new`: Create agent wizard.
    *   `/agents/:id`: Edit agent system settings and prompts.
    *   `/calls`: Paginated list of completed call reports.
    *   `/calls/:id`: Detailed call record (audio, transcripts, summaries).
    *   `/settings`: Organization profile settings, hours, and fallback paths.

---

## 3. Layout Specifications

### 3.1 Auth Layout (`AuthLayout.tsx`)
A centered, focused screen container template designed for authentication routes.
*   **Layout Elements**:
    *   A grid split with a decorative marketing/branding panel on the left (visible on desktop resolutions, hidden on mobile) showing animations or product taglines.
    *   A right-side content panel containing the logo, form header, form card container, and links to other auth routes.
    *   Centered styling wrapping the dynamic child routing view.

### 3.2 Dashboard Layout (`DashboardLayout.tsx`)
A flexible, high-productivity structure used for all organization-scoped screens.
*   **Layout Elements**:
    *   **Sidebar (Responsive Collapsible)**: Navigation drawer linking dashboard modules (including new **Knowledge Base** item). Collapses to icons on tablet sizes and hides behind a hamburger menu button on mobile.
    *   **Topbar (Header Pane)**: Displays active organization selector dropdown, active notifications list, and user profile avatar dropdown (profile settings, log out).
    *   **Main Content Port**: Scrollable viewport container with standard padding wrapping child routing pages. Injects loading skeletons during transition states.

### 3.3 Onboarding Layout (`OnboardingLayout.tsx`)
A linear, focused layout used during the user registration and workspace setup wizard.
*   **Layout Elements**:
    *   **Progress Header Bar**: Displays a visual horizontal stepper illustrating the 6 onboarding steps (Registration, Org Creation, KB Setup, Config, Voice Agent, Complete).
    *   **Wizard Panel**: Card container centered on screen with smooth horizontal slide-in transition animations on step change.
    *   **Footer Controls**: Unified navigation buttons ("Back", "Continue", "Skip", "Complete Onboarding") with loading states. Prevents back navigation during active crawl or provisioning.

---

## 4. Component Directory & APIs

### 4.1 Shared UI Primitives (shadcn/ui-based)
*   **Button**: Custom styled variants (Primary Gradient, Outline, Secondary Dark, Destructive, Link). Injects spinner loading attributes when toggled.
*   **Input**: Floating labels, error border integrations, and helper text anchors.
*   **Modal & Drawer**: Dialog systems. Modals render on large screen displays, sliding bottom sheets (Drawers) represent the drawer UI on mobile viewports.
*   **Table**: A reusable responsive table component featuring flex-width columns, sorting header triggers, and built-in loading row states.
*   **Badge**: Pill-shaped status indicators (Active/Green, Inactive/Gray, Pending/Orange, Emergency/Red).
*   **Avatar**: Rounded component displaying user profile images or text initials with fallback color palettes.

### 4.2 Team Module Components
*   **InviteModal**: Popover trigger inputting email address and a selector dropdown to assign roles (Admin/Member).
*   **MemberTable**: Lists current members, roles, join dates, and actions (e.g., revoke invite, delete member).
*   **RoleSelector**: Select button element mapping RBAC role modifications.

### 4.3 Agents Module Components
*   **AgentForm**: Core wizard updating agent name, description, and base configurations.
*   **PromptEditor**: Monaco-based or text-area prompt writer equipped with variables validation highlights (e.g., alerting missing variables).
*   **VoiceSelector**: Dropdown list grouping ElevenLabs/Cartesia voice models with inline preview play/pause audio capabilities.
*   **AgentCard**: Dashboard element displaying name, status badge, execution parameters, and navigation links.

### 4.4 Calls Module Components
*   **CallTable**: Paginated records log containing customer number, duration format, cost tracking, outcome badge, and view details button.
*   **TranscriptViewer**: Conversation viewer displaying alternate left-right text bubbles (Agent vs. User) with search matching highlights.
*   **SummaryPanel**: Card container showcasing AI summaries, detected tags, and structured list items outlining actions.

### 4.5 Onboarding Module Components
*   **OnboardingStepper**: Horizontal navigation widget mapping active steps with text descriptions and completion indicators.
*   **WebsiteCrawlProgress**: Step 3 progress card. Displays the crawling status (validating, crawling page list, processing with LLM, completed) utilizing interactive loading spinners, success checkmarks, and percentage bars.
*   **DynamicConfigForm**: Step 4 dynamic form loader. Fetches a schema mapping the user's selected industry (e.g. Healthcare, Real Estate) to specific input fields (e.g. clinic specialties, property details) and binds hooks.
*   **LiveKitSandbox**: Step 5 test sandbox widget. Incorporates:
    *   **Start Conversation Button**: Connects client browser to LiveKit agent room using WebRTC.
    *   **Audio Visualizer**: Waveform indicator showing active mic input and speaker output.
    *   **Sandbox Configuration Panel**: Sliders modifying Voice model settings (speed, pitch) and prompt overrides in real-time.
    *   **Live Transcript Window**: Chat log updating with real-time text turns.

### 4.6 Knowledge Base Module Components
*   **SidebarLink**: Navigation link in sidebar leading to `/knowledge-base` route.
*   **DocumentTable**: Lists all generated and uploaded documents, displaying title, content type (crawled, uploaded, manual), last sync date, and edit/delete triggers.
*   **MarkdownPreview**: Formatted Markdown document viewer rendering styled HTML headers, lists, and quotes.
*   **MarkdownEditor**: CodeMirror/textarea component allowing direct document editing with save triggers.
*   **UploadDocModal**: Drag-and-drop modal accepting `.txt`, `.md`, and `.pdf` documents to enrich the workspace.
*   **SyncTrigger**: Button triggering crawl jobs with polling.

---

## 5. State Management Blueprint

AgentOps Studio splits state between global client-side caches and server-side synchronized state.

### 5.1 Global Client State (Redux Toolkit)
Stores application runtime contexts that do not require server caching:
*   **Auth Slice**:
    *   `state: { user: UserInfo | null, token: string | null, isAuthenticated: boolean }`
    *   *Reducers*: `setCredentials`, `clearCredentials`.
*   **Organization Slice**:
    *   `state: { currentOrg: OrganizationInfo | null, availableOrgs: OrganizationInfo[], onboarding: { activeStep: number, tempOrgId: string | null } }`
    *   *Reducers*: `setCurrentOrg`, `setAvailableOrgs`, `setactiveStep`, `setTempOrgId`.

### 5.2 Server State Cache (TanStack Query)
Handles data synchronization, mutations, and pagination caching configurations:
*   **Query Key Strategy**:
    *   `['calls', orgId, page, filters]`: Caches calls logs list queries.
    *   `['callDetails', callId]`: Caches single call detail records.
    *   `['agents', orgId]`: Caches organization's agents directory.
    *   `['members', orgId]`: Caches membership list.
    *   `['crawlStatus', tempOrgId]`: Polling cache tracking active website crawler status.
    *   `['documents', orgId]`: Caches list of Markdown documents in knowledge base.
*   **Cache Policy**: `staleTime` is set to 30 seconds for real-time pages (Dashboard) and 5 minutes for settings configurations.

---

## 6. UI/UX & Quality Standards

*   **Mobile-First Grid System**: All view templates must use CSS Flexbox/Grid systems, dynamically scaling from small mobile viewports (320px) up to ultra-wide desktop monitors (1920px).
*   **Accessibility Compliance (WCAG 2.1 AA)**:
    *   Interactive items must maintain a minimum contrast ratio of 4.5:1.
    *   All buttons and anchor links must provide descriptive `aria-label` elements.
    *   Keyboard navigation support (focus outlines, tab-index ordering).
*   **Theme Engine**: TailwindCSS dark-mode selectors (`dark:bg-slate-950`). Default state is system-matching with manual toggles saved in browser local storage.
*   **Optimistic UI Updates**: Core interactions (e.g., toggling voice agent status) should update the local UI state instantly, rolling back changes only if the server API responds with an error.
*   **Resiliency**: Core dashboard route endpoints are wrapped with custom React **Error Boundaries** to catch component crashes and present user recovery screens without breaking the entire client app.
