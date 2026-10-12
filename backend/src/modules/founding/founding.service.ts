/** Founding client programme — DB side (MKT-04). */
import mongoose from 'mongoose';
import { Conflict, NotFound } from '../../middleware/errorHandler';
import { OrganizationModel } from '../organization/organization.model';
import { foundingSpots, istQuarterBounds, priceLockUntil, type FoundingSpots } from './founding';

export async function getFoundingSpots(now: Date = new Date()): Promise<FoundingSpots> {
  const { start, end } = istQuarterBounds(now);
  const taken = await OrganizationModel.countDocuments({ 'foundingClient.since': { $gte: start, $lt: end } });
  return foundingSpots(taken, now);
}

/** Marks an org as a founding client. Refuses when this quarter's spots are taken. */
export async function markFoundingClient(orgId: string, by: string, now: Date = new Date()) {
  if (!mongoose.isValidObjectId(orgId)) throw NotFound('Organization');
  const org = await OrganizationModel.findById(orgId);
  if (!org) throw NotFound('Organization');
  if (org.foundingClient) return org.toObject();

  const spots = await getFoundingSpots(now);
  if (spots.remaining <= 0) {
    throw Conflict(`All ${spots.cap} founding spots for this quarter are taken`, 'FOUNDING_FULL');
  }
  org.foundingClient = { since: now, priceLockUntil: priceLockUntil(now), by };
  await org.save();
  return org.toObject();
}

export async function clearFoundingClient(orgId: string) {
  if (!mongoose.isValidObjectId(orgId)) throw NotFound('Organization');
  const org = await OrganizationModel.findByIdAndUpdate(orgId, { $set: { foundingClient: null } }, { new: true }).lean();
  if (!org) throw NotFound('Organization');
  return org;
}
