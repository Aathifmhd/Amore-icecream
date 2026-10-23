import type { PaidVia } from '../types';

/**
 * How a finished order was paid, other than cash a rider collected (shown as the amount):
 * "Paid by card" (online at checkout), "Bank transfer", "Card machine" or "Cash".
 * Used by the rider app and the console's Riders page.
 */
export function paidViaLabel(o: { paymentMethod?: string; paidVia?: PaidVia | null }): string | null {
  if (o.paymentMethod === 'card') return 'Paid by card';
  switch (o.paidVia) {
    case 'bank_transfer':
      return 'Bank transfer';
    case 'card_machine':
      return 'Card machine';
    case 'cash':
      return 'Cash';
    default:
      return null;
  }
}
