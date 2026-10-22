import React from 'react';
import { Currency, BranchId, SelectedOrderItem } from '../types';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import { formatPrice } from '../utils/currency';
import { ShoppingBag, Utensils, MapPin } from 'lucide-react';

interface MobileBottomBarProps {
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  selectedBranch: BranchId;
  onSelectBranch: (b: BranchId) => void;
  orderItems: SelectedOrderItem[];
  onOpenOrderModal: () => void;
  onNavigateToMenu: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  currency,
  selectedBranch,
  onSelectBranch,
  orderItems,
  onOpenOrderModal,
  onNavigateToMenu,
}) => {
  const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalLKR = orderItems.reduce((sum, item) => sum + item.totalPriceLKR, 0);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-[#E8DFC8] px-3 py-2.5 shadow-2xl flex items-center justify-between gap-2">
      {/* Branch selector chip */}
      <div className="flex items-center gap-1.5 text-xs text-[#5C4D44] truncate max-w-[170px]">
        <MapPin className="w-3.5 h-3.5 text-[#8C102A] shrink-0" />
        <select
          value={selectedBranch}
          onChange={(e) => onSelectBranch(e.target.value as BranchId)}
          className="bg-transparent font-bold text-[#241A18] text-[11px] focus:outline-hidden truncate cursor-pointer"
        >
          {AMORE_BRANCHES.map((b) => (
            <option key={b.id} value={b.id}>
              {b.selectorLabel || b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Prominent Full Menu Button & Order Tray Button */}
      <div className="flex items-center gap-2">
        {/* Dedicated Full Menu Button */}
        <button
          onClick={onNavigateToMenu}
          className="py-2 px-3 rounded-xl bg-white border border-[#8C102A]/30 text-[#8C102A] hover:bg-[#FDE8EC] text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-2xs cursor-pointer"
          title="Open Full Menu (20 Flavours)"
          aria-label="View Full Menu"
        >
          <Utensils className="w-3.5 h-3.5 text-[#8C102A]" />
          <span>Full Menu</span>
          <span className="bg-[#8C102A] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
            20
          </span>
        </button>

        {/* Order Tray Button */}
        <button
          onClick={onOpenOrderModal}
          className="py-2 px-3 rounded-xl bg-[#8C102A] text-white text-xs font-bold flex items-center gap-1.5 shadow-md hover:bg-[#730D22] active:scale-95 transition-all cursor-pointer"
          aria-label="Open Order Tray"
        >
          <div className="relative">
            <ShoppingBag className="w-4 h-4 text-amber-200" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-amber-400 text-[#8C102A] text-[9px] font-black flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </div>
          <span className="truncate max-w-[85px]">
            {itemCount === 0 ? 'Tray' : formatPrice(totalLKR, currency)}
          </span>
        </button>
      </div>
    </div>
  );
};
