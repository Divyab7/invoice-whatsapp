import { ClientSession, Types } from 'mongoose';
import { InvoiceModel, InvoiceDocument } from '../models/Invoice';

export class InvoiceRepository {
  async create(invoice: Partial<InvoiceDocument>, session?: ClientSession): Promise<InvoiceDocument> {
    return InvoiceModel.create([invoice], { session }).then((docs) => docs[0]!);
  }

  async findByInvoiceNumberForBusiness(
    businessId: Types.ObjectId,
    invoiceNumber: string,
    session?: ClientSession,
  ): Promise<InvoiceDocument | null> {
    return InvoiceModel.findOne({ business: businessId, invoiceNumber }).session(session ?? null);
  }

  async updatePaymentFields(
    businessId: Types.ObjectId,
    invoiceId: Types.ObjectId,
    fields: {
      status: InvoiceDocument['status'];
      paymentStatus: InvoiceDocument['paymentStatus'];
    },
    session?: ClientSession,
  ): Promise<InvoiceDocument | null> {
    return InvoiceModel.findOneAndUpdate(
      { _id: invoiceId, business: businessId },
      { $set: fields },
      { new: true, session },
    );
  }

  async updateFields(
    businessId: Types.ObjectId,
    invoiceId: Types.ObjectId,
    fields: Partial<InvoiceDocument>,
    session?: ClientSession,
  ): Promise<InvoiceDocument | null> {
    return InvoiceModel.findOneAndUpdate({ _id: invoiceId, business: businessId }, { $set: fields }, { new: true, session });
  }

  async nextInvoiceNumber(businessId: Types.ObjectId, session?: ClientSession): Promise<string> {
    const last = await InvoiceModel.find({ business: businessId })
      .sort({ createdAt: -1 })
      .limit(1)
      .session(session ?? null);

    if (!last[0]) return 'INV-0001';

    const match = /^INV-(\d+)$/.exec(last[0].invoiceNumber);
    if (!match) {
      // If existing data doesn't match pattern, still generate a safe next number based on count.
      const count = await InvoiceModel.countDocuments({ business: businessId }).session(session ?? null);
      return `INV-${String(count + 1).padStart(4, '0')}`;
    }

    const n = Number(match[1]);
    return `INV-${String(n + 1).padStart(4, '0')}`;
  }
}
