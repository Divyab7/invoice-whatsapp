import { Schema, model, Document, Types } from 'mongoose';

export interface BusinessDocument extends Document {
  name: string;
  gstNumber?: string;
  address?: string;
  currency: string;
  defaultLanguage: 'en' | 'hi';
  owner?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const businessSchema = new Schema<BusinessDocument>(
  {
    name: { type: String, required: true },
    gstNumber: { type: String },
    address: { type: String },
    currency: { type: String, default: 'INR' },
    defaultLanguage: { type: String, enum: ['en', 'hi'], default: 'en' },
    owner: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const BusinessModel = model<BusinessDocument>('Business', businessSchema);

