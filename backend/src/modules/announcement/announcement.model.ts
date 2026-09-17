/**
 * Announcement Model
 *
 * In-app banners shown across the dashboard for all or plan-targeted users.
 *
 * type:
 *   info     → blue  — general notices (new feature, scheduled maintenance)
 *   warning  → amber — degraded performance, upcoming breaking change
 *   critical → red   — outage, security notice (un-dismissible)
 *
 * targetPlan:
 *   'all' → shown to every logged-in user
 *   specific plan → only orgs on that plan see it
 *
 * dismissible:
 *   false for 'critical' type (enforced in service layer)
 *   Dismissed IDs stored client-side in localStorage
 *
 * expiresAt:
 *   null = no expiry; auto-filtered server-side when fetching active banners
 */
import mongoose, { Document, Schema } from 'mongoose';

export type AnnouncementType = 'info' | 'warning' | 'critical';
export type AnnouncementTarget = 'all' | 'free' | 'starter' | 'growth' | 'enterprise';

export interface IAnnouncement extends Document {
  _id: mongoose.Types.ObjectId;
  title:      string;
  message:    string;
  type:       AnnouncementType;
  targetPlan: AnnouncementTarget;
  dismissible: boolean;
  isActive:   boolean;
  expiresAt?: Date | null;
  createdBy:  string;
  createdAt:  Date;
  updatedAt:  Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title:       { type: String, required: true, trim: true },
    message:     { type: String, required: true, trim: true },
    type:        { type: String, enum: ['info', 'warning', 'critical'], required: true },
    targetPlan:  { type: String, enum: ['all', 'free', 'starter', 'growth', 'enterprise'], default: 'all' },
    dismissible: { type: Boolean, default: true },
    isActive:    { type: Boolean, default: true },
    expiresAt:   { type: Date, default: null },
    createdBy:   { type: String, required: true },
  },
  { timestamps: true },
);

AnnouncementSchema.index({ isActive: 1, expiresAt: 1 });
AnnouncementSchema.index({ targetPlan: 1 });

export const AnnouncementModel = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
