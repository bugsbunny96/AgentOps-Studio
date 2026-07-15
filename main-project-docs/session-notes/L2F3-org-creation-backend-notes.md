# L2.F3 — Org Creation Backend: Implementation Notes

> Prepared by CEO Agent | Session: 2026-06-26 | Status: Ready to implement  
> Active WBS Node: **L2.F3.M1.AT1**

---

## 1. Context

After a user completes registration + email verification and logs in, `useAuth.login()` navigates to `/onboarding` when `organizations[]` is empty. The first onboarding step (ConnectPage at `/onboarding/connect`) shows a form where the user enters their organization details. Submitting that form hits the endpoint this document specifies.

**This is the only step that creates the `Organization`, `Membership`, and `OnboardingSession` documents.**  
All subsequent onboarding steps (`Learn`, `Configure`, `Customize`, `Activate`) update the existing org and session.

---

## 2. Existing Model Inventory (all in `organization.model.ts`)

| Model | Key Fields | Notes |
|---|---|---|
| `OrganizationModel` | `name, slug (unique), ownerId, industry, timezone, hasWebsite, websiteUrl, onboardingStatus, businessHours, supportedLanguages` | `onboardingStatus` default: `'ORG_CREATION'` |
| `MembershipModel` | `userId, organizationId, role` | Unique index on `{userId, organizationId}` pair |
| `InvitationModel` | `email, organizationId, role, token, expiresAt` | TTL auto-delete; not needed yet |
| `OnboardingSessionModel` | `userId, organizationId?, currentStep, stepStatus, draftPayload, lastCompletedStep, resumeToken, expiresAt` | Created atomically with org |

`onboardingStatus` progression:
```
REGISTRATION → ORG_CREATION → WEBSITE_CRAWL → BUSINESS_CONFIG → VOICE_SETUP → COMPLETED
```
When an org is first created, it lands at `'ORG_CREATION'` (the schema default). This tells the OrgGuard "org exists but onboarding is incomplete → stay in /onboarding/*".

---

## 3. Endpoint Spec

### `POST /api/v1/onboarding/org`

**Middleware chain**: `authenticate → handler`  
(No `validateOrganization` — user has no org yet at this point.)

**Request body** (Zod-validated):
```typescript
const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  industry: z.string().min(1, 'Industry is required'),
  timezone: z.string().optional().default('Asia/Kolkata'),
  hasWebsite: z.boolean().optional().default(false),
  websiteUrl: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
});
type CreateOrgDto = z.infer<typeof CreateOrgSchema>;
```

**Success response** `201 Created`:
```json
{
  "success": true,
  "data": {
    "organization": {
      "_id": "...",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "industry": "Technology",
      "timezone": "Asia/Kolkata",
      "hasWebsite": true,
      "websiteUrl": "https://acme.com",
      "onboardingStatus": "ORG_CREATION",
      "createdAt": "...",
      "updatedAt": "..."
    },
    "membership": {
      "_id": "...",
      "role": "Owner",
      "organizationId": "..."
    },
    "session": {
      "_id": "...",
      "currentStep": "Learn",
      "stepStatus": "NotStarted",
      "resumeToken": "..."
    }
  }
}
```

**Error responses**:

| Code | HTTP | Condition |
|---|---|---|
| `UNAUTHORIZED` | 401 | No/invalid accessToken cookie |
| `VALIDATION_ERROR` | 400 | Zod schema violation |
| `ORG_LIMIT_REACHED` | 409 | User already owns an org created via onboarding (can create more via settings later) |
| `DUPLICATE_SLUG` | 409 | Slug collision after 5 counter attempts (extremely unlikely) |

---

## 4. Slug Generation Algorithm

```typescript
// onboarding.service.ts

/** Convert org name to a URL-safe slug base */
function toSlugBase(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')                   // decompose accented chars (e.g. é → e + ́)
    .replace(/[̀-ͯ]/g, '')     // strip combining diacritics
    .replace(/[^a-z0-9\s-]/g, '')       // remove everything except alnum, space, hyphen
    .replace(/\s+/g, '-')               // collapse whitespace → single hyphen
    .replace(/-+/g, '-')                // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');           // trim leading/trailing hyphens
}

/** Resolve a globally unique slug with counter suffix on collision */
async function generateUniqueSlug(name: string): Promise<string> {
  const base = toSlugBase(name) || 'org'; // fallback if name is all special chars
  let candidate = base;
  let counter = 1;

  // Max 20 attempts — after that, fail fast (shouldn't ever happen in practice)
  while (counter <= 20) {
    const exists = await OrganizationModel.exists({ slug: candidate });
    if (!exists) return candidate;
    candidate = `${base}-${counter}`;
    counter++;
  }

  throw new AppError(409, 'DUPLICATE_SLUG', 'Could not generate a unique slug. Please try a different name.');
}
```

**Examples**:
| Input | First candidate | Collision result |
|---|---|---|
| `"Acme Corp"` | `acme-corp` | `acme-corp-1` |
| `"   Spaces  "` | `spaces` | `spaces-1` |
| `"Rao & Sons"` | `rao-sons` | `rao-sons-1` |
| `"!!!!"` | `org` | `org-1` |
| `"Café Bistro"` | `cafe-bistro` | `cafe-bistro-1` |

---

## 5. Service Function

```typescript
// onboarding.service.ts

import crypto from 'crypto';
import { OrganizationModel, MembershipModel, OnboardingSessionModel } from '@/modules/organization/organization.model';
import { AppError } from '@/utils/appError';
import type { CreateOrgDto } from './onboarding.schema';

export async function createOrg(userId: string, dto: CreateOrgDto) {
  // 1. Guard: one org-creation per user during onboarding
  //    (settings flow for additional orgs comes in L5)
  const existingMembership = await MembershipModel.findOne({ userId, role: 'Owner' });
  if (existingMembership) {
    throw new AppError(409, 'ORG_LIMIT_REACHED', 'You already own an organization. Use Settings to create additional organizations.');
  }

  // 2. Generate slug
  const slug = await generateUniqueSlug(dto.name);

  // 3. Create Organization
  const org = await OrganizationModel.create({
    name: dto.name,
    slug,
    ownerId: userId,
    industry: dto.industry,
    timezone: dto.timezone,
    hasWebsite: dto.hasWebsite ?? false,
    websiteUrl: dto.websiteUrl,
    // onboardingStatus defaults to 'ORG_CREATION' (from schema)
  });

  // 4. Create Membership (Owner role)
  const membership = await MembershipModel.create({
    userId,
    organizationId: org._id,
    role: 'Owner',
  });

  // 5. Create OnboardingSession
  //    currentStep: 'Learn' because 'Connect' (org creation) just completed
  const session = await OnboardingSessionModel.create({
    userId,
    organizationId: org._id,
    currentStep: 'Learn',
    stepStatus: 'NotStarted',
    draftPayload: {},
    resumeToken: crypto.randomBytes(32).toString('hex'),
  });

  return { organization: org, membership, session };
}
```

**Atomicity note**: MongoDB does not support multi-document transactions by default on standalone (Atlas does). If Org is created but Membership creation fails (e.g., unique index violation on a race condition), the org will be orphaned. For now, `ORG_LIMIT_REACHED` guard above prevents the race by checking before insert. If we need true atomicity in the future, use a MongoDB client session with `session.withTransaction()`.

---

## 6. Controller

```typescript
// onboarding.controller.ts

import { RequestHandler } from 'express';
import { CreateOrgSchema } from './onboarding.schema';
import { createOrg } from './onboarding.service';

export const createOrgHandler: RequestHandler = async (req, res, next) => {
  try {
    const dto = CreateOrgSchema.parse(req.body);
    const result = await createOrg(req.userId!, dto);

    res.status(201).json({
      success: true,
      data: {
        organization: result.organization.toJSON(),
        membership: {
          _id: result.membership._id,
          role: result.membership.role,
          organizationId: result.membership.organizationId,
        },
        session: {
          _id: result.session._id,
          currentStep: result.session.currentStep,
          stepStatus: result.session.stepStatus,
          resumeToken: result.session.resumeToken,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
```

---

## 7. Router + App Registration

```typescript
// backend/src/modules/onboarding/onboarding.routes.ts
import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { createOrgHandler } from './onboarding.controller';

export const onboardingRouter = Router();

// POST /api/v1/onboarding/org — create organization during onboarding
onboardingRouter.post('/org', authenticate, createOrgHandler);
```

```typescript
// backend/src/app.ts — uncomment and add import:
import { onboardingRouter } from './modules/onboarding/onboarding.routes';
// ...
app.use('/api/v1/onboarding', onboardingRouter);
```

---

## 8. GET /auth/me — `organizations[]` Population Dependency

After org creation, the frontend needs to see the new org in `organizations[]` when calling `GET /auth/me`. The auth service's `getMe` must:

1. Find user by `req.userId`
2. Find all `Membership` docs where `userId = req.userId`
3. Populate `organizationId` → Organization  
4. Return shaped array: `[{ id, name, slug, onboardingStatus, role }]`

**Check if this is already implemented** in `auth.service.ts` before L2.F3 starts. If not, add it as AT0 (prerequisite).

Frontend handles the POST response by dispatching `addOrganization(org)` to Redux (or re-calling `verifySession()` to refresh). Recommended: have the POST response include the org and have the frontend dispatch `addOrganization` — avoids a second API call.

---

## 9. Atomic Task Breakdown

| AT | File | Work |
|---|---|---|
| **L2.F3.M1.AT1** | `modules/onboarding/onboarding.schema.ts` | Write `CreateOrgSchema` (Zod) |
| **L2.F3.M1.AT2** | `modules/onboarding/onboarding.service.ts` | Write `generateUniqueSlug()` + `toSlugBase()` |
| **L2.F3.M1.AT3** | `modules/onboarding/onboarding.service.ts` | Write `createOrg(userId, dto)` — Org + Membership + Session creation |
| **L2.F3.M1.AT4** | `modules/onboarding/onboarding.controller.ts` | Write `createOrgHandler` |
| **L2.F3.M1.AT5** | `modules/onboarding/onboarding.routes.ts` + `app.ts` | Wire router; uncomment `onboardingRouter` in `app.ts` |
| **L2.F3.M1.AT6** | `backend/src/__tests__/onboarding.test.ts` | Integration tests (see §10 below) |

---

## 10. Integration Test Plan (`onboarding.test.ts`)

Same setup pattern as `auth.test.ts`:
- MongoMemoryServer via `setup.ts` global setupFiles
- Redis mock via `vi.mock('@/config/redis', ...)` (even though org creation doesn't use Redis, the auth middleware does)
- `authenticate` middleware in the route reads the accessToken cookie → test must set `Cookie: accessToken=<jwt>`

**Test cases**:

```
describe('POST /api/v1/onboarding/org')
  AT6.1 — 201: creates org, membership, session for authenticated user
    → body has { data.organization, data.membership, data.session }
    → org.slug derived from org.name
    → membership.role === 'Owner'
    → session.currentStep === 'Learn'
    → MongoDB: Org exists, Membership exists, OnboardingSession exists

  AT6.2 — 201: slug uniqueness — create two orgs with same name
    → first org: slug = 'acme-corp'
    → second org (different user): slug = 'acme-corp-1'

  AT6.3 — 409 ORG_LIMIT_REACHED: same user tries to create a second org
    → pre-existing Membership with role:'Owner' → rejected

  AT6.4 — 401 UNAUTHORIZED: no accessToken cookie
    → authenticate middleware rejects before service is called

  AT6.5 — 400 VALIDATION_ERROR: missing required field 'name'

  AT6.6 — 400 VALIDATION_ERROR: name too short (1 char)

  AT6.7 — 400 VALIDATION_ERROR: invalid websiteUrl format

  AT6.8 — 201: special characters in name produce clean slug
    → name: "Rao & Sons!!!" → slug: "rao-sons"

  AT6.9 — 201: slug with accent chars normalised correctly
    → name: "Café Bistro" → slug: "cafe-bistro"
```

---

## 11. Frontend Considerations (for L2.F4)

These are notes for the ConnectPage implementation (next sprint):

**Form fields**: name, industry (dropdown), timezone (dropdown, default 'Asia/Kolkata'), hasWebsite (toggle), websiteUrl (conditional on hasWebsite)

**On success**: dispatch `addOrganization(org)` to Redux authSlice → navigate to `/onboarding/learn`

**Redux changes needed**: add `addOrganization` action to `authSlice.ts` that pushes a new org into `user.organizations[]`

**Industry options** (match backend enum if any, or free-text — check with Product agent):
Recommended defaults: Technology, Healthcare, Real Estate, Logistics, Finance, Education, Retail, Hospitality, Other

---

## 12. File Structure to Create

```
backend/src/modules/onboarding/
  ├── onboarding.routes.ts     (new)
  ├── onboarding.controller.ts (new)
  ├── onboarding.service.ts    (new)
  └── onboarding.schema.ts     (new)

backend/src/__tests__/
  └── onboarding.test.ts       (new, AT6)
```

No new model files needed — all models already exist in `organization.model.ts`.

---

## 13. Open Questions for Founder (T0)

1. **Org limit per user**: Allow multiple orgs from the start, or restrict to 1 during onboarding and unlock more via Settings? (Current notes assume 1 per onboarding flow.)
2. **Industry field**: Predefined dropdown or free-text? If dropdown, define the list.
3. **Timezone default**: Asia/Kolkata is the model default. Is this always correct for our ICP, or should we auto-detect from browser?
