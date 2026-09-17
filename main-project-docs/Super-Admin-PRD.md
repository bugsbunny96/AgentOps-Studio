# Super Admin — Product Requirements Document

**Document type**: Feature PRD  
**Author**: CEO Agent (AgentOps Studio)  
**Status**: Planning — NOT yet in sprint  
**Created**: 2026-07-26  
**Tier**: T0 Vision → T1 Approval required before any implementation  
**Scope**: Complete super-admin capability map for AgentOps Studio

---

## 1. Overview

The Super Admin is a privileged, founder-controlled operator panel that sits above all tenant organisations. It gives Rishabh (and any explicitly authorised team member) **god-mode access** to every entity in the system: users, organisations, agents, calls, knowledge base, billing, content, and infrastructure.

The super admin is **never accessible from the standard dashboard flow**. It runs at a dedicated, secret route (`/superadmin`) and requires a separate credential or 2FA token beyond a normal login session.

### Design principles

| Principle | Meaning |
|---|---|
| **Total visibility** | Every entity across every org is readable from one place |
| **Surgical control** | Every entity is writable, deletable, or overridable |
| **Impersonation-first** | Switch into any org with full context, not just read-only |
| **Audit everything** | Every super-admin action is logged with timestamp, actor, and diff |
| **Blast-radius limit** | Destructive operations (delete org, ban user) require typed confirmation |

---

## 2. Access & Authentication

### 2.1 Route

- URL: `/superadmin` (hidden — not linked from any public or dashboard UI)
- Separate session cookie (`sas-session`) distinct from the user session cookie
- Rate-limited login: 5 attempts → 15-min lockout

### 2.2 Credential model

**Option A (recommended for MVP):** Super admin logs in with their normal account, but must also provide a time-based OTP (TOTP — Google Authenticator / Authy). The backend checks `user.isSuperAdmin === true` before issuing the `sas-session` cookie.

**Option B (future hardening):** Dedicated super-admin user record in a separate `superAdminUsers` collection, completely decoupled from tenant users.

### 2.3 Roles within super admin

| Role | Description |
|---|---|
| `root` | Full unrestricted access — founder only |
| `support` | Read + impersonate + soft-delete only; no billing overrides |
| `content` | Blog + promo codes only; no org access |

For MVP: only `root` role. `support` and `content` are Phase 2 additions.

### 2.4 Audit log

Every action creates an immutable record in `superAdminLogs` collection:

```
{
  actorId, actorEmail,
  action,          // e.g. "ORG_SWITCH", "USER_BAN", "PROMO_CREATE"
  targetEntity,    // e.g. "Organization", "User", "PromoCode"
  targetId,
  diff,            // before/after JSON snapshot
  ip, userAgent,
  timestamp
}
```

Audit logs are read-only — not even `root` can delete them.

---

## 3. Super Admin Dashboard (Home)

The landing screen after login. Gives a live cross-platform pulse.

### 3.1 KPI summary strip

| Metric | Data source |
|---|---|
| Total organisations | `Organization.countDocuments()` |
| Active users (30d) | `User` — last login within 30 days |
| Total calls (today / 7d / 30d) | `Call.aggregate` |
| MRR (estimated) | Sum of active plan prices across orgs |
| Failed calls (24h) | `Call` where `status=failed` |
| Pending KB crawl jobs | BullMQ `kb-crawl` queue depth |
| Open promo codes | `PromoCode` where `active=true` |

### 3.2 Activity feed

Live stream of the last 50 super-admin actions from the audit log, shown as a timeline.

### 3.3 System health bar

Quick visual: MongoDB ping, Redis ping, BullMQ queue depth, Vapi API reachability.

---

## 4. Organisation Management

### 4.1 Org list view

- Table: org name, slug, plan, MRR, call count (30d), agent count, member count, created date, status
- Filters: by plan, by date range, by status (active / suspended)
- Search: by name or slug
- Sort: by MRR, call volume, creation date, member count
- Export to CSV

### 4.2 Org detail view

Full org record including:
- All settings (Vobiz phone, Vapi IDs, industry, language)
- Plan and billing state
- Usage meters: KB docs, team members, minutes used
- Member list with roles
- Agent list
- Call history (last 50)
- KB document list
- Audit trail for this org

### 4.3 Org CRUD

| Operation | Detail |
|---|---|
| **Create** | Provision a new org (name, slug, owner email, initial plan) — useful for manually onboarding enterprise clients |
| **Update** | Edit any org field — name, industry, plan, phone number, Vapi config |
| **Suspend** | Disable an org without deleting — all agent calls return a "service unavailable" message |
| **Delete** | Hard delete with cascade (agents, calls, KB, team) — requires typed slug confirmation |

### 4.4 Org switching (impersonation)

The most important super-admin capability.

**Flow:**
1. Super admin clicks "Switch into org" on any org record
2. Backend issues a temporary `impersonation token` scoped to that org (TTL 4 hours)
3. The standard dashboard loads with a persistent red `⚠ Super Admin Mode — <org name>` banner at the top of every page
4. Super admin can perform any action the org owner can: create agents, delete calls, change settings, add/remove members
5. "Exit impersonation" button in the banner returns to the super-admin panel
6. Every action taken during impersonation is attributed to the original super admin in the audit log, NOT the org owner

**What impersonation unlocks inside the normal dashboard:**
- Full org settings, including resetting Vapi/Vobiz config
- Adding or removing any team member
- Editing or deleting any agent
- Downloading call exports
- Viewing transcripts and summaries
- Changing the org's billing plan (via super-admin override, no Stripe needed)

---

## 5. User Management

### 5.1 User list view

- All users across all orgs
- Columns: name, email, org (primary), role, plan, last login, status
- Search by email or name
- Filter by org, plan, status

### 5.2 User detail view

- Profile fields (name, email, phone)
- All org memberships with role per org
- Login history (last 10 sessions)
- Audit trail for this user

### 5.3 User CRUD

| Operation | Detail |
|---|---|
| **Create** | Create user account manually (for enterprise onboarding) |
| **Update** | Edit name, email, reset password link, phone |
| **Impersonate** | Log in as this user in their org (same impersonation flow as org-level) |
| **Suspend** | Revoke sessions + block future logins without deleting data |
| **Delete** | Anonymise PII, remove from all orgs — GDPR compliance path |

### 5.4 Membership management

- Add any user to any org with any role (Owner / Admin / Member)
- Remove user from org
- Promote/demote role within org
- Transfer org ownership to another user

---

## 6. Agent Management

### 6.1 Global agent list

- All agents across all orgs
- Columns: name, org, language, status (live/draft), Vapi provisioned (Y/N), call count (30d)
- Filter by org, language, status

### 6.2 Agent CRUD (as super admin)

Same as org-level agent CRUD but scoped globally:
- Edit system prompt, voice, language, greeting
- Force re-provision to Vapi (useful when Vapi sync breaks)
- Delete agent (with confirmation)

### 6.3 Vapi sync tool

A dedicated action button: "Force sync all agents" → triggers a background job that reconciles all agents in the DB with their Vapi assistant state and reports mismatches.

---

## 7. Calls Management

### 7.1 Global call log

- All calls across all orgs, newest first
- Columns: caller number, org, agent, direction, status, duration, cost, date
- Filters: by org, by status, by direction, by date range
- Search by caller number or Vapi call ID

### 7.2 Call detail view

Same as the customer-facing call detail page but accessible globally. Includes transcript + AI summary.

### 7.3 Call operations

| Operation | Detail |
|---|---|
| **Delete** | Remove call record + transcript + summary (GDPR erasure) |
| **Re-summarise** | Trigger AI summary regeneration for a specific call |
| **Export** | Download CSV of filtered calls |
| **Flag** | Mark a call for quality review |

---

## 8. Knowledge Base Management

### 8.1 Global KB list

- All KB documents across all orgs
- Columns: title, org, source (manual/crawl), status (ready/pending/failed), doc count, indexed date

### 8.2 KB operations

| Operation | Detail |
|---|---|
| **Delete** | Remove any KB document |
| **Re-crawl** | Trigger re-crawl of any website-sourced KB |
| **Clear org KB** | Delete all KB docs for an org (e.g. before offboarding) |
| **Queue inspection** | View pending BullMQ KB crawl jobs and cancel or retry them |

---

## 9. Blog Management (Requested)

### 9.1 Purpose

The founder (or content-role admin) can publish blog posts directly from the super admin panel. Posts appear on the public `/blog` page without any developer involvement.

### 9.2 Data model — `BlogPost`

```
{
  _id,
  slug,            // auto-generated from title, e.g. "how-voice-ai-works"
  title,           // Heading (h1 on the blog page)
  subtitle,        // Subheading (h2 / deck)
  body,            // Main content — plain text OR Markdown
  coverImage?      // Optional URL or uploaded image
  author,          // Super admin name / display name
  tags,            // string[] — for filtering on /blog
  status,          // 'draft' | 'published'
  publishedAt,     // set when status → published
  createdAt,
  updatedAt,
}
```

### 9.3 Compose flow

1. Super admin opens **Blog → New Post**
2. Fills in:
   - **Title** (heading) — required
   - **Subtitle** (subheading) — optional
   - **Body** — large textarea; supports Markdown so bold/links/lists render properly
   - **Tags** — comma-separated
   - **Cover image** — URL paste or file upload
3. Clicks **Publish Now** → status = `published`, `publishedAt` = now; post appears on `/blog`  
   OR clicks **Save Draft** → post saved but not visible publicly
4. The `/blog` page (already in the codebase) fetches `GET /api/v1/blog?status=published` and renders cards

### 9.4 Blog CRUD

| Operation | Detail |
|---|---|
| **Create** | New post (described above) |
| **Update** | Edit title, subtitle, body, tags, cover image at any time |
| **Publish / Unpublish** | Toggle status between `draft` and `published` |
| **Delete** | Permanent delete with confirmation |

### 9.5 Blog list view in super admin

Table of all posts with: title, status, author, tags, published date, view count (Phase 2). Inline publish/unpublish toggle.

---

## 10. Promo Code Management (Requested)

### 10.1 Purpose

Create discount codes that users enter at checkout (Stripe) or that the super admin applies directly to any org's subscription.

### 10.2 Data model — `PromoCode`

```
{
  _id,
  code,             // e.g. "LAUNCH50" — unique, uppercase
  discountType,     // 'percent' | 'fixed_inr'
  discountValue,    // e.g. 50 (percent) or 2000 (₹2000 off)
  appliesTo,        // 'starter' | 'growth' | 'both' | 'all'
  billingCycle,     // 'monthly' | 'annual' | 'both'
  maxUses,          // null = unlimited
  usedCount,        // auto-incremented on redemption
  validFrom,        // Date
  validUntil,       // Date | null (no expiry)
  active,           // boolean — can be toggled off instantly
  createdBy,        // super admin ID
  notes,            // internal notes (not customer-visible)
  createdAt,
  updatedAt,
  redemptions: [{   // embedded subdocs
    orgId, userId, redeemedAt, planAtRedemption
  }]
}
```

### 10.3 Create promo code flow

1. Super admin opens **Promo Codes → New Code**
2. Fills in:
   - **Code** (e.g. LAUNCH50) — auto-uppercase, uniqueness checked
   - **Discount type**: % off OR ₹ fixed amount off first month
   - **Discount value**: number
   - **Applies to**: Starter only / Growth only / Both
   - **Billing cycle**: Monthly / Annual / Both
   - **Max uses**: leave blank for unlimited
   - **Valid from / until**: date pickers
   - **Notes**: internal field (never shown to customers)
3. Click **Create** → code is immediately active

### 10.4 Promo code operations

| Operation | Detail |
|---|---|
| **Create** | Described above |
| **Edit** | Change value, expiry, max uses, active flag |
| **Disable** | Toggle `active = false` — code immediately stops working mid-funnel |
| **Delete** | Hard delete (only if `usedCount === 0`, otherwise disable instead) |
| **View redemptions** | Table of every org that used the code, with date and plan |
| **Apply manually** | Super admin applies a promo to a specific org directly — no checkout required |

### 10.5 How codes integrate at checkout

- Stripe Checkout accepts promo codes natively — the `billing/checkout` endpoint passes the promo code to Stripe as a `discounts` array
- Our DB validates that the code is active, not expired, not over max uses, and applies to the selected plan before forwarding to Stripe
- On successful payment webhook, `usedCount` increments and a `redemptions` entry is added

---

## 11. Billing & Subscription Override

Super admins can bypass Stripe and directly manipulate any org's plan — useful for enterprise deals, grace periods, and manual refunds.

### 11.1 Plan override

- Select any org → **Override Plan** → choose plan → set expiry date (or perpetual)
- Writes `plan` and `planOverrideExpiry` to the org record
- A cron job checks `planOverrideExpiry` daily and reverts to the last Stripe-confirmed plan when it expires

### 11.2 Billing dashboard view

| Metric | |
|---|---|
| MRR (sum of active plan prices) | Live |
| ARR | MRR × 12 |
| Orgs per plan | Grouped count |
| Trial orgs (nearing expiry) | Countdown list |
| Recently churned | Plan downgraded in last 30d |
| Top orgs by call volume | Cross-sell signal |

### 11.3 Invoice management

- View Stripe invoices for any org
- Trigger manual invoice send
- Apply credit (Stripe credit balance)
- Process manual refund via Stripe API

---

## 12. Platform Analytics & Reporting

Cross-org analytics the founder needs to make product and growth decisions.

### 12.1 Usage analytics

- Total calls by day / week / month (across all orgs)
- Calls by direction (inbound/outbound ratio)
- Avg call duration trend
- Language distribution (Hindi vs English)
- Failed / missed call rate
- Agent count growth over time

### 12.2 Growth analytics

- New org sign-ups by day / week
- Onboarding funnel drop-off (which step are users abandoning?)
- Trial → paid conversion rate
- Churn rate (plan downgrades + cancellations per month)
- Promo code redemption rate

### 12.3 Revenue analytics

- MRR chart (last 12 months)
- ARPU (Average Revenue Per User / Org)
- LTV estimate (ARPU / churn rate)
- Revenue by plan (Starter vs Growth)

### 12.4 Export

All analytics tables exportable to CSV. Time range picker on every chart.

---

## 13. Feature Flags

Per-org or global toggles to enable/disable features without deploying code.

### 13.1 Global flags (affect all orgs)

Examples:
- `MAINTENANCE_MODE` — show maintenance banner, disable all agent calls
- `BLOG_ENABLED` — show/hide blog section
- `OUTBOUND_CALLS_ENABLED` — kill switch for outbound calls
- `NEW_ONBOARDING_FLOW` — A/B test new onboarding

### 13.2 Per-org flags

Useful for:
- Enabling beta features for specific orgs ("early access")
- Disabling specific features as a penalty for abuse
- Enterprise-only capabilities (e.g. SSO, custom subdomain)

Examples:
- `HINDI_ENABLED` — toggle language for specific org
- `KB_CRAWLER_ENABLED` — enable/disable website crawling per org
- `ANALYTICS_V2` — new analytics dashboard for beta orgs
- `CUSTOM_SUBDOMAIN` — enterprise-only white-label

### 13.3 Flag management UI

Table of all flags with description, scope (global/org), current value (on/off), last changed by, last changed at. Toggle switch in-line. Per-org flags have an org picker.

---

## 14. Announcements & Communications

### 14.1 In-app banner

- Super admin creates a banner (text + type: info/warning/critical)
- Banner appears across the top of the dashboard for all logged-in users (or specific plan only)
- Example: "Scheduled maintenance on 2 Aug 2am–4am IST"
- Has a dismiss button (or can be made un-dismissable for critical alerts)
- Auto-expires at a set date/time

### 14.2 Broadcast email

- Compose an email (subject + body)
- Audience: all users / specific plan / specific org
- Preview before sending
- Backed by an email service (Resend / SendGrid — already in use for auth emails)

### 14.3 Changelog entries

- Super admin adds a changelog entry (title, description, date, type: new/improved/fixed)
- Entries appear on a future `/changelog` public page
- Also shown as a "What's new" dot in the dashboard nav

---

## 15. System Health & Monitoring

### 15.1 Real-time health panel

| Check | How |
|---|---|
| MongoDB ping | `db.adminCommand({ ping: 1 })` |
| Redis ping | `client.ping()` |
| BullMQ queues | Job counts: active, waiting, completed (24h), failed (24h) |
| Vapi API | `GET https://api.vapi.ai/assistant` with org's key |
| Vobiz API | Ping Vobiz health endpoint |

### 15.2 Error log viewer

- Last 500 application errors (from a `errorLogs` collection the global error handler writes to)
- Filter by error type, org, date
- Group by error message to surface repeating issues
- One-click "Create GitHub issue" (Phase 2)

### 15.3 BullMQ job inspector

- View all queues: `kb-crawl`, `email`, `vapi-sync`
- See job status: waiting / active / completed / failed / delayed
- Retry failed jobs individually or in bulk
- Clear completed jobs older than N days
- Pause / resume a queue

### 15.4 Database stats

- Collection sizes and document counts
- Slow query log (top 10 queries >100ms)
- Index usage report

---

## 16. Security & Safety Model

### 16.1 What super admins can NEVER do

Even `root` role cannot:
- Read a user's plaintext password (bcrypt hashes only)
- Bypass audit logging
- Delete audit logs
- Generate Stripe webhooks (read-only Stripe access)

### 16.2 Destructive action safeguards

Any of these requires typing a confirmation phrase before executing:

| Action | Confirmation phrase required |
|---|---|
| Delete an org | Type org slug |
| Hard delete a user | Type user's email |
| Clear all KB docs for an org | Type "delete all documents" |
| Broadcast email to all users | Type "send to all users" |
| Disable a running agent | Type agent name |

### 16.3 Impersonation transparency

- Org owners can see "Recent admin access" in their Settings page — a timestamped log of any super-admin impersonation sessions into their org (without revealing what the admin did)
- This builds trust: customers know when and that someone accessed their account

### 16.4 Rate limiting on super admin API

All super-admin endpoints (`/api/v1/superadmin/*`) are behind a separate Express middleware that:
- Checks for the `sas-session` cookie
- Verifies `user.isSuperAdmin === true`
- Rate limits at 120 requests/minute
- Logs every request to the audit trail

---

## 17. Technical Architecture

### 17.1 Backend structure

```
backend/src/
  modules/
    superadmin/
      superadmin.routes.ts    → /api/v1/superadmin/*
      superadmin.middleware.ts → isSuperAdmin guard
      superadmin.controller.ts
      superadmin.service.ts
      superadmin-audit.service.ts
    blog/
      blog.model.ts
      blog.routes.ts          → /api/v1/blog/*
      blog.controller.ts
      blog.service.ts
    promo/
      promo.model.ts
      promo.routes.ts         → /api/v1/superadmin/promo/*
      promo.controller.ts
      promo.service.ts
```

### 17.2 Frontend structure

```
frontend/src/
  features/
    superadmin/
      SuperAdminLayout.tsx    → dedicated dark-red-accent layout
      SuperAdminLoginPage.tsx
      SuperAdminDashboard.tsx
      orgs/
        OrgListPage.tsx
        OrgDetailPage.tsx
      users/
        UserListPage.tsx
        UserDetailPage.tsx
      blog/
        BlogListPage.tsx
        BlogComposePage.tsx
      promo/
        PromoListPage.tsx
        PromoComposePage.tsx
      billing/
        BillingOverviewPage.tsx
      flags/
        FeatureFlagsPage.tsx
      health/
        SystemHealthPage.tsx
      analytics/
        AnalyticsPage.tsx
      comms/
        AnnouncementsPage.tsx
```

### 17.3 New Mongoose models required

| Model | Purpose |
|---|---|
| `SuperAdminLog` | Audit trail (immutable) |
| `BlogPost` | Blog content |
| `PromoCode` | Promo/discount codes |
| `FeatureFlag` | Global + per-org feature toggles |
| `Announcement` | In-app banner + email broadcast records |
| `Changelog` | Product changelog entries |
| `ErrorLog` | Application error records (written by global error handler) |

### 17.4 Route guard

```typescript
// middleware/isSuperAdmin.ts
export async function isSuperAdmin(req, res, next) {
  const user = await UserModel.findById(req.userId);
  if (!user?.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
  next();
}
```

`UserModel` needs a new `isSuperAdmin: Boolean` field (default `false`). Set it manually in MongoDB for the founder account.

---

## 18. Implementation Phases

All phases require founder T1 approval before sprint entry.

### Phase 1 — Core Access + Org Control (Highest Priority)
*Estimated: 3–4 sessions*

| # | Feature |
|---|---|
| 1.1 | `isSuperAdmin` flag on User model |
| 1.2 | Super admin login page + session guard middleware |
| 1.3 | Audit log model + service |
| 1.4 | Super admin dashboard home (KPI strip + health bar) |
| 1.5 | Org list + detail view |
| 1.6 | Org impersonation (switch-into-org) + red banner in dashboard |
| 1.7 | User list + detail view |
| 1.8 | User suspend / delete |

### Phase 2 — Content + Monetisation (High Priority)
*Estimated: 2–3 sessions*

| # | Feature |
|---|---|
| 2.1 | Blog model + API endpoints |
| 2.2 | Blog compose UI in super admin |
| 2.3 | Blog list/edit/delete in super admin |
| 2.4 | `/blog` page renders from DB (replaces any static content) |
| 2.5 | Promo code model + API endpoints |
| 2.6 | Promo code create/edit/disable UI |
| 2.7 | Checkout integration — validate promo before Stripe |
| 2.8 | Manual promo apply (override billing without Stripe) |

### Phase 3 — Billing Override + Analytics (Medium Priority)
*Estimated: 2 sessions*

| # | Feature |
|---|---|
| 3.1 | Plan override for any org |
| 3.2 | Billing dashboard (MRR, churn, trial list) |
| 3.3 | Platform analytics (call volume, sign-up funnel, conversion) |
| 3.4 | Revenue analytics charts |

### Phase 4 — Ops Tools (Medium Priority)
*Estimated: 2 sessions*

| # | Feature |
|---|---|
| 4.1 | Feature flags model + API |
| 4.2 | Feature flags UI (global + per-org) |
| 4.3 | BullMQ job inspector |
| 4.4 | Error log viewer |
| 4.5 | System health panel |

### Phase 5 — Communications + Polish (Lower Priority)
*Estimated: 1–2 sessions*

| # | Feature |
|---|---|
| 5.1 | In-app announcement banner system |
| 5.2 | Broadcast email compose + send |
| 5.3 | Changelog management |
| 5.4 | Membership transfer (org ownership reassignment) |
| 5.5 | "Recent admin access" log in customer Settings page |

---

## 19. CEO/Founder Additional Suggestions

These were not requested but are strongly recommended given the product direction and future scale. All are T1 decisions before sprint entry.

### 19.1 Impersonation with time-boxed tokens

Rather than simple session override, issue a signed JWT (`imp_token`) with TTL and org scope. This allows future extension to "share an impersonation session" with a support team member without giving them full super-admin access.

### 19.2 Org health score

A calculated score (0–100) shown on the org list:
- Factors: has agent live (+30), KB docs > 0 (+20), calls this week (+20), team size > 1 (+10), plan paid (+20)
- Low score orgs are "at churn risk" — surfaces them for proactive outreach

### 19.3 Self-serve enterprise onboarding portal

A super-admin-triggered flow that sends an enterprise prospect a pre-filled onboarding link that skips the normal trial and starts them on a custom plan. Useful when deals close on WhatsApp / calls outside the product.

### 19.4 Data export for any org (GDPR / audit)

One-click "Export everything" for a specific org: agents, calls (with transcripts), KB docs, team members, billing history — as a ZIP. Required by PDPB (India's data protection law) and reduces support load.

### 19.5 Voice quality monitoring

A sampling system that flags calls with low confidence scores or high fallback rates. Super admin sees a "Voice Quality" section with problematic calls highlighted, enabling prompt intervention before the customer notices.

### 19.6 Automated churn risk alerts

A daily background job that scores each org on churn risk (no calls in 7d, approaching KB limit, trial ending in 3d). Sends a Slack/email alert to the founder with the list so proactive outreach can happen.

### 19.7 White-label / sub-brand support

Enterprise orgs sometimes want their own branding. A feature flag + config (custom logo URL, brand colour, support email) that the super admin can set per org. The customer's dashboard shows their brand instead of AgentOps.

### 19.8 Referral tracking

Track which user referred which org. Useful when growth happens via word-of-mouth (likely in Indian SMB market). Super admin can see referral chains and reward top referrers with extended trials or promo codes.

### 19.9 A/B test manager

Super admin defines variants (e.g. two different onboarding flows, two pricing page headlines), assigns orgs or users to variants, and tracks conversion per variant. Removes the need for an external A/B tool at early stage.

### 19.10 Vapi bill reconciliation

Vapi charges per minute. The super admin should see a reconciliation view: what Vapi billed us vs. what we billed each org. Any org where usage significantly exceeds what we're charging them is a margin risk.

---

## 20. Open Questions (Resolve Before Phase 1 Starts)

| # | Question | Options | Recommended |
|---|---|---|---|
| Q1 | Super admin route: `/superadmin` or subdomain `admin.agentops.studio`? | Subdomain is more secure (separate CORS, cookie scope) | Subdomain for production; same-origin path for MVP |
| Q2 | Blog editor: plain textarea or rich-text (Markdown preview)? | Plain textarea (simplest), Markdown with preview, WYSIWYG | Markdown + live preview — best UX for content quality |
| Q3 | Promo code Stripe integration: Stripe coupon API or our own validation? | Own DB validation → pass discount to Stripe | Own validation first (no Stripe coupon needed for MVP) |
| Q4 | Who else gets `isSuperAdmin` access? | Founder only, or future "support agent" role too? | Founder only for Phase 1 |
| Q5 | Impersonation transparency: notify org owners in real time or just a log? | Real-time email on impersonation start, or silent log only | Silent log in Settings for Phase 1 |

---

## 21. Document History

```
[2026-07-26 00:00] v1.0 — CEO Agent
Type: Feature PRD — Planning
Status: Planning · NOT yet in sprint
Trigger: Founder request
Summary: Complete super-admin capability map created from scratch. Covers
         15 functional areas, 3 new feature categories (Blog, Promo, Flags),
         5 new Mongoose models, phased implementation plan, and 10 strategic
         suggestions from the CEO Agent.
Founder decision needed: Yes — T1 approval required before Phase 1 begins
```
