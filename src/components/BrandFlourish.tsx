import React from 'react';

const RIBBON_ITEMS = [
  'Iconic Durian custard',
  'Alphonso mango',
  'Edible biscuit cups',
  'Sicilian pistachio',
  '100% Halal',
  'Churned fresh daily',
  'Ceylon cardamom',
  'Barista coffee',
];

/** Slowly scrolling crimson strip of flavours and promises. */
export const FlavourRibbon: React.FC<{ className?: string }> = ({ className = '' }) => {
  // The list is rendered twice so the loop is seamless; screen readers get it once.
  const run = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {RIBBON_ITEMS.map((item) => (
        <li key={item} className="flex items-center whitespace-nowrap">
          <span className="px-4 text-[13px] font-semibold tracking-wide">{item}</span>
          <span className="text-amber-300 text-xs" aria-hidden="true">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`ribbon overflow-hidden bg-[#81001E] text-white py-2.5 ${className}`}>
      <div className="ribbon-track flex w-max">
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
};

/** Melting ice-cream drips hanging from a crimson edge. */
export const DripEdge: React.FC<{ className?: string; flip?: boolean }> = ({ className = '', flip = false }) => (
  <div aria-hidden="true" className={`drip-edge h-10 w-full ${flip ? 'rotate-180' : ''} ${className}`} />
);
