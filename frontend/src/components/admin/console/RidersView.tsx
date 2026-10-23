/**
 * Riders (console): who delivers for each parlour, what they are doing now, today's deliveries
 * and cash, orders waiting for a rider, and adding / editing riders. Riders use the rider app
 * at /rider (phone number + PIN). A branch admin sees and manages their own parlour's riders.
 * The second tab, Cash collection, records the cash riders hand in (RiderCashView).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Banknote, Bike, Camera, CheckCircle2, Clock, Copy, HandCoins, KeyRound, Pencil, Plus, Smartphone, Star, Trash2, UserRound, X } from 'lucide-react';
import { BranchId, PaidVia } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { api, ApiError, type AdminProfile } from '../../../api';
import { startPolling } from '../../../utils/poll';
import { photoDataUrl } from '../../../utils/imageUpload';
import { formatPrice } from '../../../utils/currency';
import { paidViaLabel } from '../../../utils/payment';
import { Stars } from '../../Stars';
import { Badge, Button, Card, EmptyState, Field, Popup, Stat, Switch, cx, inputClass, useConsoleUi } from './ui';
import { RiderCashView } from './RiderCashView';
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
  paymentMethod: string;
  collectCash: boolean;
  cashCollectedLKR: number | null;
  paidVia: PaidVia | null;
  deliveredBy: 'rider' | 'parlour' | null;
  riderRating: number | null;
  riderFeedback: string;
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
  /** Cash from delivered orders not yet handed in (Cash collection page) */
  holdingLKR: number;
  rating: { average: number | null; count: number };
  /** Personal details (console only) */
  fullName: string;
  nic: string;
  joinedOn: string;
  emergencyPhone: string;
  emergencyName: string;
  address: string;
  hasPhoto: boolean;
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

type RidersTab = 'riders' | 'cash';
// ?view=cash (and old ?tab=cash links) open Cash collection
const tabFromUrl = (): RidersTab => {
  const p = new URLSearchParams(window.location.search);
  return p.get('view') === 'cash' || p.get('tab') === 'cash' || p.get('tab') === 'rider-cash' ? 'cash' : 'riders';
};

export const RidersView: React.FC<{ admin: AdminProfile; branch: BranchFilter }> = ({ admin, branch }) => {
  const riders = useRiders();
  const [tab, setTab] = useState<RidersTab>(tabFromUrl);
  const open = (t: RidersTab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'riders');
    if (t === 'cash') url.searchParams.set('view', 'cash');
    else url.searchParams.delete('view');
    window.history.replaceState({}, '', url.toString());
  };
  const inScope = (riders.data?.riders || []).filter((r) => branch === 'all' || r.branchId === branch);
  const holding = inScope.reduce((s, r) => s + r.holdingLKR, 0);

  const tabs: { id: RidersTab; label: string; icon: React.ReactNode; extra: React.ReactNode }[] = [
    { id: 'riders', label: 'Riders', icon: <Bike className="w-4 h-4" />, extra: <span className="text-[#A8988B] font-medium">{inScope.length}</span> },
    {
      id: 'cash',
      label: 'Cash collection',
      icon: <HandCoins className="w-4 h-4" />,
      extra: holding > 0 ? <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-bold">{lkr(holding)}</span> : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="inline-flex max-w-full overflow-x-auto no-scrollbar p-1 bg-[#F3EDE3] rounded-xl" role="tablist" aria-label="Riders">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => open(t.id)}
            className={cx(
              'h-9 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-2',
              tab === t.id ? 'bg-white text-[#241A18] shadow-sm' : 'text-[#6B5A51] hover:text-[#241A18]'
            )}
          >
            {t.icon}
            {t.label}
            {t.extra}
          </button>
        ))}
      </div>
      {tab === 'riders' ? <RidersList admin={admin} branch={branch} riders={riders} onCash={() => open('cash')} /> : <RiderCashView branch={branch} />}
    </div>
  );
};

const RidersList: React.FC<{ admin: AdminProfile; branch: BranchFilter; riders: ReturnType<typeof useRiders>; onCash: () => void }> = ({
  admin,
  branch,
  riders: { data, error, reload },
  onCash,
}) => {
  const { toast, confirm } = useConsoleUi();
  const [editing, setEditing] = useState<Rider | 'new' | null>(null);
  const [pinFor, setPinFor] = useState<Rider | null>(null);
  const [historyOf, setHistoryOf] = useState<Rider | null>(null);
  // Photos load once (and after a change), not with the list every few seconds
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const loadPhotos = useCallback(() => {
    api<{ photos: Record<string, string> }>('/riders/photos', { as: 'admin' })
      .then((r) => setPhotos(r.photos))
      .catch(() => {});
  }, []);
  useEffect(loadPhotos, [loadPhotos]);
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
        <Stat icon={<Banknote className="w-5 h-5" />} label="Cash collected today" value={lkr(cashToday)} hint="Record hand-ins under Cash collection" />
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
                <span className={o.collectCash ? 'text-[#7A6458]' : 'font-semibold text-sky-800'}>· {o.collectCash ? `collect ${lkr(o.grandTotalLKR)}` : 'paid by card'}</span>
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
                <RiderAvatar name={r.name} photo={photos[r.id]} active={r.active} />
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
                    {r.rating.average !== null && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-800" title={`${r.rating.count} customer ratings`}>
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {r.rating.average.toFixed(1)}
                        <span className="font-normal text-[#8A7970]">({r.rating.count})</span>
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-[#7A6458] mt-0.5">
                    {r.phone}
                    {r.lastSeenAt && <> · active {timeAgo(r.lastSeenAt)}</>}
                  </span>
                </span>
              </button>
              <div className="text-sm text-right">
                <p className="font-semibold text-[#241A18]">{r.deliveredToday} delivered today</p>
                <p className="text-[#7A6458]">
                  {lkr(r.cashToday)} cash today{r.cashOnTheWay ? ` · ${lkr(r.cashOnTheWay)} to collect` : ''}
                </p>
                {r.holdingLKR > 0 && (
                  <button type="button" onClick={onCash} className="text-amber-800 font-semibold hover:underline cursor-pointer">
                    {lkr(r.holdingLKR)} to hand in
                  </button>
                )}
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

      {editing && (
        <RiderEditor
          rider={editing === 'new' ? null : editing}
          photo={editing === 'new' ? '' : photos[editing.id]}
          isSuper={isSuper}
          admin={admin}
          onClose={() => setEditing(null)}
          onSaved={() => (reload(), loadPhotos())}
        />
      )}
      {pinFor && <PinPopup rider={pinFor} onClose={() => setPinFor(null)} />}
      {historyOf && <RiderHistory rider={historyOf} photo={photos[historyOf.id]} onClose={() => setHistoryOf(null)} />}
    </div>
  );
};


const pinInput = cx(inputClass, 'text-center text-xl tracking-[0.4em]');

const NIC_RE = /^(\d{9}[VX]|\d{12})$/;
const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, this device's day
/** "Kamal Asanka Perera" → "Kamal Perera" (what the app and customers see) */
const shortName = (full: string) => {
  const w = full.trim().split(/\s+/).filter(Boolean);
  return w.length > 2 ? `${w[0]} ${w[w.length - 1]}` : w.join(' ');
};

export const RiderAvatar: React.FC<{ name: string; photo?: string; active?: boolean; size?: string }> = ({ name, photo, active = true, size = 'w-11 h-11' }) =>
  photo ? (
    <img src={photo} alt="" className={cx(size, 'rounded-full object-cover shrink-0 bg-[#F3EDE3]', !active && 'grayscale opacity-60')} />
  ) : (
    <span className={cx(size, 'rounded-full flex items-center justify-center font-bold shrink-0', active ? 'bg-[#81001E]/10 text-[#81001E]' : 'bg-stone-100 text-stone-400')}>
      {name.trim()[0]?.toUpperCase()}
    </span>
  );

const RiderEditor: React.FC<{ rider: Rider | null; photo?: string; isSuper: boolean; admin: AdminProfile; onClose: () => void; onSaved: () => void }> = ({
  rider,
  photo: savedPhoto = '',
  isSuper,
  admin,
  onClose,
  onSaved,
}) => {
  const { toast } = useConsoleUi();
  const [fullName, setFullName] = useState(rider?.fullName ?? '');
  const [name, setName] = useState(rider?.name ?? '');
  // The short name follows the full name until it is typed in
  const [nameTyped, setNameTyped] = useState(Boolean(rider));
  const [nic, setNic] = useState(rider?.nic ?? '');
  const [joinedOn, setJoinedOn] = useState(rider ? rider.joinedOn : todayISO());
  const [phone, setPhone] = useState(rider?.phone ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(rider?.emergencyPhone ?? '');
  const [emergencyName, setEmergencyName] = useState(rider?.emergencyName ?? '');
  const [address, setAddress] = useState(rider?.address ?? '');
  const [photo, setPhoto] = useState(savedPhoto);
  const [branchId, setBranchId] = useState<BranchId>(rider?.branchId ?? (admin.branchId as BranchId) ?? 'akurana');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    try {
      setPhoto(await photoDataUrl(file));
    } catch {
      setError('Could not use that photo. Try a JPEG or PNG.');
    }
  };

  // A new rider needs everything but the photo; an older rider can be saved while details are missing
  const missing = [
    !fullName.trim() && 'full name',
    !NIC_RE.test(nic) && 'NIC number',
    !joinedOn && 'joined date',
    emergencyPhone.replace(/\D/g, '').length < 9 && 'emergency contact number',
    !address.trim() && 'address',
  ].filter(Boolean) as string[];
  const ready = name.trim() && phone.trim() && (rider ? true : missing.length === 0 && /^\d{4,6}$/.test(pin));

  const save = async () => {
    setBusy(true);
    setError(null);
    const details = {
      fullName,
      nic,
      joinedOn,
      emergencyPhone,
      emergencyName,
      address,
      ...(photo !== savedPhoto && { photo }),
    };
    try {
      if (rider) {
        await api(`/riders/${rider.id}`, { method: 'PATCH', body: { name, phone, ...details, ...(isSuper && { branchId }) }, as: 'admin' });
        toast(`${name} saved`);
      } else {
        await api('/riders', { method: 'POST', body: { name, phone, branchId, pin, ...details }, as: 'admin' });
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
      subtitle={rider ? 'Personal details are seen only here in the console.' : 'They sign in to the rider app with this mobile number and PIN.'}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !ready}>
            {busy ? 'Saving…' : rider ? 'Save' : 'Add rider'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        {rider && missing.length > 0 && (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Please add the missing {missing.join(', ')}.</p>
        )}

        <div className="flex items-center gap-4">
          <RiderAvatar name={name || fullName || '?'} photo={photo} size="w-16 h-16" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Camera className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>
              {photo ? 'Change photo' : 'Add photo'}
            </Button>
            {photo && (
              <Button size="sm" variant="ghost" icon={<X className="w-4 h-4" />} onClick={() => setPhoto('')}>
                Remove
              </Button>
            )}
            <span className="w-full text-xs text-[#8A7970]">Optional</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
        </div>

        <Field label="Full name (as on the NIC)">
          <span className="relative block">
            <UserRound className="w-4 h-4 text-[#A8988B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (!nameTyped) setName(shortName(e.target.value));
              }}
              maxLength={100}
              className={cx(inputClass, 'pl-10')}
              placeholder="e.g. Kamal Asanka Perera"
            />
          </span>
        </Field>
        <Field label="Name in the app" hint="Shown to the rider and to customers (“Kamal is on the way”).">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameTyped(true);
            }}
            maxLength={60}
            className={inputClass}
            placeholder="e.g. Kamal Perera"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="NIC number" hint="9 digits + V/X, or 12 digits">
            <input value={nic} onChange={(e) => setNic(e.target.value.toUpperCase().replace(/[^0-9VX]/g, '').slice(0, 12))} className={inputClass} placeholder="e.g. 199912345678" />
          </Field>
          <Field label="Joined date">
            <input type="date" value={joinedOn} max={todayISO()} onChange={(e) => setJoinedOn(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Mobile number" hint="They sign in with this.">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" className={inputClass} placeholder="077 123 4567" />
          </Field>
          <Field label="Emergency contact number">
            <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} type="tel" inputMode="tel" className={inputClass} placeholder="077 765 4321" />
          </Field>
        </div>
        <Field label="Emergency contact (optional)">
          <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} maxLength={100} className={inputClass} placeholder="e.g. Mother – Sunethra" />
        </Field>
        <Field label="Address">
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} rows={2} className={cx(inputClass, 'h-auto py-2.5')} placeholder="House number, street, town" />
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

const Detail: React.FC<{ label: string; wide?: boolean; children: React.ReactNode }> = ({ label, wide, children }) => (
  <div className={cx('min-w-0', wide && 'sm:col-span-2')}>
    <dt className="text-xs font-semibold text-[#8A7970]">{label}</dt>
    <dd className="text-[#241A18] break-words">{children || '—'}</dd>
  </div>
);

const RiderHistory: React.FC<{ rider: Rider; photo?: string; onClose: () => void }> = ({ rider, photo, onClose }) => {
  const [list, setList] = useState<RiderOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ deliveries: RiderOrder[] }>(`/riders/${rider.id}/deliveries`, { as: 'admin' })
      .then((r) => setList(r.deliveries))
      .catch((err) => setError(errorText(err, 'Could not load the deliveries')));
  }, [rider.id]);
  const minutes = (o: RiderOrder) => (o.onTheWayAt && o.deliveredAt ? Math.round((Date.parse(o.deliveredAt) - Date.parse(o.onTheWayAt)) / 60000) : null);
  return (
    <Popup open onClose={onClose} title={rider.name} subtitle={`Rider · Amore ${BRANCH_SHORT[rider.branchId]}`} wide>
      <div className="mb-5 rounded-2xl border border-[#EAE2D6] bg-white p-4 flex flex-col sm:flex-row gap-4">
        <RiderAvatar name={rider.name} photo={photo} active={rider.active} size="w-20 h-20" />
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm flex-1 min-w-0">
          <Detail label="Full name">{rider.fullName}</Detail>
          <Detail label="NIC number">{rider.nic}</Detail>
          <Detail label="Mobile">
            <a href={`tel:${rider.phone}`} className="font-semibold text-[#81001E] hover:underline">
              {rider.phone}
            </a>
          </Detail>
          <Detail label="Joined">{rider.joinedOn && new Date(`${rider.joinedOn}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Detail>
          <Detail label="Emergency contact">
            {rider.emergencyPhone && (
              <>
                <a href={`tel:${rider.emergencyPhone}`} className="font-semibold text-[#81001E] hover:underline">
                  {rider.emergencyPhone}
                </a>
                {rider.emergencyName && <span className="text-[#7A6458]"> · {rider.emergencyName}</span>}
              </>
            )}
          </Detail>
          <Detail label="Address">{rider.address}</Detail>
        </dl>
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#8A7970] mb-2">Latest deliveries</p>
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
                {o.riderRating ? (
                  <span className="flex items-center gap-1.5 mt-0.5">
                    <Stars value={o.riderRating} size="w-3.5 h-3.5" />
                    {o.riderFeedback && <span className="text-xs italic text-[#7A6458] truncate">“{o.riderFeedback}”</span>}
                  </span>
                ) : null}
              </span>
              <span className="text-[#7A6458]">
                {o.status === 'delivered' ? (
                  <>
                    {new Date(o.deliveredAt!).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · picked up {clockTime(o.onTheWayAt || undefined)}, delivered{' '}
                    {clockTime(o.deliveredAt || undefined)}
                    {minutes(o) !== null && <> ({minutes(o)} min)</>}
                    {o.deliveredBy === 'parlour' && <> · marked by the parlour</>}
                  </>
                ) : (
                  <Badge tone="blue">On the way since {clockTime(o.onTheWayAt || undefined)}</Badge>
                )}
              </span>
              <span className="w-28 text-right font-semibold text-[#241A18]">{o.cashCollectedLKR ? lkr(o.cashCollectedLKR) : (o.status === 'delivered' && paidViaLabel(o)) || (o.collectCash ? '—' : 'Paid by card')}</span>
            </li>
          ))}
        </ul>
      )}
    </Popup>
  );
};
