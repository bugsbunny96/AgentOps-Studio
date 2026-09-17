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

/** One item from the structuredDataOutput.products_discussed array */
export interface IProductDiscussed {
  category: string;
  item: string;
  qty: number | null;
  unitPriceQuoted: number | null;
}

/** Delivery address collected during the call */
export interface IDeliveryAddress {
  line1: string | null;
  city: string | null;
  pincode: string | null;
}

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

  // ── Structured output from Vapi artifactPlan (electrical-shop-call-summary schema) ──
  /** Languages detected during the call, from Vapi structuredDataOutput */
  languageUsed?: Array<'hi' | 'en' | 'mixed'>;
  /** Primary call intent, from Vapi structuredDataOutput */
  intent?: 'product_inquiry' | 'order' | 'order_status_check' | 'complaint' | 'other';
  /** Products discussed during the call */
  productsDiscussed?: IProductDiscussed[];
  /** Whether the caller requested to place an order */
  orderRequested?: boolean;
  /** How the order will be fulfilled */
  fulfillmentType?: 'pickup' | 'delivery' | 'not_applicable';
  /** Delivery address (only present when fulfillmentType is 'delivery') */
  deliveryAddress?: IDeliveryAddress | null;
  /** Caller's preferred delivery window, if provided */
  preferredDeliveryWindow?: string | null;
  /** Total order amount in INR; null if no order was placed */
  totalAmount?: number | null;
  /** Whether the agent read back order details and the caller confirmed */
  customerConfirmedReadback?: boolean;
  /** Whether the call needs a human follow-up */
  followUpNeeded?: boolean;
  /** Reason for follow-up, if applicable */
  followUpReason?: string | null;
  /** One-line call summary from structured output (for shop owner dashboard) */
  callSummaryStructured?: string;

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

    // ── Structured output fields (from Vapi artifactPlan / structuredDataOutput) ──
    languageUsed: { type: [String], enum: ['hi', 'en', 'mixed'], default: undefined },
    intent: {
      type: String,
      enum: ['product_inquiry', 'order', 'order_status_check', 'complaint', 'other'],
    },
    productsDiscussed: {
      type: [
        {
          category:       { type: String },
          item:           { type: String },
          qty:            { type: Number, default: null },
          unitPriceQuoted:{ type: Number, default: null },
        },
      ],
      default: undefined,
    },
    orderRequested:            { type: Boolean, default: false },
    fulfillmentType: {
      type: String,
      enum: ['pickup', 'delivery', 'not_applicable'],
    },
    deliveryAddress: {
      type: {
        line1:   { type: String, default: null },
        city:    { type: String, default: null },
        pincode: { type: String, default: null },
      },
      default: null,
    },
    preferredDeliveryWindow:   { type: String, default: null },
    totalAmount:               { type: Number, default: null },
    customerConfirmedReadback: { type: Boolean, default: false },
    followUpNeeded:            { type: Boolean, default: false },
    followUpReason:            { type: String, default: null },
    callSummaryStructured:     { type: String },
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
  /** Org that owns this transcript — required for tenant-scoped text search. */
  organizationId?: mongoose.Types.ObjectId;
  turns: ITranscriptTurn[];
  /**
   * Denormalised concatenation of all turn texts, e.g.:
   *   "AGENT: Hello, how can I help?\nUSER: I need to book an appointment\n..."
   *
   * Populated by the webhook service when the call ends.
   * Carries a MongoDB text index — used by GET /api/v1/calls/search.
   */
  fullText?: string;
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
    // Not required — existing documents (pre-search feature) won't have this field.
    // Set by webhook service on every new call going forward.
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    turns: [
      {
        speaker: { type: String, enum: ['agent', 'user'], required: true },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    // Denormalised full-text string. Optional — absent on pre-feature transcripts.
    fullText: { type: String, select: false }, // excluded by default; use .select('+fullText') when needed
  },
  { timestamps: true },
);

// ── Text index for full-text search ─────────────────────────────────────────
// One text index per collection is the MongoDB limit.
// 'none' language disables stemming — exact/phrase matching works better for
// call transcripts which contain domain-specific vocabulary and proper nouns.
TranscriptSchema.index(
  { fullText: 'text' },
  {
    name: 'transcript_fulltext_idx',
    default_language: 'none',
    language_override: 'searchLanguage', // points to a non-existent field → all docs use 'none'
  },
);

// ── Compound index to efficiently list/count results scoped to an org ────────
TranscriptSchema.index({ organizationId: 1, createdAt: -1 });

TranscriptSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    ret.callId = ret.callId?.toString();
    if (ret.organizationId) ret.organizationId = ret.organizationId.toString();
    delete ret.__v;
    delete ret.fullText; // never leak the raw fullText in API responses
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
