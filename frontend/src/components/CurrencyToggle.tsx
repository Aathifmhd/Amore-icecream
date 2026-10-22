import React from 'react';
import { Currency } from '../types';

interface CurrencyToggleProps {
  currency: Currency;
  onToggle?: (newCurrency: Currency) => void;
  onToggleCurrency?: (newCurrency: Currency) => void;
  className?: string;
  variant?: 'pill' | 'compact' | 'light';
}

export const CurrencyToggle: React.FC<CurrencyToggleProps> = ({
  currency,
  onToggle,
  onToggleCurrency,
  className = '',
}) => {
  const isUSD = currency === 'USD';

  const handleToggle = () => {
    const next: Currency = isUSD ? 'LKR' : 'USD';
    if (typeof onToggle === 'function') {
      onToggle(next);
    } else if (typeof onToggleCurrency === 'function') {
      onToggleCurrency(next);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isUSD}
      onClick={handleToggle}
      className={`relative inline-flex items-center select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-full transition-transform active:scale-[0.96] ${className}`}
      title={isUSD ? 'Displaying prices in USD ($) — Tap to switch to LKR' : 'Displaying prices in LKR (Rs) — Tap to switch to USD'}
      aria-label="Toggle Dollar currency"
    >
      {/* iOS Styled Track with subtle inner depth */}
      <div
        className={`relative w-[52px] h-[30px] rounded-full transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] p-[3px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] border ${
          isUSD
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-600/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15),0_0_12px_rgba(16,185,129,0.25)]'
            : 'bg-[#E3DCDB] border-[#D1C5C2] hover:bg-[#DDD4D2]'
        }`}
      >
        {/* Subtle background track watermark / indicator */}
        <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
          <span
            className={`text-[11px] font-black tracking-tight select-none transition-opacity duration-200 pl-0.5 ${
              isUSD ? 'opacity-0' : 'opacity-35 text-[#54413B]'
            }`}
          >
            Rs
          </span>
          <span
            className={`text-[12px] font-black tracking-tight select-none transition-opacity duration-200 pr-0.5 ${
              isUSD ? 'opacity-30 text-white' : 'opacity-0'
            }`}
          >
            $
          </span>
        </div>

        {/* Tactile iPhone Thumb with embedded $ currency mark */}
        <div
          className={`relative w-[24px] h-[24px] rounded-full bg-white flex items-center justify-center transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_2px_6px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.1)] ${
            isUSD ? 'translate-x-[22px]' : 'translate-x-0'
          }`}
        >
          {/* Subtle 3D shine on thumb edge */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white to-[#F6F4F2] border border-black/5" />

          {/* Dollar symbol inside the thumb button */}
          <span
            className={`relative z-10 text-[13px] font-black leading-none transition-colors duration-250 ${
              isUSD
                ? 'text-emerald-700 drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                : 'text-[#8A7970]'
            }`}
          >
            $
          </span>
        </div>
      </div>
    </button>
  );
};
