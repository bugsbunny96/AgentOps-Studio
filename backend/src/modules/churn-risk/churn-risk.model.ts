/**
 * ChurnRisk snapshot — one record per org per daily scan.
 * 30-day TTL keeps the collection lean.
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IChurnRiskSignal {
  key:      string;   // e.g. 'no_calls_7d', 'incomplete_onboarding'
  label:    string;   // human-readable
  severity: 'low' | 'medium' | 'high';
}

export interface IChurnRisk extends Document {
  _id:        mongoose.Types.ObjectId;
  orgId:      mongoose.Types.ObjectId;
  orgName:    string;
  plan:       string;
  score:      number;           // 0–100; higher = more at risk
  signals:    IChurnRiskSignal[];
  scannedAt:  Date;
  createdAt:  Date;
}

const ChurnRiskSchema = new Schema<IChurnRisk>(
  {
    orgId:     { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    orgName:   { type: String, required: true },
    plan:      { type: String, required: true },
    score:     { type: Number, required: true },
    signals:   [
      {
        key:      { type: String },
        label:    { type: String },
        severity: { type: String, enum: ['low', 'medium', 'high'] },
        _id:      false,
      },
    ],
    scannedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    // Auto-expire after 30 days
    expireAfterSeconds: 30 * 24 * 3600,
  }
);

// One snapshot per org per day — upsert by orgId + date truncated to day
ChurnRiskSchema.index({ orgId: 1, scannedAt: -1 });

export const ChurnRiskModel = mongoose.model<IChurnRisk>('ChurnRisk', ChurnRiskSchema);
