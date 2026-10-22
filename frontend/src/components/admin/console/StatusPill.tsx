/**
 * Animated order status: a small moving picture for each step
 * (ringing bell, scoop dropping into a cone, scooter riding, bag bouncing, check popping)
 * plus a four-step progress bar.
 */
import React from 'react';
import { BellRing, ShoppingBag, CircleCheck, CircleX } from 'lucide-react';
import { OrderRecord } from '../../../types';
import { isPickup, statusLabel } from './orderMeta';
import { cx } from './ui';

export const ConeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
    <path d="M7 11.5 L12 22.5 L17 11.5 Z" fill="#EDC184" stroke="#B9823A" strokeWidth="1" strokeLinejoin="round" />
    <path d="M8.6 14 H15.4 M9.8 16.8 H14.2 M10.6 13 L13.6 19.5 M13.4 13 L10.4 19.5" stroke="#B9823A" strokeWidth="0.7" />
    <circle className="anim-scoop" cx="12" cy="8.3" r="4.4" fill="currentColor" />
    <circle className="anim-sparkle" cx="19.3" cy="3.6" r="1.3" fill="#F59E0B" />
    <circle className="anim-sparkle" cx="4.6" cy="5" r="0.9" fill="#F59E0B" style={{ animationDelay: '0.5s' }} />
  </svg>
);

export const ScooterIcon = () => (
  <svg viewBox="0 0 30 20" className="w-7 h-6" aria-hidden="true">
    <line className="anim-speed" x1="1" y1="7" x2="6" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <line className="anim-speed-2" x1="2" y1="11" x2="7" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <g className="anim-ride">
      <rect x="10" y="5.5" width="7" height="6" rx="1.3" fill="currentColor" />
      <path d="M10 13.5 H20.5 L23.5 6 H26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="anim-wheel" cx="11.5" cy="15.5" r="2.7" fill="white" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 1.6" />
      <circle className="anim-wheel" cx="22.5" cy="15.5" r="2.7" fill="white" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 1.6" />
    </g>
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="12" x2="12" y2="7.5" />
    <line className="anim-clock-hand" x1="12" y1="12" x2="15.5" y2="12" />
  </svg>
);

const TEXT: Record<string, string> = {
  amber: 'text-amber-600',
  blue: 'text-sky-600',
  violet: 'text-violet-600',
  green: 'text-emerald-600',
  grey: 'text-stone-400',
};

/** Which of the four steps (New, Preparing, Ready/Out, Done) the order is on; -1 when cancelled. */
function stepIndex(o: OrderRecord): number {
  switch (o.status) {
    case 'pending_confirmation':
      return 0;
    case 'paid':
    case 'confirmed':
    case 'preparing':
      return 1;
    case 'on_the_way':
      return 2;
    case 'delivered':
      return 3;
    default:
      return -1;
  }
}

export const StatusPill: React.FC<{ order: OrderRecord; showSteps?: boolean }> = ({ order, showSteps = true }) => {
  const s = statusLabel(order);
  const color = order.status === 'on_the_way' && !isPickup(order) ? 'text-blue-600' : TEXT[s.tone] || 'text-stone-500';

  let icon: React.ReactNode;
  switch (order.status) {
    case 'pending_confirmation':
      icon = <BellRing className="w-5 h-5 anim-bell" />;
      break;
    case 'paid':
    case 'confirmed':
      icon = <ClockIcon />;
      break;
    case 'preparing':
      icon = <ConeIcon />;
      break;
    case 'on_the_way':
      icon = isPickup(order) ? <ShoppingBag className="w-5 h-5 anim-bag" /> : <ScooterIcon />;
      break;
    case 'delivered':
      icon = <CircleCheck className="w-5 h-5 anim-check" />;
      break;
    default:
      icon = <CircleX className="w-5 h-5" />;
  }

  const step = stepIndex(order);
  const label =
    order.status === 'pending_confirmation' ? 'New order' : order.status === 'confirmed' || order.status === 'paid' ? 'Accepted' : s.label;

  return (
    <div className={cx('inline-flex flex-col gap-1.5', color)}>
      {/* key: re-run the entrance animation when the status changes */}
      <span key={order.status} className="inline-flex items-center gap-2 animate-scaleUp">
        <span className="w-7 h-6 flex items-center justify-center shrink-0">{icon}</span>
        <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
      </span>
      {showSteps && step >= 0 && (
        <span className="flex gap-1 w-28" aria-label={`Step ${step + 1} of 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cx(
                'h-1.5 flex-1 rounded-full',
                i < step || step === 3 ? 'bg-current' : i === step ? 'seg-active' : 'bg-stone-200'
              )}
            />
          ))}
        </span>
      )}
    </div>
  );
};
