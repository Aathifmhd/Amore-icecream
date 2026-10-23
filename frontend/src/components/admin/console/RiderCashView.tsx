/**
 * Cash collection (console, a tab on the Riders page): the cash each rider holds from cash-on-delivery orders, and recording
 * what they hand in at the parlour. A hand-in can be part of what they hold; the rest stays with
 * them. Today's hand-ins can be undone. A branch admin sees their own parlour's riders.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, HandCoins, Undo2, Wallet } from 'lucide-react';
import { BranchId } from '../../../types';
import { api, ApiError } from '../../../api';
import { startPolling } from '../../../utils/poll';
import { formatPrice } from '../../../utils/currency';
import { Badge, Button, Card, EmptyState, Field, Popup, Stat, cx, inputClass, useConsoleUi } from './ui';
import type { BranchFilter } from './useConsoleData';
import { clockTime, shortRef, timeAgo } from './orderMeta';


const lkr = (n: number) => formatPrice(n, 'LKR');
const BRANCH_SHORT: Record<BranchId, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };
const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);
const when = (iso: string) =>
  new Date(iso).toDateString() === new Date().toDateString()
    ? clockTime(iso)
    : `${new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${clockTime(iso)}`;

interface HandIn {
  id: string;
  riderId: string;
  riderName: string;
  branchId: BranchId;
  amountLKR: number;
  holdingBeforeLKR: number;
  note: string;
  receivedAt: string;
  receivedBy: string;
}
interface RiderCash {
  id: string;
  name: string;
  phone: string;
  branchId: BranchId;
  active: boolean;
  holdingLKR: number;
  collectedTodayLKR: number;
  handedInTodayLKR: number;
  lastHandIn: HandIn | null;
  unpaidOrders: number;
  holdingSince: string | null;
}
interface UnpaidOrder {
  orderReference: string;
  customerName: string;
  city: string;
  deliveredAt: string;
  cashCollectedLKR: number;
  owedLKR: number;
}

function useRiderCash() {
  const [data, setData] = useState<{ riders: RiderCash[]; handIns: HandIn[]; today: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await api<{ riders: RiderCash[]; handIns: HandIn[]; today: string }>('/rider-cash', { as: 'admin' }));
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Could not load the riders’ cash.'));
    }
  }, []);
  useEffect(() => startPolling(load, { visibleMs: 15_000, hiddenMs: 60_000 }), [load]);
  return { data, error, reload: load };
}

export const RiderCashView: React.FC<{ branch: BranchFilter }> = ({ branch }) => {
  const { toast, confirm } = useConsoleUi();
  const { data, error, reload } = useRiderCash();
  const [receiving, setReceiving] = useState<RiderCash | null>(null);

  if (!data) return <p className="text-sm text-[#8A7970]">{error || 'Loading…'}</p>;

  // Riders holding cash first (most first), then the rest by name
  const riders = data.riders
    .filter((r) => branch === 'all' || r.branchId === branch)
    .sort((a, b) => b.holdingLKR - a.holdingLKR || a.name.localeCompare(b.name));
  const handIns = data.handIns.filter((h) => branch === 'all' || h.branchId === branch);
  const holders = riders.filter((r) => r.holdingLKR > 0);
  const holding = holders.reduce((s, r) => s + r.holdingLKR, 0);
  const collectedToday = riders.reduce((s, r) => s + r.collectedTodayLKR, 0);
  const receivedToday = riders.reduce((s, r) => s + r.handedInTodayLKR, 0);

  const undo = async (h: HandIn) => {
    const ok = await confirm({
      title: `Undo ${lkr(h.amountLKR)} from ${h.riderName}?`,
      message: 'Only if it was recorded by mistake. The amount counts as still with the rider again.',
      confirmLabel: 'Undo hand-in',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/rider-cash/hand-ins/${h.id}`, { method: 'DELETE', as: 'admin' });
      toast('Hand-in undone');
      reload();
    } catch (err) {
      toast(errorText(err, 'Could not undo it'), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          icon={<Wallet className="w-5 h-5" />}
          label="With riders now"
          value={lkr(holding)}
          hint={holders.length ? `${holders.length} ${holders.length === 1 ? 'rider has' : 'riders have'} cash to hand in` : 'Everything is handed in'}
        />
        <Stat icon={<Banknote className="w-5 h-5" />} label="Collected today" value={lkr(collectedToday)} hint="Cash on delivery, since midnight" />
        <Stat icon={<HandCoins className="w-5 h-5" />} label="Received today" value={lkr(receivedToday)} hint="Handed in at the parlour" />
      </div>

      <div>
        <h2 className="font-bold text-lg text-[#241A18] mb-3">Riders</h2>
        {riders.length === 0 ? (
          <Card>
            <EmptyState icon={<HandCoins className="w-6 h-6" />} title="No riders yet">
              Add riders on the Riders page. The cash they collect at the door shows up here.
            </EmptyState>
          </Card>
        ) : (
          <Card className="divide-y divide-[#F0E8DC] overflow-hidden">
            {riders.map((r) => (
              <div key={r.id} className="px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-3">
                <span className={cx('w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0', r.holdingLKR ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-500')}>
                  {r.name.trim()[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#241A18]">{r.name}</span>
                    {branch === 'all' && <span className="text-xs text-[#8A7970]">{BRANCH_SHORT[r.branchId]}</span>}
                    {!r.active && <Badge tone="grey">Switched off</Badge>}
                  </p>
                  <p className="text-sm text-[#7A6458] mt-0.5">
                    {r.lastHandIn ? <>Last handed in {lkr(r.lastHandIn.amountLKR)} · {when(r.lastHandIn.receivedAt)}</> : 'Nothing handed in yet'}
                  </p>
                </div>
                <div className="text-right">
                  {r.holdingLKR ? (
                    <>
                      <p className="text-lg font-bold text-amber-800">{lkr(r.holdingLKR)}</p>
                      <p className="text-xs text-[#7A6458]">
                        {r.unpaidOrders} {r.unpaidOrders === 1 ? 'delivery' : 'deliveries'}
                        {r.holdingSince && <> · since {timeAgo(r.holdingSince)}</>}
                      </p>
                    </>
                  ) : (
                    <Badge tone="green">
                      <CheckCircle2 className="w-3 h-3" /> All handed in
                    </Badge>
                  )}
                </div>
                <Button variant="primary" disabled={!r.holdingLKR} icon={<HandCoins className="w-4 h-4" />} onClick={() => setReceiving(r)} className="w-full sm:w-auto">
                  Receive cash
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>

      <div>
        <h2 className="font-bold text-lg text-[#241A18] mb-3">Hand-ins</h2>
        {handIns.length === 0 ? (
          <Card>
            <EmptyState title="No cash received yet">When a rider hands in cash, press “Receive cash” next to their name.</EmptyState>
          </Card>
        ) : (
          <Card className="divide-y divide-[#F0E8DC] overflow-hidden">
            {handIns.map((h) => (
              <div key={h.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="w-32 text-[#7A6458]">{when(h.receivedAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-[#241A18]">{h.riderName}</span>
                  {branch === 'all' && <span className="text-[#8A7970]"> · {BRANCH_SHORT[h.branchId]}</span>}
                  {h.receivedBy && <span className="text-[#7A6458]"> · received by {h.receivedBy}</span>}
                  {h.note && <span className="block text-xs text-[#7A6458]">“{h.note}”</span>}
                  {h.amountLKR < h.holdingBeforeLKR && (
                    <span className="block text-xs text-amber-800">{lkr(h.holdingBeforeLKR - h.amountLKR)} stayed with the rider</span>
                  )}
                </span>
                <span className="font-bold text-[#241A18] w-28 text-right">{lkr(h.amountLKR)}</span>
                {h.receivedAt >= data.today ? (
                  <Button size="sm" variant="ghost" icon={<Undo2 className="w-4 h-4" />} aria-label={`Undo ${lkr(h.amountLKR)} from ${h.riderName}`} onClick={() => undo(h)} />
                ) : (
                  <span className="w-9" />
                )}
              </div>
            ))}
          </Card>
        )}
      </div>

      {receiving && (
        <ReceivePopup
          rider={receiving}
          onClose={() => setReceiving(null)}
          onDone={(amount, left) => {
            setReceiving(null);
            toast(`Received ${lkr(amount)} from ${receiving.name}${left ? ` · ${lkr(left)} still with them` : ''}`);
            reload();
          }}
        />
      )}
    </div>
  );
};

/** Count the cash, then record what was received (all of it, or part) */
const ReceivePopup: React.FC<{ rider: RiderCash; onClose: () => void; onDone: (amount: number, left: number) => void }> = ({ rider, onClose, onDone }) => {
  const [detail, setDetail] = useState<{ holdingLKR: number; orders: UnpaidOrder[] } | null>(null);
  const [amount, setAmount] = useState(String(rider.holdingLKR));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ holdingLKR: number; orders: UnpaidOrder[] }>(`/rider-cash/${rider.id}`, { as: 'admin' })
      .then((d) => {
        setDetail(d);
        setAmount(String(d.holdingLKR));
      })
      .catch((err) => setError(errorText(err, 'Could not load the deliveries')));
  }, [rider.id]);

  const holding = detail?.holdingLKR ?? rider.holdingLKR;
  const value = Number(amount.replace(/[^\d]/g, '')) || 0;
  const first = rider.name.split(' ')[0];
  const tooMuch = value > holding;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ holdingLKR: number }>(`/rider-cash/${rider.id}/hand-in`, { method: 'POST', body: { amountLKR: value, note }, as: 'admin' });
      onDone(value, res.holdingLKR);
    } catch (err) {
      setError(errorText(err, 'Could not record it'));
      setBusy(false);
    }
  };

  return (
    <Popup
      open
      onClose={onClose}
      title={`Receive cash from ${rider.name}`}
      subtitle="Count the cash, then record what you received."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1 sm:flex-none sm:ml-auto" disabled={busy || value <= 0 || tooMuch} onClick={save} icon={<HandCoins className="w-4 h-4" />}>
            Received {lkr(value)}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#8A7970] mb-2">Deliveries not handed in yet</p>
          {!detail ? (
            <p className="text-sm text-[#8A7970]">{error || 'Loading…'}</p>
          ) : (
            <ul className="rounded-2xl border border-[#EAE2D6] bg-white divide-y divide-[#F0E8DC] overflow-hidden">
              {detail.orders.map((o) => (
                <li key={o.orderReference} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-mono font-bold text-[#81001E] w-24">{shortRef(o.orderReference)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {o.customerName}
                    <span className="text-[#8A7970]"> · {when(o.deliveredAt)}</span>
                  </span>
                  <span className="font-semibold text-[#241A18] text-right">
                    {lkr(o.owedLKR)}
                    {o.owedLKR < o.cashCollectedLKR && <span className="block text-[11px] font-normal text-[#8A7970]">of {lkr(o.cashCollectedLKR)}</span>}
                  </span>
                </li>
              ))}
              <li className="px-4 py-2.5 flex justify-between bg-[#FBF8F3] font-bold text-[#241A18]">
                <span>{first} holds</span>
                <span>{lkr(holding)}</span>
              </li>
            </ul>
          )}
        </div>

        <Field label="Amount received (LKR)">
          <div className="flex gap-2">
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} className={cx(inputClass, 'text-lg font-bold')} aria-label="Amount received" />
            <Button variant="secondary" className="whitespace-nowrap" onClick={() => setAmount(String(holding))}>
              Full amount
            </Button>
          </div>
        </Field>
        {tooMuch ? (
          <p className="text-sm text-red-700 font-semibold">
            {first} only holds {lkr(holding)}.
          </p>
        ) : (
          value > 0 &&
          value < holding && (
            <p className="text-sm rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
              {lkr(holding - value)} stays with {first} to hand in later.
            </p>
          )
        )}

        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Rest tomorrow morning" className={inputClass} />
        </Field>
        {error && detail && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </Popup>
  );
};
