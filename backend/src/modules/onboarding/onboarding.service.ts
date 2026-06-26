import crypto from 'crypto';
import {
  OrganizationModel,
  MembershipModel,
  OnboardingSessionModel,
  type IOrganization,
} from '../organization/organization.model';
import { Conflict, NotFound } from '../../middleware/errorHandler';
import type { CreateOrgDto, UpdateOrgDto } from './onboarding.schema';

// ─── Slug generation ───────────────────────────────────────────────────────

/**
 * Convert an org name to a URL-safe slug base.
 * Handles accented characters, special symbols, and excessive whitespace.
 *
 * Examples:
 *   "Acme Corp"         → "acme-corp"
 *   "Rao & Sons!!!"     → "rao-sons"
 *   "Café Bistro"       → "cafe-bistro"
 *   "   Spaces   "      → "spaces"
 *   "!!!!"              → "org"  (fallback handled in generateUniqueSlug)
 */
export function toSlugBase(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')              // decompose accented chars (é → e + combining accent)
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9\s-]/g, '')  // remove everything except alnum, space, hyphen
    .replace(/\s+/g, '-')           // collapse whitespace → single hyphen
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');       // trim leading/trailing hyphens
}

/**
 * Resolve a globally unique slug.
 * Appends a counter suffix (-1, -2, …) on collision; fails after 20 attempts.
 */
export async function generateUniqueSlug(name: string): Promise<string> {
  const base = toSlugBase(name) || 'org'; // fallback if name is all special chars
  let candidate = base;
  let counter = 1;

  while (counter <= 20) {
    const exists = await OrganizationModel.exists({ slug: candidate });
    if (!exists) return candidate;
    candidate = `${base}-${counter}`;
    counter++;
  }

  throw Conflict(
    'Could not generate a unique slug after 20 attempts. Please try a slightly different name.',
    'DUPLICATE_SLUG',
  );
}

// ─── Create Organization (Step 1) ─────────────────────────────────────────

/**
 * Creates an Organization, Membership (Owner), and OnboardingSession atomically.
 *
 * Guard: rejects if the user already owns an organization (1-per-onboarding limit).
 * More orgs can be created via the Settings flow (T5.3) once launched.
 */
export async function createOrg(userId: string, dto: CreateOrgDto) {
  // Enforce 1-org-per-user during onboarding
  const existingOwnership = await MembershipModel.findOne({ userId, role: 'Owner' });
  if (existingOwnership) {
    throw Conflict(
      'You already own an organization. Additional organizations can be created from Settings.',
      'ORG_LIMIT_REACHED',
    );
  }

  const slug = await generateUniqueSlug(dto.name);

  // Create org with onboardingStatus defaulting to 'ORG_CREATION' (from schema)
  const org = await OrganizationModel.create({
    name: dto.name,
    slug,
    ownerId: userId,
    industry: dto.industry,
    timezone: dto.timezone,
  });

  // Create Owner membership
  const membership = await MembershipModel.create({
    userId,
    organizationId: org._id,
    role: 'Owner',
  });

  // Create OnboardingSession — currentStep 'Learn' because Connect (org creation) is now done
  const session = await OnboardingSessionModel.create({
    userId,
    organizationId: org._id,
    currentStep: 'Learn',
    stepStatus: 'NotStarted',
    draftPayload: {},
    resumeToken: crypto.randomBytes(32).toString('hex'),
  });

  return {
    organization: org.toJSON(),
    membership: {
      _id: membership._id.toString(),
      role: membership.role,
      organizationId: membership.organizationId.toString(),
    },
    session: {
      _id: session._id.toString(),
      currentStep: session.currentStep,
      stepStatus: session.stepStatus,
      resumeToken: session.resumeToken,
    },
  };
}

// ─── Update Organization Step (Steps 2-4) ─────────────────────────────────

/**
 * Handles Learn, Configure, and Customize step PATCH updates.
 * Looks up the user's org via Owner membership — no X-Organization-ID needed.
 * Advances onboardingStatus to the next state after each step.
 */
export async function updateOrgStep(userId: string, dto: UpdateOrgDto) {
  const membership = await MembershipModel.findOne({ userId, role: 'Owner' }).populate<{
    organizationId: IOrganization;
  }>('organizationId');

  if (!membership) {
    throw NotFound('Organization');
  }

  const orgId = membership.organizationId._id;
  const updates: Record<string, unknown> = {};

  if (dto.step === 'learn') {
    updates.hasWebsite = dto.hasWebsite;
    if (dto.websiteUrl) updates.websiteUrl = dto.websiteUrl;
    updates.onboardingStatus = 'WEBSITE_CRAWL';
  } else if (dto.step === 'configure') {
    if (dto.businessDescription !== undefined) {
      updates.businessDescription = dto.businessDescription;
    }
    if (dto.services !== undefined) updates.services = dto.services;
    if (dto.businessHours !== undefined) updates.businessHours = dto.businessHours;
    if (dto.contactDetails !== undefined) updates.contactDetails = dto.contactDetails;
    if (dto.locations !== undefined) updates.locations = dto.locations;
    updates.onboardingStatus = 'BUSINESS_CONFIG';
  } else if (dto.step === 'customize') {
    updates.supportedLanguages = dto.supportedLanguages;
    if (dto.fallbackNumber) updates.fallbackNumber = dto.fallbackNumber;
    updates.onboardingStatus = 'VOICE_SETUP';
  }

  const updated = await OrganizationModel.findByIdAndUpdate(
    orgId,
    { $set: updates },
    { new: true },
  );

  return { organization: updated!.toJSON() };
}

// ─── Complete Onboarding (Step 5) ─────────────────────────────────────────

/**
 * Marks the organization as COMPLETED and marks the OnboardingSession as done.
 * After this, OrgGuard will allow access to the /dashboard/* routes.
 */
export async function completeOnboarding(userId: string) {
  const membership = await MembershipModel.findOne({ userId, role: 'Owner' }).populate<{
    organizationId: IOrganization;
  }>('organizationId');

  if (!membership) {
    throw NotFound('Organization');
  }

  const orgId = membership.organizationId._id;

  const org = await OrganizationModel.findByIdAndUpdate(
    orgId,
    { $set: { onboardingStatus: 'COMPLETED' } },
    { new: true },
  );

  // Mark the onboarding session as completed
  await OnboardingSessionModel.findOneAndUpdate(
    { userId, organizationId: orgId },
    { $set: { currentStep: 'Activate', stepStatus: 'Completed', lastCompletedStep: 'Activate' } },
  );

  return {
    organization: org!.toJSON(),
    message: 'Onboarding complete! Your AI agent is ready to go.',
  };
}
