import mongoose, { Schema, Document } from 'mongoose';

// ─── Organization ──────────────────────────────────────────────────────────
export type CrawlStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
export type Plan = 'free' | 'starter' | 'growth' | 'enterprise';

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
  preferredVoiceProvider?: string;
  preferredVoiceId?: string;
  // ── Crawl tracking ───────────────────────────────────────────────────
  /** Timestamp of the last successfully completed crawl — enforces 30-day re-sync cooldown. */
  lastCrawledAt?: Date;
  // ── Billing ──────────────────────────────────────────────────────────
  plan: Plan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
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
     * Voice provider + voice ID chosen during onboarding Customize step.
     * Consumed by provisionAgent() so the Vapi assistant is created with the
     * user's preferred voice, not the hardcoded default.
     */
    preferredVoiceProvider: { type: String },
    preferredVoiceId: { type: String },
    /**
     * Vapi phone number ID (UUID from Vapi dashboard → Phone Numbers).
     * Used to route inbound calls: Vapi sends assistant-request with this ID
     * and we look up the org to check business hours / return assistant config.
     * Set by founder via Settings → Phone Number Setup.
     */
    vapiPhoneNumberId: { type: String, index: true, sparse: true },
    // ── Crawl tracking ─────────────────────────────────────────────────
    lastCrawledAt: { type: Date },
    // ── Billing ────────────────────────────────────────────────────────
    plan: {
      type:    String,
      enum:    ['free', 'starter', 'growth', 'enterprise'],
      default: 'free',
    },
    stripeCustomerId:     { type: String, index: true, sparse: true },
    stripeSubscriptionId: { type: String, index: true, sparse: true },
    stripePriceId:        { type: String },
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

// ─── Member Permissions ────────────────────────────────────────────────────
// Granular access flags for Members. Owners always have full access.
// Dashboard is always visible to all Members regardless of these flags.
// Settings is always Owner-only and not represented here.
// team: false = Team page hidden; true = Member can view & manage the Team page.
export interface IMemberPermissions {
  agents:        boolean; // Agents page — false: read-only, true: full access
  calls:         boolean; // Calls page  — false: read-only, true: full access
  knowledgeBase: boolean; // KB page     — false: read-only, true: full access
  team:          boolean; // Team page   — false: hidden,    true: full management access
}

export const DEFAULT_MEMBER_PERMISSIONS: IMemberPermissions = {
  agents:        true,
  calls:         true,
  knowledgeBase: true,
  team:          false, // Team management is off by default for new invites
};

const MemberPermissionsSchema = {
  agents:        { type: Boolean, default: true  },
  calls:         { type: Boolean, default: true  },
  knowledgeBase: { type: Boolean, default: true  },
  team:          { type: Boolean, default: false },
};

// ─── Membership ────────────────────────────────────────────────────────────
export interface IMembership extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  role: 'Owner' | 'Member';
  permissions: IMemberPermissions; // Only meaningful for Members; Owners always have full access
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
    role: { type: String, enum: ['Owner', 'Member'], required: true },
    permissions: { type: MemberPermissionsSchema, default: () => ({ ...DEFAULT_MEMBER_PERMISSIONS }) },
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
  role: 'Member';
  permissions: IMemberPermissions; // Permissions that will be copied to the membership on accept
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema = new Schema<IInvitation>(
  {
    email: { type: String, required: true, lowercase: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    role: { type: String, enum: ['Member'], required: true },
    permissions: { type: MemberPermissionsSchema, default: () => ({ ...DEFAULT_MEMBER_PERMISSIONS }) },
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
