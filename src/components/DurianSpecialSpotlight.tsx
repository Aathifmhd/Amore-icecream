import React, { useState, useEffect } from 'react';
import { ASSET_IMAGES, ALL_20_FLAVOURS } from '../data/iceCreamData';
import { Currency } from '../types';
import { formatPrice } from '../utils/currency';
import { Sparkles, Star, CheckCircle, Flame, MapPin, Award, Cookie, ShoppingBag } from 'lucide-react';

interface DurianSpecialSpotlightProps {
  currency: Currency;
  onOrderDurian: () => void;
  onExploreFullMenu: () => void;
}

export const DurianSpecialSpotlight: React.FC<DurianSpecialSpotlightProps> = ({
  currency,
  onOrderDurian,
  onExploreFullMenu,
}) => {
  const durianItem = ALL_20_FLAVOURS.find((f) => f.id === 'durian-best') || ALL_20_FLAVOURS[0];
  const [activeSlide, setActiveSlide] = useState(0);
  const [prevSlide, setPrevSlide] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const DURIAN_SLIDES = [
    {
      id: 'biscuit-cone',
      image: ASSET_IMAGES.durianCone,
      title: 'Waffle Biscuit Cone Durian',
      alt: 'Amore Durian Gelato in Crisp Waffle Biscuit Cone with Pistachio Crumb and Fresh Durian Fruit',
      tag: 'Crisp Waffle Cone',
      servingName: 'In Waffle Cone',
      price: durianItem.conePriceLKR,
      highlight: 'With roasted pistachio crumble',
    },
    {
      id: 'biscuit-cup',
      image: ASSET_IMAGES.durianScoop,
      title: 'Edible Biscuit Cup Durian',
      alt: 'Amore Iconic Durian Custard Gelato in Crunchy Edible Biscuit Cup with Fresh Durian Fruit',
      tag: 'Crunchy Biscuit Cup',
      servingName: 'In Biscuit Cup',
      price: durianItem.biscuitCupPriceLKR,
      highlight: '100% Zero-waste edible cup',
    },
  ];

  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setActiveSlide((curr) => {
        setPrevSlide(curr);
        return (curr + 1) % DURIAN_SLIDES.length;
      });
    }, 3600);
    return () => clearInterval(timer);
  }, [isHovered, DURIAN_SLIDES.length]);

  const handleSelectSlide = (idx: number) => {
    if (idx === activeSlide) return;
    setPrevSlide(activeSlide);
    setActiveSlide(idx);
  };

  return (
    <section id="durian-spotlight" className="py-16 md:py-24 bg-[#F8F2E6] relative overflow-hidden border-y border-[#E8DFC8]">
      {/* Decorative subtle aura */}
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-[#FFE380]/30 rounded-full filter blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-[#FDE8EC]/40 rounded-full filter blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-6 sm:p-10 md:p-12 shadow-xl border border-[#E3D7C5] relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left: High-Res Food Photography Smooth Automatic Slider (Right-Side Only Slide Animation) */}
            <div className="lg:col-span-5 relative">
              <div
                className="relative rounded-2xl overflow-hidden shadow-lg border-2 border-[#EADFCF] aspect-square select-none bg-[#1A120F] group cursor-pointer"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {/* Smooth Right-Side Entering Slide Animation */}
                <div className="relative w-full h-full">
                  {DURIAN_SLIDES.map((slide, idx) => {
                    const isActive = idx === activeSlide;
                    const isPrev = idx === prevSlide;

                    let animClass = 'hidden';
                    if (isActive && prevSlide !== null) {
                      animClass = 'animate-slide-in-right z-10';
                    } else if (isActive && prevSlide === null) {
                      animClass = 'translate-x-0 z-10';
                    } else if (isPrev) {
                      animClass = 'animate-slide-out-left z-0';
                    }

                    return (
                      <div
                        key={slide.id}
                        className={`absolute inset-0 w-full h-full overflow-hidden ${animClass}`}
                      >
                        <img
                          src={slide.image}
                          alt={slide.alt}
                          className={`w-full h-full object-cover object-center transform transition-transform duration-700 ease-out will-change-transform ${
                            slide.id === 'biscuit-cone'
                              ? 'scale-[1.06] group-hover:scale-[1.16] contrast-[1.03] brightness-[1.01]'
                              : 'group-hover:scale-110'
                          }`}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    );
                  })}
                </div>
                
                {/* Crown Pill */}
                <div className="absolute top-4 left-4 bg-[#8C102A] text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md z-10">
                  <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>Amore’s #1 Star Flavour</span>
                </div>

                {/* Dynamic Serving Badge (Changes per slide) */}
                <div className="absolute top-4 right-4 bg-[#4A3018]/85 backdrop-blur-md text-amber-100 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-300/30 flex items-center gap-1 shadow-sm transition-all duration-300 z-10">
                  <Cookie className="w-3 h-3 text-amber-300" />
                  <span>{DURIAN_SLIDES[activeSlide].tag}</span>
                </div>

                {/* Bottom Overlay with Dots & Dynamic Price (Clean without hover arrows) */}
                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between z-10">
                  {/* Interactive Slider Dots */}
                  <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/20 shadow-sm">
                    {DURIAN_SLIDES.map((slide, idx) => (
                      <button
                        key={slide.id}
                        onClick={() => handleSelectSlide(idx)}
                        className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                          activeSlide === idx
                            ? 'w-5 bg-amber-400'
                            : 'w-2 bg-white/50 hover:bg-white'
                        }`}
                        aria-label={`View ${slide.title}`}
                      />
                    ))}
                  </div>

                  {/* Price Pill */}
                  <div className="bg-black/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 shadow-md flex items-center gap-1.5 transition-all duration-300">
                    <span className="text-amber-300">{formatPrice(DURIAN_SLIDES[activeSlide].price, currency)}</span>
                    <span className="text-[11px] font-normal text-white/90">&bull; {DURIAN_SLIDES[activeSlide].servingName}</span>
                  </div>
                </div>
              </div>

              {/* Verified Badge */}
              <div className="mt-3 flex items-center justify-between text-xs text-[#5D4E46] px-1">
                <span className="flex items-center gap-1 text-[#8C102A] font-semibold">
                  <Flame className="w-3.5 h-3.5" />
                  #1 Bestseller in Sri Lanka
                </span>
                <span className="font-medium text-[#7A6458]">100% Real Golden Durian Pulp</span>
              </div>
            </div>

            {/* Right: The Story & Flavor Profile */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#8C102A] uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  The Undisputed King of Amore
                </div>
                <h2 className="font-serif-title text-3xl sm:text-4xl font-bold text-[#241A18] leading-tight">
                  The Iconic Durian Custard Gelato
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-emerald-800 tracking-wide uppercase">
                  Bold &bull; Exotic &bull; Unforgettable
                </p>
                <p className="text-sm sm:text-base text-[#5D4E46] leading-relaxed">
                  Sri Lanka's most talked-about scoop. Ripe golden local durian pulp slow-churned in small daily batches with fresh hill country milk into a luscious, aromatic custard gelato that converts even first-time skeptics. Available across all 3 branches in Akurana, Colombo, and Arugam Bay.
                </p>
              </div>

              {/* Flavor Profile Matrix */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EBE1D0]">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#241A18] mb-1">
                    <span>Creaminess</span>
                    <span className="text-[#8C102A]">5/5</span>
                  </div>
                  <div className="w-full bg-[#E5DCD0] h-2 rounded-full overflow-hidden">
                    <div className="bg-[#8C102A] h-full w-[100%] rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#241A18] mb-1">
                    <span>Intensity</span>
                    <span className="text-amber-700">5/5</span>
                  </div>
                  <div className="w-full bg-[#E5DCD0] h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-600 h-full w-[100%] rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#241A18] mb-1">
                    <span>Sweetness</span>
                    <span className="text-[#5D4E46]">3.5/5</span>
                  </div>
                  <div className="w-full bg-[#E5DCD0] h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full w-[70%] rounded-full" />
                  </div>
                </div>
              </div>

              {/* Tasting Notes Tags */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  '100% Real Durian Pulp',
                  'Highland Full-Cream Milk',
                  'Eggless Gelato',
                  '100% Halal Ingredients',
                  'Available in Edible Biscuit Cup',
                ].map((note) => (
                  <span
                    key={note}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#F3EDE3] text-[#42332B] font-medium"
                  >
                    <CheckCircle className="w-3 h-3 text-[#8C102A]" />
                    {note}
                  </span>
                ))}
              </div>

              {/* Marketing & Order CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={onOrderDurian}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#8C102A] text-white text-xs sm:text-sm font-bold hover:bg-[#A31634] transition-all shadow-md cursor-pointer active:scale-95"
                >
                  <ShoppingBag className="w-4 h-4 text-amber-200" />
                  <span>Order Durian Scoop ({formatPrice(durianItem.biscuitCupPriceLKR, currency)})</span>
                </button>

                <button
                  onClick={onExploreFullMenu}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-white text-[#241A18] border border-[#D8CCBA] text-xs sm:text-sm font-semibold hover:bg-[#F3EDE3] transition-colors cursor-pointer"
                >
                  <span>Explore All 20 Flavours</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#7A6458] pt-1">
                <Cookie className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  Cone: {formatPrice(durianItem.conePriceLKR, currency)} • Edible Biscuit Cup: {formatPrice(durianItem.biscuitCupPriceLKR, currency)} • Double: {formatPrice(durianItem.doubleCupPriceLKR, currency)}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};
