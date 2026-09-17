/**
 * ErrorLog Model
 *
 * Captures unhandled 5xx errors from the global error handler.
 * Written fire-and-forget — never throws, never blocks a response.
 *
 * Retention: 30-day TTL via MongoDB TTL index.
 * Max effective size: ~10,000 entries (30d × ~330/day before that rate)
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface IErrorLog extends Document {
  _id: mongoose.Types.ObjectId;
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
  path?: string;
  method?: string;
  orgId?: string;
  userId?: string;
  createdAt: Date;
}

const ErrorLogSchema = new Schema<IErrorLog>(
  {
    message: { type: String, required: true },
    code: { type: String },
    statusCode: { type: Number },
    // Stack trimmed to 4 KB in the error handler to avoid oversized docs
    stack: { type: String },
    path: { type: String },
    method: { type: String },
    orgId: { type: String },
    userId: { type: String },
  },
  {
    // updatedAt not needed — logs are immutable
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
  },
);

// 30-day auto-expiry
ErrorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
ErrorLogSchema.index({ code: 1 });
ErrorLogSchema.index({ message: 1 });
ErrorLogSchema.index({ orgId: 1 });
ErrorLogSchema.index({ statusCode: 1 });

export const ErrorLogModel = mongoose.model<IErrorLog>('ErrorLog', ErrorLogSchema);
