# AgentOps Studio — Gaps Register

> **Version history**
> - [2026-10-01 10:40] v2.3 — CEO Agent — SEC-01 and SEC-13 fixed in code (branch `harden/h1.1-h1.7`); status notes added. Both stay open until deployed.
> - [2026-10-01 10:15] v2.2 — CEO Agent — Launch-readiness audit against a 20-item "vibe-coded app" checklist (legal, secrets, HTTPS, cookies, SEO, images, speed, contrast, mobile, 404, links, forms, spam, analytics, CTA). Added SEC-13, FE-09…FE-18, § 12 (checklist status) and § 13 (agent operating system, PROPOSED, PROC-01…02). Existing gaps unchanged.
> - [2026-09-30 10:40] v2.1 — CEO Agent — Added § 11 (AI implementation offer: GTM-01…03, INT-01…04, ROI-01, OFR-01…02) from the post-vs-product review. Full specs in `AI-Implementation-Offer-Plan.md`. Existing gaps unchanged.
> - [2026-09-29 22:57] v2.0 — CEO Agent (full codebase audit) — Rewrote the register from a line-by-line read of backend, frontend, scripts, CI and docs. Replaces the v1 "Week 1–3 launch blockers" list; its items are tracked in § 10.
> - v1.0 (undated) — Founder — Week 1–3 launch-blocker checklist.

**Product stance (founder decision, 2026-09-29):** AgentOps Studio is a **multi-industry SaaS**. The electrical-shop code (Ritu Electricals) is the first vertical, and it must become per-industry configuration before launch (§ 3).

**How to read this file**
- **P0**: security hole or core flow broken. Fix before any paying customer.
- **P1**: wrong behaviour, inconsistency, or a launch requirement.
- **P2**: polish, tests, ops and docs.
- Every gap gives the file where the evidence is, its impact, and the fix. Task IDs on `TASK-BOARD.md` use these gap IDs.
- ⚠️ **Verify** means the code strongly suggests a bug, but no one has confirmed it on the live system.

---

## Summary

| Area | P0 | P1 | P2 |
|---|---|---|---|
| Security | 6 | 7 | — |
| Core call & onboarding flow | 5 | 4 | — |
| Multi-industry readiness | — | 5 | — |
| Plans, billing and limits | 1 | 6 | — |
| Team, roles and tenancy | — | 4 | — |
| Super-admin | — | 3 | — |
| Frontend and marketing site | — | 8 | 10 |
| Tests, CI and ops | — | 3 | 6 |
| Documentation | — | — | 3 |
| AI implementation offer (GTM, integrations, ROI) | — | 6 | 4 |
| Agent operating system (PROPOSED) | — | — | 2 |

---

## 1. Security

| ID | Pri | Gap | Evidence | Impact | Fix |
|---|---|---|---|---|---|
| SEC-01 | P0 | The `submit_order` tool webhook secret check is ineffective. It returns `true` when the secret is not configured, when the `x-webhook-secret` header is missing, and when the header length does not match ("POC mode"). | `backend/src/modules/orders/order.routes.ts:27-45` | Anyone who knows or guesses an assistantId can inject fake orders into any org. | Return `false` in all three branches. Configure the header on the Vapi tool. Add tests. **2026-10-01: code fixed** (fails closed; accepts `x-webhook-secret` or `x-vapi-secret`; 10 tests in `orders.submit.test.ts`) on branch `harden/h1.1-h1.7`; closes when the Vapi tool sends the secret and the branch is deployed. |
| SEC-02 | P0 | Super-admin credentials are hardcoded in committed scripts. | `backend/scripts/create-super-admin.js`, `backend/scripts/seed-super-admin.js` (in git history) | Anyone with repo access can log in to the super-admin portal, which can impersonate any org. | **Rotate the super-admin password now.** Read credentials from env or a CLI prompt. Consider purging git history. |
| SEC-03 | P0 | The Redis Cloud URL and password sit in a comment line in `backend/.env` and in the stale `backend/.env.bak`. | `backend/.env`, `backend/.env.bak` (gitignored, plaintext on disk) | Credential leak through backups, screenshots or AI tools. | **Rotate the Redis password.** Delete the comment and `.env.bak`. |
| SEC-04 | P0 | `SA_JWT_SECRET` falls back to a hardcoded default. | `backend/src/config/env.ts:22` | If the variable is unset on Render, anyone can forge super-admin session tokens. | Make it required when `NODE_ENV=production`. Confirm it is set on Render. |
| SEC-05 | P0 | The org-scoping and permission middleware is never mounted: `validateOrganization`, `attachEffectivePlan` and `requirePaidOrTrial` (trialGate) are defined but no route uses them. Controllers resolve the org with `MembershipModel.findOne({ userId })`, with no role or permission check. | `backend/src/middleware/*`; agents, calls, catalog and telephony controllers | Members (not only Owners) can re-provision the agent, change voice and config, link numbers, edit the catalog and place outbound calls. The `X-Organization-ID` header is ignored, so multi-org is broken. Expired trials are not blocked on the API. | Mount `authenticate → validateOrganization → attachEffectivePlan` on every org route. Add role and permission checks per route. Resolve the org from the header. |
| SEC-06 | P0 | Phone-number hijack: `POST /agents/phone-number` accepts any Vapi `phoneNumberId` with no uniqueness or ownership check. The Settings page exposes this to every member. | `backend/src/modules/agents/agent.service.ts` (`linkPhoneNumber`); `frontend/src/features/settings/SettingsPage.tsx` (PhoneNumberSetup) | One org can reroute another org's inbound number to its own assistant. | Check that the number is unclaimed or already owned by the org. Make the endpoint Owner-only. Prefer the Vobiz picker flow and retire manual UUID entry. |
| SEC-07 | P1 | The crawler has no protection against server-side request forgery: no private-IP or localhost blocking, and it follows cross-origin sitemap URLs. It ignores robots.txt `Disallow`. | `backend/src/modules/onboarding/crawler.service.ts` | Latent today because the crawl worker is off. Becomes P0 the moment the worker is re-enabled. | Resolve DNS and block private ranges; keep the crawl same-origin; honour robots.txt. |
| SEC-08 | P1 | `GET /team/admin-access-log` trusts `X-Organization-ID` without checking that the caller is a member of that org. | `backend/src/modules/team/*` (`orgAdminAccessLogHandler`) | Any logged-in user can read another org's super-admin access log. | Check membership, Owner only. |
| SEC-09 | P1 | Email templates interpolate the user's `name` and LLM-generated follow-up text without HTML escaping. | `backend/src/utils/email.ts`; `backend/src/jobs/followUpAlert.worker.ts` | HTML injection in outgoing emails. | Escape every interpolated value. |
| SEC-10 | P1 | Super-admin login has no dedicated rate limit; the auth limiter covers only the customer auth routes. | `backend/src/app.ts` | Brute-force risk on the most privileged login. | Add a strict limiter (e.g. 5 per 15 min) plus lockout. |
| SEC-11 | P1 | Auth hardening: the email-verification token is stored in plaintext; change-password does not revoke other sessions; `authenticate` does not check user status, so suspended users keep access until their tokens expire. | `backend/src/modules/auth/*`, `backend/src/middleware/authenticate.ts` | Account-takeover window; suspension is not immediate. | Hash the token; revoke the refresh token on password change; check status in `authenticate` (or on refresh). |
| SEC-12 | P1 | Order org resolution falls back to "the only org" when the assistantId is not found and exactly one org exists. | `backend/src/modules/orders/*` (`resolveOrgByAssistantId`) | Orders get attributed to the wrong tenant (and it hides misconfiguration). | Remove the fallback; reject unknown assistants. |
| SEC-13 | P1 | Production builds publish source maps: `sourcemap: true` in the Vite config ships 126 `.map` files to Vercel. | `frontend/vite.config.ts:42` | Anyone can read the full, unminified frontend source (routes, API shapes, super-admin pages, internal comments). | Set `sourcemap: 'hidden'`; upload maps to Sentry in CI (`SENTRY_AUTH_TOKEN` is already planned in `.env.example`); confirm no `.map` is served. **2026-10-01: fixed** on branch `harden/h1.1-h1.7` (`vite.config.ts`: `sourcemap: 'hidden'`, maps deleted after build or after Sentry upload). |

## 2. Core call and onboarding flow

| ID | Pri | Gap | Evidence | Impact | Fix |
|---|---|---|---|---|---|
| CORE-01 | P0 | The end-of-call job drops `artifact`. The enqueued payload has no `artifact`, so `structuredDataOutput` (intent, products, order, follow-up) and `artifact.recordingUrl` never reach the worker. | `backend/src/modules/calls/webhook.controller.ts:91-103`; consumer at `webhook.service.ts:416-422` | Structured call results, follow-up alerts and newer-payload recordings are silently lost for every call. | Add `artifact: ev.artifact` to the job data. Add a webhook test. |
| CORE-02 | P0 | Seven of the eight BullMQ workers are disabled to stay under the Redis free tier's 30-connection limit: crawl, kb, churnRisk, trialEmail, trialScan, callMinutesReset and followUpAlert. Only callReport runs. | `backend/src/index.ts` | Website crawls stay `pending` forever. Manual KB documents never become `ready` and never sync to Vapi. There are no trial emails, no follow-up alerts, no churn scans, and no monthly minutes reset (see BIZ-01). | Put all workers on one shared connection, or upgrade Redis, and re-enable them one at a time. Until then, show the user that crawl/KB processing is unavailable. |
| CORE-03 | P0 | The global rate limit (100 requests per 15 min on `/api/v1`) also covers `/webhooks/vapi` and the order tool route. | `backend/src/app.ts` | On a busy line, Vapi gets HTTP 429 on `assistant-request`, so calls fail or fall back. | Mount webhooks before the limiter, or skip them in it. |
| CORE-04 | P0 ⚠️ Verify | The Dashboard unwraps API responses wrongly: `/agents` uses `r.data?.agents` and `/calls?limit=6` uses `r.data?.calls`, but both APIs return `{ success, data: {...} }`. | `frontend/src/features/dashboard/DashboardPage.tsx:446,458,799` | Once any call exists, `recentCalls.slice` is not an array method on the envelope object, so the page is likely to crash to the route error page. The agent count shows "undefined configured". | Use `r.data.data.agents` and `r.data.data.calls`. Add a test. |
| CORE-05 | P0 ⚠️ Verify | Production auth may be broken across sites. The frontend runs on `*.vercel.app` and the API on `*.onrender.com` (both public-suffix domains), cookies are `SameSite=Strict`, and `vercel.json` has no `/api` proxy. | `backend/src/modules/auth/auth.service.ts:26-33`; `frontend/vercel.json`; `frontend/src/utils/api.ts:4` | Browsers do not send the cookies on cross-site XHR, so login appears to succeed but every call returns 401. | Use a custom domain (`app.` + `api.` on one site), or add a Vercel rewrite `/api/* → Render` with `VITE_API_URL=''`. |
| CORE-06 | P1 | The webhook handles `call-started`, but Vapi sends `status-update` (status `in-progress`) instead. | `backend/src/modules/calls/webhook.controller.ts:72` | The Call record is created only at end-of-call, so "active call" and live states never show. | Handle `status-update`. |
| CORE-07 | P1 | Order safety rules are never in the prompt: `generateSystemPrompt(org, kb, catalog, includeOrderSafetyRules)` is never called with the fourth argument. The prompt also mentions a transfer function, but no transfer tool is configured. | `backend/src/modules/agents/prompt.utils.ts` and its callers | The agent can take unsafe orders, and it may promise transfers it cannot make. | Pass the flag when an org has orders enabled. Add a `transferCall` tool that uses `fallbackNumber`, or remove the transfer text. |
| CORE-08 | P1 | Transcript turn timestamps are all set to `now`. | `backend/src/modules/calls/webhook.service.ts` (turn mapping) | Every turn offset in the UI shows 0:00. | Use `secondsFromStart` or `time` from Vapi messages. |
| CORE-09 | P1 | Onboarding and KB polling never time out: CrawlLoadingPage polls every 2 s forever, and the KB page polls every 4 s while the crawl is pending. | `frontend/src/features/onboarding/CrawlLoadingPage.tsx:181`; `KnowledgeBasePage.tsx:1344` | Combined with CORE-02, users are stuck on the crawl screen unless they notice "Skip". | Add a timeout (e.g. 3 min) with a fallback to "fill manually". |

## 3. Multi-industry readiness (founder decision: multi-industry SaaS)

| ID | Pri | Gap | Evidence | Fix |
|---|---|---|---|---|
| IND-01 | P1 | The catalog is electrical-only: category enum, a 32-item electrical seed, and seed prices that do not match the live catalog. `seedForOrg` is never called on org creation (only from a script). | `backend/src/modules/catalog/*`; `backend/scripts/*seed*` | Make categories free-form, or define them per industry template. Seed only when the industry template has one. |
| IND-02 | P1 | Orders, the `submit_order` tool and the structured-output schema (`electrical-shop-call-summary`) assume retail ordering. There is no appointment or booking flow for clinics, real estate or services. | `backend/src/modules/orders/*`; env `VAPI_STRUCTURED_OUTPUT_ID` | Define an **industry template** (catalog on/off, tools, structured-output schema, prompt block) and select it from `org.industry`. Build a booking tool for service industries. |
| IND-03 | P1 | The prompt template and evals are Ritu Electricals only: 23 evals in `scripts/vapi-evals`, and a sample prompt for an electrical shop. | `backend/src/modules/agents/prompt.utils.ts`; `scripts/vapi-evals/`; `main-project-docs/SamplePrompt/` | Build per-industry prompt blocks and at least a 10-case eval set per launch industry (EN/HI/PA). |
| IND-04 | P1 | Ops scripts hardcode a single tenant's IDs: assistant `100b3bd9-…` in backend scripts, a different assistant `46c7cddf-…` in `scripts/update-vapi-assistant.mjs`, and a phone-number ID. `restore-ritu-electricals` references a JSON file that does not exist. `clean-kb-docs` inserts documents in the wrong shape. | `backend/scripts/*`; `scripts/update-vapi-assistant.mjs` | Parameterise by orgId, or move the scripts to an `ops/ritu/` folder. Fix or delete the broken scripts. |
| IND-05 | P1 | The `industry` field chosen at onboarding changes only the prompt wording. It does not select the catalog, tools, forms or dashboard modules (Orders and Catalog show for every industry). | `frontend/src/features/onboarding/ConnectPage.tsx`; `DashboardLayout` nav | Drive the nav modules and onboarding forms from the industry template. |

## 4. Plans, billing and limits

| ID | Pri | Gap | Evidence | Impact | Fix |
|---|---|---|---|---|---|
| BIZ-01 | P0 | Call minutes never reset while the reset worker is off. The `assistant-request` gate reads raw `callMinutesUsed` without checking `callMinutesResetAt`. The self-heal only runs when a call *ends*. | `backend/src/modules/calls/webhook.service.ts:294` vs `:483-494` | An org that hits its monthly limit stays blocked forever: no call can complete, so the counter never resets. | Apply the month-boundary check in the gate (and in billing status) as well. |
| BIZ-02 | P1 | The trial's effective plan is inconsistent: `starter` in the webhook minutes gate, `growth` in trialGate, KB and team. The Pricing page says the trial gets the Basic feature set. | `webhook.service.ts:292`; `middleware/trialGate.ts:61`; `kb.service.ts:161`; `team.service.ts:252` | Trial users get different limits in each module. | Define one `getEffectivePlan(org)` helper and use it everywhere. The trial should be `starter` (Basic), per the pricing copy. |
| BIZ-03 | P1 | `planOverride` is ignored by KB limits and billing status. `planOverrideExpiry` is never enforced. Super-admin MRR counts overridden plans as revenue. | KB and billing services; super-admin analytics | Comped orgs hit the wrong limits, and MRR is overstated. | Honour the override and its expiry through the same helper. Compute MRR from Stripe subscriptions. |
| BIZ-04 | P1 | Plan numbers disagree. Pro includes 3,000 min in the backend, but the Pricing and Billing pages say 1,500 (with 3,000 as a fair-use cap). The trial Day-5 email says "from ₹4,100/month". | `PLAN_LIMITS`; `frontend/src/features/public/PricingPage.tsx`; `BillingPage.tsx`; `backend/src/utils/email.ts` | Customer disputes. | Pick one source of truth (the pricing doc of 2026-09-17) and serve the limits from the API. |
| BIZ-05 | P1 | Stripe gaps: no `invoice.payment_failed` or dunning handling, no webhook event idempotency, and none of the advertised setup fees, per-minute overage or recharge packs. | `backend/src/modules/billing/*` | Failed payments keep full access; events can be applied twice; advertised charges can't be billed. | Handle `invoice.payment_failed` with a grace period; store processed event IDs; build or remove the overage and recharge offers. |
| BIZ-06 | P1 | Outbound calls (`POST /calls/initiate`) have no quota, trial, role or feature-flag check. | `backend/src/modules/calls/call.controller.ts` | Unlimited outbound telephony spend from any member, even on an expired trial. | Gate it with trialGate, the minutes quota and the Owner role (or a permission). |
| BIZ-07 | P1 | Features are advertised on Pricing and Billing but not built: WhatsApp and Google Sheets alerts, CRM, n8n and Razorpay integrations, appointment booking, sentiment analysis, 3–5 assistants per plan (the product allows one agent per org), concurrent-call limits, voice cloning and monthly reports. | `PricingPage.tsx`, `BillingPage.tsx`, landing sections | Misleading claims; refund and legal risk. | Label them "coming soon" or remove them until built. |

## 5. Team, roles and tenancy

| ID | Pri | Gap | Evidence | Fix |
|---|---|---|---|---|
| TEAM-01 | P1 | The invite endpoint ignores `permissions` in the request body, although the UI sends them, so every invitee gets the default permissions. | `backend/src/modules/team/team.controller.ts` (invite) | Validate the permissions and store them on the invitation. |
| TEAM-02 | P1 | Permissions disagree between frontend and backend. A Member with `team: true` sees invite, edit and remove buttons, but the routes are Owner-only (403). A Member with `knowledgeBase: true` gets 404 because the KB uses `resolveOwnerOrg`. `listTeam` is open to all members. | `frontend/src/hooks/usePermission.ts`; `TeamPage.tsx:499,581`; `backend/src/modules/team/team.routes.ts`; `knowledge-base/kb.service.ts` | Enforce the same permission keys on the backend (see SEC-05). |
| TEAM-03 | P1 | Roles disagree: the Membership model allows `Owner` and `Member`, `express.d.ts` and old docs also have `Admin`, and a frontend test uses `'Admin'`. There are no route guards for Owner-only pages (they are hidden only in the nav). | `organization.model.ts`; `backend/src/types/express.d.ts`; `frontend/src/routes/index.tsx` | Settle on Owner/Member (plus permissions). Add a `RoleGuard` to routes. |
| TEAM-04 | P1 | Refresh-token rotation logs users out. Redis keeps a single `tokenId` per user, so a second device or two concurrent refreshes log out the other session. The axios 401 interceptor has no single-flight lock. | `backend/src/modules/auth/auth.service.ts`; `frontend/src/utils/api.ts:29-45` | Store one token ID per session (a set). Share a single refresh promise in the interceptor. |

## 6. Super-admin

| ID | Pri | Gap | Evidence | Fix |
|---|---|---|---|---|
| SA-01 | P1 | Broadcast email, its preview, and transfer-ownership query `Membership` by `orgId` (the field is `organizationId`) and filter `User` by `isActive` (which does not exist). | `superadmin.controller.ts:1195-1207`; `superadmin.service.ts:546` | Org and plan broadcasts reach 0 users, and ownership transfer always fails. Fix the field names and use `status`. |
| SA-02 | P1 | Several features are built in super-admin but never read by the customer app: feature flags are enforced nowhere; promo `validate` and `incrementPromoUsage` are not called at checkout; enterprise links, referrals and the A/B `getOrgVariant` are never used. The `ChurnRisk` TTL option is invalid, so documents never expire. The Job Inspector lists only 3 queues. | `backend/src/modules/superadmin/*`; `billing.service.ts` | Wire each feature in, or hide its page. Fix the TTL index. List all queues. |
| SA-03 | P1 | There are no tests for any super-admin route (about 85 endpoints, including impersonation). | `backend/src/__tests__/` | At least auth, impersonation, plan override and user suspend/delete. |

## 7. Frontend and marketing site

| ID | Pri | Gap | Evidence | Fix |
|---|---|---|---|---|
| FE-01 | P1 | The contact form posts to a placeholder Formspree endpoint (`YOUR_FORM_ID`), so every submission fails. | `frontend/src/features/public/ContactPage.tsx:49` | Set a real form ID, or post to a backend `/contact` endpoint. |
| FE-02 | P1 | The landing-page testimonials (for example "Rohit Mehra, FastShip Logistics") look like placeholders presented as real customers. | `frontend/src/features/public/landing/sections/TestimonialsSection.tsx` | Replace them with real, consented quotes or remove the section before launch. |
| FE-03 | P1 | The legal pages still contain `[LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]`, `[YOUR GSTIN]` and `[GRIEVANCE OFFICER NAME]`. | `TermsPage.tsx`, `PrivacyPolicyPage.tsx` | Founder fills these in; an advocate reviews. Stripe live mode depends on it. |
| FE-04 | P2 | Support email addresses are inconsistent: `support@agentopsstudio.com` (error pages, legal) vs `support@agentops.studio` (Billing page) vs `EMAIL_FROM noreply@agentops.studio`. The Contact page shows a personal Gmail address. | Various | Pick one domain; use a shared constant. |
| FE-05 | P2 | There are two ways to set a phone number: manual Vapi UUID entry in Settings and the Vobiz picker in Activate. The Dashboard's "Get a phone number" step links to Settings. | `SettingsPage.tsx`; `DashboardPage.tsx` | Keep the picker; move it into Settings too; drop manual UUID entry (see SEC-06). |
| FE-06 | P2 | The voice catalog has no Vapi-native voices (the live agent uses Naina v2), and PATCH skips `buildVapiVoice` for the `vapi` provider. | `frontend/src/features/agents/voice-catalog.ts`; `agent.service.ts` | Add the Vapi provider voices and handle the provider on the backend. |
| FE-07 | P2 | Transcript search exists in the backend (`GET /calls/search`) but has no UI. | `call.routes.ts:63` | Add a search box to the Calls page. |
| FE-08 | P2 | Clutter: the footer's social links are `href="#"`, "Careers" links to /contact, `frontend/src/assets/files.zip` is committed, and the root contains untracked OpenAI usage CSV exports. | `PublicLayout.tsx:252-288`; repo root | Clean up. |
| FE-09 | P1 | Signup never records consent to the Terms or Privacy Policy: the Register page has no checkbox or links to `/terms` and `/privacy`, and the user record stores no acceptance. | `frontend/src/features/auth/RegisterPage.tsx`; `backend/src/modules/auth/auth.model.ts` | Required Zod `literal(true)` checkbox with links; store `termsAcceptedAt` and `termsVersion` on the user (backend-validated). Ships with FE-03. |
| FE-10 | P1 | No bot protection on Register or Contact beyond a honeypot (Contact) and IP rate limits (auth routes). Each signup gets free trial call minutes. | `RegisterPage.tsx`; `ContactPage.tsx`; `backend/src/app.ts` | Add Cloudflare Turnstile (free, cookieless) to both forms, verified server-side; consider a per-domain/email signup cap. |
| FE-11 | P1 | No web or product analytics: no GA, Plausible, PostHog or Vercel Analytics. Sentry only captures errors. | `frontend/index.html`; `frontend/package.json` | The visit → signup → verify → onboarding → first call funnel cannot be measured. Add a cookieless tool (Plausible or Vercel Web Analytics) and fire `signup`, `email_verified`, `onboarding_complete`, `first_call`. |
| FE-12 | P1 | The cookie banner says only essential cookies are used and nothing is tracked, but Sentry Session Replay records 5% of sessions (100% of error sessions). The Privacy Policy does not mention session replay. | `frontend/src/components/CookieConsent.tsx`; `frontend/src/lib/sentry.ts` | Either turn Replay off on public routes or gate it behind consent; disclose it in the Privacy Policy. Keep analytics cookieless (FE-11) so the banner stays essential-only. |
| FE-13 | P1 | The entry JS chunk is 659 KB (211 KB gzip) and loads before the landing page renders. About 1 MB of its source is Sentry (`@sentry/core`, `@sentry/replay`, browser utils). The Vapi SDK adds a 303 KB chunk. No Lighthouse or Web Vitals baseline exists. | Measured with `vite build` on 2026-10-01; `frontend/src/main.tsx` (eager `initSentry`); `vite.config.ts` `manualChunks` | Initialise Sentry after first render (dynamic import) and lazy-load the Replay integration; make sure `@vapi-ai/web` loads only on test-call pages; target mobile Lighthouse ≥ 90 and LCP < 2.5 s on `/`, `/pricing`, `/register`. |
| FE-14 | P2 | Every route shares the one title and description in `index.html`. Blog posts have no title, description or Open Graph tags of their own. | `frontend/index.html`; `frontend/src/features/public/*` | Use React 19 native `<title>` / `<meta>` in each public page and in each blog post (title, excerpt, cover image). Prerender public routes if social previews need per-page OG. |
| FE-15 | P2 | Canonical URLs are hard-coded to `agent-ops-studio-eight.vercel.app` in `og:url`, `og:image`, `robots.txt` and `sitemap.xml`. The sitemap is static: it lists `/login` and `/register`, has no blog posts and no `lastmod`. | `frontend/index.html`; `frontend/public/robots.txt`; `frontend/public/sitemap.xml` | After the custom domain (CORE-05), drive the site URL from one env var; generate the sitemap at build time or from the backend, including published blog posts; drop `/login`. |
| FE-16 | P2 | About 16 text usages fail WCAG AA contrast on the `#171717` background: `#737373`, `#525252`, `text-slate-500`, `text-slate-600` (≈ 3.8:1 or lower). The landing tokens were already fixed (`text3` `#8a8a8a`). | `grep` for those values in `frontend/src` | Replace with `#a3a3a3` / `#8a8a8a` (≥ 4.5:1), or move them into a shared token. |
| FE-17 | P2 ⚠️ Verify | Inline-style pages use fixed grids that will squash on phones: `repeat(4, 1fr)` on Dashboard (`DashboardPage.tsx:669`), `repeat(3, 1fr)` on Billing (`BillingPage.tsx:761`) and six super-admin pages. The layouts' mobile drawers are fine; pages were never tested at 375 px. | `frontend/src/features/**` | Use `repeat(auto-fit, minmax(160px, 1fr))`; run a 375 px pass on Dashboard, Calls, Billing, Onboarding, Pricing and Register. |
| FE-18 | P2 | Smaller launch polish: no PNG favicon link or `site.webmanifest` (PNGs exist in `assets/logos`); no Content-Security-Policy in `vercel.json`; unknown URLs return HTTP 200 with the 404 page (soft 404); blog cover images use `alt=""`. | `frontend/index.html`; `frontend/vercel.json`; `BlogPage.tsx:139` | Link the PNG favicons and add a manifest; add a CSP (allow Vapi, Sentry, Google Fonts, the API); add `noindex` on the 404 page; use the post title as alt text. |

## 8. Tests, CI and ops

| ID | Pri | Gap | Evidence | Fix |
|---|---|---|---|---|
| OPS-01 | P1 | `deploy-backend.yml` deploys to **AWS ECS**, but production runs on Render (auto-deploy from `render.yaml`). | `.github/workflows/deploy-backend.yml` | It fails on every push to `main` that touches `backend/`. Delete it, or replace it with a Render deploy hook. |
| OPS-02 | P1 ⚠️ Verify | The CI e2e job runs `npx playwright test` at the repo root, which has no `package.json`, and `@playwright/test` is not in `frontend/package.json`. | `.github/workflows/ci.yml`; `playwright.config.ts` | The e2e job most likely fails. Add a root or e2e `package.json` with Playwright. |
| OPS-03 | P1 | Test coverage gaps. Backend has none for webhooks, orders, catalog, agents, super-admin, crawler, prompt, business hours, trialGate or workers; the rateLimiter test checks a copy of the app, not `app.ts`. Frontend tests cover only the guards, two slices and `cn`, and coverage excludes `src/features/**`. | `backend/src/__tests__/`; `frontend/src/__tests__/`; `frontend/vitest.config.ts` | Prioritise webhook, orders and minutes-gate tests (they would have caught CORE-01, SEC-01 and BIZ-01). |
| OPS-04 | P2 | Infrastructure runs on free tiers: Render free (cold starts plus a keep-alive self-ping) and Redis free (30 connections, which forced CORE-02). | `render.yaml`; `backend/src/index.ts` | Move to paid Render and Redis before the first paying customer. |
| OPS-05 | P2 | `render.yaml` sets `CLIENT_URL` to `agentops-studio.vercel.app`, but the real frontend is `agent-ops-studio-eight.vercel.app`. It still lists `ELEVENLABS_API_KEY` and the Exotel keys, which are unused. | `render.yaml` | Update it (CORS depends on `CLIENT_URL`). |
| OPS-06 | P2 | Vapi-hosted evals are stuck at `queued` (0/23). The local Gemini-judged run passes 21/23: `price-04` (digits read aloud) fails, and `order-04` (read-back before submit) is flaky, failing 3 of 5 runs. | `scripts/vapi-evals/` | Fix the prompt for those two cases; run the evals in CI nightly. |
| OPS-07 | P2 | Analytics (overview, calls per day, stats by day) bucket by UTC days, not the org's timezone. | analytics and calls services | For IST orgs, days shift by 5.5 hours. Use `$dateTrunc` with the org's timezone. |
| OPS-08 | P2 | Crawler and KB debt: re-sync overwrites user-edited org fields; the 30-day re-crawl cooldown is documented but not enforced; `KbCategory.documentCount` is never updated; the crawl rate limit is mounted on a route that does not exist (`/onboarding/website/crawl`); crawl jobs use a fixed `jobId`, so re-crawls are deduplicated against retained completed jobs; FAQs appear twice in the prompt. | `crawler.service.ts`; `app.ts`; `onboarding.service.ts`; `prompt.utils.ts` | Fix these when re-enabling the crawl worker (CORE-02). |
| OPS-09 | P2 | Smaller correctness issues: `createOrg` is not transactional; catalog `PATCH` does an unvalidated `$set` and its routes have no role check; catalog edits do not re-sync the Vapi prompt; the order status `PATCH` is not enum-validated. | catalog, orders and onboarding services | Validate with Zod; call `syncAgent` after catalog CRUD. |

## 9. Documentation

| ID | Pri | Gap | Fix |
|---|---|---|---|
| DOC-01 | P2 | The TAD, PRD, Security doc, Feature-Ticket-List, MVP Roadmap and Project Timeline still describe the original plan: AWS ECS, ElevenLabs TTS, a `/navigation` API, church-network personas, Owner/Admin/Member roles and a 35-day timeline. None of it matches what was built. Not rewritten in this pass (founder chose CLAUDE.md, TASK-BOARD and gaps only). | Next docs pass: add an as-built section to each, or write one `CURRENT-STATE.md`. |
| DOC-02 | P2 | `main-project-docs/ADRs/` does not exist, although ADR-001 is referenced. The RFC index is empty, and RD-DIGEST has never been generated. | Create ADR-001 (Atlas Vector Search, which is not actually used: the KB is synced to Vapi), ADR-002 (Render + Vercel), ADR-003 (worker consolidation). |
| DOC-03 | P2 | The POC Integration Plan and the Pricing & Stripe doc have no "status" markers showing what shipped. | Add a status column when those docs are next touched. |

---

## 10. Status of the v1 launch-blocker list

| v1 item | Status on 2026-09-29 |
|---|---|
| Vobiz number provisioning in Activate | ✅ Built: `telephony` module, `PhoneNumberPicker` (claim from the Vobiz pool, import into Vapi). Needs a production run-through. |
| Verify the Activate test call | 🟡 Built (`@vapi-ai/web` TestCallWidget); needs a manual end-to-end check (and see CORE-05). |
| Stripe INR prices, customer portal activation | ❓ Founder action: not verifiable from code. `.env.bak` lacks `STRIPE_PRO_PRICE_ID_INR`. |
| Legal page placeholders | ❌ Still present (FE-03). |
| Mobile sidebar check | 🟡 The drawers work in all three layouts; page-level fixed grids remain (FE-17). Test on a real phone. |
| Onboard 5 beta SMBs, Punjabi detection check | ⏳ Not started (no evidence in the repo). |
| Sentry DSN in production | ❓ Founder action. |
| CI/CD pipeline | 🟡 `ci.yml` exists; the deploy workflow targets the wrong platform (OPS-01), and e2e is likely broken (OPS-02). |
| Transcript full-text search | 🟡 Backend done; no UI (FE-07). |

---

## 11. AI implementation offer — GTM, integrations and proof of results

Source: `AI-Implementation-Offer-Plan.md` (2026-09-30). These gaps come from comparing the product with the "sell the problem handled" model: one niche, one expensive bottleneck, n8n connecting the client's CRM, calendar and follow-up tools, and a repeatable delivery SOP. **Scheduled after S-HARDEN** (see `TASK-BOARD.md` → Upcoming sprints).

| ID | Pri | Gap | Evidence | Impact | Fix |
|---|---|---|---|---|---|
| GTM-01 | P1 | No single beachhead niche. The site markets logistics, real estate and healthcare; only electrical retail works end to end. | `frontend/src/features/public/IndustriesPage.tsx`; IND-01…05 | Diluted positioning; each extra vertical multiplies template, eval and support work. | Score candidates (plan § 7.1), pick one, align Industries/landing copy. Founder decision D2. |
| INT-01 | P1 | No outgoing event webhooks. Call outcomes cannot reach a client's CRM, Sheets or calendar. | No `integrations` module; BIZ-07 advertises CRM/n8n | The core "connect the client's systems" promise cannot be delivered. | Per-org signed (HMAC) webhooks for `call.completed`, `lead.captured`, `followup.required`, `order.created`, `appointment.requested`; retry queue; delivery log; test button (plan § 7.2). Depends on CORE-01, CORE-02, SEC-07 pattern. |
| INT-02 | P1 | No n8n templates for CRM / Google Sheets / calendar. | — | Each client integration is built from scratch; not repeatable. | 3 importable workflows + setup guide in `integrations/n8n/` (plan § 7.3). Depends on INT-01. |
| INT-03 | P1 | No appointment-booking tool (extends IND-02). | `backend/src/modules/orders/*` is retail-only | "Unbooked appointments" cannot be solved for clinics/services. | `book_appointment` Vapi tool → secured tool route → `appointment.requested` event → calendar via n8n (plan § 7.4). Needed only if the chosen niche books appointments. |
| INT-04 | P1 | Follow-up reaches only the owner's inbox, and that worker is off. | `backend/src/jobs/followUpAlert.worker.ts`; CORE-01, CORE-02 | Leads that need a call-back are lost. | Re-enable worker, escape content (SEC-09), emit `followup.required` so clients route it to WhatsApp/CRM via n8n; native WhatsApp only on client demand (plan § 7.5). |
| ROI-01 | P1 | No outcome metrics or monthly report. Analytics shows volume and resolution rate only. | `backend/src/modules/analytics/analytics.service.ts` | Cannot prove the "measurable outcome" that closes and retains clients. | Monthly per-org metrics (answered, after-hours, leads, bookings/orders, follow-ups, est. ₹ value) as a Dashboard card + monthly email (plan § 7.6). Depends on CORE-01. |
| OFR-01 | P2 | Managed offer not productised: setup fees are not billable; no managed-service tier. | Pricing doc (setup fees); BIZ-05 | Setup revenue and service scope are ad hoc. | Stripe setup-fee line item with BIZ-05; define managed tier (founder decision D3). |
| OFR-02 | P2 | No client delivery SOP (`agents/SOP.md` is the internal agent SOP). | `agents/SOP.md` | Delivery depends on the founder's memory; not repeatable or delegable. | Write `Client-Delivery-SOP.md` (plan § 7.7). |
| GTM-02 | P2 | No niche demo agent or public demo number. | `scripts/vapi-evals` (electrical only) | Harder to run the "simple demo" step. | Demo org on the chosen template with a public number. Depends on GTM-01. |
| GTM-03 | P2 | No niche-specific 30-day acquisition plan. | `agents/growth-agent.md` (generic ICP) | Outreach is untargeted. | Prospect list, problem-first outreach, discovery questions (plan § 7.8). Depends on GTM-01. |

---

## 12. Launch-readiness checklist (audit of 2026-10-01)

A 20-item pre-launch checklist for AI-built ("vibe-coded") apps, checked against the code. ✅ covered · 🟡 partial · ❌ missing.

| # | Item | Status | Gap IDs |
|---|---|---|---|
| 1 | Privacy policy | 🟡 Page exists (DPDPA sections); placeholders remain | FE-03, FE-12 |
| 2 | Terms & conditions | 🟡 Page exists; placeholders; no consent at signup | FE-03, FE-09 |
| 3 | Remove frontend secrets | 🟡 Only `VITE_API_URL`, `VITE_SENTRY_DSN`, `VITE_APP_VERSION` (safe); public source maps; committed super-admin password | SEC-13, SEC-02 |
| 4 | Enforce HTTPS | ✅ Vercel + Render force HTTPS; helmet sends HSTS. CSP missing on the frontend | FE-18 |
| 5 | Cookie consent banner | 🟡 Present on public pages; copy contradicts Sentry Replay | FE-12 |
| 6 | Meta titles/descriptions | 🟡 One global title/description only | FE-14 |
| 7 | Social preview image | ✅ 1200×630 OG + Twitter card; domain hard-coded | FE-15 |
| 8 | Favicon | ✅ SVG + apple-touch; no PNG fallback / manifest | FE-18 |
| 9 | Sitemap and robots.txt | ✅ Both present; sitemap static, no blog posts | FE-15 |
| 10 | Image alt text | ✅ All 9 `<img>` have alt; blog cover `alt=""` | FE-18 |
| 11 | Image compression | ✅ All images < 45 KB; stray `files.zip` | FE-08 |
| 12 | Page load speed | ❌ 211 KB gzip entry chunk; no Lighthouse baseline | FE-13 |
| 13 | Color contrast | 🟡 ~16 failing text usages | FE-16 |
| 14 | Mobile responsiveness | 🟡 Layout drawers OK; fixed page grids | FE-17 |
| 15 | Custom 404 page | ✅ `NotFoundPage` + `RouteErrorPage`; soft 404 status | FE-18 |
| 16 | Broken link fixes | 🟡 All internal routes resolve; footer social `#`; contact form placeholder | FE-08, FE-01 |
| 17 | Form validation | ✅ RHF + Zod on 11 forms; backend Zod | — |
| 18 | Spam protection | 🟡 Honeypot + rate limits; no CAPTCHA | FE-10 |
| 19 | Analytics setup | ❌ None | FE-11 |
| 20 | Single clear CTA | ✅ "Start Free Trial" → `/register` (demo as secondary) | — |

Planned as **S-HARDEN Wave 5** (`TASK-BOARD.md`). Mostly frontend; runs in parallel with Waves 1–2.

## 13. Agent operating system (PROPOSED — founder decision D6)

From the 2026-10-01 review of the "The Agency" quick-start guide (specialist agents, installed per tool, 3–5 at a time, chained with a review step). The operating framework in `CLAUDE.md` is unchanged until D6 is decided.

| ID | Pri | Gap | Evidence | Fix |
|---|---|---|---|---|
| PROC-01 | P2 | The agent personas are plain Markdown prompts with no frontmatter, and `.claude/agents/` is empty, so Claude Code cannot load them as subagents. The `Agent("agents/x.md", …)` dispatch in `CLAUDE.md` is not how the Agent tool selects agents. | `agents/*.md`; `.claude/agents/`; `CLAUDE.md` § Parallel Dispatch Protocol | Convert the 5 implementation agents to `.claude/agents/<name>.md` with `name`, `description`, `tools` frontmatter, keeping their prompts. |
| PROC-02 | P2 | Dispatching 11 workers on every message (zero-idle rule) adds cost and filler, and there is no dedicated security or code-review specialist even though most P0s are security fixes. | `CLAUDE.md` § Prime Directive; `agents/PARALLEL-MATRIX.md` | Add 3–4 specialists from `msitarzewski/agency-agents` (AppSec engineer, code reviewer, backend architect, reality checker; confirm names with `install.sh --dry-run`). Replace "all agents every turn" with chains per task type, e.g. security fix: AppSec → Engineering → Code Reviewer. Run R&D workers on request or weekly. |
