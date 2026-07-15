# AgentOps Studio — Standard Operating Procedure (SOP)
# Every AI Session Must Follow This Exactly

> Version: 1.0.0 | Owner: CEO Agent | Last Updated: 2026-06-26

---

## 1. SESSION START PROTOCOL

Run these steps at the start of EVERY session before any work begins.

```
STEP 1 — Load context
  Read: CLAUDE.md              ← org structure, rules, prime directive
  Read: TASK-BOARD.md          ← current sprint state, blockers, status
  Read: agents/EXECUTION-FRAMEWORK.md ← WBS, dependencies, R&D backlog
  Read: main-project-docs/RD-LOG.md   ← latest R&D findings

STEP 2 — Check state
  What layer is active? (Layer 1 ✅ | Layer 2 🔄 | Layer 3-5 ⏳)
  What tasks are in_progress or blocked?
  What was the last completed atomic task?
  What is the next atomic task in the WBS?

STEP 3 — Announce active sprint
  Confirm with founder: "Resuming [TASK-ID] — [description]. All 5 agents dispatching."

STEP 4 — Dispatch all 5 agents
  Never work on a single agent's task alone. Always fire all 5.
```

---

## 2. QUERY EXECUTION TEMPLATE

Every founder query maps to this template. CEO fills it before dispatching agents.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 QUERY RECEIVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Founder Input  : [exact quote or paraphrase]
Query Type     : [Build Feature | Fix Bug | Design Flow | Write Tests |
                  Voice/AI Work | Marketing/GTM | Infra | Analytics |
                  Strategy | R&D | Any Other]
Active WBS Node: [EPIC > FEATURE > MODULE > TASK > SUBTASK > ATOMIC TASK ID]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔵 PRODUCT AGENT
  Primary  : [task]
  Secondary: [background lane if primary N/A]
  Deliverable: [spec | user story | AC | RICE score | journey map]
  Files      : [which files to read/write]

🟢 ENGINEERING AGENT
  Primary  : [task]
  Secondary: [background lane if primary N/A]
  Deliverable: [code | tests | migration | ADR]
  Files      : [which files to read/write]
  QA Gate    : tests pass ☐ | tsc clean ☐

🟠 AI AGENT
  Primary  : [task]
  Secondary: [background lane if primary N/A]
  Deliverable: [prompt | eval | RAG config | Vapi config]
  Files      : [which files to read/write]

🟡 GROWTH AGENT
  Primary  : [task]
  Secondary: [background lane if primary N/A]
  Deliverable: [copy | campaign | competitor note | ICP update]
  Files      : [which files to read/write]

🟣 CUSTOMER AGENT
  Primary  : [task]
  Secondary: [background lane if primary N/A]
  Deliverable: [KPI report | CS playbook | health score | support doc]
  Files      : [which files to read/write]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 3. WORKER REPORT TEMPLATE

Each agent must produce a status report at end of their task using this format:

### 🔵 Product Agent Report
```
─────────────────────────────────────────────────────────────
🔵 PRODUCT AGENT — [YYYY-MM-DD]
Lane       : Primary | Background
Sub-role   : CPO | PM | UX Research
Task       : [task ID from WBS] — [description]
Status     : ✅ Done | 🔄 In Progress | ❌ Blocked | 🔁 R&D
Deliverable: [file name or inline content]
RICE Score : [score if applicable]
AC Updated : Yes | No
→ Engineering: [contract or dependency handed off]
→ CEO       : [blocker or decision needed]
R&D Finding: [if background — what was researched, finding, priority]
Next Action : [next atomic task ID]
─────────────────────────────────────────────────────────────
```

### 🟢 Engineering Agent Report
```
─────────────────────────────────────────────────────────────
🟢 ENGINEERING AGENT — [YYYY-MM-DD]
Lane       : Primary | Background
Sub-role   : Eng Mgr | Backend | Frontend | DevOps | QA
Task       : [task ID from WBS] — [description]
Status     : ✅ Done | 🔄 In Progress | ❌ Blocked | 🔁 R&D
Files      : [list changed files]
Endpoints  : [new/modified API endpoints]
Schema     : [schema changes]
Tests      : [test names written]
Tests Pass : ✅ | ❌ [describe failures]
TS Errors  : 0 | [count + describe]
Tech Debt  : [TODO/FIXME found]
ADR        : [ADR-NNN if decision logged]
→ CEO      : [blocker or approval needed]
R&D Finding: [if background]
Next Action: [next atomic task ID]
─────────────────────────────────────────────────────────────
```

### 🟠 AI Agent Report
```
─────────────────────────────────────────────────────────────
🟠 AI AGENT — [YYYY-MM-DD]
Lane       : Primary | Background
Sub-domain : Vapi | Exotel | RAG | LLM | Evals | Prompt
Task       : [task ID from WBS] — [description]
Status     : ✅ Done | 🔄 In Progress | ❌ Blocked | 🔁 R&D
Files      : [changed files]
Prompt Ver.: [old → new, if applicable]
Eval Result: [pass/fail — intent accuracy — delta]
Latency    : [measured or estimated impact]
Token Cost : [+/- per call]
Vapi IDs   : [affected assistant IDs]
→ CEO      : [blocker or API key needed]
R&D Finding: [tech/API updates found]
Next Action: [next atomic task ID]
─────────────────────────────────────────────────────────────
```

### 🟡 Growth Agent Report
```
─────────────────────────────────────────────────────────────
🟡 GROWTH AGENT — [YYYY-MM-DD]
Lane       : Primary | Background
Sub-role   : Marketing | Demand Gen | Sales
Task       : [task ID from WBS] — [description]
Status     : ✅ Done | 🔄 In Progress | ❌ Blocked | 🔁 R&D
Deliverable: [inline copy / file / competitor note]
KPI Impact : [expected MQL or reach]
Launch Gate: Engineering ✅? | Customer ✅?
→ CEO      : [approval for publish]
R&D Finding: [competitor move or market signal]
Next Action: [next content piece or campaign step]
─────────────────────────────────────────────────────────────
```

### 🟣 Customer Agent Report
```
─────────────────────────────────────────────────────────────
🟣 CUSTOMER AGENT — [YYYY-MM-DD]
Lane       : Primary | Background
Sub-role   : Customer Success | Support | Analytics
Task       : [task ID from WBS] — [description]
Status     : ✅ Done | 🔄 In Progress | ❌ Blocked | 🔁 R&D
KPIs       : MRR: $X | Churn: X% | Activation: X% | CSAT: X
Churn Risk : [none | account + score + action]
→ Product  : [UX research findings]
→ Growth   : [expansion signal]
→ CEO      : [P0 escalation or pricing signal]
R&D Finding: [analytics tool or CS framework]
Next Action: [next KPI check or support doc]
─────────────────────────────────────────────────────────────
```

---

## 4. CEO SYNTHESIS TEMPLATE

After all 5 agents complete, CEO synthesizes into the founder report:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CEO SYNTHESIS REPORT — [YYYY-MM-DD HH:MM]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What Was Done This Session
[1-3 sentence summary of all agent outputs combined]

## Key Deliverables
- [Agent] → [Deliverable]: [file or link]
- [Agent] → [Deliverable]: [file or link]

## Decisions Made
- [Decision]: [rationale] — logged in TASK-BOARD.md

## R&D Findings This Session
- [Agent] → [Finding]: [priority: High/Med/Low] — logged in RD-LOG.md

## WBS Progress
Active Node   : [EPIC.FEATURE.MODULE.TASK.SUBTASK.ATOMIC — ID]
Completed This: [list of atomic task IDs ✅]
Next Atomic   : [next atomic task ID + description]
Layer Progress: Layer 2 — [X/Y] atomic tasks complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
═══════════════════════════════════════════════════
🏢 COMPANY STATUS — [YYYY-MM-DD HH:MM]
───────────────────────────────────────────────────
🔵 Product Agent     │ [task this session]         │ ✅/🔄/❌
🟢 Engineering Agent │ [task this session]         │ ✅/🔄/❌
🟠 AI Agent          │ [task this session]         │ ✅/🔄/❌
🟡 Growth Agent      │ [task this session]         │ ✅/🔄/❌
🟣 Customer Agent    │ [task this session]         │ ✅/🔄/❌
───────────────────────────────────────────────────
Blockers for founder : [none | describe clearly]
Next founder action  : [none | specific action with instruction]
═══════════════════════════════════════════════════
```

---

## 5. CEO REVIEW & APPROVAL PROCESS

Before marking any task ✅, the CEO must verify:

### Engineering Tasks
```
□ Code written and pushed to correct branch
□ npm test → ALL PASS (backend + frontend)
□ tsc --noEmit → 0 errors (backend + frontend)
□ TASK-BOARD.md updated (task row marked ✅)
□ Product Agent confirmed: spec matches implementation
□ No new TODO/FIXME without a TASK-BOARD.md entry
□ If API changed: types/index.ts updated in frontend
```

### Spec / Design Tasks
```
□ AC written (testable, measurable, unambiguous)
□ Edge cases documented
□ Dependencies mapped (what must exist before Engineering starts)
□ Wireframe or user story present if UI task
□ RICE score assigned
```

### R&D Tasks
```
□ Finding logged in main-project-docs/RD-LOG.md
□ Priority assigned (High / Medium / Low)
□ Decision: Adopt now | Backlog | Monitor | Reject
□ If Adopt now: TASK-BOARD entry created
□ If Backlog: added to Feature-Ticket-List.md
```

### Growth / Content Tasks
```
□ Launch gate cleared: Engineering ✅ + Customer ✅
□ Brand voice check passed
□ No unverified claims
□ CTA and tracking link included
```

---

## 6. R&D DISPATCH PROTOCOL

When an agent has no primary implementation task, CEO auto-assigns R&D. Categories in priority order:

| Priority | R&D Category | Assigned Agent |
|---|---|---|
| 1 | Security vulnerabilities in our stack | 🟢 Engineering |
| 2 | Voice AI / LLM model updates | 🟠 AI |
| 3 | Competitor feature releases | 🟡 Growth |
| 4 | UX pattern improvements | 🔵 Product |
| 5 | Infrastructure cost optimization | 🟢 Engineering |
| 6 | API updates (Vapi, Exotel, Deepgram, OpenAI) | 🟠 AI |
| 7 | Customer retention tactics | 🟣 Customer |
| 8 | Content marketing opportunities | 🟡 Growth |
| 9 | Onboarding friction reduction | 🔵 Product |
| 10 | Developer experience improvements | 🟢 Engineering |

R&D output format: `[DATE] | [AGENT] | [CATEGORY] | [FINDING] | [PRIORITY] | [DECISION]`

All R&D output logged to: `main-project-docs/RD-LOG.md`

---

## 7. DOCUMENTATION UPDATE WORKFLOW

After EVERY session where any of the following changed, the relevant doc MUST be updated:

| Change | Document to Update | Agent Responsible |
|---|---|---|
| New API endpoint | `main-project-docs/Technical-Architecture-Document.md` | 🟢 Engineering |
| New feature spec | `main-project-docs/Feature-Ticket-List.md` | 🔵 Product |
| Roadmap priority change | `main-project-docs/MVP-Development-Roadmap.md` | 🔵 Product |
| Architecture decision | `main-project-docs/ADRs/ADR-NNN.md` (new file) | 🟢 Engineering |
| New R&D finding | `main-project-docs/RD-LOG.md` | All agents |
| Prompt version change | `prompts/CHANGELOG.md` | 🟠 AI |
| Security fix | `main-project-docs/Security-Document.md` | 🟢 Engineering |
| New voice capability | `main-project-docs/Technical-Architecture-Document.md` | 🟠 AI |
| KPI baseline update | `TASK-BOARD.md` Background Lane Log | 🟣 Customer |
| New task added | `TASK-BOARD.md` | CEO |

Rules:
- **Never overwrite** existing content — always append with date + version header
- **Version format**: `## v[X.Y.Z] — [YYYY-MM-DD] — [Agent]`
- **Changelog format**: `- [ADDED|CHANGED|FIXED|REMOVED]: [description]`

---

## 8. SESSION END PROTOCOL

Before closing any session:

```
□ All agent reports received and reviewed
□ TASK-BOARD.md updated (completed tasks ✅, new tasks added)
□ RD-LOG.md updated with any R&D findings this session
□ Decision Log in TASK-BOARD.md updated
□ CEO Blockers / Founder Actions section updated
□ Git: recommend commit with message "feat/fix/chore: [description]"
□ Company Status block produced at end of response
□ Next atomic task identified and announced
```

---

## 9. KNOWLEDGE MANAGEMENT STRATEGY

### Three-Tier Memory System

```
Tier 1 — Session Memory (this context window)
  └─ Active task state, current code, immediate decisions

Tier 2 — Project Memory (files in /agents + /main-project-docs)
  └─ TASK-BOARD.md, EXECUTION-FRAMEWORK.md, RD-LOG.md, agent files
  └─ Persists across all sessions. Always read at session start.

Tier 3 — Codebase Memory (implementation files)
  └─ The code itself is documentation. Keep it clean + commented.
```

### Knowledge Compound Loop
```
Founder Query
    │
    ▼
CEO decomposes → 5 agents work in parallel
    │
    ▼
Agents produce outputs + R&D findings
    │
    ▼
CEO synthesizes → updates TASK-BOARD + RD-LOG
    │
    ▼
Next session reads updated docs → agents start smarter
    │
    └─ Context compounds. Every session builds on the last.
```

---

## 10. ATOMIC TASK EXECUTION RULES

An Atomic Task is the smallest unit of work that fits in one AI query. Rules:

1. **One concern only** — one endpoint, one component, one test file, one spec section
2. **One owner** — each atomic task belongs to exactly one agent
3. **Defined input** — what the agent needs to read before starting
4. **Defined output** — what the agent must produce (code, spec, copy, finding)
5. **Clear done condition** — how the CEO knows it's ✅
6. **Explicit dependency** — what must be complete before this starts

Atomic Task ID format: `[LAYER].[FEATURE].[MODULE].[SEQUENCE]`

Examples:
- `L2.F2.M1.AT1` = Layer 2, Feature 2 (Auth Tests), Module 1 (Backend Tests), Atomic Task 1
- `L2.F3.M1.AT1` = Layer 2, Feature 3 (Org Creation), Module 1 (Backend), Atomic Task 1
- `L3.F1.M2.AT3` = Layer 3, Feature 1 (Voice Agent), Module 2 (Vapi), Atomic Task 3
