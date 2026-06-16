# Security & Access Document - AgentOps Studio

## 1. Authentication Strategy

AgentOps Studio implements a token-based authentication protocol utilizing JSON Web Tokens (JWT) to secure user identity and authorize API sessions.

### Token Lifecycle & Architecture
*   **Access Token**: 
    *   *Type*: Short-lived JWT (15 minutes expiration).
    *   *Storage*: Dispatched to the client in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. The client application cannot read this cookie via JavaScript (preventing Cross-Site Scripting (XSS) extraction).
    *   *Payload*: `{ "userId": "...", "email": "..." }`
*   **Refresh Token**: 
    *   *Type*: Long-lived JWT (7 days expiration).
    *   *Storage*: Dispatched in a separate `/api/v1/auth/refresh-token` path-restricted `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
    *   *Verification*: Associated with a matching entry in the Redis database cache. If a user logs out, the refresh token is instantly blacklisted in Redis.
*   **Security Actions**:
    *   **Email Verification**: Upon registration, an account is set to `Pending` status. A cryptographically secure random token is emailed to the user. Clicking the link verifies the email and updates the status to `Active`.
    *   **Password Reset**: Generates a one-time token (expires in 1 hour) that is validated before updating the hashed credential database storage.
    *   **Password Hashing**: Done using `bcrypt` with a work factor of 12 rounds.

---

## 2. Authorization Model (RBAC)

Access permissions are enforced at the organization level. A user can belong to multiple organizations (tenants) with different roles. A unified permission matrix defines operations:

### Roles Definition
1.  **Owner**: The absolute creator of the workspace. Responsible for corporate identity, billing configuration, subscription tiers, and workspace deletion.
2.  **Admin**: The operation supervisor. Can configure agents, prompts, and team memberships, but cannot modify corporate billing or delete the tenant instance.
3.  **Member**: Read-only team participant. Allowed to review dashboards, view recordings/transcripts, and check logs. Cannot mutate configuration parameters.

### Permissions Matrix

| Feature Module | Endpoint / Action | Owner | Admin | Member |
| :--- | :--- | :---: | :---: | :---: |
| **Organization** | `DELETE /organizations/:id` | Yes | No | No |
| **Organization** | `PATCH /organizations/:id` | Yes | Yes | No |
| **Onboarding** | `POST /onboarding/*` | Yes | No | No |
| **Knowledge Base**| `GET /knowledge-base/*` | Yes | Yes | Yes |
| **Knowledge Base**| `POST/PATCH/DELETE /knowledge-base/*` | Yes | Yes | No |
| **Knowledge Base**| `POST /knowledge-base/re-sync` | Yes | Yes | No |
| **Billing** | `GET/POST /billing/*` | Yes | No | No |
| **Members** | `POST /members/invite` | Yes | Yes | No |
| **Members** | `DELETE /members/:id` | Yes | Yes | No |
| **Voice Agents** | `POST/PATCH/DELETE /agents` | Yes | Yes | No |
| **Voice Agents** | `GET /agents` | Yes | Yes | Yes |
| **Calls & Logs** | `GET /calls/*` | Yes | Yes | Yes |
| **Audit Logs** | `GET /audit/*` | Yes | Yes | No |

---

## 3. Tenant Isolation Architecture

To guarantee absolute tenant data isolation and prevent cross-organization leaks, AgentOps Studio enforces logical isolation at both the middleware and database layers.

### Multi-Tenant Middleware Scoping
Every HTTP request targeting organization resources must contain the tenant context.
1.  **Header Identification**: The frontend sends the target organization ID via the `X-Organization-ID` HTTP header.
2.  **Validation Middleware (`validateOrganization`)**:
    *   The backend retrieves the user's ID from the validated JWT cookie payload.
    *   The middleware queries the `memberships` collection to confirm if an active association exists between the `userId` and the `X-Organization-ID`.
    *   If no active membership matches, the middleware immediately rejects the call returning an `HTTP 403 Forbidden` response.
    *   If authorized, the organization context is appended to the Express request object (`req.orgId`).
3.  **Onboarding State Guardrail**:
    *   If the active organization has an `onboardingStatus` other than `COMPLETED`, the middleware blocks access to standard operational pages (e.g. Call Logs, Team Invitations, Analytics) with an `HTTP 403 Forbidden` response.
    *   Only endpoints under `/api/v1/onboarding/*` are accessible until onboarding is completed.

### Database Isolation Guardrail
To ensure developers never execute queries without tenant restrictions, the database layer wraps Mongoose models. Every query is programmatically appended with the `organizationId` filter.

```typescript
// Express Route Controller Example
export async function getTenantAgents(req: Request, res: Response) {
  // organizationId is injected strictly from the validateOrganization middleware
  const orgId = req.orgId; 
  
  // Query is restricted to the tenant workspace
  const agents = await VoiceAgentModel.find({ organizationId: orgId });
  
  return res.status(200).json(agents);
}
```

> [!WARNING]
> Developers must never bypass the `organizationId` filter. Direct queries on core modules without `organizationId` matching are caught by automated backend lint checkers.

---

## 4. Data Security

### Encryption at Rest
*   All persistent data in MongoDB Atlas is encrypted using the Advanced Encryption Standard (AES-256) at the storage engine level.
*   Database snapshots, backups, and replica logs are encrypted at rest using keys managed through MongoDB Atlas Key Management Service (KMS).

### Encryption in Transit
*   All incoming connections are forced to use secure HTTPS.
*   The API gateway rejects connections using protocols below **TLS 1.2**, favoring **TLS 1.3** cipher suites.
*   HTTP Strict Transport Security (HSTS) headers are configured to force browsers to interact via HTTPS only.

---

## 5. API Security & Web Security Headers

*   **Rate Limiting**: Configured using `express-rate-limit` backed by Redis:
    *   *Standard API Routes*: 100 requests per window of 15 minutes per IP.
    *   *Auth Routes (`/login`, `/register`)*: Strict limits of 10 requests per window of 15 minutes per IP.
    *   *Website Crawling / Sync (`/onboarding/website/crawl`, `/knowledge-base/re-sync`)*: Strict limits of 3 crawl requests per window of 60 minutes per IP/Organization to prevent crawling infrastructure abuse.
*   **Security Headers (Helmet)**: Injects security headers including:
    *   `Content-Security-Policy` (CSP) to mitigate cross-site scripting (XSS).
    *   `X-Frame-Options: DENY` to prevent clickjacking.
    *   `X-Content-Type-Options: nosniff` to block MIME-type sniffing.
*   **CORS (Cross-Origin Resource Sharing)**: Restricts incoming requests to a strict whitelist of verified client domain origins (configured via environment variables).
*   **Input Validation (Zod)**: All API payloads are parsed using Zod schemas before hitting route handlers, stripping unexpected properties and throwing clean HTTP 400 validation errors on payload schema mismatch.

---

## 6. Audit Logging Architecture

To ensure trace security auditing compliance, the system logs all database mutations and critical administrative events.

### Audit Log Schema Design
Each log document contains:
*   `organizationId`: Reference context.
*   `actorId`: User ID initiating the mutation.
*   `action`: String representing the mutation event.
*   `resource`: Affected database model.
*   `metadata`: Key-value map storing mutation snapshots (e.g., changes made to prompts, role upgrades).
*   `ipAddress`: Origin IP address of the actor.
*   `timestamp`: Immutable event creation date.

### Audit Event Trigger List
The system triggers audit logging for the following operations:
1.  `USER_LOGIN` / `USER_LOGOUT`
2.  `MEMBER_INVITE_SENT` / `MEMBER_INVITE_REVOKED` / `MEMBER_REMOVE`
3.  `ROLE_UPGRADE` (e.g., Member promoted to Admin)
4.  `AGENT_CREATE` / `AGENT_UPDATE` / `AGENT_DELETE`
5.  `PROMPT_VERSION_MUTATE` (capturing diffs of voice prompt updates)
6.  `SETTING_FALLBACK_ROUTE_UPDATE`
7.  `WEBSITE_CRAWL_TRIGGERED` (capturing crawled URL details)
8.  `KNOWLEDGE_BASE_DOCUMENT_MUTATED` (capturing Markdown changes)
9.  `ONBOARDING_COMPLETED` (signals organization activation)
