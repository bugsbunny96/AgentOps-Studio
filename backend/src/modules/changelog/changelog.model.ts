/**
 * Changelog Model
 *
 * Product changelog entries authored by super admin.
 *
 * type:
 *   new      → green  — brand-new feature
 *   improved → blue   — enhancement to existing feature
 *   fixed    → amber  — bug fix
 *
 * isPublished:
 *   false = draft (only super admin can see)
 *   true  = visible on public /changelog page
 *
 * date:
 *   The displayed release/update date (can differ from createdAt)
 */
import mongoose, { Document, Schema } from 'mongoose';

export type ChangelogType = 'new' | 'improved' | 'fixed';

export interface IChangelog extends Document {
  _id:         mongoose.Types.ObjectId;
  title:       string;
  description: string;
  type:        ChangelogType;
  date:        Date;
  isPublished: boolean;
  createdBy:   string;
  createdAt:   Date;
  updatedAt:   Date;
}

const ChangelogSchema = new Schema<IChangelog>(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type:        { type: String, enum: ['new', 'improved', 'fixed'], required: true },
    date:        { type: Date, required: true, default: Date.now },
    isPublished: { type: Boolean, default: false },
    createdBy:   { type: String, required: true },
  },
  { timestamps: true },
);

ChangelogSchema.index({ date: -1 });
ChangelogSchema.index({ isPublished: 1, date: -1 });

export const ChangelogModel = mongoose.model<IChangelog>('Changelog', ChangelogSchema);
