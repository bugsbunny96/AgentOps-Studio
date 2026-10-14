# AgentOps Studio — Security Audit (2026-10-12)

> **Version history**
> - [2026-10-12 20:30] v1.0 — CEO Agent — Full audit against the founder's checklist (secrets, env, admin routes, auth, access control, input, rate limits, CORS, headers, debug, dependencies, exposed files, database, password hashing, git history). Code fixes on branch `harden/security-audit`. Gap IDs in `gaps.md` § 1.

## Result by checklist item

| # | Item | Result | Detail |
|---|---|---|---|
| 1 | Hide API keys | ✅ code / 🔴 founder | No secret in the frontend bundle (only `VITE_API_URL`, `VITE_SENTRY_DSN` — public by design, `VITE_APP_VERSION`). `.env` files are git-ignored. Redis password removed from a comment in local `backend/.env` — **still rotate it (SEC-03)**. |
| 2 | Environment variables | ✅ | Zod-validated at boot; production refuses the dev super-admin secret and a shared JWT/SA secret. Webhook and tool secrets fail closed in production. `render.yaml` sets `NODE_ENV=production`. |
| 3 | Protect admin routes | ✅ fixed | Every `/superadmin/*` route is behind `requireSuperAdmin`. **New:** the guard re-checks the account in the DB on each request (demoted or suspended admins lose access at once, not after 12 h). **New:** super-admin login limited to 5/15 min per IP and per email (SEC-10). |
| 4 | Proper authentication | ✅ fixed | bcrypt cost 12; access 15 min / refresh 7 days, rotated, stored in Redis; cookies `httpOnly`, `secure`, `sameSite=strict`; JWT verification pinned to HS256. **Fixed (SEC-11):** password reset no longer lifts a suspension; refresh refuses suspended users; change-password revokes other sessions; super-admin suspend/delete ends the session; email-verification tokens stored hashed. |
| 5 | Users only access what they should | ✅ | Every org router uses `authenticate` + `orgContext` (membership, role, per-section permissions). Only intended routes are public (auth, blog, changelog, founding spots, promo validate, enterprise link, branding) or secret-authenticated (Stripe, Vapi webhook/tools/orders). SEC-08 is closed: the access log now requires membership. |
| 6 | Sanitize forms / excess input | ✅ fixed | **New** NoSQL-injection guard strips `$` keys from body, query and params. Request bodies capped at 1 MB (10 MB only for Vapi reports, tools, KB, catalog, orders, super-admin). Oversized → 413, bad JSON → 400 (was 500). Email templates now HTML-escape names, org names, caller numbers and AI summaries (SEC-09). ⚠️ Many handlers still read `req.body` without a Zod schema (super-admin, billing, calls, promo, catalog, orders) — guarded by the above, but per-route schemas are the proper fix (SEC-16). |
| 7 | Rate limiting | ✅ | 100/15 min per IP on the API; 10/15 min per IP and per email on login/register/reset; 3/h crawl; 5/15 min super-admin login. Vapi routes exempt (secret-authenticated). Note: in-memory store — fine on one Render instance; move to Redis if you scale out. |
| 8 | Secure API endpoints / CORS | ✅ | CORS allows only `CLIENT_URL` with credentials and a fixed header list. Check `CLIENT_URL` on Render is the real Vercel URL (OPS-05). |
| 9 | Security headers | ✅ fixed | API: Helmet (CSP in production). Site (`vercel.json`): nosniff, `X-Frame-Options: DENY`, Referrer-Policy, HSTS (new), `X-XSS-Protection: 0` (modern guidance). **Fixed a bug:** `Permissions-Policy` blocked the microphone, which breaks browser test calls — now `microphone=(self)`. **New:** Content-Security-Policy in *report-only* mode; switch to enforcing after a week with no console violations (SEC-19). |
| 10 | Debug mode off | ✅ | Production errors return a generic message (no stack); logger at `info`; no `console.log` in backend source; source maps are `hidden` and not shipped. |
| 11 | Update dependencies | ✅ fixed | `npm audit`: backend 15 → 0 (1 critical `proxy-addr` IP spoofing, 6 high), frontend 13 → 0 (9 high incl. `axios`, `react-router`). No major-version jumps; only `vitest` 4.1.9 → 4.1.11 in `package.json`, the rest in lockfiles. Run `npm ci` in `backend/` and `frontend/` after pulling. |
| 12 | Remove what you don't need | 🟡 | Removed earlier today: `files.zip`, dead links. Not removed automatically (risk of breaking): unused dependencies — review with `npx depcheck` before deleting. |
| 13 | Exposed files | ✅ / 🔴 | Site serves only the built app, icons, `robots.txt`, `sitemap.xml`. **The GitHub repository is public** — full source, `gaps.md` (a list of known weaknesses), `TASK-BOARD.md` and the live Vapi assistant ID are readable by anyone (SEC-14). |
| 14 | Secure the database | 🟡 founder | Code: Mongoose with the `+srv` (TLS) URI, injection guard, no raw queries from input. Dashboard-only (cannot be checked from code): Atlas **Network Access** should not be `0.0.0.0/0` if Render egress IPs can be listed; the DB user should have `readWrite` on the app DB only; enable backups. |
| 15 | Hash passwords properly | ✅ | bcrypt, cost 12; reset tokens SHA-256 hashed, 1-hour expiry; verification tokens now hashed too. |
| 16 | Git history for leaked secrets | ✅ / 🟡 | Scanned every commit on every branch for Stripe, Resend, OpenAI, Redis, MongoDB, GitHub, Slack, private-key and generic secret patterns. Only placeholders (`xxxx`, `replace_me`), CI dummy values and a local docker-compose password. The super-admin password once committed was rotated on 2026-10-02 (SEC-02) — history purge optional, and moot once the repo is private. |

## Founder actions (cannot be done from code)

1. **Make the GitHub repository private** — Settings → General → Danger Zone → Change visibility (SEC-14). Highest priority.
2. **Rotate the Redis Cloud password** and update `REDIS_URL` on Render and in `backend/.env` (SEC-03).
3. **MongoDB Atlas:** restrict Network Access, least-privilege DB user, backups on.
4. After pulling: `npm ci` in `backend/` and `frontend/`, then `npm test` in `backend/` (the DB-backed tests could not run in the audit environment).
5. After one week: switch `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `frontend/vercel.json` if the browser console shows no violations (SEC-19).

## Verification

- Backend: `tsc` clean; 99 of 106 non-DB tests pass (the 7 failures need a live MongoDB: health check and middleware fixtures); new tests for the injection guard. The DB-backed suite (auth, billing, etc.) could not run here — MongoDB binary download is blocked in both test environments.
- Frontend: `tsc` clean, 40/40 tests, production build OK — with the upgraded dependencies, from a clean install.
- Not a penetration test: no live traffic was sent to production.
