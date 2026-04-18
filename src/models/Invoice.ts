import { Schema, model, Document, Types } from 'mongoose';

export interface InvoiceLineItem {
  product?: Types.ObjectId;
  description?: string;
  hsn?: string;
  quantity: number;
  unitPrice: number;
  /** Taxable value for the line (excluding GST, excluding CESS unless you model CESS on taxable base) */
  taxableValue: number;
  gstRate?: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  /** Total GST for the line (cgst+sgst+igst) */
  gstAmount: number;
  total: number;
}

export interface InvoiceDocument extends Document {
  business: Types.ObjectId;
  customer: Types.ObjectId;
  invoiceNumber: string;
  date: Date;
  status: 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
  lineItems: InvoiceLineItem[];
  subtotal: number;
  /** Sum of line taxable values (pre-tax) */
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  tax?: number;
  discount?: number;
  total: number;
  currency: string;
  notes?: string;
  paymentStatus: 'unpaid' | 'paid' | 'partial';
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema<InvoiceLineItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    description: { type: String },
    hsn: { type: String },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    taxableValue: { type: Number, required: true },
    gstRate: { type: Number },
    cgst: { type: Number, required: true, default: 0 },
    sgst: { type: Number, required: true, default: 0 },
    igst: { type: Number, required: true, default: 0 },
    cess: { type: Number, required: true, default: 0 },
    gstAmount: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false },
);

const invoiceSchema = new Schema<InvoiceDocument>(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    invoiceNumber: { type: String, required: true },
    date: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['draft', 'unpaid', 'partially_paid', 'paid', 'cancelled'],
      default: 'unpaid',
    },
    lineItems: { type: [lineItemSchema], required: true },
    subtotal: { type: Number, required: true },
    taxableTotal: { type: Number, required: true, default: 0 },
    cgstTotal: { type: Number, required: true, default: 0 },
    sgstTotal: { type: Number, required: true, default: 0 },
    igstTotal: { type: Number, required: true, default: 0 },
    cessTotal: { type: Number, required: true, default: 0 },
    tax: { type: Number },
    discount: { type: Number },
    total: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    notes: { type: String },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'partial'],
      default: 'unpaid',
    },
  },
  { timestamps: true },
);

invoiceSchema.index({ business: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ business: 1, customer: 1, date: -1 });

export const InvoiceModel = model<InvoiceDocument>('Invoice', invoiceSchema);

