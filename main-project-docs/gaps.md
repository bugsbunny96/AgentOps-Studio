🔴 Week 1 — Launch Blockers (do nothing else)
Build Exotel phone number provisioning — Onboarding Step 5 (Activate) should let users pick an Indian DID or toll-free number. Wire Exotel API → Vapi phone number registration → store on org. This is the single most important feature for actual product-market fit.
Verify test call in Activate step — Manually test the onboarding Activate step end-to-end. If the WebRTC/web call isn't working, this is a 1-day fix with Vapi's web call SDK.
🟡 Week 2 — Pre-Launch Polish
Create INR prices in Stripe Dashboard → set STRIPE_STARTER_PRICE_ID_INR + STRIPE_GROWTH_PRICE_ID_INR in production .env
Stripe Dashboard → Customer portal → Activate portal (2 min, no code)
Fill 4 placeholders in legal pages before publishing: [LEGAL ENTITY NAME] + [REGISTERED ADDRESS] + [GSTIN] + set up legal email addresses → then submit to Stripe for live-mode review
Must activate portal in Stripe Dashboard before the "Manage subscription" button works in production
(1) Stripe Dashboard → Customer portal → Activate · (2) Create INR prices → paste IDs into production .env → restart backend
Mobile sidebar verification — Test on a real phone. Fix drawer open/close if broken.
🟠 Week 3 — Soft Launch with 5 Beta Customers
Onboard 5 real Indian SMBs manually — Watch them go through onboarding. Note every confusion. Fix the top 3 drop-off points.
Verify Punjabi language detection — Make a real call in Punjabi. Does it switch? Document what works.
Add VITE_SENTRY_DSN to production .env → redeploy → verify first error appears in Sentry
Write CI/CD pipeline — GitHub Actions: npm test + tsc --noEmit on PR, Docker build + push on main.
Transcript full-text search — Add MongoDB text index on TranscriptModel.fullText, wire to GET /api/v1/calls/search.