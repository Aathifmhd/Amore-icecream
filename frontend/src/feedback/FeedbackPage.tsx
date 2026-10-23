/**
 * The feedback page customers open from the email sent an hour after their order
 * (/feedback/<ref>?k=<key>). No sign-in: the key in the link fits that one order.
 * Stars for the order, quick tags, a comment, and the rider's stars if not given yet.
 * The parlour reads it all in the console (Feedback); riders only ever see their stars.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import { AmoreLogo } from '../components/AmoreLogo';
import { api, ApiError } from '../api';

interface PageOrder {
  orderReference: string;
  customerFirstName: string;
  branchName: string;
  orderType: 'delivery' | 'pickup';
  status: string;
  deliveredAt: string | null;
  items: { name: string; format: string | null; quantity: number }[];
  riderFirstName: string | null;
  riderRated: boolean;
  feedback: { rating: number; comment: string; tags: string[]; at: string } | null;
}

const WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Loved it!'];
// Must match FEEDBACK_TAGS in backend/src/feedback.js
const HAPPY = {
  delivery: ['Delicious', 'Generous portions', 'Arrived cold', 'Well packed', 'Friendly rider', 'Good value'],
  pickup: ['Delicious', 'Generous portions', 'Friendly staff', 'Quick pickup', 'Good value'],
};
const UNHAPPY = {
  delivery: ['Melted', 'Arrived late', 'Wrong item', 'Missing item', 'Packaging', 'Too sweet'],
  pickup: ['Long wait', 'Wrong item', 'Missing item', 'Too sweet'],
};

const shortRef = (ref: string) => '#' + ref.replace(/^AMO-(M)?/, (_, m) => m || '');
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

const StarPicker: React.FC<{ value: number; onChange: (n: number) => void; size: string; label: string }> = ({ value, onChange, size, label }) => {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={`${s} ${s === 1 ? 'star' : 'stars'}`}
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          className="p-1 cursor-pointer transition-transform active:scale-90 hover:scale-110"
        >
          <Star className={`${size} ${s <= shown ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-[#D9CBB7]'}`} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
};

const ShowStars: React.FC<{ value: number }> = ({ value }) => (
  <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} className={`w-6 h-6 ${s <= value ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-[#D9CBB7]'}`} />
    ))}
  </span>
);

export default function FeedbackPage() {
  const ref = decodeURIComponent(window.location.pathname.split('/')[2] || '');
  const key = new URLSearchParams(window.location.search).get('k') || '';
  const path = `/feedback/order/${encodeURIComponent(ref)}?k=${encodeURIComponent(key)}`;

  const [order, setOrder] = useState<PageOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [riderRating, setRiderRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    api<{ order: PageOrder }>(path, { as: 'none' })
      .then((r) => setOrder(r.order))
      .catch((err) => setError(err instanceof ApiError && err.status ? err.message : 'We couldn’t load this page. Check your connection and try again.'));
  }, [path]);

  const kind = order?.orderType === 'pickup' ? 'pickup' : 'delivery';
  const choices = rating === 0 ? [] : rating >= 4 ? HAPPY[kind] : UNHAPPY[kind];
  const pickStars = (n: number) => {
    setRating(n);
    // Keep only tags that still fit the new stars
    setTags((t) => t.filter((x) => (n >= 4 ? HAPPY[kind] : UNHAPPY[kind]).includes(x)));
  };
  const toggle = (t: string) => setTags((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));

  const send = async () => {
    if (!rating) return;
    setBusy(true);
    setSendError(null);
    try {
      const r = await api<{ order: PageOrder }>(path, { method: 'POST', body: { rating, tags, comment, ...(riderRating && { riderRating }) }, as: 'none' });
      setOrder(r.order);
      setJustSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSendError(err instanceof ApiError && err.status ? err.message : 'No connection. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const stopEmails = async () => {
    try {
      await api(`/feedback/order/${encodeURIComponent(ref)}/stop?k=${encodeURIComponent(key)}`, { method: 'POST', as: 'none' });
      setStopped(true);
    } catch {
      /* the link still works another time */
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAF7F2] text-[#241A18]">
      <header className="pt-8 pb-4 flex justify-center">
        <a href="/" aria-label="Amore home">
          <AmoreLogo size="md" />
        </a>
      </header>
      <main className="max-w-md mx-auto px-4 pb-12">
        {error ? (
          <Panel>
            <h1 className="font-serif-title text-2xl font-bold">This link doesn’t work</h1>
            <p className="mt-2 text-[#5C4D44]">{error}</p>
            <HomeButton />
          </Panel>
        ) : !order ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#8C102A]" />
          </div>
        ) : order.feedback ? (
          <Panel>
            <div className="text-center">
              <span className="mx-auto w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </span>
              <h1 className="font-serif-title text-2xl font-bold mt-4">{justSent ? `Thank you, ${order.customerFirstName}!` : 'You already sent feedback'}</h1>
              <p className="mt-1 text-[#5C4D44]">
                {justSent ? 'Your feedback goes straight to the Amore team.' : `Sent ${when(order.feedback.at)} for order ${shortRef(order.orderReference)}.`}
              </p>
              <div className="mt-5">
                <ShowStars value={order.feedback.rating} />
              </div>
              {order.feedback.comment && <p className="mt-3 text-[#3D2C24]">“{order.feedback.comment}”</p>}
              {order.feedback.tags.length > 0 && <p className="mt-2 text-sm text-[#7A6458]">{order.feedback.tags.join(' · ')}</p>}
              <HomeButton label="Order again" />
            </div>
          </Panel>
        ) : (
          <>
            <Panel>
              <h1 className="font-serif-title text-2xl font-bold leading-tight">How was your order{order.customerFirstName ? `, ${order.customerFirstName}` : ''}?</h1>
              <p className="mt-1 text-sm text-[#7A6458]">
                {shortRef(order.orderReference)} · {order.branchName}
                {order.deliveredAt && <> · {order.orderType === 'pickup' ? 'collected' : 'delivered'} {when(order.deliveredAt)}</>}
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {order.items.map((i, k) => (
                  <li key={k} className="px-3 py-1.5 rounded-full bg-[#FAF7F2] border border-[#EFE6D8] text-sm">
                    <span className="font-bold text-[#8C102A]">{i.quantity}×</span> {i.name}
                    {i.format && <span className="text-[#8A7970]"> · {i.format.replace(/-/g, ' ')}</span>}
                  </li>
                ))}
              </ul>
            </Panel>

            {order.status !== 'delivered' ? (
              <Panel>
                <p className="text-[#5C4D44]">You can give feedback once you have your order.</p>
              </Panel>
            ) : (
              <Panel>
                <div className="text-center">
                  <p className="font-bold">Your rating</p>
                  <div className="mt-2">
                    <StarPicker value={rating} onChange={pickStars} size="w-11 h-11" label="Rate your order" />
                  </div>
                  <p className={`h-5 mt-1 text-sm font-bold ${rating ? 'text-[#8C102A]' : 'text-[#A8988B] font-medium'}`}>{rating ? WORDS[rating] : 'Tap a star'}</p>
                </div>

                {choices.length > 0 && (
                  <div className="mt-5 animate-fadeIn">
                    <p className="text-sm font-bold">{rating >= 4 ? 'What did you like?' : 'What went wrong?'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {choices.map((t) => (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={tags.includes(t)}
                          onClick={() => toggle(t)}
                          className={`h-10 px-4 rounded-full border text-sm font-semibold cursor-pointer transition-colors ${
                            tags.includes(t) ? 'bg-[#8C102A] text-white border-[#8C102A]' : 'bg-white text-[#3D2C24] border-[#D9CBB7] hover:border-[#8C102A]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {rating > 0 && (
                  <label className="block mt-5 animate-fadeIn">
                    <span className="text-sm font-bold">Tell us more <span className="font-normal text-[#8A7970]">(optional)</span></span>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                      maxLength={1000}
                      placeholder={rating >= 4 ? 'Your favourite flavour, a shout-out to the team…' : 'What could we do better?'}
                      className="mt-2 w-full px-3.5 py-3 text-[15px] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden placeholder:text-[#A8988B]"
                    />
                  </label>
                )}

                {rating > 0 && order.riderFirstName && !order.riderRated && (
                  <div className="mt-5 pt-5 border-t border-[#F0E8DC] animate-fadeIn">
                    <p className="text-sm font-bold">How was {order.riderFirstName}, your rider?</p>
                    <div className="mt-1">
                      <StarPicker value={riderRating} onChange={setRiderRating} size="w-8 h-8" label={`Rate ${order.riderFirstName}`} />
                    </div>
                  </div>
                )}

                {sendError && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{sendError}</p>}
                <button
                  type="button"
                  disabled={!rating || busy}
                  onClick={send}
                  className="mt-6 w-full py-4 rounded-2xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-base shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy && <Loader2 className="w-5 h-5 animate-spin" />}
                  Send feedback
                </button>
              </Panel>
            )}

            <p className="mt-6 text-center text-xs text-[#8A7970]">
              {stopped ? (
                'You won’t get feedback emails from us any more.'
              ) : (
                <button type="button" onClick={stopEmails} className="underline cursor-pointer">
                  Stop these emails
                </button>
              )}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

const Panel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="mt-4 bg-white rounded-3xl border border-[#E8DFC8] shadow-xs p-5">{children}</section>
);

const HomeButton: React.FC<{ label?: string }> = ({ label = 'Go to Amore' }) => (
  <a href="/" className="mt-6 inline-flex w-full justify-center py-3.5 rounded-2xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold">
    {label}
  </a>
);
