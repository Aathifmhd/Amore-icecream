import React, { useMemo, useState } from 'react';
import { Plus, Printer, Pencil, CheckCircle2, RotateCcw, MessageCircle } from 'lucide-react';
import { BranchId, OrderRecord } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { completeOrderRefund, createManualReturnBill, isCapturedReturnedBill, updateReturnBill } from '../../../utils/orderStorage';
import { formatPrice } from '../../../utils/currency';
import { Badge, Button, Card, Dialog, EmptyState, Field, cx, inputClass, useConsoleUi } from './ui';
import { shortRef } from './orderMeta';
import { BranchFilter, inBranch } from './useConsoleData';
import { printSlip } from './printSlip';
import { CustomerMessageDialog } from './OrderDrawer';

const lkr = (n: number) => formatPrice(n, 'LKR');
const refundAmount = (o: OrderRecord) => o.refundAmountLKR ?? o.grandTotalLKR;
const isManual = (o: OrderRecord) => o.orderReference.startsWith('RET-') || o.items.some((i) => i.itemId === 'returned-item-manual');
const method = (o: OrderRecord) => (o.paymentMethod === 'card' ? 'Back to card' : 'Cash refund');

// ---- Add / edit ----

const RefundForm: React.FC<{ editing?: OrderRecord; defaultBranch: BranchId; onClose: () => void }> = ({ editing, defaultBranch, onClose }) => {
  const { toast } = useConsoleUi();
  const [name, setName] = useState(editing?.customerName || '');
  const [phone, setPhone] = useState(editing?.contactNumber || '');
  const [branch, setBranch] = useState<BranchId>(editing?.branchId || defaultBranch);
  const [amount, setAmount] = useState(editing ? String(refundAmount(editing)) : '');
  const [how, setHow] = useState<'cash' | 'card'>(editing?.paymentMethod === 'card' ? 'card' : 'cash');
  const [reason, setReason] = useState(editing?.cancellationReason || '');
  const [orderNo, setOrderNo] = useState('');

  const amt = Number(amount);
  const valid = name.trim() && amt > 0 && reason.trim();

  const save = () => {
    if (!valid) return;
    if (editing) {
      updateReturnBill(editing.orderReference, {
        refundAmountLKR: amt,
        cancellationReason: reason.trim(),
        customerName: name.trim(),
        contactNumber: phone.trim(),
      });
      toast('Refund updated');
    } else {
      const fullReason = orderNo.trim() ? `${reason.trim()} (order ${orderNo.trim().toUpperCase()})` : reason.trim();
      const bill = createManualReturnBill({
        customerName: name.trim(),
        contactNumber: phone.trim(),
        branchId: branch,
        refundAmountLKR: amt,
        paymentMethod: how,
        cancellationReason: fullReason,
      });
      toast(`Refund ${shortRef(bill.orderReference)} added`);
    }
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Edit refund' : 'Add a refund'}
      description={editing ? undefined : 'For returns at the counter or any money you need to give back.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {editing ? 'Save' : 'Add refund'}
          </Button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Customer name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus={!editing} />
        </Field>
        <Field label="Phone (optional)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputClass} />
        </Field>
        <Field label="Amount (LKR)">
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inputClass} />
        </Field>
        {!editing && (
          <Field label="Branch">
            <select value={branch} onChange={(e) => setBranch(e.target.value as BranchId)} className={inputClass}>
              {AMORE_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!editing && (
          <div className="sm:col-span-2">
            <span className="block text-sm font-semibold text-[#3D2C24] mb-1.5">How will you refund?</span>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'card'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHow(m)}
                  className={cx(
                    'h-11 rounded-xl border text-sm font-semibold cursor-pointer',
                    how === m ? 'border-[#81001E] bg-[#81001E]/5 text-[#81001E]' : 'border-[#E2D8CA] text-[#3D2C24]'
                  )}
                >
                  {m === 'cash' ? 'Cash at the counter' : 'Back to their card'}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Reason" className="sm:col-span-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="e.g. Melted on delivery" />
        </Field>
        {!editing && (
          <Field label="Order number (optional)" hint="If this refund is for an online order" className="sm:col-span-2">
            <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} className={inputClass} placeholder="e.g. AMO-7KQ4XP" />
          </Field>
        )}
      </div>
    </Dialog>
  );
};

// ---- List ----

export const RefundsView: React.FC<{ orders: OrderRecord[]; branch: BranchFilter }> = ({ orders, branch }) => {
  const { confirm, toast } = useConsoleUi();
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [form, setForm] = useState<{ editing?: OrderRecord } | null>(null);
  const [messageFor, setMessageFor] = useState<OrderRecord | null>(null);

  const refunds = useMemo(() => orders.filter((o) => isCapturedReturnedBill(o) && inBranch(o, branch)), [orders, branch]);
  const pending = refunds.filter((o) => o.refundStatus !== 'completed');
  const done = refunds
    .filter((o) => o.refundStatus === 'completed')
    .sort((a, b) => (b.refundedAt || '').localeCompare(a.refundedAt || ''));
  const list = tab === 'pending' ? pending : done;
  const pendingTotal = pending.reduce((s, o) => s + refundAmount(o), 0);

  const markRefunded = async (o: OrderRecord) => {
    const ok = await confirm({
      title: `Mark ${lkr(refundAmount(o))} as refunded?`,
      message: `Only do this after ${o.customerName} has actually received the money (${method(o).toLowerCase()}). This can’t be undone.`,
      confirmLabel: 'Yes, refunded',
    });
    if (!ok) return;
    completeOrderRefund(o.orderReference);
    toast('Marked as refunded');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex p-1 bg-[#F3EDE3] rounded-xl self-start" role="tablist">
          {[
            { id: 'pending' as const, label: 'To refund', count: pending.length },
            { id: 'done' as const, label: 'Refunded', count: done.length },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                'h-9 px-3.5 rounded-lg text-sm font-semibold cursor-pointer',
                tab === t.id ? 'bg-white text-[#241A18] shadow-sm' : 'text-[#6B5A51] hover:text-[#241A18]'
              )}
            >
              {t.label} <span className="text-[#A8988B] font-medium">{t.count}</span>
            </button>
          ))}
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setForm({})}>
          Add refund
        </Button>
      </div>

      {tab === 'pending' && pending.length > 0 && (
        <Card className="p-4 flex items-center gap-3 bg-red-50/60 border-red-200">
          <RotateCcw className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-900">
            <strong>{lkr(pendingTotal)}</strong> still to give back to {pending.length} customer{pending.length === 1 ? '' : 's'}.
          </p>
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<CheckCircle2 className="w-6 h-6" />} title={tab === 'pending' ? 'Nothing to refund' : 'No refunds yet'}>
            {tab === 'pending' ? 'Refunds appear here when a paid order is cancelled, or when you add one.' : undefined}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((o) => (
            <Card key={o.orderReference} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#241A18] truncate">{o.customerName}</p>
                  <p className="text-xs text-[#7A6458]">
                    {shortRef(o.orderReference)} · {new Date(o.cancelledAt || o.createdAt).toLocaleDateString()}
                    {branch === 'all' ? ` · ${o.branchName}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#241A18]">{lkr(refundAmount(o))}</p>
                  <Badge tone={o.refundStatus === 'completed' ? 'green' : 'red'} dot>
                    {o.refundStatus === 'completed' ? 'Refunded' : 'To refund'}
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-sm text-[#3D2C24]">{o.cancellationReason || 'No reason given'}</p>
              <p className="mt-1 text-xs text-[#7A6458]">
                {method(o)}
                {o.contactNumber ? ` · ${o.contactNumber}` : ''}
                {o.refundedAt ? ` · refunded ${new Date(o.refundedAt).toLocaleDateString()}` : ''}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {o.refundStatus !== 'completed' && (
                  <Button size="sm" variant="success" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => markRefunded(o)}>
                    Mark as refunded
                  </Button>
                )}
                {o.refundStatus !== 'completed' && (
                  <Button size="sm" variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setForm({ editing: o })}>
                    Edit
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={<Printer className="w-4 h-4" />} onClick={() => printSlip(o, 'refund')}>
                  Print
                </Button>
                {!isManual(o) && (
                  <Button size="sm" variant="ghost" icon={<MessageCircle className="w-4 h-4" />} onClick={() => setMessageFor(o)}>
                    Customer message
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {form && (
        <RefundForm editing={form.editing} defaultBranch={branch === 'all' ? 'akurana' : branch} onClose={() => setForm(null)} />
      )}
      <CustomerMessageDialog order={messageFor} onClose={() => setMessageFor(null)} />
    </div>
  );
};
