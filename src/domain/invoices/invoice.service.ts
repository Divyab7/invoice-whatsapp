import { ClientSession, Types } from 'mongoose';
import mongoose from 'mongoose';
import { CancelInvoiceInput, CreateInvoiceInput } from './invoice.types';
import { ProductRepository } from '../../repositories/product.repository';
import { CustomerRepository } from '../../repositories/customer.repository';
import { InvoiceRepository } from '../../repositories/invoice.repository';
import { PaymentRepository } from '../../repositories/payment.repository';
import { ValidationError } from '../../utils/errors';
import type { InvoiceLineItem } from '../../models/Invoice';
import { computeLineGstIndia } from '../../utils/gst';

type ResolvedLine = {
  productId: Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: number;
  hsn?: string;
  gstRate?: number;
  cessRate?: number;
  priceIncludesGst: boolean;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gstAmount: number;
  total: number;
  description?: string;
};

export class InvoiceService {
  constructor(
    private readonly products = new ProductRepository(),
    private readonly customers = new CustomerRepository(),
    private readonly invoices = new InvoiceRepository(),
    private readonly payments = new PaymentRepository(),
  ) {}

  async createInvoice(businessId: Types.ObjectId, input: CreateInvoiceInput): Promise<{
    invoiceNumber: string;
    customerName: string;
    total: number;
    currency: string;
    taxableTotal: number;
    cgstTotal: number;
    sgstTotal: number;
    igstTotal: number;
    cessTotal: number;
    gstTotal: number;
    lines: {
      name: string;
      qty: number;
      unitPrice: number;
      hsn?: string;
      gstRate?: number;
      taxable: number;
      cgst: number;
      sgst: number;
      cess: number;
      lineTotal: number;
    }[];
  }> {
    const resolvedLines = await this.resolveLines(businessId, input.items, input.defaultPriceIncludesGst);

    const run = async (session?: ClientSession) => {
      const decremented: { productId: Types.ObjectId; qty: number }[] = [];

      // Decrement inventory first (atomic checks per line).
      for (const line of resolvedLines) {
        const updated = await this.products.decrementStockIfPossible(businessId, line.productId, line.quantity, session);
        if (!updated) {
          // Roll back prior decrements for this attempt.
          for (const d of decremented) {
            await this.products.incrementStock(businessId, d.productId, d.qty, session);
          }
          throw new ValidationError(
            `Insufficient stock for "${line.productName}" (need ${line.quantity}).`,
          );
        }
        decremented.push({ productId: line.productId, qty: line.quantity });
      }

      const customer =
        (await this.customers.findByNameCaseInsensitive(businessId, input.customerName.trim(), session)) ??
        (await this.customers.create(
          {
            businessId,
            name: input.customerName.trim(),
            phone: input.customerPhone?.trim(),
          },
          session,
        ));

      const invoiceNumber = await this.invoices.nextInvoiceNumber(businessId, session);

      const lineItems: InvoiceLineItem[] = resolvedLines.map((l) => ({
        product: l.productId,
        description: l.description ?? l.productName,
        hsn: l.hsn,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxableValue: l.taxableValue,
        gstRate: l.gstRate,
        cgst: l.cgst,
        sgst: l.sgst,
        igst: l.igst,
        cess: l.cess,
        gstAmount: l.gstAmount,
        total: l.total,
      }));

      const taxableTotal = roundMoney(resolvedLines.reduce((sum, l) => sum + l.taxableValue, 0));
      const cgstTotal = roundMoney(resolvedLines.reduce((sum, l) => sum + l.cgst, 0));
      const sgstTotal = roundMoney(resolvedLines.reduce((sum, l) => sum + l.sgst, 0));
      const igstTotal = roundMoney(resolvedLines.reduce((sum, l) => sum + l.igst, 0));
      const cessTotal = roundMoney(resolvedLines.reduce((sum, l) => sum + l.cess, 0));
      const gstTotal = roundMoney(resolvedLines.reduce((sum, l) => sum + l.gstAmount, 0));

      const subtotal = roundMoney(resolvedLines.reduce((sum, l) => sum + l.total, 0));
      const total = subtotal;

      try {
        await this.invoices.create(
          {
            business: businessId,
            customer: customer._id,
            invoiceNumber,
            status: 'unpaid',
            lineItems,
            subtotal,
            taxableTotal,
            cgstTotal,
            sgstTotal,
            igstTotal,
            cessTotal,
            tax: gstTotal + cessTotal,
            total,
            currency: 'INR',
            notes: input.notes,
            paymentStatus: 'unpaid',
          },
          session,
        );
      } catch (err) {
        // Compensate inventory decrements if invoice persistence fails.
        for (const d of decremented) {
          await this.products.incrementStock(businessId, d.productId, d.qty, session);
        }
        throw err;
      }

      return {
        invoiceNumber,
        customerName: customer.name,
        total,
        currency: 'INR',
        taxableTotal,
        cgstTotal,
        sgstTotal,
        igstTotal,
        cessTotal,
        gstTotal,
        lines: resolvedLines.map((l) => ({
          name: l.productName,
          qty: l.quantity,
          unitPrice: l.unitPrice,
          hsn: l.hsn,
          gstRate: l.gstRate,
          taxable: l.taxableValue,
          cgst: l.cgst,
          sgst: l.sgst,
          cess: l.cess,
          lineTotal: l.total,
        })),
      };
    };

    // Prefer a transaction when supported by the deployment.
    try {
      const session = await mongoose.startSession();
      try {
        return await session.withTransaction(() => run(session));
      } finally {
        await session.endSession();
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const txnUnsupported =
        msg.includes('Transaction numbers are only allowed on a replica set member') ||
        msg.includes('replica set') ||
        msg.includes('Transactions are not supported');

      if (txnUnsupported) {
        return await run(undefined);
      }
      throw e;
    }
  }

  async cancelInvoice(businessId: Types.ObjectId, input: CancelInvoiceInput) {
    const run = async (session?: ClientSession) => {
      const invoice = await this.invoices.findByInvoiceNumberForBusiness(businessId, input.invoiceNumber, session);
      if (!invoice) {
        throw new ValidationError(`Invoice not found: ${input.invoiceNumber}`);
      }

      if (invoice.status === 'cancelled') {
        return { invoiceNumber: invoice.invoiceNumber, status: 'cancelled' as const, restored: false };
      }

      const paymentCount = await this.payments.countForInvoice(businessId, invoice._id as Types.ObjectId, session);
      if (paymentCount > 0) {
        throw new ValidationError('Cannot cancel an invoice that already has payments recorded.');
      }

      if (invoice.paymentStatus === 'paid' || invoice.status === 'paid' || invoice.status === 'partially_paid') {
        throw new ValidationError('Cannot cancel a paid/partially-paid invoice. Record a reversal/adjustment instead.');
      }

      // Restore stock for product lines based on quantities stored on the invoice.
      for (const line of invoice.lineItems) {
        if (!line.product) continue;
        if (!line.quantity) continue;
        await this.products.incrementStock(businessId, line.product as Types.ObjectId, line.quantity, session);
      }

      await this.invoices.updateFields(
        businessId,
        invoice._id as Types.ObjectId,
        {
          status: 'cancelled',
          paymentStatus: 'unpaid',
          subtotal: 0,
          taxableTotal: 0,
          cgstTotal: 0,
          sgstTotal: 0,
          igstTotal: 0,
          cessTotal: 0,
          tax: 0,
          discount: 0,
          total: 0,
        },
        session,
      );

      return { invoiceNumber: invoice.invoiceNumber, status: 'cancelled' as const, restored: true };
    };

    try {
      const session = await mongoose.startSession();
      try {
        return await session.withTransaction(() => run(session));
      } finally {
        await session.endSession();
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const txnUnsupported =
        msg.includes('Transaction numbers are only allowed on a replica set member') ||
        msg.includes('replica set') ||
        msg.includes('Transactions are not supported');

      if (txnUnsupported) {
        return await run(undefined);
      }
      throw e;
    }
  }

  private async resolveLines(
    businessId: Types.ObjectId,
    items: CreateInvoiceInput['items'],
    defaultPriceIncludesGst?: boolean,
  ): Promise<ResolvedLine[]> {
    const ambiguous: string[] = [];
    const missingPrice: string[] = [];

    const resolved: ResolvedLine[] = [];

    for (const item of items) {
      if (!item.productId && !item.productName) {
        throw new ValidationError('Each invoice item must include productId or productName.');
      }

      let productId: Types.ObjectId | null = null;
      let productName = '';

      if (item.productId) {
        if (!Types.ObjectId.isValid(item.productId)) {
          throw new ValidationError(`Invalid productId: ${item.productId}`);
        }
        productId = new Types.ObjectId(item.productId);
        const p = await this.products.findByIdForBusiness(businessId, productId);
        if (!p) {
          throw new ValidationError(`Unknown productId: ${item.productId}`);
        }
        productName = p.name;

        const unitPrice = item.unitPrice ?? p.price;
        if (!unitPrice || unitPrice <= 0) {
          missingPrice.push(productName);
          continue;
        }

        const gstRate = item.gstRate ?? p.gstRate;
        const cessRate = item.cessRate ?? p.cessRate;
        const hsn = item.hsn ?? p.hsn;
        const priceIncludesGst =
          item.priceIncludesGst ?? defaultPriceIncludesGst ?? p.priceIncludesGst ?? true;

        const tax = computeLineGstIndia({
          quantity: item.quantity,
          unitPrice,
          gstRate,
          cessRate,
          priceIncludesGst,
        });

        resolved.push({
          productId,
          productName,
          quantity: item.quantity,
          unitPrice,
          hsn,
          gstRate,
          cessRate,
          priceIncludesGst,
          taxableValue: tax.taxableValue,
          cgst: tax.cgst,
          sgst: tax.sgst,
          igst: tax.igst,
          cess: tax.cess,
          gstAmount: tax.gstAmount,
          total: tax.lineTotal,
          description: item.description,
        });
      } else if (item.productName) {
        const matches = await this.products.findActiveByNameCaseInsensitive(businessId, item.productName.trim());
        if (matches.length === 0) {
          throw new ValidationError(`Unknown product name: "${item.productName}". Add it to inventory first.`);
        }
        if (matches.length > 1) {
          ambiguous.push(item.productName.trim());
          continue;
        }

        const p = matches[0]!;
        productId = p._id as Types.ObjectId;
        productName = p.name;

        const unitPrice = item.unitPrice ?? p.price;
        if (!unitPrice || unitPrice <= 0) {
          missingPrice.push(productName);
          continue;
        }

        const gstRate = item.gstRate ?? p.gstRate;
        const cessRate = item.cessRate ?? p.cessRate;
        const hsn = item.hsn ?? p.hsn;
        const priceIncludesGst =
          item.priceIncludesGst ?? defaultPriceIncludesGst ?? p.priceIncludesGst ?? true;

        const tax = computeLineGstIndia({
          quantity: item.quantity,
          unitPrice,
          gstRate,
          cessRate,
          priceIncludesGst,
        });

        resolved.push({
          productId,
          productName,
          quantity: item.quantity,
          unitPrice,
          hsn,
          gstRate,
          cessRate,
          priceIncludesGst,
          taxableValue: tax.taxableValue,
          cgst: tax.cgst,
          sgst: tax.sgst,
          igst: tax.igst,
          cess: tax.cess,
          gstAmount: tax.gstAmount,
          total: tax.lineTotal,
          description: item.description,
        });
      }
    }

    if (ambiguous.length) {
      throw new ValidationError(
        `Ambiguous product name(s): ${ambiguous
          .map((n) => `"${n}"`)
          .join(', ')}. Please specify productId, or use a more specific name.`,
      );
    }

    if (missingPrice.length) {
      throw new ValidationError(
        `Missing unitPrice for: ${missingPrice.map((n) => `"${n}"`).join(', ')} (and product has no price set).`,
      );
    }

    return mergeResolvedLines(resolved);
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function mergeResolvedLines(lines: ResolvedLine[]): ResolvedLine[] {
  const map = new Map<string, ResolvedLine>();

  for (const line of lines) {
    const key = [
      line.productId.toString(),
      String(line.gstRate ?? ''),
      String(line.cessRate ?? ''),
      String(line.priceIncludesGst),
      String(line.unitPrice),
    ].join('|');
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...line });
      continue;
    }

    const qty = existing.quantity + line.quantity;
    const tax = computeLineGstIndia({
      quantity: qty,
      unitPrice: existing.unitPrice,
      gstRate: existing.gstRate,
      cessRate: existing.cessRate,
      priceIncludesGst: existing.priceIncludesGst,
    });
    map.set(key, {
      ...existing,
      quantity: qty,
      taxableValue: tax.taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      cess: tax.cess,
      gstAmount: tax.gstAmount,
      total: tax.lineTotal,
    });
  }

  return Array.from(map.values());
}
