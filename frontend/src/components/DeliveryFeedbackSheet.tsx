/**
 * "How was your delivery?" — shown as soon as a customer's delivery arrives (and from Your Orders).
 * The stars go to the rider: they see them in the rider app, the parlour on the Riders page.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Star, X } from 'lucide-react';
import type { OrderRecord } from '../types';
import { STAR_WORDS, dismissFeedback, rateDelivery } from '../utils/deliveryFeedback';
import { Stars } from './Stars';

const shortRef = (ref: string) => '#' + ref.replace(/^AMO-(M)?/, (_, m) => m || '');
const clock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');

export const DeliveryFeedbackSheet: React.FC<{ order: OrderRecord; onClose: () => void }> = ({ order, onClose }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const rider = order.riderName?.split(' ')[0];
  const shown = hover || rating;

  // The thank-you closes by itself
  useEffect(() => {
    if (!sent) return;
    const t = window.setTimeout(onClose, 2600);
    return () => window.clearTimeout(t);
  }, [sent, onClose]);

  const notNow = () => {
    if (!sent) dismissFeedback(order.orderReference);
    onClose();
  };
  const send = () => {
    if (!rating) return;
    rateDelivery(order.orderReference, rating, comment);
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/55 backdrop-blur-xs animate-fadeIn" onClick={notNow} role="dialog" aria-modal="true" aria-label="Rate your delivery">
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#E8DFC8] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={notNow} aria-label="Close" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#F3EDE3] text-[#5C4D44] flex items-center justify-center cursor-pointer">
          <X className="w-4 h-4" />
        </button>

        {sent ? (
          <div className="text-center py-4 animate-fadeIn">
            <Stars value={rating} size="w-8 h-8" />
            <h2 className="font-serif-title text-2xl font-bold text-[#241A18] mt-4">Thank you!</h2>
            <p className="text-sm text-[#5C4D44] mt-1">{rider ? `We’ve passed your stars on to ${rider}.` : 'Your feedback helps us deliver better.'}</p>
            <p className="text-sm text-[#5C4D44]">Enjoy your ice cream 🍦</p>
          </div>
        ) : (
          <>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Delivered {clock(order.deliveredAt)} · {shortRef(order.orderReference)}
            </p>
            <h2 className="font-serif-title text-2xl font-bold text-[#241A18] mt-3 pr-10">How was your delivery?</h2>

            {order.riderName && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#FAF7F2] border border-[#EFE6D8] px-3.5 py-3">
                <span className="w-11 h-11 rounded-full bg-[#8C102A] text-white font-bold text-lg flex items-center justify-center shrink-0">
                  {order.riderName.trim()[0]?.toUpperCase()}
                </span>
                <span className="leading-tight">
                  <span className="block font-bold text-[#241A18]">{order.riderName}</span>
                  <span className="block text-xs text-[#7A6458]">Your Amore rider</span>
                </span>
              </div>
            )}

            <div className="mt-5 text-center">
              <div role="radiogroup" aria-label={rider ? `Rate ${rider}` : 'Rate your delivery'} className="inline-flex gap-1.5" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={rating === s}
                    aria-label={`${s} ${s === 1 ? 'star' : 'stars'}`}
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHover(s)}
                    className="p-1 cursor-pointer transition-transform active:scale-90 hover:scale-110"
                  >
                    <Star className={`w-10 h-10 ${s <= shown ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-[#D9CBB7]'}`} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
              <p className={`h-5 mt-1 text-sm font-bold ${shown ? 'text-[#8C102A]' : 'text-[#A8988B] font-medium'}`}>
                {shown ? STAR_WORDS[shown] : rider ? `Tap a star to rate ${rider}` : 'Tap a star'}
              </p>
            </div>

            {rating > 0 && (
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder={rating >= 4 ? `What went well${rider ? ` with ${rider}` : ''}? (optional)` : 'What went wrong? (optional)'}
                className="mt-4 w-full px-3.5 py-3 text-sm text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden placeholder:text-[#A8988B] animate-fadeIn"
              />
            )}

            <button
              type="button"
              disabled={!rating}
              onClick={send}
              className="mt-5 w-full py-3.5 rounded-2xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-base shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send rating
            </button>
            <button type="button" onClick={notNow} className="mt-1.5 w-full py-2.5 text-sm font-bold text-[#7A6458] cursor-pointer">
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
};
