import { ClientSession, Types } from 'mongoose';
import { MarkPaymentInput } from './payment.types';
import { InvoiceRepository } from '../../repositories/invoice.repository';
import { PaymentRepository } from '../../repositories/payment.repository';
import { NotFoundError, ValidationError } from '../../utils/errors';

export class PaymentService {
  constructor(
    private readonly invoices = new InvoiceRepository(),
    private readonly payments = new PaymentRepository(),
  ) {}

  async markPayment(businessId: Types.ObjectId, input: MarkPaymentInput, session?: ClientSession) {
    const invoice = await this.invoices.findByInvoiceNumberForBusiness(businessId, input.invoiceNumber, session);
    if (!invoice) {
      throw new NotFoundError(`Invoice not found: ${input.invoiceNumber}`);
    }

    if (invoice.status === 'cancelled') {
      throw new ValidationError('Cannot record payment for a cancelled invoice');
    }

    await this.payments.create(
      {
        businessId,
        invoiceId: invoice._id as Types.ObjectId,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
      },
      session,
    );

    const totalPaid = await this.payments.sumPaymentsForInvoice(businessId, invoice._id as Types.ObjectId, session);

    const invoiceTotal = invoice.total;
    const eps = 0.0001;

    let paymentStatus: typeof invoice.paymentStatus = 'unpaid';
    let status: typeof invoice.status = invoice.status;

    if (totalPaid + eps >= invoiceTotal) {
      paymentStatus = 'paid';
      status = 'paid';
    } else if (totalPaid > eps) {
      paymentStatus = 'partial';
      status = 'partially_paid';
    } else {
      paymentStatus = 'unpaid';
      status = 'unpaid';
    }

    await this.invoices.updatePaymentFields(
      businessId,
      invoice._id as Types.ObjectId,
      { status, paymentStatus },
      session,
    );

    return {
      invoiceNumber: invoice.invoiceNumber,
      amountRecorded: input.amount,
      totalPaid,
      invoiceTotal,
      paymentStatus,
      invoiceStatus: status,
    };
  }
}
