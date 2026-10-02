/**
 * SEC-12 — resolveOrgByAssistantId must never guess an org or write to it.
 *
 * Regression for 2026-10-02: a request with an unknown assistantId hit the
 * single-org fallback, which saved that ID onto the only org and replaced the
 * live assistant, so inbound calls routed to a non-existent assistant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { resolveOrgByAssistantId } from '@/modules/orders/order.service';
import { OrganizationModel } from '@/modules/organization/organization.model';

vi.mock('@/config/redis', () => ({
  redis: { setex: vi.fn(), get: vi.fn().mockResolvedValue(null), del: vi.fn() },
}));

const LIVE = '100b3bd9-5038-4f11-b487-7ced98d8a3dd';

describe('SEC-12 — resolveOrgByAssistantId', () => {
  let orgId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    await OrganizationModel.deleteMany({});
    const org = await OrganizationModel.create({
      name:             'Only Org',
      slug:             'only-org-sec12',
      ownerId:          new mongoose.Types.ObjectId(),
      industry:         'Retail',
      timezone:         'Asia/Kolkata',
      onboardingStatus: 'COMPLETED',
      vapiAssistantId:  LIVE,
    });
    orgId = org._id as mongoose.Types.ObjectId;
  });

  it('resolves the org for its own assistant', async () => {
    expect((await resolveOrgByAssistantId(LIVE))?.toString()).toBe(orgId.toString());
  });

  it('returns null for an unknown assistant even when only one org exists', async () => {
    expect(await OrganizationModel.countDocuments()).toBe(1);
    expect(await resolveOrgByAssistantId('asst_does_not_exist')).toBeNull();
  });

  it('never overwrites the org assistant ID', async () => {
    await resolveOrgByAssistantId('asst_does_not_exist');
    const org = await OrganizationModel.findById(orgId).lean();
    expect(org?.vapiAssistantId).toBe(LIVE);
  });
});
