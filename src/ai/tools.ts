import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Zod schemas for validating tool arguments before calling domain services.

export const addInventorySchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  priceIncludesGst: z.boolean().optional(),
  hsn: z.string().optional(),
  gstRate: z.number().nonnegative().optional(),
  cessRate: z.number().nonnegative().optional(),
  quantity: z.number().int().nonnegative().default(0),
  unit: z.string().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
});

export const updateStockSchema = z.object({
  productId: z.string().min(1),
  deltaQuantity: z.number().int(), // can be negative or positive
});

export const getInventorySchema = z.object({
  lowStockOnly: z.boolean().optional(),
});

export const createInvoiceSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  defaultPriceIncludesGst: z.boolean().optional(),
  items: z
    .array(
      z.object({
        productName: z.string().optional(),
        productId: z.string().optional(),
        description: z.string().optional(),
        hsn: z.string().optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive().optional(),
        gstRate: z.number().nonnegative().optional(),
        cessRate: z.number().nonnegative().optional(),
        priceIncludesGst: z.boolean().optional(),
      }),
    )
    .min(1),
  notes: z.string().optional(),
});

export const cancelInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
});

export const markPaymentSchema = z.object({
  invoiceNumber: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(['cash', 'upi', 'card', 'other']).default('cash'),
  reference: z.string().optional(),
});

export type AddInventoryInput = z.infer<typeof addInventorySchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type GetInventoryInput = z.infer<typeof getInventorySchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
export type MarkPaymentInput = z.infer<typeof markPaymentSchema>;

export function toOpenAiToolParameters(schema: unknown): Record<string, unknown> {
  // OpenAI tool calling expects a JSON schema under `parameters`.
  // zod-to-json-schema converts Zod schemas into JSON schema format.
  return zodToJsonSchema(schema as any) as Record<string, unknown>;
}

