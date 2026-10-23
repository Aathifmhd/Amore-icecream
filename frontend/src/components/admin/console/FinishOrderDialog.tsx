/**
 * "Mark delivered" / "Mark collected" in the console: staff say how the customer paid before the
 * order is finished (a card order paid online needs no answer). Cash a rider took at the door is
 * added to the cash that rider hands in.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Banknote, CheckCircle2, CreditCard, Landmark } from 'lucide-react';
import { OrderRecord, PaidVia } from '../../../types';
import { adminSetDelivered } from '../../../utils/orderStorage';
import { formatPrice } from '../../../utils/currency';
import { Button, Dialog, cx, useConsoleUi } from './ui';
import { cardText, isPickup, shortRef } from './orderMeta';
import { DEMO_CARD_PAYMENTS } from '../../../config';

const lkr = (n: number) => formatPrice(n, 'LKR');

interface Choice {
  id: PaidVia;
  title: string;
  hint: string;
  icon: React.ReactNode;
}

function choicesFor(o: OrderRecord): Choice[] {
  const total = lkr(o.grandTotalLKR);
  const transfer: Choice = { id: 'bank_transfer', title: 'Paid by bank transfer', hint: 'Into the parlour’s bank account', icon: <Landmark className="w-5 h-5" /> };
  if (isPickup(o)) {
    return [
      { id: 'cash', title: 'Paid in cash', hint: `${total} at the counter`, icon: <Banknote className="w-5 h-5" /> },
      { id: 'card_machine', title: 'Paid by card', hint: 'On the card machine', icon: <CreditCard className="w-5 h-5" /> },
      transfer,
    ];
  }
  const rider = o.riderName?.split(' ')[0];
  return [
    {
      id: 'cash',
      title: rider ? `${rider} got the cash` : 'Cash collected at the door',
      hint: rider ? `${total} — added to the cash ${rider} hands in` : total,
      icon: <Banknote className="w-5 h-5" />,
    },
    { ...transfer, title: 'Customer paid by bank transfer' },
    { id: 'card_machine', title: 'Customer paid by card', hint: 'On a card machine at the door', icon: <CreditCard className="w-5 h-5" /> },
  ];
}

const DONE_TEXT: Record<PaidVia, string> = { cash: 'paid in cash', bank_transfer: 'paid by bank transfer', card_machine: 'paid by card' };

export const FinishOrderDialog: React.FC<{ order: OrderRecord; onClose: () => void }> = ({ order, onClose }) => {
  const { toast } = useConsoleUi();
  const [choice, setChoice] = useState<PaidVia | null>(null);
  const pickup = isPickup(order);
  const paidOnline = order.paymentMethod === 'card';
  const ref = shortRef(order.orderReference);

  const finish = () => {
    if (!paidOnline && !choice) return;
    adminSetDelivered(order.orderReference, paidOnline ? undefined : choice!);
    toast(`${ref} ${pickup ? 'collected' : 'delivered'} · ${paidOnline ? 'paid by card online' : DONE_TEXT[choice!]}`);
    onClose();
  };

  // In a portal (and not passing clicks / keys on), so the order row underneath doesn't open
  return createPortal(
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Dialog
        open
        onClose={onClose}
        title={`${pickup ? 'Collected' : 'Delivered'} ${ref}?`}
        description={paidOnline ? `${order.customerName} paid online.` : `How did ${order.customerName} pay ${lkr(order.grandTotalLKR)}?`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Not yet
            </Button>
            <Button variant="success" disabled={!paidOnline && !choice} onClick={finish} icon={<CheckCircle2 className="w-4 h-4" />}>
              {pickup ? 'Mark collected' : 'Mark delivered'}
            </Button>
          </>
        }
      >
        {paidOnline ? (
          <div className="rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3 flex items-center gap-3 text-sky-900">
            <CreditCard className="w-6 h-6 shrink-0" />
            <span className="leading-tight">
              <span className="block font-semibold">Paid by card{cardText(order) ? ` · ${cardText(order)}` : ''}</span>
              <span className="block text-sm opacity-80">
                Nothing to collect{DEMO_CARD_PAYMENTS ? ' (demo card payment)' : ''}.
              </span>
            </span>
          </div>
        ) : (
          <div role="radiogroup" aria-label="How the customer paid" className="space-y-2">
            {choicesFor(order).map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={choice === c.id}
                onClick={() => setChoice(c.id)}
                className={cx(
                  'w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left cursor-pointer transition-colors',
                  choice === c.id ? 'border-[#81001E] bg-[#81001E]/5 ring-1 ring-[#81001E]' : 'border-[#E2D8CA] bg-white hover:bg-[#FBF8F3]'
                )}
              >
                <span className={cx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', choice === c.id ? 'bg-[#81001E] text-white' : 'bg-[#F3EDE3] text-[#5C4D44]')}>
                  {c.icon}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block font-semibold text-[#241A18]">{c.title}</span>
                  <span className="block text-sm text-[#7A6458] mt-0.5">{c.hint}</span>
                </span>
                <span className={cx('w-5 h-5 rounded-full border-2 shrink-0', choice === c.id ? 'border-[#81001E] bg-[#81001E] shadow-[inset_0_0_0_3px_white]' : 'border-[#C9B9A4]')} />
              </button>
            ))}
          </div>
        )}
      </Dialog>
    </div>,
    document.body
  );
};
