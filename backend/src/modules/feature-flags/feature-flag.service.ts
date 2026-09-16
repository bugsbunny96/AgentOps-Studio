/**
 * Feature Flag Service
 *
 * Manages global and per-org feature flags.
 * Global flags are seeded on first access; org flags are created on demand.
 */
import { FeatureFlagModel, IFeatureFlag } from './feature-flag.model';

// ─── Seed catalogue ───────────────────────────────────────────────────────────

export interface FlagTemplate {
  name: string;
  description: string;
}

export const GLOBAL_FLAG_TEMPLATES: FlagTemplate[] = [
  { name: 'MAINTENANCE_MODE',      description: 'Puts the platform in maintenance mode — all non-SA requests return 503' },
  { name: 'BLOG_ENABLED',          description: 'Enables the public blog listing and article pages' },
  { name: 'OUTBOUND_CALLS_ENABLED', description: 'Allows orgs to initiate outbound calls via the voice agent' },
  { name: 'NEW_ONBOARDING_FLOW',   description: 'Enables the redesigned onboarding wizard (v2)' },
];

export const ORG_FLAG_TEMPLATES: FlagTemplate[] = [
  { name: 'HINDI_ENABLED',      description: 'Enables Hindi language detection and auto-response for this org' },
  { name: 'KB_CRAWLER_ENABLED', description: 'Allows the knowledge base website crawler for this org' },
  { name: 'ANALYTICS_V2',       description: 'Enables the v2 analytics dashboard for this org' },
  { name: 'CUSTOM_SUBDOMAIN',   description: 'Enables custom subdomain routing for this org' },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

/**
 * Called once on server start (or lazily on first SA flags request).
 * Inserts any missing global flags with enabled: false.
 * Idempotent — safe to call multiple times.
 */
export async function seedGlobalFlags(): Promise<void> {
  for (const tmpl of GLOBAL_FLAG_TEMPLATES) {
    await FeatureFlagModel.findOneAndUpdate(
      { name: tmpl.name, scope: 'global' },
      {
        $setOnInsert: {
          name:        tmpl.name,
          scope:       'global',
          enabled:     false,
          description: tmpl.description,
        },
      },
      { upsert: true },
    );
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listGlobalFlags(): Promise<IFeatureFlag[]> {
  await seedGlobalFlags();
  return FeatureFlagModel.find({ scope: 'global' }).sort({ name: 1 }).lean() as unknown as IFeatureFlag[];
}

export async function listOrgFlags(orgId: string): Promise<IFeatureFlag[]> {
  return FeatureFlagModel.find({ scope: 'org', orgId }).sort({ name: 1 }).lean() as unknown as IFeatureFlag[];
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function toggleFlag(
  id: string,
  enabled: boolean,
  changedBy: string,
): Promise<IFeatureFlag | null> {
  return FeatureFlagModel.findByIdAndUpdate(
    id,
    { enabled, lastChangedBy: changedBy, lastChangedAt: new Date() },
    { new: true },
  ).lean() as unknown as IFeatureFlag | null;
}

export async function createOrgFlag(params: {
  orgId:       string;
  name:        string;
  description: string;
  enabled:     boolean;
  changedBy:   string;
}): Promise<IFeatureFlag> {
  const flag = new FeatureFlagModel({
    name:          params.name,
    scope:         'org',
    orgId:         params.orgId,
    enabled:       params.enabled,
    description:   params.description,
    lastChangedBy: params.changedBy,
    lastChangedAt: new Date(),
  });
  return flag.save();
}

export async function deleteFlag(id: string): Promise<boolean> {
  const result = await FeatureFlagModel.findByIdAndDelete(id);
  return result !== null;
}
