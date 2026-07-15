# AgentOps Studio — Website & Navigation Architecture

**Version**: 1.0  
**Date**: 2026-07-03  
**Author**: CEO Agent (Product + UX + Solution Architecture layer)  
**Status**: Approved for implementation

---

## Table of Contents

1. [Public Website Sitemap](#1-public-website-sitemap)
2. [Authenticated Application Sitemap](#2-authenticated-application-sitemap)
3. [Navigation Hierarchy](#3-navigation-hierarchy)
4. [Route Protection Rules](#4-route-protection-rules)
5. [Redirect Flow Logic](#5-redirect-flow-logic)
6. [Page Descriptions](#6-page-descriptions)
7. [User Journey](#7-user-journey-guest--signup--login--dashboard)
8. [Best-Practice Recommendations](#8-best-practice-recommendations-b2b-saas)

---

## 1. Public Website Sitemap

```
agentops.studio/
├── /                           Home (Landing Page)
├── /services                   Services / Product Features
│   ├── /services/voice-agent       Voice AI Agent
│   ├── /services/knowledge-base    Knowledge Base & Training
│   ├── /services/analytics         Call Analytics & Reporting
│   └── /services/integrations      Integrations & APIs
├── /industries                 Industries
│   ├── /industries/logistics        Logistics & Delivery
│   ├── /industries/real-estate      Real Estate
│   ├── /industries/healthcare       Healthcare & Clinics
│   ├── /industries/finance          Finance & BFSI
│   ├── /industries/education        Education & EdTech
│   ├── /industries/retail           Retail & D2C
│   └── /industries/hospitality      Hospitality & Food
├── /why-us                     Why AgentOps Studio
├── /pricing                    Pricing
├── /blog                       Blog Hub
│   ├── /blog/[slug]                Individual post
│   └── /blog/category/[cat]        Category archive
├── /contact                    Contact Us
├── /login                      Login
├── /signup                     Sign Up
├── /privacy                    Privacy Policy          (footer only)
├── /terms                      Terms of Service        (footer only)
└── /sitemap.xml                XML Sitemap (auto-generated)
```

---

## 2. Authenticated Application Sitemap

All routes are under the same domain, separated by auth guard — no subdomain split required at MVP. A future `app.agentops.studio` subdomain is recommended at scale.

```
/dashboard                      Main dashboard (default landing after login)
/calls                          Call logs & live monitoring
│   └── /calls/[id]                 Single call detail + transcript
/knowledge-base                 KB management
│   ├── /knowledge-base/website         Website crawl status & re-crawl
│   ├── /knowledge-base/manual          Manual articles & FAQ editor
│   └── /knowledge-base/faqs            FAQ manager (synced from onboarding)
/analytics                      Analytics & reporting
│   ├── /analytics/overview             KPIs, MRR, call volume
│   ├── /analytics/calls                Call quality metrics
│   └── /analytics/conversations        Conversation insights
/agent                          Voice agent configuration
│   ├── /agent/profile                  Agent name, persona, language
│   ├── /agent/voice                    Voice model, speed, pitch
│   └── /agent/prompts                  System prompt editor
/settings                       Organization settings
│   ├── /settings/general               Org name, timezone, industry
│   ├── /settings/team                  Team members & roles
│   ├── /settings/billing               Subscription, invoices
│   ├── /settings/integrations          Exotel, Vapi, Deepgram, ElevenLabs
│   └── /settings/security              2FA, session management
/onboarding                     Onboarding wizard (guarded: COMPLETED blocks entry)
│   ├── /onboarding/connect
│   ├── /onboarding/learn
│   ├── /onboarding/configure
│   ├── /onboarding/customize
│   └── /onboarding/activate
```

---

## 3. Navigation Hierarchy

### 3.1 — Public Header Navigation

```
LOGO (agentops.studio/)         [Left-anchored]

Primary nav links:
  Services ▾                    Mega-dropdown (4 sub-services)
  Industries ▾                  Mega-dropdown (7 industry pages)
  Why Us
  Pricing
  Blog

Right-side CTAs:
  [Log In]                      Ghost / text button
  [Start Free Trial]            Brand primary button (high contrast)
```

**Sticky behavior**: Header sticks on scroll with a subtle shadow + mild blur backdrop.  
**Active state**: Current page link underlined or dot-accented.  
**Dropdown trigger**: Hover on desktop, tap on mobile.

---

### 3.2 — Public Footer Navigation

```
Column 1 — Brand
  Logo + tagline
  "AI-powered voice agents for Indian SMBs"
  Social icons (LinkedIn, Twitter/X, YouTube)

Column 2 — Product
  Services
  Pricing
  Industries
  Changelog (future)
  Status Page (future)

Column 3 — Company
  Why Us
  Blog
  Contact
  Careers (future)
  Press (future)

Column 4 — Legal
  Privacy Policy
  Terms of Service
  Cookie Policy (future)
  GDPR (future)

Bottom bar:
  © 2026 AgentOps Studio. All rights reserved.   |   Made in India 🇮🇳
```

---

### 3.3 — Mobile Navigation

**Pattern**: Slide-in drawer (right-to-left) triggered by hamburger icon.

```
[✕ Close]

  Home
  Services  [Expand accordion ▸]
    ↳ Voice Agent
    ↳ Knowledge Base
    ↳ Analytics
    ↳ Integrations
  Industries  [Expand accordion ▸]
    ↳ (7 industry pages)
  Why Us
  Pricing
  Blog
  Contact

  ─────────────────
  [Log In]
  [Start Free Trial]   (full-width, brand color)
```

---

### 3.4 — Authenticated App Navigation

```
Sidebar (collapsible on desktop, drawer on mobile):

  [Logo + "AgentOps Studio"]
  [Org switcher — "Acme Corp ▾"]    ← future multi-org
  ─────────────────────────────
  📊  Dashboard
  📞  Calls
  📚  Knowledge Base
  📈  Analytics
  🤖  Agent
  ─────────────────────────────
  ⚙️   Settings

Top bar (right side):
  [🔔 Notifications]   [? Help]   [User avatar ▾]
    └── My Profile
    └── Organization Settings
    └── Billing
    └── Log Out
```

---

### 3.5 — CTA Placement Strategy

| Page Section | Primary CTA | Secondary CTA |
|---|---|---|
| Header (sticky) | Start Free Trial | Log In |
| Hero section | Start Free Trial | Book a Demo |
| Feature sections | Start Free Trial | Learn More |
| Pricing page | Start Free Trial (per tier) | Contact Sales (Enterprise) |
| Blog sidebar | Subscribe to Newsletter | — |
| Blog post footer | Start Free Trial | See all posts |
| Contact page | Send Message | Book a Demo |
| Footer | Start Free Trial | — |

---

### 3.6 — Breadcrumb Strategy

Breadcrumbs are used **only** on:
- Industry sub-pages: `Home > Industries > Logistics & Delivery`
- Blog posts: `Home > Blog > Category > Post Title`
- Service sub-pages: `Home > Services > Voice Agent`

Not used on: Home, Pricing, Why Us, Contact, Login, Signup — these are top-level destinations.

---

## 4. Route Protection Rules

### 4.1 — Route Classification

| Route Pattern | Type | Auth Required | Onboarding Required |
|---|---|---|---|
| `/` | Public | No | No |
| `/services*` | Public | No | No |
| `/industries*` | Public | No | No |
| `/why-us` | Public | No | No |
| `/pricing` | Public | No | No |
| `/blog*` | Public | No | No |
| `/contact` | Public | No | No |
| `/privacy` | Public | No | No |
| `/terms` | Public | No | No |
| `/login` | Auth gate | No (redirect if logged in) | No |
| `/signup` | Auth gate | No (redirect if logged in) | No |
| `/onboarding*` | Protected | **Yes** | Must NOT be COMPLETED |
| `/dashboard*` | Protected | **Yes** | Must be COMPLETED |
| `/calls*` | Protected | **Yes** | Must be COMPLETED |
| `/knowledge-base*` | Protected | **Yes** | Must be COMPLETED |
| `/analytics*` | Protected | **Yes** | Must be COMPLETED |
| `/agent*` | Protected | **Yes** | Must be COMPLETED |
| `/settings*` | Protected | **Yes** | Must be COMPLETED |

---

### 4.2 — Guard Logic (pseudocode)

```
AuthGuard (wraps all /onboarding and /dashboard+ routes):
  IF session is loading  → show <LoadingSpinner />
  IF !isAuthenticated    → redirect to /login?next=<current_path>
  ELSE                   → render <Outlet />

OnboardingGuard (wraps /onboarding/* only):
  IF onboardingStatus === 'COMPLETED'  → redirect to /dashboard
  ELSE                                 → render <OnboardingLayout />

AppGuard (wraps /dashboard, /calls, etc.):
  IF onboardingStatus !== 'COMPLETED'  → redirect to /onboarding
  ELSE                                 → render <AppLayout />

LoginGuard (wraps /login and /signup):
  IF isAuthenticated AND onboardingStatus === 'COMPLETED'  → redirect to /dashboard
  IF isAuthenticated AND onboardingStatus !== 'COMPLETED'  → redirect to /onboarding
  ELSE                                                      → render page
```

---

## 5. Redirect Flow Logic

### 5.1 — All Routing Scenarios

| Trigger | User State | Destination | Reason |
|---|---|---|---|
| Opens `agentops.studio/` | Not logged in | `/` (Landing) | Public homepage |
| Opens `agentops.studio/` | Logged in + onboarding done | `/dashboard` | Auto-redirect to app |
| Opens `agentops.studio/` | Logged in + onboarding pending | `/onboarding` | Resume wizard |
| Clicks logo | Not logged in | `/` | Logo = home |
| Clicks logo | Logged in | `/dashboard` | Logo = app home |
| Clicks `/login` | Not logged in | `/login` | Show login form |
| Clicks `/login` | Logged in + complete | `/dashboard` | Already in |
| Clicks `/login` | Logged in + pending | `/onboarding` | Resume wizard |
| Clicks `/signup` | Not logged in | `/signup` | Show signup form |
| Clicks `/signup` | Logged in | `/dashboard` | Already registered |
| Navigates to `/dashboard` | Not logged in | `/login?next=/dashboard` | Auth required |
| Navigates to `/dashboard` | Logged in + pending | `/onboarding` | Must complete first |
| Navigates to `/onboarding` | Not logged in | `/login?next=/onboarding` | Auth required |
| Navigates to `/onboarding` | Logged in + complete | `/dashboard` | Already done |
| Clicks Log Out | Any | `/` or `/login` | Session cleared |
| Hits 404 (public) | Any | Custom 404 page + CTA | Keep user engaged |
| Hits 404 (app) | Logged in | App 404 page + back button | Stay in app |

---

### 5.2 — Post-Login Redirect (`?next=` param)

When an unauthenticated user tries to access a protected URL, the current path is appended as a `next` query parameter:

```
/login?next=/dashboard/calls/abc123
```

After successful authentication, the app reads `next` and redirects there — rather than defaulting to `/dashboard`. This preserves deep links from emails, Slack messages, or shared URLs.

**Security rule**: `next` must be a relative path starting with `/`. Absolute URLs or external domains must be rejected to prevent open-redirect attacks.

---

### 5.3 — Session Expiry Mid-App

When a session cookie expires while the user is actively using the app:
1. The next API call returns `401 Unauthorized`
2. The API interceptor catches it and dispatches `clearCredentials()` to Redux
3. `AuthGuard` re-evaluates → `isAuthenticated = false` → redirect to `/login?next=<current_path>`
4. After login, user is returned to where they were

---

## 6. Page Descriptions

### 6.1 — Home (Landing Page)

**URL**: `/`  
**Purpose**: Convert cold visitors into trial signups or demo bookings.  
**Target audience**: Business owners, operations managers, founders of Indian SMBs.  
**Primary CTA**: Start Free Trial → `/signup`  
**Secondary CTA**: Book a Demo → `/contact?intent=demo`

**Key sections** (top to bottom):
1. **Nav header** — sticky, logo + nav + CTA
2. **Hero** — Bold headline ("Your AI receptionist, always on call"), sub-headline (1 line value prop), 2 CTAs, hero image/animation of a voice wave or call UI
3. **Social proof bar** — "Trusted by 200+ Indian SMBs" + 4–5 company logos
4. **Problem statement** — "Missed calls = missed revenue" pain points in 3 tiles
5. **How it works** — 3-step visual: Connect → Configure → Go Live (30 min setup)
6. **Feature highlights** — 4 cards: Voice AI, Hindi/English auto-detect, Knowledge Base, Call Analytics
7. **Industry carousel** — 7 industry icons as clickable cards
8. **Testimonials** — 2–3 customer quotes with headshots and company names
9. **Pricing teaser** — "Plans starting ₹2,999/mo" + [See pricing]
10. **Final CTA banner** — Full-width brand-color section: "Set up your AI agent in 30 minutes"
11. **Footer**

**SEO considerations**: Target keywords: "AI voice agent India", "automated phone receptionist SMB", "voice bot India". H1 on hero. OG image with product screenshot. Structured data: SoftwareApplication schema.

---

### 6.2 — Services

**URL**: `/services`  
**Purpose**: Deep-dive on product capabilities; convert feature-curious visitors.  
**Target audience**: Technical evaluators, product decision-makers.  
**Primary CTA**: Start Free Trial  
**Secondary CTA**: See Pricing

**Key sections**:
1. Hero — "Everything your AI agent needs to handle calls perfectly"
2. Feature grid — 4 service cards linking to sub-pages
3. Sub-pages (each follows same structure):
   - **Voice Agent** (`/services/voice-agent`) — Vapi, Deepgram STT, ElevenLabs TTS, GPT-4o, latency specs
   - **Knowledge Base** (`/services/knowledge-base`) — website crawl, manual articles, FAQ editor
   - **Call Analytics** (`/services/analytics`) — call volume, completion rate, fallback rate, transcripts
   - **Integrations** (`/services/integrations`) — Exotel SIP, Vapi, REST webhooks, future CRM connectors

**SEO**: Each sub-page targets a specific long-tail keyword. Internal links between sub-pages.

---

### 6.3 — Industries

**URL**: `/industries`  
**Purpose**: Show relevant use cases; reduce "is this for me?" friction.  
**Target audience**: Visitors evaluating fit for their specific business type.  
**Primary CTA**: Start Free Trial  
**Secondary CTA**: Book a Demo

**Key sections**:
1. Hero — "Built for the way Indian businesses actually work"
2. Industry grid — 7 cards with icon, industry name, 1-line use case teaser
3. Each industry sub-page:
   - Use case narrative (pain → solution → outcome)
   - 3 key features relevant to this industry
   - A testimonial or mini case study (placeholder until real customer)
   - Industry-specific FAQ (3–5 questions)
   - CTA: "See how [industry] businesses use AgentOps"

**SEO**: `/industries/logistics` targets "AI voice agent for delivery companies India"; each page targets its own industry + "India" + "voice bot" cluster.

---

### 6.4 — Why Us

**URL**: `/why-us`  
**Purpose**: Handle objections; convert comparison-shoppers and skeptics.  
**Target audience**: Decision-makers who are evaluating alternatives.  
**Primary CTA**: Start Free Trial  
**Secondary CTA**: Read Case Studies

**Key sections**:
1. Hero — "Why 200+ SMBs chose AgentOps over building their own"
2. **Differentiator pillars** (3–4 cards):
   - India-first (Hindi/Punjabi auto-detect, ₹-based pricing, IST business hours)
   - 30-minute setup (vs months of custom dev)
   - Voice quality (ElevenLabs TTS, low-latency Vapi)
   - No-code operations (manage from dashboard, not terminal)
3. **Comparison table** — AgentOps vs DIY vs Generic chatbot vs Call center
4. **Founder story** (1–2 paragraphs with photo) — builds trust for SMB buyers
5. **Certifications / trust signals** — GDPR note, data residency, SOC2 roadmap

---

### 6.5 — Pricing

**URL**: `/pricing`  
**Purpose**: Remove pricing ambiguity; push trial or enterprise contact.  
**Target audience**: Budget decision-makers, finance approvers.  
**Primary CTA**: Start Free Trial (Starter/Growth), Contact Sales (Enterprise)  
**Secondary CTA**: Compare plans

**Key sections**:
1. Hero — "Simple pricing. No surprises."
2. **Billing toggle** — Monthly / Annual (annual shows 20% saving)
3. **Plan cards** (3 tiers):

| Plan | Price | Key limits | CTA |
|---|---|---|---|
| Starter | ₹2,999/mo | 1 agent, 500 mins/mo, English only | Start Free Trial |
| Growth | ₹7,999/mo | 3 agents, 2,000 mins/mo, 3 languages, analytics | Start Free Trial |
| Enterprise | Custom | Unlimited agents, SLA, dedicated support, custom integrations | Contact Sales |

4. **Feature comparison table** — full feature matrix across 3 tiers
5. **FAQ** — 6–8 pricing-specific questions (billing cycle, overages, cancellation, GST invoice)
6. **CTA strip** — "Not sure which plan? Talk to us." → /contact

**SEO**: Target "AI voice agent pricing India", "voice bot monthly subscription SMB".

---

### 6.6 — Blog

**URL**: `/blog`  
**Purpose**: SEO content hub; build authority; top-of-funnel lead gen.  
**Target audience**: Business owners researching AI adoption; Google searchers.  
**Primary CTA**: Subscribe to newsletter  
**Secondary CTA**: Start Free Trial (in sidebar and end of each post)

**Key sections** (hub page):
1. Hero — "Insights on AI, voice, and Indian business operations"
2. Featured post (full-width card)
3. Category filters — AI Voice, Operations, Product Updates, Customer Stories, Industry Guides
4. Post grid (3 columns on desktop)
5. Sidebar — newsletter subscribe, popular posts, CTA card

**Individual post** (`/blog/[slug]`):
1. Title, author, date, category, read time
2. Hero image
3. Body content
4. Author bio
5. Related posts (3)
6. CTA banner — "Try AgentOps free"
7. Social share buttons

**SEO**: Long-tail keyword content. Schema: Article, BreadcrumbList. Internal linking between posts and service/industry pages.

---

### 6.7 — Contact

**URL**: `/contact`  
**Purpose**: Capture enterprise leads, demo requests, and support queries.  
**Target audience**: Enterprise evaluators, partners, press, support seekers.  
**Primary CTA**: Submit form (Send Message)  
**Secondary CTA**: Book a 30-min demo (Calendly embed or link)

**Key sections**:
1. Hero — "Let's talk. We respond within one business day."
2. **Contact form** — Name, Company, Email, Phone, Intent dropdown (Demo / Pricing question / Technical support / Partnership / Other), Message textarea
3. **Alternative contact options** — Email (hello@agentops.studio), WhatsApp support (future), Support ticket link
4. **Office info** — City (e.g. Bangalore / Delhi), IST business hours
5. **Map embed** (optional at MVP)
6. **FAQ quick-answers** — 3 common questions handled inline to reduce support volume

**SEO**: Target branded queries. LocalBusiness schema if office address is listed.

---

### 6.8 — Login

**URL**: `/login`  
**Purpose**: Authenticate existing users; send them to the right app state.  
**Target audience**: Returning users.  
**Primary CTA**: Log In  
**Secondary CTA**: Sign up → `/signup`

**Key sections**:
1. Split-layout — form (left) + product value visual (right), or centered card
2. Email + password fields
3. "Forgot password?" link → `/forgot-password`
4. "Don't have an account? Sign up" link
5. Optional: Google OAuth button (future)
6. Legal note: "By logging in you agree to our Terms and Privacy Policy"

**Post-login redirect logic**: See Section 5.1 above. Respects `?next=` param.

---

### 6.9 — Sign Up

**URL**: `/signup`  
**Purpose**: Convert visitors into registered users beginning onboarding.  
**Target audience**: New leads who clicked any CTA.  
**Primary CTA**: Create Account → triggers email verification → `/onboarding`  
**Secondary CTA**: "Already have an account? Log In"

**Key sections**:
1. Minimal friction form — Name, Work Email, Password, (optional: phone)
2. Email verification step (post-submit) — "Check your inbox to verify"
3. Social proof inline — "Join 200+ businesses already on AgentOps"
4. Trust signals — "No credit card required", "Set up in 30 minutes", "Cancel anytime"
5. Legal: "By signing up you agree to Terms and Privacy Policy"

**SEO**: Noindex this page. Focus on conversion rate, not organic traffic.

---

## 7. User Journey: Guest → Signup → Login → Dashboard

```
[COLD VISITOR]
     │
     ▼
agentops.studio/          ← Organic search / paid ad / referral / direct
     │
     │ Explores: Home → Services → Industries → Pricing
     │
     ▼
CTA: "Start Free Trial" or "Book a Demo"
     │
     ├──────────────────────────────────┐
     │                                  │
     ▼                                  ▼
/signup                             /contact?intent=demo
(self-serve path)               (enterprise / assisted path)
     │                                  │
     │ Fills form                       │ Demo call booked
     │ Verifies email                   │ Sales follows up
     │                                  │
     ▼                                  ▼
/onboarding (Step 1: Connect)     /signup (post-demo)
     │
     │ Step 1: Create workspace (name, industry, timezone)
     │ Step 2: Learn  (website URL or skip)
     │ Step 3: Configure (agent name, services, FAQs, hours)
     │ Step 4: Customize (languages, fallback number)
     │ Step 5: Activate (review + Launch)
     │
     ▼
/dashboard                        ← onboardingStatus = 'COMPLETED'
     │
     │ Regular usage loop:
     │   ┌─ View call logs → /calls
     │   ├─ Monitor analytics → /analytics
     │   ├─ Edit knowledge base → /knowledge-base
     │   ├─ Tune voice agent → /agent
     │   └─ Manage team/billing → /settings
     │
     ▼
[RETAINED USER / EXPANSION]
     │
     └─ Upgrades plan → /settings/billing
     └─ Invites team members → /settings/team
     └─ Adds second org (future) → org switcher
```

### Journey touchpoints and drop-off risks

| Stage | Drop-off Risk | Mitigation |
|---|---|---|
| Landing → CTA click | High — value unclear | Sharp headline, social proof, "30 min setup" promise |
| CTA → Signup form | Medium — form friction | Minimal fields (3), no credit card |
| Signup → Email verify | High — async friction | "Resend" button, clear instructions, verify within 10 min |
| Email verify → Onboarding step 1 | Low — motivated user | Redirect immediately after verify |
| Onboarding step 3 (Configure) | Medium — longest step | All fields optional, Skip button prominent |
| Onboarding step 5 → Launch | Low — near finish line | Checklist view builds confidence |
| Launch → Habit | High — new product | Day-1 email, in-app guides, first-call celebration |

---

## 8. Best-Practice Recommendations (B2B SaaS)

### 8.1 — Information Architecture

- **Keep the website and app strictly separate.** Never put dashboard-like components on marketing pages. The cognitive mode shift (browsing → working) must be clean.
- **Maximum 2 levels of navigation depth** on the public site. Visitors should reach any page in ≤ 2 clicks from the header.
- **One primary CTA per page.** Secondary CTAs are always visually subordinate. Competing CTAs reduce conversion.

### 8.2 — Conversion Optimization

- **"Start Free Trial" over "Get Started".** "Free Trial" removes the risk signal. A/B test "Start Free" vs "Try for Free" vs "Book a Demo" on the hero.
- **No credit card required** — state it prominently below every primary CTA. This is the single biggest conversion lift for SMB SaaS.
- **Social proof at every decision point** — header bar stat, hero logo strip, testimonials section, pricing page reviews.
- **Benefit-first copy.** "Handle 3× more calls without hiring" is better than "AI-powered voice agent platform".
- **Video demo embed** on the homepage (under the fold). A 90-second product walkthrough can 2× trial signups.

### 8.3 — SEO Architecture

- **Programmatic landing pages** for each `[industry] + [city]` combo are a long-term SEO moat: e.g. `/industries/logistics/delhi`, `/industries/real-estate/bangalore`. Build the template now; populate later.
- **Blog as a pillar-cluster system.** Each service page is a "pillar". Blog posts link back to the nearest pillar. This concentrates PageRank.
- **Core Web Vitals must be green.** LCP < 2.5s, CLS < 0.1, FID < 100ms. Vite + React 19 + Vercel gives you this out of the box; optimize hero images with WebP/AVIF.
- **Structured data** on every page: `Organization`, `SoftwareApplication`, `FAQPage`, `BreadcrumbList`, `Article` (blog).

### 8.4 — Performance & Technical

- **Lazy-load all app routes.** Public pages should not ship any application JS. Code-split at the `AuthGuard` boundary.
- **Preload the dashboard chunk** after successful login so the first app paint is instant.
- **Prefetch sub-nav pages** on hover (React Router `<Link prefetch>` or manual `import()`). The Industries dropdown pages should be ready before the user clicks.
- **SSG or SSR for marketing pages** (Vite SSR or Next.js if split ever happens). This ensures fast TTFB and full SEO indexability. The React SPA app behind auth doesn't need SSR.

### 8.5 — Multi-Tenancy Readiness

- The org switcher in the app sidebar must be built for multi-org from day one, even if it only shows one org at MVP. The Redux shape (`availableOrgs`, `currentOrg`) already supports this.
- Route design should not bake org ID into the URL at MVP (avoids `/org/123/dashboard` complexity). Switch orgs in-state. When `org-scoped URLs` become necessary (shared links, team members with multi-org), introduce them as an additive change.
- Plan the future `app.agentops.studio` subdomain migration early. Use `window.location` abstraction in the router config so the domain can be switched without changing every redirect.

### 8.6 — Analytics & Instrumentation

Before launch, instrument:
- **Page views** on all public pages (Google Analytics 4 or PostHog)
- **CTA click events** on every button: `cta_clicked {page, cta_label, location_in_page}`
- **Signup funnel** step completion: `signup_started → email_verified → onboarding_started → onboarding_step_N_completed → activated`
- **Session replay** on signup and onboarding steps (PostHog or FullStory) — most valuable for finding friction
- **UTM tracking** end-to-end from landing → signup → activation

### 8.7 — Mobile-First

- 60%+ of Indian SMB decision-makers browse on mobile. The public website must be designed mobile-first, not as a responsive afterthought.
- Touch targets ≥ 44×44px. CTA buttons full-width on mobile.
- The app itself can be desktop-primary at MVP — operations dashboards are used on desktop. But the onboarding wizard must be fully functional on mobile.

---

## Appendix A — Route Table (Implementation Reference)

```
PUBLIC ROUTES (React Router, no auth guard):
  /                       → <HomePage />
  /services               → <ServicesPage />
  /services/:service      → <ServiceDetailPage />
  /industries             → <IndustriesPage />
  /industries/:industry   → <IndustryDetailPage />
  /why-us                 → <WhyUsPage />
  /pricing                → <PricingPage />
  /blog                   → <BlogHubPage />
  /blog/:slug             → <BlogPostPage />
  /blog/category/:cat     → <BlogCategoryPage />
  /contact                → <ContactPage />
  /privacy                → <PrivacyPage />
  /terms                  → <TermsPage />

AUTH GATE ROUTES (LoginGuard — redirect in if already authenticated):
  /login                  → <LoginPage />
  /signup                 → <SignupPage />
  /forgot-password        → <ForgotPasswordPage />
  /reset-password/:token  → <ResetPasswordPage />

ONBOARDING ROUTES (AuthGuard + OnboardingGuard):
  /onboarding             → redirect to /onboarding/connect
  /onboarding/connect     → <ConnectPage />
  /onboarding/learn       → <LearnPage />
  /onboarding/configure   → <ConfigurePage />
  /onboarding/customize   → <CustomizePage />
  /onboarding/activate    → <ActivatePage />

APP ROUTES (AuthGuard + AppGuard):
  /dashboard              → <DashboardPage />
  /calls                  → <CallsPage />
  /calls/:id              → <CallDetailPage />
  /knowledge-base         → <KnowledgeBasePage />
  /knowledge-base/*       → <KnowledgeBaseSubPage />
  /analytics              → <AnalyticsPage />
  /analytics/*            → <AnalyticsSubPage />
  /agent                  → <AgentPage />
  /agent/*                → <AgentSubPage />
  /settings               → <SettingsPage />
  /settings/*             → <SettingsSubPage />

CATCH-ALL:
  *                       → <NotFoundPage />  (public or app 404 depending on auth state)
```

---

*This document is the single source of truth for website and app navigation architecture. Any changes to routing, page structure, or guard logic must be reflected here before implementation.*
