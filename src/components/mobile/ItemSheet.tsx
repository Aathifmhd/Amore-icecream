import React, { useEffect, useState } from 'react';
import { Minus, Plus, X, Cookie, IceCreamCone } from 'lucide-react';
import { Currency, MenuItem, ScoopItem, SelectedOrderItem, ServingFormat } from '../../types';
import { formatPrice } from '../../utils/currency';
import { isScoop, isSoldOut } from './mobileHooks';

interface ItemSheetProps {
  item: ScoopItem | MenuItem;
  currency: Currency;
  onClose: () => void;
  onAdd: (orderItem: SelectedOrderItem) => void;
}

/** Bottom sheet for choosing cone/cup and quantity before adding to the tray. */
export const ItemSheet: React.FC<ItemSheetProps> = ({ item, currency, onClose, onAdd }) => {
  const scoop = isScoop(item) ? item : null;
  const [format, setFormat] = useState<ServingFormat>('waffle-cone');
  const [qty, setQty] = useState(1);
  const soldOut = isSoldOut(item);

  // Lock the page behind the sheet and close on Escape
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const unitPrice = scoop
    ? format === 'biscuit-cup'
      ? scoop.biscuitCupPriceLKR
      : scoop.conePriceLKR
    : (item as MenuItem).priceLKR;

  const handleAdd = () => {
    onAdd({
      itemId: item.id,
      name: item.name,
      category: scoop ? 'scoops' : (item as MenuItem).category,
      format: scoop ? format : undefined,
      priceLKR: unitPrice,
      quantity: qty,
      image: item.image,
    });
  };

  const formats: { id: ServingFormat; label: string; hint: string; price: number; icon: React.ReactNode }[] =
    scoop
      ? [
          {
            id: 'waffle-cone',
            label: 'Waffle cone',
            hint: 'Crisp, freshly rolled',
            price: scoop.conePriceLKR,
            icon: <IceCreamCone className="w-5 h-5" />,
          },
          {
            id: 'biscuit-cup',
            label: 'Biscuit cup',
            hint: 'Edible, zero waste',
            price: scoop.biscuitCupPriceLKR,
            icon: <Cookie className="w-5 h-5" />,
          },
        ]
      : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-end" role="dialog" aria-modal="true" aria-label={item.name}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 animate-fadeIn cursor-default"
      />

      <div className="relative w-full max-h-[90dvh] overflow-y-auto bg-white rounded-t-3xl shadow-2xl animate-sheet-up pb-safe">
        {/* Photo header */}
        <div className="relative h-48 bg-[#F3EDE3]">
          {item.image && (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          )}
          <div className="absolute inset-x-0 top-0 flex justify-center pt-2">
            <span className="w-10 h-1.5 rounded-full bg-white/80" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 text-[#241A18] flex items-center justify-center shadow"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-5 space-y-4">
          <div>
            <h2 className="font-serif-title text-2xl font-bold text-[#241A18]">{item.name}</h2>
            {scoop?.tagline && <p className="text-xs font-semibold text-[#8C102A] mt-0.5">{scoop.tagline}</p>}
            <p className="text-sm text-[#5C4D44] leading-relaxed mt-2">{item.description}</p>
            {scoop && scoop.dietary.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {scoop.dietary.map((d) => (
                  <span key={d} className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Cone or cup */}
          {scoop && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#7A6458] mb-2">Choose how you'd like it</p>
              <div className="grid grid-cols-2 gap-2.5">
                {formats.map((f) => {
                  const selected = format === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormat(f.id)}
                      aria-pressed={selected}
                      className={`text-left p-3 rounded-2xl border-2 transition-colors ${
                        selected ? 'border-[#8C102A] bg-[#8C102A]/5' : 'border-[#E8DFC8] bg-white'
                      }`}
                    >
                      <span className={selected ? 'text-[#8C102A]' : 'text-[#7A6458]'}>{f.icon}</span>
                      <span className="block text-sm font-bold text-[#241A18] mt-1">{f.label}</span>
                      <span className="block text-[11px] text-[#7A6458]">{f.hint}</span>
                      <span className="block text-sm font-bold text-[#8C102A] mt-1">{formatPrice(f.price, currency)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity + add */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center rounded-full border border-[#E8DFC8] bg-[#FAF7F2]">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="w-11 h-11 flex items-center justify-center text-[#241A18] disabled:opacity-30"
                disabled={qty <= 1}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-6 text-center font-bold text-[#241A18]" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(20, q + 1))}
                aria-label="Increase quantity"
                className="w-11 h-11 flex items-center justify-center text-[#241A18]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={soldOut}
              className="flex-1 h-12 rounded-full bg-[#8C102A] active:bg-[#730D22] text-white font-bold text-sm shadow-md disabled:bg-[#BFB3A8] disabled:shadow-none"
            >
              {soldOut ? 'Sold out today' : `Add to tray · ${formatPrice(unitPrice * qty, currency)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
