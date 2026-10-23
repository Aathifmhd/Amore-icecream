/**
 * Feedback (console): everything customers said — the order feedback from the emailed feedback
 * page (stars, quick tags, comment) and the rider's stars and comment from the delivery popup.
 * Riders only ever see their stars; the comments are read here. Newest first.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Bike, Mail, MessageSquareHeart, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { OrderRecord } from '../../../types';
import { api } from '../../../api';
import { Stars } from '../../Stars';
import { Badge, Card, EmptyState, cx } from './ui';
import { BranchFilter, inBranch } from './useConsoleData';
import { isPickup, shortRef, timeAgo } from './orderMeta';
import { Stat } from './RidersView';

type Filter = 'all' | 'unhappy' | 'okay' | 'happy' | 'comments';

const ISSUE_TAGS = ['Melted', 'Arrived late', 'Wrong item', 'Missing item', 'Packaging', 'Too sweet', 'Long wait'];

/** When the customer last said something about this order */
const saidAt = (o: OrderRecord) => [o.feedbackAt, o.ratedAt].filter(Boolean).sort().pop() || '';
/** The lowest stars on the order (order or rider), to find unhappy customers */
const lowest = (o: OrderRecord) => Math.min(o.feedbackRating ?? 6, o.riderRating ?? 6);
const average = (list: number[]) => (list.length ? list.reduce((s, n) => s + n, 0) / list.length : null);

export const FeedbackView: React.FC<{ orders: OrderRecord[]; branch: BranchFilter; onOpenOrder: (ref: string) => void }> = ({ orders, branch, onOpenOrder }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [email, setEmail] = useState<{ emailOn: boolean; sentThisWeek: number } | null>(null);
  useEffect(() => {
    api<{ emailOn: boolean; sentThisWeek: number }>('/feedback/status', { as: 'admin' })
      .then(setEmail)
      .catch(() => setEmail(null));
  }, []);

  const reviews = useMemo(
    () => orders.filter((o) => inBranch(o, branch) && (o.feedbackAt || o.riderRating)).sort((a, b) => saidAt(b).localeCompare(saidAt(a))),
    [orders, branch]
  );
  const orderStars = reviews.filter((o) => o.feedbackRating).map((o) => o.feedbackRating!);
  const riderStars = reviews.filter((o) => o.riderRating).map((o) => o.riderRating!);
  const unhappy = reviews.filter((o) => lowest(o) <= 2);
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    reviews.forEach((o) => (o.feedbackTags || []).forEach((t) => m.set(t, (m.get(t) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [reviews]);

  const shown = reviews.filter((o) => {
    const low = lowest(o);
    if (filter === 'unhappy') return low <= 2;
    if (filter === 'okay') return low === 3;
    if (filter === 'happy') return low >= 4;
    if (filter === 'comments') return Boolean(o.feedbackComment || o.riderFeedback);
    return true;
  });

  const avgOrder = average(orderStars);
  const avgRider = average(riderStars);
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: reviews.length },
    { id: 'unhappy', label: 'Unhappy (1–2★)', count: unhappy.length },
    { id: 'okay', label: 'Okay (3★)', count: reviews.filter((o) => lowest(o) === 3).length },
    { id: 'happy', label: 'Happy (4–5★)', count: reviews.filter((o) => lowest(o) >= 4).length },
    { id: 'comments', label: 'With comments', count: reviews.filter((o) => o.feedbackComment || o.riderFeedback).length },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<Star className="w-5 h-5" />} label="Order rating" value={avgOrder ? `${avgOrder.toFixed(1)} ★` : '—'} hint={`${orderStars.length} from the feedback page`} />
        <Stat icon={<Bike className="w-5 h-5" />} label="Rider rating" value={avgRider ? `${avgRider.toFixed(1)} ★` : '—'} hint={`${riderStars.length} delivery ratings`} />
        <Stat icon={<ThumbsDown className="w-5 h-5" />} label="Unhappy customers" value={`${unhappy.length}`} hint="1 or 2 stars — worth a call" alert={unhappy.length > 0} />
        <Stat
          icon={<Mail className="w-5 h-5" />}
          label="Feedback emails"
          value={!email ? '…' : email.emailOn ? 'On' : 'Off'}
          hint={!email ? '' : email.emailOn ? `${email.sentThisWeek} sent this week, 1 hour after each order` : 'Set SMTP_USER and SMTP_PASS to switch on'}
        />
      </div>

      {tagCounts.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold text-[#241A18] mb-2.5">What customers mention</p>
          <div className="flex flex-wrap gap-2">
            {tagCounts.map(([tag, n]) => (
              <Badge key={tag} tone={ISSUE_TAGS.includes(tag) ? 'red' : 'green'}>
                {ISSUE_TAGS.includes(tag) ? <ThumbsDown className="w-3 h-3" /> : <ThumbsUp className="w-3 h-3" />}
                {tag} · {n}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter feedback">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cx(
              'h-9 px-3.5 rounded-full border text-sm font-semibold cursor-pointer transition-colors',
              filter === f.id ? 'bg-[#81001E] text-white border-[#81001E]' : 'bg-white text-[#5C4D44] border-[#E2D8CA] hover:border-[#C9B9A4]'
            )}
          >
            {f.label} <span className={filter === f.id ? 'text-white/70' : 'text-[#A8988B]'}>{f.count}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<MessageSquareHeart className="w-6 h-6" />} title={reviews.length ? 'Nothing here' : 'No feedback yet'}>
            {reviews.length
              ? 'Try another filter.'
              : 'Customers rate the rider when their order arrives, and get an email an hour later to tell you about the order.'}
          </EmptyState>
        </Card>
      ) : (
        <Card className="divide-y divide-[#F0E8DC] overflow-hidden">
          {shown.map((o) => (
            <button
              key={o.orderReference}
              type="button"
              onClick={() => onOpenOrder(o.orderReference)}
              className={cx('w-full text-left px-4 py-3.5 hover:bg-[#FBF8F3] cursor-pointer transition-colors', lowest(o) <= 2 && 'shadow-[inset_4px_0_0_#DC2626]')}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {o.feedbackAt ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Stars value={o.feedbackRating || 0} />
                        <span className="text-xs font-semibold text-[#7A6458]">Order</span>
                      </div>
                      {o.feedbackComment && <p className="mt-1 text-[15px] text-[#241A18]">“{o.feedbackComment}”</p>}
                      {!!o.feedbackTags?.length && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {o.feedbackTags.map((t) => (
                            <Badge key={t} tone={ISSUE_TAGS.includes(t) ? 'red' : 'grey'}>
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null}
                  {o.riderRating ? (
                    <p className={cx('flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#5C4D44]', o.feedbackAt && 'mt-2')}>
                      <Stars value={o.riderRating} size="w-3.5 h-3.5" />
                      <span className="font-semibold">Rider {o.riderName || ''}</span>
                      {o.riderFeedback && <span className="italic">“{o.riderFeedback}”</span>}
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-[#7A6458]">
                    <span className="font-semibold text-[#3D2C24]">{o.customerName}</span> · <span className="font-mono">{shortRef(o.orderReference)}</span>
                    {branch === 'all' && <> · {o.branchName?.replace(' Flagship', '')}</>} · {isPickup(o) ? 'Pickup' : 'Delivery'}
                  </p>
                </div>
                <span className="text-xs text-[#8A7970] whitespace-nowrap">{timeAgo(saidAt(o))}</span>
              </div>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
};
