import React from 'react';
import { ASSET_IMAGES, PARLOUR_INFO } from '../data/iceCreamData';
import { Sparkles, Armchair, Coffee, Heart, CheckCircle2, Instagram, MapPin } from 'lucide-react';

export const ParlourExperience: React.FC = () => {
  const highlights = [
    {
      title: 'Cane & Rattan Ambience',
      desc: 'Tiered handwoven lantern chandeliers, curved cane chairs, and sunny glass corners for unhurried conversations.',
      icon: Armchair,
    },
    {
      title: 'Specialty Coffee Nook',
      desc: 'Locally roasted espresso beans pulled on commercial machines to complement our cakes and sundaes.',
      icon: Coffee,
    },
    {
      title: 'Open Late Till 11:30 PM',
      desc: 'Akurana’s favorite evening sanctuary for post-dinner family gelato runs and cozy late-night lattes.',
      icon: Heart,
    },
  ];

  return (
    <section id="parlour-vibe" className="py-16 md:py-24 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Title row */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3EDE3] text-[#8C102A] text-xs font-bold uppercase tracking-wider mb-2.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Amore Atmosphere</span>
          </div>
          <h2 className="font-serif-title text-3xl sm:text-4xl md:text-5xl font-bold text-[#241A18] tracking-tight">
            A Nostalgic Ice Cream Parlour <br className="hidden sm:inline" />
            Turned Cozy Café
          </h2>
          <p className="text-sm sm:text-base text-[#5D4E46] mt-3 leading-relaxed">
            Step through our doors at 137 Matale Road into a warm sanctuary of natural rattan textures, sunlit floor-to-ceiling glass, and the aroma of roasted coffee and fresh waffle cones.
          </p>
        </div>

        {/* Gallery Collage & Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Photos Mosaic */}
          <div className="lg:col-span-7 grid grid-cols-2 gap-4">
            
            {/* Main Interior Photo */}
            <div className="col-span-2 relative rounded-3xl overflow-hidden shadow-lg aspect-16/10 border-2 border-[#EFE8DD] group">
              <img
                src={ASSET_IMAGES.cafeInterior}
                alt="Amore Akurana Cafe Interior with Rattan Lanterns and Cane Seating"
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                  Luxe & Spacious
                </span>
                <p className="font-serif-title text-base sm:text-lg font-semibold">
                  Handcrafted Rattan Chandeliers & Natural Sunlight
                </p>
              </div>
            </div>

            {/* Coffee & Cheesecake */}
            <div className="relative rounded-2xl overflow-hidden shadow-md aspect-4/3 border border-[#E8DFC8] group">
              <img
                src={ASSET_IMAGES.cheesecakeCoffee}
                alt="Blueberry Cheesecake and Specialty Coffee"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded">
                Blueberry Cheesecake & Brews
              </div>
            </div>

            {/* Durian Scoop Delight */}
            <div className="relative rounded-2xl overflow-hidden shadow-md aspect-4/3 border border-[#E8DFC8] group">
              <img
                src={ASSET_IMAGES.durianScoop}
                alt="Signature Durian Scoop in parlour bowl"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded">
                The Iconic Durian Custard
              </div>
            </div>

          </div>

          {/* Highlights Breakdown */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-4">
              {highlights.map((h) => {
                const Icon = h.icon;
                return (
                  <div
                    key={h.title}
                    className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] hover:border-[#8C102A]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-xl bg-[#FDE8EC] text-[#8C102A] flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h4 className="font-serif-title text-base font-bold text-[#241A18]">
                        {h.title}
                      </h4>
                    </div>
                    <p className="text-xs sm:text-sm text-[#5D4E46] leading-relaxed pl-12">
                      {h.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Akurana Community Box */}
            <div className="p-5 rounded-2xl bg-[#8C102A] text-white shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-200">
                  Follow the Buzz
                </span>
                <h4 className="font-serif-title text-base sm:text-lg font-bold">
                  {PARLOUR_INFO.instagram}
                </h4>
                <p className="text-xs text-white/80 mt-0.5">
                  7,000+ dessert lovers in Kandy and beyond
                </p>
              </div>
              <a
                href={PARLOUR_INFO.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#8C102A] text-xs font-bold hover:bg-[#FAF7F2] transition-colors shadow-sm"
              >
                <Instagram className="w-3.5 h-3.5" />
                <span>Visit Instagram</span>
              </a>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
