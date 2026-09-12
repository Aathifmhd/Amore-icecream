import React, { useState } from 'react';
import { SIGNATURE_SCOOPS } from '../data/iceCreamData';
import { ScoopItem, FlavorCategory } from '../types';
import { Star, Sparkles, Filter, X, MapPin, Eye } from 'lucide-react';

interface ScoopsGalleryProps {
  onPlanVisit?: () => void;
}

export const ScoopsGallery: React.FC<ScoopsGalleryProps> = ({
  onPlanVisit,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<FlavorCategory>('all');
  const [dietaryFilter, setDietaryFilter] = useState<string>('all');
  const [activeModalScoop, setActiveModalScoop] = useState<ScoopItem | null>(null);

  const categories: { id: FlavorCategory; label: string }[] = [
    { id: 'all', label: 'All Scoops' },
    { id: 'signature', label: 'Signature Creations' },
    { id: 'gelato', label: 'Classic Gelato' },
    { id: 'sorbet', label: 'Fresh Sorbets' },
    { id: 'srilankan-twist', label: 'Ceylon Heritage' },
  ];

  const dietaryOptions = ['all', 'Eggless', 'Dairy-Free', 'Halal'];

  const filteredScoops = SIGNATURE_SCOOPS.filter((scoop) => {
    const matchesCategory =
      selectedCategory === 'all' || scoop.category === selectedCategory;
    const matchesDietary =
      dietaryFilter === 'all' ||
      scoop.dietary.includes(dietaryFilter as any);
    return matchesCategory && matchesDietary;
  });

  const handleTasteAtParlour = () => {
    setActiveModalScoop(null);
    if (onPlanVisit) {
      onPlanVisit();
    } else {
      document.getElementById('location-contact')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="scoops-gallery" className="py-16 md:py-24 bg-[#FAF7F2] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDE8EC] text-[#8C102A] text-xs font-bold uppercase tracking-wider mb-2.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Amore Freezer Vault</span>
          </div>
          <h2 className="font-serif-title text-3xl sm:text-4xl md:text-5xl font-bold text-[#241A18] tracking-tight">
            Gallery of Signature Scoops
          </h2>
          <p className="text-sm sm:text-base text-[#5D4E46] mt-3 leading-relaxed">
            Every scoop is slowly churned in our Akurana kitchen using fresh highland milk, real Belgian cocoa, hand-scraped vanilla beans, and tropical fruit purees.
          </p>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 border-b border-[#E8DFC8]">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#8C102A] text-white shadow-sm'
                    : 'bg-[#F3EDE3] text-[#42332B] hover:bg-[#EAE0D0]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Dietary Filter Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
            <span className="text-[#7A6458] font-medium flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#8C102A]" />
              Filter:
            </span>
            <div className="flex items-center gap-1">
              {dietaryOptions.map((diet) => (
                <button
                  key={diet}
                  onClick={() => setDietaryFilter(diet)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    dietaryFilter === diet
                      ? 'bg-[#241A18] text-white font-medium'
                      : 'bg-[#F3EDE3] text-[#5D4E46] hover:bg-[#EAE0D0]'
                  }`}
                >
                  {diet === 'all' ? 'Any' : diet}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scoops Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-8">
          {filteredScoops.map((scoop) => {
            return (
              <div
                key={scoop.id}
                id={`scoop-card-${scoop.id}`}
                className="group bg-white rounded-2xl overflow-hidden border border-[#E8DFC8] shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                {/* Image Container with Badges */}
                <div className="relative aspect-4/3 overflow-hidden bg-[#F3EDE3]">
                  <img
                    src={scoop.image}
                    alt={scoop.name}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                    {scoop.isIconic && (
                      <span className="bg-[#8C102A] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                        Iconic
                      </span>
                    )}
                    {scoop.isPopular && !scoop.isIconic && (
                      <span className="bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                        Bestseller
                      </span>
                    )}
                  </div>

                  {/* Dietary tags */}
                  <div className="absolute bottom-2.5 left-3 flex flex-wrap gap-1 z-10">
                    {scoop.dietary.slice(0, 2).map((d) => (
                      <span
                        key={d}
                        className="bg-black/60 backdrop-blur-xs text-white text-[9px] font-medium px-2 py-0.5 rounded-md"
                      >
                        {d}
                      </span>
                    ))}
                  </div>

                  {/* Price Chip */}
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs text-[#241A18] font-bold text-xs px-2.5 py-1 rounded-full shadow-sm">
                    LKR {scoop.conePriceLKR}
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-serif-title text-base sm:text-lg font-bold text-[#241A18] leading-snug group-hover:text-[#8C102A] transition-colors">
                      {scoop.name}
                    </h3>
                    <p className="text-xs text-[#7A6458] line-clamp-2 mt-1 font-normal leading-relaxed">
                      {scoop.tagline}
                    </p>

                    {/* Tasting Notes Pills */}
                    <div className="flex flex-wrap gap-1.5 my-3">
                      {scoop.tastingNotes.slice(0, 2).map((note) => (
                        <span
                          key={note}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#FAF7F2] text-[#4A3B32] border border-[#E8DFC8]"
                        >
                          {note}
                        </span>
                      ))}
                    </div>

                    {/* Creaminess & Intensity mini indicators */}
                    <div className="space-y-1.5 py-2 border-t border-[#F0E8DC] text-[11px] text-[#5D4E46]">
                      <div className="flex items-center justify-between">
                        <span>Creaminess</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <span
                              key={level}
                              className={`w-1.5 h-1.5 rounded-full ${
                                level <= scoop.creaminess
                                  ? 'bg-[#8C102A]'
                                  : 'bg-[#E3D7C5]'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Flavor Intensity</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <span
                              key={level}
                              className={`w-1.5 h-1.5 rounded-full ${
                                level <= scoop.intensity
                                  ? 'bg-amber-600'
                                  : 'bg-[#E3D7C5]'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-3 border-t border-[#F0E8DC]">
                    <button
                      onClick={() => setActiveModalScoop(scoop)}
                      className="w-full py-2.5 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 bg-[#F3EDE3] text-[#241A18] hover:bg-[#8C102A] hover:text-white transition-all duration-200 cursor-pointer group/btn"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#8C102A] group-hover/btn:text-white transition-colors" />
                      <span>Discover Flavour Profile</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scoop Detail Modal */}
        {activeModalScoop && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
            onClick={() => setActiveModalScoop(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#E8DFC8] relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveModalScoop(null)}
                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Image */}
              <div className="relative h-60 w-full bg-[#EFE8DD]">
                <img
                  src={activeModalScoop.image}
                  alt={activeModalScoop.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    Amore Speciality Scoop
                  </span>
                  <h3 className="font-serif-title text-2xl font-bold">
                    {activeModalScoop.name}
                  </h3>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <p className="text-xs text-[#8C102A] font-semibold italic">
                  "{activeModalScoop.tagline}"
                </p>

                <p className="text-sm text-[#5D4E46] leading-relaxed">
                  {activeModalScoop.description}
                </p>

                {/* Tasting Notes */}
                <div>
                  <h4 className="text-xs font-bold text-[#241A18] uppercase tracking-wider mb-2">
                    Flavor Notes
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activeModalScoop.tastingNotes.map((note) => (
                      <span
                        key={note}
                        className="text-xs px-3 py-1 rounded-full bg-[#F3EDE3] text-[#241A18] font-medium"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Dietary Profile */}
                <div>
                  <h4 className="text-xs font-bold text-[#241A18] uppercase tracking-wider mb-2">
                    Dietary & Ingredients
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activeModalScoop.dietary.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2.5 py-1 rounded-md bg-[#FDE8EC] text-[#8C102A] font-medium"
                      >
                        ✓ {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Buttons in Modal */}
                <div className="pt-4 border-t border-[#E8DFC8] space-y-2.5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTasteAtParlour}
                      className="flex-1 py-3 px-4 rounded-full bg-[#8C102A] text-white text-xs sm:text-sm font-semibold hover:bg-[#720B21] transition-all shadow-md cursor-pointer text-center flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4 text-amber-300" />
                      <span>Taste at Akurana Parlour (LKR {activeModalScoop.priceLKR})</span>
                    </button>

                    <button
                      onClick={() => setActiveModalScoop(null)}
                      className="py-3 px-5 rounded-full bg-[#F3EDE3] text-[#241A18] text-xs sm:text-sm font-semibold hover:bg-[#EAE0D0] transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <p className="text-[11px] text-center text-[#7A6458]">
                    Available fresh daily in waffle cones, cups, or as customizable tasting flights.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
