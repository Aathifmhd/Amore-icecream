import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ScoopItem, MenuItem, Currency, MenuTab, ServingFormat, SelectedOrderItem } from '../types';
import {
  getAllGelatoFlavours,
  getAllCoffeeItems,
  getAllCakeItems,
  MENU_UPDATED_EVENT,
  syncMenuFromFirestore,
  subscribeToRealtimeMenu,
} from '../utils/menuStorage';
import { formatPrice } from '../utils/currency';
import { CurrencyToggle } from './CurrencyToggle';
import { Search, Sparkles, Cookie, Coffee, Cake, Check, Heart, ArrowRight, X, Plus, AlertCircle } from 'lucide-react';

interface FullMenuProps {
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  onSelectItem: (item: ScoopItem | MenuItem) => void;
  onDirectOrder: (item: ScoopItem | MenuItem, formats?: ServingFormat[]) => void;
  onRemoveFromTray?: (itemId: string, formats?: ServingFormat[]) => void;
  orderItems?: SelectedOrderItem[];
  onOpenTray?: () => void;
  resetKey?: number;
}

export const FullMenu: React.FC<FullMenuProps> = ({
  currency,
  onToggleCurrency,
  onSelectItem,
  onDirectOrder,
  onRemoveFromTray,
  orderItems = [],
  onOpenTray,
  resetKey,
}) => {
  const [activeTab, setActiveTab] = useState<MenuTab>('all');
  const [preferredFormat, setPreferredFormat] = useState<'both' | 'biscuit-cup' | 'waffle-cone'>('both');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Dynamic Real-time Menu State from Storage
  const [allScoops, setAllScoops] = useState<ScoopItem[]>(() => getAllGelatoFlavours());
  const [allCoffee, setAllCoffee] = useState<MenuItem[]>(() => getAllCoffeeItems());
  const [allCakes, setAllCakes] = useState<MenuItem[]>(() => getAllCakeItems());

  useEffect(() => {
    const handleMenuSync = () => {
      setAllScoops(getAllGelatoFlavours());
      setAllCoffee(getAllCoffeeItems());
      setAllCakes(getAllCakeItems());
    };

    window.addEventListener(MENU_UPDATED_EVENT, handleMenuSync);

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('amore_menu_')) {
        handleMenuSync();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleMenuSync);

    syncMenuFromFirestore().then(handleMenuSync);
    const unsubscribeRealtime = subscribeToRealtimeMenu(handleMenuSync);

    return () => {
      window.removeEventListener(MENU_UPDATED_EVENT, handleMenuSync);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleMenuSync);
      unsubscribeRealtime();
    };
  }, []);

  // Track selected serving format(s) for each scoop card for direct order
  const [selectedFormats, setSelectedFormats] = useState<Record<string, ServingFormat[]>>({});

  // Reset all selected format buttons whenever resetKey changes (e.g., when order is placed and Done is clicked)
  useEffect(() => {
    if (resetKey !== undefined) {
      setSelectedFormats({});
    }
  }, [resetKey]);

  // Auto-reset all selected format buttons whenever tray transitions from having items to empty
  const prevOrderCountRef = useRef(orderItems.length);
  useEffect(() => {
    if (prevOrderCountRef.current > 0 && orderItems.length === 0) {
      setSelectedFormats({});
    }
    prevOrderCountRef.current = orderItems.length;
  }, [orderItems.length]);

  const getSelectedFormats = (scoopId: string): ServingFormat[] => {
    return selectedFormats[scoopId] || [];
  };

  const handleToggleFormat = (scoopId: string, format: ServingFormat, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigating to details
    setSelectedFormats((prev) => ({
      ...prev,
      [scoopId]: [format],
    }));
  };

  // Track which item IDs are in the customer's tray
  const trayItemIds = useMemo(() => {
    return new Set(orderItems.map((it) => it.itemId));
  }, [orderItems]);

  // Filter scoops based on search, category tab, and tag
  const filteredScoops = useMemo(() => {
    return allScoops.filter((scoop) => {
      // Tab filter
      if (activeTab === 'coffee' || activeTab === 'cakes') return false;
      if (activeTab === 'tourist-specials' && !scoop.isArugamBaySpecial) return false;

      // Tag filter
      if (selectedTag === 'signature' && !scoop.isIconic && !scoop.isPopular) return false;
      if (selectedTag === 'tropical' && scoop.category !== 'tropical-fruit') return false;
      if (selectedTag === 'chocolate' && scoop.category !== 'chocolate-decadence') return false;
      if (selectedTag === 'bakery' && scoop.category !== 'bakery-swirl') return false;
      if (selectedTag === 'fruit' && !scoop.dietary.includes('100% Real Fruit')) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = scoop.name.toLowerCase().includes(query);
        const matchesDesc = scoop.description.toLowerCase().includes(query);
        const matchesNotes = scoop.tastingNotes.some((n) => n.toLowerCase().includes(query));
        if (!matchesName && !matchesDesc && !matchesNotes) return false;
      }

      return true;
    });
  }, [activeTab, selectedTag, searchQuery, allScoops]);

  // Filter coffee items
  const filteredCoffee = useMemo(() => {
    if (activeTab === 'scoops' || activeTab === 'cakes') return [];
    return allCoffee.filter((item) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);
      }
      return true;
    });
  }, [activeTab, searchQuery, allCoffee]);

  // Filter cake items
  const filteredCakes = useMemo(() => {
    if (activeTab === 'scoops' || activeTab === 'coffee' || activeTab === 'tourist-specials') return [];
    return allCakes.filter((item) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);
      }
      return true;
    });
  }, [activeTab, searchQuery, allCakes]);

  // Full menu is always shown without truncation
  const displayedScoops = filteredScoops;
  const displayedCoffee = filteredCoffee;
  const displayedCakes = filteredCakes;

  return (
    <section id="full-menu" className="py-16 md:py-24 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAE0D0] text-[#8C102A] text-xs font-bold uppercase tracking-wider mb-3.5 border border-[#D9CBB7]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Handcrafted Daily in Small Batches</span>
          </div>
          <h2 className="font-serif-title text-3xl sm:text-4xl lg:text-5xl font-bold text-[#241A18] tracking-tight">
            The Complete Amore Parlour Menu
          </h2>
          <p className="mt-3 text-base sm:text-lg text-[#5C4D44] leading-relaxed">
            Discover all 20 of our signature flavours served in freshly rolled waffle cones or crunchy edible biscuit cups, alongside specialty Ceylon espresso and fresh-baked cakes.
          </p>

          {/* Currency Toggle in Menu Header */}
          <div className="mt-6 flex flex-wrap items-center justify-center">
            <CurrencyToggle currency={currency} onToggle={onToggleCurrency} />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              activeTab === 'all'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#3D2C24] border-[#E0D5C3] hover:bg-[#F3EDE3]'
            }`}
          >
            All Items
          </button>

          <button
            onClick={() => setActiveTab('scoops')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              activeTab === 'scoops'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#3D2C24] border-[#E0D5C3] hover:bg-[#F3EDE3]'
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>Amore Scoops ({allScoops.length} Flavours)</span>
          </button>

          <button
            onClick={() => setActiveTab('coffee')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              activeTab === 'coffee'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#3D2C24] border-[#E0D5C3] hover:bg-[#F3EDE3]'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Specialty Coffee</span>
          </button>

          <button
            onClick={() => setActiveTab('cakes')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              activeTab === 'cakes'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#3D2C24] border-[#E0D5C3] hover:bg-[#F3EDE3]'
            }`}
          >
            <Cake className="w-3.5 h-3.5" />
            <span>Artisan Cakes</span>
          </button>

          <button
            onClick={() => setActiveTab('tourist-specials')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              activeTab === 'tourist-specials'
                ? 'bg-amber-800 text-white border-amber-900 shadow-xs'
                : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-50'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Arugam Bay Specials</span>
          </button>
        </div>

        {/* Controls Row: Search & Format Filter */}
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs mb-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7970]" />
            <input
              type="text"
              placeholder="Search flavours (Durian, Mango, Cardamom, Brownie, Coffee...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A] placeholder:text-[#9C8B82]"
            />
          </div>

          {/* Cone vs Edible Cup Focus Toggle - ONLY shown when Amore Scoops tab is selected */}
          {activeTab === 'scoops' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[#5C4D44] shrink-0">Price Focus:</span>
              <div className="inline-flex rounded-xl bg-[#FAF7F2] p-1 border border-[#D9CBB7]">
                <button
                  type="button"
                  onClick={() => {
                    setPreferredFormat('both');
                    setSelectedFormats({});
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    preferredFormat === 'both' ? 'bg-[#8C102A] text-white' : 'text-[#5C4D44]'
                  }`}
                >
                  Both
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreferredFormat('biscuit-cup');
                    setSelectedFormats({});
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    preferredFormat === 'biscuit-cup' ? 'bg-amber-600 text-white' : 'text-[#5C4D44]'
                  }`}
                >
                  <Cookie className="w-3 h-3" />
                  <span>Edible Biscuit Cup</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreferredFormat('waffle-cone');
                    setSelectedFormats({});
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    preferredFormat === 'waffle-cone' ? 'bg-[#8C102A] text-white' : 'text-[#5C4D44]'
                  }`}
                >
                  Waffle Cone
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scoops Section */}
        {filteredScoops.length > 0 && (
          <div className="mb-14">
            <div id="scoops-section-header" className="flex items-center justify-between mb-6 pb-2 border-b border-[#E8DFC8]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#8C102A]" />
                <h3 className="font-serif-title text-2xl font-bold text-[#241A18]">
                  Artisanal Gelato & Sorbets ({filteredScoops.length} Flavours)
                </h3>
              </div>
              <span className="text-xs text-[#7A6458] hidden sm:inline">
                Tap any flavour for full tasting details & quick order
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {displayedScoops.map((scoop) => {
                const isSoldOut = scoop.isAvailable === false;
                const isDurian = scoop.id === 'durian-best';
                const isInTray = trayItemIds.has(scoop.id);
                return (
                  <div
                    key={scoop.id}
                    onClick={() => onSelectItem(scoop)}
                    className={`bg-white rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between cursor-pointer group relative ${
                      isSoldOut
                        ? 'opacity-90 border-red-200'
                        : isDurian
                        ? 'border-amber-400 ring-2 ring-amber-400/40'
                        : 'border-[#E8DFC8] hover:border-[#8C102A]'
                    }`}
                  >
                    {/* Top image or visual accent */}
                    <div className="relative h-44 bg-[#FAF7F2] overflow-hidden">
                      <img
                        src={scoop.image}
                        alt={scoop.name}
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                          isSoldOut ? 'grayscale-[30%] opacity-85' : ''
                        }`}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      {/* Sold Out Dark Overlay */}
                      {isSoldOut && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-20">
                          <span className="px-3.5 py-1.5 rounded-full bg-red-600/95 text-white text-xs font-black uppercase tracking-wider shadow-lg border border-white/20 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Sold Out</span>
                          </span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                        {isSoldOut ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-600 text-white shadow-md flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Sold Out</span>
                          </span>
                        ) : isDurian ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#8C102A] text-white shadow-md">
                            👑 Amore Best Flavour
                          </span>
                        ) : scoop.isArugamBaySpecial ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-800 text-white shadow-xs">
                            Arugam Bay Top Pick
                          </span>
                        ) : scoop.isPopular ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white shadow-xs">
                            Popular
                          </span>
                        ) : (
                          <span />
                        )}

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-[#241A18] backdrop-blur-xs">
                          {scoop.category.replace('-', ' ')}
                        </span>
                      </div>

                      {/* Name on image */}
                      <div className="absolute bottom-2.5 left-3 right-3 text-white">
                        <h4 className="font-serif-title text-lg font-bold drop-shadow-sm leading-snug">
                          {scoop.name}
                        </h4>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-[#8C102A] font-semibold line-clamp-1 mb-1">
                          {scoop.tagline}
                        </p>
                        <p className="text-xs text-[#5C4D44] line-clamp-2 leading-relaxed mb-3">
                          {scoop.description}
                        </p>

                        {/* Tasting Notes */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {scoop.tastingNotes.slice(0, 2).map((n) => (
                            <span
                              key={n}
                              className="text-[10px] bg-[#FAF7F2] text-[#4D3E36] px-2 py-0.5 rounded-md border border-[#E8DFC8]"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Pricing & Format Matrix */}
                      <div className="pt-3 border-t border-[#F0E8DC]">
                        {(() => {
                          const effectiveFormat = activeTab === 'scoops' ? preferredFormat : 'both';
                          const scoopFormats = getSelectedFormats(scoop.id);
                          const isConeSelected = scoopFormats.includes('waffle-cone');
                          const isCupSelected = scoopFormats.includes('biscuit-cup');
                          const itemsOfThisScoopInTray = orderItems.filter((it) => it.itemId === scoop.id);
                          const hasAnyInTray = itemsOfThisScoopInTray.length > 0;

                          // When ordered status applies
                          const isOrdered =
                            effectiveFormat === 'biscuit-cup'
                              ? itemsOfThisScoopInTray.some(
                                  (it) => it.format === 'biscuit-cup' || it.format === 'double-biscuit-cup'
                                )
                              : effectiveFormat === 'waffle-cone'
                              ? itemsOfThisScoopInTray.some(
                                  (it) => it.format === 'waffle-cone' || it.format === 'double-cone'
                                )
                              : scoopFormats.length > 0
                              ? scoopFormats.every((fmt) =>
                                  itemsOfThisScoopInTray.some((it) => it.format === fmt)
                                )
                              : hasAnyInTray;

                          const scoopQty = itemsOfThisScoopInTray.reduce((sum, it) => sum + it.quantity, 0);

                          return (
                            <>
                              {effectiveFormat === 'both' ? (
                                <div className="grid grid-cols-2 gap-1.5 text-center mb-3">
                                  {/* Waffle Cone - Selector for order */}
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      if (isSoldOut) return;
                                      handleToggleFormat(scoop.id, 'waffle-cone', e);
                                    }}
                                    onKeyDown={(e) => {
                                      if (isSoldOut) return;
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        handleToggleFormat(scoop.id, 'waffle-cone', e as any);
                                      }
                                    }}
                                    aria-pressed={isConeSelected}
                                    title={isSoldOut ? 'Sold out' : isConeSelected ? 'Waffle Cone selected for order (Click to toggle)' : 'Click to select Waffle Cone for order'}
                                    className={`p-2 rounded-xl transition-all duration-200 select-none text-left relative flex flex-col justify-between border ${
                                      isSoldOut
                                        ? 'bg-gray-50 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed'
                                        : isConeSelected
                                        ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs ring-2 ring-[#8C102A]/40 cursor-pointer'
                                        : 'bg-[#FAF7F2] hover:bg-[#F3EDE3] text-[#241A18] border-[#E0D5C3] hover:border-[#8C102A]/60 cursor-pointer'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className={`text-[10px] font-bold ${isSoldOut ? 'text-gray-400' : isConeSelected ? 'text-amber-200' : 'text-[#8A7970]'}`}>
                                        Waffle Cone
                                      </span>
                                      <div
                                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                          isConeSelected && !isSoldOut ? 'bg-white text-[#8C102A]' : 'border border-[#C4B5A2] bg-white/70'
                                        }`}
                                      >
                                        {isConeSelected && !isSoldOut && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                      <span className={`font-bold text-xs ${isSoldOut ? 'text-gray-400' : isConeSelected ? 'text-white' : 'text-[#241A18]'}`}>
                                        {formatPrice(scoop.conePriceLKR, currency)}
                                      </span>
                                      <span className={`text-[9px] font-semibold ${isSoldOut ? 'text-gray-400' : isConeSelected ? 'text-amber-100' : 'text-[#8A7970]'}`}>
                                        {isSoldOut ? 'Out of stock' : isConeSelected ? 'Selected' : '+ Select'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Edible Biscuit Cup - Selector for order */}
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      if (isSoldOut) return;
                                      handleToggleFormat(scoop.id, 'biscuit-cup', e);
                                    }}
                                    onKeyDown={(e) => {
                                      if (isSoldOut) return;
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        handleToggleFormat(scoop.id, 'biscuit-cup', e as any);
                                      }
                                    }}
                                    aria-pressed={isCupSelected}
                                    title={isSoldOut ? 'Sold out' : isCupSelected ? 'Biscuit Cup selected for order (Click to toggle)' : 'Click to select Biscuit Cup for order'}
                                    className={`p-2 rounded-xl transition-all duration-200 select-none text-left relative flex flex-col justify-between border ${
                                      isSoldOut
                                        ? 'bg-gray-50 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed'
                                        : isCupSelected
                                        ? 'bg-amber-700 text-white border-amber-800 shadow-xs ring-2 ring-amber-600/50 cursor-pointer'
                                        : 'bg-amber-50/80 hover:bg-amber-100 text-[#8C102A] border-amber-200 hover:border-amber-400 cursor-pointer'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span
                                        className={`text-[10px] font-bold flex items-center gap-0.5 ${
                                          isSoldOut ? 'text-gray-400' : isCupSelected ? 'text-amber-200' : 'text-amber-800'
                                        }`}
                                      >
                                        <Cookie className={`w-2.5 h-2.5 ${isCupSelected && !isSoldOut ? 'text-amber-200' : 'text-amber-700'}`} />
                                        <span>Biscuit Cup</span>
                                      </span>
                                      <div
                                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                          isCupSelected && !isSoldOut ? 'bg-white text-amber-800' : 'border border-amber-300 bg-white/70'
                                        }`}
                                      >
                                        {isCupSelected && !isSoldOut && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                      <span className={`font-bold text-xs ${isSoldOut ? 'text-gray-400' : isCupSelected ? 'text-white' : 'text-[#8C102A]'}`}>
                                        {formatPrice(scoop.biscuitCupPriceLKR, currency)}
                                      </span>
                                      <span className={`text-[9px] font-semibold ${isSoldOut ? 'text-gray-400' : isCupSelected ? 'text-amber-100' : 'text-amber-800'}`}>
                                        {isSoldOut ? 'Out of stock' : isCupSelected ? 'Selected' : '+ Select'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : effectiveFormat === 'biscuit-cup' ? (
                                /* Clean non-interactive price display for Edible Biscuit Cup (does not act as a selector) */
                                <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-amber-50/80 border border-amber-200">
                                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                    <Cookie className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Edible Biscuit Cup</span>
                                  </span>
                                  <span className="font-extrabold text-sm text-[#8C102A]">
                                    {formatPrice(scoop.biscuitCupPriceLKR, currency)}
                                  </span>
                                </div>
                              ) : (
                                /* Clean non-interactive price display for Waffle Cone (does not act as a selector) */
                                <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E0D5C3]">
                                  <span className="text-xs font-bold text-[#3D2C24]">
                                    Crisp Waffle Cone
                                  </span>
                                  <span className="font-extrabold text-sm text-[#8C102A]">
                                    {formatPrice(scoop.conePriceLKR, currency)}
                                  </span>
                                </div>
                              )}

                              {/* Card Action */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectItem(scoop);
                                  }}
                                  className="px-3 py-2 rounded-xl bg-white hover:bg-[#F3EDE3] text-[#241A18] text-xs font-bold border border-[#D9CBB7] transition-colors cursor-pointer"
                                >
                                  Details
                                </button>
                                {isSoldOut ? (
                                  <button
                                    type="button"
                                    disabled
                                    className="flex-1 py-2 px-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed flex items-center justify-center gap-1.5"
                                  >
                                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                    <span>Sold Out</span>
                                  </button>
                                ) : isOrdered ? (
                                  <div className="flex-1 flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onRemoveFromTray) {
                                          if (effectiveFormat === 'biscuit-cup') {
                                            onRemoveFromTray(scoop.id, ['biscuit-cup']);
                                          } else if (effectiveFormat === 'waffle-cone') {
                                            onRemoveFromTray(scoop.id, ['waffle-cone']);
                                          } else {
                                            onRemoveFromTray(
                                              scoop.id,
                                              scoopFormats.length > 0 ? scoopFormats : undefined
                                            );
                                          }
                                        }
                                        if (effectiveFormat === 'both') {
                                          setSelectedFormats((prev) => {
                                            const next = { ...prev };
                                            delete next[scoop.id];
                                            return next;
                                          });
                                        }
                                      }}
                                      className="group/traybtn flex-1 py-2 px-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-red-600 text-white active:scale-95"
                                      title="Click to cancel from tray"
                                    >
                                      <span className="flex items-center justify-center gap-1.5 group-hover/traybtn:hidden">
                                        <Check className="w-3.5 h-3.5 text-emerald-200" />
                                        <span>In Tray{scoopQty > 0 ? ` (${scoopQty})` : ''}</span>
                                      </span>
                                      <span className="hidden group-hover/traybtn:flex items-center justify-center gap-1.5 text-white">
                                        <X className="w-3.5 h-3.5" />
                                        <span>Cancel</span>
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const chosenFormat: ServingFormat =
                                          scoopFormats.length > 0
                                            ? scoopFormats[0]
                                            : effectiveFormat === 'biscuit-cup'
                                            ? 'biscuit-cup'
                                            : 'waffle-cone';
                                        onDirectOrder(scoop, [chosenFormat]);
                                      }}
                                      className="px-2 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                                      title="Add another to tray"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add</span>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const chosenFormat: ServingFormat =
                                        scoopFormats.length > 0
                                          ? scoopFormats[0]
                                          : effectiveFormat === 'biscuit-cup'
                                          ? 'biscuit-cup'
                                          : 'waffle-cone';
                                      onDirectOrder(scoop, [chosenFormat]);
                                      setSelectedFormats((prev) => ({ ...prev, [scoop.id]: [chosenFormat] }));
                                    }}
                                    className="flex-1 py-2 px-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-[#8C102A] hover:bg-[#A31634] text-white active:scale-95"
                                  >
                                    <span>Add to Tray</span>
                                  </button>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Coffee Section */}
        {filteredCoffee && filteredCoffee.length > 0 && (
          <div className="mb-14">
            <div id="coffee-section-header" className="flex items-center justify-between mb-6 pb-2 border-b border-[#E8DFC8]">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-[#8C102A]" />
                <h3 className="font-serif-title text-2xl font-bold text-[#241A18]">
                  Specialty Roasted Coffee ({filteredCoffee.length} Items)
                </h3>
              </div>
              <span className="text-xs text-[#7A6458]">
                Central Highlands Single-Origin Beans
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedCoffee.map((coffee) => {
                const isSoldOut = coffee.isAvailable === false;
                const isInTray = trayItemIds.has(coffee.id);
                return (
                  <div
                    key={coffee.id}
                    onClick={() => onSelectItem(coffee)}
                    className={`bg-white rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between group relative ${
                      isSoldOut ? 'opacity-90 border-red-200' : 'border-[#E8DFC8] hover:border-[#8C102A]'
                    }`}
                  >
                    {/* Top Image */}
                    <div className="relative h-44 bg-[#FAF7F2] overflow-hidden">
                      {coffee.image ? (
                        <img
                          src={coffee.image}
                          alt={coffee.name}
                          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                            isSoldOut ? 'grayscale-[30%] opacity-85' : ''
                          }`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#FAF7F2] text-[#8C102A]">
                          <Coffee className="w-10 h-10 opacity-30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

                      {/* Sold Out Dark Overlay */}
                      {isSoldOut && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-20">
                          <span className="px-3.5 py-1.5 rounded-full bg-red-600/95 text-white text-xs font-black uppercase tracking-wider shadow-lg border border-white/20 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Sold Out</span>
                          </span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                        {isSoldOut ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-600 text-white shadow-md flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Sold Out</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/90 text-[#8C102A] backdrop-blur-xs shadow-xs">
                            {coffee.portionOrTemp}
                          </span>
                        )}
                        {coffee.popular && !isSoldOut && (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                            Popular
                          </span>
                        )}
                      </div>

                      {/* Title on image overlay */}
                      <div className="absolute bottom-2.5 left-3 right-3 text-white">
                        <h4 className="font-serif-title text-lg font-bold drop-shadow-sm leading-snug">
                          {coffee.name}
                        </h4>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-[#5C4D44] line-clamp-2 leading-relaxed mb-3">
                          {coffee.description}
                        </p>

                        {/* Tags */}
                        {coffee.tags && coffee.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {coffee.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] bg-[#FAF7F2] text-[#4D3E36] px-2 py-0.5 rounded-md border border-[#E8DFC8]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#F0E8DC] flex items-center justify-between mt-2 gap-2">
                        <span className="text-base font-extrabold text-[#8C102A]">
                          {formatPrice(coffee.priceLKR, currency)}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectItem(coffee);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F0E8DC] text-[#241A18] text-xs font-bold border border-[#D9CBB7] transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                          {isSoldOut ? (
                            <button
                              type="button"
                              disabled
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                              <span>Sold Out</span>
                            </button>
                          ) : isInTray ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onRemoveFromTray) {
                                    onRemoveFromTray(coffee.id);
                                  }
                                }}
                                className="group/traybtn px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-red-600 text-white active:scale-95"
                                title="Click to cancel from tray"
                              >
                                <span className="flex items-center justify-center gap-1.5 group-hover/traybtn:hidden">
                                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                                  <span>In Tray</span>
                                </span>
                                <span className="hidden group-hover/traybtn:flex items-center justify-center gap-1.5 text-white">
                                  <X className="w-3.5 h-3.5" />
                                  <span>Cancel</span>
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDirectOrder(coffee);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                                title="Add another to tray"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDirectOrder(coffee);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                            >
                              Add to Tray
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cakes Section */}
        {filteredCakes && filteredCakes.length > 0 && (
          <div>
            <div id="cakes-section-header" className="flex items-center justify-between mb-6 pb-2 border-b border-[#E8DFC8]">
              <div className="flex items-center gap-2">
                <Cake className="w-5 h-5 text-[#8C102A]" />
                <h3 className="font-serif-title text-2xl font-bold text-[#241A18]">
                  Artisan Bakery & Cake Slices ({filteredCakes.length} Slices)
                </h3>
              </div>
              <span className="text-xs text-[#7A6458]">
                Baked Fresh Daily in Akurana
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedCakes.map((cake) => {
                const isSoldOut = cake.isAvailable === false;
                const isInTray = trayItemIds.has(cake.id);
                return (
                  <div
                    key={cake.id}
                    onClick={() => onSelectItem(cake)}
                    className={`bg-white rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between group relative ${
                      isSoldOut ? 'opacity-90 border-red-200' : 'border-[#E8DFC8] hover:border-[#8C102A]'
                    }`}
                  >
                    {/* Top Image */}
                    <div className="relative h-44 bg-[#FAF7F2] overflow-hidden">
                      {cake.image ? (
                        <img
                          src={cake.image}
                          alt={cake.name}
                          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                            isSoldOut ? 'grayscale-[30%] opacity-85' : ''
                          }`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#FAF7F2] text-[#8C102A]">
                          <Cake className="w-10 h-10 opacity-30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

                      {/* Sold Out Dark Overlay */}
                      {isSoldOut && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-20">
                          <span className="px-3.5 py-1.5 rounded-full bg-red-600/95 text-white text-xs font-black uppercase tracking-wider shadow-lg border border-white/20 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Sold Out</span>
                          </span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                        {isSoldOut ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-600 text-white shadow-md flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Sold Out</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/90 text-[#8C102A] backdrop-blur-xs shadow-xs">
                            {cake.portionOrTemp}
                          </span>
                        )}
                        {cake.popular && !isSoldOut && (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                            Bakery Favorite
                          </span>
                        )}
                      </div>

                      {/* Title on image overlay */}
                      <div className="absolute bottom-2.5 left-3 right-3 text-white">
                        <h4 className="font-serif-title text-lg font-bold drop-shadow-sm leading-snug">
                          {cake.name}
                        </h4>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-[#5C4D44] line-clamp-2 leading-relaxed mb-3">
                          {cake.description}
                        </p>

                        {/* Tags */}
                        {cake.tags && cake.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {cake.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] bg-[#FAF7F2] text-[#4D3E36] px-2 py-0.5 rounded-md border border-[#E8DFC8]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#F0E8DC] flex items-center justify-between mt-2 gap-2">
                        <span className="text-base font-extrabold text-[#8C102A]">
                          {formatPrice(cake.priceLKR, currency)}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectItem(cake);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F0E8DC] text-[#241A18] text-xs font-bold border border-[#D9CBB7] transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                          {isSoldOut ? (
                            <button
                              type="button"
                              disabled
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                              <span>Sold Out</span>
                            </button>
                          ) : isInTray ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onRemoveFromTray) {
                                    onRemoveFromTray(cake.id);
                                  }
                                }}
                                className="group/traybtn px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-red-600 text-white active:scale-95"
                                title="Click to cancel from tray"
                              >
                                <span className="flex items-center justify-center gap-1.5 group-hover/traybtn:hidden">
                                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                                  <span>In Tray</span>
                                </span>
                                <span className="hidden group-hover/traybtn:flex items-center justify-center gap-1.5 text-white">
                                  <X className="w-3.5 h-3.5" />
                                  <span>Cancel</span>
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDirectOrder(cake);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                                title="Add another to tray"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDirectOrder(cake);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                            >
                              Add to Tray
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
