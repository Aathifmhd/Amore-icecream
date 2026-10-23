/**
 * The rider app (amore-icecream.vercel.app/rider): orders packed and ready at the rider's
 * parlour, the ones they are delivering, and today's finished deliveries.
 *
 *   Ready   → "Pick up" (check the items)          → the order is out for delivery with this rider
 *   On way  → call / navigate → "Delivered" (confirm the cash) or "Can't deliver" (hand it back)
 *   Done    → today's deliveries and the cash to hand in at the parlour
 *   Ratings → the stars customers gave after their deliveries
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Banknote,
  Bike,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  IceCreamCone,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  RotateCw,
  Star,
  StickyNote,
  TriangleAlert,
  WifiOff,
  X,
} from 'lucide-react';
import { AmoreLogo } from '../components/AmoreLogo';
import { ApiError, getRiderSession } from '../api';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import { formatPrice } from '../utils/currency';
import { distanceKm, useParlourZones } from '../utils/branchLocation';
import { paidViaLabel } from '../utils/payment';
import { Stars } from '../components/Stars';
import { RIDER_NEXT_DAY_DEMO } from '../config';
import { RiderLogin } from './RiderLogin';
import {
  agoText,
  alertNewOrder,
  clock,
  dayOrClock,
  directionsUrl,
  handBack,
  loadMyPhoto,
  loadRatings,
  markDelivered,
  minutesSince,
  pickUp,
  riderSignOut,
  shortRef,
  useRiderBoard,
  whatsappUrl,
  type RiderCash,
  type RiderOrder,
  type RiderRatings,
} from './riderApi';

const lkr = (n: number) => formatPrice(n, 'LKR');
type Tab = 'ready' | 'mine' | 'done' | 'ratings';

export default function RiderApp() {
  const [signedIn, setSignedIn] = useState(() => Boolean(getRiderSession()));
  const [notice, setNotice] = useState<string | null>(null);
  if (!signedIn) return <RiderLogin notice={notice} onSignedIn={() => (setNotice(null), setSignedIn(true))} />;
  return (
    <RiderHome
      onSignedOut={(why) => {
        setNotice(why);
        setSignedIn(false);
      }}
    />
  );
}

// ---- Main screen ------------------------------------------------------------------------

const RiderHome: React.FC<{ onSignedOut: (why: string | null) => void }> = ({ onSignedOut }) => {
  // The demo button shows tomorrow's Done page (nothing is changed)
  const [nextDay, setNextDay] = useState(false);
  // The rider's photo for the header (loaded once; the parlour sets it in the console)
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    loadMyPhoto()
      .then(setPhoto)
      .catch(() => {});
  }, []);
  const { board, offline, reload } = useRiderBoard(() => onSignedOut('Please sign in again.'), nextDay);
  const [tab, setTab] = useState<Tab>('ready');
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ kind: 'pickup' | 'deliver' | 'handback' | 'signout'; order?: RiderOrder } | null>(null);
  const [, setTick] = useState(0);
  const zones = useParlourZones();

  // Minutes shown on cards stay current
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // A chime and a buzz when a new order becomes ready (not on the first load)
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!board) return;
    const refs = new Set(board.ready.map((o) => o.orderReference));
    if (seen.current && [...refs].some((r) => !seen.current!.has(r))) {
      alertNewOrder();
      setToast('New order ready to pick up');
    }
    seen.current = refs;
  }, [board]);

  // Say so when the parlour finishes (or takes back) an order this rider was carrying
  const carrying = useRef<Set<string> | null>(null);
  const actedOn = useRef(new Set<string>());
  useEffect(() => {
    if (!board) return;
    const refs = new Set(board.mine.map((o) => o.orderReference));
    const gone = carrying.current ? [...carrying.current].filter((r) => !refs.has(r) && !actedOn.current.has(r)) : [];
    if (gone.length) {
      const delivered = gone.filter((r) => board.done.some((o) => o.orderReference === r));
      setToast(
        delivered.length
          ? `The parlour marked ${delivered.map(shortRef).join(', ')} as delivered`
          : `The parlour took ${gone.map(shortRef).join(', ')} off your list`
      );
    }
    carrying.current = refs;
  }, [board]);

  // A new rating from a customer
  const ratingCount = useRef<number | null>(null);
  useEffect(() => {
    if (!board) return;
    if (ratingCount.current !== null && board.rating.count > ratingCount.current) setToast('⭐ A customer just rated your delivery');
    ratingCount.current = board.rating.count;
  }, [board]);

  if (!board) {
    return (
      <div className="min-h-[100dvh] bg-[#FAF7F2] flex flex-col items-center justify-center gap-3 text-[#7A6458]">
        <AmoreLogo size="md" />
        {offline ? (
          <>
            <p className="font-semibold">No connection</p>
            <button type="button" onClick={reload} className="px-5 h-11 rounded-xl bg-[#8C102A] text-white font-bold cursor-pointer">
              Try again
            </button>
          </>
        ) : (
          <Loader2 className="w-6 h-6 animate-spin text-[#8C102A]" />
        )}
      </div>
    );
  }

  const { rider, ready, mine, done, upcoming } = board;
  const parlour = AMORE_BRANCHES.find((b) => b.id === rider.branchId);
  const parlourAt = zones[rider.branchId];
  const kmTo = (o: RiderOrder) => (o.deliveryCoordinates && parlourAt ? distanceKm(parlourAt, o.deliveryCoordinates) : null);
  const cashToday = done.reduce((s, o) => s + (o.cashCollectedLKR || 0), 0);
  const cashCarrying = mine.filter((o) => o.collectCash).reduce((s, o) => s + o.grandTotalLKR, 0);

  const run = async (ref: string, action: () => Promise<unknown>, message: string, nextTab?: Tab) => {
    actedOn.current.add(ref);
    try {
      await action();
      setSheet(null);
      setToast(message);
      if (nextTab) setTab(nextTab);
    } catch (err) {
      setSheet(null);
      setToast(err instanceof ApiError ? err.message : 'No connection. Try again.');
    } finally {
      reload();
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAF7F2] text-[#241A18]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#EDE3D4]">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center gap-3">
          {photo ? (
            <img src={photo} alt="" className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-[#8C102A] ring-offset-2 ring-offset-[#FAF7F2]" />
          ) : (
            <AmoreLogo size="sm" showShadow={false} />
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-bold truncate flex items-center gap-1.5">
              Hi, {rider.name.split(' ')[0]}
              {board.rating.average !== null && (
                <button type="button" onClick={() => setTab('ratings')} className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-800 bg-amber-100 rounded-full px-1.5 py-0.5 cursor-pointer">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {board.rating.average.toFixed(1)}
                </button>
              )}
            </p>
            <p className="text-xs text-[#7A6458] truncate">Rider · Amore {parlour?.name ?? rider.branchId}</p>
          </div>
          {offline ? (
            <span className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          )}
          <button type="button" onClick={reload} aria-label="Refresh" className="w-10 h-10 rounded-full bg-white border border-[#E8DFC8] flex items-center justify-center cursor-pointer active:scale-95">
            <RotateCw className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setSheet({ kind: 'signout' })} aria-label="Sign out" className="w-10 h-10 rounded-full bg-white border border-[#E8DFC8] flex items-center justify-center cursor-pointer active:scale-95">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-5 pb-32">
        {tab === 'ready' && (
          <section>
            <Title title="Ready to pick up" sub={`At Amore ${parlour?.name ?? ''}${upcoming ? ` · ${upcoming} more being prepared` : ''}`} />
            {ready.length === 0 ? (
              <Empty icon={<IceCreamCone className="w-8 h-8" />} title="Nothing ready right now">
                Orders show up here as soon as the kitchen packs them{upcoming ? ` — ${upcoming} ${upcoming === 1 ? 'is' : 'are'} being prepared` : ''}. You'll hear a chime.
              </Empty>
            ) : (
              <div className="space-y-3">
                {ready.map((o) => (
                  <article key={o.orderReference} className="bg-white rounded-3xl border border-[#E8DFC8] shadow-xs p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-[#8C102A]">{shortRef(o.orderReference)}</span>
                      <span className={`text-xs font-semibold ${minutesSince(o.readyAt) >= 10 ? 'text-red-700' : 'text-[#7A6458]'}`}>
                        Ready {agoText(o.readyAt)}
                      </span>
                    </div>
                    <p className="text-lg font-bold mt-1">{o.customerName}</p>
                    <p className="text-sm text-[#5C4D44] flex gap-1.5 mt-1">
                      <MapPin className="w-4 h-4 text-[#8C102A] shrink-0 mt-0.5" />
                      <span>
                        {[o.deliveryAddress, o.city].filter(Boolean).join(', ')}
                        {kmTo(o) !== null && <span className="text-[#8A7970]"> · {kmTo(o)!.toFixed(1)} km</span>}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Chip>
                        {o.items.reduce((s, i) => s + i.quantity, 0)} {o.items.reduce((s, i) => s + i.quantity, 0) === 1 ? 'item' : 'items'}
                      </Chip>
                      <PayChip order={o} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSheet({ kind: 'pickup', order: o })}
                      className="mt-4 w-full py-3.5 rounded-2xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <PackageCheck className="w-5 h-5 text-amber-200" /> Pick up
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'mine' && (
          <section>
            <Title title="On the way" sub={mine.length ? `${mine.length} ${mine.length === 1 ? 'order' : 'orders'} with you` : 'Orders you pick up show here'} />
            {mine.length === 0 ? (
              <Empty icon={<Bike className="w-8 h-8" />} title="You're not carrying any orders">
                Pick one up from the <strong>Ready</strong> tab.
              </Empty>
            ) : (
              <div className="space-y-4">
                {mine.map((o) => (
                  <article key={o.orderReference} className="bg-white rounded-3xl border border-[#E8DFC8] shadow-xs overflow-hidden">
                    <div className="px-4 pt-4 flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-[#8C102A]">{shortRef(o.orderReference)}</span>
                      <span className="text-xs font-semibold text-[#7A6458] inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Picked up {clock(o.onTheWayAt)} · {minutesSince(o.onTheWayAt)} min
                      </span>
                    </div>
                    <div className="px-4 pt-2">
                      <p className="text-xl font-bold">{o.customerName}</p>
                      <p className="text-[15px] text-[#3D2C24] mt-1 leading-snug">{[o.deliveryAddress, o.city].filter(Boolean).join(', ')}</p>
                      {o.specialNote && (
                        <p className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900 flex gap-2">
                          <StickyNote className="w-4 h-4 shrink-0 mt-0.5" /> {o.specialNote}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 mt-3">
                      <a href={directionsUrl(o)} target="_blank" rel="noopener noreferrer" className="action-tile">
                        <Navigation className="w-5 h-5" /> Navigate
                      </a>
                      <a href={`tel:${o.contactNumber}`} className="action-tile">
                        <Phone className="w-5 h-5" /> Call
                      </a>
                      <a href={whatsappUrl(o.contactNumber)} target="_blank" rel="noopener noreferrer" className="action-tile">
                        <MessageCircle className="w-5 h-5" /> WhatsApp
                      </a>
                    </div>
                    <ul className="mx-4 mt-3 rounded-2xl bg-[#FAF7F2] border border-[#EFE6D8] divide-y divide-[#EFE6D8]">
                      {o.items.map((i, k) => (
                        <li key={k} className="px-3 py-2 text-sm flex gap-2">
                          <span className="font-bold text-[#8C102A]">{i.quantity}×</span>
                          <span>
                            {i.name}
                            {i.format && <span className="text-[#8A7970]"> · {i.format.replace(/-/g, ' ')}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div
                      className={`mx-4 mt-3 rounded-2xl px-4 py-3 flex items-center gap-3 ${
                        o.collectCash ? 'bg-amber-50 border border-amber-200 text-amber-950' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      }`}
                    >
                      {o.collectCash ? <Banknote className="w-6 h-6 shrink-0" /> : <CreditCard className="w-6 h-6 shrink-0" />}
                      <span className="leading-tight">
                        <span className="block font-bold">
                          {o.collectCash ? `Collect ${lkr(o.grandTotalLKR)} cash` : `Paid by card${o.cardBrand ? ` (${o.cardBrand})` : ''}`}
                        </span>
                        <span className="block text-xs opacity-80">{o.collectCash ? 'Cash on delivery' : 'Paid online — don’t collect any cash'}</span>
                      </span>
                    </div>
                    <div className="p-4 space-y-2">
                      <button
                        type="button"
                        onClick={() => setSheet({ kind: 'deliver', order: o })}
                        className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                      >
                        <CheckCircle2 className="w-5 h-5" /> Delivered
                      </button>
                      <button type="button" onClick={() => setSheet({ kind: 'handback', order: o })} className="w-full py-2.5 text-sm font-bold text-[#8C102A] cursor-pointer">
                        Can't deliver?
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'done' && (
          <section>
            {nextDay && (
              <div className="mb-4 rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3 flex items-center gap-3 text-sky-900">
                <CalendarClock className="w-5 h-5 shrink-0" />
                <span className="min-w-0 flex-1 text-sm leading-snug">
                  <strong>Demo: tomorrow.</strong> This is how Done looks on the next day. Nothing is changed.
                </span>
                <button type="button" onClick={() => setNextDay(false)} className="shrink-0 h-9 px-3 rounded-xl bg-white border border-sky-300 text-sm font-bold cursor-pointer">
                  Back to today
                </button>
              </div>
            )}
            <Title title={nextDay ? 'Done tomorrow' : 'Done today'} sub={`${dayName(board.day)} · starts fresh every day`} />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-3xl border border-[#E8DFC8] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8A7970]">Delivered</p>
                <p className="text-3xl font-bold mt-1">{done.length}</p>
              </div>
              <div className="bg-white rounded-3xl border border-[#E8DFC8] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8A7970]">Cash collected</p>
                <p className="text-2xl font-bold mt-1 text-[#8C102A]">{lkr(cashToday)}</p>
              </div>
            </div>
            <EarlierCash cash={board.cash} />
            <CashCard cash={board.cash} carrying={cashCarrying} />
            {done.length === 0 ? (
              <Empty icon={<CheckCircle2 className="w-8 h-8" />} title={nextDay ? 'A fresh day' : 'No deliveries yet today'}>
                Today’s delivered orders show here.
              </Empty>
            ) : (
              <ul className="bg-white rounded-3xl border border-[#E8DFC8] divide-y divide-[#F0E8DC] overflow-hidden">
                {done.map((o) => (
                  <li key={o.orderReference} className="px-4 py-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold truncate">
                        {o.customerName} <span className="font-mono text-xs text-[#8A7970]">{shortRef(o.orderReference)}</span>
                      </span>
                      <span className="block text-xs text-[#7A6458] truncate">
                        {o.city || o.deliveryAddress} · {clock(o.deliveredAt)}
                      </span>
                      {o.deliveredBy === 'parlour' && <span className="block text-xs font-semibold text-[#8C102A]">Marked delivered by the parlour</span>}
                      {o.riderRating ? <Stars value={o.riderRating} size="w-3.5 h-3.5" className="mt-0.5" /> : null}
                    </span>
                    <span className="text-sm font-bold text-right whitespace-nowrap">
                      {o.cashCollectedLKR ? lkr(o.cashCollectedLKR) : <span className="text-[#8A7970] font-medium">{paidViaLabel(o) ?? '—'}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {tab === 'done' && RIDER_NEXT_DAY_DEMO && !nextDay && (
          <button
            type="button"
            onClick={() => (setNextDay(true), window.scrollTo({ top: 0 }))}
            className="mt-6 mx-auto flex items-center gap-2 h-10 px-4 rounded-full border border-dashed border-[#C9B9A4] text-sm font-semibold text-[#7A6458] cursor-pointer"
          >
            <CalendarClock className="w-4 h-4" /> Demo: see tomorrow
          </button>
        )}
        {tab === 'ratings' && <RatingsTab refresh={`${board.rating.count}-${done.length}`} />}
      </main>

      {/* Bottom tabs, like the shop's phone layout */}
      <nav aria-label="Rider" className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E8DFC8] shadow-[0_-4px_20px_rgba(36,26,24,0.06)] pb-safe">
        <div className="max-w-md mx-auto flex h-16">
          <TabButton active={tab === 'ready'} onClick={() => setTab('ready')} icon={<PackageCheck className="w-[22px] h-[22px]" />} label="Ready" count={ready.length} tone="bg-amber-400 text-[#5C1A00]" />
          <TabButton active={tab === 'mine'} onClick={() => setTab('mine')} icon={<Bike className="w-[22px] h-[22px]" />} label="On the way" count={mine.length} tone="bg-[#8C102A] text-white" />
          <TabButton active={tab === 'done'} onClick={() => setTab('done')} icon={<CheckCircle2 className="w-[22px] h-[22px]" />} label="Done" count={done.length} tone="bg-emerald-600 text-white" />
          <TabButton active={tab === 'ratings'} onClick={() => setTab('ratings')} icon={<Star className="w-[22px] h-[22px]" />} label="Ratings" count={0} tone="" />
        </div>
      </nav>

      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 max-w-[90vw] px-4 py-3 rounded-2xl bg-[#241A18] text-white text-sm font-semibold shadow-xl animate-toast-in">
          {toast}
        </div>
      )}

      {sheet?.kind === 'pickup' && sheet.order && (
        <PickupSheet order={sheet.order} onClose={() => setSheet(null)} onConfirm={() => run(sheet.order!.orderReference, () => pickUp(sheet.order!.orderReference), 'Picked up — ride safe!', 'mine')} />
      )}
      {sheet?.kind === 'deliver' && sheet.order && (
        <DeliverSheet
          order={sheet.order}
          onClose={() => setSheet(null)}
          onConfirm={(cash) => run(sheet.order!.orderReference, () => markDelivered(sheet.order!.orderReference, cash), 'Delivered — well done!', mine.length > 1 ? 'mine' : 'done')}
        />
      )}
      {sheet?.kind === 'handback' && sheet.order && (
        <HandBackSheet
          order={sheet.order}
          onClose={() => setSheet(null)}
          onConfirm={(reason) => run(sheet.order!.orderReference, () => handBack(sheet.order!.orderReference, reason), 'Handed back — please bring it to the parlour', 'ready')}
        />
      )}
      {sheet?.kind === 'signout' && (
        <Sheet title="Sign out?" onClose={() => setSheet(null)}>
          <p className="text-[#5C4D44]">{mine.length ? `You still have ${mine.length} ${mine.length === 1 ? 'order' : 'orders'} on the way. ` : ''}You can sign in again with your phone number and PIN.</p>
          <button
            type="button"
            onClick={() => {
              riderSignOut();
              onSignedOut(null);
            }}
            className="mt-5 w-full py-3.5 rounded-2xl bg-[#8C102A] text-white font-bold cursor-pointer"
          >
            Sign out
          </button>
        </Sheet>
      )}
    </div>
  );
};

// ---- Sheets -------------------------------------------------------------------------------

const PickupSheet: React.FC<{ order: RiderOrder; onClose: () => void; onConfirm: () => Promise<void> }> = ({ order, onClose, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={`Pick up ${shortRef(order.orderReference)}?`} onClose={onClose}>
      <p className="text-sm text-[#5C4D44]">Check you have everything before you leave:</p>
      <ul className="mt-3 rounded-2xl bg-[#FAF7F2] border border-[#EFE6D8] divide-y divide-[#EFE6D8]">
        {order.items.map((i, k) => (
          <li key={k} className="px-3 py-2.5 flex gap-2">
            <span className="font-bold text-[#8C102A]">{i.quantity}×</span>
            <span>
              {i.name}
              {i.format && <span className="text-[#8A7970]"> · {i.format.replace(/-/g, ' ')}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-[#5C4D44]">
        {order.collectCash ? (
          <>
            Collect <strong>{lkr(order.grandTotalLKR)}</strong> in cash at the door.
          </>
        ) : (
          'Paid by card — nothing to collect.'
        )}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm();
        }}
        className="mt-5 w-full py-3.5 rounded-2xl bg-[#8C102A] text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackageCheck className="w-5 h-5 text-amber-200" />}
        Yes, I have it
      </button>
    </Sheet>
  );
};

const DeliverSheet: React.FC<{ order: RiderOrder; onClose: () => void; onConfirm: (cash: boolean) => Promise<void> }> = ({ order, onClose, onConfirm }) => {
  const [cash, setCash] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = !order.collectCash || cash;
  return (
    <Sheet title={`Delivered to ${order.customerName}?`} onClose={onClose}>
      {order.collectCash ? (
        <label className="flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-4 cursor-pointer">
          <input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} className="w-6 h-6 accent-[#8C102A]" />
          <span className="font-semibold text-amber-950">I collected {lkr(order.grandTotalLKR)} in cash</span>
        </label>
      ) : (
        <p className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-emerald-900 font-semibold">Paid by card — nothing to collect.</p>
      )}
      <button
        type="button"
        disabled={!ready || busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm(cash);
        }}
        className="mt-5 w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
        Confirm delivered
      </button>
    </Sheet>
  );
};

const REASONS = ['Customer not answering', 'Wrong or unclear address', 'Customer refused the order', 'Other'];

const HandBackSheet: React.FC<{ order: RiderOrder; onClose: () => void; onConfirm: (reason: string) => Promise<void> }> = ({ order, onClose, onConfirm }) => {
  const [choice, setChoice] = useState(REASONS[0]);
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const reason = choice === 'Other' ? other.trim() : choice;
  return (
    <Sheet title="Can't deliver?" onClose={onClose}>
      <p className="text-sm text-[#5C4D44]">
        Try calling {order.customerName} first. If you still can't deliver, the order goes back to the parlour's ready list — bring it back.
      </p>
      <div className="mt-3 space-y-2">
        {REASONS.map((r) => (
          <label key={r} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer ${choice === r ? 'border-[#8C102A] bg-red-50/60' : 'border-[#E8DFC8] bg-white'}`}>
            <input type="radio" name="reason" checked={choice === r} onChange={() => setChoice(r)} className="w-5 h-5 accent-[#8C102A]" />
            <span className="font-semibold">{r}</span>
          </label>
        ))}
        {choice === 'Other' && (
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            maxLength={200}
            placeholder="What happened?"
            className="w-full h-12 px-4 rounded-2xl border border-[#E0D5C3] bg-white outline-hidden focus:border-[#8C102A]"
          />
        )}
      </div>
      <button
        type="button"
        disabled={reason.length < 3 || busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm(reason);
        }}
        className="mt-5 w-full py-3.5 rounded-2xl bg-[#8C102A] text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {busy && <Loader2 className="w-5 h-5 animate-spin" />}
        Hand back to the parlour
      </button>
    </Sheet>
  );
};

// ---- Cash and ratings -------------------------------------------------------------------

/** "Thursday, 23 October" for a day like "2026-10-23" */
const dayName = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
const earlierTotal = (cash: RiderCash) => cash.earlier.reduce((s, d) => s + d.amountLKR, 0);

/** Cash from earlier days that hasn't been handed in yet (Done starts fresh each day, this doesn't) */
const EarlierCash: React.FC<{ cash: RiderCash }> = ({ cash }) => {
  if (!cash.earlier.length) return null;
  return (
    <div className="mb-4 rounded-3xl border-2 border-red-200 bg-red-50 p-4 text-red-950">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
          <TriangleAlert className="w-6 h-6" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-xs font-bold uppercase tracking-wider text-red-700">Pending from earlier days</span>
          <span className="block text-2xl font-bold">{lkr(earlierTotal(cash))}</span>
        </span>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {cash.earlier.map((d) => (
          <li key={d.day} className="flex justify-between gap-3">
            <span>
              {new Date(`${d.day}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · {d.deliveries}{' '}
              {d.deliveries === 1 ? 'delivery' : 'deliveries'}
            </span>
            <strong>{lkr(d.amountLKR)}</strong>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm font-semibold">Not handed in yet — please give it to the parlour first.</p>
    </div>
  );
};

/** Today's cash from cash-on-delivery orders, until the rider hands it in at the parlour */
const CashCard: React.FC<{ cash: RiderCash; carrying: number }> = ({ cash, carrying }) => {
  const earlier = earlierTotal(cash);
  const today = cash.holdingLKR - earlier;
  const holding = today > 0;
  return (
    <div className={`mb-4 rounded-3xl border p-4 ${holding ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#E8DFC8]'}`}>
      <div className="flex items-center gap-3">
        <span
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
            holding ? 'bg-amber-200 text-amber-900' : earlier > 0 ? 'bg-[#F3EDE3] text-[#7A6458]' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {holding || earlier > 0 ? <Banknote className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-xs font-bold uppercase tracking-wider text-[#8A7970]">Today’s cash with you</span>
          <span className={`block text-2xl font-bold ${holding ? 'text-amber-950' : earlier > 0 ? 'text-[#3D2C24]' : 'text-emerald-700'}`}>
            {holding ? lkr(today) : earlier > 0 ? 'None yet today' : 'All handed in'}
          </span>
        </span>
      </div>
      {holding && <p className="mt-2 text-sm text-amber-950">Hand it in at the parlour — they’ll record it.</p>}
      {earlier > 0 && (
        <p className="mt-1 text-sm text-[#5C4D44]">
          With earlier days: <strong>{lkr(cash.holdingLKR)}</strong> in all.
        </p>
      )}
      {carrying > 0 && <p className="mt-1 text-sm text-[#5C4D44]">Plus {lkr(carrying)} to collect on deliveries you’re carrying.</p>}
      {cash.lastHandIn && (
        <p className="mt-2 pt-2 border-t border-black/5 text-xs text-[#7A6458]">
          Last handed in: <strong className="text-[#3D2C24]">{lkr(cash.lastHandIn.amountLKR)}</strong> · {dayOrClock(cash.lastHandIn.receivedAt)}
          {cash.lastHandIn.receivedBy && <> · to {cash.lastHandIn.receivedBy}</>}
        </p>
      )}
    </div>
  );
};

/** The stars customers gave (loaded when the tab opens, and on a new rating). Comments go to the parlour only. */
const RatingsTab: React.FC<{ refresh: string }> = ({ refresh }) => {
  const [data, setData] = useState<RiderRatings | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadRatings()
      .then((r) => (setData(r), setFailed(false)))
      .catch(() => setFailed(true));
  }, [refresh]);

  return (
    <section>
      <Title title="Your ratings" sub="Stars from your customers after each delivery" />
      {!data ? (
        failed ? (
          <Empty icon={<WifiOff className="w-8 h-8" />} title="Couldn’t load your ratings">
            Check your connection.
          </Empty>
        ) : (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#8C102A]" />
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-3xl border border-[#E8DFC8] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#8A7970]">Total deliveries</p>
              <p className="text-3xl font-bold mt-1">{data.deliveries.total}</p>
            </div>
            <div className="bg-white rounded-3xl border border-[#E8DFC8] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#8A7970]">This month</p>
              <p className="text-3xl font-bold mt-1">{data.deliveries.thisMonth}</p>
            </div>
          </div>
          {data.count === 0 ? (
            <Empty icon={<Star className="w-8 h-8" />} title="No ratings yet">
              Customers rate you right after a delivery. Their stars show up here.
            </Empty>
          ) : (
            <>
              <div className="bg-white rounded-3xl border border-[#E8DFC8] p-5 flex items-center gap-5">
                <div className="text-center shrink-0">
                  <p className="text-5xl font-bold text-[#241A18] leading-none">{data.average!.toFixed(1)}</p>
                  <Stars value={data.average!} size="w-4 h-4" className="mt-2" />
                  <p className="text-xs text-[#7A6458] mt-1">
                    {data.count} {data.count === 1 ? 'rating' : 'ratings'}
                  </p>
                </div>
                <ul className="flex-1 space-y-1.5" aria-label="Ratings by stars">
                  {[5, 4, 3, 2, 1].map((s) => {
                    const n = data.breakdown[s] || 0;
                    return (
                      <li key={s} className="flex items-center gap-2 text-xs text-[#5C4D44]">
                        <span className="w-6 inline-flex items-center gap-0.5 font-semibold">
                          {s}
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </span>
                        <span className="flex-1 h-2 rounded-full bg-[#F3EDE3] overflow-hidden">
                          <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(n / data.count) * 100}%` }} />
                        </span>
                        <span className="w-6 text-right tabular-nums">{n}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <h2 className="font-bold mt-6 mb-3">Latest ratings</h2>
              <ul className="space-y-2">
                {data.recent.map((r) => (
                  <li key={r.orderReference} className="bg-white rounded-2xl border border-[#E8DFC8] px-4 py-3 flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <Stars value={r.rating} />
                      <span className="block mt-1 text-xs text-[#7A6458]">
                        {r.customerFirstName} · {shortRef(r.orderReference)}
                      </span>
                    </span>
                    <span className="text-xs text-[#8A7970] whitespace-nowrap">{dayOrClock(r.ratedAt)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
};

// ---- Small pieces -------------------------------------------------------------------------

const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-fadeIn" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
    <div
      className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto animate-sheet-up"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-serif-title text-xl font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-[#F3EDE3] flex items-center justify-center cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Title: React.FC<{ title: string; sub: string }> = ({ title, sub }) => (
  <div className="mb-4">
    <h1 className="font-serif-title text-2xl font-bold">{title}</h1>
    <p className="text-sm text-[#7A6458] mt-0.5">{sub}</p>
  </div>
);

const Empty: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-white rounded-3xl border border-dashed border-[#E0D5C3] px-6 py-10 text-center">
    <span className="mx-auto w-16 h-16 rounded-full bg-[#8C102A]/8 text-[#8C102A] flex items-center justify-center">{icon}</span>
    <p className="font-bold text-lg mt-4">{title}</p>
    <p className="text-sm text-[#7A6458] mt-1">{children}</p>
  </div>
);

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-[#F3EDE3] text-xs font-semibold text-[#5C4D44]">{children}</span>
);

const PayChip: React.FC<{ order: RiderOrder }> = ({ order }) =>
  order.collectCash ? (
    <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
      <Banknote className="w-3.5 h-3.5" /> Collect {lkr(order.grandTotalLKR)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
      <CreditCard className="w-3.5 h-3.5" /> Paid by card
    </span>
  );

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number; tone: string }> = ({
  active,
  onClick,
  icon,
  label,
  count,
  tone,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`press relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold cursor-pointer ${active ? 'text-[#8C102A]' : 'text-[#7A6458]'}`}
  >
    <span className="relative">
      {icon}
      {count > 0 && <span className={`absolute -top-1.5 -right-3 min-w-5 h-5 px-1 rounded-full text-[11px] font-black flex items-center justify-center ${tone}`}>{count}</span>}
    </span>
    <span>{label}</span>
  </button>
);
