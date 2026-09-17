/**
 * 19.4 GDPR Data Export
 *
 * Generates a ZIP archive containing all org data as JSON files:
 *   - org.json          — org record
 *   - team.json         — all memberships with user emails
 *   - agents.json       — voice agents
 *   - calls.json        — call records (without recording URLs)
 *   - knowledge-base.json — KB documents
 *   - billing.json      — plan + Stripe IDs (no card data)
 *
 * Streamed into the response so we never buffer the entire ZIP in memory.
 */

import mongoose from 'mongoose';
import archiver  from 'archiver';
import type { Response } from 'express';
import { OrganizationModel, MembershipModel } from '../organization/organization.model';
import { CallModel }     from '../calls/call.model';
import { UserModel }     from '../auth/auth.model';
import { VoiceAgentModel } from '../agents/agent.model';

async function getKbModel() {
  const { KbDocumentModel } = await import('../knowledge-base/kb.model');
  return KbDocumentModel;
}

export async function streamOrgDataExport(orgId: string, res: Response): Promise<void> {
  const oid = new mongoose.Types.ObjectId(orgId);

  const [org, memberships, KbDocumentModel] = await Promise.all([
    OrganizationModel.findById(oid).lean(),
    MembershipModel.find({ organizationId: oid }).lean(),
    getKbModel(),
  ]);

  if (!org) throw new Error(`Org ${orgId} not found`);

  // Enrich memberships with user emails
  const userIds = memberships.map(m => m.userId);
  const users = await UserModel.find({ _id: { $in: userIds } })
    .select('_id email name')
    .lean();
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  const team = memberships.map(m => {
    const u = userMap.get(m.userId.toString());
    return {
      role:      m.role,
      name:      u?.name ?? '(unknown)',
      email:     u?.email ?? '(unknown)',
      joinedAt:  m.createdAt,
    };
  });

  const [agents, calls, kbDocs] = await Promise.all([
    VoiceAgentModel.find({ organizationId: oid }).lean(),
    CallModel.find({ organizationId: oid })
      .select('-recordingUrl') // strip recording URLs
      .lean(),
    KbDocumentModel.find({ organizationId: oid }).lean(),
  ]);

  const billing = {
    plan:                 org.plan,
    planOverride:         org.planOverride ?? null,
    stripeCustomerId:     org.stripeCustomerId ?? null,
    stripeSubscriptionId: org.stripeSubscriptionId ?? null,
  };

  const exportedAt = new Date().toISOString();

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  function addJson(filename: string, data: unknown) {
    const json = JSON.stringify(data, null, 2);
    archive.append(json, { name: filename });
  }

  addJson('org.json', {
    exportedAt,
    org: {
      id:               org._id,
      name:             org.name,
      slug:             org.slug,
      timezone:         org.timezone,
      industry:         org.industry,
      onboardingStatus: org.onboardingStatus,
      createdAt:        org.createdAt,
    },
  });
  addJson('team.json',            { exportedAt, count: team.length, members: team });
  addJson('agents.json',          { exportedAt, count: agents.length, agents });
  addJson('calls.json',           { exportedAt, count: calls.length, calls });
  addJson('knowledge-base.json',  { exportedAt, count: kbDocs.length, documents: kbDocs });
  addJson('billing.json',         { exportedAt, billing });

  await archive.finalize();
}
