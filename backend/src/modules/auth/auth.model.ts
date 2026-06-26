import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  status: 'Active' | 'Suspended' | 'Pending';
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string; // stored as sha256 hash
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['Active', 'Suspended', 'Pending'],
      default: 'Pending',
    },
    // Email verification (raw token sent in email; stored in plaintext — no sensitive data)
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    // Password reset (raw token sent in email; stored as sha256 hash for security)
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// Never return sensitive fields in JSON responses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
UserSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    delete ret.passwordHash;
    delete ret.emailVerificationToken;
    delete ret.emailVerificationExpires;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  },
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);
