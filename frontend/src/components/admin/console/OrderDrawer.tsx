import React, { useEffect, useState } from 'react';
import { Phone, MessageCircle, MapPin, Printer, Pencil, Ban, Trash2, Copy, Mail, Store, Bike, StickyNote, Check, CreditCard } from 'lucide-react';
import { OrderRecord } from '../../../types';
import {
  adminCancelOrderWithReason,
  buildCancellationMessage,
  cancellationNeedsRefund,
  deleteOrder,
  isCapturedReturnedBill,
  updateOrder,
} from '../../../utils/orderStorage';
import { formatPrice } from '../../../utils/currency';
import { Badge, Button, Dialog, Popup, Field, cx, inputClass, useConsoleUi } from './ui';
import { cardText, clockTime, formatLabel, isPickup, nextStep, paymentLabel, shortRef, statusLabel } from './orderMeta';
import { DEMO_CARD_PAYMENTS } from '../../../config';
import { NextStepButton } from './OrdersView';
import { printSlip } from './printSlip';

const lkr = (n: number) => formatPrice(n, 'LKR');

/** Sri Lankan local numbers (07…) → international digits for WhatsApp links. */
export function whatsappDigits(phone: string) {
  const d = phone.replace(/\D/g, '');
  return d.startsWith('0') ? '94' + d.slice(1) : d;
}

const REASONS = [
  'An item is sold out',
  'We are too busy right now',
  'We can’t deliver to this address',
  'The customer asked to cancel',
  'The branch is closing',
  'Other',
];

// ---- Customer message (after cancelling, or later from the order) ----

export const CustomerMessageDialog: React.FC<{ order: OrderRecord | null; onClose: () => void; justCancelled?: boolean }> = ({
  order,
  onClose,
  justCancelled,
}) => {
  const [copied, setCopied] = useState(false);
  if (!order) return null;
  const body = order.inconvenienceEmailContent || buildCancellationMessage(order, order.cancellationReason || '').body;
  const subject = `Your Amore order ${order.orderReference}`;
  const copy = () => {
    navigator.clipboard.writeText(body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={justCancelled ? 'Order cancelled — let the customer know' : 'Message to the customer'}
      description={justCancelled ? 'Nothing is sent automatically. Send this message by WhatsApp or email.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={copy} icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {order.emailAddress && (
            <a
              href={`mailto:${order.emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold bg-white border border-[#E2D8CA] hover:bg-[#FBF8F3]"
            >
              <Mail className="w-4 h-4" /> Email
            </a>
          )}
          <a
            href={`https://wa.me/${whatsappDigits(order.contactNumber)}?text=${encodeURIComponent(body)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        </>
      }
    >
      <pre className="whitespace-pre-wrap font-sans text-sm text-[#3D2C24] bg-[#FBF8F3] border border-[#EAE2D6] rounded-xl p-4">{body}</pre>
    </Dialog>
  );
};

// ---- Cancel ----

const CancelDialog: React.FC<{ order: OrderRecord; onClose: () => void; onCancelled: (o: OrderRecord) => void }> = ({ order, onClose, onCancelled }) => {
  const [preset, setPreset] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const reason = preset === 'Other' ? details.trim() : details.trim() ? `${preset} — ${details.trim()}` : preset;
  const needsRefund = cancellationNeedsRefund(order);

  const submit = () => {
    if (!reason) return;
    const updated = adminCancelOrderWithReason(order.orderReference, reason);
    if (updated) onCancelled(updated);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Cancel order ${shortRef(order.orderReference)}?`}
      description={`${order.customerName} · ${lkr(order.grandTotalLKR)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep order
          </Button>
          <Button variant="primary" className="!bg-red-600 hover:!bg-red-700" disabled={!reason} onClick={submit}>
            Cancel order
          </Button>
        </>
      }
    >
      <p className="text-sm font-semibold text-[#3D2C24] mb-2">Why?</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setPreset(r)}
            className={cx(
              'px-3 py-2 rounded-xl border text-sm cursor-pointer transition-colors',
              preset === r ? 'border-[#81001E] bg-[#81001E]/5 text-[#81001E] font-semibold' : 'border-[#E2D8CA] text-[#3D2C24] hover:bg-[#FBF8F3]'
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <Field label={preset === 'Other' ? 'Reason' : 'More details (optional)'} className="mt-4">
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={2}
          className={cx(inputClass, 'h-auto py-2.5')}
          placeholder={preset === 'Other' ? 'Tell the customer why' : 'e.g. which item'}
        />
      </Field>
      {needsRefund && (
        <p className="mt-4 text-sm rounded-xl bg-red-50 border border-red-200 text-red-800 p-3">
          This card payment was already taken. Cancelling adds a <strong>{lkr(order.grandTotalLKR)} refund</strong> to the Refunds list.
        </p>
      )}
      <p className="mt-4 text-xs text-[#8A7970]">Next you’ll get a ready-made apology message to send by WhatsApp or email.</p>
    </Dialog>
  );
};

// ---- Edit customer details ----

const EditDialog: React.FC<{ order: OrderRecord; onClose: () => void }> = ({ order, onClose }) => {
  const { toast } = useConsoleUi();
  const [form, setForm] = useState({
    customerName: order.customerName,
    contactNumber: order.contactNumber,
    deliveryAddress: order.deliveryAddress || '',
    city: order.city || '',
    specialNote: order.specialNote === 'Manual Admin Order' ? '' : order.specialNote || '',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const save = () => {
    if (!form.customerName.trim() || !form.contactNumber.trim()) return;
    // Only send the edited fields, so a status change made meanwhile isn't overwritten
    updateOrder(order.orderReference, {
      customerName: form.customerName.trim(),
      contactNumber: form.contactNumber.trim(),
      deliveryAddress: form.deliveryAddress.trim(),
      city: form.city.trim(),
      specialNote: form.specialNote.trim(),
      updatedAt: new Date().toISOString(),
    });
    toast('Details saved');
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!form.customerName.trim() || !form.contactNumber.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Customer name">
          <input value={form.customerName} onChange={set('customerName')} className={inputClass} />
        </Field>
        <Field label="Phone">
          <input value={form.contactNumber} onChange={set('contactNumber')} inputMode="tel" className={inputClass} />
        </Field>
        {!isPickup(order) && (
          <>
            <Field label="Delivery address">
              <input value={form.deliveryAddress} onChange={set('deliveryAddress')} className={inputClass} />
            </Field>
            <Field label="City / area">
              <input value={form.city} onChange={set('city')} className={inputClass} />
            </Field>
          </>
        )}
        <Field label="Note for the kitchen">
          <textarea value={form.specialNote} onChange={set('specialNote')} rows={2} className={cx(inputClass, 'h-auto py-2.5')} />
        </Field>
      </div>
    </Dialog>
  );
};

// ---- Drawer ----

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-white rounded-2xl border border-[#EAE2D6] p-4">
    <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A7970] mb-2.5">{title}</h3>
    {children}
  </section>
);

export const OrderDrawer: React.FC<{ order: OrderRecord | null; onClose: () => void }> = ({ order, onClose }) => {
  const { confirm, toast } = useConsoleUi();
  const [dialog, setDialog] = useState<'edit' | 'cancel' | 'message' | null>(null);
  const [cancelledOrder, setCancelledOrder] = useState<OrderRecord | null>(null);

  useEffect(() => setDialog(null), [order?.orderReference]);

  if (!order && !cancelledOrder) return null;
  if (!order) return <CustomerMessageDialog order={cancelledOrder} justCancelled onClose={() => setCancelledOrder(null)} />;

  const s = statusLabel(order);
  const canCancel = order.status !== 'cancelled' && order.status !== 'delivered';
  const canDelete = order.status === 'cancelled' && !isCapturedReturnedBill(order);
  const mapHref = order.deliveryCoordinates
    ? `https://www.google.com/maps?q=${order.deliveryCoordinates.lat},${order.deliveryCoordinates.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(`${order.deliveryAddress || ''} ${order.city || ''}`)}`;

  const timeline: [string, string | undefined][] = [
    ['Placed', order.createdAt],
    ['Accepted', order.confirmedAt],
    ['Preparing', order.preparingAt],
    ...(isPickup(order) ? [] : ([['Ready for rider', order.readyAt]] as [string, string | undefined][])),
    [isPickup(order) ? 'Ready for pickup' : order.riderName ? `Picked up by ${order.riderName}` : 'Out for delivery', order.onTheWayAt],
    [isPickup(order) ? 'Collected' : order.deliveredBy === 'parlour' && order.riderName ? 'Delivered (marked by the parlour)' : 'Delivered', order.deliveredAt],
    ['Cancelled', order.cancelledAt],
  ];

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete order ${shortRef(order.orderReference)}?`,
      message: 'It will be removed for good. Only cancelled orders can be deleted.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    if (deleteOrder(order.orderReference)) {
      toast('Order deleted');
      onClose();
    } else toast('This order can’t be deleted', 'error');
  };

  return (
    <>
      <Popup
        open
        wide
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono">{shortRef(order.orderReference)}</span>
            <Badge tone={s.tone} dot>
              {s.label}
            </Badge>
          </span>
        }
        subtitle={`${order.branchName} · ${new Date(order.createdAt).toLocaleDateString()} ${clockTime(order.createdAt)}`}
        footer={
          <div className="w-full space-y-2">
            {nextStep(order) && <NextStepButton order={order} size="lg" className="w-full" />}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<Printer className="w-4 h-4" />} onClick={() => printSlip(order)}>
                Print
              </Button>
              {order.status !== 'cancelled' && (
                <Button size="sm" variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setDialog('edit')}>
                  Edit details
                </Button>
              )}
              {order.status === 'cancelled' && order.cancelledBy !== 'customer' && (
                <Button size="sm" variant="secondary" icon={<MessageCircle className="w-4 h-4" />} onClick={() => setDialog('message')}>
                  Customer message
                </Button>
              )}
              <span className="flex-1" />
              {canCancel && (
                <Button size="sm" variant="danger" icon={<Ban className="w-4 h-4" />} onClick={() => setDialog('cancel')}>
                  Cancel order
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <Section title="Customer">
            <p className="font-semibold text-[#241A18]">{order.customerName}</p>
            <p className="text-sm text-[#5C4D44]">{order.contactNumber}</p>
            {order.emailAddress && <p className="text-sm text-[#5C4D44]">{order.emailAddress}</p>}
            <div className="flex gap-2 mt-3">
              <a href={`tel:${order.contactNumber.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold border border-[#E2D8CA] bg-white hover:bg-[#FBF8F3]">
                <Phone className="w-4 h-4" /> Call
              </a>
              <a
                href={`https://wa.me/${whatsappDigits(order.contactNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold border border-[#E2D8CA] bg-white hover:bg-[#FBF8F3]"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </div>
          </Section>

          <Section title={isPickup(order) ? 'Pickup' : 'Delivery'}>
            {isPickup(order) ? (
              <p className="text-sm text-[#241A18] flex items-center gap-2">
                <Store className="w-4 h-4 text-[#81001E]" /> Customer collects at {order.branchName}
              </p>
            ) : (
              <>
                <p className="text-sm text-[#241A18] flex gap-2">
                  <Bike className="w-4 h-4 text-[#81001E] shrink-0 mt-0.5" />
                  <span>
                    {order.deliveryAddress || 'No address given'}
                    {order.city ? `, ${order.city}` : ''}
                  </span>
                </p>
                {(order.deliveryAddress || order.deliveryCoordinates) && (
                  <a href={mapHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#81001E] hover:underline">
                    <MapPin className="w-4 h-4" /> Open in Google Maps
                  </a>
                )}
                {order.riderName && (
                  <p className="mt-3 text-sm text-[#241A18] flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">Rider: {order.riderName}</span>
                    {order.riderPhone && (
                      <a href={`tel:${order.riderPhone}`} className="font-semibold text-[#81001E] hover:underline">
                        {order.riderPhone}
                      </a>
                    )}
                    {order.cashCollectedLKR ? <span className="text-emerald-700">· collected {lkr(order.cashCollectedLKR)} cash</span> : null}
                  </p>
                )}
                {order.riderNote && !order.riderName && (
                  <p className="mt-3 text-sm rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
                    Handed back by {order.riderNote}
                  </p>
                )}
              </>
            )}
          </Section>

          <Section title={`Items (${order.items.reduce((s2, i) => s2 + i.quantity, 0)})`}>
            <ul className="space-y-2">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3 text-sm">
                  <span>
                    <span className="font-bold text-[#81001E]">{i.quantity}×</span> {i.name}
                    {i.format && <span className="text-[#8A7970]"> · {formatLabel(i.format)}</span>}
                    {i.notes && <span className="block text-xs text-[#8A7970] pl-6">{i.notes}</span>}
                  </span>
                  <span className="text-[#5C4D44] whitespace-nowrap">{lkr(i.priceLKR * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 pt-3 border-t border-[#F0E8DC] space-y-1 text-sm">
              <div className="flex justify-between text-[#5C4D44]">
                <dt>Delivery</dt>
                <dd>{order.deliveryFeeLKR ? lkr(order.deliveryFeeLKR) : 'Free'}</dd>
              </div>
              <div className="flex justify-between font-bold text-[#241A18] text-base">
                <dt>Total</dt>
                <dd>{lkr(order.grandTotalLKR)}</dd>
              </div>
              <div className="flex justify-between gap-3 text-[#5C4D44]">
                <dt>Payment</dt>
                <dd className="text-right">{paymentLabel(order)}</dd>
              </div>
              {order.paymentMethod === 'card' && (
                <div className="!mt-3 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2.5 flex items-center gap-2.5 text-sky-900">
                  <CreditCard className="w-5 h-5 shrink-0" />
                  <span className="leading-tight">
                    <span className="block font-semibold">Paid by card online{cardText(order) ? ` · ${cardText(order)}` : ''}</span>
                    <span className="block text-xs opacity-80">
                      Nothing to collect at the door{DEMO_CARD_PAYMENTS ? ' · demo payment, no money was taken' : ''}
                    </span>
                  </span>
                </div>
              )}
            </dl>
          </Section>

          {order.specialNote && order.specialNote !== 'Manual Admin Order' && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex gap-2">
              <StickyNote className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Note:</strong> {order.specialNote}
              </span>
            </div>
          )}

          {order.status === 'cancelled' && (
            <Section title="Cancellation">
              <p className="text-sm text-[#241A18]">
                {order.cancelledBy === 'customer' ? 'Cancelled by the customer' : 'Cancelled by the parlour'}
                {order.cancellationReason ? ` — ${order.cancellationReason}` : ''}
              </p>
            </Section>
          )}

          <Section title="Timeline">
            <ol className="space-y-1.5">
              {timeline
                .filter(([, t]) => t)
                .map(([label, t]) => (
                  <li key={label} className="flex justify-between text-sm">
                    <span className="text-[#5C4D44]">{label}</span>
                    <span className="text-[#241A18] font-medium">{clockTime(t)}</span>
                  </li>
                ))}
            </ol>
          </Section>
        </div>
      </Popup>

      {dialog === 'edit' && <EditDialog order={order} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && (
        <CancelDialog
          order={order}
          onClose={() => setDialog(null)}
          onCancelled={(o) => {
            setDialog(null);
            setCancelledOrder(o);
            toast(`${shortRef(o.orderReference)} cancelled`);
            onClose();
          }}
        />
      )}
      {dialog === 'message' && <CustomerMessageDialog order={order} onClose={() => setDialog(null)} />}
    </>
  );
};
