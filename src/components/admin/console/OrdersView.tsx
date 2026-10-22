import React, { useMemo, useState } from 'react';
import { Search, Plus, MapPin, Bike, Store, StickyNote, Clock, Inbox, ChefHat, PackageCheck, X } from 'lucide-react';
import { OrderRecord } from '../../../types';
import { isCapturedReturnedBill } from '../../../utils/orderStorage';
import { formatPrice } from '../../../utils/currency';
import { Badge, Button, Card, EmptyState, cx, inputClass, useConsoleUi, DOT, Tone } from './ui';
import {
  Stage,
  clockTime,
  formatLabel,
  graceOf,
  isPickup,
  itemCount,
  mmss,
  nextStep,
  paymentLabel,
  shortRef,
  stageOf,
  statusLabel,
  timeAgo,
} from './orderMeta';
import { advanceOrder } from './orderActions';
import { BranchFilter, inBranch, useNow } from './useConsoleData';

const lkr = (n: number) => formatPrice(n, 'LKR');
const isSystemNote = (n?: string) => !n || n === 'Manual Admin Order';

// ---- Next-step button (owns its own clock for the customer's change window) ----

export const NextStepButton: React.FC<{ order: OrderRecord; size?: 'md' | 'lg'; className?: string }> = ({ order, size = 'md', className }) => {
  const { toast } = useConsoleUi();
  const now = useNow(1000);
  const next = nextStep(order);
  if (!next) return null;
  const grace = graceOf(order, now);

  const go = (e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = advanceOrder(order);
    if (msg) toast(msg);
  };

  if (grace.state === 'counting') {
    return (
      <div className={cx('text-right', className)}>
        <Button size={size} variant="secondary" disabled className="w-full sm:w-auto" icon={<Clock className="w-4 h-4" />}>
          Accept in {mmss(grace.remaining)}
        </Button>
        <p className="text-[11px] text-[#8A7970] mt-1">Customer can still change it</p>
      </div>
    );
  }
  if (grace.state === 'editing') {
    return (
      <div className={cx('text-right', className)}>
        <Button size={size} variant={grace.canOverride ? 'primary' : 'secondary'} disabled={!grace.canOverride} onClick={go} className="w-full sm:w-auto">
          {grace.canOverride ? 'Accept anyway' : 'Customer is editing…'}
        </Button>
        {!grace.canOverride && <p className="text-[11px] text-[#8A7970] mt-1">Wait for them to finish</p>}
      </div>
    );
  }
  return (
    <Button size={size} variant={next.step === 'finish' ? 'success' : 'primary'} onClick={go} className={cx('w-full sm:w-auto', className)}>
      {next.label}
    </Button>
  );
};

// ---- Order card (board) ----

const OrderCard: React.FC<{ order: OrderRecord; showBranch: boolean; onOpen: () => void }> = ({ order, showBranch, onOpen }) => {
  const s = statusLabel(order);
  const items = order.items;
  const shown = items.slice(0, 4);
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      className={cx(
        'p-4 cursor-pointer hover:border-[#C9B9A4] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#81001E]/30 transition-colors',
        order.status === 'pending_confirmation' && 'new-order-pulse border-amber-300'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base font-bold text-[#241A18]">{shortRef(order.orderReference)}</span>
            <Badge tone={isPickup(order) ? 'violet' : 'blue'}>
              {isPickup(order) ? <Store className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
              {isPickup(order) ? 'Pickup' : 'Delivery'}
            </Badge>
            {showBranch && <span className="text-xs text-[#7A6458]">{order.branchName}</span>}
          </div>
          <p className="mt-1 font-semibold text-[#241A18] truncate">{order.customerName}</p>
        </div>
        <span className="text-xs text-[#8A7970] whitespace-nowrap pt-1">{timeAgo(order.createdAt)}</span>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {shown.map((i, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="font-bold text-[#81001E] w-7 shrink-0">{i.quantity}×</span>
            <span className="text-[#241A18]">
              {i.name}
              {i.format && <span className="text-[#8A7970]"> · {formatLabel(i.format)}</span>}
            </span>
          </li>
        ))}
        {items.length > shown.length && <li className="text-xs text-[#8A7970] pl-9">+{items.length - shown.length} more</li>}
      </ul>

      {!isPickup(order) && order.deliveryAddress && (
        <p className="mt-3 text-sm text-[#5C4D44] flex gap-1.5">
          <MapPin className="w-4 h-4 text-[#81001E] shrink-0 mt-0.5" />
          <span className="line-clamp-2">
            {order.deliveryAddress}
            {order.city ? `, ${order.city}` : ''}
          </span>
        </p>
      )}
      {!isSystemNote(order.specialNote) && (
        <p className="mt-2 text-sm bg-amber-50 text-amber-900 rounded-lg px-2.5 py-1.5 flex gap-1.5">
          <StickyNote className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{order.specialNote}</span>
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-[#F0E8DC] flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-bold text-[#241A18]">{lkr(order.grandTotalLKR)}</p>
          <p className="text-xs text-[#7A6458]">{paymentLabel(order)}</p>
        </div>
        {nextStep(order) ? (
          <NextStepButton order={order} className="flex-1 sm:flex-none" />
        ) : (
          <Badge tone={s.tone} dot>
            {s.label}
          </Badge>
        )}
      </div>
    </Card>
  );
};

// ---- Compact row (completed / cancelled / search) ----

const OrderRow: React.FC<{ order: OrderRecord; showBranch: boolean; onOpen: () => void }> = ({ order, showBranch, onOpen }) => {
  const s = statusLabel(order);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#FBF8F3] cursor-pointer focus:outline-hidden focus-visible:bg-[#FBF8F3]"
    >
      <span className={cx('w-2 h-2 rounded-full shrink-0', DOT[s.tone])} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm text-[#241A18]">{shortRef(order.orderReference)}</span>
          <span className="font-medium text-sm text-[#241A18] truncate">{order.customerName}</span>
        </span>
        <span className="block text-xs text-[#7A6458] truncate">
          {itemCount(order)} item{itemCount(order) === 1 ? '' : 's'} · {isPickup(order) ? 'Pickup' : 'Delivery'}
          {showBranch ? ` · ${order.branchName}` : ''} · {clockTime(order.createdAt)}
        </span>
      </span>
      <span className="text-right shrink-0">
        <span className="block font-semibold text-sm text-[#241A18]">{lkr(order.grandTotalLKR)}</span>
        <span className="block text-xs text-[#7A6458]">{s.label}</span>
      </span>
    </button>
  );
};

function dayHeading(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

const GroupedList: React.FC<{ orders: OrderRecord[]; showBranch: boolean; onOpen: (o: OrderRecord) => void; empty: React.ReactNode }> = ({
  orders,
  showBranch,
  onOpen,
  empty,
}) => {
  const [limit, setLimit] = useState(30);
  if (orders.length === 0) return <Card>{empty}</Card>;
  const visible = orders.slice(0, limit);
  const groups: { day: string; list: OrderRecord[] }[] = [];
  visible.forEach((o) => {
    const day = dayHeading(o.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.list.push(o);
    else groups.push({ day, list: [o] });
  });
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.day}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A7970] mb-2 px-1">
            {g.day} <span className="font-semibold">· {g.list.length}</span>
          </h3>
          <Card className="divide-y divide-[#F0E8DC] overflow-hidden">
            {g.list.map((o) => (
              <OrderRow key={o.orderReference} order={o} showBranch={showBranch} onOpen={() => onOpen(o)} />
            ))}
          </Card>
        </section>
      ))}
      {orders.length > limit && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => setLimit((l) => l + 30)}>
            Show more ({orders.length - limit} left)
          </Button>
        </div>
      )}
    </div>
  );
};

// ---- Board ----

const COLUMNS: { stage: Exclude<Stage, 'done' | 'cancelled'>; title: string; hint: string; tone: Tone; icon: React.ReactNode }[] = [
  { stage: 'new', title: 'New', hint: 'Check and accept', tone: 'amber', icon: <Inbox className="w-4 h-4" /> },
  { stage: 'preparing', title: 'Preparing', hint: 'In the kitchen', tone: 'violet', icon: <ChefHat className="w-4 h-4" /> },
  { stage: 'ready', title: 'Ready / Out', hint: 'Pickup or delivery', tone: 'blue', icon: <PackageCheck className="w-4 h-4" /> },
];

type View = 'active' | 'completed' | 'cancelled';

export const OrdersView: React.FC<{
  orders: OrderRecord[];
  branch: BranchFilter;
  onOpenOrder: (o: OrderRecord) => void;
  onNewOrder: () => void;
}> = ({ orders, branch, onOpenOrder, onNewOrder }) => {
  const [view, setView] = useState<View>('active');
  const [mobileStage, setMobileStage] = useState<Stage>('new');
  const [query, setQuery] = useState('');
  const showBranch = branch === 'all';

  // Refund records live in Refunds, not here
  const scoped = useMemo(() => orders.filter((o) => inBranch(o, branch) && !isCapturedReturnedBill(o)), [orders, branch]);

  const byStage = useMemo(() => {
    const m: Record<Stage, OrderRecord[]> = { new: [], preparing: [], ready: [], done: [], cancelled: [] };
    scoped.forEach((o) => m[stageOf(o)].push(o));
    // Oldest first on the board so the longest-waiting order is on top
    (['new', 'preparing', 'ready'] as Stage[]).forEach((s) => m[s].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    return m;
  }, [scoped]);

  const q = query.trim().toLowerCase();
  const results = q
    ? scoped.filter((o) =>
        [o.orderReference, o.customerName, o.contactNumber, o.city, o.deliveryAddress].some((f) => (f || '').toLowerCase().includes(q))
      )
    : [];

  const activeCount = byStage.new.length + byStage.preparing.length + byStage.ready.length;
  const views: { id: View; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'completed', label: 'Completed', count: byStage.done.length },
    { id: 'cancelled', label: 'Cancelled', count: byStage.cancelled.length },
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex p-1 bg-[#F3EDE3] rounded-xl self-start" role="tablist" aria-label="Order lists">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id && !q}
              onClick={() => {
                setView(v.id);
                setQuery('');
              }}
              className={cx(
                'h-9 px-3.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer',
                view === v.id && !q ? 'bg-white text-[#241A18] shadow-sm' : 'text-[#6B5A51] hover:text-[#241A18]'
              )}
            >
              {v.label} <span className="text-[#A8988B] font-medium">{v.count}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-[#A8988B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find order, name or phone"
              aria-label="Search orders"
              className={cx(inputClass, 'pl-9 pr-9')}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#8A7970] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button variant="primary" onClick={onNewOrder} icon={<Plus className="w-4 h-4" />}>
            <span className="hidden sm:inline">New order</span>
          </Button>
        </div>
      </div>

      {q ? (
        <div>
          <p className="text-sm text-[#6B5A51] mb-3">
            {results.length} result{results.length === 1 ? '' : 's'} for “{query}”
          </p>
          <GroupedList orders={results} showBranch={showBranch} onOpen={onOpenOrder} empty={<EmptyState title="No matching orders" />} />
        </div>
      ) : view === 'active' ? (
        <>
          {/* Phones/tablets: pick a stage */}
          <div className="lg:hidden grid grid-cols-3 gap-2">
            {COLUMNS.map((c) => (
              <button
                key={c.stage}
                type="button"
                onClick={() => setMobileStage(c.stage)}
                className={cx(
                  'rounded-xl border px-2 py-2.5 text-center cursor-pointer transition-colors',
                  mobileStage === c.stage ? 'bg-white border-[#81001E] shadow-sm' : 'bg-white/60 border-[#EAE2D6]'
                )}
              >
                <span className="block text-2xl font-bold text-[#241A18] leading-none">{byStage[c.stage].length}</span>
                <span className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-[#5C4D44]">
                  <span className={cx('w-1.5 h-1.5 rounded-full', DOT[c.tone])} />
                  {c.title}
                </span>
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-4 lg:gap-5 items-start">
            {COLUMNS.map((c) => {
              const list = byStage[c.stage];
              return (
                <section key={c.stage} className={cx(c.stage !== mobileStage && 'hidden', 'lg:block')} aria-label={c.title}>
                  <header className="hidden lg:flex items-center justify-between mb-3 px-1">
                    <h2 className="flex items-center gap-2 font-bold text-[#241A18]">
                      <span className={cx('w-2.5 h-2.5 rounded-full', DOT[c.tone])} />
                      {c.title}
                      <span className="text-[#A8988B] font-semibold">{list.length}</span>
                    </h2>
                    <span className="text-xs text-[#8A7970] whitespace-nowrap">{c.hint}</span>
                  </header>
                  <div className="space-y-3">
                    {list.length === 0 ? (
                      <div className="rounded-2xl border-2 border-dashed border-[#E6DCCD] py-10 text-center text-sm text-[#A8988B]">
                        {c.stage === 'new' ? 'No new orders right now' : 'Nothing here'}
                      </div>
                    ) : (
                      list.map((o) => <OrderCard key={o.orderReference} order={o} showBranch={showBranch} onOpen={() => onOpenOrder(o)} />)
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <GroupedList
          orders={byStage[view === 'completed' ? 'done' : 'cancelled']}
          showBranch={showBranch}
          onOpen={onOpenOrder}
          empty={<EmptyState title={view === 'completed' ? 'No completed orders yet' : 'No cancelled orders'} />}
        />
      )}
    </div>
  );
};
