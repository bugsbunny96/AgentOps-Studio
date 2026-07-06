/**
 * Call, Transcript, and Summary Mongoose models.
 *
 * Schema spec from Technical-Architecture-Document.md §4.7–4.9.
 *
 * Three separate collections are used so that the parent Call document
 * stays lean for list-view queries. Transcript and Summary are fetched
 * only when the detail view is opened.
 */

import mongoose, { Schema, Document } from 'mongoose';

// ─── Call ────────────────────────────────────────────────────────────────────

export interface ICall extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  vapiCallId: string;
  direction: 'Inbound' | 'Outbound';
  duration: number;       // seconds
  status: 'active' | 'completed' | 'failed';
  callerNumber: string;   // E.164
  recordingUrl?: string;
  cost: number;
  endedReason?: string;   // e.g. 'silence-timed-out', 'hangup', 'customer-ended-call'
  createdAt: Date;
  updatedAt: Date;
}

const CallSchema = new Schema<ICall>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'VoiceAgent',
      required: true,
      index: true,
    },
    vapiCallId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['Inbound', 'Outbound'],
      required: true,
    },
    duration: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'completed', 'failed'],
      default: 'active',
    },
    callerNumber: { type: String, required: true },
    recordingUrl: { type: String },
    cost: { type: Number, default: 0 },
    endedReason: { type: String },
  },
  { timestamps: true },
);

CallSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    ret.organizationId = ret.organizationId?.toString();
    ret.agentId = ret.agentId?.toString();
    delete ret.__v;
    return ret;
  },
});

export const CallModel = mongoose.model<ICall>('Call', CallSchema);

// ─── Transcript ───────────────────────────────────────────────────────────────

export interface ITranscriptTurn {
  speaker: 'agent' | 'user';
  text: string;
  timestamp: Date;
}

export interface ITranscript extends Document {
  _id: mongoose.Types.ObjectId;
  callId: mongoose.Types.ObjectId;
  turns: ITranscriptTurn[];
  createdAt: Date;
  updatedAt: Date;
}

const TranscriptSchema = new Schema<ITranscript>(
  {
    callId: {
      type: Schema.Types.ObjectId,
      ref: 'Call',
      required: true,
      unique: true,
      index: true,
    },
    turns: [
      {
        speaker: { type: String, enum: ['agent', 'user'], required: true },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

TranscriptSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    ret.callId = ret.callId?.toString();
    delete ret.__v;
    return ret;
  },
});

export const TranscriptModel = mongoose.model<ITranscript>('Transcript', TranscriptSchema);

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface ISummary extends Document {
  _id: mongoose.Types.ObjectId;
  callId: mongoose.Types.ObjectId;
  summaryText: string;
  intentDetected: string[];
  actionItems: string[];
  resolutionState: 'Resolved' | 'Transferred' | 'Needs_Followup';
  createdAt: Date;
  updatedAt: Date;
}

const SummarySchema = new Schema<ISummary>(
  {
    callId: {
      type: Schema.Types.ObjectId,
      ref: 'Call',
      required: true,
      unique: true,
      index: true,
    },
    summaryText: { type: String, required: true },
    intentDetected: { type: [String], default: [] },
    actionItems: { type: [String], default: [] },
    resolutionState: {
      type: String,
      enum: ['Resolved', 'Transferred', 'Needs_Followup'],
      default: 'Resolved',
    },
  },
  { timestamps: true },
);

SummarySchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    ret.callId = ret.callId?.toString();
    delete ret.__v;
    return ret;
  },
});

export const SummaryModel = mongoose.model<ISummary>('Summary', SummarySchema);
