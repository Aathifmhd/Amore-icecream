import React from 'react';
import { ArrowRight, Phone, Navigation, MessageCircle, Clock, Plus, Leaf, Cookie, Star } from 'lucide-react';
import { BranchId, Currency, MenuItem, MenuTab, ScoopItem } from '../../types';
import { AMORE_BRANCHES, ASSET_IMAGES } from '../../data/iceCreamData';
import { formatPrice } from '../../utils/currency';
import { AmoreLogo } from '../AmoreLogo';
import { CurrencyToggle } from '../CurrencyToggle';
import { isSoldOut, startingPriceLKR, useMenuItems } from './mobileHooks';

interface MobileHomeProps {
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  selectedBranch: BranchId;
  onSelectBranch: (b: BranchId) => void;
  onOpenMenu: (tab?: MenuTab) => void;
  onOpenItem: (item: ScoopItem | MenuItem) => void;
}

/** Short, task-first home page for phones: order, pick a branch, browse favourites. */
export const MobileHome: React.FC<MobileHomeProps> = ({
  currency,
  onToggleCurrency,
  selectedBranch,
  onSelectBranch,
  onOpenMenu,
  onOpenItem,
}) => {
  const { scoops, coffee, cakes } = useMenuItems();
  const branch = AMORE_BRANCHES.find((b) => b.id === selectedBranch) || AMORE_BRANCHES[0];
  const favourites = scoops.filter((s) => (s.isPopular || s.isIconic) && !isSoldOut(s)).slice(0, 8);
  const durian = scoops.find((s) => s.id === 'durian-best');

  const categories: { tab: MenuTab; label: string; count: number; image?: string }[] = [
    { tab: 'scoops', label: 'Gelato', count: scoops.length, image: ASSET_IMAGES.pistachioScoop },
    { tab: 'coffee', label: 'Coffee', count: coffee.length, image: coffee[0]?.image },
    { tab: 'cakes', label: 'Cakes', count: cakes.length, image: ASSET_IMAGES.cheesecakeCoffee },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#241A18] pb-28">
      {/* Slim header */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFC8]/70">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AmoreLogo size="sm" />
            <span className="font-serif-title text-xl font-bold">Amore</span>
          </div>
          <CurrencyToggle currency={currency} onToggle={onToggleCurrency} />
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 pt-4">
        <div className="relative h-[22rem] rounded-[1.75rem] overflow-hidden shadow-lg">
          <img
            src={ASSET_IMAGES.heroBanner}
            alt="Amore gelato in waffle cones and biscuit cups"
            fetchPriority="high"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#241A18]/90 via-[#241A18]/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200">Speciality ice cream · coffee · cakes</p>
            <h1 className="font-serif-title text-[2rem] leading-[1.1] font-bold mt-1.5">
              Real flavours.
              <br />
              <em className="text-amber-200">Handcrafted</em> happiness.
            </h1>
            <p className="text-sm text-white/85 mt-2">20 small-batch flavours from LKR 650</p>
            <button
              type="button"
              onClick={() => onOpenMenu('all')}
              className="mt-4 w-full h-12 rounded-full bg-[#8C102A] active:bg-[#730D22] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg"
            >
              Order now
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Branch picker */}
      <section className="px-4 pt-6" aria-labelledby="branch-heading">
        <h2 id="branch-heading" className="text-xs font-bold uppercase tracking-wider text-[#7A6458] mb-2">
          Your parlour
        </h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Choose a branch">
          {AMORE_BRANCHES.map((b) => {
            const selected = b.id === selectedBranch;
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelectBranch(b.id)}
                className={`h-12 rounded-2xl border-2 text-sm font-bold transition-colors ${
                  selected ? 'border-[#8C102A] bg-[#8C102A] text-white' : 'border-[#E8DFC8] bg-white text-[#3D2C24]'
                }`}
              >
                {b.id === 'akurana' ? 'Akurana' : b.id === 'colombo' ? 'Colombo' : 'Arugam Bay'}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[#5C4D44] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#8C102A] shrink-0" />
          {branch.hours}
        </p>
      </section>

      {/* Categories */}
      <section className="px-4 pt-6" aria-labelledby="cat-heading">
        <h2 id="cat-heading" className="font-serif-title text-xl font-bold mb-3">
          What are you craving?
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {categories.map((c) => (
            <button
              key={c.tab}
              type="button"
              onClick={() => onOpenMenu(c.tab)}
              className="relative h-28 rounded-2xl overflow-hidden text-left shadow-sm"
            >
              {c.image && (
                <img src={c.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/0" />
              <span className="absolute bottom-2 left-2.5 text-white">
                <span className="block font-bold text-[15px] leading-tight">{c.label}</span>
                <span className="block text-[11px] text-white/80">{c.count} items</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Favourites carousel */}
      {favourites.length > 0 && (
        <section className="pt-7" aria-labelledby="fav-heading">
          <div className="px-4 flex items-baseline justify-between mb-3">
            <h2 id="fav-heading" className="font-serif-title text-xl font-bold">
              Most loved
            </h2>
            <button type="button" onClick={() => onOpenMenu('scoops')} className="text-sm font-bold text-[#8C102A]">
              See all
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 snap-x snap-mandatory pb-1">
            {favourites.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenItem(s)}
                className="snap-start shrink-0 w-40 bg-white rounded-3xl border border-[#E8DFC8] overflow-hidden text-left shadow-xs"
              >
                <span className="block relative h-32 bg-[#F3EDE3]">
                  <img src={s.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  {s.isIconic && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold bg-[#8C102A] text-white px-2 py-0.5 rounded-full">
                      Signature
                    </span>
                  )}
                </span>
                <span className="flex items-end justify-between gap-1 p-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-sm truncate">{s.name}</span>
                    <span className="block text-xs font-bold text-[#8C102A]">from {formatPrice(startingPriceLKR(s), currency)}</span>
                  </span>
                  <span className="w-8 h-8 rounded-full bg-[#8C102A] text-white flex items-center justify-center shrink-0" aria-hidden="true">
                    <Plus className="w-4 h-4" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Durian spotlight */}
      {durian && (
        <section className="px-4 pt-7">
          <button
            type="button"
            onClick={() => onOpenItem(durian)}
            className="w-full flex items-stretch rounded-3xl overflow-hidden bg-[#241A18] text-left shadow-md"
          >
            <img src={ASSET_IMAGES.durianCone} alt="" loading="lazy" decoding="async" className="w-32 object-cover shrink-0" />
            <span className="p-4 text-white">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                <Star className="w-3 h-3 fill-amber-300" /> Our legend
              </span>
              <span className="block font-serif-title text-xl font-bold leading-tight mt-1">The iconic Durian custard</span>
              <span className="block text-xs text-white/75 mt-1">The flavour that made Amore famous.</span>
              <span className="inline-flex items-center gap-1 mt-2.5 text-sm font-bold text-amber-200">
                Try it · {formatPrice(startingPriceLKR(durian), currency)} <ArrowRight className="w-4 h-4" />
              </span>
            </span>
          </button>
        </section>
      )}

      {/* Why Amore */}
      <section className="px-4 pt-7">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: <Cookie className="w-5 h-5" />, title: 'Edible cups', text: 'Eat the cup, zero waste' },
            { icon: <Leaf className="w-5 h-5" />, title: 'Real fruit', text: 'Small-batch, fresh daily' },
            { icon: <Star className="w-5 h-5" />, title: '100% Halal', text: 'Eggless options' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-[#E8DFC8] p-3">
              <span className="mx-auto w-9 h-9 rounded-full bg-[#FDE8EC] text-[#8C102A] flex items-center justify-center">{f.icon}</span>
              <span className="block text-xs font-bold mt-1.5">{f.title}</span>
              <span className="block text-[10px] text-[#7A6458] leading-snug mt-0.5">{f.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Branches */}
      <section id="mobile-branches" className="px-4 pt-8" aria-labelledby="visit-heading">
        <h2 id="visit-heading" className="font-serif-title text-xl font-bold mb-3">
          Visit us
        </h2>
        <div className="space-y-3">
          {AMORE_BRANCHES.map((b) => (
            <article key={b.id} className="bg-white rounded-3xl border border-[#E8DFC8] overflow-hidden">
              <div className="flex gap-3 p-3">
                <img src={b.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-20 h-20 rounded-2xl object-cover shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-[15px]">{b.name}</h3>
                  <p className="text-xs text-[#5C4D44] mt-0.5">{b.address}</p>
                  <p className="text-[11px] text-[#7A6458] mt-1">🕒 {b.hours}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-[#F0E8DC] text-xs font-bold text-[#8C102A]">
                <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="h-11 flex items-center justify-center gap-1.5">
                  <Phone className="w-4 h-4" /> Call
                </a>
                <a
                  href={b.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 flex items-center justify-center gap-1.5 border-x border-[#F0E8DC]"
                >
                  <Navigation className="w-4 h-4" /> Directions
                </a>
                <a
                  href={`https://wa.me/${b.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="px-4 pt-8 pb-4 text-center text-[11px] text-[#A8988B]">
        © {new Date().getFullYear()} Amore Speciality Ice Cream, Coffee & Cakes
      </footer>
    </div>
  );
};
