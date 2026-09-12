import React, { useState } from 'react';
import { PARLOUR_INFO } from '../data/iceCreamData';
import { MapPin, Clock, Phone, Send, ExternalLink, ChevronDown, ChevronUp, Sparkles, CheckCircle } from 'lucide-react';
import { AmoreLogo } from './AmoreLogo';

export const LocationContact: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'What makes Amore’s iconic Durian ice cream so famous?',
      a: 'We slow-churn 100% ripe local durian pulp with fresh hill country full-cream milk into an authentic, velvety custard gelato with zero artificial flavorings.',
    },
    {
      q: 'Are your ice creams, cakes, and coffee Halal & Eggless?',
      a: 'Yes, all ingredients are 100% Halal certified. Most gelato scoops are eggless, and our fruit sorbets are 100% dairy-free vegan friendly.',
    },
    {
      q: 'Do you offer takeaway pints or party tubs?',
      a: 'Yes! We pack signature scoops in insulated thermocool containers with frozen packs so you can take pints home to Kandy, Matale, or Colombo.',
    },
  ];

  return (
    <section id="location-contact" className="py-16 md:py-24 bg-[#FAF7F2] border-t border-[#E8DFC8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDE8EC] text-[#8C102A] text-xs font-bold uppercase tracking-wider mb-2">
            <MapPin className="w-3.5 h-3.5" />
            <span>Visit the Parlour</span>
          </div>
          <h2 className="font-serif-title text-3xl sm:text-4xl md:text-5xl font-bold text-[#241A18] tracking-tight">
            Find Us in Akurana, Kandy
          </h2>
          <p className="text-sm sm:text-base text-[#5D4E46] mt-2.5 leading-relaxed">
            Conveniently situated along the Matale Road with easy street parking and welcoming ambient lighting every evening.
          </p>
        </div>

        {/* Two Column Layout: Info Card + Interactive Map Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
          
          {/* Left Column: Hours & Contact Cards */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Address & Hours Box */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-sm space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FDE8EC] text-[#8C102A] flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif-title text-lg font-bold text-[#241A18]">
                    Amore Parlour Address
                  </h3>
                  <p className="text-sm text-[#5D4E46] mt-1 font-medium">
                    {PARLOUR_INFO.address}
                  </p>
                  <a
                    href={PARLOUR_INFO.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#8C102A] hover:underline mt-2"
                  >
                    <span>Open in Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Hours List */}
              <div className="pt-4 border-t border-[#E8DFC8] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7A6458]">
                  <Clock className="w-4 h-4 text-[#8C102A]" />
                  <span>Parlour Opening Hours</span>
                </div>
                <div className="space-y-2">
                  {PARLOUR_INFO.hours.map((h) => (
                    <div
                      key={h.days}
                      className="flex items-center justify-between text-xs sm:text-sm py-1.5 border-b border-[#FAF7F2] last:border-0"
                    >
                      <span className="font-semibold text-[#241A18]">{h.days}</span>
                      <span className="text-[#8C102A] font-medium">{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instant Call & WhatsApp Buttons */}
              <div className="pt-4 border-t border-[#E8DFC8] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={`https://wa.me/${PARLOUR_INFO.whatsapp.replace('+', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-full bg-[#25D366] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#1EBE5D] transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>WhatsApp Chat</span>
                </a>

                <a
                  href={`tel:${PARLOUR_INFO.phone}`}
                  className="py-3 px-4 rounded-full bg-[#FAF7F2] border border-[#E8DFC8] text-[#241A18] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#F3EDE3] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-[#8C102A]" />
                  <span>Call Parlour</span>
                </a>
              </div>
            </div>

            {/* In-House Promise list */}
            <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#241A18] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#8C102A]" />
                The Amore Quality Guarantee
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#5D4E46]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  100% Real Highland Dairy
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  No Artificial Food Dyes
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Cheesecakes Baked Daily
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Authentic Espresso Extractions
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: Interactive Maps Preview / Visual Directions Box */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-sm">
              <h3 className="font-serif-title text-xl font-bold text-[#241A18] mb-4">
                Location & Streetscape
              </h3>

              {/* Styled Mock Map Frame */}
              <div className="relative rounded-2xl overflow-hidden border border-[#E8DFC8] bg-[#F5EFE6] h-64 sm:h-72 flex flex-col items-center justify-center p-6 text-center shadow-inner">
                {/* Visual road grid simulation */}
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#8C102A_1px,transparent_1px)] [background-size:16px_16px]" />
                
                {/* Amore Parlour Pin */}
                <div className="relative z-10 flex flex-col items-center animate-bounce-short">
                  <AmoreLogo size="md" />
                  <div className="mt-2 bg-white/95 backdrop-blur-xs px-3 py-1 rounded-full shadow-md text-xs font-bold text-[#241A18] border border-[#E8DFC8]">
                    Amore Speciality Ice Cream
                  </div>
                  <span className="text-[10px] text-[#8C102A] font-semibold mt-0.5">
                    137, Matale Road, Akurana
                  </span>
                </div>

                {/* Map Directions Button Overlay */}
                <div className="absolute bottom-4 left-4 right-4 z-10">
                  <a
                    href={PARLOUR_INFO.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-white/95 hover:bg-white text-[#241A18] text-xs font-bold shadow-md flex items-center justify-center gap-2 border border-[#E8DFC8] transition-colors"
                  >
                    <span>Get Turn-by-Turn Directions in Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#8C102A]" />
                  </a>
                </div>
              </div>

              <div className="mt-4 text-xs text-[#5D4E46] leading-relaxed">
                Located right along the bustling Matale Road in Akurana. Look for our signature glowing circular Amore logo sign and warm rattan chandeliers!
              </div>
            </div>

            {/* Quick Accordion FAQs */}
            <div className="bg-white rounded-3xl p-6 border border-[#E8DFC8] shadow-sm space-y-3">
              <h4 className="font-serif-title text-base font-bold text-[#241A18] mb-2">
                Frequently Asked Questions
              </h4>

              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={faq.q}
                    className="border-b border-[#FAF7F2] last:border-0 pb-2.5"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full text-left py-1.5 flex items-center justify-between text-xs sm:text-sm font-semibold text-[#241A18] hover:text-[#8C102A] transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#8C102A] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#7A6458] shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <p className="text-xs text-[#5D4E46] mt-1.5 leading-relaxed pr-2">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
