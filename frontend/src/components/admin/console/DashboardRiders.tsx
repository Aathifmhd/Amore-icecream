/**
 * Dashboard cards for deliveries: the riders (who is out, today's deliveries, rating, cash to hand
 * in, orders waiting for a rider) and the customers' ratings and latest comments.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bike, Clock, MessageSquareHeart, Star, ThumbsDown } from 'lucide-react';
import { BranchId, OrderRecord } from '../../../types';
import { api } from '../../../api';
import { startPolling } from '../../../utils/poll';
import { formatPrice } from '../../../utils/currency';
import { Stars } from '../../Stars';
import { Badge, Button, Card, cx } from './ui';
import { BranchFilter, inBranch } from './useConsoleData';
import { shortRef, timeAgo } from './orderMeta';
import { RiderAvatar } from './RidersView';

const lkr = (n: number) => formatPrice(n, 'LKR');
const DAYS_30 = 30 * 24 * 3600 * 1000;

interface DashRider {
  id: string;
  name: string;
  branchId: BranchId;
  active: boolean;
  outWith: { orderReference: string }[];
  deliveredToday: number;
  holdingLKR: number;
  rating: { average: number | null; count: number };
}

export const RidersCard: React.FC<{ branch: BranchFilter; onOpen: () => void }> = ({ branch, onOpen }) => {
  const [data, setData] = useState<{ riders: DashRider[]; waiting: { branchId: BranchId }[] } | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try {
      setData(await api<{ riders: DashRider[]; waiting: { branchId: BranchId }[] }>('/riders', { as: 'admin' }));
    } catch {
      /* the card just keeps what it had */
    }
  }, []);
  useEffect(() => startPolling(load, { visibleMs: 30_000, hiddenMs: 120_000 }), [load]);
  useEffect(() => {
    api<{ photos: Record<string, string> }>('/riders/photos', { as: 'admin' })
      .then((r) => setPhotos(r.photos))
      .catch(() => {});
  }, []);

  const riders = (data?.riders || [])
    .filter((r) => branch === 'all' || r.branchId === branch)
    // Out delivering first, then available, then switched off
    .sort((a, b) => Number(b.outWith.length > 0) - Number(a.outWith.length > 0) || Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const waiting = (data?.waiting || []).filter((o) => branch === 'all' || o.branchId === branch).length;
  const out = riders.filter((r) => r.outWith.length).length;
  const free = riders.filter((r) => r.active && !r.outWith.length).length;
  const delivered = riders.reduce((s, r) => s + r.deliveredToday, 0);
  const toHandIn = riders.reduce((s, r) => s + r.holdingLKR, 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-bold text-[#241A18] flex items-center gap-2">
          <Bike className="w-4 h-4 text-[#81001E]" /> Delivery riders
        </h2>
        <button type="button" onClick={onOpen} className="text-xs font-semibold text-[#81001E] hover:underline cursor-pointer">
          Riders
        </button>
      </div>
      {!data ? (
        <p className="text-sm text-[#8A7970] py-4">Loading…</p>
      ) : riders.length === 0 ? (
        <p className="text-sm text-[#8A7970] py-4">No riders yet. Add them on the Riders page.</p>
      ) : (
        <>
          <p className="text-sm text-[#7A6458]">
            {out} out · {free} available · {delivered} delivered today
            {toHandIn > 0 && <span className="text-amber-800 font-semibold"> · {lkr(toHandIn)} to hand in</span>}
          </p>
          {waiting > 0 && (
            <p className="mt-2 text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <Clock className="w-4 h-4" /> {waiting} {waiting === 1 ? 'order is' : 'orders are'} waiting for a rider
            </p>
          )}
          <ul className="mt-3 divide-y divide-[#F0E8DC]">
            {riders.slice(0, 6).map((r) => (
              <li key={r.id} className="py-2.5 flex items-center gap-3">
                <RiderAvatar name={r.name} photo={photos[r.id]} active={r.active} size="w-9 h-9" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-[#241A18] truncate">{r.name}</span>
                    {!r.active ? (
                      <Badge tone="grey">Off</Badge>
                    ) : r.outWith.length ? (
                      <Badge tone="blue">Out · {r.outWith.map((o) => shortRef(o.orderReference)).join(', ')}</Badge>
                    ) : (
                      <Badge tone="green">Available</Badge>
                    )}
                  </span>
                  <span className="block text-xs text-[#7A6458] mt-0.5">
                    {r.deliveredToday} delivered today
                    {r.rating.average !== null && (
                      <span className="inline-flex items-center gap-0.5 ml-1.5 font-semibold text-amber-800">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {r.rating.average.toFixed(1)}
                      </span>
                    )}
                  </span>
                </span>
                {r.holdingLKR > 0 && (
                  <span className="text-right leading-tight whitespace-nowrap">
                    <span className="block text-sm font-semibold text-amber-800">{lkr(r.holdingLKR)}</span>
                    <span className="block text-[11px] text-[#8A7970]">to hand in</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {riders.length > 6 && <p className="text-xs text-[#8A7970] mt-1">+{riders.length - 6} more</p>}
        </>
      )}
      <Button className="w-full mt-4" variant="secondary" icon={<ArrowRight className="w-4 h-4" />} onClick={onOpen}>
        Riders & cash collection
      </Button>
    </Card>
  );
};

/** When the customer last rated this order (feedback page or rider stars) */
const saidAt = (o: OrderRecord) => [o.feedbackAt, o.ratedAt].filter(Boolean).sort().pop() || '';
const avg = (list: number[]) => (list.length ? list.reduce((s, n) => s + n, 0) / list.length : null);

export const RatingsCard: React.FC<{ orders: OrderRecord[]; branch: BranchFilter; onOpen: () => void; onOpenOrder: (ref: string) => void }> = ({
  orders,
  branch,
  onOpen,
  onOpenOrder,
}) => {
  const d = useMemo(() => {
    const since = new Date(Date.now() - DAYS_30).toISOString();
    const rated = orders.filter((o) => inBranch(o, branch) && (o.feedbackAt || o.ratedAt) && saidAt(o) >= since);
    const orderStars = rated.filter((o) => o.feedbackRating).map((o) => o.feedbackRating!);
    const riderStars = rated.filter((o) => o.riderRating).map((o) => o.riderRating!);
    return {
      orderAvg: avg(orderStars),
      orderCount: orderStars.length,
      riderAvg: avg(riderStars),
      riderCount: riderStars.length,
      unhappy: rated.filter((o) => Math.min(o.feedbackRating ?? 6, o.riderRating ?? 6) <= 2).length,
      latest: rated
        .filter((o) => o.feedbackComment || o.riderFeedback)
        .sort((a, b) => saidAt(b).localeCompare(saidAt(a)))
        .slice(0, 3),
    };
  }, [orders, branch]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-bold text-[#241A18] flex items-center gap-2">
          <MessageSquareHeart className="w-4 h-4 text-[#81001E]" /> Ratings & feedback
        </h2>
        <span className="text-xs text-[#8A7970]">Last 30 days</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#FBF8F3] border border-[#F0E8DC] p-3">
          <p className="text-xs text-[#7A6458]">Order rating</p>
          <p className="text-xl font-bold text-[#241A18] mt-0.5">{d.orderAvg ? d.orderAvg.toFixed(1) : '—'}</p>
          {d.orderAvg ? <Stars value={d.orderAvg} size="w-3.5 h-3.5" /> : null}
          <p className="text-xs text-[#8A7970] mt-0.5">{d.orderCount} reviews</p>
        </div>
        <div className="rounded-xl bg-[#FBF8F3] border border-[#F0E8DC] p-3">
          <p className="text-xs text-[#7A6458]">Rider rating</p>
          <p className="text-xl font-bold text-[#241A18] mt-0.5">{d.riderAvg ? d.riderAvg.toFixed(1) : '—'}</p>
          {d.riderAvg ? <Stars value={d.riderAvg} size="w-3.5 h-3.5" /> : null}
          <p className="text-xs text-[#8A7970] mt-0.5">{d.riderCount} deliveries rated</p>
        </div>
      </div>
      {d.unhappy > 0 && (
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 w-full text-left text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-red-100"
        >
          <ThumbsDown className="w-4 h-4" /> {d.unhappy} unhappy {d.unhappy === 1 ? 'customer' : 'customers'} (1–2 stars)
        </button>
      )}
      {d.latest.length > 0 ? (
        <ul className="mt-3 divide-y divide-[#F0E8DC]">
          {d.latest.map((o) => (
            <li key={o.orderReference}>
              <button type="button" onClick={() => onOpenOrder(o.orderReference)} className="w-full text-left py-2.5 cursor-pointer group">
                <span className="flex items-center gap-2">
                  <Stars value={o.feedbackRating || o.riderRating || 0} size="w-3.5 h-3.5" />
                  <span className="text-xs text-[#8A7970]">{timeAgo(saidAt(o))}</span>
                </span>
                <span className={cx('block text-sm text-[#241A18] mt-0.5 line-clamp-2 group-hover:underline')}>“{o.feedbackComment || o.riderFeedback}”</span>
                <span className="block text-xs text-[#7A6458] mt-0.5">
                  {o.customerName} · {shortRef(o.orderReference)}
                  {o.riderName && <> · rider {o.riderName.split(' ')[0]}</>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#8A7970] mt-3">No comments yet.</p>
      )}
      <Button className="w-full mt-4" variant="secondary" icon={<ArrowRight className="w-4 h-4" />} onClick={onOpen}>
        All feedback
      </Button>
    </Card>
  );
};
