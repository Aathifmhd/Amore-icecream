import React from 'react';
import { Star } from 'lucide-react';

/** 1–5 stars, filled up to `value` (delivery ratings) */
export const Stars: React.FC<{ value: number; size?: string; className?: string }> = ({ value, size = 'w-4 h-4', className = '' }) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} className={`${size} ${s <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-[#D9CBB7]'}`} />
    ))}
  </span>
);
