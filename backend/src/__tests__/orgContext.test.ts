/**
 * SEC-05 / SEC-06 — org context, roles and phone-number ownership
 *
 * - Every org route resolves the org from X-Organization-ID (or the user's only org)
 * - Owner-only actions reject Members; Member edits need the section permission
 * - Services act on the org chosen by the header, not "the user's first org"
 * - A Vapi phone-number ID can be linked to only one org
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '@/app';
import { UserModel } from '@/modules/auth/auth.model';
import { OrganizationModel, MembershipModel } from '@/modules/organization/organization.model';
import { CallModel } from '@/modules/calls/call.model';
import { signAccessToken } from '@/utils/jwt';

vi.mock('@/config/redis', () => ({
  redis: { setex: vi.fn().mockResolvedValue('OK'), get: vi.fn().mockResolvedValue(null), del: vi.fn().mockResolvedValue(1) },
}));
vi.mock('@/utils/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

let seq = 0;
async function makeUser() {
  seq += 1;
  const user = await UserModel.create({
    name: `User ${seq}`, email: `orgctx-${Date.now()}-${seq}@example.com`,
    passwordHash: '$2a$12$placeholder', isVerified: true, status: 'Active',
  });
  const cookie = `accessToken=${signAccessToken({ userId: user._id.toString(), email: user.email })}`;
  return { user, cookie };
}
async function makeOrg(ownerId: mongoose.Types.ObjectId, extra: Record<string, unknown> = {}) {
  seq += 1;
  const org = await OrganizationModel.create({
    name: `Org ${seq}`, slug: `orgctx-${Date.now()}-${seq}`, ownerId,
    industry: 'Retail', timezone: 'Asia/Kolkata', onboardingStatus: 'COMPLETED', ...extra,
  });
  await MembershipModel.create({ userId: ownerId, organizationId: org._id, role: 'Owner' });
  return org;
}
async function addMember(userId: mongoose.Types.ObjectId, orgId: mongoose.Types.ObjectId, permissions: Record<string, boolean>) {
  await MembershipModel.create({
    userId, organizationId: orgId, role: 'Member',
    permissions: { agents: true, calls: true, knowledgeBase: true, team: false, ...permissions },
  });
}
async function seedCall(orgId: mongoose.Types.ObjectId, callerNumber: string) {
  await CallModel.create({
    organizationId: orgId, agentId: new mongoose.Types.ObjectId(), vapiCallId: new mongoose.Types.ObjectId().toString(),
    direction: 'Inbound', duration: 60, status: 'completed', callerNumber, cost: 0,
  });
}

beforeEach(() => vi.clearAllMocks());

describe('SEC-05 — orgContext', () => {
  it('403 NO_ORGANIZATION when the user belongs to no org', async () => {
    const { cookie } = await makeUser();
    const res = await request(app).get('/api/v1/calls').set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NO_ORGANIZATION');
  });

  it('400 for a malformed X-Organization-ID', async () => {
    const { user, cookie } = await makeUser();
    await makeOrg(user._id);
    const res = await request(app).get('/api/v1/calls').set('Cookie', cookie).set('X-Organization-ID', 'not-an-id');
    expect(res.status).toBe(400);
  });

  it("403 when the header names an org the user isn't a member of", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeOrg(a.user._id);
    const orgB = await makeOrg(b.user._id);
    const res = await request(app).get('/api/v1/calls').set('Cookie', a.cookie).set('X-Organization-ID', orgB._id.toString());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('services return data for the org in the header (multi-org user)', async () => {
    const u = await makeUser();
    const other = await makeUser();
    const own = await makeOrg(u.user._id);
    const joined = await makeOrg(other.user._id);
    await addMember(u.user._id, joined._id, {});
    await seedCall(own._id, '+910000000001');
    await seedCall(joined._id, '+910000000002');

    const resOwn = await request(app).get('/api/v1/calls').set('Cookie', u.cookie).set('X-Organization-ID', own._id.toString());
    const resJoined = await request(app).get('/api/v1/calls').set('Cookie', u.cookie).set('X-Organization-ID', joined._id.toString());

    expect(resOwn.status).toBe(200);
    expect(resJoined.status).toBe(200);
    expect(resOwn.body.data.calls.map((c: { callerNumber: string }) => c.callerNumber)).toEqual(['+910000000001']);
    expect(resJoined.body.data.calls.map((c: { callerNumber: string }) => c.callerNumber)).toEqual(['+910000000002']);
  });

  it('role follows the header: Owner in one org, Member in another', async () => {
    const u = await makeUser();
    const other = await makeUser();
    const own = await makeOrg(u.user._id);
    const joined = await makeOrg(other.user._id);
    await addMember(u.user._id, joined._id, {});

    const asMember = await request(app).post('/api/v1/agents/phone-number')
      .set('Cookie', u.cookie).set('X-Organization-ID', joined._id.toString())
      .send({ vapiPhoneNumberId: '11111111-2222-3333-4444-555555555555' });
    expect(asMember.status).toBe(403);
    expect(asMember.body.code).toBe('OWNER_ONLY');

    const asOwner = await request(app).post('/api/v1/agents/phone-number')
      .set('Cookie', u.cookie).set('X-Organization-ID', own._id.toString())
      .send({ vapiPhoneNumberId: '11111111-2222-3333-4444-555555555555' });
    expect(asOwner.status).toBe(200);
    expect((await OrganizationModel.findById(own._id).lean())?.vapiPhoneNumberId).toBe('11111111-2222-3333-4444-555555555555');
    expect((await OrganizationModel.findById(joined._id).lean())?.vapiPhoneNumberId).toBeUndefined();
  });
});

describe('SEC-05 — Member permissions', () => {
  async function memberOf(permissions: Record<string, boolean>) {
    const owner = await makeUser();
    const member = await makeUser();
    const org = await makeOrg(owner.user._id);
    await addMember(member.user._id, org._id, permissions);
    return { org, cookie: member.cookie };
  }

  it.each([
    ['post', '/api/v1/agents/provision'],
    ['post', '/api/v1/telephony/number'],
    ['patch', '/api/v1/onboarding/org'],
    ['post', '/api/v1/onboarding/complete'],
  ] as const)('Members cannot %s %s (Owner-only)', async (method, url) => {
    const { cookie } = await memberOf({});
    const res = await request(app)[method](url).set('Cookie', cookie).send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('OWNER_ONLY');
  });

  it('a Member without agents access cannot change agent config or voice', async () => {
    const { cookie } = await memberOf({ agents: false });
    const id = new mongoose.Types.ObjectId().toString();
    for (const url of [`/api/v1/agents/${id}`, `/api/v1/agents/${id}/config`]) {
      const res = await request(app).patch(url).set('Cookie', cookie).send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PERMISSION_DENIED');
    }
  });

  it('a Member without knowledge-base access can read but not edit the catalog', async () => {
    const { cookie } = await memberOf({ knowledgeBase: false });
    expect((await request(app).get('/api/v1/catalog').set('Cookie', cookie)).status).toBe(200);
    const res = await request(app).post('/api/v1/catalog').set('Cookie', cookie).send({ name: 'MCB', category: 'switchgear', price: 100 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('a Member without calls access cannot place outbound calls', async () => {
    const { cookie } = await memberOf({ calls: false });
    const res = await request(app).post('/api/v1/calls/initiate').set('Cookie', cookie).send({ phoneNumber: '+919999999999' });
    expect(res.status).toBe(403);
  });

  it('a Member with calls access can read calls', async () => {
    const { cookie } = await memberOf({ calls: true });
    expect((await request(app).get('/api/v1/calls').set('Cookie', cookie)).status).toBe(200);
  });
});

describe('SEC-06 — phone-number ownership', () => {
  it('rejects an ID already linked to another org', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeOrg(a.user._id, { vapiPhoneNumberId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
    const orgB = await makeOrg(b.user._id);

    const res = await request(app).post('/api/v1/agents/phone-number').set('Cookie', b.cookie)
      .send({ vapiPhoneNumberId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
    expect(res.status).toBe(409);
    expect((await OrganizationModel.findById(orgB._id).lean())?.vapiPhoneNumberId).toBeUndefined();
  });

  it('rejects a value that is not a Vapi phone-number UUID', async () => {
    const a = await makeUser();
    await makeOrg(a.user._id);
    const res = await request(app).post('/api/v1/agents/phone-number').set('Cookie', a.cookie).send({ vapiPhoneNumberId: '+919999999999' });
    expect(res.status).toBe(400);
  });

  it('lets an Owner re-link the ID their own org already holds', async () => {
    const a = await makeUser();
    await makeOrg(a.user._id, { vapiPhoneNumberId: 'aaaaaaaa-0000-cccc-dddd-eeeeeeeeeeee' });
    const res = await request(app).post('/api/v1/agents/phone-number').set('Cookie', a.cookie)
      .send({ vapiPhoneNumberId: 'aaaaaaaa-0000-cccc-dddd-eeeeeeeeeeee' });
    expect(res.status).toBe(200);
  });
});
