import { Schema, model, Document, Types } from 'mongoose';

export interface CustomerDocument extends Document {
  business: Types.ObjectId;
  name: string;
  phone?: string;
  gstNumber?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<CustomerDocument>(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true },
    phone: { type: String },
    gstNumber: { type: String },
    address: { type: String },
  },
  { timestamps: true },
);

customerSchema.index({ business: 1, name: 1 });

export const CustomerModel = model<CustomerDocument>('Customer', customerSchema);

