import { Schema, model, Document, Types } from 'mongoose';

export interface AiInteractionLogDocument extends Document {
  user?: Types.ObjectId;
  business?: Types.ObjectId;
  rawMessage: string;
  toolsInvoked: { name: string; arguments: Record<string, unknown> }[];
  resultSummary?: string;
  error?: string | null;
  createdAt: Date;
}

const aiInteractionLogSchema = new Schema<AiInteractionLogDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    business: { type: Schema.Types.ObjectId, ref: 'Business' },
    rawMessage: { type: String, required: true },
    toolsInvoked: [
      {
        name: { type: String, required: true },
        arguments: { type: Schema.Types.Mixed, required: true },
      },
    ],
    resultSummary: { type: String },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiInteractionLogSchema.index({ business: 1, createdAt: -1 });

export const AiInteractionLogModel = model<AiInteractionLogDocument>(
  'AiInteractionLog',
  aiInteractionLogSchema,
);

