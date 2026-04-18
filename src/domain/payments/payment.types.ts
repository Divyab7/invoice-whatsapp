export type MarkPaymentInput = {
  invoiceNumber: string;
  amount: number;
  method: 'cash' | 'upi' | 'card' | 'other';
  reference?: string;
};
