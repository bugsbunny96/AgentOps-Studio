# AgentOps Studio — Parallel Dispatch Matrix

> **Purpose**: CEO Agent reference for decomposing ANY founder request into 5 simultaneous agent tasks.  
> **Rule**: Every cell must have a task. If no primary work exists, use the always-on background task.

---

## How to Use

1. Find the row matching the request type
2. Assign the task in each cell to the corresponding agent
3. Fire all 5 Agent tool calls in the same message block
4. Never leave a cell blank — use the background lane if needed

---

## Matrix

### 🔨 Build / Implement Feature

| Agent | Primary Task | Background Fallback |
|---|---|---|
| 🔵 Product | Review spec completeness; add/sharpen acceptance criteria; flag edge cases | Scan Feature-Ticket-List for gaps |
| 🟢 Engineering | Implement the feature (BE + FE + DevOps as needed); write tests; QA gate | Run test suite; fix any failing tests |
| 🟠 AI | Check if feature touches voice/LLM/RAG; document API contract for Vapi if needed | Audit current prompt version for drift |
| 🟡 Growth | Draft launch copy for the feature (email, LinkedIn, changelog entry) | Update ICP doc; draft 1 content piece |
| 🟣 Customer | Define success metric for the feature; update onboarding playbook if user-facing | Pull weekly KPI snapshot; update health scores |

---

### 🐛 Fix Bug / Incident

| Agent | Primary Task | Background Fallback |
|---|---|---|
| 🔵 Product | Determine if bug reveals a UX gap; update spec/AC to prevent recurrence | Review backlog for related edge cases |
| 🟢 Engineering | Root cause analysis; implement fix; write regression test; QA gate | Tech debt scan for related issues |
| 🟠 AI | Check if bug affects voice agent behavior or RAG retrieval; run targeted eval | Audit prompt versions for similar issues |
| 🟡 Growth | Draft user-facing comms if bug was customer-visible (status update, apology, fix notice) | Draft 1 content piece on a separate topic |
| 🟣 Customer | Check if bug caused ticket spikes or health score drops; flag affected accounts; update CS playbook | Report weekly KPI snapshot |

---

### 🗺️ Design / Spec a Flow

| Agent | Primary Task | Background Fallback |
|---|---|---|
| 🔵 Product | Write the full feature spec: user story, AC, edge cases, success metric, out-of-scope | RICE-score the new spec against backlog |
| 🟢 Engineering | Technical feasibility review; identify dependencies; draft API contract | Run test suite; fix any failures |
| 🟠 AI | Map voice agent implications: any new tools/functions needed? Any prompt changes? | Check RAG quality against latest docs |
| 🟡 Growth | Positioning impact: how does this new flow affect the product narrative? | Update ICP doc with any new insight |
| 🟣 Customer | User research input: what pain does this flow solve? Pull relevant support ticket themes | Update customer health score definitions |

---

### 🧪 Write / Fix Tests

| Agent | Primary Task | Background Fallback |
|---|---|---|
| 🔵 Product | Review acceptance criteria completeness — are all AC testable? Flag any gaps | Sharpen 1 user story from next sprint |
| 🟢 Engineering | Write unit, integration, and E2E tests; run suite; achieve coverage targets; fix failures | TypeScript strict mode audit |
| 🟠 AI | Update eval harness if any AI/voice behavior changed; run golden test set | Audit system prompt versions |
| 🟡 Growth | Draft 1 content piece on quality/reliability as a product differentiator | Competitor research update |
| 🟣 Customer | Confirm tests cover key user journeys; flag any CS-reported bugs not covered by tests | Pull weekly KPI snapshot |

---

### 📣 Marketing / GTM / Launch

| Agent | Primary Task | Background Fallback |
|---|---|---|
| 🔵 Product | Provide the "what problem does this solve" narrative; confirm user research backing | Review Feature-Ticket-List for specs needing sharpening |
| 🟢 Engineering | Confirm feature is deployed, stable, and monitored; provide technical talking points | Tech debt scan |
| 🟠 AI | Voice/AI angle for content: how does AI make this feature powerful? | Eval audit |
| 🟡 Growth | Execute the launch: blog post, LinkedIn, email, changelog, outbound sequence update | Pipeline update |
| 🟣 Customer | Prepare enablement: update support docs, CS playbook, onboarding materials | Health score update |

---

### 🎙️ Voice / AI Work

| Agent | Primary Task | Background Fallback |
|---|---|---|
| 🔵 Product | Spec the voice capability: user story, expected dialog flow, success criteria | RICE-score new voice features |
| 🟢 Engineering | Implement webhook handlers, BullMQ jobs, API plumbing for voice integration | Run test suite |
| 🟠 AI | Core work: Vapi config, prompt engineering, RAG update, eval run, latency check | Prompt version audit |
| 🟡 Growth | Voice feature positioning: draft messaging for how voice AI differentiates AOS | Content piece on voice AI |
| 🟣 Customer | Define voice call quality KPIs; update CS playbook with voice troubleshooting | Report call completion rate |

---

### 🏗️ Infrastructure / DevOps

| Agent | Primary Task | Background Fallback |
|---|---|---|
| 🔵 Product | Note any infra change that impacts user experience (performance, availability) | Spec review |
| 🟢 Engineering | Execute infra work: Docker, ECS, CI/CD, env vars, monitoring, alerting | Tech debt scan |
| 🟠 AI | Note any infra change affecting LLM latency or RAG pipeline performance | Eval audit |
| 🟡 Growth | Note any uptime/performance improvement worth communicating to prospects | Content piece |
| 🟣 Customer | Monitor customer-facing impact of infra change; update status page messaging | Health score update |

---

### 📊 Analytics / KPIs / Reporting

| Agent | Primary Task | Background Fallback |
|---|---|---|
| 🔵 Product | Use analytics to update RICE scores; identify top feature adoption gaps | Spec gap review |
| 🟢 Engineering | Implement or fix dashboard/analytics endpoints; ensure aggregation pipelines are correct | Run tests |
| 🟠 AI | Report voice agent accuracy metrics (intent recognition, fallback rate, latency) | Prompt audit |
| 🟡 Growth | Report funnel metrics: lead vol, MQL→SQL, win rate; identify optimization opportunities | Content piece |
| 🟣 Customer | Primary: produce full KPI report (ARR, churn, NRR, activation, adoption, CSAT) | CS playbook update |

---

### 💡 Strategy / Vision / Roadmap

| Agent | Primary Task | Background Fallback |
|---|---|---|
| 🔵 Product | Roadmap implications: how does this change priorities? Update RICE scores | Spec review |
| 🟢 Engineering | Technical feasibility of strategic direction; flag architectural implications | Tech debt scan |
| 🟠 AI | AI/voice capability roadmap alignment; what AI features enable this strategy? | Eval audit |
| 🟡 Growth | GTM implications: how does this affect positioning, messaging, sales motion? | ICP update |
| 🟣 Customer | Customer signal: does user feedback support or contradict this direction? | KPI snapshot |

---

### ❓ Any Other Query

| Agent | Primary Task | Background Fallback |
|---|---|---|
| 🔵 Product | Extract any product/UX implication; leave a spec note or roadmap flag | Spec gap review |
| 🟢 Engineering | Extract any technical implication; log as tech debt or task if actionable | Run tests |
| 🟠 AI | Extract any AI/voice implication; log as prompt note or eval task | Prompt audit |
| 🟡 Growth | Extract any content or sales opportunity; log in content calendar or pipeline | Draft 1 content piece |
| 🟣 Customer | Extract any customer impact; update CS playbook or flag health risk | Pull weekly KPIs |

---

## Always-On Background Lanes (zero-idle guarantee)

When an agent has NO primary task for a given query, it MUST execute its background lane:

### 🔵 Product — Background
- Scan `main-project-docs/Feature-Ticket-List.md` for specs missing AC
- RICE-rescore backlog using latest customer signals
- Write/sharpen 1 user story from next sprint

### 🟢 Engineering — Background
- `npm test` in backend + frontend → report failures
- `tsc --noEmit` → report TypeScript errors
- Scan for TODO/FIXME → log as tech debt in TASK-BOARD

### 🟠 AI — Background
- Review current voice agent system prompt version
- Check RAG retrieval quality against latest KB documents
- Review call completion rate and fallback rate

### 🟡 Growth — Background
- Draft 1 LinkedIn post or blog section on feature being built
- Update ICP doc with latest customer signals
- Research 1 competitor move; update positioning doc

### 🟣 Customer — Background
- Weekly KPI snapshot: MRR, churn, activation, adoption
- Review top 3 support ticket themes → route to Product
- Update customer health scores; flag at-risk accounts

---

## Dependency Exception (only case where sequential is allowed)

If Agent B's task literally requires Agent A's output:

```
Sequential allowed:
→ Engineering Agent [Backend sub-role]: "Finalize org API contract"
   WAIT for result →
→ Engineering Agent [Frontend sub-role]: "Implement org form against contract"
```

All other agents still run in parallel during the sequential Engineering sub-tasks.

---

## CEO Checklist (before every response)

- [ ] Identified all 5 agent tasks for this query
- [ ] No agent has an empty task — background lanes assigned where needed
- [ ] All 5 Agent tool calls fired in the same block (or dependency exception noted)
- [ ] All 5 status reports received and synthesized
- [ ] Company Status block included in response with no 💤 Idle entries
- [ ] TASK-BOARD.md updated with any new tasks
