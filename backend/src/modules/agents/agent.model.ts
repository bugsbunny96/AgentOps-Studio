import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceAgent extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  systemPrompt: string;
  vapiAssistantId: string;

  // ── Voice provider ────────────────────────────────────────────────────────────
  /**
   * TTS voice provider.
   * 'vapi'         → Vapi native voices (e.g. Naina V2)
   * 'custom-voice' → Custom TTS bridge (e.g. Sarvam Bulbul v3 via tts-bridge service)
   */
  voiceProvider: 'openai' | 'elevenlabs' | 'deepgram' | 'cartesia' | 'playht' | 'azure' | 'vapi' | 'custom-voice';
  voiceId: string;
  /** Version string for Vapi native voices, e.g. '2' for Naina V2 */
  voiceVersion?: string;

  // ── Transcriber config ────────────────────────────────────────────────────────
  /** STT provider — defaults to Deepgram */
  transcriberProvider: 'deepgram' | 'assembly-ai';
  /** Transcriber model, e.g. 'nova-3' */
  transcriberModel: string;
  /**
   * Transcriber language code.
   * Use 'multi' for Deepgram multi-language (English + Hindi detection).
   */
  transcriberLanguage: string;

  // ── Vapi tool & schema IDs ────────────────────────────────────────────────────
  /** Vapi pre-attached server tool IDs (e.g. end_call, submit_order) */
  vapiToolIds: string[];
  /** Vapi structured output schema ID for this agent's call summary */
  vapiStructuredOutputId?: string;

  primaryLanguage: string;
  supportedLanguages: string[];
  status: 'Active' | 'Inactive';
  createdAt: Date;
  updatedAt: Date;
}

const VoiceAgentSchema = new Schema<IVoiceAgent>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
      unique: true,   // one agent per org during onboarding
    },
    name: { type: String, required: true, trim: true },
    systemPrompt: { type: String, required: true },
    vapiAssistantId: { type: String, required: true, index: true },

    voiceProvider: {
      type: String,
      enum: ['openai', 'elevenlabs', 'deepgram', 'cartesia', 'playht', 'azure', 'vapi', 'custom-voice'],
      default: 'openai',
    },
    voiceId: { type: String, default: 'nova' },
    voiceVersion: { type: String },

    transcriberProvider: {
      type: String,
      enum: ['deepgram', 'assembly-ai'],
      default: 'deepgram',
    },
    transcriberModel: { type: String, default: 'nova-3' },
    transcriberLanguage: { type: String, default: 'multi' },

    vapiToolIds: { type: [String], default: [] },
    vapiStructuredOutputId: { type: String },

    primaryLanguage: { type: String, default: 'en-US' },
    supportedLanguages: { type: [String], default: ['en-US'] },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true },
);

VoiceAgentSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const VoiceAgentModel = mongoose.model<IVoiceAgent>('VoiceAgent', VoiceAgentSchema);
