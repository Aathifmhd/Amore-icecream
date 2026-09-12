/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { DurianSpecialSpotlight } from './components/DurianSpecialSpotlight';
import { EdibleBiscuitCupSpotlight } from './components/EdibleBiscuitCupSpotlight';
import { BranchShowcase } from './components/BranchShowcase';
import { ParlourExperience } from './components/ParlourExperience';
import { Footer } from './components/Footer';
import { ProductDetailModal } from './components/ProductDetailModal';
import { QuickOrderModal } from './components/QuickOrderModal';
import { MenuOrderingPage } from './components/MenuOrderingPage';
import { OrderConfirmationPage } from './components/OrderConfirmationPage';
import { SignInModal } from './components/SignInModal';
import { auth, onAuthStateChanged, type User } from './firebase';
import { Currency, BranchId, ScoopItem, MenuItem, SelectedOrderItem, ServingFormat } from './types';
import { ALL_20_FLAVOURS } from './data/iceCreamData';
import { ShoppingBag } from 'lucide-react';
import { formatPrice } from './utils/currency';

export default function App() {
  // Global State
  const [currency, setCurrency] = useState<Currency>('LKR');
  const [selectedBranch, setSelectedBranch] = useState<BranchId>('akurana');

  // Product Detail Modal
  const [detailItem, setDetailItem] = useState<ScoopItem | MenuItem | null>(null);

  // Order Cart & Order Modal
  const [orderItems, setOrderItems] = useState<SelectedOrderItem[]>([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [menuResetKey, setMenuResetKey] = useState(0);

  // Authentication State & Sign-In Modal
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Mobile / Dedicated Page State (reads ?page=menu)
  const [currentPage, setCurrentPage] = useState<'home' | 'menu'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('page') === 'menu' ? 'menu' : 'home';
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
      setCurrentPage(params.get('page') === 'menu' ? 'menu' : 'home');
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const handleNavigateToMenu = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', 'menu');
    window.history.pushState({}, '', url.toString());
    setCurrentPage('menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToHome = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
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
        image: scoop.image,
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
    const durian = ALL_20_FLAVOURS.find((f) => f.id === 'durian-best') || ALL_20_FLAVOURS[0];
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
      const durian = ALL_20_FLAVOURS.find((f) => f.id === 'durian-best') || ALL_20_FLAVOURS[0];
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
      <OrderConfirmationPage
        orderReference={confirmOrderRef}
        currency={currency}
        onToggleCurrency={setCurrency}
        onBackToHome={handleBackFromConfirmation}
      />
    );
  }

  // Dedicated Full Menu & Ordering Page (?page=menu)
  if (currentPage === 'menu') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#241A18] selection:bg-[#8C102A] selection:text-white font-sans">
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
            onOpenConfirmationPage={handleOpenConfirmationPage}
            currentUser={currentUser}
            onOpenSignInModal={() => setIsSignInModalOpen(true)}
          />
        )}

        {/* Sign In & Account Popup Modal */}
        <SignInModal
          isOpen={isSignInModalOpen}
          onClose={() => setIsSignInModalOpen(false)}
          currentUser={currentUser}
        />
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

        {/* The Iconic Durian Spotlight */}
        <DurianSpecialSpotlight
          currency={currency}
          onOrderDurian={handleOrderDurian}
          onExploreFullMenu={handleExploreMenu}
        />

        {/* Edible Biscuit Cup Feature */}
        <div id="biscuit-cups">
          <EdibleBiscuitCupSpotlight
            currency={currency}
            onExploreMenu={handleExploreMenu}
          />
        </div>

        {/* Menu Showcase CTA to Open the Dedicated Ordering Page (Full Menu moved to /?page=menu) */}
        <section id="full-menu" className="py-16 md:py-20 bg-[#F5EFE6] border-y border-[#E8DFC8]/80 text-center px-4">
          <div className="max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#E8DFC8] text-[#8C102A] text-xs font-bold uppercase tracking-wider mb-3.5 shadow-2xs">
              🍨 20 Gelato Flavours • Barista Coffee • Fresh Cakes
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
                className="px-7 py-3.5 rounded-full bg-[#8C102A] text-white font-bold text-sm hover:bg-[#730D22] active:scale-95 transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center gap-2"
              >
                <span>View Full Menu & Order Now</span>
                <span className="bg-amber-400 text-[#8C102A] text-[10px] font-black px-2 py-0.5 rounded-full">
                  20 Flavours
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* 3 Branches Showcase (Akurana, Colombo, Arugam Bay with Tourist USD features) */}
        <BranchShowcase
          selectedBranch={selectedBranch}
          onSelectBranch={setSelectedBranch}
          currency={currency}
          onToggleCurrency={setCurrency}
          onOrderForBranch={handleOrderForBranch}
        />

        {/* The Parlour Vibe & Aesthetic Interior */}
        <ParlourExperience />
      </main>

      {/* Footer */}
      <Footer />

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
          onOpenConfirmationPage={handleOpenConfirmationPage}
          currentUser={currentUser}
          onOpenSignInModal={() => setIsSignInModalOpen(true)}
        />
      )}

      {/* Sign In & Account Popup Modal */}
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
