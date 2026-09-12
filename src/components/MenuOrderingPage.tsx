import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Currency, BranchId, ScoopItem, MenuItem, SelectedOrderItem, ServingFormat, MenuTab } from '../types';
import { ALL_20_FLAVOURS, SPECIALTY_COFFEE_ITEMS, ARTISAN_CAKES_ITEMS, AMORE_BRANCHES } from '../data/iceCreamData';
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
  Coffee,
  Cookie,
  MapPin,
  Sparkles,
  Check,
  Cake,
  SlidersHorizontal,
  Plus,
  LogIn,
  User as UserIcon,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { type User } from '../firebase';

interface MenuOrderingPageProps {
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  selectedBranch: BranchId;
  onSelectBranch: (b: BranchId) => void;
  orderItems: SelectedOrderItem[];
  onDirectOrder: (item: ScoopItem | MenuItem, formats?: ServingFormat[]) => void;
  onRemoveFromTray?: (itemId: string, formats?: ServingFormat[]) => void;
  onSelectItem: (item: ScoopItem | MenuItem) => void;
  onOpenTray: () => void;
  onBackToHome: () => void;
  currentUser?: User | null;
  onOpenSignInModal?: () => void;
  onOpenOrdersModal?: () => void;
  ordersCount?: number;
}

export const MenuOrderingPage: React.FC<MenuOrderingPageProps> = ({
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
  currentUser,
  onOpenSignInModal,
  onOpenOrdersModal,
  ordersCount,
}) => {
  const [activeTab, setActiveTab] = useState<MenuTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [preferredFormat, setPreferredFormat] = useState<'both' | 'biscuit-cup' | 'waffle-cone'>('both');

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

    // 1. Same-window custom event
    window.addEventListener(MENU_UPDATED_EVENT, handleMenuSync);

    // 2. Cross-tab/window storage event
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('amore_menu_')) {
        handleMenuSync();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Tab focus event
    window.addEventListener('focus', handleMenuSync);

    // 4. Initial async cloud pull & live subscription
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

  // Auto-reset all selected format buttons whenever tray transitions from having items to empty
  const prevOrderCountRef = useRef(orderItems.length);
  useEffect(() => {
    if (prevOrderCountRef.current > 0 && orderItems.length === 0) {
      setSelectedFormats({});
    }
    prevOrderCountRef.current = orderItems.length;
  }, [orderItems.length]);

  // If user switches away from Arugambay branch while on tourist-specials tab, auto reset to 'all'
  useEffect(() => {
    if (selectedBranch !== 'arugambay' && activeTab === 'tourist-specials') {
      setActiveTab('all');
    }
  }, [selectedBranch, activeTab]);

  // Scroll to top upon opening the ordering page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const branchInfo = AMORE_BRANCHES.find((b) => b.id === selectedBranch) || AMORE_BRANCHES[0];
  const itemCount = orderItems.reduce((sum, it) => sum + it.quantity, 0);
  const totalLKR = orderItems.reduce((sum, it) => sum + it.priceLKR * it.quantity, 0);

  // Quick lookup for items in tray
  const trayItemMap = useMemo(() => {
    const map: Record<string, { totalQty: number; formats: string[]; items: SelectedOrderItem[] }> = {};
    orderItems.forEach((it) => {
      if (!map[it.itemId]) {
        map[it.itemId] = { totalQty: 0, formats: [], items: [] };
      }
      map[it.itemId].totalQty += it.quantity;
      map[it.itemId].items.push(it);
      if (it.format) {
        map[it.itemId].formats.push(it.format);
      }
    });
    return map;
  }, [orderItems]);

  const getSelectedFormats = (scoopId: string): ServingFormat[] => {
    return selectedFormats[scoopId] || [];
  };

  const handleToggleFormat = (scoopId: string, format: ServingFormat, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFormats((prev) => ({
      ...prev,
      [scoopId]: [format],
    }));
  };

  // Filter scoops based on search & active tab
  const filteredScoops = useMemo(() => {
    if (activeTab === 'coffee' || activeTab === 'cakes') return [];

    return allScoops.filter((scoop) => {
      if (activeTab === 'tourist-specials' && !scoop.isArugamBaySpecial) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = scoop.name.toLowerCase().includes(q);
        const matchesDesc = scoop.description.toLowerCase().includes(q);
        const matchesNotes = scoop.tastingNotes.some((n) => n.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesNotes) return false;
      }

      return true;
    });
  }, [activeTab, searchQuery, allScoops]);

  // Filter coffee
  const filteredCoffee = useMemo(() => {
    if (activeTab === 'scoops' || activeTab === 'cakes' || activeTab === 'tourist-specials') return [];

    return allCoffee.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [activeTab, searchQuery, allCoffee]);

  // Filter cakes
  const filteredCakes = useMemo(() => {
    if (activeTab === 'scoops' || activeTab === 'coffee' || activeTab === 'tourist-specials') return [];

    return allCakes.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [activeTab, searchQuery, allCakes]);

  const totalResults = filteredScoops.length + filteredCoffee.length + filteredCakes.length;

  return (
    <div className={`min-h-screen bg-[#FAF7F2] text-[#241A18] ${itemCount > 0 ? 'pb-24 sm:pb-28' : 'pb-10'}`}>
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFC8] shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          {/* Back to Home Button (Top Only) */}
          <button
            onClick={onBackToHome}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E8DFC8] text-[#8C102A] font-bold text-xs sm:text-sm hover:bg-[#FAF7F2] active:scale-95 transition-all cursor-pointer shadow-2xs shrink-0"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          {/* Center Brand Title */}
          <div className="flex-1 text-center min-w-0">
            <h1 className="font-serif-title font-bold text-base sm:text-xl text-[#241A18] truncate leading-tight">
              Amore Full Menu & Ordering
            </h1>
            <p className="text-[11px] sm:text-xs text-[#7A6458] truncate hidden xs:block">
              20 Artisanal Gelato Scoops • Barista Coffee • Bakery Cakes
            </p>
          </div>

          {/* Right Controls: Currency Toggle, Sign In & Tray Shortcut */}
          <div className="flex items-center gap-2 shrink-0">
            <CurrencyToggle currency={currency} onToggle={onToggleCurrency} onToggleCurrency={onToggleCurrency} />

            {/* Sign In / Account Button on Menu Page */}
            {currentUser ? (
              <button
                type="button"
                onClick={onOpenSignInModal}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D9CBB7] hover:border-[#8C102A] text-xs font-bold text-[#241A18] transition-colors cursor-pointer shadow-2xs"
                title={`Signed in as ${currentUser.displayName || currentUser.email}`}
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 rounded-full object-cover border border-[#8C102A]"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-[#8C102A] text-white flex items-center justify-center text-[9px] font-black">
                    {(currentUser.displayName || currentUser.email || 'A')[0].toUpperCase()}
                  </div>
                )}
                <span className="max-w-[80px] truncate">{currentUser.displayName?.split(' ')[0] || 'Account'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSignInModal}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-[#D9CBB7] hover:border-[#8C102A] text-xs font-bold text-[#5D4E46] hover:text-[#8C102A] transition-colors cursor-pointer shadow-2xs"
              >
                <LogIn className="w-3.5 h-3.5 text-[#8C102A]" />
                <span>Sign In</span>
              </button>
            )}

            {/* Ongoing Orders Button - Only when signed in */}
            {onOpenOrdersModal && currentUser && (
              <button
                type="button"
                onClick={onOpenOrdersModal}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D9CBB7] hover:border-[#8C102A] text-xs font-bold text-[#4D3E36] hover:text-[#8C102A] transition-colors cursor-pointer shadow-2xs relative"
                title="View your ongoing orders & 2-min grace period"
              >
                <Clock className="w-3.5 h-3.5 text-[#8C102A]" />
                <span>Orders</span>
                {ordersCount !== undefined && ordersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#8C102A] text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                    {ordersCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={onOpenTray}
              className="relative py-2 px-3 sm:px-4 rounded-xl bg-[#8C102A] text-white text-xs sm:text-sm font-bold flex items-center gap-2 hover:bg-[#730D22] active:scale-95 transition-all shadow-xs cursor-pointer"
              title="View Your Tray"
              aria-label="View Your Tray"
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4 text-amber-200" />
                {itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-amber-400 text-[#8C102A] text-[9px] font-black flex items-center justify-center shadow-xs">
                    {itemCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline">
                {itemCount === 0 ? 'Tray' : `${itemCount} • ${formatPrice(totalLKR, currency)}`}
              </span>
            </button>
          </div>
        </div>

        {/* Branch Info & Operational Hours Bar */}
        <div className="bg-[#EFE8DC] border-t border-[#E8DFC8]/60 px-3 sm:px-6 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#5C4D44]">
              <MapPin className="w-4 h-4 text-[#8C102A] shrink-0" />
              <span className="text-[#7A6458]">Branch for Pickup / Delivery:</span>
              <select
                value={selectedBranch}
                onChange={(e) => onSelectBranch(e.target.value as BranchId)}
                className="bg-white font-bold text-[#241A18] text-xs px-2.5 py-1 rounded-lg border border-[#D9CBB7] focus:outline-hidden cursor-pointer"
              >
                {AMORE_BRANCHES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.selectorLabel || b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[11px] font-semibold text-[#8C102A] bg-white/90 px-2.5 py-0.5 rounded-md border border-[#E0D5C3]">
              🕒 {branchInfo.hours}
            </div>
          </div>
        </div>

        {/* Category Filters (Requested exact filters: "All items", "Gelato Scoops", "Special Coffee", "And Cakes", and "Arugambay Special" if Arugam Bay selected) */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 overflow-x-auto no-scrollbar flex items-center gap-2 border-t border-[#E8DFC8]/50 bg-[#FAF7F2]">
          {/* 1. All items */}
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
              activeTab === 'all'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#5C4D44] border-[#E8DFC8] hover:bg-[#F3EDE3]'
            }`}
          >
            All items ({allScoops.length + allCoffee.length + allCakes.length})
          </button>

          {/* 2. Gelato Scoops */}
          <button
            onClick={() => setActiveTab('scoops')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              activeTab === 'scoops'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#5C4D44] border-[#E8DFC8] hover:bg-[#F3EDE3]'
            }`}
          >
            <span>🍨 Gelato Scoops ({allScoops.length})</span>
          </button>

          {/* 3. Special Coffee */}
          <button
            onClick={() => setActiveTab('coffee')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              activeTab === 'coffee'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#5C4D44] border-[#E8DFC8] hover:bg-[#F3EDE3]'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Special Coffee ({allCoffee.length})</span>
          </button>

          {/* 4. And Cakes */}
          <button
            onClick={() => setActiveTab('cakes')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              activeTab === 'cakes'
                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                : 'bg-white text-[#5C4D44] border-[#E8DFC8] hover:bg-[#F3EDE3]'
            }`}
          >
            <Cake className="w-3.5 h-3.5" />
            <span>And Cakes ({allCakes.length})</span>
          </button>

          {/* 5. Arugambay Special (Displayed ONLY when Arugam Bay branch is selected) */}
          {selectedBranch === 'arugambay' && (
            <button
              onClick={() => setActiveTab('tourist-specials')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                activeTab === 'tourist-specials'
                  ? 'bg-amber-800 text-white border-amber-900 shadow-xs'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Arugambay Special</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-4">
        {/* Search Bar (MUST) & Price Focus (ONLY for Gelato Scoops) */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E8DFC8] shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input (A search bar is MUST) */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flavours (e.g., Durian, Pistachio, Mango, Affogato, Lotus Biscoff)..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E8DFC8] text-xs sm:text-sm text-[#241A18] placeholder:text-[#A8988B] focus:outline-hidden focus:ring-2 focus:ring-[#8C102A]/20 focus:border-[#8C102A] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A8988B] hover:text-[#241A18] cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Price Focus Selector - ONLY for Gelato Scoops */}
            {activeTab === 'scoops' && (
              <div className="flex items-center gap-2 text-xs shrink-0">
                <span className="font-bold text-[#5C4D44] flex items-center gap-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#8C102A]" />
                  <span>Price Focus:</span>
                </span>
                <div className="inline-flex rounded-xl bg-[#FAF7F2] p-1 border border-[#E8DFC8]">
                  <button
                    type="button"
                    onClick={() => setPreferredFormat('both')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      preferredFormat === 'both' ? 'bg-[#8C102A] text-white shadow-xs' : 'text-[#5C4D44] hover:text-[#241A18]'
                    }`}
                  >
                    Both Formats
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredFormat('biscuit-cup')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      preferredFormat === 'biscuit-cup' ? 'bg-amber-700 text-white shadow-xs' : 'text-[#5C4D44] hover:text-amber-800'
                    }`}
                  >
                    <Cookie className="w-3.5 h-3.5" />
                    <span>Biscuit Cup</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredFormat('waffle-cone')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      preferredFormat === 'waffle-cone' ? 'bg-[#8C102A] text-white shadow-xs' : 'text-[#5C4D44] hover:text-[#241A18]'
                    }`}
                  >
                    Waffle Cone
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-[#7A6458] px-1">
          <span>Found {totalResults} delicious options</span>
          {activeTab === 'scoops' && (
            <span className="text-amber-800 font-semibold">20/20 Gelato Scoops Churned Fresh</span>
          )}
        </div>

        {/* GELATO SCOOPS SECTION */}
        {filteredScoops.length > 0 && (
          <div className="space-y-3">
            {activeTab === 'all' && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-base sm:text-lg font-bold font-serif-title text-[#241A18]">
                  Artisanal Gelato Scoops ({filteredScoops.length})
                </span>
                <div className="h-px bg-[#E8DFC8] flex-1" />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredScoops.map((scoop) => {
                const isSoldOut = scoop.isAvailable === false;
                const effectiveFormat = activeTab === 'scoops' ? preferredFormat : 'both';
                const itemsOfThisScoopInTray = orderItems.filter((it) => it.itemId === scoop.id);
                const hasAnyInTray = itemsOfThisScoopInTray.length > 0;
                const isOrdered = hasAnyInTray;

                const scoopFormats = getSelectedFormats(scoop.id);

                // Determine active single format selection
                const chosenFormat: ServingFormat =
                  scoopFormats.length > 0
                    ? scoopFormats[0]
                    : effectiveFormat === 'biscuit-cup'
                    ? 'biscuit-cup'
                    : 'waffle-cone';

                const isWaffleSelected = chosenFormat === 'waffle-cone';
                const isBiscuitSelected = chosenFormat === 'biscuit-cup';

                const scoopInTray = trayItemMap[scoop.id];
                const scoopTotalQty = scoopInTray ? scoopInTray.totalQty : itemsOfThisScoopInTray.reduce((sum, it) => sum + it.quantity, 0);

                const handleCancelFromTray = (e?: React.MouseEvent) => {
                  if (e) e.stopPropagation();
                  if (onRemoveFromTray) {
                    onRemoveFromTray(scoop.id);
                  }
                };

                const handleOrderDirect = (e?: React.MouseEvent) => {
                  if (e) {
                    e.stopPropagation();
                    e.preventDefault();
                  }
                  if (isSoldOut) return;
                  // Adds strictly ONE item to the tray in the chosen single format
                  onDirectOrder(scoop, [chosenFormat]);
                  setSelectedFormats((prev) => ({ ...prev, [scoop.id]: [chosenFormat] }));
                };

                return (
                  <div
                    key={scoop.id}
                    onClick={() => onSelectItem(scoop)}
                    className={`group/card bg-white rounded-2xl border transition-all p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-[#8C102A]/50 hover:shadow-md ${
                      isSoldOut ? 'opacity-90 border-red-200' : isOrdered ? 'border-emerald-600/50 ring-2 ring-emerald-500/20' : 'border-[#E8DFC8]'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectItem(scoop);
                      }
                    }}
                  >
                    <div>
                      {/* Scoop Image & Badges */}
                      <div className="relative w-full h-44 rounded-xl overflow-hidden bg-[#FAF7F2] mb-3 group">
                        <img
                          src={scoop.image}
                          alt={scoop.name}
                          className={`w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300 ${
                            isSoldOut ? 'grayscale-[30%] opacity-85' : ''
                          }`}
                          loading="lazy"
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
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                          {isSoldOut ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-600 text-white shadow-md flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Sold Out</span>
                            </span>
                          ) : scoop.isIconic ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#8C102A] text-white shadow-md">
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

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/95 text-[#241A18] backdrop-blur-xs">
                            {scoop.category.replace('-', ' ')}
                          </span>
                        </div>

                        {/* Name on image with subtle details indicator */}
                        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                          <h4 className="font-serif-title text-base sm:text-lg font-bold drop-shadow-sm leading-snug">
                            {scoop.name}
                          </h4>
                          <span className="text-[10px] opacity-75 group-hover/card:opacity-100 group-hover/card:translate-x-0.5 transition-all text-amber-200">
                            Details ↗
                          </span>
                        </div>
                      </div>

                      {/* Tagline & Description */}
                      <p className="text-xs text-[#8C102A] font-semibold line-clamp-1 mb-1">
                        {scoop.tagline}
                      </p>
                      <p className="text-xs text-[#5C4D44] line-clamp-2 leading-relaxed mb-2.5">
                        {scoop.description}
                      </p>

                      {/* Tasting Notes */}
                      <div className="flex flex-wrap gap-1 mb-2.5">
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

                    {/* Direct Serving Type Selection (Cone / Cup) & Actions */}
                    <div className="pt-2.5 border-t border-[#F0E8DC] space-y-2">
                      {/* Select the Serving Type directly on card */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#6B574B]">
                          <span>Select Type:</span>
                          <span className="text-[10px] text-[#8C102A] font-semibold">
                            {isSoldOut ? 'Unavailable' : isBiscuitSelected ? 'Biscuit Cup' : 'Waffle Cone'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          {/* 1. Crisp Waffle Cone Type */}
                          <button
                            type="button"
                            disabled={isSoldOut}
                            onClick={(e) => handleToggleFormat(scoop.id, 'waffle-cone', e)}
                            className={`p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              isSoldOut
                                ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                                : isWaffleSelected
                                ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs ring-2 ring-[#8C102A]/25 cursor-pointer'
                                : 'bg-[#FAF7F2] hover:bg-[#F3EDE3] text-[#241A18] border-[#E0D5C3] cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold mb-0.5">
                              <span>🍦 Waffle Cone</span>
                              {isWaffleSelected && !isSoldOut && <Check className="w-3 h-3 text-amber-200" />}
                            </div>
                            <div className="text-[11px] font-black">
                              {formatPrice(scoop.conePriceLKR, currency)}
                            </div>
                          </button>

                          {/* 2. Edible Biscuit Cup Type */}
                          <button
                            type="button"
                            disabled={isSoldOut}
                            onClick={(e) => handleToggleFormat(scoop.id, 'biscuit-cup', e)}
                            className={`p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              isSoldOut
                                ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                                : isBiscuitSelected
                                ? 'bg-amber-700 text-white border-amber-800 shadow-xs ring-2 ring-amber-600/35 cursor-pointer'
                                : 'bg-amber-50/70 hover:bg-amber-100/80 text-[#8C102A] border-amber-200 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold mb-0.5">
                              <span className="flex items-center gap-0.5">
                                <Cookie className="w-3 h-3 text-amber-500" />
                                <span>Biscuit Cup</span>
                              </span>
                              {isBiscuitSelected && !isSoldOut && <Check className="w-3 h-3 text-amber-200" />}
                            </div>
                            <div className="text-[11px] font-black">
                              {formatPrice(scoop.biscuitCupPriceLKR, currency)}
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Card Action Buttons: Details Button & Add to Tray */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 pt-1"
                      >
                        {/* Details Button (Opens Clean Modal) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(scoop);
                          }}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-[#F3EDE3] text-[#241A18] text-xs font-bold border border-[#D9CBB7] transition-colors cursor-pointer shrink-0 shadow-2xs"
                        >
                          Details
                        </button>

                        {/* Order Button / Cancel Button / Sold Out */}
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
                          <div className="flex-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleCancelFromTray}
                              className="group/traybtn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-red-600 text-white active:scale-95"
                              title="Click to cancel from tray"
                            >
                              <span className="flex items-center justify-center gap-1.5 group-hover/traybtn:hidden">
                                <Check className="w-3.5 h-3.5 text-emerald-200" />
                                <span>In Tray{scoopTotalQty > 0 ? ` (${scoopTotalQty})` : ''}</span>
                              </span>
                              <span className="hidden group-hover/traybtn:flex items-center justify-center gap-1.5 text-white">
                                <X className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={handleOrderDirect}
                              className="px-2.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                              title="Add another to tray"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOrderDirect}
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

        {/* BARISTA COFFEE SECTION */}
        {filteredCoffee.length > 0 && (
          <div className="space-y-3 pt-3">
            {(activeTab === 'all' || activeTab === 'coffee') && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-base sm:text-lg font-bold font-serif-title text-[#241A18] flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-[#8C102A]" />
                  <span>Special Coffee ({filteredCoffee.length})</span>
                </span>
                <div className="h-px bg-[#E8DFC8] flex-1" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredCoffee.map((coffee) => {
                const isSoldOut = coffee.isAvailable === false;
                const inTray = trayItemMap[coffee.id];
                const isOrdered = !!inTray;

                return (
                  <div
                    key={coffee.id}
                    onClick={() => onSelectItem(coffee)}
                    className={`group/card bg-white rounded-2xl border transition-all p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-[#8C102A]/50 hover:shadow-md ${
                      isSoldOut ? 'opacity-90 border-red-200' : isOrdered ? 'border-emerald-600/50 ring-2 ring-emerald-500/20' : 'border-[#E8DFC8]'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectItem(coffee);
                      }
                    }}
                  >
                    <div>
                      {/* Big Picture & Badges */}
                      <div className="relative w-full h-44 rounded-xl overflow-hidden bg-[#FAF7F2] mb-3 group">
                        <img
                          src={coffee.image}
                          alt={coffee.name}
                          className={`w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300 ${
                            isSoldOut ? 'grayscale-[30%] opacity-85' : ''
                          }`}
                          loading="lazy"
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
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                          {isSoldOut ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-md flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Sold Out</span>
                            </span>
                          ) : coffee.popular ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white shadow-xs">
                              Barista Special
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/95 text-[#241A18] backdrop-blur-xs">
                            {coffee.portionOrTemp || 'Hot & Iced'}
                          </span>
                        </div>

                        {/* Name on image with details indicator */}
                        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                          <h4 className="font-serif-title text-base sm:text-lg font-bold drop-shadow-sm leading-snug">
                            {coffee.name}
                          </h4>
                          <span className="text-[10px] opacity-75 group-hover/card:opacity-100 group-hover/card:translate-x-0.5 transition-all text-amber-200">
                            Details ↗
                          </span>
                        </div>
                      </div>

                      {/* Tagline / Subtitle */}
                      <p className="text-xs text-[#8C102A] font-semibold line-clamp-1 mb-1">
                        Central Highlands Single-Origin
                      </p>

                      {/* Description */}
                      <p className="text-xs text-[#5C4D44] line-clamp-2 leading-relaxed mb-2.5">
                        {coffee.description}
                      </p>

                      {/* Tags */}
                      {coffee.tags && coffee.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2.5">
                          {coffee.tags.slice(0, 3).map((tag) => (
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

                    {/* Card Actions: Price, Details & Order Button */}
                    <div className="pt-2.5 border-t border-[#F0E8DC] space-y-2">
                      {/* Price Display */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E0D5C3]"
                      >
                        <span className="text-xs font-bold text-[#6B574B]">Serving Price</span>
                        <span className="font-extrabold text-sm text-[#8C102A]">
                          {formatPrice(coffee.priceLKR, currency)}
                        </span>
                      </div>

                      {/* Card Action Buttons */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 pt-1"
                      >
                        {/* Details Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(coffee);
                          }}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-[#F3EDE3] text-[#241A18] text-xs font-bold border border-[#D9CBB7] transition-colors cursor-pointer shrink-0 shadow-2xs"
                        >
                          Details
                        </button>

                        {/* Order Button / Cancel Button / Sold Out */}
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
                          <div className="flex-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromTray && onRemoveFromTray(coffee.id);
                              }}
                              className="group/traybtn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-red-600 text-white active:scale-95"
                              title="Click to cancel from tray"
                            >
                              <span className="flex items-center justify-center gap-1.5 group-hover/traybtn:hidden">
                                <Check className="w-3.5 h-3.5 text-emerald-200" />
                                <span>In Tray{inTray ? ` (${inTray.totalQty})` : ''}</span>
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
                              className="px-2.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
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

        {/* GOURMET CAKES SECTION */}
        {filteredCakes.length > 0 && (
          <div className="space-y-3 pt-3">
            {(activeTab === 'all' || activeTab === 'cakes') && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-base sm:text-lg font-bold font-serif-title text-[#241A18] flex items-center gap-2">
                  <Cake className="w-5 h-5 text-[#8C102A]" />
                  <span>And Cakes ({filteredCakes.length})</span>
                </span>
                <div className="h-px bg-[#E8DFC8] flex-1" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredCakes.map((cake) => {
                const isSoldOut = cake.isAvailable === false;
                const inTray = trayItemMap[cake.id];
                const isOrdered = !!inTray;

                return (
                  <div
                    key={cake.id}
                    onClick={() => onSelectItem(cake)}
                    className={`group/card bg-white rounded-2xl border transition-all p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-[#8C102A]/50 hover:shadow-md ${
                      isSoldOut ? 'opacity-90 border-red-200' : isOrdered ? 'border-emerald-600/50 ring-2 ring-emerald-500/20' : 'border-[#E8DFC8]'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectItem(cake);
                      }
                    }}
                  >
                    <div>
                      {/* Big Picture & Badges */}
                      <div className="relative w-full h-44 rounded-xl overflow-hidden bg-[#FAF7F2] mb-3 group">
                        <img
                          src={cake.image}
                          alt={cake.name}
                          className={`w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300 ${
                            isSoldOut ? 'grayscale-[30%] opacity-85' : ''
                          }`}
                          loading="lazy"
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
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                          {isSoldOut ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-md flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Sold Out</span>
                            </span>
                          ) : cake.popular ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#8C102A] text-white shadow-xs">
                              Bakery Bestseller
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/95 text-[#241A18] backdrop-blur-xs">
                            {cake.portionOrTemp || 'Artisan Slice'}
                          </span>
                        </div>

                        {/* Name on image with details indicator */}
                        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                          <h4 className="font-serif-title text-base sm:text-lg font-bold drop-shadow-sm leading-snug">
                            {cake.name}
                          </h4>
                          <span className="text-[10px] opacity-75 group-hover/card:opacity-100 group-hover/card:translate-x-0.5 transition-all text-amber-200">
                            Details ↗
                          </span>
                        </div>
                      </div>

                      {/* Tagline / Subtitle */}
                      <p className="text-xs text-[#8C102A] font-semibold line-clamp-1 mb-1">
                        Baked Fresh Daily in Akurana
                      </p>

                      {/* Description */}
                      <p className="text-xs text-[#5C4D44] line-clamp-2 leading-relaxed mb-2.5">
                        {cake.description}
                      </p>

                      {/* Tags */}
                      {cake.tags && cake.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2.5">
                          {cake.tags.slice(0, 3).map((tag) => (
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

                    {/* Card Actions: Price, Details & Order Button */}
                    <div className="pt-2.5 border-t border-[#F0E8DC] space-y-2">
                      {/* Price Display */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E0D5C3]"
                      >
                        <span className="text-xs font-bold text-[#6B574B]">Serving Price</span>
                        <span className="font-extrabold text-sm text-[#8C102A]">
                          {formatPrice(cake.priceLKR, currency)}
                        </span>
                      </div>

                      {/* Card Action Buttons */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 pt-1"
                      >
                        {/* Details Button */}
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

                        {/* Order Button / Cancel Button / Sold Out */}
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
                          <div className="flex-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromTray && onRemoveFromTray(cake.id);
                              }}
                              className="group/traybtn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-red-600 text-white active:scale-95"
                              title="Click to cancel from tray"
                            >
                              <span className="flex items-center justify-center gap-1.5 group-hover/traybtn:hidden">
                                <Check className="w-3.5 h-3.5 text-emerald-200" />
                                <span>In Tray{inTray ? ` (${inTray.totalQty})` : ''}</span>
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
                              className="px-2.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
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

        {/* Empty State */}
        {totalResults === 0 && (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-[#E8DFC8] my-6">
            <span className="text-4xl block mb-3">🍨</span>
            <h3 className="text-base font-bold text-[#241A18]">No items matched your search</h3>
            <p className="text-xs text-[#7A6458] mt-1.5 max-w-sm mx-auto">
              Try searching "Durian", "Mango", "Pistachio", or reset your search to explore all items.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
              className="mt-4 px-5 py-2.5 rounded-xl bg-[#8C102A] text-white font-bold text-xs cursor-pointer shadow-xs"
            >
              Reset Search & Show All items
            </button>
          </div>
        )}
      </main>

      {/* Sticky Bottom Order Bar (Floating button only - no background container) */}
      {itemCount > 0 && (
        <div className="fixed bottom-3 sm:bottom-4 left-0 right-0 z-40 px-3.5 sm:px-6 pointer-events-none animate-pop-slide-up">
          <div className="max-w-xl mx-auto pointer-events-auto">
            <button
              onClick={onOpenTray}
              className="w-full bg-gradient-to-r from-[#8C102A] via-[#9B1230] to-[#8C102A] text-white rounded-xl sm:rounded-2xl py-2 px-3 sm:py-2.5 sm:px-4 shadow-xl shadow-[#8C102A]/35 border border-amber-300/40 flex items-center justify-between active:scale-[0.99] transition-all cursor-pointer ring-2 ring-[#8C102A]/20"
              aria-label="View Tray and Checkout"
            >
              {/* Left Side: Badge + Label */}
              <div className="flex items-center gap-2.5 text-left min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-400 text-[#8C102A] flex items-center justify-center font-black shadow-xs shrink-0">
                  <div className="relative flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-[#8C102A]" />
                    <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-[#8C102A] text-amber-300 text-[8px] font-black flex items-center justify-center border border-amber-400">
                      {itemCount}
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs sm:text-sm text-white truncate">
                      View Order Tray
                    </span>
                    <span className="hidden xs:inline-block bg-amber-400/20 text-amber-200 text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-amber-400/30">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-100/90 truncate">
                    Ready for pickup / delivery at {branchInfo.name}
                  </p>
                </div>
              </div>

              {/* Right Side: Total Price & Checkout Action Pill */}
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-wider text-amber-200/90 font-semibold block leading-none mb-0.5">
                    Total
                  </span>
                  <span className="text-xs sm:text-sm font-black text-white">
                    {formatPrice(totalLKR, currency)}
                  </span>
                </div>
                <div className="bg-white text-[#8C102A] px-2.5 py-1.5 rounded-lg font-black text-xs flex items-center gap-1 shadow-xs hover:bg-amber-100 transition-colors">
                  <span>Checkout</span>
                  <span className="text-xs">→</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
