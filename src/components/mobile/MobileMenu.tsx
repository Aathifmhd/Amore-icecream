import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Plus, MapPin, Sparkles } from 'lucide-react';
import { BranchId, Currency, MenuItem, MenuTab, ScoopItem, SelectedOrderItem } from '../../types';
import { AMORE_BRANCHES } from '../../data/iceCreamData';
import { formatPrice } from '../../utils/currency';
import { CurrencyToggle } from '../CurrencyToggle';
import { isScoop, isSoldOut, startingPriceLKR, useMenuItems } from './mobileHooks';

interface MobileMenuProps {
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  selectedBranch: BranchId;
  onSelectBranch: (b: BranchId) => void;
  orderItems: SelectedOrderItem[];
  initialTab: MenuTab;
  onOpenItem: (item: ScoopItem | MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
}

/** Phone menu: compact rows, pinned category tabs and search, one-tap add. */
export const MobileMenu: React.FC<MobileMenuProps> = ({
  currency,
  onToggleCurrency,
  selectedBranch,
  onSelectBranch,
  orderItems,
  initialTab,
  onOpenItem,
  onQuickAdd,
}) => {
  const { scoops, coffee, cakes } = useMenuItems();
  const [tab, setTab] = useState<MenuTab>(initialTab);
  const [query, setQuery] = useState('');
  const branch = AMORE_BRANCHES.find((b) => b.id === selectedBranch) || AMORE_BRANCHES[0];
  const listTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  // Arugam Bay specials only exist at that branch
  useEffect(() => {
    if (tab === 'tourist-specials' && selectedBranch !== 'arugambay') setTab('all');
  }, [selectedBranch, tab]);

  const qtyInTray = useMemo(() => {
    const map: Record<string, number> = {};
    orderItems.forEach((it) => (map[it.itemId] = (map[it.itemId] || 0) + it.quantity));
    return map;
  }, [orderItems]);

  const q = query.trim().toLowerCase();
  // A search looks through the whole menu, whichever category tab is selected
  const inTab = (t: MenuTab) => Boolean(q) || tab === 'all' || tab === t;
  const matches = (item: ScoopItem | MenuItem) =>
    !q ||
    item.name.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q) ||
    (isScoop(item) && item.tastingNotes.some((n) => n.toLowerCase().includes(q)));

  const sections = [
    {
      id: 'scoops',
      title: 'Gelato scoops',
      note: 'Waffle cone or edible biscuit cup',
      items: scoops.filter(
        (s) => (inTab('scoops') || (tab === 'tourist-specials' && s.isArugamBaySpecial)) && matches(s)
      ),
    },
    { id: 'coffee', title: 'Specialty coffee', note: '', items: coffee.filter((c) => inTab('coffee') && matches(c)) },
    { id: 'cakes', title: 'Cakes & bakes', note: '', items: cakes.filter((c) => inTab('cakes') && matches(c)) },
  ].filter((s) => s.items.length > 0);

  const tabs: { id: MenuTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'scoops', label: `🍨 Gelato` },
    { id: 'coffee', label: '☕ Coffee' },
    { id: 'cakes', label: '🍰 Cakes' },
    ...(selectedBranch === 'arugambay' ? [{ id: 'tourist-specials' as MenuTab, label: '🌴 Arugam Bay picks' }] : []),
  ];

  const changeTab = (t: MenuTab) => {
    setTab(t);
    setQuery('');
    listTopRef.current?.scrollIntoView({ block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Pinned header: title, branch, search, categories */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFC8]">
        <div className="px-4 pt-3 flex items-center justify-between gap-3">
          <h1 className="font-serif-title text-2xl font-bold text-[#241A18]">Menu</h1>
          <CurrencyToggle currency={currency} onToggle={onToggleCurrency} />
        </div>

        <label className="mx-4 mt-2 flex items-center gap-1.5 text-xs text-[#5C4D44]">
          <MapPin className="w-3.5 h-3.5 text-[#8C102A] shrink-0" />
          <span className="shrink-0">Ordering from</span>
          <select
            value={selectedBranch}
            onChange={(e) => onSelectBranch(e.target.value as BranchId)}
            className="min-w-0 bg-transparent font-bold text-[#8C102A] underline decoration-dotted underline-offset-2 focus:outline-hidden"
          >
            {AMORE_BRANCHES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.selectorLabel || b.name}
              </option>
            ))}
          </select>
        </label>

        <div className="px-4 pt-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988B]" />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Durian, mango, latte…"
              aria-label="Search the menu"
              className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white border border-[#E8DFC8] text-sm text-[#241A18] placeholder:text-[#A8988B] focus:outline-hidden focus:border-[#8C102A]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#7A6458]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-2.5" role="tablist" aria-label="Menu categories">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id && !q}
              onClick={() => changeTab(t.id)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-bold border transition-colors ${
                tab === t.id && !q ? 'bg-[#8C102A] text-white border-[#8C102A]' : 'bg-white text-[#5C4D44] border-[#E8DFC8]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div ref={listTopRef} className="scroll-mt-48" />

      <main className="px-4 pt-3 pb-28 space-y-6">
        <p className="text-[11px] text-[#7A6458]">🕒 {branch.name} · {branch.hours}</p>

        {sections.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl">🍨</p>
            <p className="mt-2 font-bold text-[#241A18]">Nothing matches “{query}”</p>
            <button type="button" onClick={() => setQuery('')} className="mt-3 text-sm font-bold text-[#8C102A]">
              Clear search
            </button>
          </div>
        )}

        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`sec-${section.id}`}>
            <div className="flex items-baseline justify-between mb-2">
              <h2 id={`sec-${section.id}`} className="font-serif-title text-lg font-bold text-[#241A18]">
                {section.title} <span className="text-sm font-sans font-semibold text-[#A8988B]">{section.items.length}</span>
              </h2>
              {section.note && <span className="text-[11px] text-[#7A6458]">{section.note}</span>}
            </div>

            <ul key={tab} className="bg-white rounded-3xl border border-[#E8DFC8] divide-y divide-[#F0E8DC] overflow-hidden">
              {section.items.map((item, idx) => {
                const scoop = isScoop(item) ? item : null;
                const soldOut = isSoldOut(item);
                const inTray = qtyInTray[item.id] || 0;
                const badge = scoop?.isIconic
                  ? 'Signature'
                  : scoop?.isPopular || (!scoop && (item as MenuItem).popular)
                  ? 'Popular'
                  : scoop?.isArugamBaySpecial && selectedBranch === 'arugambay'
                  ? 'Arugam Bay pick'
                  : null;
                return (
                  <li key={item.id} className="rise-in" style={{ animationDelay: `${Math.min(idx, 8) * 45}ms` }}>
                    <div className={`flex items-center gap-3 p-3 ${soldOut ? 'opacity-60' : ''}`}>
                      <button
                        type="button"
                        onClick={() => onOpenItem(item)}
                        className="group flex-1 min-w-0 flex items-center gap-3 text-left"
                      >
                        <span className="relative w-20 h-20 rounded-2xl overflow-hidden bg-[#F3EDE3] shrink-0">
                          {item.image && (
                            <img
                              src={item.image}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className={`w-full h-full object-cover transition-transform duration-500 group-active:scale-110 ${soldOut ? 'grayscale' : ''}`}
                            />
                          )}
                          {inTray > 0 && (
                            <span key={inTray} className="pop-in absolute top-1 left-1 min-w-5 h-5 px-1 rounded-full bg-[#8C102A] text-white text-[11px] font-black flex items-center justify-center">
                              {inTray}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          {badge && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#8C102A]">
                              <Sparkles className="w-3 h-3" />
                              {badge}
                            </span>
                          )}
                          <span className="block font-bold text-[15px] text-[#241A18] leading-snug">{item.name}</span>
                          <span className="block text-xs text-[#7A6458] line-clamp-2 leading-snug mt-0.5">
                            {scoop ? scoop.tagline : item.description}
                          </span>
                          <span className="block text-sm font-bold text-[#8C102A] mt-1">
                            {soldOut ? 'Sold out today' : `${scoop ? 'from ' : ''}${formatPrice(startingPriceLKR(item), currency)}`}
                          </span>
                        </span>
                      </button>

                      {!soldOut && (
                        <button
                          type="button"
                          onClick={() => (scoop ? onOpenItem(item) : onQuickAdd(item as MenuItem))}
                          aria-label={`Add ${item.name}`}
                          className="press w-10 h-10 rounded-full bg-[#8C102A] active:bg-[#730D22] text-white flex items-center justify-center shadow-md shrink-0"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
};
