/**
 * 19.7 White-label / Sub-brand Support
 *
 * Allows super admin to set per-org branding overrides:
 *   - appName, logoUrl, brandColor, supportEmail
 *
 * The frontend reads /api/v1/org-branding (public endpoint, keyed by orgId)
 * and applies the values if whiteLabel.enabled === true.
 * Non-enabled orgs get default AgentOps Studio branding.
 */

import mongoose from 'mongoose';
import { OrganizationModel } from '../organization/organization.model';

export interface WhiteLabelConfig {
  enabled:       boolean;
  appName?:      string;
  logoUrl?:      string;
  brandColor?:   string;  // hex, e.g. '#6366f1'
  supportEmail?: string;
}

/** SA: set or update white-label config for an org */
export async function setWhiteLabel(
  orgId:    string,
  config:   WhiteLabelConfig,
  saEmail:  string,
): Promise<void> {
  await OrganizationModel.findByIdAndUpdate(
    new mongoose.Types.ObjectId(orgId),
    {
      $set: {
        whiteLabel: {
          enabled:      config.enabled,
          appName:      config.appName?.trim()      || undefined,
          logoUrl:      config.logoUrl?.trim()      || undefined,
          brandColor:   config.brandColor?.trim()   || undefined,
          supportEmail: config.supportEmail?.trim() || undefined,
          setBy:        saEmail,
          setAt:        new Date(),
        },
      },
    },
    { new: true },
  );
}

/** SA: clear white-label config (revert to defaults) */
export async function clearWhiteLabel(orgId: string): Promise<void> {
  await OrganizationModel.findByIdAndUpdate(
    new mongoose.Types.ObjectId(orgId),
    { $set: { 'whiteLabel.enabled': false } },
  );
}

/** Public: get the effective branding for an org (call from frontend) */
export async function getOrgBranding(orgId: string): Promise<WhiteLabelConfig | null> {
  const org = await OrganizationModel.findById(new mongoose.Types.ObjectId(orgId))
    .select('whiteLabel')
    .lean();

  if (!org?.whiteLabel?.enabled) return null;

  return {
    enabled:      true,
    appName:      org.whiteLabel.appName,
    logoUrl:      org.whiteLabel.logoUrl,
    brandColor:   org.whiteLabel.brandColor,
    supportEmail: org.whiteLabel.supportEmail,
  };
}
