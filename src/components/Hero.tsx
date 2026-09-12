import React, { useState, useEffect } from 'react';
import { ASSET_IMAGES, AMORE_BRANCHES } from '../data/iceCreamData';
import { Currency, BranchId } from '../types';
import { formatPrice } from '../utils/currency';
import { Sparkles, ArrowRight, Star, Flame, ShieldCheck, MapPin, Cookie, ShoppingBag, Coffee, Building } from 'lucide-react';
import { AmoreLogo } from './AmoreLogo';

interface HeroProps {
  currency: Currency;
  selectedBranch: BranchId;
  onExploreMenu: () => void;
  onExploreBranches: () => void;
  onOpenOrder: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  currency,
  selectedBranch,
  onExploreMenu,
  onExploreBranches,
  onOpenOrder,
}) => {
  const currentBranch = AMORE_BRANCHES.find((b) => b.id === selectedBranch) || AMORE_BRANCHES[0];
  const [activeBranchIndex, setActiveBranchIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBranchIndex((prev) => (prev + 1) % AMORE_BRANCHES.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      id="hero-section"
      className="relative pt-24 sm:pt-28 lg:pt-[118px] pb-16 lg:pb-20 overflow-hidden bg-[#FAF7F2] text-[#241A18]"
    >
      {/* Light, Sun-drenched Aesthetic Background Layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <img
          src={ASSET_IMAGES.lightHero}
          alt="Amore Parlour Bright Sunlit Cafe Atmosphere"
          className="w-full h-full object-cover object-center scale-100 filter brightness-[1.03] saturate-[1.05]"
          referrerPolicy="no-referrer"
        />

        {/* Soft, Luminous Gradient Overlays for High Legibility & Warmth */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FAF7F2]/96 via-[#FAF7F2]/90 to-[#FAF7F2]/50 md:to-[#FAF7F2]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAF7F2] via-transparent to-[#FAF7F2]/60" />
        <div className="absolute top-10 left-10 w-96 h-96 bg-[#FDE8EC]/60 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-20 w-80 h-80 bg-[#FFF3D6]/70 rounded-full filter blur-3xl pointer-events-none" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Focused, punchy & human-written copy */}
          <div className="lg:col-span-6 flex flex-col items-start space-y-6">
            
            {/* Top Eyebrow Badge highlighting 3 branches */}
            <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 border border-[#E8DFC8] text-[#8C102A] text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#8C102A] animate-ping" />
              <span>3 Branches: Akurana • Colombo • Arugam Bay</span>
              {selectedBranch === 'arugambay' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300/60">
                  <Coffee className="w-3 h-3 text-amber-700" />
                  Ice Cream, Coffee & Pastries
                </span>
              )}
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="font-serif-title text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#241A18] leading-[1.12]">
                Real Flavours.{' '}
                <span className="text-[#8C102A] italic underline decoration-[#D4A017]/50 underline-offset-6">
                  Handcrafted Happiness
                </span>
                .
              </h1>
              <p className="text-base sm:text-lg text-[#5A4941] max-w-xl font-normal leading-relaxed pt-1">
                From our famous <strong>Iconic Durian Custard</strong> and Alphonso Mango to fragrant Cardamom and rich Belgian Chocolate. Served in freshly rolled waffle cones or our zero-waste <strong>signature edible biscuit cups</strong>.
              </p>
            </div>

            {/* Pricing teaser pill */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-[#5A4941]">
              <Cookie className="w-4 h-4 text-amber-700" />
              <span>
                Single scoops start at{' '}
                <strong className="text-[#8C102A] text-sm">
                  {formatPrice(650, currency)}
                </strong>{' '}
                in crisp waffle cones or crunchy biscuit cups.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {/* Mobile Dedicated Full Menu Highlight Card */}
              <div className="md:hidden w-full">
                <button
                  id="hero-mobile-fullmenu-btn"
                  onClick={onExploreMenu}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#8C102A] to-[#A31634] text-white flex items-center justify-between shadow-lg active:scale-98 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg shrink-0">
                      🍨
                    </span>
                    <div>
                      <span className="text-sm font-bold block leading-tight flex items-center gap-1.5">
                        <span>View Full Menu</span>
                        <span className="bg-amber-400 text-[#8C102A] text-[10px] font-black px-1.5 py-0.2 rounded-full">
                          20 Flavours
                        </span>
                      </span>
                      <span className="text-[11px] text-amber-200">
                        Waffle Cones, Edible Cups, Coffee & Cakes
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </div>
                </button>
              </div>

              {/* Desktop Explore Menu Button */}
              <button
                id="hero-explore-menu-btn"
                onClick={onExploreMenu}
                className="hidden md:inline-flex items-center gap-2 px-6 sm:px-7 py-3.5 rounded-full bg-[#8C102A] text-white font-semibold text-sm hover:bg-[#A31634] transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer active:scale-95"
              >
                <span>Explore Full Menu</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="hero-open-order-btn"
                onClick={onOpenOrder}
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-3.5 rounded-full bg-white hover:bg-[#F5EFE6] text-[#241A18] font-semibold text-sm border border-[#DDD3C2] transition-all duration-200 shadow-xs cursor-pointer active:scale-95"
              >
                <ShoppingBag className="w-4 h-4 text-[#8C102A]" />
                <span>Quick Order</span>
              </button>

              <button
                id="hero-branches-btn"
                onClick={onExploreBranches}
                className="inline-flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold text-[#8C102A] hover:text-[#5B0819] transition-colors cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-[#8C102A]" />
                <span className="underline underline-offset-4">Find Branches</span>
              </button>
            </div>

            {/* Key Quality Pillars with light badges */}
            <div className="pt-4 grid grid-cols-3 gap-3 w-full border-t border-[#E8DFC8]/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#FDE8EC] text-[#8C102A] flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 fill-[#8C102A]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#241A18]">Iconic Durian</h4>
                  <p className="text-[11px] text-[#7A6458]">Amore's best</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Cookie className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#241A18]">Biscuit Cups</h4>
                  <p className="text-[11px] text-[#7A6458]">Eat the cup!</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#FFF3D6] text-amber-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#241A18]">100% Halal</h4>
                  <p className="text-[11px] text-[#7A6458]">Eggless options</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Visual Rich Image Showcase */}
          <div className="lg:col-span-6 relative mt-6 lg:mt-0">
            
            {/* Visual Glass Showcase Card */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-[#E8DFC8] bg-white p-3 sm:p-4 group">
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
                <img
                  src={ASSET_IMAGES.realFlavoursHero}
                  alt="Amore Real Flavours — Durian, Alphonso Mango and Cardamom Handcrafted Gelato Cones"
                  className="w-full h-full object-cover transform group-hover:scale-104 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                {/* Floating Amore Logo Badge on top right */}
                <div className="absolute top-3.5 right-3.5 z-10 drop-shadow-md">
                  <AmoreLogo size="md" />
                </div>
              </div>
            </div>

            {/* Floating Highlight Card 1: Iconic Durian */}
            <div className="absolute -bottom-5 -left-3 sm:-left-6 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-[#E8DFC8] flex items-center gap-3 max-w-[260px] animate-float-gentle">
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-amber-300 shadow-xs">
                <img
                  src={ASSET_IMAGES.durianScoop}
                  alt="Durian scoop"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C102A] block">
                  Amore Best Flavour
                </span>
                <p className="text-xs font-bold text-[#241A18] truncate">
                  The Iconic Durian Custard
                </p>
                <div className="flex items-center gap-1 text-[11px] text-amber-700 font-semibold mt-0.5">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span>Silky Natural Custard</span>
                </div>
              </div>
            </div>

            {/* Automatic Sliding Branches Showcase Card */}
            <div className="absolute top-0 sm:-top-1 -right-2 sm:-right-4 bg-white/95 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl shadow-xl border border-[#E8DFC8] flex flex-col gap-1.5 w-[250px] sm:w-[270px] overflow-hidden group transition-all duration-300 hover:shadow-2xl z-20">
              {/* Header row with Parlours indicator & progress dots */}
              <div className="flex items-center justify-between text-[10px] pb-1 border-b border-[#F0E9DC]">
                <div className="flex items-center gap-1.5 font-bold text-[#8C102A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="uppercase tracking-wider">Amore Parlours ({AMORE_BRANCHES.length})</span>
                </div>
                {/* Dots indicator */}
                <div className="flex items-center gap-1">
                  {AMORE_BRANCHES.map((b, idx) => (
                    <button
                      key={b.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveBranchIndex(idx);
                      }}
                      className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                        idx === activeBranchIndex
                          ? 'w-3.5 bg-[#8C102A]'
                          : 'w-1.5 bg-[#D9CBB7] hover:bg-[#8C102A]/50'
                      }`}
                      aria-label={`Show ${b.name}`}
                    />
                  ))}
                </div>
              </div>

              {/* Sliding Carousel Track */}
              <div className="overflow-hidden w-full">
                <div
                  className="flex transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${activeBranchIndex * 100}%)` }}
                >
                  {AMORE_BRANCHES.map((branch) => {
                    return (
                      <a
                        key={branch.id}
                        href="#our-branches"
                        className="w-full shrink-0 flex items-center gap-2.5 text-left select-none cursor-pointer group-hover:opacity-95"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center transition-colors ${
                            branch.id === 'arugambay'
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : branch.id === 'colombo'
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-rose-50 border-rose-200 text-[#8C102A]'
                          }`}
                        >
                          {branch.id === 'arugambay' && <Coffee className="w-4 h-4" />}
                          {branch.id === 'colombo' && <Building className="w-4 h-4" />}
                          {branch.id === 'akurana' && <MapPin className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#241A18] truncate leading-tight">
                            {branch.name}
                          </p>
                          <p className="text-[10px] text-[#7A6458] truncate leading-tight mt-0.5">
                            {branch.city} &bull; {branch.vibeTag.split(' ')[0]}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
