import React from 'react';
import overflowTile from '../assets/images/overflow_ribbon_tile.webp';

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

// Drip tips in the tile (percent of tile width / height) that shed animated droplets
const DROPLETS = [
  { x: 26.2, y: 69.3, delay: 0 },
  { x: 49.4, y: 95.9, delay: 1.7 },
  { x: 75.1, y: 74.1, delay: 3.2 },
  { x: 95.4, y: 89.6, delay: 4.6 },
];

// Enough tiles to cover very wide screens; extras are clipped
const TILE_COUNT = 4;

/**
 * Glossy crimson band overflowing with drips (from the reference photo), with the
 * flavour list scrolling across it and droplets forming and falling from the tips.
 */
export const OverflowRibbon: React.FC<{ className?: string }> = ({ className = '' }) => {
  // The list is rendered twice so the loop is seamless; screen readers get it once.
  const run = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {RIBBON_ITEMS.map((item) => (
        <li key={item} className="flex items-center whitespace-nowrap">
          <span className="px-5">{item}</span>
          <span className="text-amber-300" aria-hidden="true">✦</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`overflow-ribbon ${className}`}>
      <div className="overflow-ribbon__tiles" aria-hidden="true">
        {Array.from({ length: TILE_COUNT }, (_, t) => (
          <div key={t} className="overflow-ribbon__tile" style={{ backgroundImage: `url(${overflowTile})` }}>
            {DROPLETS.map((d) => (
              <span
                key={d.x}
                className="overflow-ribbon__drop"
                style={{ left: `${d.x}%`, top: `${d.y}%`, animationDelay: `${d.delay + t * 0.6}s` }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="overflow-ribbon__band ribbon">
        <div className="ribbon-track flex w-max">
          {run(false)}
          {run(true)}
        </div>
      </div>
    </div>
  );
};
