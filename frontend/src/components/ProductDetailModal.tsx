import React, { useState, useEffect } from 'react';
import { ScoopItem, MenuItem, Currency, SelectedOrderItem } from '../types';
import { formatPrice } from '../utils/currency';
import { X, Check, ShoppingBag, ArrowLeft, AlertCircle, Cookie, IceCreamCone } from 'lucide-react';
import { useIsSoldOut } from '../utils/stock';
import { scoopPhoto } from '../utils/menuPhotos';

interface ProductDetailModalProps {
  item: ScoopItem | MenuItem | null;
  onClose: () => void;
  currency: Currency;
  onOrderNow: (orderItem: SelectedOrderItem, openTray?: boolean) => void;
  onOpenTray?: () => void;
  isAlreadyInTray?: boolean;
}

type Serving = 'biscuit-cup' | 'waffle-cone';

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  item,
  onClose,
  currency,
  onOrderNow,
  onOpenTray,
  isAlreadyInTray = false,
}) => {
  // Sold out at the branch the customer has picked
  const soldOutHere = useIsSoldOut();
  const [quantity, setQuantity] = useState<number>(1);
  // Ice cream: the serving being looked at (the biscuit cup photo is each flavour's main photo)
  const [serving, setServing] = useState<Serving>('biscuit-cup');
  // Which serving was just added ('any' = this item was already in the tray when opened)
  const [added, setAdded] = useState<Serving | 'any' | null>(isAlreadyInTray ? 'any' : null);

  useEffect(() => {
    if (item) {
      setAdded(isAlreadyInTray ? 'any' : null);
      setQuantity(1);
      setServing('biscuit-cup');
    }
  }, [item, isAlreadyInTray]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;

  const isSoldOut = soldOutHere(item);
  const isScoop = 'tastingNotes' in item;
  const scoop = isScoop ? (item as ScoopItem) : null;
  const photo = scoop ? scoopPhoto(scoop, serving) : item.image;
  // A cone is chosen but this flavour has no cone photo yet: say what the picture shows
  const showingCupForCone = Boolean(scoop && serving === 'waffle-cone' && !scoop.coneImage && scoop.image);

  const servings: { id: Serving; label: string; hint: string; price: number; photo?: string; icon: React.ReactNode }[] = scoop
    ? [
        { id: 'biscuit-cup', label: 'Biscuit cup', hint: 'Edible, zero waste', price: scoop.biscuitCupPriceLKR, photo: scoopPhoto(scoop, 'biscuit-cup'), icon: <Cookie className="w-4 h-4" /> },
        { id: 'waffle-cone', label: 'Waffle cone', hint: 'Crisp, freshly rolled', price: scoop.conePriceLKR, photo: scoopPhoto(scoop, 'waffle-cone'), icon: <IceCreamCone className="w-4 h-4" /> },
      ]
    : [];

  const unitPrice = scoop ? (serving === 'biscuit-cup' ? scoop.biscuitCupPriceLKR : scoop.conePriceLKR) : (item as MenuItem).priceLKR;
  const totalPrice = unitPrice * quantity;
  const inTray = added === 'any' || added === (scoop ? serving : 'any');

  const handleAddToTray = () => {
    if (isSoldOut) return;
    const orderItem: SelectedOrderItem = {
      itemId: item.id,
      name: item.name,
      category: isScoop ? 'scoops' : (item as MenuItem).category,
      format: scoop ? serving : undefined,
      priceLKR: unitPrice,
      quantity,
      image: photo,
    };
    onOrderNow(orderItem, false);
    setAdded(scoop ? serving : 'any');
  };

  const badge = isSoldOut ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-[11px] font-black uppercase tracking-wider shadow">
      <AlertCircle className="w-3.5 h-3.5" /> Sold out
    </span>
  ) : scoop?.isIconic ? (
    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-[#8C102A] text-white shadow">👑 Amore's Best Flavour</span>
  ) : null;

  return (
    <div
      className="mobile-sheet-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <div
        className={`mobile-sheet-panel relative w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E8DFC8] my-4 transition-all ${
          photo ? 'max-w-md sm:max-w-4xl sm:grid sm:grid-cols-[1.05fr_1fr]' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#241A18] flex items-center justify-center shadow-md transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Photo: large and clear, follows the serving chosen */}
        {photo && (
          <div className="relative aspect-[4/3] sm:aspect-auto sm:min-h-[480px] w-full bg-[#FAF7F2] overflow-hidden">
            <img
              key={photo}
              decoding="async"
              src={photo}
              alt={scoop ? `${item.name} in a ${serving === 'biscuit-cup' ? 'biscuit cup' : 'waffle cone'}` : item.name}
              className={`absolute inset-0 w-full h-full object-cover animate-fadeIn ${isSoldOut ? 'grayscale-[30%] opacity-85' : ''}`}
              referrerPolicy="no-referrer"
            />
            {badge && <div className="absolute top-3.5 left-3.5 z-10">{badge}</div>}
            {scoop && (
              <span className="absolute bottom-3.5 left-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/92 backdrop-blur text-xs font-semibold text-[#241A18] shadow">
                {serving === 'biscuit-cup' ? <Cookie className="w-3.5 h-3.5 text-amber-700" /> : <IceCreamCone className="w-3.5 h-3.5 text-[#8C102A]" />}
                {showingCupForCone ? 'Photo shows a biscuit cup' : serving === 'biscuit-cup' ? 'Biscuit cup' : 'Waffle cone'}
              </span>
            )}
          </div>
        )}

        {/* Details */}
        <div className="p-5 sm:p-7 space-y-4 sm:max-h-[88vh] sm:overflow-y-auto">
          <div className="pr-8">
            {!photo && badge && <div className="mb-2">{badge}</div>}
            <h3 className="text-2xl sm:text-3xl font-serif-title font-bold text-[#241A18] leading-tight">{item.name}</h3>
            {'tagline' in item && <p className="text-xs sm:text-sm font-bold text-[#8C102A] mt-1">{(item as ScoopItem).tagline}</p>}
          </div>

          {isSoldOut && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700 font-bold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>This is sold out at the moment.</span>
            </div>
          )}

          <p className="text-sm text-[#5C4D44] leading-relaxed">{item.description}</p>

          {/* Cone or cup: changes the photo and the price */}
          {scoop && (
            <div>
              <p className="text-[11px] uppercase font-bold tracking-wider text-[#8A7970] mb-2">Choose your serving</p>
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Serving">
                {servings.map((s) => {
                  const selected = serving === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setServing(s.id)}
                      className={`flex items-center gap-2.5 p-2 pr-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        selected ? 'border-[#8C102A] bg-[#8C102A]/5 shadow-sm' : 'border-[#E8DFC8] bg-white hover:border-[#C9B9A4]'
                      }`}
                    >
                      <span className="w-14 h-14 rounded-xl overflow-hidden bg-[#FAF7F2] shrink-0 flex items-center justify-center">
                        {s.photo ? (
                          <img src={s.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-[#8C102A]">{s.icon}</span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-sm font-bold text-[#241A18]">
                          <span className={selected ? 'text-[#8C102A]' : 'text-[#8A7970]'}>{s.icon}</span>
                          {s.label}
                        </span>
                        <span className="block text-[11px] text-[#7A6458]">{s.hint}</span>
                        <span className="block text-sm font-bold text-[#8C102A]">{formatPrice(s.price, currency)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {scoop && scoop.tastingNotes && scoop.tastingNotes.length > 0 && (
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#8A7970] block mb-1.5">Tasting notes</span>
              <div className="flex flex-wrap gap-1.5">
                {scoop.tastingNotes.map((note) => (
                  <span key={note} className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] text-[#3D2C24] text-xs font-medium border border-[#E8DFC8]">
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}

          {scoop && scoop.dietary && scoop.dietary.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {scoop.dietary.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          )}

          {/* Quantity & price */}
          <div className="pt-3 border-t border-[#E8DFC8] flex items-center justify-between gap-3">
            <div className={`flex items-center gap-2 bg-[#FAF7F2] p-1.5 rounded-full border border-[#E0D5C3] ${isSoldOut ? 'opacity-40 pointer-events-none' : ''}`}>
              <button
                type="button"
                disabled={isSoldOut || quantity <= 1}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-[#241A18] font-bold text-sm flex items-center justify-center cursor-pointer shadow-2xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="px-2 font-bold text-sm text-[#241A18] min-w-[20px] text-center" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                disabled={isSoldOut}
                onClick={() => setQuantity(Math.min(20, quantity + 1))}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-[#241A18] font-bold text-sm flex items-center justify-center cursor-pointer shadow-2xs transition-colors disabled:cursor-not-allowed"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-[#8A7970] block">{quantity > 1 ? `Total (${quantity})` : 'Price'}</span>
              <span className="text-xl font-extrabold text-[#8C102A]">{formatPrice(totalPrice, currency)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-3 rounded-full bg-[#FAF7F2] hover:bg-[#F0EBE0] text-[#5C4D44] font-bold text-xs border border-[#E0D5C3] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            {isSoldOut ? (
              <button
                type="button"
                disabled
                className="flex-2 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-full font-bold text-xs bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <span>Sold out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (inTray && onOpenTray) {
                    onClose();
                    onOpenTray();
                  } else {
                    handleAddToTray();
                  }
                }}
                className={`flex-2 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-full font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer ${
                  inTray ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-[#8C102A] hover:bg-[#A31634] text-white'
                }`}
              >
                {inTray ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-200" />
                    <span>In tray · view tray</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-200" />
                    <span>{scoop ? `Add ${serving === 'biscuit-cup' ? 'biscuit cup' : 'waffle cone'} to tray` : 'Add to tray'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
