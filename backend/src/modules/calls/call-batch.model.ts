/**
 * CallBatch — an outbound call list dialled one number at a time
 * (number automation, 2026-10-08). Processed by jobs/outboundBatch.worker.ts.
 */
import mongoose, { Schema, Document } from 'mongoose';

export type BatchStatus = 'running' | 'waiting' | 'completed' | 'stopped' | 'cancelled';
export type BatchItemStatus = 'pending' | 'dialing' | 'called' | 'failed' | 'skipped';

export interface IBatchItem {
  number:      string;
  status:      BatchItemStatus;
  vapiCallId?: string;
  error?:      string;
  at?:         Date;
}

export interface ICallBatch extends Document {
  _id:            mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  agentId:        mongoose.Types.ObjectId;
  createdBy:      mongoose.Types.ObjectId;
  status:         BatchStatus;
  /** Why the list stopped or is waiting (e.g. outside calling hours, minutes used up) */
  note?:          string;
  nextRunAt?:     Date;
  items:          IBatchItem[];
  createdAt:      Date;
  updatedAt:      Date;
}

const CallBatchSchema = new Schema<ICallBatch>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    agentId:        { type: Schema.Types.ObjectId, ref: 'VoiceAgent', required: true },
    createdBy:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status:         { type: String, enum: ['running', 'waiting', 'completed', 'stopped', 'cancelled'], default: 'running' },
    note:           { type: String },
    nextRunAt:      { type: Date },
    items: [
      {
        _id:        false,
        number:     { type: String, required: true },
        status:     { type: String, enum: ['pending', 'dialing', 'called', 'failed', 'skipped'], default: 'pending' },
        vapiCallId: { type: String },
        error:      { type: String },
        at:         { type: Date },
      },
    ],
  },
  { timestamps: true },
);

CallBatchSchema.index({ organizationId: 1, createdAt: -1 });

CallBatchSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.__v;
    const items = (ret.items ?? []) as IBatchItem[];
    ret.counts = {
      total:   items.length,
      pending: items.filter((i) => i.status === 'pending' || i.status === 'dialing').length,
      called:  items.filter((i) => i.status === 'called').length,
      failed:  items.filter((i) => i.status === 'failed').length,
      skipped: items.filter((i) => i.status === 'skipped').length,
    };
    return ret;
  },
});

export const CallBatchModel = mongoose.model<ICallBatch>('CallBatch', CallBatchSchema);
