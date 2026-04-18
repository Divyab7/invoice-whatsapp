import { ClientSession, Types } from 'mongoose';
import { PaymentModel, PaymentDocument } from '../models/Payment';

export class PaymentRepository {
  async countForInvoice(
    businessId: Types.ObjectId,
    invoiceId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<number> {
    return PaymentModel.countDocuments({ business: businessId, invoice: invoiceId }).session(session ?? null);
  }

  async sumPaymentsForInvoice(
    businessId: Types.ObjectId,
    invoiceId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<number> {
    const agg = await PaymentModel.aggregate<{ total: number }>(
      [
        { $match: { business: businessId, invoice: invoiceId } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ],
      { session },
    );

    return agg[0]?.total ?? 0;
  }

  async create(
    input: {
      businessId: Types.ObjectId;
      invoiceId: Types.ObjectId;
      amount: number;
      method: PaymentDocument['method'];
      reference?: string;
    },
    session?: ClientSession,
  ): Promise<PaymentDocument> {
    return PaymentModel.create(
      [
        {
          business: input.businessId,
          invoice: input.invoiceId,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
          status: 'recorded',
        },
      ],
      { session },
    ).then((docs) => docs[0]!);
  }
}
