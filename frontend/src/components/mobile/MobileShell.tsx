import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BranchId, Currency, MenuItem, MenuTab, ScoopItem, SelectedOrderItem } from '../../types';
import { type User } from '../../customerAuth';
import { MobileHome } from './MobileHome';
import { MobileMenu } from './MobileMenu';
import { ItemSheet } from './ItemSheet';
import { AddedToast, MobileTabBar } from './MobileTabBar';

interface MobileShellProps {
  page: 'home' | 'menu';
  menuTab: MenuTab;
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  selectedBranch: BranchId;
  onSelectBranch: (b: BranchId) => void;
  orderItems: SelectedOrderItem[];
  ordersCount: number;
  currentUser: User | null;
  onAddToTray: (item: SelectedOrderItem) => void;
  onGoHome: () => void;
  onGoMenu: (tab?: MenuTab) => void;
  onOpenTray: () => void;
  onOpenOrders: () => void;
  onOpenAccount: () => void;
}

const FORMAT_LABEL: Record<string, string> = {
  'waffle-cone': 'waffle cone',
  'biscuit-cup': 'biscuit cup',
};

/** Phone layout for customers: home or menu, plus the bottom tab bar and add-to-tray sheet. */
export const MobileShell: React.FC<MobileShellProps> = ({
  page,
  menuTab,
  currency,
  onToggleCurrency,
  selectedBranch,
  onSelectBranch,
  orderItems,
  ordersCount,
  currentUser,
  onAddToTray,
  onGoHome,
  onGoMenu,
  onOpenTray,
  onOpenOrders,
  onOpenAccount,
}) => {
  const [sheetItem, setSheetItem] = useState<ScoopItem | MenuItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showAdded = useCallback((item: SelectedOrderItem) => {
    const what = `${item.quantity > 1 ? `${item.quantity} × ` : ''}${item.name}${item.format ? ` · ${FORMAT_LABEL[item.format] || ''}` : ''}`;
    setToast(`Added ${what}`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const add = (item: SelectedOrderItem) => {
    onAddToTray(item);
    setSheetItem(null);
    showAdded(item);
  };

  const quickAdd = (item: MenuItem) =>
    add({ itemId: item.id, name: item.name, category: item.category, priceLKR: item.priceLKR, quantity: 1, image: item.image });

  const trayCount = orderItems.reduce((sum, it) => sum + it.quantity, 0);
  const trayTotal = orderItems.reduce((sum, it) => sum + it.priceLKR * it.quantity, 0);

  return (
    <>
      {page === 'home' ? (
        <MobileHome
          currency={currency}
          onToggleCurrency={onToggleCurrency}
          selectedBranch={selectedBranch}
          onSelectBranch={onSelectBranch}
          onOpenMenu={onGoMenu}
          onOpenItem={setSheetItem}
        />
      ) : (
        <MobileMenu
          key={menuTab}
          currency={currency}
          onToggleCurrency={onToggleCurrency}
          selectedBranch={selectedBranch}
          onSelectBranch={onSelectBranch}
          orderItems={orderItems}
          initialTab={menuTab}
          onOpenItem={setSheetItem}
          onQuickAdd={quickAdd}
        />
      )}

      {toast && !sheetItem && (
        <AddedToast
          message={toast}
          onViewTray={() => {
            setToast(null);
            onOpenTray();
          }}
        />
      )}

      <MobileTabBar
        active={page}
        trayCount={trayCount}
        trayTotalLKR={trayTotal}
        currency={currency}
        ordersCount={ordersCount}
        currentUser={currentUser}
        onHome={onGoHome}
        onMenu={() => onGoMenu('all')}
        onTray={onOpenTray}
        onOrders={onOpenOrders}
        onAccount={onOpenAccount}
      />

      {sheetItem && (
        <ItemSheet item={sheetItem} currency={currency} onClose={() => setSheetItem(null)} onAdd={add} />
      )}
    </>
  );
};
