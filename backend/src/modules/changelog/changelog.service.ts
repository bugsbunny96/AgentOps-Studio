/**
 * Changelog Service
 *
 * SA CRUD + public paginated changelog fetcher.
 */
import { ChangelogModel, IChangelog } from './changelog.model';

// ─── Public ───────────────────────────────────────────────────────────────────

export async function getPublicChangelog(
  page = 1,
  limit = 20,
): Promise<{ entries: IChangelog[]; total: number; pages: number }> {
  const skip  = (page - 1) * limit;
  const query = { isPublished: true };
  const [entries, total] = await Promise.all([
    ChangelogModel.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    ChangelogModel.countDocuments(query),
  ]);
  return {
    entries: entries as unknown as IChangelog[],
    total,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Latest published changelog entry date — used by the frontend
 * to show a "What's new" dot if the user hasn't visited since this date.
 */
export async function getLatestPublishedDate(): Promise<Date | null> {
  const entry = await ChangelogModel.findOne({ isPublished: true }).sort({ date: -1 }).select('date').lean();
  return entry?.date ?? null;
}

// ─── SA CRUD ──────────────────────────────────────────────────────────────────

export async function listAllChangelog(): Promise<IChangelog[]> {
  return ChangelogModel.find().sort({ date: -1 }).lean() as unknown as IChangelog[];
}

export async function createChangelogEntry(params: {
  title:       string;
  description: string;
  type:        IChangelog['type'];
  date:        Date;
  isPublished: boolean;
  createdBy:   string;
}): Promise<IChangelog> {
  const doc = new ChangelogModel(params);
  return doc.save();
}

export async function updateChangelogEntry(
  id: string,
  patch: Partial<Pick<IChangelog, 'title' | 'description' | 'type' | 'date' | 'isPublished'>>,
): Promise<IChangelog | null> {
  return ChangelogModel.findByIdAndUpdate(id, patch, { new: true }).lean() as unknown as IChangelog | null;
}

export async function toggleChangelogPublish(id: string, isPublished: boolean): Promise<IChangelog | null> {
  return ChangelogModel.findByIdAndUpdate(id, { isPublished }, { new: true }).lean() as unknown as IChangelog | null;
}

export async function deleteChangelogEntry(id: string): Promise<boolean> {
  const result = await ChangelogModel.findByIdAndDelete(id);
  return result !== null;
}
