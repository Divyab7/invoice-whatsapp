import { Schema, model, Document, Types } from 'mongoose';

export interface ProductDocument extends Document {
  business: Types.ObjectId;
  name: string;
  sku?: string;
  price: number;
  /**
   * If true, `price` is treated as GST-inclusive for sales/invoicing math unless overridden per invoice line.
   * Default true for typical Indian retail sticker/MRP style pricing.
   */
  priceIncludesGst: boolean;
  hsn?: string;
  /** GST rate percentage, e.g. 5 for 5% */
  gstRate?: number;
  /** Optional CESS rate percentage (applied on taxable value; kept separate from GST split) */
  cessRate?: number;
  quantity: number;
  unit?: string;
  lowStockThreshold?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDocument>(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true },
    sku: { type: String },
    price: { type: Number, required: true },
    priceIncludesGst: { type: Boolean, default: true },
    hsn: { type: String },
    gstRate: { type: Number },
    cessRate: { type: Number },
    quantity: { type: Number, required: true, default: 0 },
    unit: { type: String },
    lowStockThreshold: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ business: 1, name: 1 });
productSchema.index({ business: 1, sku: 1 }, { unique: true, sparse: true });

export const ProductModel = model<ProductDocument>('Product', productSchema);

