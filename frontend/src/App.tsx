/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { DurianSpecialSpotlight } from './components/DurianSpecialSpotlight';
import { EdibleBiscuitCupSpotlight } from './components/EdibleBiscuitCupSpotlight';
import { BranchShowcase } from './components/BranchShowcase';
import { ParlourExperience } from './components/ParlourExperience';
import { Footer } from './components/Footer';
import { forgetThisDevice, hasAdminSession, lockConsole, signOutAdmin, useAdminGate } from './utils/adminAuth';
import { AmoreLogo } from './components/AmoreLogo';
import { OverflowRibbon } from './components/BrandFlourish';
import { Reveal } from './components/Reveal';
import { useCurrentUser } from './customerAuth';
import { Currency, BranchId, ScoopItem, MenuItem, SelectedOrderItem, ServingFormat, MenuTab } from './types';
import { useIsMobile } from './components/mobile/mobileHooks';
import { ALL_20_FLAVOURS } from './data/iceCreamData';
import { formatPrice } from './utils/currency';
import { ShoppingBag } from 'lucide-react';
import { getUserOrdersList, ORDERS_UPDATED_EVENT } from './utils/orderStorage';
import { SYNC_ERROR_EVENT } from './utils/outbox';
import { useCustomerBranch } from './utils/stock';
import {
  getAllGelatoFlavours,
  syncMenuFromServer,
  subscribeToRealtimeMenu,
} from './utils/menuStorage';
import { scoopPhoto } from './utils/menuPhotos';
import { forBranch } from './utils/branchMenu';

// Screens and popups that aren't needed for the first paint are split out so the
// storefront loads faster. The menu chunk is prefetched once the home page is idle.
const loadMenuPage = () => import('./components/MenuOrderingPage');
const MenuOrderingPage = lazy(() => loadMenuPage().then((m) => ({ default: m.MenuOrderingPage })));
const ProductDetailModal = lazy(() =>
  import('./components/ProductDetailModal').then((m) => ({ default: m.ProductDetailModal }))
);
const QuickOrderModal = lazy(() =>
  import('./components/QuickOrderModal').then((m) => ({ default: m.QuickOrderModal }))
);
const SignInModal = lazy(() =>
  import('./components/SignInModal').then((m) => ({ default: m.SignInModal }))
);
const YourOrdersModal = lazy(() =>
  import('./components/YourOrdersModal').then((m) => ({ default: m.YourOrdersModal }))
);
const MobileShell = lazy(() =>
  import('./components/mobile/MobileShell').then((m) => ({ default: m.MobileShell }))
);
const OrderConfirmationPage = lazy(() =>
  import('./components/OrderConfirmationPage').then((m) => ({ default: m.OrderConfirmationPage }))
);
const AdminLogin = lazy(() =>
  import('./components/admin/AdminLogin').then((m) => ({ default: m.AdminLogin }))
);
const AdminDashboard = lazy(() =>
  import('./components/admin/console/OperationsConsole').then((m) => ({ default: m.OperationsConsole }))
);

// Matches the logo splash in index.html so loading feels like one continuous screen
const PageLoader = () => (
  <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center gap-4" aria-label="Loading">
    <AmoreLogo size="xl" className="logo-breathe" />
    <span className="loader-bar" />
  </div>
);

// /admin: the sign-in (name + password, user code, or owner Google) in front of the console
const AdminArea: React.FC<{
  onBackToStore: () => void;
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
}> = ({ onBackToStore, currency, onToggleCurrency }) => {
  const { gate, admin, deviceName } = useAdminGate();
  if (gate === 'checking') return <PageLoader />;
  const codeOnThisDevice = deviceName !== null;
  return (
    <Suspense fallback={<PageLoader />}>
      {gate === 'open' && admin ? (
        <AdminDashboard
          admin={admin}
          // "Lock" (only with a user code) closes the console until the code is entered again.
          // "Sign out" is a full sign-out: this device also forgets its code.
          onLock={codeOnThisDevice ? lockConsole : undefined}
          onSignOut={async () => {
            if (codeOnThisDevice) await forgetThisDevice();
            signOutAdmin();
            onBackToStore();
          }}
          onBackToStore={onBackToStore}
          currency={currency}
          onToggleCurrency={onToggleCurrency}
        />
      ) : (
        <AdminLogin gate={gate === 'open' ? 'checking' : gate} deviceName={deviceName} onBackToStore={onBackToStore} />
      )}
    </Suspense>
  );
};

// /admin (or the old ?tab=returns style links) is the console; ?page=menu is the menu
function pageFromLocation(): 'home' | 'menu' | 'admin' {
  const path = window.location.pathname.replace(/\/+$/, '');
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') || params.get('section');
  if (path === '/admin' || params.get('page') === 'admin') return 'admin';
  if (tab === 'returns' || tab === 'orders' || tab === 'history' || tab === 'order-history') return 'admin';
  if (params.get('page') === 'menu') return 'menu';
  return 'home';
}

export default function App() {
  // Global State
  const isMobile = useIsMobile();
  const [menuTab, setMenuTab] = useState<MenuTab>('all');
  const [currency, setCurrency] = useState<Currency>('LKR');
  // Shared with the sold-out checks, which show stock for this branch
  const [selectedBranch, setSelectedBranch] = useCustomerBranch();

  // Product Detail Modal
  const [detailItem, setDetailItem] = useState<ScoopItem | MenuItem | null>(null);

  // Order Cart & Order Modal
  const [orderItems, setOrderItems] = useState<SelectedOrderItem[]>([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [menuResetKey, setMenuResetKey] = useState(0);

  // Ongoing Orders Modal State
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [highlightOrderRef, setHighlightOrderRef] = useState<string | null>(null);

  // Authentication State & Sign-In Modal
  const currentUser = useCurrentUser();
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);

  // Warm up the menu page in the background so "View Full Menu" opens instantly
  useEffect(() => {
    if (isMobile) return; // phones use the mobile menu, which loads with the mobile layout
    const timer = window.setTimeout(() => {
      loadMenuPage().catch(() => {});
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [isMobile]);

  // Initial real-time menu sync across cloud and tabs
  useEffect(() => {
    syncMenuFromServer();
    const unsubscribe = subscribeToRealtimeMenu(() => {});
    return () => unsubscribe();
  }, []);

  // Listen for order updates in real-time so ongoingOrdersCount updates dynamically everywhere
  const [ordersSyncTrigger, setOrdersSyncTrigger] = useState(0);

  useEffect(() => {
    const handleOrdersSync = () => {
      setOrdersSyncTrigger((prev) => prev + 1);
    };
    window.addEventListener(ORDERS_UPDATED_EVENT, handleOrdersSync);
    window.addEventListener('storage', handleOrdersSync);
    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, handleOrdersSync);
      window.removeEventListener('storage', handleOrdersSync);
    };
  }, []);

  // Compute active ongoing orders (orders placed, confirmed, or in kitchen - excluding cancelled & delivered)
  const userOrders = getUserOrdersList(currentUser?.uid);
  const ongoingOrdersCount = userOrders.filter(
    (o) => o.status !== 'cancelled' && o.status !== 'delivered'
  ).length;

  // Shows the console link in the navbar; the backend checks the session on every request
  const isAdminLoggedIn = hasAdminSession();

  // Which page the URL points at: /admin is the console, ?page=menu the full menu
  const [currentPage, setCurrentPage] = useState<'home' | 'menu' | 'admin'>(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('page') === 'admin') {
      // Old ?page=admin links → /admin
      url.searchParams.delete('page');
      url.pathname = '/admin';
      window.history.replaceState({}, '', url.toString());
    }
    return pageFromLocation();
  });

  // Dedicated Order Confirmation Portal Router (reads ?confirmOrder=...)
  const [confirmOrderRef, setConfirmOrderRef] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('confirmOrder');
  });

  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search);
      setConfirmOrderRef(params.get('confirmOrder'));
      setCurrentPage(pageFromLocation());
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // A customer's change the server refused (e.g. cancelling after the parlour confirmed):
  // the order is shown as it really is again, so say why. The console shows its own notices.
  useEffect(() => {
    if (currentPage === 'admin') return;
    const onSyncError = (e: Event) => window.alert((e as CustomEvent<{ message: string }>).detail.message);
    window.addEventListener(SYNC_ERROR_EVENT, onSyncError);
    return () => window.removeEventListener(SYNC_ERROR_EVENT, onSyncError);
  }, [currentPage]);

  const handleNavigateToMenu = () => {
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.set('page', 'menu');
    window.history.pushState({}, '', url.toString());
    setCurrentPage('menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setCurrentPage('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToHome = () => {
    const url = new URL(window.location.href);
    url.pathname = '/';
    ['page', 'tab', 'section'].forEach((k) => url.searchParams.delete(k));
    window.history.pushState({}, '', url.toString());
    setCurrentPage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreMenu = () => {
    handleNavigateToMenu();
  };

  const handleOpenConfirmationPage = (orderRef: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('confirmOrder', orderRef);
    window.history.pushState({}, '', url.toString());
    setConfirmOrderRef(orderRef);
  };

  const handleBackFromConfirmation = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('confirmOrder');
    url.searchParams.delete('d');
    window.history.pushState({}, '', url.toString());
    setConfirmOrderRef(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll helpers & navigation
  const scrollToMenu = () => {
    handleNavigateToMenu();
  };

  const scrollToBranches = () => {
    const el = document.getElementById('our-branches');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToBiscuitCups = () => {
    const el = document.getElementById('biscuit-cups');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Add Item to Order Cart
  const handleAddItemToOrder = (item: SelectedOrderItem, openOrderModal: boolean = false) => {
    setOrderItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.itemId === item.itemId && (i.format || '') === (item.format || '')
      );
      if (existingIdx > -1) {
        return prev.map((orderItem, idx) =>
          idx === existingIdx
            ? { ...orderItem, quantity: orderItem.quantity + (item.quantity || 1) }
            : orderItem
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
    if (openOrderModal) {
      setDetailItem(null);
      setIsOrderModalOpen(true);
    }
  };

  // Direct 1-Click Order from Menu Card (Supports multiple formats like Waffle Cone & Biscuit Cup)
  const handleDirectOrder = (item: ScoopItem | MenuItem, formats?: ServingFormat[]) => {
    const isScoop = 'tastingNotes' in item;
    const scoop = isScoop ? (item as ScoopItem) : null;
    const menuItem = !isScoop ? (item as MenuItem) : null;

    if (isScoop && scoop) {
      // Always add strictly ONE item to the tray per action
      const chosenFormat: ServingFormat =
        formats && formats.length > 0 ? formats[0] : 'waffle-cone';
      const isCup = chosenFormat === 'biscuit-cup' || chosenFormat === 'double-biscuit-cup';
      const price = isCup ? scoop.biscuitCupPriceLKR : scoop.conePriceLKR;
      const newOrderItem: SelectedOrderItem = {
        itemId: scoop.id,
        name: scoop.name,
        category: 'scoops',
        format: chosenFormat,
        priceLKR: price,
        quantity: 1,
        image: scoopPhoto(scoop, chosenFormat),
      };
      handleAddItemToOrder(newOrderItem, false);
      return;
    }

    const newOrderItem: SelectedOrderItem = {
      itemId: item.id,
      name: item.name,
      category: (item as MenuItem).category,
      priceLKR: menuItem?.priceLKR ?? 650,
      quantity: 1,
      image: item.image,
    };

    handleAddItemToOrder(newOrderItem, false);
  };

  // Quick Order Durian Scoop
  const handleOrderDurian = () => {
    const scoops = getAllGelatoFlavours();
    const durian = forBranch(scoops.find((f) => f.id === 'durian-best') || scoops[0], selectedBranch);
    const newOrderItem: SelectedOrderItem = {
      itemId: durian.id,
      name: durian.name,
      category: 'scoops',
      format: 'biscuit-cup',
      priceLKR: durian.biscuitCupPriceLKR,
      quantity: 1,
      image: durian.image,
    };
    handleAddItemToOrder(newOrderItem, true);
  };

  // Order specifically for a branch
  const handleOrderForBranch = (branchId: BranchId) => {
    setSelectedBranch(branchId);
    if (orderItems.length === 0) {
      // If empty tray, pre-add the iconic Durian in Biscuit Cup
      const scoops = getAllGelatoFlavours();
      const durian = forBranch(scoops.find((f) => f.id === 'durian-best') || scoops[0], branchId);
      setOrderItems([
        {
          itemId: durian.id,
          name: durian.name,
          category: 'scoops',
          format: 'biscuit-cup',
          priceLKR: durian.biscuitCupPriceLKR,
          quantity: 1,
          image: durian.image,
        },
      ]);
    }
    setIsOrderModalOpen(true);
  };

  const handleRemoveOrderItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Remove a product or specific serving formats from the tray
  const handleRemoveProductFromTray = (itemId: string, formats?: ServingFormat[]) => {
    setOrderItems((prev) =>
      prev.filter((it) => {
        if (it.itemId !== itemId) return true;
        if (formats && formats.length > 0) {
          return !formats.includes(it.format as ServingFormat);
        }
        return false;
      })
    );
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    setOrderItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, quantity: newQty } : it))
    );
  };

  const handleClearOrder = () => {
    setOrderItems([]);
    setMenuResetKey((prev) => prev + 1);
  };

  // If user clicked/opened an order confirmation link (e.g. ?confirmOrder=AMO-XXXX),
  // render the dedicated, separate Order Confirmation UI!
  if (confirmOrderRef) {
    return (
      <Suspense fallback={<PageLoader />}>
        <OrderConfirmationPage
          orderReference={confirmOrderRef}
          currency={currency}
          onToggleCurrency={setCurrency}
          onBackToHome={handleBackFromConfirmation}
        />
      </Suspense>
    );
  }

  // Amore Operations & Admin Console (/admin)
  if (currentPage === 'admin') {
    return <AdminArea onBackToStore={handleNavigateToHome} currency={currency} onToggleCurrency={setCurrency} />;
  }

  // Phones get their own customer layout (bottom tabs, compact menu, bottom sheets).
  // Desktop and the admin console keep the layouts below.
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#241A18] font-sans">
        <Suspense fallback={<PageLoader />}>
          <MobileShell
            page={currentPage === 'menu' ? 'menu' : 'home'}
            menuTab={menuTab}
            currency={currency}
            onToggleCurrency={setCurrency}
            selectedBranch={selectedBranch}
            onSelectBranch={setSelectedBranch}
            orderItems={orderItems}
            ordersCount={ongoingOrdersCount}
            currentUser={currentUser}
            onAddToTray={(item) => handleAddItemToOrder(item, false)}
            onGoHome={handleNavigateToHome}
            onGoMenu={(tab = 'all') => {
              setMenuTab(tab);
              handleNavigateToMenu();
            }}
            onOpenTray={() => setIsOrderModalOpen(true)}
            onOpenOrders={() => (currentUser ? setIsOrdersModalOpen(true) : setIsSignInModalOpen(true))}
            onOpenAccount={() => setIsSignInModalOpen(true)}
          />
        </Suspense>

        {isOrderModalOpen && (
          <Suspense fallback={null}>
            <QuickOrderModal
              isOpen={isOrderModalOpen}
              onClose={() => setIsOrderModalOpen(false)}
              items={orderItems}
              onRemoveItem={handleRemoveOrderItem}
              onUpdateQuantity={handleUpdateQuantity}
              currency={currency}
              initialBranch={selectedBranch}
              onClearOrder={handleClearOrder}
              onBrowseMenu={() => {
                setIsOrderModalOpen(false);
                setMenuTab('all');
                handleNavigateToMenu();
              }}
              currentUser={currentUser}
              onOpenSignInModal={() => setIsSignInModalOpen(true)}
              onViewOrderInOrders={(orderRef) => {
                setHighlightOrderRef(orderRef);
                setIsOrdersModalOpen(true);
              }}
            />
          </Suspense>
        )}

        {isSignInModalOpen && (
          <Suspense fallback={null}>
            <SignInModal
              isOpen={isSignInModalOpen}
              onClose={() => setIsSignInModalOpen(false)}
              currentUser={currentUser}
            />
          </Suspense>
        )}

        {isOrdersModalOpen && (
          <Suspense fallback={null}>
            <YourOrdersModal
              isOpen={isOrdersModalOpen}
              onClose={() => {
                setIsOrdersModalOpen(false);
                setHighlightOrderRef(null);
              }}
              currentUser={currentUser}
              currency={currency}
              highlightOrderRef={highlightOrderRef}
              onBrowseMenu={() => {
                setIsOrdersModalOpen(false);
                handleNavigateToMenu();
              }}
            />
          </Suspense>
        )}
      </div>
    );
  }

  // Dedicated Full Menu & Ordering Page (?page=menu)
  if (currentPage === 'menu') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#241A18] selection:bg-[#8C102A] selection:text-white font-sans">
        <Suspense fallback={<PageLoader />}>
        <MenuOrderingPage
          currency={currency}
          onToggleCurrency={setCurrency}
          selectedBranch={selectedBranch}
          onSelectBranch={setSelectedBranch}
          orderItems={orderItems}
          onDirectOrder={handleDirectOrder}
          onRemoveFromTray={handleRemoveProductFromTray}
          onSelectItem={setDetailItem}
          onOpenTray={() => setIsOrderModalOpen(true)}
          onBackToHome={handleNavigateToHome}
          currentUser={currentUser}
          onOpenSignInModal={() => setIsSignInModalOpen(true)}
          onOpenOrdersModal={() => setIsOrdersModalOpen(true)}
          ordersCount={ongoingOrdersCount}
        />

        {/* Product Detail Modal */}
        {detailItem && (
          <ProductDetailModal
            item={detailItem}
            onClose={() => setDetailItem(null)}
            currency={currency}
            onOrderNow={(orderItem, openTray) => handleAddItemToOrder(orderItem, openTray ?? false)}
            onOpenTray={() => setIsOrderModalOpen(true)}
            isAlreadyInTray={orderItems.some((i) => i.itemId === detailItem.id)}
          />
        )}

        {/* Quick Order Modal */}
        {isOrderModalOpen && (
          <QuickOrderModal
            isOpen={isOrderModalOpen}
            onClose={() => setIsOrderModalOpen(false)}
            items={orderItems}
            onRemoveItem={handleRemoveOrderItem}
            onUpdateQuantity={handleUpdateQuantity}
            currency={currency}
            initialBranch={selectedBranch}
            onClearOrder={handleClearOrder}
            onBrowseMenu={() => setIsOrderModalOpen(false)}
            currentUser={currentUser}
            onOpenSignInModal={() => setIsSignInModalOpen(true)}
            onViewOrderInOrders={(orderRef) => {
              setHighlightOrderRef(orderRef);
              setIsOrdersModalOpen(true);
            }}
          />
        )}
        </Suspense>

        {/* Sign In & Account Popup Modal */}
        {isSignInModalOpen && (
          <Suspense fallback={null}>
            <SignInModal
              isOpen={isSignInModalOpen}
              onClose={() => setIsSignInModalOpen(false)}
              currentUser={currentUser}
            />
          </Suspense>
        )}

        {/* Your Orders & Live 2-Minute Grace Period Tracking Modal */}
        {isOrdersModalOpen && (
          <Suspense fallback={null}>
            <YourOrdersModal
              isOpen={isOrdersModalOpen}
              onClose={() => {
                setIsOrdersModalOpen(false);
                setHighlightOrderRef(null);
              }}
              currentUser={currentUser}
              currency={currency}
              highlightOrderRef={highlightOrderRef}
              onBrowseMenu={() => {
                setIsOrdersModalOpen(false);
              }}
            />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#241A18] selection:bg-[#8C102A] selection:text-white flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        currency={currency}
        onToggleCurrency={setCurrency}
        selectedBranch={selectedBranch}
        onSelectBranch={setSelectedBranch}
        orderItems={orderItems}
        onOpenOrderModal={() => setIsOrderModalOpen(true)}
        onNavigateToMenu={handleNavigateToMenu}
        currentUser={currentUser}
        onOpenSignInModal={() => setIsSignInModalOpen(true)}
        onOpenOrdersModal={() => setIsOrdersModalOpen(true)}
        ordersCount={ongoingOrdersCount}
        isAdminLoggedIn={isAdminLoggedIn}
        onNavigateToAdmin={handleNavigateToAdmin}
      />

      <main className="flex-1">
        {/* Hero Section */}
        <Hero
          currency={currency}
          selectedBranch={selectedBranch}
          onExploreMenu={handleExploreMenu}
          onExploreBranches={scrollToBranches}
          onOpenOrder={() => setIsOrderModalOpen(true)}
        />

        {/* Overflowing sauce ribbon; its drips hang over the next section's top padding */}
        <OverflowRibbon className="z-10 -mb-14" />

        {/* The Iconic Durian Spotlight */}
        <Reveal>
          <DurianSpecialSpotlight
            currency={currency}
            onOrderDurian={handleOrderDurian}
            onExploreFullMenu={handleExploreMenu}
          />
        </Reveal>

        {/* Edible Biscuit Cup Feature */}
        <div id="biscuit-cups">
          <Reveal>
            <EdibleBiscuitCupSpotlight
              currency={currency}
              onExploreMenu={handleExploreMenu}
            />
          </Reveal>
        </div>

        {/* Menu Showcase CTA to Open the Dedicated Ordering Page (Full Menu moved to /?page=menu) */}
        <section id="full-menu" className="py-16 md:py-20 bg-[#F5EFE6] border-y border-[#E8DFC8]/80 text-center px-4">
          <Reveal className="max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#E8DFC8] text-[#8C102A] text-xs font-bold uppercase tracking-wider mb-3.5 shadow-2xs">
              🍨 20 Ice Cream Flavours • Barista Coffee • Fresh Cakes
            </span>
            <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[#241A18]">
              Explore Our Complete Artisanal Menu
            </h2>
            <p className="mt-2.5 text-sm sm:text-base text-[#5C4D44] max-w-xl mx-auto leading-relaxed">
              Every scoop is churned in small batches with premium ingredients. Served in crisp waffle cones or eco-friendly edible biscuit cups across all three branches.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleNavigateToMenu}
                className="btn-shimmer px-7 py-3.5 rounded-full bg-[#8C102A] text-white font-bold text-sm hover:bg-[#730D22] active:scale-95 transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center gap-2"
              >
                <span>View Full Menu & Order Now</span>
                <span className="bg-amber-400 text-[#8C102A] text-[10px] font-black px-2 py-0.5 rounded-full">
                  20 Flavours
                </span>
              </button>
            </div>
          </Reveal>
        </section>

        {/* 3 Branches Showcase (Akurana, Colombo, Arugam Bay with Tourist USD features) */}
        <Reveal>
          <BranchShowcase
            selectedBranch={selectedBranch}
            onSelectBranch={setSelectedBranch}
            currency={currency}
            onToggleCurrency={setCurrency}
            onOrderForBranch={handleOrderForBranch}
          />
        </Reveal>

        {/* The Parlour Vibe & Aesthetic Interior */}
        <Reveal>
          <ParlourExperience />
        </Reveal>
      </main>

      {/* Footer */}
      <Footer />

      {/* Product Detail Modal */}
      {detailItem && (
        <Suspense fallback={null}>
          <ProductDetailModal
            item={detailItem}
            onClose={() => setDetailItem(null)}
            currency={currency}
            onOrderNow={(orderItem, openTray) => handleAddItemToOrder(orderItem, openTray ?? false)}
            onOpenTray={() => setIsOrderModalOpen(true)}
            isAlreadyInTray={orderItems.some((i) => i.itemId === detailItem.id)}
          />
        </Suspense>
      )}

      {/* Floating 'Your Tray' Button (Mobile & Desktop) */}
      {orderItems.length > 0 && (
        <button
          id="floating-tray-btn"
          onClick={() => setIsOrderModalOpen(true)}
          className="flex fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 items-center gap-2.5 sm:gap-3 px-4 py-3 sm:px-5 sm:py-3.5 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border border-amber-300/40"
          aria-label="View Your Tray"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-amber-200" />
            <span className="absolute -top-2 -right-2.5 w-5 h-5 rounded-full bg-amber-300 text-[#8C102A] text-[11px] font-black flex items-center justify-center shadow-xs">
              {orderItems.reduce((sum, it) => sum + it.quantity, 0)}
            </span>
          </div>
          <div className="text-left leading-tight pr-1">
            <span className="text-xs font-black block tracking-wider uppercase">Your Tray</span>
            <span className="text-[11px] font-semibold text-amber-200">
              {formatPrice(
                orderItems.reduce((sum, it) => sum + it.priceLKR * it.quantity, 0),
                currency
              )}
            </span>
          </div>
        </button>
      )}

      {/* Quick Order Modal with Easy Mobile Form */}
      {isOrderModalOpen && (
        <Suspense fallback={null}>
          <QuickOrderModal
            isOpen={isOrderModalOpen}
            onClose={() => setIsOrderModalOpen(false)}
            items={orderItems}
            onRemoveItem={handleRemoveOrderItem}
            onUpdateQuantity={handleUpdateQuantity}
            currency={currency}
            initialBranch={selectedBranch}
            onClearOrder={handleClearOrder}
            onBrowseMenu={scrollToMenu}
            currentUser={currentUser}
            onOpenSignInModal={() => setIsSignInModalOpen(true)}
            onViewOrderInOrders={(orderRef) => {
              setHighlightOrderRef(orderRef);
              setIsOrdersModalOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Sign In & Account Popup Modal */}
      {isSignInModalOpen && (
        <Suspense fallback={null}>
          <SignInModal
            isOpen={isSignInModalOpen}
            onClose={() => setIsSignInModalOpen(false)}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {/* Your Orders & Live 2-Minute Grace Period Tracking Modal */}
      {isOrdersModalOpen && (
        <Suspense fallback={null}>
          <YourOrdersModal
            isOpen={isOrdersModalOpen}
            onClose={() => {
              setIsOrdersModalOpen(false);
              setHighlightOrderRef(null);
            }}
            currentUser={currentUser}
            currency={currency}
            highlightOrderRef={highlightOrderRef}
            onBrowseMenu={scrollToMenu}
          />
        </Suspense>
      )}
    </div>
  );
}
