import { Types } from 'mongoose';
import { z } from 'zod';
import {
  addInventorySchema,
  cancelInvoiceSchema,
  createInvoiceSchema,
  getInventorySchema,
  markPaymentSchema,
  updateStockSchema,
} from './tools';
import { InventoryService } from '../domain/inventory/inventory.service';
import { InvoiceService } from '../domain/invoices/invoice.service';
import { PaymentService } from '../domain/payments/payment.service';
import { DomainError } from '../utils/errors';

const inventoryService = new InventoryService();
const invoiceService = new InvoiceService();
const paymentService = new PaymentService();

export async function dispatchToolCall(
  businessId: Types.ObjectId,
  toolName: string,
  rawArgsJson: string,
): Promise<string> {
  let args: unknown;
  try {
    args = JSON.parse(rawArgsJson || '{}');
  } catch {
    return 'Invalid tool arguments (JSON parse failed).';
  }

  try {
    switch (toolName) {
      case 'addInventory': {
        const input = addInventorySchema.parse(args);
        const p = await inventoryService.addProduct(businessId, input);
        const gstBits = [
          p.hsn ? `HSN ${p.hsn}` : null,
          typeof p.gstRate === 'number' ? `GST ${p.gstRate}%` : null,
          typeof p.cessRate === 'number' ? `CESS ${p.cessRate}%` : null,
          `inclusive=${String(p.priceIncludesGst)}`,
        ]
          .filter(Boolean)
          .join(', ');
        return `Added inventory: ${p.name} — qty ${p.quantity}, price ₹${p.price}${gstBits ? ` (${gstBits})` : ''} (id: ${p._id.toString()})`;
      }
      case 'updateStock': {
        const input = updateStockSchema.parse(args);
        const p = await inventoryService.updateStock(businessId, input);
        return `Updated stock: ${p.name} — new qty ${p.quantity}`;
      }
      case 'getInventory': {
        const input = getInventorySchema.parse(args);
        const rows = await inventoryService.getInventory(businessId, input);
        if (!rows.length) return 'Inventory is empty.';
        return rows
          .map((p) => {
            const bits = [
              p.hsn ? `HSN ${p.hsn}` : null,
              typeof p.gstRate === 'number' ? `GST ${p.gstRate}%` : null,
              `incl=${String(p.priceIncludesGst)}`,
            ]
              .filter(Boolean)
              .join(', ');
            return `${p.name}: ${p.quantity} @ ₹${p.price}${bits ? ` (${bits})` : ''}${p.unit ? ` [${p.unit}]` : ''}`;
          })
          .join('\n');
      }
      case 'createInvoice': {
        const input = createInvoiceSchema.parse(args);
        const inv = await invoiceService.createInvoice(businessId, input);
        const lines = inv.lines
          .map((l) => {
            const bits = [
              l.hsn ? `HSN ${l.hsn}` : null,
              typeof l.gstRate === 'number' ? `GST ${l.gstRate}%` : null,
              `taxable ₹${l.taxable}`,
              `CGST ₹${l.cgst} SGST ₹${l.sgst}`,
              l.cess ? `CESS ₹${l.cess}` : null,
            ]
              .filter(Boolean)
              .join(', ');
            return `- ${l.name} x${l.qty} @ ₹${l.unitPrice} => ₹${l.lineTotal} (${bits})`;
          })
          .join('\n');
        return [
          `Invoice ${inv.invoiceNumber} created for ${inv.customerName}.`,
          `Taxable: ₹${inv.taxableTotal} | GST: ₹${inv.gstTotal} | CESS: ₹${inv.cessTotal}`,
          `CGST: ₹${inv.cgstTotal} | SGST: ₹${inv.sgstTotal} | IGST: ₹${inv.igstTotal}`,
          `Total: ₹${inv.total} (${inv.currency})`,
          lines,
          'Status: UNPAID',
        ].join('\n');
      }
      case 'cancelInvoice': {
        const input = cancelInvoiceSchema.parse(args);
        const res = await invoiceService.cancelInvoice(businessId, input);
        return res.restored
          ? `Invoice ${res.invoiceNumber} cancelled. Stock restored where applicable.`
          : `Invoice ${res.invoiceNumber} is already cancelled.`;
      }
      case 'markPayment': {
        const input = markPaymentSchema.parse(args);
        const res = await paymentService.markPayment(businessId, input);
        return `Payment recorded for ${res.invoiceNumber}: ₹${res.amountRecorded} (${input.method}).\nTotal paid: ₹${res.totalPaid} / ₹${res.invoiceTotal}\nStatus: ${res.paymentStatus.toUpperCase()}`;
      }
      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return `Invalid arguments: ${err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`;
    }
    if (err instanceof DomainError) {
      return err.message;
    }
    return `Error: ${err?.message || 'unknown error'}`;
  }
}
