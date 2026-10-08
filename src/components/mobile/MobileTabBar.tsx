import React from 'react';
import { Home, UtensilsCrossed, ShoppingBag, Clock, User as UserIcon } from 'lucide-react';
import { Currency } from '../../types';
import { formatPrice } from '../../utils/currency';
import { type User } from '../../firebase';

interface MobileTabBarProps {
  active: 'home' | 'menu';
  trayCount: number;
  trayTotalLKR: number;
  currency: Currency;
  ordersCount: number;
  currentUser: User | null;
  onHome: () => void;
  onMenu: () => void;
  onTray: () => void;
  onOrders: () => void;
  onAccount: () => void;
}

/** Always-visible bottom navigation for phones, so the menu and tray are one tap away. */
export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  active,
  trayCount,
  trayTotalLKR,
  currency,
  ordersCount,
  currentUser,
  onHome,
  onMenu,
  onTray,
  onOrders,
  onAccount,
}) => {
  const tab = (isActive: boolean) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[11px] font-semibold transition-colors ${
      isActive ? 'text-[#8C102A]' : 'text-[#7A6458]'
    }`;

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E8DFC8] shadow-[0_-4px_20px_rgba(36,26,24,0.06)] pb-safe"
    >
      <div className="flex items-stretch h-16">
        <button type="button" onClick={onHome} className={tab(active === 'home')} aria-current={active === 'home' ? 'page' : undefined}>
          <Home className="w-[22px] h-[22px]" />
          <span>Home</span>
        </button>

        <button type="button" onClick={onMenu} className={tab(active === 'menu')} aria-current={active === 'menu' ? 'page' : undefined}>
          <UtensilsCrossed className="w-[22px] h-[22px]" />
          <span>Menu</span>
        </button>

        {/* Tray: the main action, raised and showing the running total */}
        <div className="flex-1 flex items-start justify-center">
          <button
            type="button"
            onClick={onTray}
            aria-label={`Your tray, ${trayCount} item${trayCount === 1 ? '' : 's'}`}
            className="-mt-5 flex flex-col items-center"
          >
            <span className="relative w-14 h-14 rounded-full bg-[#8C102A] text-white flex items-center justify-center shadow-lg ring-4 ring-white">
              <ShoppingBag className="w-6 h-6 text-amber-200" />
              {trayCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-[#8C102A] text-[11px] font-black flex items-center justify-center">
                  {trayCount}
                </span>
              )}
            </span>
            <span className="text-[11px] font-bold text-[#8C102A] mt-0.5">
              {trayCount > 0 ? formatPrice(trayTotalLKR, currency) : 'Tray'}
            </span>
          </button>
        </div>

        <button type="button" onClick={onOrders} className={`${tab(false)} relative`}>
          <span className="relative">
            <Clock className="w-[22px] h-[22px]" />
            {ordersCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-[#8C102A] text-white text-[9px] font-black flex items-center justify-center">
                {ordersCount}
              </span>
            )}
          </span>
          <span>Orders</span>
        </button>

        <button type="button" onClick={onAccount} className={tab(false)}>
          {currentUser?.photoURL ? (
            <img src={currentUser.photoURL} alt="" referrerPolicy="no-referrer" className="w-[22px] h-[22px] rounded-full object-cover" />
          ) : (
            <UserIcon className="w-[22px] h-[22px]" />
          )}
          <span>{currentUser ? 'Account' : 'Sign in'}</span>
        </button>
      </div>
    </nav>
  );
};

interface AddedToastProps {
  message: string;
  onViewTray: () => void;
}

/** Small confirmation shown above the tab bar after adding an item — no popup. */
export const AddedToast: React.FC<AddedToastProps> = ({ message, onViewTray }) => (
  <div
    role="status"
    aria-live="polite"
    className="fixed inset-x-3 z-50 animate-toast-in"
    style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
  >
    <div className="flex items-center gap-3 rounded-2xl bg-[#241A18] text-white pl-4 pr-2 py-2.5 shadow-xl">
      <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-black shrink-0">✓</span>
      <span className="flex-1 text-sm font-medium truncate">{message}</span>
      <button type="button" onClick={onViewTray} className="shrink-0 px-3 py-1.5 rounded-xl bg-white/10 text-amber-200 text-sm font-bold">
        View tray
      </button>
    </div>
  </div>
);
