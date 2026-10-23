import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, MapPin, Bike, Store, StickyNote, Clock, X, BellRing, ListOrdered } from 'lucide-react';
import { OrderRecord } from '../../../types';
import { isCapturedReturnedBill } from '../../../utils/orderStorage';
import { formatPrice } from '../../../utils/currency';
import { Badge, Button, Card, EmptyState, cx, inputClass, useConsoleUi } from './ui';
import { Stage, clockTime, formatLabel, graceOf, isPickup, mmss, nextStep, paymentLabel, shortRef, stageOf, timeAgo } from './orderMeta';
import { advanceOrder } from './orderActions';
import { BranchFilter, inBranch, useNow } from './useConsoleData';
import { ConeIcon, ScooterIcon, StatusPill } from './StatusPill';

const lkr = (n: number) => formatPrice(n, 'LKR');
const isSystemNote = (n?: string) => !n || n === 'Manual Admin Order';

// ---- Next-step button (owns its own clock for the customer's change window) ----

export const NextStepButton: React.FC<{ order: OrderRecord; size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ order, size = 'md', className }) => {
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
      <div className={cx('text-right', className)} onClick={(e) => e.stopPropagation()}>
        <Button size={size} variant="secondary" disabled className="w-full whitespace-nowrap" icon={<Clock className="w-4 h-4" />}>
          Accept in {mmss(grace.remaining)}
        </Button>
        <p className="text-[11px] text-[#8A7970] mt-1 whitespace-nowrap">Customer can still change it</p>
      </div>
    );
  }
  if (grace.state === 'editing') {
    return (
      <div className={cx('text-right', className)} onClick={(e) => e.stopPropagation()}>
        <Button size={size} variant={grace.canOverride ? 'primary' : 'secondary'} disabled={!grace.canOverride} onClick={go} className="w-full whitespace-nowrap">
          {grace.canOverride ? 'Accept anyway' : 'Customer is editing…'}
        </Button>
        {!grace.canOverride && <p className="text-[11px] text-[#8A7970] mt-1">Wait for them to finish</p>}
      </div>
    );
  }
  return (
    <span className={cx('block text-right', className)}>
      <Button size={size} variant={next.quiet ? 'secondary' : next.step === 'finish' ? 'success' : 'primary'} onClick={go} className="w-full whitespace-nowrap">
        {next.label}
      </Button>
      {next.quiet && <span className="block text-[11px] text-[#8A7970] mt-1 whitespace-nowrap">A rider with the app picks it up</span>}
    </span>
  );
};

// ---- Table ----

function dayHeading(iso: string) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return 'Today';
  if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

const ItemsList: React.FC<{ order: OrderRecord; max?: number }> = ({ order, max = 3 }) => {
  const shown = order.items.slice(0, max);
  return (
    <ul className="space-y-0.5 text-sm">
      {shown.map((i, idx) => (
        <li key={idx} className="leading-snug">
          <span className="font-bold text-[#81001E]">{i.quantity}×</span> {i.name}
          {i.format && <span className="text-[#8A7970]"> · {formatLabel(i.format)}</span>}
        </li>
      ))}
      {order.items.length > max && <li className="text-xs text-[#8A7970]">+{order.items.length - max} more</li>}
    </ul>
  );
};

const TypeCell: React.FC<{ order: OrderRecord; showBranch: boolean }> = ({ order, showBranch }) => (
  <div className="space-y-1">
    <Badge tone={isPickup(order) ? 'violet' : 'blue'}>
      {isPickup(order) ? <Store className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
      {isPickup(order) ? 'Pickup' : 'Delivery'}
    </Badge>
    {showBranch && <p className="text-xs text-[#7A6458]">{order.branchName}</p>}
    {!isPickup(order) && order.deliveryAddress && (
      <p className="text-xs text-[#5C4D44] flex gap-1 max-w-[14rem]">
        <MapPin className="w-3.5 h-3.5 text-[#81001E] shrink-0" />
        <span className="line-clamp-2">
          {order.deliveryAddress}
          {order.city ? `, ${order.city}` : ''}
        </span>
      </p>
    )}
  </div>
);

const NoteLine: React.FC<{ order: OrderRecord }> = ({ order }) =>
  isSystemNote(order.specialNote) ? null : (
    <p className="mt-1.5 text-xs bg-amber-50 text-amber-900 rounded-md px-2 py-1 inline-flex gap-1 max-w-[18rem]">
      <StickyNote className="w-3.5 h-3.5 shrink-0" />
      <span className="line-clamp-2">{order.specialNote}</span>
    </p>
  );

const OrdersTable: React.FC<{
  orders: OrderRecord[];
  showBranch: boolean;
  groupByDay: boolean;
  flashing: Set<string>;
  onOpen: (o: OrderRecord) => void;
}> = ({ orders, showBranch, groupByDay, flashing, onOpen }) => {
  const [limit, setLimit] = useState(30);
  const visible = orders.slice(0, limit);
  const hasActions = orders.some((o) => nextStep(o));

  const rows: ({ day: string } | { order: OrderRecord })[] = [];
  visible.forEach((o, i) => {
    if (groupByDay) {
      const day = dayHeading(o.createdAt);
      if (i === 0 || dayHeading(visible[i - 1].createdAt) !== day) rows.push({ day });
    }
    rows.push({ order: o });
  });

  const open = (o: OrderRecord) => (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onOpen(o);
  };

  return (
    <div className="@container">
      {/* Enough room: a real table. Narrower: the same rows stacked, so the action button is never cut off. */}
      <Card className="hidden @3xl:block overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#FBF8F3] border-b border-[#EAE2D6]">
            <tr className="text-xs font-bold uppercase tracking-wider text-[#8A7970]">
              <th className="py-3 pl-5 pr-3 font-bold">Order & customer</th>
              <th className="py-3 px-3 font-bold">Items</th>
              <th className="py-3 px-3 font-bold text-right">Total</th>
              <th className="py-3 px-3 font-bold">Status</th>
              {hasActions && <th className="py-3 pl-3 pr-5 font-bold text-right">Next step</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0E8DC]">
            {rows.map((r) =>
              'day' in r ? (
                <tr key={`d-${r.day}`} className="bg-[#FBF8F3]/60">
                  <td colSpan={hasActions ? 5 : 4} className="py-2 pl-5 text-xs font-bold uppercase tracking-wider text-[#8A7970]">
                    {r.day}
                  </td>
                </tr>
              ) : (
                <tr
                  key={r.order.orderReference}
                  tabIndex={0}
                  onClick={open(r.order)}
                  onKeyDown={open(r.order)}
                  className={cx(
                    'align-top cursor-pointer hover:bg-[#FBF8F3] focus:outline-hidden focus-visible:bg-[#FBF8F3] transition-colors',
                    flashing.has(r.order.orderReference) && 'row-flash'
                  )}
                >
                  <td className={cx('py-4 pl-5 pr-3 min-w-[12rem]', r.order.status === 'pending_confirmation' && 'shadow-[inset_4px_0_0_#F59E0B]')}>
                    <p className="flex items-baseline gap-2">
                      <span className="font-mono font-bold text-[#241A18]">{shortRef(r.order.orderReference)}</span>
                      <span className="text-xs text-[#8A7970] whitespace-nowrap">{groupByDay ? clockTime(r.order.createdAt) : timeAgo(r.order.createdAt)}</span>
                    </p>
                    <p className="font-semibold text-[#241A18] mt-0.5">{r.order.customerName}</p>
                    <p className="text-xs text-[#7A6458] whitespace-nowrap mb-1.5">{r.order.contactNumber}</p>
                    <TypeCell order={r.order} showBranch={showBranch} />
                  </td>
                  <td className="py-4 px-3 min-w-[11rem]">
                    <ItemsList order={r.order} />
                    <NoteLine order={r.order} />
                  </td>
                  <td className="py-4 px-3 text-right">
                    <p className="font-bold text-[#241A18] whitespace-nowrap">{lkr(r.order.grandTotalLKR)}</p>
                    <p className="text-xs text-[#7A6458] whitespace-nowrap">{paymentLabel(r.order)}</p>
                  </td>
                  <td className="py-4 px-3">
                    <StatusPill order={r.order} />
                  </td>
                  {hasActions && (
                    <td className="py-4 pl-2 pr-5 text-right w-44">
                      <NextStepButton order={r.order} size="sm" />
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </Card>

      <Card className="@3xl:hidden divide-y divide-[#F0E8DC] overflow-hidden">
        {rows.map((r) =>
          'day' in r ? (
            <p key={`d-${r.day}`} className="px-4 py-2 bg-[#FBF8F3] text-xs font-bold uppercase tracking-wider text-[#8A7970]">
              {r.day}
            </p>
          ) : (
            <div
              key={r.order.orderReference}
              role="button"
              tabIndex={0}
              onClick={open(r.order)}
              onKeyDown={open(r.order)}
              className={cx(
                'px-4 py-4 cursor-pointer active:bg-[#FBF8F3]',
                r.order.status === 'pending_confirmation' && 'shadow-[inset_4px_0_0_#F59E0B]',
                flashing.has(r.order.orderReference) && 'row-flash'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#241A18]">{shortRef(r.order.orderReference)}</span>
                    <span className="text-xs text-[#8A7970]">{groupByDay ? clockTime(r.order.createdAt) : timeAgo(r.order.createdAt)}</span>
                  </p>
                  <p className="font-semibold text-[#241A18] truncate">{r.order.customerName}</p>
                </div>
                <StatusPill order={r.order} />
              </div>
              <div className="mt-2">
                <ItemsList order={r.order} />
                <NoteLine order={r.order} />
              </div>
              <div className="mt-2">
                <TypeCell order={r.order} showBranch={showBranch} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="font-bold text-[#241A18]">{lkr(r.order.grandTotalLKR)}</p>
                  <p className="text-xs text-[#7A6458]">{paymentLabel(r.order)}</p>
                </div>
                {nextStep(r.order) && <NextStepButton order={r.order} className="flex-1 max-w-[13rem]" />}
              </div>
            </div>
          )
        )}
      </Card>

      {orders.length > limit && (
        <div className="text-center mt-4">
          <Button variant="secondary" onClick={() => setLimit((l) => l + 30)}>
            Show more ({orders.length - limit} left)
          </Button>
        </div>
      )}
    </div>
  );
};

// ---- Screen ----

type View = 'active' | 'completed' | 'cancelled';
type ActiveFilter = 'all' | Exclude<Stage, 'done' | 'cancelled'>;

const STAGE_ORDER: Record<string, number> = { new: 0, preparing: 1, ready: 2 };

export const OrdersView: React.FC<{
  orders: OrderRecord[];
  branch: BranchFilter;
  onOpenOrder: (o: OrderRecord) => void;
  onNewOrder: () => void;
}> = ({ orders, branch, onOpenOrder, onNewOrder }) => {
  const [view, setView] = useState<View>('active');
  const [filter, setFilter] = useState<ActiveFilter>('all');
  const [query, setQuery] = useState('');
  const showBranch = branch === 'all';

  // Refund records live in Refunds, not here
  const scoped = useMemo(() => orders.filter((o) => inBranch(o, branch) && !isCapturedReturnedBill(o)), [orders, branch]);

  // Briefly highlight a row when its status changes
  const lastStatus = useRef<Map<string, string> | null>(null);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  useEffect(() => {
    const prev = lastStatus.current;
    const next = new Map(scoped.map((o) => [o.orderReference, o.status] as [string, string]));
    if (prev) {
      const changed = scoped.filter((o) => prev.has(o.orderReference) && prev.get(o.orderReference) !== o.status).map((o) => o.orderReference);
      if (changed.length) {
        setFlashing((s) => new Set([...s, ...changed]));
        window.setTimeout(() => setFlashing((s) => new Set([...s].filter((r) => !changed.includes(r)))), 1700);
      }
    }
    lastStatus.current = next;
  }, [scoped]);

  const byStage = useMemo(() => {
    const m: Record<Stage, OrderRecord[]> = { new: [], preparing: [], ready: [], done: [], cancelled: [] };
    scoped.forEach((o) => m[stageOf(o)].push(o));
    return m;
  }, [scoped]);

  // Active list: new first, then preparing, then ready/out — oldest first within each
  const active = useMemo(
    () =>
      [...byStage.new, ...byStage.preparing, ...byStage.ready].sort(
        (a, b) => STAGE_ORDER[stageOf(a)] - STAGE_ORDER[stageOf(b)] || a.createdAt.localeCompare(b.createdAt)
      ),
    [byStage]
  );

  const q = query.trim().toLowerCase();
  const results = q
    ? scoped.filter((o) => [o.orderReference, o.customerName, o.contactNumber, o.city, o.deliveryAddress].some((f) => (f || '').toLowerCase().includes(q)))
    : [];

  const views: { id: View; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: active.length },
    { id: 'completed', label: 'Completed', count: byStage.done.length },
    { id: 'cancelled', label: 'Cancelled', count: byStage.cancelled.length },
  ];

  const filters: { id: ActiveFilter; label: string; count: number; icon: React.ReactNode; tone: string }[] = [
    { id: 'all', label: 'All active', count: active.length, icon: <ListOrdered className="w-5 h-5" />, tone: 'text-[#81001E]' },
    { id: 'new', label: 'New', count: byStage.new.length, icon: <BellRing className={cx('w-5 h-5', byStage.new.length > 0 && 'anim-bell')} />, tone: 'text-amber-600' },
    {
      id: 'preparing',
      label: 'Preparing',
      count: byStage.preparing.length,
      icon: <ConeIcon />,
      tone: 'text-violet-600',
    },
    {
      id: 'ready',
      label: 'Ready / Out',
      count: byStage.ready.length,
      icon: <ScooterIcon />,
      tone: 'text-blue-600',
    },
  ];
  const activeShown = filter === 'all' ? active : active.filter((o) => stageOf(o) === filter);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex max-w-full overflow-x-auto no-scrollbar p-1 bg-[#F3EDE3] rounded-xl self-start" role="tablist" aria-label="Order lists">
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
                'h-9 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer',
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
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find order, name or phone" aria-label="Search orders" className={cx(inputClass, 'pl-9 pr-9')} />
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
        <div className="space-y-3">
          <p className="text-sm text-[#6B5A51]">
            {results.length} result{results.length === 1 ? '' : 's'} for “{query}”
          </p>
          {results.length ? (
            <OrdersTable orders={results} showBranch={showBranch} groupByDay flashing={flashing} onOpen={onOpenOrder} />
          ) : (
            <Card>
              <EmptyState title="No matching orders" />
            </Card>
          )}
        </div>
      ) : view === 'active' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="tablist" aria-label="Filter active orders">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cx(
                  'flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left cursor-pointer transition-all',
                  filter === f.id ? 'border-[#81001E] ring-2 ring-[#81001E]/15 shadow-sm' : 'border-[#EAE2D6] hover:border-[#C9B9A4]'
                )}
              >
                <span className={cx('w-10 h-10 rounded-xl bg-[#FBF8F3] flex items-center justify-center shrink-0 overflow-hidden', f.tone)}>
                  {f.icon}
                </span>
                <span>
                  <span className="block text-2xl font-bold text-[#241A18] leading-none">{f.count}</span>
                  <span className="block text-sm text-[#6B5A51] mt-1">{f.label}</span>
                </span>
              </button>
            ))}
          </div>

          {activeShown.length ? (
            <OrdersTable orders={activeShown} showBranch={showBranch} groupByDay={false} flashing={flashing} onOpen={onOpenOrder} />
          ) : (
            <Card>
              <EmptyState icon={<ListOrdered className="w-6 h-6" />} title={filter === 'new' || filter === 'all' ? 'No orders waiting right now' : 'Nothing here right now'}>
                New orders appear here straight away{byStage.new.length === 0 ? ' — with a chime if sound is on' : ''}.
              </EmptyState>
            </Card>
          )}
        </>
      ) : (view === 'completed' ? byStage.done : byStage.cancelled).length ? (
        <OrdersTable
          orders={view === 'completed' ? byStage.done : byStage.cancelled}
          showBranch={showBranch}
          groupByDay
          flashing={flashing}
          onOpen={onOpenOrder}
        />
      ) : (
        <Card>
          <EmptyState title={view === 'completed' ? 'No completed orders yet' : 'No cancelled orders'} />
        </Card>
      )}
    </div>
  );
};
