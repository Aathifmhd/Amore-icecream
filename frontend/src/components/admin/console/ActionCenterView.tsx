/**
 * Action Center (super admin): everything that happens across the branches — new orders,
 * status changes, sold-out switches, staff and login changes, sign-ins — newest first.
 * New entries appear on their own while the page is open.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bike, CircleSlash, ClipboardList, IdCard, Images, LogIn, MapPinned, MessageSquareHeart, RotateCcw, ShieldAlert, UserCog, UtensilsCrossed, Activity } from 'lucide-react';
import { BranchId } from '../../../types';
import { api, ApiError } from '../../../api';
import { startPolling } from '../../../utils/poll';
import { Badge, Button, Card, EmptyState, cx } from './ui';
import { BranchFilter } from './useConsoleData';
import { clockTime, timeAgo } from './orderMeta';

export type ActivityCategory = 'order' | 'refund' | 'stock' | 'menu' | 'staff' | 'riders' | 'feedback' | 'users' | 'gallery' | 'parlours' | 'signin';

export interface ActivityItem {
  id: string;
  at: string;
  category: ActivityCategory;
  summary: string;
  branchId: BranchId | null;
  ref: string | null;
  actor: { kind: 'admin' | 'customer' | 'rider' | 'system'; username: string | null; name: string; role: string; branchId: BranchId | null };
}

const BRANCH_SHORT: Record<BranchId, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };

export const CATEGORY_META: Record<ActivityCategory, { label: string; icon: React.ReactNode; tint: string }> = {
  order: { label: 'Orders', icon: <ClipboardList className="w-4 h-4" />, tint: 'bg-amber-100 text-amber-800' },
  refund: { label: 'Refunds', icon: <RotateCcw className="w-4 h-4" />, tint: 'bg-red-100 text-red-700' },
  stock: { label: 'Stock', icon: <CircleSlash className="w-4 h-4" />, tint: 'bg-rose-100 text-rose-700' },
  menu: { label: 'Menu', icon: <UtensilsCrossed className="w-4 h-4" />, tint: 'bg-violet-100 text-violet-700' },
  staff: { label: 'Staff', icon: <IdCard className="w-4 h-4" />, tint: 'bg-sky-100 text-sky-700' },
  riders: { label: 'Riders', icon: <Bike className="w-4 h-4" />, tint: 'bg-teal-100 text-teal-700' },
  feedback: { label: 'Feedback', icon: <MessageSquareHeart className="w-4 h-4" />, tint: 'bg-pink-100 text-pink-700' },
  users: { label: 'Users', icon: <UserCog className="w-4 h-4" />, tint: 'bg-stone-200 text-stone-700' },
  gallery: { label: 'Photos', icon: <Images className="w-4 h-4" />, tint: 'bg-emerald-100 text-emerald-700' },
  parlours: { label: 'Parlours', icon: <MapPinned className="w-4 h-4" />, tint: 'bg-orange-100 text-orange-700' },
  signin: { label: 'Sign-ins', icon: <LogIn className="w-4 h-4" />, tint: 'bg-indigo-100 text-indigo-700' },
};

const CATEGORIES = Object.keys(CATEGORY_META) as ActivityCategory[];

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** One entry: "Colombo Manager marked Mango sold out at Colombo". */
export const ActivityRow: React.FC<{ item: ActivityItem; onOpenOrder?: (ref: string) => void; compact?: boolean }> = ({ item, onOpenOrder, compact }) => {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.order;
  const security = item.actor.kind === 'system' && item.category === 'signin';
  const who =
    item.actor.kind === 'customer' ? (
      <>
        Customer <strong className="text-[#241A18]">{item.actor.name}</strong>
      </>
    ) : item.actor.kind === 'rider' ? (
      <>
        Rider <strong className="text-[#241A18]">{item.actor.name}</strong>
      </>
    ) : (
      <strong className="text-[#241A18]">{item.actor.name}</strong>
    );
  return (
    <div className={cx('flex items-start gap-3', compact ? 'py-2.5' : 'px-4 py-3.5')}>
      <span className={cx('w-9 h-9 rounded-full flex items-center justify-center shrink-0', security ? 'bg-red-100 text-red-700' : meta.tint)}>
        {security ? <ShieldAlert className="w-4 h-4" /> : meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#3D2C24] leading-snug">
          {who} {item.summary}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-[#8A7970]">
          <span title={new Date(item.at).toLocaleString()}>
            {clockTime(item.at)} · {timeAgo(item.at)}
          </span>
          {item.branchId && <Badge tone="grey">{BRANCH_SHORT[item.branchId] || item.branchId}</Badge>}
          {item.actor.role === 'branch' && <span>Branch admin</span>}
          {item.actor.role === 'superadmin' && <span>Super admin</span>}
        </div>
      </div>
      {item.ref && onOpenOrder && (item.category === 'order' || item.category === 'refund' || item.category === 'riders' || item.category === 'feedback') && !/^deleted /.test(item.summary) && (
        <Button size="sm" variant="ghost" onClick={() => onOpenOrder(item.ref!)}>
          Open
        </Button>
      )}
    </div>
  );
};

export const ActionCenterView: React.FC<{ branch: BranchFilter; onOpenOrder: (ref: string) => void; onSeen: () => void }> = ({ branch, onOpenOrder, onSeen }) => {
  const [category, setCategory] = useState<'all' | ActivityCategory>('all');
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  const query = useCallback(
    (before?: string) => {
      const q = new URLSearchParams({ limit: '50' });
      if (before) q.set('before', before);
      if (category !== 'all') q.set('category', category);
      if (branch !== 'all') q.set('branch', branch);
      return api<{ items: ActivityItem[]; more: boolean }>(`/activity?${q}`, { as: 'admin' });
    },
    [category, branch]
  );

  // First page, then keep adding new entries at the top while the page is open
  useEffect(() => {
    let first = true;
    setItems(null);
    setError(null);
    return startPolling(
      async () => {
        try {
          const r = await query();
          setError(null);
          setItems((prev) => {
            if (first || !prev) return r.items;
            const known = new Set(prev.map((i) => i.id));
            const fresh = r.items.filter((i) => !known.has(i.id));
            return fresh.length ? [...fresh, ...prev] : prev;
          });
          if (first) setMore(r.more);
          first = false;
          onSeenRef.current();
        } catch (err) {
          if (first) setError(err instanceof ApiError ? err.message : 'Could not load the Action Center.');
        }
      },
      { visibleMs: 15_000, hiddenMs: 60_000 }
    );
  }, [query]);

  const loadMore = async () => {
    if (!items?.length) return;
    setLoadingMore(true);
    try {
      const r = await query(items[items.length - 1].at);
      setItems((prev) => [...(prev || []), ...r.items]);
      setMore(r.more);
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = useMemo(() => {
    const out: { day: string; items: ActivityItem[] }[] = [];
    for (const item of items || []) {
      const day = dayLabel(item.at);
      if (out[out.length - 1]?.day !== day) out.push({ day, items: [] });
      out[out.length - 1].items.push(item);
    }
    return out;
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Show">
        {(['all', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={cx(
              'h-9 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer border transition-colors',
              category === c ? 'bg-[#81001E] text-white border-[#81001E]' : 'bg-white text-[#5C4D44] border-[#E2D8CA] hover:border-[#C9B9A4]'
            )}
          >
            {c === 'all' ? 'Everything' : CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      {error ? (
        <Card className="p-5 text-sm text-red-700">{error}</Card>
      ) : items === null ? (
        <Card className="flex justify-center py-14">
          <div className="w-7 h-7 border-[3px] border-[#81001E]/20 border-t-[#81001E] rounded-full animate-spin" aria-label="Loading" />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={<Activity className="w-6 h-6" />} title="Nothing here yet">
            New orders, status changes, sold-out switches, staff and login changes will show up here as they happen.
          </EmptyState>
        </Card>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#8A7970] mb-2 px-1">{g.day}</h2>
              <Card className="divide-y divide-[#F0E8DC] overflow-hidden">
                {g.items.map((item) => (
                  <ActivityRow key={item.id} item={item} onOpenOrder={onOpenOrder} />
                ))}
              </Card>
            </section>
          ))}
          {more && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Show older'}
              </Button>
            </div>
          )}
          <p className="text-xs text-center text-[#8A7970]">The Action Center keeps the last 90 days.</p>
        </>
      )}
    </div>
  );
};
