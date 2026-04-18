import { Schema, model, Document, Types } from 'mongoose';

export interface UserDocument extends Document {
  phoneE164: string;
  name?: string;
  language: 'en' | 'hi';
  business: Types.ObjectId;
  role: 'owner' | 'staff';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    phoneE164: { type: String, required: true, unique: true },
    name: { type: String },
    language: { type: String, enum: ['en', 'hi'], default: 'en' },
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    role: { type: String, enum: ['owner', 'staff'], default: 'owner' },
  },
  { timestamps: true },
);

export const UserModel = model<UserDocument>('User', userSchema);

