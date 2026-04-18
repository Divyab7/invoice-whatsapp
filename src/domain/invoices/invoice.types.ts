export type CreateInvoiceLineInput = {
  productId?: string;
  productName?: string;
  description?: string;
  hsn?: string;
  quantity: number;
  unitPrice?: number;
  gstRate?: number;
  cessRate?: number;
  /**
   * Overrides product default for whether `unitPrice` is GST-inclusive.
   * If omitted, uses product.priceIncludesGst (defaults to inclusive).
   */
  priceIncludesGst?: boolean;
};

export type CreateInvoiceInput = {
  customerName: string;
  customerPhone?: string;
  items: CreateInvoiceLineInput[];
  notes?: string;
  /**
   * Default pricing interpretation for lines that don't specify `priceIncludesGst`.
   * If omitted, falls back per-product (defaults to inclusive).
   */
  defaultPriceIncludesGst?: boolean;
};

export type CancelInvoiceInput = {
  invoiceNumber: string;
};
