/**
 * Riders (console): who delivers for each parlour, what they are doing now, today's deliveries
 * and cash, orders waiting for a rider, and adding / editing riders. Riders use the rider app
 * at /rider (phone number + PIN). A branch admin sees and manages their own parlour's riders.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, Bike, CheckCircle2, Clock, Copy, KeyRound, Pencil, Plus, Smartphone, Trash2, UserRound } from 'lucide-react';
import { BranchId } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { api, ApiError, type AdminProfile } from '../../../api';
import { startPolling } from '../../../utils/poll';
import { formatPrice } from '../../../utils/currency';
import { Badge, Button, Card, EmptyState, Field, Popup, Switch, cx, inputClass, useConsoleUi } from './ui';
import type { BranchFilter } from './useConsoleData';
import { clockTime, shortRef, timeAgo } from './orderMeta';

const lkr = (n: number) => formatPrice(n, 'LKR');
const BRANCH_SHORT: Record<BranchId, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };
const RIDER_APP = 'amore-icecream.vercel.app/rider';

interface RiderOrder {
  orderReference: string;
  customerName: string;
  city: string;
  deliveryAddress: string;
  readyAt: string | null;
  onTheWayAt: string | null;
  deliveredAt: string | null;
  grandTotalLKR: number;
  collectCash: boolean;
  cashCollectedLKR: number | null;
  status: string;
  branchId: BranchId;
}
interface Rider {
  id: string;
  name: string;
  phone: string;
  branchId: BranchId;
  active: boolean;
  lastSeenAt: string | null;
  outWith: { orderReference: string; customerName: string; city: string; onTheWayAt: string; grandTotalLKR: number; collectCash: boolean }[];
  deliveredToday: number;
  cashToday: number;
  cashOnTheWay: number;
}

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

function useRiders() {
  const [data, setData] = useState<{ riders: Rider[]; waiting: RiderOrder[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await api<{ riders: Rider[]; waiting: RiderOrder[] }>('/riders', { as: 'admin' }));
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Could not load the riders.'));
    }
  }, []);
  useEffect(() => startPolling(load, { visibleMs: 15_000, hiddenMs: 60_000 }), [load]);
  return { data, error, reload: load };
}

export const RidersView: React.FC<{ admin: AdminProfile; branch: BranchFilter }> = ({ admin, branch }) => {
  const { toast, confirm } = useConsoleUi();
  const { data, error, reload } = useRiders();
  const [editing, setEditing] = useState<Rider | 'new' | null>(null);
  const [pinFor, setPinFor] = useState<Rider | null>(null);
  const [historyOf, setHistoryOf] = useState<Rider | null>(null);
  const isSuper = admin.role !== 'branch';

  if (!data) return <p className="text-sm text-[#8A7970]">{error || 'Loading riders…'}</p>;

  const riders = branch === 'all' ? data.riders : data.riders.filter((r) => r.branchId === branch);
  const waiting = branch === 'all' ? data.waiting : data.waiting.filter((o) => o.branchId === branch);
  const out = riders.filter((r) => r.outWith.length);
  const deliveredToday = riders.reduce((s, r) => s + r.deliveredToday, 0);
  const cashToday = riders.reduce((s, r) => s + r.cashToday, 0);

  const remove = async (r: Rider) => {
    const ok = await confirm({
      title: `Remove ${r.name}?`,
      message: 'They can no longer sign in to the rider app. Their past deliveries keep their name.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/riders/${r.id}`, { method: 'DELETE', as: 'admin' });
      toast(`${r.name} removed`);
      reload();
    } catch (err) {
      toast(errorText(err, 'Could not remove the rider'), 'error');
    }
  };

  const setActive = async (r: Rider, active: boolean) => {
    try {
      await api(`/riders/${r.id}`, { method: 'PATCH', body: { active }, as: 'admin' });
      toast(active ? `${r.name} can sign in again` : `${r.name} is switched off and signed out`);
      reload();
    } catch (err) {
      toast(errorText(err, 'Could not change the rider'), 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Today at a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<Bike className="w-5 h-5" />} label="Out delivering" value={`${out.length}`} hint={`${out.reduce((s, r) => s + r.outWith.length, 0)} orders on the way`} />
        <Stat
          icon={<Clock className="w-5 h-5" />}
          label="Waiting for a rider"
          value={`${waiting.length}`}
          hint={waiting.length ? `Oldest ready ${timeAgo(waiting[0].readyAt || undefined)}` : 'Nothing waiting'}
          alert={waiting.some((o) => o.readyAt && Date.now() - Date.parse(o.readyAt) > 10 * 60_000)}
        />
        <Stat icon={<CheckCircle2 className="w-5 h-5" />} label="Delivered today" value={`${deliveredToday}`} hint="By riders, since midnight" />
        <Stat icon={<Banknote className="w-5 h-5" />} label="Cash collected today" value={lkr(cashToday)} hint="To be handed in by riders" />
      </div>

      {/* The rider app */}
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-[#81001E]/10 text-[#81001E] flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#241A18]">
            Rider app: <span className="font-mono text-[#81001E]">{RIDER_APP}</span>
          </p>
          <p className="text-sm text-[#7A6458]">Riders open it on their phone and sign in with their mobile number and PIN. Mark a delivery “Ready for rider” on the Orders page and they see it at once.</p>
        </div>
        <Button
          variant="secondary"
          icon={<Copy className="w-4 h-4" />}
          onClick={() => {
            navigator.clipboard?.writeText(`https://${RIDER_APP}`);
            toast('Rider app link copied');
          }}
        >
          Copy link
        </Button>
      </Card>

      {/* Orders waiting for a rider */}
      {waiting.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/50">
          <p className="font-semibold text-[#241A18] mb-2.5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700" /> Waiting for a rider
          </p>
          <ul className="space-y-1.5">
            {waiting.map((o) => (
              <li key={o.orderReference} className="text-sm text-[#3D2C24] flex flex-wrap gap-x-2">
                <span className="font-mono font-bold text-[#81001E]">{shortRef(o.orderReference)}</span>
                <span className="font-semibold">{o.customerName}</span>
                <span className="text-[#7A6458]">· {o.city || o.deliveryAddress}</span>
                {branch === 'all' && <span className="text-[#7A6458]">· {BRANCH_SHORT[o.branchId]} parlour</span>}
                <span className={cx('ml-auto', o.readyAt && Date.now() - Date.parse(o.readyAt) > 10 * 60_000 ? 'text-red-700 font-semibold' : 'text-[#7A6458]')}>
                  ready {timeAgo(o.readyAt || undefined)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Riders */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-lg text-[#241A18]">
          Riders <span className="text-[#A8988B] font-medium">{riders.length}</span>
        </h2>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>
          Add rider
        </Button>
      </div>

      {riders.length === 0 ? (
        <Card>
          <EmptyState icon={<Bike className="w-6 h-6" />} title="No riders yet">
            Add your riders with their mobile number and a PIN. They then sign in at {RIDER_APP}.
          </EmptyState>
        </Card>
      ) : (
        <Card className="divide-y divide-[#F0E8DC] overflow-hidden">
          {riders.map((r) => (
            <div key={r.id} className="px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-3">
              <button type="button" onClick={() => setHistoryOf(r)} className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group">
                <span className={cx('w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0', r.active ? 'bg-[#81001E]/10 text-[#81001E]' : 'bg-stone-100 text-stone-400')}>
                  {r.name.trim()[0]?.toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#241A18] group-hover:underline">{r.name}</span>
                    {!r.active ? (
                      <Badge tone="grey">Switched off</Badge>
                    ) : r.outWith.length ? (
                      <Badge tone="blue">Out with {r.outWith.map((o) => shortRef(o.orderReference)).join(', ')}</Badge>
                    ) : (
                      <Badge tone="green">Available</Badge>
                    )}
                    {branch === 'all' && <span className="text-xs text-[#8A7970]">{BRANCH_SHORT[r.branchId]}</span>}
                  </span>
                  <span className="block text-sm text-[#7A6458] mt-0.5">
                    {r.phone}
                    {r.lastSeenAt && <> · active {timeAgo(r.lastSeenAt)}</>}
                  </span>
                </span>
              </button>
              <div className="text-sm text-right">
                <p className="font-semibold text-[#241A18]">{r.deliveredToday} delivered today</p>
                <p className="text-[#7A6458]">{lkr(r.cashToday)} cash{r.cashOnTheWay ? ` · ${lkr(r.cashOnTheWay)} to collect` : ''}</p>
              </div>
              <div className="flex items-center gap-1">
                <Switch checked={r.active} label={`${r.name} can sign in`} onChange={(v) => setActive(r, v)} />
                <Button size="sm" variant="ghost" aria-label={`Edit ${r.name}`} icon={<Pencil className="w-4 h-4" />} onClick={() => setEditing(r)} />
                <Button size="sm" variant="ghost" aria-label={`New PIN for ${r.name}`} icon={<KeyRound className="w-4 h-4" />} onClick={() => setPinFor(r)} />
                <Button size="sm" variant="ghost" aria-label={`Remove ${r.name}`} icon={<Trash2 className="w-4 h-4" />} onClick={() => remove(r)} />
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && <RiderEditor rider={editing === 'new' ? null : editing} isSuper={isSuper} admin={admin} onClose={() => setEditing(null)} onSaved={reload} />}
      {pinFor && <PinPopup rider={pinFor} onClose={() => setPinFor(null)} />}
      {historyOf && <RiderHistory rider={historyOf} onClose={() => setHistoryOf(null)} />}
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; hint: string; alert?: boolean }> = ({ icon, label, value, hint, alert }) => (
  <Card className={cx('p-4', alert && 'border-red-200 bg-red-50/40')}>
    <p className="text-sm text-[#7A6458] flex items-center gap-2">
      <span className={alert ? 'text-red-600' : 'text-[#81001E]'}>{icon}</span>
      {label}
    </p>
    <p className="text-2xl font-bold text-[#241A18] mt-1.5">{value}</p>
    <p className={cx('text-xs mt-0.5', alert ? 'text-red-700 font-semibold' : 'text-[#8A7970]')}>{hint}</p>
  </Card>
);

const pinInput = cx(inputClass, 'text-center text-xl tracking-[0.4em]');

const RiderEditor: React.FC<{ rider: Rider | null; isSuper: boolean; admin: AdminProfile; onClose: () => void; onSaved: () => void }> = ({
  rider,
  isSuper,
  admin,
  onClose,
  onSaved,
}) => {
  const { toast } = useConsoleUi();
  const [name, setName] = useState(rider?.name ?? '');
  const [phone, setPhone] = useState(rider?.phone ?? '');
  const [branchId, setBranchId] = useState<BranchId>(rider?.branchId ?? (admin.branchId as BranchId) ?? 'akurana');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (rider) {
        await api(`/riders/${rider.id}`, { method: 'PATCH', body: { name, phone, ...(isSuper && { branchId }) }, as: 'admin' });
        toast(`${name} saved`);
      } else {
        await api('/riders', { method: 'POST', body: { name, phone, branchId, pin }, as: 'admin' });
        toast(`${name} added — they can sign in at ${RIDER_APP}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not save the rider'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popup
      open
      onClose={onClose}
      title={rider ? `Edit ${rider.name}` : 'Add a rider'}
      subtitle={rider ? undefined : 'They sign in to the rider app with this mobile number and PIN.'}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !name.trim() || !phone.trim() || (!rider && !/^\d{4,6}$/.test(pin))}>
            {busy ? 'Saving…' : rider ? 'Save' : 'Add rider'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        <Field label="Name">
          <span className="relative block">
            <UserRound className="w-4 h-4 text-[#A8988B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input value={name} onChange={(e) => setName(e.target.value)} className={cx(inputClass, 'pl-10')} placeholder="e.g. Kamal Perera" />
          </span>
        </Field>
        <Field label="Mobile number">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" className={inputClass} placeholder="077 123 4567" />
        </Field>
        <Field label="Parlour">
          {isSuper ? (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value as BranchId)} className={inputClass}>
              {AMORE_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  Amore {b.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="h-11 px-3.5 rounded-xl bg-[#F3EDE3] flex items-center text-sm font-semibold">{BRANCH_SHORT[branchId]}</p>
          )}
        </Field>
        {!rider && (
          <Field label="PIN (4–6 digits)" hint="Give this to the rider. You can set a new one any time.">
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className={pinInput} />
          </Field>
        )}
      </div>
    </Popup>
  );
};

const PinPopup: React.FC<{ rider: Rider; onClose: () => void }> = ({ rider, onClose }) => {
  const { toast } = useConsoleUi();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    try {
      await api(`/riders/${rider.id}`, { method: 'PATCH', body: { pin }, as: 'admin' });
      toast(`New PIN set for ${rider.name}. They are signed out until they use it.`);
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not set the PIN'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popup
      open
      onClose={onClose}
      title={`New PIN for ${rider.name}`}
      subtitle="They are signed out of the rider app until they sign in with the new PIN."
      footer={
        <>
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !/^\d{4,6}$/.test(pin)}>
            Set PIN
          </Button>
        </>
      }
    >
      {error && <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      <Field label="New PIN (4–6 digits)">
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className={pinInput} autoFocus />
      </Field>
    </Popup>
  );
};

const RiderHistory: React.FC<{ rider: Rider; onClose: () => void }> = ({ rider, onClose }) => {
  const [list, setList] = useState<RiderOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ deliveries: RiderOrder[] }>(`/riders/${rider.id}/deliveries`, { as: 'admin' })
      .then((r) => setList(r.deliveries))
      .catch((err) => setError(errorText(err, 'Could not load the deliveries')));
  }, [rider.id]);
  const minutes = (o: RiderOrder) => (o.onTheWayAt && o.deliveredAt ? Math.round((Date.parse(o.deliveredAt) - Date.parse(o.onTheWayAt)) / 60000) : null);
  return (
    <Popup open onClose={onClose} title={rider.name} subtitle={`${rider.phone} · ${BRANCH_SHORT[rider.branchId]} · latest deliveries`} wide>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!list && !error && <p className="text-sm text-[#8A7970]">Loading…</p>}
      {list && list.length === 0 && <p className="text-sm text-[#8A7970]">No deliveries yet.</p>}
      {list && list.length > 0 && (
        <ul className="divide-y divide-[#F0E8DC] rounded-2xl border border-[#EAE2D6] bg-white overflow-hidden">
          {list.map((o) => (
            <li key={o.orderReference} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-mono font-bold text-[#81001E] w-24">{shortRef(o.orderReference)}</span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-[#241A18]">{o.customerName}</span>
                <span className="text-[#7A6458]"> · {o.city || o.deliveryAddress}</span>
              </span>
              <span className="text-[#7A6458]">
                {o.status === 'delivered' ? (
                  <>
                    {new Date(o.deliveredAt!).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · picked up {clockTime(o.onTheWayAt || undefined)}, delivered{' '}
                    {clockTime(o.deliveredAt || undefined)}
                    {minutes(o) !== null && <> ({minutes(o)} min)</>}
                  </>
                ) : (
                  <Badge tone="blue">On the way since {clockTime(o.onTheWayAt || undefined)}</Badge>
                )}
              </span>
              <span className="w-28 text-right font-semibold text-[#241A18]">{o.cashCollectedLKR ? lkr(o.cashCollectedLKR) : o.collectCash ? '—' : 'Card'}</span>
            </li>
          ))}
        </ul>
      )}
    </Popup>
  );
};
