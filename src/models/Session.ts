import { Schema, model, Document } from 'mongoose';

export interface SessionDocument extends Document {
  phoneE164: string;
  otp?: string;
  otpExpiresAt?: Date;
  conversationContext?: Record<string, unknown>;
  status: 'pending_verification' | 'verified';
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    phoneE164: { type: String, required: true },
    otp: { type: String },
    otpExpiresAt: { type: Date },
    conversationContext: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['pending_verification', 'verified'],
      default: 'pending_verification',
    },
  },
  { timestamps: true },
);

sessionSchema.index({ phoneE164: 1, status: 1 });

export const SessionModel = model<SessionDocument>('Session', sessionSchema);

