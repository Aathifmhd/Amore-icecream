import React from 'react';
import { AmoreLogo } from './AmoreLogo';
import { Reveal } from './Reveal';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import { Instagram, Phone, Heart, ArrowUp, MessageCircle, Navigation, Clock } from 'lucide-react';

const SOCIAL_BUTTON =
  'w-11 h-11 rounded-full bg-white/10 hover:bg-white hover:text-[#81001E] text-white flex items-center justify-center transition-all duration-300 hover:-translate-y-1';

/** Crimson brand footer with the official logo, branches and contact links. */
export const Footer: React.FC = () => {
  const flagship = AMORE_BRANCHES[0];

  return (
    <footer className="relative mt-16 rounded-t-[3rem] bg-[#81001E] text-white overflow-hidden">
      {/* Soft glow behind the logo */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-white/[0.06] blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-8">
        {/* Logo + promise */}
        <Reveal className="text-center">
          <AmoreLogo size="xl" showShadow={false} className="mx-auto w-28 h-28 ring-[6px] ring-white/15 float-y" />
          <p className="font-serif-title text-4xl font-bold mt-6">
            Real flavours. <em className="text-amber-200">Handcrafted</em> happiness.
          </p>
          <p className="text-white/75 mt-2 max-w-xl mx-auto">
            Sri Lanka's artisanal ice cream parlour — famous for our Iconic Durian Custard, 20 handcrafted flavours in edible
            biscuit cups, barista coffee and fresh cakes.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a href="https://instagram.com/amoreicecreamsl" target="_blank" rel="noopener noreferrer" aria-label="Amore on Instagram" className={SOCIAL_BUTTON}>
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href={`https://wa.me/${flagship.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp Amore"
              className={SOCIAL_BUTTON}
            >
              <MessageCircle className="w-5 h-5" />
            </a>
            <a href={`tel:${flagship.phone.replace(/\s/g, '')}`} aria-label="Call Amore" className={SOCIAL_BUTTON}>
              <Phone className="w-5 h-5" />
            </a>
          </div>
        </Reveal>

        {/* Branches */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
          {AMORE_BRANCHES.map((b, i) => (
            <Reveal key={b.id} delay={i * 120}>
              <div className="h-full rounded-3xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 p-5 transition-colors">
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200">{b.badge || 'Parlour'}</p>
                <h4 className="font-serif-title text-xl font-bold mt-1">{b.name}</h4>
                <p className="text-sm text-white/70 mt-1">{b.address}</p>
                <p className="text-xs text-white/60 mt-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {b.hours}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
                  <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 hover:bg-white hover:text-[#81001E] px-3.5 py-1.5 transition-colors">
                    <Phone className="w-3.5 h-3.5" /> {b.phone}
                  </a>
                  <a
                    href={b.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Directions to ${b.name}`}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 hover:bg-white hover:text-[#81001E] px-3.5 py-1.5 transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Directions
                  </a>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Quick links */}
        <nav aria-label="Footer" className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-white/80">
          <a href="#full-menu" className="hover:text-amber-200 transition-colors">Full menu</a>
          <a href="#durian-spotlight" className="hover:text-amber-200 transition-colors">The Durian legend</a>
          <a href="#biscuit-cups" className="hover:text-amber-200 transition-colors">Edible biscuit cups</a>
          <a href="#our-branches" className="hover:text-amber-200 transition-colors">Our branches</a>
        </nav>

        {/* Bottom row */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/55">
          <span className="flex items-center gap-1.5">
            © {new Date().getFullYear()} Amore Speciality Ice Cream, Coffee & Cakes · Crafted with
            <Heart className="w-3 h-3 text-amber-200 fill-current" /> in Sri Lanka
          </span>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white hover:text-[#81001E] text-white transition-colors cursor-pointer"
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
