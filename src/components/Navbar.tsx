import React, { useState, useEffect } from 'react';
import { AmoreLogo } from './AmoreLogo';
import { Currency, BranchId, SelectedOrderItem } from '../types';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import { CurrencyToggle } from './CurrencyToggle';
import { Menu, X, MapPin, Phone, ShoppingBag } from 'lucide-react';

interface NavbarProps {
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  selectedBranch: BranchId;
  onSelectBranch: (b: BranchId) => void;
  orderItems: SelectedOrderItem[];
  onOpenOrderModal: () => void;
  onNavigateToMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currency,
  onToggleCurrency,
  selectedBranch,
  onSelectBranch,
  orderItems,
  onOpenOrderModal,
  onNavigateToMenu,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentBranch = AMORE_BRANCHES.find((b) => b.id === selectedBranch) || AMORE_BRANCHES[0];
  const itemCount = orderItems.reduce((sum, it) => sum + it.quantity, 0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Full Menu', href: '#full-menu' },
    { label: 'Meet Legend', href: '#durian-spotlight' },
    { label: 'Edible Biscuit Cups', href: '#biscuit-cups' },
    { label: 'Our Branches', href: '#our-branches' },
  ];

  return (
    <header
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#FAF7F2]/95 backdrop-blur-md shadow-sm border-b border-[#E8DFC8] py-2.5 text-[#241A18]'
          : 'bg-[#FAF7F2]/90 backdrop-blur-sm py-3 text-[#241A18]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top micro bar with locations tag & currency info */}
        <div className="hidden lg:flex items-center justify-between text-xs text-[#7A6458] pb-2 border-b border-[#E8DFC8] mb-2">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#8C102A]">
              <MapPin className="w-3.5 h-3.5" />
              <span>Locations in Sri Lanka:</span>
            </span>
            <span className="text-[#524239] font-medium">
              Akurana (Flagship) &bull; Colombo &bull; Arugam Bay
            </span>
          </div>

          <div className="flex items-center gap-2">
            <CurrencyToggle currency={currency} onToggle={onToggleCurrency} />
            <a
              href={`tel:${currentBranch.phone}`}
              className="inline-flex items-center gap-1 hover:text-[#8C102A] transition-colors text-[#5D4E46] font-semibold ml-2"
            >
              <Phone className="w-3 h-3 text-[#8C102A]" />
              <span>{currentBranch.phone}</span>
            </a>
          </div>
        </div>

        {/* Main Navbar row */}
        <div className="flex items-center justify-between">
          {/* Logo & Brand Name */}
          <a href="#" className="flex items-center gap-2.5 sm:gap-3 group">
            <AmoreLogo size="md" />
            <div className="flex flex-col">
              <span className="font-serif-title text-xl sm:text-2xl font-bold tracking-tight text-[#241A18] group-hover:text-[#8C102A] transition-colors">
                Amore
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#8A7970] font-medium -mt-1">
                Speciality Ice Cream, Coffee & Cakes
              </span>
            </div>
          </a>

          {/* Center Navigation links */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => {
              const isFullMenu = link.label === 'Full Menu';
              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    if (isFullMenu && onNavigateToMenu) {
                      e.preventDefault();
                      onNavigateToMenu();
                    }
                  }}
                  className="text-sm font-semibold text-[#4D3E36] hover:text-[#8C102A] transition-colors relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-[#8C102A] hover:after:w-full after:transition-all after:duration-200 cursor-pointer"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Currency toggle on tablet / medium screens */}
            <div className="hidden sm:inline-flex lg:hidden">
              <CurrencyToggle currency={currency} onToggle={onToggleCurrency} variant="compact" />
            </div>

            {/* Currency toggle on mobile view (replacing tray button on screens < sm) */}
            <div className="sm:hidden flex items-center">
              <CurrencyToggle currency={currency} onToggle={onToggleCurrency} />
            </div>

            {/* Your Tray Button with Badge (shown on sm+ screens; on mobile replaced by Currency Toggle) */}
            <button
              id="nav-tray-btn"
              onClick={onOpenOrderModal}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold rounded-full bg-[#8C102A] text-white hover:bg-[#A31634] transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer active:scale-95"
            >
              <ShoppingBag className="w-4 h-4 text-amber-200" />
              <span>Your Tray</span>
              {itemCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-300 text-[#8C102A] text-[11px] font-black flex items-center justify-center shadow-xs">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Mobile Hamburger button on small screens */}
            <div className="lg:hidden flex items-center">
              <button
                id="nav-mobile-toggle-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-[#241A18] hover:bg-[#EAE0D0] transition-colors cursor-pointer"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 pb-4 border-t border-[#E8DFC8] flex flex-col gap-3 animate-fadeIn bg-[#FAF7F2]">
            {/* Currency Switcher in Mobile Drawer */}
            <div className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-[#E8DFC8]">
              <span className="text-xs font-bold text-[#3D2C24]">Display Currency:</span>
              <CurrencyToggle currency={currency} onToggle={onToggleCurrency} />
            </div>

            {/* 3 Branches Info in Mobile Drawer */}
            <div className="px-3 py-2 bg-white rounded-xl border border-[#E8DFC8]">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8C102A] uppercase tracking-wider mb-1">
                <MapPin className="w-3 h-3 text-[#8C102A]" />
                <span>Locations in Sri Lanka:</span>
              </div>
              <p className="text-xs font-semibold text-[#3D2C24]">
                Akurana (Flagship) &bull; Colombo &bull; Arugam Bay
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isFullMenu = link.label === 'Full Menu';
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => {
                      setMobileMenuOpen(false);
                      if (isFullMenu && onNavigateToMenu) {
                        e.preventDefault();
                        onNavigateToMenu();
                      }
                    }}
                    className="px-3 py-2 text-base font-semibold text-[#3D2C24] hover:bg-[#EFE8DC] rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>{link.label}</span>
                    {isFullMenu && (
                      <span className="text-[11px] font-bold bg-[#8C102A] text-white px-2 py-0.5 rounded-full">
                        20 Flavours
                      </span>
                    )}
                  </a>
                );
              })}

              {/* Your Tray in Mobile Drawer */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenOrderModal();
                }}
                className="mt-2 w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#8C102A] text-white font-bold text-sm shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-200" />
                  <span>View Your Tray</span>
                </div>
                {itemCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-300 text-[#8C102A] text-xs font-black">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                ) : (
                  <span className="text-xs text-amber-200/80 font-normal">Empty</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
