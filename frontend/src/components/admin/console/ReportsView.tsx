import React, { useMemo, useState } from 'react';
import { MapPin, Phone, Clock } from 'lucide-react';
import { OrderRecord } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { isCapturedReturnedBill } from '../../../utils/orderStorage';
import { formatPrice } from '../../../utils/currency';
import { Card, cx } from './ui';
import { BranchFilter, inBranch } from './useConsoleData';
import { saleTime } from './orderMeta';

const lkr = (n: number) => formatPrice(n, 'LKR');
type Period = 'today' | 'week' | 'month' | 'all';
const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
];

function periodStart(p: Period): number {
  if (p === 'all') return 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === 'week') d.setDate(d.getDate() - 6);
  if (p === 'month') d.setDate(d.getDate() - 29);
  return d.getTime();
}

const Stat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <Card className="p-4">
    <p className="text-sm text-[#6B5A51]">{label}</p>
    <p className="text-2xl font-bold text-[#241A18] mt-1">{value}</p>
    {sub && <p className="text-xs text-[#8A7970] mt-1">{sub}</p>}
  </Card>
);

export const ReportsView: React.FC<{ orders: OrderRecord[]; branch: BranchFilter }> = ({ orders, branch }) => {
  const [period, setPeriod] = useState<Period>('today');

  const r = useMemo(() => {
    const from = periodStart(period);
    const inPeriod = (iso?: string | null) => !!iso && new Date(iso).getTime() >= from;
    const scoped = orders.filter((o) => inBranch(o, branch));

    const sales = scoped.filter((o) => inPeriod(saleTime(o)));
    const gross = sales.reduce((s, o) => s + o.grandTotalLKR, 0);
    const refunds = scoped.filter((o) => isCapturedReturnedBill(o) && o.refundStatus === 'completed' && inPeriod(o.refundedAt));
    const refunded = refunds.reduce((s, o) => s + (o.refundAmountLKR ?? o.grandTotalLKR), 0);
    const cancelled = scoped.filter((o) => o.status === 'cancelled' && !isCapturedReturnedBill(o) && inPeriod(o.cancelledAt || o.createdAt));

    const byBranch = AMORE_BRANCHES.map((b) => ({
      name: b.name,
      total: sales.filter((o) => (o.branchId || 'akurana') === b.id).reduce((s, o) => s + o.grandTotalLKR, 0),
    }));

    const itemTotals = new Map<string, number>();
    sales.forEach((o) => o.items.forEach((i) => itemTotals.set(i.name, (itemTotals.get(i.name) || 0) + i.quantity)));
    const topItems = [...itemTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      net: Math.max(0, gross - refunded),
      gross,
      count: sales.length,
      avg: sales.length ? gross / sales.length : 0,
      refunded,
      refundCount: refunds.length,
      cancelled: cancelled.length,
      delivery: sales.filter((o) => o.orderType === 'delivery').length,
      pickup: sales.filter((o) => o.orderType === 'pickup').length,
      byBranch,
      topItems,
    };
  }, [orders, branch, period]);

  const maxBranch = Math.max(1, ...r.byBranch.map((b) => b.total));
  const maxItem = Math.max(1, ...r.topItems.map(([, n]) => n));

  return (
    <div className="space-y-5">
      <div className="inline-flex p-1 bg-[#F3EDE3] rounded-xl flex-wrap" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            onClick={() => setPeriod(p.id)}
            className={cx('h-9 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer', period === p.id ? 'bg-white text-[#241A18] shadow-sm' : 'text-[#6B5A51] hover:text-[#241A18]')}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Sales" value={lkr(r.net)} sub={r.refunded ? `${lkr(r.gross)} before refunds` : 'after refunds'} />
        <Stat label="Completed orders" value={String(r.count)} sub={`${r.delivery} delivery · ${r.pickup} pickup`} />
        <Stat label="Average order" value={lkr(r.avg)} />
        <Stat label="Refunds given" value={lkr(r.refunded)} sub={`${r.refundCount} refund${r.refundCount === 1 ? '' : 's'} · ${r.cancelled} cancelled order${r.cancelled === 1 ? '' : 's'}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {branch === 'all' && (
          <Card className="p-5">
            <h3 className="font-bold text-[#241A18] mb-4">Sales by branch</h3>
            <ul className="space-y-3">
              {r.byBranch.map((b) => (
                <li key={b.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#3D2C24]">{b.name}</span>
                    <span className="font-semibold text-[#241A18]">{lkr(b.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F3EDE3] overflow-hidden">
                    <div className="h-full rounded-full bg-[#81001E]" style={{ width: `${(b.total / maxBranch) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card className="p-5">
          <h3 className="font-bold text-[#241A18] mb-4">Best sellers</h3>
          {r.topItems.length === 0 ? (
            <p className="text-sm text-[#8A7970]">No sales in this period yet.</p>
          ) : (
            <ul className="space-y-3">
              {r.topItems.map(([name, n]) => (
                <li key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#3D2C24]">{name}</span>
                    <span className="font-semibold text-[#241A18]">{n} sold</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F3EDE3] overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${(n / maxItem) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-xs text-[#8A7970]">
        Sales count cash and counter orders once they are delivered or collected, and card payments once accepted. Refunds are taken off on the day they are given.
      </p>

      <section>
        <h3 className="font-bold text-[#241A18] mb-3">Branch details</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {AMORE_BRANCHES.filter((b) => branch === 'all' || b.id === branch).map((b) => (
            <Card key={b.id} className="p-4 text-sm space-y-1.5">
              <p className="font-semibold text-[#241A18]">{b.name}</p>
              <p className="text-[#5C4D44] flex gap-2">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-[#81001E]" />
                {b.address}
              </p>
              <p className="text-[#5C4D44] flex gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-[#81001E]" />
                {b.hours}
              </p>
              <p className="text-[#5C4D44] flex gap-2">
                <Phone className="w-4 h-4 shrink-0 mt-0.5 text-[#81001E]" />
                {b.phone}
              </p>
            </Card>
          ))}
        </div>
        <p className="text-xs text-[#8A7970] mt-2">These are shown on the website. To change them, ask your web developer.</p>
      </section>
    </div>
  );
};
