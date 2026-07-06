import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceAgent extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  systemPrompt: string;
  vapiAssistantId: string;
  voiceProvider: 'openai' | 'elevenlabs' | 'cartesia' | 'azure';
  voiceId: string;
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
      enum: ['openai', 'elevenlabs', 'cartesia', 'azure'],
      default: 'openai',
    },
    voiceId: { type: String, default: 'nova' },
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
