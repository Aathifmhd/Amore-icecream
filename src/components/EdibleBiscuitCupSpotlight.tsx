import React from 'react';
import { Currency } from '../types';
import { formatPrice } from '../utils/currency';
import { Sparkles, Cookie, Check, Leaf, Heart } from 'lucide-react';

interface EdibleBiscuitCupSpotlightProps {
  currency: Currency;
  onExploreMenu: () => void;
}

export const EdibleBiscuitCupSpotlight: React.FC<EdibleBiscuitCupSpotlightProps> = ({
  currency,
  onExploreMenu,
}) => {
  return (
    <section className="py-16 bg-[#FAF7F2] border-b border-[#E8DFC8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-[#FFFBF5] to-[#F7EFE3] rounded-3xl p-6 sm:p-10 lg:p-12 border-2 border-[#E8DFC8] shadow-lg relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAE0D0] text-[#8C102A] text-xs font-bold uppercase tracking-wider border border-[#D9CBB7]">
                <Cookie className="w-3.5 h-3.5" />
                <span>The Amore Artisan Secret</span>
              </div>

              <h2 className="font-serif-title text-3xl sm:text-4xl font-bold text-[#241A18] tracking-tight leading-tight">
                Not Just Any Cup. <br />
                <span className="text-[#8C102A]">Our Cups Are Made from Crisp Biscuit.</span>
              </h2>

              <p className="text-base sm:text-lg text-[#5C4D44] leading-relaxed">
                At Amore, we believe every single bite of your dessert should be an indulgence. Instead of boring paper cups that go straight to the bin, our artisan cups are baked fresh daily from sweet, golden waffle biscuit batter.
              </p>

              <div className="p-4 rounded-2xl bg-white/80 border border-[#E0D5C3] shadow-xs">
                <p className="text-sm font-serif-title italic font-semibold text-[#8C102A]">
                  "Enjoy your creamy Durian or Mango gelato to the very last spoonful—and then enjoy eating the crunchy waffle cup!"
                </p>
              </div>

              {/* Feature Points */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="flex items-center gap-2.5 text-sm text-[#3D2C24]">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="font-medium">100% Edible & Zero Waste</span>
                </div>

                <div className="flex items-center gap-2.5 text-sm text-[#3D2C24]">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="font-medium">Stay Crisp Without Leaking</span>
                </div>

                <div className="flex items-center gap-2.5 text-sm text-[#3D2C24]">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-[#8C102A] flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="font-medium">Real Butter & Vanilla Aroma</span>
                </div>

                <div className="flex items-center gap-2.5 text-sm text-[#3D2C24]">
                  <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="font-medium">Tourists’ Absolute Favorite</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onExploreMenu}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#8C102A] text-white font-bold text-sm hover:bg-[#A31634] transition-all shadow-md cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>Explore Cones & Biscuit Cups Menu</span>
                </button>
              </div>
            </div>

            {/* Right Serving Format Cards */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {/* Option 1: Classic Waffle Cone */}
              <div className="bg-white p-5 rounded-2xl border-2 border-[#E8DFC8] shadow-sm hover:border-[#8C102A] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8A7970]">
                    Classic Format
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FAF7F2] text-[#241A18] border border-[#E0D5C3]">
                    Hand-Rolled
                  </span>
                </div>
                <h3 className="text-lg font-serif-title font-bold text-[#241A18]">
                  Handmade Waffle Cone
                </h3>
                <p className="text-xs text-[#5C4D44] mt-1">
                  Crisp pointed waffle cones rolled immediately off hot iron griddles with a caramelised vanilla crunch.
                </p>
                <div className="mt-4 pt-3 border-t border-[#F0E8DC] flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-[#8A7970]">Starting from:</span>
                  <span className="font-bold text-base text-[#8C102A]">
                    {formatPrice(650, currency)}
                  </span>
                </div>
              </div>

              {/* Option 2: Signature Edible Biscuit Cup */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 rounded-2xl border-2 border-amber-300 shadow-md relative">
                <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-[#8C102A] text-white text-[11px] font-extrabold uppercase tracking-wide shadow-xs">
                  Amore Signature
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Artisan Special
                  </span>
                </div>
                <h3 className="text-lg font-serif-title font-bold text-[#241A18]">
                  Signature Edible Biscuit Cup
                </h3>
                <p className="text-xs text-[#5C4D44] mt-1">
                  Crafted entirely from thick golden waffle biscuit dough. Sit comfortably, enjoy without drips, and eat the whole cup!
                </p>
                <div className="mt-4 pt-3 border-t border-amber-200 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-[#8A7970]">Starting from:</span>
                  <div className="text-right">
                    <span className="font-bold text-base text-[#8C102A]">
                      {formatPrice(700, currency)}
                    </span>
                    <span className="block text-[10px] text-emerald-800 font-semibold">
                      (Includes Biscuit Cup)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
