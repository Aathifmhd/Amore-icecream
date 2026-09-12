import React from 'react';
import { BranchId, Currency } from '../types';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import { MapPin, Clock, Phone, MessageCircle, Navigation, Sparkles, ExternalLink } from 'lucide-react';

interface BranchShowcaseProps {
  selectedBranch: BranchId;
  onSelectBranch: (branchId: BranchId) => void;
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  onOrderForBranch?: (branchId: BranchId) => void;
}

export const BranchShowcase: React.FC<BranchShowcaseProps> = ({
  selectedBranch,
  onSelectBranch,
  currency: _currency,
  onToggleCurrency: _onToggleCurrency,
  onOrderForBranch: _onOrderForBranch,
}) => {
  const currentBranch = AMORE_BRANCHES.find((b) => b.id === selectedBranch) || AMORE_BRANCHES[0];

  return (
    <section id="our-branches" className="py-16 md:py-24 bg-[#F5EFE6] border-y border-[#E8DFC8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Title */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAE0D0] text-[#8C102A] text-xs font-bold tracking-wide uppercase mb-3.5 border border-[#D9CBB7]">
            <MapPin className="w-3.5 h-3.5" />
            <span>Explore our Branches</span>
          </div>
          <h2 className="font-serif-title text-3xl sm:text-4xl lg:text-5xl font-bold text-[#241A18] tracking-tight">
            From the Kandy Hills to Colombo Sunset & Arugam Bay Coast
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5C4D44] leading-relaxed">
            Whether you are gathering with family in Akurana, catching the sea breeze on Marine Drive, or enjoying famous handcrafted gelato and coffee on Main Street in Arugam Bay, Amore serves freshly churned happiness in crisp waffle cones and edible biscuit cups.
          </p>
        </div>

        {/* Branch Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 mb-10">
          {AMORE_BRANCHES.map((b) => {
            const isSelected = b.id === selectedBranch;
            const isArugam = b.id === 'arugambay';
            return (
              <button
                key={b.id}
                onClick={() => onSelectBranch(b.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 cursor-pointer border ${
                  isSelected
                    ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-lg scale-102'
                    : 'bg-white text-[#3D2C24] border-[#E0D5C3] hover:bg-[#FAF7F2] shadow-xs'
                }`}
              >
                <span>{b.name}</span>
                {isArugam && (
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-wide uppercase shadow-xs ${
                    isSelected ? 'bg-[#FFE27A] text-[#5C3D10]' : 'bg-[#FFF2B2] text-[#6E470B] border border-[#F5D880]'
                  }`}>
                    Ice cream & cafe
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active Branch Showcase Card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-[#E8DFC8] grid grid-cols-1 lg:grid-cols-12 transition-all">
          {/* Visual Column */}
          <div className="lg:col-span-6 relative min-h-[300px] lg:min-h-[460px] bg-[#FAF7F2] overflow-hidden">
            <img
              src={currentBranch.image}
              alt={currentBranch.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

            {/* Top Badges */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#8C102A] text-white shadow-md">
                {currentBranch.badge}
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/95 text-[#241A18] backdrop-blur-xs shadow-md">
                {currentBranch.vibeTag}
              </span>
            </div>

            {/* Bottom Caption Overlay */}
            <div className="absolute bottom-5 left-5 right-5 text-white z-10">
              <h3 className="font-serif-title text-2xl sm:text-3xl font-bold tracking-tight">
                {currentBranch.name}
              </h3>
              <p className="text-sm sm:text-base text-amber-100/95 mt-1 font-medium">
                {currentBranch.tagline}
              </p>
            </div>
          </div>

          {/* Details Column */}
          <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
            <div>
              {/* Special Arugam Bay Highlight Box */}
              {currentBranch.id === 'arugambay' && (
                <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-[#FFF9ED] border border-[#F2DEB9] text-[#43281C]">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-700" />
                    <span className="font-bold text-sm text-[#43281C] uppercase tracking-wide">
                      Arugambay Special & Coastal Parlour
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#5C4D44] leading-relaxed">
                    Located on vibrant Main Street, our Arugambay parlour is the perfect spot for handcrafted ice cream, barista coffee, and fresh warm pastries. Be sure to try our famous Arugambay specials—including creamy Avocado gelato, refreshing Soursop sorbet, and iced vanilla espresso, all served in our signature crunchy edible biscuit cups.
                  </p>
                </div>
              )}

              {/* Branch Story */}
              <p className="text-base text-[#4D3E36] leading-relaxed mb-6 font-normal">
                {currentBranch.description}
              </p>

              {/* Info Grid */}
              <div className="space-y-3.5 mb-8">
                <div className="flex items-start gap-3 text-sm text-[#3D2C24]">
                  <MapPin className="w-4 h-4 text-[#8C102A] shrink-0 mt-1" />
                  <div>
                    <span className="font-semibold text-[#241A18]">Address: </span>
                    <span>{currentBranch.address}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-sm text-[#3D2C24]">
                  <Clock className="w-4 h-4 text-[#8C102A] shrink-0 mt-1" />
                  <div>
                    <span className="font-semibold text-[#241A18]">Operating Hours: </span>
                    <span>{currentBranch.hours}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-sm text-[#3D2C24]">
                  <Phone className="w-4 h-4 text-[#8C102A] shrink-0 mt-1" />
                  <div>
                    <span className="font-semibold text-[#241A18]">Phone / Orders: </span>
                    <a href={`tel:${currentBranch.phone}`} className="text-[#8C102A] hover:underline font-semibold">
                      {currentBranch.phone}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-[#E8DFC8] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href={currentBranch.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-white text-[#241A18] border border-[#D9CBB7] hover:bg-[#FAF7F2] font-semibold text-sm transition-colors cursor-pointer"
              >
                <Navigation className="w-4 h-4 text-[#8C102A]" />
                <span>Get Directions</span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              </a>

              <a
                href={`https://wa.me/${currentBranch.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi Amore ${currentBranch.name}, I would like to check today's flavours and place an order!`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-sm transition-colors cursor-pointer shadow-xs"
                title="WhatsApp Direct"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
