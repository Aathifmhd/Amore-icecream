import React, { useEffect, useRef, useState } from 'react';
import { MenuItem, ScoopItem } from '../../types';
import {
  getAllGelatoFlavours,
  getAllCoffeeItems,
  getAllCakeItems,
  MENU_UPDATED_EVENT,
} from '../../utils/menuStorage';

const MOBILE_QUERY = '(max-width: 767px)';

/** True on phone-sized screens, where the dedicated mobile layout is shown. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

/** Live menu (scoops, coffee, cakes) that follows admin edits synced from Firestore. */
export function useMenuItems() {
  const read = () => ({
    scoops: getAllGelatoFlavours() as ScoopItem[],
    coffee: getAllCoffeeItems() as MenuItem[],
    cakes: getAllCakeItems() as MenuItem[],
  });
  const [menu, setMenu] = useState(read);
  useEffect(() => {
    const refresh = () => setMenu(read());
    window.addEventListener(MENU_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(MENU_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return menu;
}

export const isScoop = (item: ScoopItem | MenuItem): item is ScoopItem => 'tastingNotes' in item;

export const isSoldOut = (item: ScoopItem | MenuItem) => item.isAvailable === false;

/** Lowest price of an item, for "from LKR …" labels. */
export const startingPriceLKR = (item: ScoopItem | MenuItem) =>
  isScoop(item) ? Math.min(item.conePriceLKR, item.biscuitCupPriceLKR) : item.priceLKR;

/**
 * Wraps content that fades and rises into view the first time it scrolls on screen.
 * `delay` (ms) staggers items in a row.
 */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li';
}> = ({ children, delay = 0, className = '', as = 'div' }) => {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return React.createElement(
    as,
    {
      ref,
      className: `reveal ${visible ? 'is-visible' : ''} ${className}`,
      style: { '--reveal-delay': `${delay}ms` } as React.CSSProperties,
    },
    children
  );
};
