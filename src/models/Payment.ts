import { Schema, model, Document, Types } from 'mongoose';

export interface PaymentDocument extends Document {
  business: Types.ObjectId;
  invoice: Types.ObjectId;
  amount: number;
  date: Date;
  method: 'cash' | 'upi' | 'card' | 'other';
  reference?: string;
  status: 'recorded';
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentDocument>(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ['cash', 'upi', 'card', 'other'],
      default: 'cash',
    },
    reference: { type: String },
    status: { type: String, enum: ['recorded'], default: 'recorded' },
  },
  { timestamps: true },
);

paymentSchema.index({ business: 1, invoice: 1, date: -1 });

export const PaymentModel = model<PaymentDocument>('Payment', paymentSchema);

