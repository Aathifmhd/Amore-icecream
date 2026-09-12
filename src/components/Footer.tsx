import React from 'react';
import { AmoreLogo } from './AmoreLogo';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import { Instagram, Phone, MapPin, Heart, ArrowUp, MessageCircle, Coffee, Lock } from 'lucide-react';

interface FooterProps {
  onNavigateToAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateToAdmin }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#F3EDE3] text-[#5D4E46] pt-14 pb-20 md:pb-10 border-t border-[#E2D5C3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-10 border-b border-[#E2D5C3]">
          {/* Brand Info */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center gap-3">
              <AmoreLogo size="md" />
              <div>
                <span className="font-serif-title text-2xl font-bold text-[#241A18] tracking-tight">
                  Amore
                </span>
                <p className="text-[11px] uppercase tracking-widest text-[#8A7970] font-medium">
                  Speciality Ice Cream, Coffee & Cakes
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#6E5D53] leading-relaxed">
              Sri Lanka's artisanal gelato brand, famous for our Iconic Durian Custard, 20 handcrafted flavours in freshly baked edible biscuit cups, and specialty roasts.
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              <a
                href="https://instagram.com/amoreicecreamsl"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white hover:bg-[#8C102A] text-[#241A18] hover:text-white border border-[#DDD0BC] flex items-center justify-center transition-colors shadow-xs"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://wa.me/94771234567"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white hover:bg-[#25D366] text-[#241A18] hover:text-white border border-[#DDD0BC] flex items-center justify-center transition-colors shadow-xs"
                aria-label="WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              <a
                href="tel:+94812304567"
                className="w-9 h-9 rounded-full bg-white hover:bg-[#8C102A] text-[#241A18] hover:text-white border border-[#DDD0BC] flex items-center justify-center transition-colors shadow-xs"
                aria-label="Phone"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-serif-title text-sm font-bold text-[#241A18] uppercase tracking-wider">
              Explore Amore
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#full-menu" className="hover:text-[#8C102A] transition-colors">
                  All 20 Scoops Menu
                </a>
              </li>
              <li>
                <a href="#durian-spotlight" className="hover:text-[#8C102A] transition-colors">
                  The Durian Legend
                </a>
              </li>
              <li>
                <a href="#biscuit-cups" className="hover:text-[#8C102A] transition-colors">
                  Edible Biscuit Cups
                </a>
              </li>
              <li>
                <a href="#our-branches" className="hover:text-[#8C102A] transition-colors">
                  Our 3 Branches
                </a>
              </li>
            </ul>
          </div>

          {/* Three Branches Summary */}
          <div className="lg:col-span-6 space-y-3">
            <h4 className="font-serif-title text-sm font-bold text-[#241A18] uppercase tracking-wider">
              Our 3 Branches in Sri Lanka
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {AMORE_BRANCHES.map((b) => (
                <div key={b.id} className="p-3 bg-white/70 rounded-xl border border-[#E2D5C3]">
                  <div className="flex items-center gap-1 font-bold text-[#241A18] mb-1">
                    {b.id === 'arugambay' ? (
                      <Coffee className="w-3.5 h-3.5 text-amber-700" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-[#8C102A]" />
                    )}
                    <span>{b.id === 'arugambay' ? 'Arugam Bay' : b.name.split(' ')[0]}</span>
                  </div>
                  <p className="text-[11px] text-[#7A6458] leading-tight mb-2">
                    {b.address}
                  </p>
                  <a
                    href={`tel:${b.phone}`}
                    className="text-[11px] font-semibold text-[#8C102A] hover:underline block"
                  >
                    {b.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Micro Row */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#8A7970] gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span>© {new Date().getFullYear()} Amore Speciality Ice Cream, Coffee & Cakes.</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              Crafted with <Heart className="w-3 h-3 text-[#8C102A] fill-current inline" /> across Akurana, Colombo & Arugam Bay
            </span>
          </div>

          <div className="flex items-center gap-3">
            {onNavigateToAdmin ? (
              <button
                type="button"
                onClick={onNavigateToAdmin}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A7970] hover:text-[#8C102A] transition-colors cursor-pointer"
                title="Amore Staff Operations & Admin Portal"
              >
                <Lock className="w-3 h-3 text-[#8C102A]" />
                <span>Admin Portal</span>
              </button>
            ) : (
              <a
                href="?page=admin"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A7970] hover:text-[#8C102A] transition-colors cursor-pointer"
              >
                <Lock className="w-3 h-3 text-[#8C102A]" />
                <span>Admin Portal</span>
              </a>
            )}

            <button
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#8C102A] text-[#241A18] hover:text-white border border-[#DDD0BC] transition-colors cursor-pointer text-xs"
            >
              <span>Back to top</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
