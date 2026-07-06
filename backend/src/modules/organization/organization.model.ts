import mongoose, { Schema, Document } from 'mongoose';

// ─── Organization ──────────────────────────────────────────────────────────
export type CrawlStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

export interface IOrganization extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  ownerId: mongoose.Types.ObjectId;
  timezone: string;
  industry: string;
  hasWebsite: boolean;
  crawlEnabled: boolean;
  websiteUrl?: string;
  crawlStatus: CrawlStatus;
  crawlError?: string;
  onboardingStatus:
    | 'REGISTRATION'
    | 'ORG_CREATION'
    | 'WEBSITE_CRAWL'
    | 'BUSINESS_CONFIG'
    | 'VOICE_SETUP'
    | 'COMPLETED';
  agentName?: string;
  businessDescription?: string;
  services: string[];
  faqs: Array<{ question: string; answer: string }>;
  fallbackNumber?: string;
  contactDetails?: { email?: string; phone?: string };
  locations: string[];
  supportedLanguages: string[];
  businessHours: { start: string; end: string };
  vapiAssistantId?: string;
  vapiPhoneNumberId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    industry: { type: String, required: true, default: 'General' },
    hasWebsite: { type: Boolean, default: false },
    crawlEnabled: { type: Boolean, default: false },
    websiteUrl: { type: String, trim: true },
    crawlStatus: {
      type: String,
      enum: ['idle', 'pending', 'processing', 'completed', 'failed'],
      default: 'idle',
    },
    crawlError: { type: String },
    onboardingStatus: {
      type: String,
      enum: ['REGISTRATION', 'ORG_CREATION', 'WEBSITE_CRAWL', 'BUSINESS_CONFIG', 'VOICE_SETUP', 'COMPLETED'],
      default: 'ORG_CREATION',
    },
    agentName: { type: String, trim: true },
    businessDescription: { type: String },
    services: [{ type: String }],
    faqs: [
      {
        question: { type: String },
        answer: { type: String },
      },
    ],
    fallbackNumber: { type: String },
    contactDetails: {
      email: { type: String },
      phone: { type: String },
    },
    locations: [{ type: String }],
    supportedLanguages: { type: [String], default: ['en-US'] },
    businessHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
    },
    vapiAssistantId: { type: String, index: true },
    /**
     * Vapi phone number ID (UUID from Vapi dashboard → Phone Numbers).
     * Used to route inbound calls: Vapi sends assistant-request with this ID
     * and we look up the org to check business hours / return assistant config.
     * Set by founder via Settings → Phone Number Setup.
     */
    vapiPhoneNumberId: { type: String, index: true, sparse: true },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
OrganizationSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    delete ret.__v;
    return ret;
  },
});

export const OrganizationModel = mongoose.model<IOrganization>('Organization', OrganizationSchema);

// ─── Membership ────────────────────────────────────────────────────────────
export interface IMembership extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  role: 'Owner' | 'Admin' | 'Member';
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<IMembership>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    role: { type: String, enum: ['Owner', 'Admin', 'Member'], required: true },
  },
  { timestamps: true }
);

// Prevent duplicate user-org pairs
MembershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const MembershipModel = mongoose.model<IMembership>('Membership', MembershipSchema);

// ─── Invitation ────────────────────────────────────────────────────────────
export interface IInvitation extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  organizationId: mongoose.Types.ObjectId;
  role: 'Admin' | 'Member';
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema = new Schema<IInvitation>(
  {
    email: { type: String, required: true, lowercase: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    role: { type: String, enum: ['Admin', 'Member'], required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index — auto-delete
  },
  { timestamps: true }
);

export const InvitationModel = mongoose.model<IInvitation>('Invitation', InvitationSchema);

// ─── Onboarding Session ────────────────────────────────────────────────────
export interface IOnboardingSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  currentStep: 'Connect' | 'Learn' | 'Configure' | 'Customize' | 'Activate';
  stepStatus: 'NotStarted' | 'InProgress' | 'Blocked' | 'Completed';
  draftPayload: Record<string, unknown>;
  lastCompletedStep?: string;
  resumeToken: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OnboardingSessionSchema = new Schema<IOnboardingSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    currentStep: {
      type: String,
      enum: ['Connect', 'Learn', 'Configure', 'Customize', 'Activate'],
      required: true,
      default: 'Connect',
    },
    stepStatus: {
      type: String,
      enum: ['NotStarted', 'InProgress', 'Blocked', 'Completed'],
      default: 'NotStarted',
    },
    draftPayload: { type: Schema.Types.Mixed, default: {} },
    lastCompletedStep: { type: String },
    resumeToken: { type: String, unique: true, required: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

export const OnboardingSessionModel = mongoose.model<IOnboardingSession>(
  'OnboardingSession',
  OnboardingSessionSchema
);
