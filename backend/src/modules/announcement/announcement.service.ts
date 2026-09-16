/**
 * Announcement Service
 *
 * SA CRUD + public "active banners for this plan" fetcher.
 */
import { AnnouncementModel, IAnnouncement, AnnouncementTarget } from './announcement.model';

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * Returns all active, non-expired announcements visible to the given plan.
 * Called by the public dashboard banner fetcher (no auth needed — plan derived from JWT).
 */
export async function getActiveBanners(plan: string): Promise<IAnnouncement[]> {
  const now = new Date();
  return AnnouncementModel.find({
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    targetPlan: { $in: ['all', plan] },
  })
    .sort({ createdAt: -1 })
    .lean() as unknown as IAnnouncement[];
}

// ─── SA CRUD ──────────────────────────────────────────────────────────────────

export async function listAnnouncements(): Promise<IAnnouncement[]> {
  return AnnouncementModel.find().sort({ createdAt: -1 }).lean() as unknown as IAnnouncement[];
}

export async function createAnnouncement(params: {
  title:       string;
  message:     string;
  type:        IAnnouncement['type'];
  targetPlan:  AnnouncementTarget;
  dismissible: boolean;
  expiresAt?:  Date | null;
  createdBy:   string;
}): Promise<IAnnouncement> {
  // critical announcements are never dismissible
  const dismissible = params.type === 'critical' ? false : params.dismissible;
  const doc = new AnnouncementModel({ ...params, dismissible, isActive: true });
  return doc.save();
}

export async function updateAnnouncement(
  id: string,
  patch: Partial<Pick<IAnnouncement, 'title' | 'message' | 'type' | 'targetPlan' | 'dismissible' | 'expiresAt' | 'isActive'>>,
): Promise<IAnnouncement | null> {
  // Re-enforce critical → non-dismissible on update
  if (patch.type === 'critical') patch.dismissible = false;
  return AnnouncementModel.findByIdAndUpdate(id, patch, { new: true }).lean() as unknown as IAnnouncement | null;
}

export async function toggleAnnouncement(id: string, isActive: boolean): Promise<IAnnouncement | null> {
  return AnnouncementModel.findByIdAndUpdate(id, { isActive }, { new: true }).lean() as unknown as IAnnouncement | null;
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const result = await AnnouncementModel.findByIdAndDelete(id);
  return result !== null;
}
