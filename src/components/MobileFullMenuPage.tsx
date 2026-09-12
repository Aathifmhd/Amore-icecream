import React, { useState, useMemo, useEffect } from 'react';
import { Currency, BranchId, ScoopItem, MenuItem, SelectedOrderItem, ServingFormat, MenuTab } from '../types';
import { AMORE_BRANCHES } from '../data/iceCreamData';
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
import {
  ArrowLeft,
  Search,
  X,
  ShoppingBag,
  Check,
  Star,
  Coffee,
  Cookie,
  Info,
  MapPin,
  ShieldCheck,
  Sparkles,
  Plus,
  AlertCircle,
} from 'lucide-react';

interface MobileFullMenuPageProps {
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  selectedBranch: BranchId;
  onSelectBranch: (b: BranchId) => void;
  orderItems: SelectedOrderItem[];
  onDirectOrder: (item: ScoopItem | MenuItem, formats?: ServingFormat[]) => void;
  onRemoveFromTray: (itemId: string, formats?: ServingFormat[]) => void;
  onSelectItem: (item: ScoopItem | MenuItem) => void;
  onOpenTray: () => void;
  onBackToHome: () => void;
  initialTab?: MenuTab;
}

export const MobileFullMenuPage: React.FC<MobileFullMenuPageProps> = ({
  currency,
  onToggleCurrency,
  selectedBranch,
  onSelectBranch,
  orderItems,
  onDirectOrder,
  onRemoveFromTray,
  onSelectItem,
  onOpenTray,
  onBackToHome,
  initialTab = 'all',
}) => {
  const [activeTab, setActiveTab] = useState<MenuTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'biscuit-cup' | 'cone'>('all');
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Dynamic Real-time Menu State from Storage & Cloud Firestore
  const [allScoops, setAllScoops] = useState<ScoopItem[]>(() => getAllGelatoFlavours());
  const [allCoffee, setAllCoffee] = useState<MenuItem[]>(() => getAllCoffeeItems());
  const [allCakes, setAllCakes] = useState<MenuItem[]>(() => getAllCakeItems());

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Multi-layer Real-time Menu Sync (Event, Storage, Focus & Firestore)
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

  const branchInfo = AMORE_BRANCHES.find((b) => b.id === selectedBranch) || AMORE_BRANCHES[0];
  const itemCount = orderItems.reduce((sum, it) => sum + it.quantity, 0);
  const totalLKR = orderItems.reduce((sum, it) => sum + it.priceLKR * it.quantity, 0);

  // Track items currently in tray
  const trayItemMap = useMemo(() => {
    const map: Record<string, { totalQty: number; formats: string[] }> = {};
    orderItems.forEach((it) => {
      if (!map[it.itemId]) {
        map[it.itemId] = { totalQty: 0, formats: [] };
      }
      map[it.itemId].totalQty += it.quantity;
      if (it.format) {
        map[it.itemId].formats.push(it.format);
      }
    });
    return map;
  }, [orderItems]);

  // Temporary visual flash when added
  const triggerAddAnimation = (id: string) => {
    setJustAddedId(id);
    setTimeout(() => {
      setJustAddedId((prev) => (prev === id ? null : prev));
    }, 1200);
  };

  // Filter scoops
  const filteredScoops = useMemo(() => {
    if (activeTab === 'coffee' || activeTab === 'cakes') return [];

    return allScoops.filter((scoop) => {
      if (activeTab === 'tourist-specials' && !scoop.isArugamBaySpecial) return false;

      // Dietary filter
      if (dietaryFilter === 'Halal' && !scoop.dietary.includes('Halal')) return false;
      if (dietaryFilter === 'Eggless' && !scoop.dietary.includes('Eggless')) return false;
      if (dietaryFilter === 'Real Fruit' && !scoop.dietary.includes('100% Real Fruit')) return false;
      if (dietaryFilter === 'Gluten-Free' && !scoop.dietary.includes('Gluten-Free')) return false;
      if (dietaryFilter === 'Popular' && !scoop.isIconic && !scoop.isPopular) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = scoop.name.toLowerCase().includes(q);
        const matchesDesc = scoop.description.toLowerCase().includes(q);
        const matchesNotes = scoop.tastingNotes.some((n) => n.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesNotes) return false;
      }

      return true;
    });
  }, [allScoops, activeTab, dietaryFilter, searchQuery]);

  // Filter coffee
  const filteredCoffee = useMemo(() => {
    if (activeTab === 'scoops' || activeTab === 'cakes' || activeTab === 'tourist-specials') return [];

    return allCoffee.filter((item) => {
      if (dietaryFilter === 'Popular' && !item.popular) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [allCoffee, activeTab, dietaryFilter, searchQuery]);

  // Filter cakes
  const filteredCakes = useMemo(() => {
    if (activeTab === 'scoops' || activeTab === 'coffee' || activeTab === 'tourist-specials') return [];

    return allCakes.filter((item) => {
      if (dietaryFilter === 'Popular' && !item.popular) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [allCakes, activeTab, dietaryFilter, searchQuery]);

  const totalResults = filteredScoops.length + filteredCoffee.length + filteredCakes.length;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#241A18] pb-28">
      {/* Sticky Mobile Top Header */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFC8] shadow-xs">
        <div className="px-3 py-2.5 flex items-center justify-between gap-2">
          {/* Back to Home Button */}
          <button
            onClick={onBackToHome}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white border border-[#E8DFC8] text-[#8C102A] font-bold text-xs hover:bg-[#FAF7F2] active:scale-95 transition-all cursor-pointer shadow-2xs"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Home</span>
          </button>

          {/* Title Header */}
          <div className="flex-1 text-center min-w-0">
            <h1 className="font-serif-title font-bold text-base text-[#241A18] truncate leading-tight">
              Amore Full Menu
            </h1>
            <p className="text-[10px] text-[#7A6458] truncate">
              {allScoops.length} Gelatos • Barista Coffee • Cakes
            </p>
          </div>

          {/* Currency Toggle & Tray Shortcut */}
          <div className="flex items-center gap-1.5 shrink-0">
            <CurrencyToggle currency={currency} onToggle={onToggleCurrency} onToggleCurrency={onToggleCurrency} />
            <button
              onClick={onOpenTray}
              className="relative p-2 rounded-xl bg-[#8C102A] text-white active:scale-95 transition-transform shadow-xs cursor-pointer"
              title="View Tray"
              aria-label="View Tray"
            >
              <ShoppingBag className="w-4 h-4 text-amber-200" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-[#8C102A] text-[9px] font-black flex items-center justify-center shadow-xs">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Branch Selector Banner */}
        <div className="bg-[#EFE8DC] px-3 py-1.5 flex items-center justify-between text-[11px] border-t border-[#E8DFC8]/60">
          <div className="flex items-center gap-1.5 text-[#5C4D44] truncate">
            <MapPin className="w-3.5 h-3.5 text-[#8C102A] shrink-0" />
            <span className="text-[#7A6458]">Ordering at:</span>
            <select
              value={selectedBranch}
              onChange={(e) => onSelectBranch(e.target.value as BranchId)}
              className="bg-transparent font-bold text-[#241A18] text-[11px] focus:outline-hidden cursor-pointer"
            >
              {AMORE_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.selectorLabel || b.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-[10px] font-semibold text-[#8C102A] bg-white/80 px-2 py-0.5 rounded-md border border-[#E0D5C3]">
            {branchInfo.hours.split('(')[0].trim()}
          </span>
        </div>

        {/* Sticky Category Tabs */}
        <div className="px-2 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5 border-t border-[#E8DFC8]/50 bg-[#FAF7F2]">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              activeTab === 'all'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#5C4D44] border-[#E8DFC8]'
            }`}
          >
            All Items ({allScoops.length + allCoffee.length + allCakes.length})
          </button>

          <button
            onClick={() => setActiveTab('scoops')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1 ${
              activeTab === 'scoops'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#5C4D44] border-[#E8DFC8]'
            }`}
          >
            <span>🍨 Gelato Scoops ({allScoops.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('coffee')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1 ${
              activeTab === 'coffee'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#5C4D44] border-[#E8DFC8]'
            }`}
          >
            <Coffee className="w-3 h-3" />
            <span>Coffee ({allCoffee.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('cakes')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1 ${
              activeTab === 'cakes'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#5C4D44] border-[#E8DFC8]'
            }`}
          >
            <span>🍰 Cakes ({allCakes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tourist-specials')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1 ${
              activeTab === 'tourist-specials'
                ? 'bg-amber-800 text-white border-amber-900 shadow-xs'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Specials</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-3 pt-3 space-y-3">
        {/* Search & Dietary Chips */}
        <div className="space-y-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search flavours (e.g., Durian, Pistachio, Espresso)..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white border border-[#E8DFC8] text-xs text-[#241A18] placeholder:text-[#A8988B] focus:outline-hidden focus:ring-2 focus:ring-[#8C102A]/20 focus:border-[#8C102A] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#A8988B] hover:text-[#241A18]"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Dietary Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[11px]">
            {[
              { id: 'all', label: 'All Diets' },
              { id: 'Popular', label: '⭐ Must-Try' },
              { id: 'Halal', label: '🌿 Halal' },
              { id: 'Eggless', label: '🥚 Eggless' },
              { id: 'Real Fruit', label: '🍓 100% Real Fruit' },
              { id: 'Gluten-Free', label: '🌾 Gluten-Free' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setDietaryFilter(chip.id)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  dietaryFilter === chip.id
                    ? 'bg-[#241A18] text-white border-[#241A18]'
                    : 'bg-white text-[#6B5A51] border-[#E8DFC8]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Result Summary */}
        <div className="flex items-center justify-between text-[11px] text-[#7A6458] px-1">
          <span>Showing {totalResults} items</span>
          {activeTab === 'scoops' && (
            <span className="text-amber-800 font-medium">All {allScoops.length} Gelato Scoops Available</span>
          )}
        </div>

        {/* SCOOPS SECTION */}
        {filteredScoops.length > 0 && (
          <div className="space-y-3">
            {activeTab === 'all' && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm font-bold font-serif-title text-[#241A18]">
                  Artisanal Gelato Scoops ({filteredScoops.length})
                </span>
                <div className="h-px bg-[#E8DFC8] flex-1" />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {filteredScoops.map((scoop) => {
                const inTray = trayItemMap[scoop.id];
                const isJustAdded = justAddedId === scoop.id;
                const isSoldOut = scoop.isAvailable === false;

                return (
                  <div
                    key={scoop.id}
                    onClick={() => onSelectItem(scoop)}
                    className={`bg-white rounded-2xl border transition-all p-3 shadow-2xs cursor-pointer hover:border-[#8C102A]/50 hover:shadow-md ${
                      inTray ? 'border-[#8C102A]/40 ring-1 ring-[#8C102A]/20' : 'border-[#E8DFC8]'
                    } ${isSoldOut ? 'opacity-85' : ''}`}
                  >
                    <div className="flex gap-3">
                      {/* Scoop Thumbnail Image */}
                      <div
                        className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-[#FAF7F2] shrink-0 text-left group cursor-pointer"
                        title="View Scoop Details"
                      >
                        <img
                          src={scoop.image}
                          alt={scoop.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        {isSoldOut ? (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-20">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-600 text-white shadow-md flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span>Sold Out</span>
                            </span>
                          </div>
                        ) : scoop.isIconic ? (
                          <span className="absolute top-1 left-1 bg-[#8C102A] text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-xs">
                            #1 Iconic
                          </span>
                        ) : scoop.isPopular ? (
                          <span className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-xs">
                            Popular
                          </span>
                        ) : null}
                      </div>

                      {/* Content Column */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          {/* Name & Tagline */}
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-left font-serif-title font-bold text-sm text-[#241A18] hover:text-[#8C102A] transition-colors leading-snug line-clamp-1">
                              {scoop.name}
                            </h4>
                            {inTray && (
                              <span className="shrink-0 bg-[#FDE8EC] text-[#8C102A] text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                {inTray.totalQty} in tray
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-[#8C7A6F] line-clamp-1 mt-0.5">
                            {scoop.tagline}
                          </p>

                          {/* Dietary Badges */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {scoop.dietary.slice(0, 2).map((d) => (
                              <span
                                key={d}
                                className="text-[9px] font-medium px-1.5 py-0.2 rounded-md bg-[#FAF7F2] text-[#6B5A51] border border-[#E8DFC8]"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Direct Order Actions for Scoop (Waffle Cone vs Edible Biscuit Cup) */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="pt-2 mt-1 border-t border-[#F0EBE0] flex flex-col gap-1.5"
                        >
                          <div className="text-[10px] text-[#7A6458] flex items-center justify-between">
                            <span>{isSoldOut ? 'Availability:' : 'Select type & tap to add:'}</span>
                            <span className="text-[10px] font-bold text-[#8C102A] flex items-center gap-0.5">
                              Details ↗
                            </span>
                          </div>

                          {isSoldOut ? (
                            <button
                              type="button"
                              disabled
                              className="w-full py-2 px-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-400 text-[11px] font-bold cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                              <span>Currently Sold Out</span>
                            </button>
                          ) : (
                            <div className="grid grid-cols-2 gap-1.5">
                              {/* Waffle Cone Option */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDirectOrder(scoop, ['waffle-cone']);
                                  triggerAddAnimation(scoop.id);
                                }}
                                className="py-1.5 px-2 rounded-xl bg-[#FAF7F2] hover:bg-[#EFE8DC] border border-[#E8DFC8] active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer group"
                                title="Add in Waffle Cone"
                              >
                                <span className="text-[10px] font-semibold text-[#3D2C24] flex items-center gap-1">
                                  <span>🍦 Cone</span>
                                </span>
                                <span className="text-[11px] font-black text-[#8C102A]">
                                  {formatPrice(scoop.conePriceLKR, currency)}
                                </span>
                              </button>

                              {/* Edible Biscuit Cup Option (Signature Highlight) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDirectOrder(scoop, ['biscuit-cup']);
                                  triggerAddAnimation(scoop.id);
                                }}
                                className="py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer shadow-2xs relative overflow-hidden"
                                title="Add in Edible Biscuit Cup"
                              >
                                <span className="text-[10px] font-bold text-amber-900 flex items-center gap-1">
                                  <span>🍪 Biscuit Cup</span>
                                </span>
                                <span className="text-[11px] font-black text-amber-900">
                                  {formatPrice(scoop.biscuitCupPriceLKR, currency)}
                                </span>
                                <span className="text-[8px] font-bold text-amber-700 leading-none">
                                  Zero waste!
                                </span>
                              </button>
                            </div>
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

        {/* SPECIALTY COFFEE SECTION */}
        {filteredCoffee.length > 0 && (
          <div className="space-y-3 pt-2">
            {(activeTab === 'all' || activeTab === 'coffee') && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm font-bold font-serif-title text-[#241A18] flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-[#8C102A]" />
                  <span>Specialty Barista Coffee ({filteredCoffee.length})</span>
                </span>
                <div className="h-px bg-[#E8DFC8] flex-1" />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3.5">
              {filteredCoffee.map((item) => {
                const inTray = trayItemMap[item.id];
                const isOrdered = !!inTray;
                const isSoldOut = item.isAvailable === false;

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className={`bg-white rounded-2xl border transition-all p-3.5 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-[#8C102A]/50 hover:shadow-md ${
                      isOrdered ? 'border-emerald-600/50 ring-2 ring-emerald-500/20' : 'border-[#E8DFC8]'
                    } ${isSoldOut ? 'opacity-85' : ''}`}
                    role="button"
                    tabIndex={0}
                  >
                    <div>
                      {/* Big Picture & Badges */}
                      <div className="relative w-full h-40 rounded-xl overflow-hidden bg-[#FAF7F2] mb-2.5 group">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {isSoldOut && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-20">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-600 text-white shadow-md flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Sold Out</span>
                            </span>
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
                          {isSoldOut ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-red-600 text-white shadow-xs">
                              Sold Out
                            </span>
                          ) : item.popular ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500 text-white shadow-xs">
                              Barista Special
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/95 text-[#241A18] backdrop-blur-xs">
                            {item.portionOrTemp || 'Hot & Iced'}
                          </span>
                        </div>

                        {/* Name on image */}
                        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white">
                          <h4 className="font-serif-title text-base font-bold drop-shadow-sm leading-tight">
                            {item.name}
                          </h4>
                          <span className="text-[9px] text-amber-200 font-medium">
                            Details ↗
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#5C4D44] line-clamp-2 leading-relaxed mb-2">
                        {item.description}
                      </p>
                    </div>

                    {/* Card Actions: Price, Details & Order Button */}
                    <div className="pt-2 border-t border-[#F0E8DC] space-y-2">
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#E0D5C3]"
                      >
                        <span className="text-[11px] font-bold text-[#6B574B]">Price</span>
                        <span className="font-extrabold text-xs text-[#8C102A]">
                          {formatPrice(item.priceLKR, currency)}
                        </span>
                      </div>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(item);
                          }}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-[#F3EDE3] text-[#241A18] text-xs font-bold border border-[#D9CBB7] transition-colors cursor-pointer shrink-0 shadow-2xs"
                        >
                          Details
                        </button>

                        {isSoldOut ? (
                          <button
                            type="button"
                            disabled
                            className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            <span>Sold Out</span>
                          </button>
                        ) : isOrdered ? (
                          <div className="flex-1 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromTray && onRemoveFromTray(item.id);
                              }}
                              className="flex-1 py-2 px-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 bg-emerald-700 text-white"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-200" />
                              <span>In Tray ({inTray.totalQty})</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDirectOrder(item);
                              }}
                              className="px-2.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-0.5"
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
                              onDirectOrder(item);
                            }}
                            className="flex-1 py-2 px-3 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-[#8C102A] hover:bg-[#A31634] text-white active:scale-95"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 text-amber-200" />
                            <span>Add to Tray</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ARTISAN CAKES SECTION */}
        {filteredCakes.length > 0 && (
          <div className="space-y-3 pt-2">
            {(activeTab === 'all' || activeTab === 'cakes') && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm font-bold font-serif-title text-[#241A18] flex items-center gap-1.5">
                  <span>🍰 Gourmet Dessert Cakes ({filteredCakes.length})</span>
                </span>
                <div className="h-px bg-[#E8DFC8] flex-1" />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3.5">
              {filteredCakes.map((cake) => {
                const inTray = trayItemMap[cake.id];
                const isOrdered = !!inTray;
                const isSoldOut = cake.isAvailable === false;

                return (
                  <div
                    key={cake.id}
                    onClick={() => onSelectItem(cake)}
                    className={`bg-white rounded-2xl border transition-all p-3.5 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-[#8C102A]/50 hover:shadow-md ${
                      isOrdered ? 'border-emerald-600/50 ring-2 ring-emerald-500/20' : 'border-[#E8DFC8]'
                    } ${isSoldOut ? 'opacity-85' : ''}`}
                    role="button"
                    tabIndex={0}
                  >
                    <div>
                      {/* Big Picture & Badges */}
                      <div className="relative w-full h-40 rounded-xl overflow-hidden bg-[#FAF7F2] mb-2.5 group">
                        <img
                          src={cake.image}
                          alt={cake.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {isSoldOut && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-20">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-600 text-white shadow-md flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Sold Out</span>
                            </span>
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
                          {isSoldOut ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-red-600 text-white shadow-xs">
                              Sold Out
                            </span>
                          ) : cake.popular ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-[#8C102A] text-white shadow-xs">
                              Bestseller
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/95 text-[#241A18] backdrop-blur-xs">
                            {cake.portionOrTemp || 'Artisan Slice'}
                          </span>
                        </div>

                        {/* Name on image */}
                        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white">
                          <h4 className="font-serif-title text-base font-bold drop-shadow-sm leading-tight">
                            {cake.name}
                          </h4>
                          <span className="text-[9px] text-amber-200 font-medium">
                            Details ↗
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#5C4D44] line-clamp-2 leading-relaxed mb-2">
                        {cake.description}
                      </p>
                    </div>

                    {/* Card Actions: Price, Details & Order Button */}
                    <div className="pt-2 border-t border-[#F0E8DC] space-y-2">
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#E0D5C3]"
                      >
                        <span className="text-[11px] font-bold text-[#6B574B]">Price</span>
                        <span className="font-extrabold text-xs text-[#8C102A]">
                          {formatPrice(cake.priceLKR, currency)}
                        </span>
                      </div>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(cake);
                          }}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-[#F3EDE3] text-[#241A18] text-xs font-bold border border-[#D9CBB7] transition-colors cursor-pointer shrink-0 shadow-2xs"
                        >
                          Details
                        </button>

                        {isSoldOut ? (
                          <button
                            type="button"
                            disabled
                            className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            <span>Sold Out</span>
                          </button>
                        ) : isOrdered ? (
                          <div className="flex-1 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromTray && onRemoveFromTray(cake.id);
                              }}
                              className="flex-1 py-2 px-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 bg-emerald-700 text-white"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-200" />
                              <span>In Tray ({inTray.totalQty})</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDirectOrder(cake);
                              }}
                              className="px-2.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-0.5"
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
                            className="flex-1 py-2 px-3 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-[#8C102A] hover:bg-[#A31634] text-white active:scale-95"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 text-amber-200" />
                            <span>Add to Tray</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty Search State */}
        {totalResults === 0 && (
          <div className="text-center py-12 px-4 bg-white rounded-2xl border border-[#E8DFC8] my-4">
            <span className="text-3xl block mb-2">🍨</span>
            <h3 className="text-sm font-bold text-[#241A18]">No flavours match your search</h3>
            <p className="text-xs text-[#7A6458] mt-1">
              Try searching "Durian", "Mango", "Pistachio", or tap Clear Filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setDietaryFilter('all');
                setActiveTab('all');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-[#8C102A] text-white font-bold text-xs cursor-pointer shadow-xs"
            >
              Show All 20 Flavours
            </button>
          </div>
        )}
      </main>

      {/* Sticky Bottom Order Bar on Mobile Menu Page */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-[#E8DFC8] p-3 shadow-2xl flex items-center justify-between gap-3">
        {/* Back to Home Shortcut */}
        <button
          onClick={onBackToHome}
          className="py-2.5 px-3 rounded-xl bg-white border border-[#E8DFC8] text-[#5C4D44] font-bold text-xs flex items-center gap-1 hover:bg-[#FAF7F2] active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-[#8C102A]" />
          <span>Home</span>
        </button>

        {/* Primary Action Button (Order Tray or Prompt) */}
        <button
          onClick={onOpenTray}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-between shadow-md active:scale-95 transition-all cursor-pointer ${
            itemCount > 0
              ? 'bg-[#8C102A] text-white hover:bg-[#730D22]'
              : 'bg-[#241A18] text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <ShoppingBag className="w-4 h-4 text-amber-200" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 text-[#8C102A] text-[8px] font-black flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </div>
            <span>
              {itemCount === 0 ? 'Your Tray is Empty' : `${itemCount} item${itemCount > 1 ? 's' : ''} in Tray`}
            </span>
          </div>

          <span className="text-amber-200 font-black">
            {itemCount === 0 ? 'Tap items to add →' : formatPrice(totalLKR, currency)}
          </span>
        </button>
      </div>
    </div>
  );
};
