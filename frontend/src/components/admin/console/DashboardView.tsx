/**
 * Dashboard: today at a glance for the branch(es) this admin looks after — sales, orders,
 * what needs doing now, the last 7 days, what's sold out and (super admin) each branch
 * and the latest activity. Everything is worked out from the orders and menu already loaded.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, CircleSlash, ClipboardList, IdCard, Activity } from 'lucide-react';
import { BranchId, OrderRecord } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { api, type AdminProfile } from '../../../api';
import { formatPrice } from '../../../utils/currency';
import { isSoldOutAt } from '../../../utils/stock';
import { isCapturedReturnedBill } from '../../../utils/orderStorage';
import { Badge, Button, Card, cx } from './ui';
import { BranchFilter, MenuData, inBranch } from './useConsoleData';
import { saleTime, stageOf, statusLabel, timeAgo, shortRef } from './orderMeta';
import { ActivityRow, type ActivityItem } from './ActionCenterView';

const lkr = (n: number) => formatPrice(n, 'LKR');
const BRANCH_SHORT: Record<BranchId, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };
const DAY = 24 * 3600 * 1000;

type Go = 'orders' | 'menu' | 'employees' | 'activity' | 'reports';

const startOfDay = (offsetDays = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d.getTime();
};
const isRefundRecord = (o: OrderRecord) => o.orderReference.startsWith('RET-') || o.items.some((i) => i.itemId === 'returned-item-manual');

/** "LKR 12.4K" style for axis ticks. */
const compactLkr = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : String(Math.round(n)));

/** A tidy top for the y-axis (1, 2, 2.5 or 5 × a power of ten). */
function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * p >= v)!;
  return step * p;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// ---- Pieces ---------------------------------------------------------------------

const Tile: React.FC<{
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'attention';
  onClick?: () => void;
}> = ({ label, value, sub, icon, tone = 'default', onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cx(
        'text-left rounded-2xl border p-4 sm:p-5 bg-white transition-colors',
        tone === 'attention' ? 'border-amber-300 bg-amber-50/60' : 'border-[#EAE2D6]',
        onClick && 'cursor-pointer hover:border-[#C9B9A4]'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[#6B5A51]">{label}</p>
        {icon}
      </div>
      <p className="text-2xl sm:text-[28px] font-bold text-[#241A18] mt-1.5 leading-tight">{value}</p>
      {sub && <div className="text-xs text-[#8A7970] mt-1.5">{sub}</div>}
    </Tag>
  );
};

/** Sales for the last 7 days: one column per day, today in the deeper crimson. */
const SalesChart: React.FC<{ days: { label: string; date: string; total: number; count: number; today: boolean }[] }> = ({ days }) => {
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(...days.map((d) => d.total)));
  const ticks = [top, top / 2, 0];
  const today = days[days.length - 1];

  return (
    <div>
      <div className="flex gap-3">
        {/* y-axis */}
        <div className="flex flex-col justify-between h-48 text-[11px] text-[#8A7970] tabular-nums text-right w-9 shrink-0 -my-1.5">
          {ticks.map((t) => (
            <span key={t}>{compactLkr(t)}</span>
          ))}
        </div>
        <div className="relative flex-1 h-48">
          {/* hairline gridlines */}
          {ticks.map((t, i) => (
            <div key={t} className="absolute inset-x-0 border-t border-[#EFE8DD]" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end justify-around">
            {days.map((d, i) => {
              const h = (d.total / top) * 100;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-label={`${d.label}: ${lkr(d.total)} from ${d.count} sale${d.count === 1 ? '' : 's'}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="relative h-full flex-1 flex items-end justify-center cursor-default focus:outline-none group"
                >
                  {/* today's value sits on its cap; other days show theirs on hover */}
                  {d.today && d.total > 0 && hover === null && (
                    <span className="absolute text-xs font-semibold text-[#241A18] tabular-nums -translate-y-1.5" style={{ bottom: `${h}%` }}>
                      {lkr(d.total)}
                    </span>
                  )}
                  <span
                    className={cx('block w-full max-w-6 rounded-t-[4px] transition-opacity', d.today ? 'bg-[#81001E]' : 'bg-[#C25B71]', hover !== null && hover !== i && 'opacity-60')}
                    style={{ height: d.total > 0 ? `max(${h}%, 3px)` : '0px' }}
                  />
                  {hover === i && (
                    <span
                      role="tooltip"
                      className="absolute z-10 left-1/2 -translate-x-1/2 -translate-y-2 whitespace-nowrap rounded-lg bg-[#241A18] text-white px-2.5 py-1.5 text-xs shadow-lg pointer-events-none"
                      style={{ bottom: `${h}%` }}
                    >
                      <strong className="block text-sm">{lkr(d.total)}</strong>
                      <span className="text-white/75">
                        {d.label} · {d.count} sale{d.count === 1 ? '' : 's'}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* x-axis */}
      <div className="flex gap-3 mt-2">
        <span className="w-9 shrink-0" />
        <div className="flex-1 flex justify-around text-xs text-[#8A7970]">
          {days.map((d) => (
            <span key={d.date} className={cx('flex-1 text-center', d.today && 'font-bold text-[#241A18]')}>
              {d.today ? 'Today' : d.label}
            </span>
          ))}
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-[#7A6458] select-none">Show as a table</summary>
        <table className="mt-2 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-[#8A7970]">
              <th className="font-semibold py-1">Day</th>
              <th className="font-semibold py-1 text-right">Sales</th>
              <th className="font-semibold py-1 text-right">Orders</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-t border-[#F0E8DC]">
                <td className="py-1.5">{d.today ? 'Today' : d.label}</td>
                <td className="py-1.5 text-right">{lkr(d.total)}</td>
                <td className="py-1.5 text-right">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <span className="sr-only">Today so far: {lkr(today.total)}</span>
    </div>
  );
};

// ---- Page -------------------------------------------------------------------------

export const DashboardView: React.FC<{
  admin: AdminProfile;
  orders: OrderRecord[];
  menu: MenuData;
  branch: BranchFilter;
  onGo: (section: Go) => void;
  onOpenOrder: (ref: string) => void;
}> = ({ admin, orders, menu, branch, onGo, onOpenOrder }) => {
  const isSuper = admin.role !== 'branch';
  const [staff, setStaff] = useState<Record<string, number> | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  // Staff numbers per branch, and (super admin) the latest activity
  useEffect(() => {
    api<{ employees: { branchId: BranchId }[] }>('/employees', { as: 'admin' })
      .then(({ employees }) => {
        const counts: Record<string, number> = {};
        for (const e of employees) counts[e.branchId] = (counts[e.branchId] || 0) + 1;
        setStaff(counts);
      })
      .catch(() => setStaff({}));
    if (isSuper) {
      api<{ items: ActivityItem[] }>(`/activity?limit=6${branch !== 'all' ? `&branch=${branch}` : ''}`, { as: 'admin' })
        .then((r) => setActivity(r.items))
        .catch(() => setActivity([]));
    }
  }, [isSuper, branch]);

  const d = useMemo(() => {
    const scoped = orders.filter((o) => inBranch(o, branch));
    const t0 = startOfDay(0);
    const y0 = startOfDay(1);
    const sold = (from: number, to: number) =>
      scoped.filter((o) => {
        const t = saleTime(o);
        if (!t) return false;
        const ms = new Date(t).getTime();
        return ms >= from && ms < to;
      });
    const salesToday = sold(t0, t0 + DAY);
    const salesYesterday = sold(y0, t0);
    const sum = (list: OrderRecord[]) => list.reduce((s, o) => s + o.grandTotalLKR, 0);
    const placedToday = scoped.filter((o) => !isRefundRecord(o) && new Date(o.createdAt).getTime() >= t0);

    const days = Array.from({ length: 7 }, (_, i) => {
      const from = startOfDay(6 - i);
      const list = sold(from, from + DAY);
      return {
        date: new Date(from).toISOString(),
        label: new Date(from).toLocaleDateString(undefined, { weekday: 'short' }),
        total: sum(list),
        count: list.length,
        today: i === 6,
      };
    });

    const live = scoped.filter((o) => !isRefundRecord(o));
    const byStage = (s: ReturnType<typeof stageOf>) => live.filter((o) => stageOf(o) === s);

    const everyItem = [...menu.scoops, ...menu.coffee, ...menu.cakes];
    const branchIds = AMORE_BRANCHES.map((b) => b.id);
    const soldOut = everyItem
      .map((i) => ({ item: i, where: branchIds.filter((b) => isSoldOutAt(i, b) && (branch === 'all' || b === branch)) }))
      .filter((x) => x.where.length > 0);

    const perBranch = AMORE_BRANCHES.map((b) => {
      const mine = orders.filter((o) => o.branchId === b.id);
      const today = mine.filter((o) => {
        const t = saleTime(o);
        return t && new Date(t).getTime() >= t0;
      });
      return {
        id: b.id,
        sales: sum(today),
        orders: mine.filter((o) => !isRefundRecord(o) && new Date(o.createdAt).getTime() >= t0).length,
        waiting: mine.filter((o) => stageOf(o) === 'new' && !isRefundRecord(o)).length,
        soldOut: everyItem.filter((i) => isSoldOutAt(i, b.id)).length,
      };
    });

    return {
      salesToday: sum(salesToday),
      salesYesterday: sum(salesYesterday),
      saleCount: salesToday.length,
      placedToday,
      cancelledToday: placedToday.filter((o) => o.status === 'cancelled').length,
      waiting: byStage('new'),
      preparing: byStage('preparing'),
      ready: byStage('ready'),
      refundsDue: scoped.filter((o) => isCapturedReturnedBill(o) && o.refundStatus !== 'completed').length,
      days,
      soldOut,
      perBranch,
      recent: [...live].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6),
    };
  }, [orders, menu, branch]);

  const delta = d.salesYesterday > 0 ? Math.round(((d.salesToday - d.salesYesterday) / d.salesYesterday) * 100) : null;
  const scopeName = branch === 'all' ? 'All branches' : BRANCH_SHORT[branch];
  const staffCount = staff ? (branch === 'all' ? Object.values<number>(staff).reduce((a, b) => a + b, 0) : staff[branch] || 0) : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-2xl font-bold text-[#241A18]">
          {greeting()}, {admin.displayName.split(' ')[0]}
        </p>
        <p className="text-sm text-[#7A6458] mt-0.5">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · {scopeName}
        </p>
      </div>

      {/* Today */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Tile
          label="Sales today"
          value={lkr(d.salesToday)}
          sub={
            delta === null ? (
              `${d.saleCount} paid order${d.saleCount === 1 ? '' : 's'}`
            ) : (
              <span className="inline-flex items-center gap-1">
                {delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-600" />}
                <span className={delta >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                  {delta >= 0 ? '+' : ''}
                  {delta}%
                </span>
                vs yesterday
              </span>
            )
          }
        />
        <Tile
          label="Orders today"
          value={String(d.placedToday.length)}
          sub={d.cancelledToday ? `${d.cancelledToday} cancelled` : 'none cancelled'}
          onClick={() => onGo('orders')}
        />
        <Tile
          label="Waiting to accept"
          value={String(d.waiting.length)}
          tone={d.waiting.length ? 'attention' : 'default'}
          icon={d.waiting.length ? <AlertCircle className="w-4 h-4 text-amber-600" /> : undefined}
          sub={d.waiting.length ? 'Open Orders to accept them' : 'All caught up'}
          onClick={() => onGo('orders')}
        />
        <Tile label="Average order" value={d.saleCount ? lkr(Math.round(d.salesToday / d.saleCount)) : '—'} sub="paid orders today" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="font-bold text-[#241A18]">Sales, last 7 days</h2>
            <button type="button" onClick={() => onGo('reports')} className="text-xs font-semibold text-[#81001E] hover:underline cursor-pointer">
              Reports
            </button>
          </div>
          <SalesChart days={d.days} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#241A18]">Right now</h2>
            <ClipboardList className="w-4 h-4 text-[#8A7970]" />
          </div>
          {(
            [
              ['New — needs accepting', d.waiting.length, 'bg-amber-500'],
              ['Being prepared', d.preparing.length, 'bg-violet-500'],
              ['Ready / out for delivery', d.ready.length, 'bg-sky-500'],
            ] as const
          ).map(([label, n, dot]) => (
            <button
              key={label}
              type="button"
              onClick={() => onGo('orders')}
              className="w-full flex items-center gap-3 py-2.5 border-b border-[#F0E8DC] last:border-0 text-left cursor-pointer hover:bg-[#FBF8F3] -mx-2 px-2 rounded-lg"
            >
              <span className={cx('w-2.5 h-2.5 rounded-full shrink-0', dot)} />
              <span className="flex-1 text-sm text-[#3D2C24]">{label}</span>
              <span className="text-lg font-bold text-[#241A18] tabular-nums">{n}</span>
            </button>
          ))}
          {d.refundsDue > 0 && (
            <p className="mt-3 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
              {d.refundsDue} refund{d.refundsDue === 1 ? '' : 's'} still to pay
            </p>
          )}
          <Button className="w-full mt-4" variant="secondary" icon={<ArrowRight className="w-4 h-4" />} onClick={() => onGo('orders')}>
            Open orders
          </Button>
        </Card>
      </div>

      {/* Each branch today (super admin, all branches) */}
      {isSuper && branch === 'all' && (
        <div>
          <h2 className="font-bold text-[#241A18] mb-3">Branches today</h2>
          <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
            {d.perBranch.map((b) => (
              <Card key={b.id} className="p-4">
                <p className="font-semibold text-[#241A18]">{BRANCH_SHORT[b.id]}</p>
                <p className="text-xl font-bold text-[#241A18] mt-1">{lkr(b.sales)}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-xs text-[#6B5A51]">
                  <span>Orders today</span>
                  <span className="text-right font-semibold text-[#241A18] tabular-nums">{b.orders}</span>
                  <span>Waiting</span>
                  <span className={cx('text-right font-semibold tabular-nums', b.waiting ? 'text-amber-700' : 'text-[#241A18]')}>{b.waiting}</span>
                  <span>Sold-out items</span>
                  <span className={cx('text-right font-semibold tabular-nums', b.soldOut ? 'text-red-700' : 'text-[#241A18]')}>{b.soldOut}</span>
                  <span>Staff</span>
                  <span className="text-right font-semibold text-[#241A18] tabular-nums">{staff ? staff[b.id] || 0 : '…'}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className={cx('grid gap-4 items-start', isSuper ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
        <Card className="p-5">
          <h2 className="font-bold text-[#241A18] mb-2">Latest orders</h2>
          {d.recent.length === 0 ? (
            <p className="text-sm text-[#8A7970] py-4">No orders yet.</p>
          ) : (
            d.recent.map((o) => {
              const s = statusLabel(o);
              return (
                <button
                  key={o.orderReference}
                  type="button"
                  onClick={() => onOpenOrder(o.orderReference)}
                  className="w-full flex items-center gap-3 py-2.5 border-b border-[#F0E8DC] last:border-0 text-left cursor-pointer hover:bg-[#FBF8F3] -mx-2 px-2 rounded-lg"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#241A18] truncate">{o.customerName}</span>
                    <span className="block text-xs text-[#8A7970]">
                      <span className="font-mono">{shortRef(o.orderReference)}</span> · {timeAgo(o.createdAt)}
                      {branch === 'all' ? ` · ${BRANCH_SHORT[o.branchId] || o.branchName}` : ''}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-semibold text-[#241A18] tabular-nums">{lkr(o.grandTotalLKR)}</span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </span>
                </button>
              );
            })
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-[#241A18]">Sold out now</h2>
            <CircleSlash className="w-4 h-4 text-[#8A7970]" />
          </div>
          {d.soldOut.length === 0 ? (
            <p className="text-sm text-[#8A7970] py-4">Everything is in stock{branch === 'all' ? ' at every branch' : ''}.</p>
          ) : (
            <ul className="divide-y divide-[#F0E8DC]">
              {d.soldOut.map(({ item, where }) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm font-semibold text-[#241A18] truncate">{item.name}</span>
                  {branch === 'all' && (
                    <span className="flex flex-wrap justify-end gap-1">
                      {where.map((b) => (
                        <Badge key={b} tone="red">
                          {BRANCH_SHORT[b]}
                        </Badge>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F0E8DC]">
            <span className="inline-flex items-center gap-2 text-sm text-[#6B5A51]">
              <IdCard className="w-4 h-4" /> {staffCount === null ? 'Staff …' : `${staffCount} staff on record`}
            </span>
            <button type="button" onClick={() => onGo('menu')} className="text-xs font-semibold text-[#81001E] hover:underline cursor-pointer">
              Menu & stock
            </button>
          </div>
        </Card>

        {isSuper && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-[#241A18]">Latest activity</h2>
              <Activity className="w-4 h-4 text-[#8A7970]" />
            </div>
            {activity === null ? (
              <p className="text-sm text-[#8A7970] py-4">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="text-sm text-[#8A7970] py-4">Nothing yet.</p>
            ) : (
              <div className="divide-y divide-[#F0E8DC]">
                {activity.map((a) => (
                  <ActivityRow key={a.id} item={a} compact />
                ))}
              </div>
            )}
            <Button className="w-full mt-3" variant="secondary" icon={<ArrowRight className="w-4 h-4" />} onClick={() => onGo('activity')}>
              Open Action Center
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};
