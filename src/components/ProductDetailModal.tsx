import React, { useState, useEffect } from 'react';
import { ScoopItem, MenuItem, Currency, SelectedOrderItem } from '../types';
import { formatPrice } from '../utils/currency';
import { X, Check, ShoppingBag, ArrowLeft } from 'lucide-react';

interface ProductDetailModalProps {
  item: ScoopItem | MenuItem | null;
  onClose: () => void;
  currency: Currency;
  onOrderNow: (orderItem: SelectedOrderItem, openTray?: boolean) => void;
  onOpenTray?: () => void;
  isAlreadyInTray?: boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  item,
  onClose,
  currency,
  onOrderNow,
  onOpenTray,
  isAlreadyInTray = false,
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [hasAddedToTray, setHasAddedToTray] = useState<boolean>(isAlreadyInTray);

  useEffect(() => {
    if (item) {
      setHasAddedToTray(isAlreadyInTray);
      setQuantity(1);
    }
  }, [item, isAlreadyInTray]);

  if (!item) return null;

  const isScoop = 'tastingNotes' in item;
  const scoop = isScoop ? (item as ScoopItem) : null;

  // Single base price for the item
  const currentSinglePrice = scoop ? scoop.conePriceLKR : item.priceLKR;
  const totalPrice = currentSinglePrice * quantity;

  const handleAddToTray = (openTrayDirectly: boolean = false) => {
    const orderItem: SelectedOrderItem = {
      itemId: item.id,
      name: item.name,
      category: isScoop ? 'scoops' : (item as MenuItem).category,
      format: isScoop ? 'waffle-cone' : undefined,
      priceLKR: currentSinglePrice,
      quantity,
      image: item.image,
    };
    onOrderNow(orderItem, openTrayDirectly);
    setHasAddedToTray(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E8DFC8] my-4 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#241A18] flex items-center justify-center shadow-md transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Image */}
        {item.image && (
          <div className="relative h-44 sm:h-48 w-full bg-[#FAF7F2] overflow-hidden">
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
            <div className="absolute bottom-3.5 left-4 right-4 text-white">
              {scoop?.isIconic && (
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#8C102A] text-white mb-1 shadow-xs">
                  👑 Amore's Best Flavour
                </span>
              )}
              <h3 className="text-xl sm:text-2xl font-serif-title font-bold drop-shadow-sm leading-tight">
                {item.name}
              </h3>
            </div>
          </div>
        )}

        {/* Modal Body - Clean & Well-Arranged Content */}
        <div className="p-5 sm:p-6 space-y-4">
          {!item.image && (
            <div className="border-b border-[#E8DFC8] pb-3">
              {scoop?.isIconic && (
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#8C102A] text-white mb-1.5 shadow-xs">
                  👑 Amore's Best Flavour
                </span>
              )}
              <h3 className="text-xl sm:text-2xl font-serif-title font-bold text-[#241A18]">
                {item.name}
              </h3>
            </div>
          )}

          {/* Tagline & Description */}
          <div className="space-y-1.5">
            {'tagline' in item && (
              <p className="text-xs sm:text-sm font-bold text-[#8C102A]">
                {(item as ScoopItem).tagline}
              </p>
            )}
            <p className="text-xs sm:text-sm text-[#5C4D44] leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Tasting Notes (for Gelato Scoops) */}
          {scoop && scoop.tastingNotes && scoop.tastingNotes.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A7970] block mb-1.5">
                Flavour Profile & Tasting Notes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {scoop.tastingNotes.map((note) => (
                  <span
                    key={note}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] text-[#3D2C24] text-xs font-medium border border-[#E8DFC8]"
                  >
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dietary & Ingredient Tags */}
          {scoop && scoop.dietary && scoop.dietary.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {scoop.dietary.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          )}

          {/* Available Formats Info Banner (Informative Only, No Customize Controls) */}
          {scoop && (
            <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[#5C4D44] font-medium">
                <span>🍦 Waffle Cone & 🍪 Biscuit Cup</span>
              </div>
              <div className="text-right text-[11px] font-bold text-[#8C102A]">
                From {formatPrice(scoop.conePriceLKR, currency)}
              </div>
            </div>
          )}

          {/* Price & Quantity Stepper */}
          <div className="pt-3 border-t border-[#E8DFC8] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 bg-[#FAF7F2] p-1.5 rounded-full border border-[#E0D5C3]">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 text-[#241A18] font-bold text-xs flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="px-2.5 font-bold text-xs text-[#241A18] min-w-[20px] text-center">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 text-[#241A18] font-bold text-xs flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-[#8A7970] block">
                {quantity > 1 ? `Total (${quantity} items)` : 'Price'}
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-[#8C102A]">
                {formatPrice(totalPrice, currency)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 rounded-full bg-[#FAF7F2] hover:bg-[#F0EBE0] text-[#5C4D44] font-bold text-xs border border-[#E0D5C3] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (hasAddedToTray && onOpenTray) {
                  onClose();
                  onOpenTray();
                } else {
                  handleAddToTray(false);
                }
              }}
              className={`flex-2 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-full font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer ${
                hasAddedToTray
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-[#8C102A] hover:bg-[#A31634] text-white'
              }`}
            >
              {hasAddedToTray ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                  <span>In Tray (View Tray)</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-200" />
                  <span>Add to Tray</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
