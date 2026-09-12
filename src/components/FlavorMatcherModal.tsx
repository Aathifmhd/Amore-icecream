import React, { useState } from 'react';
import { SIGNATURE_SCOOPS } from '../data/iceCreamData';
import { ScoopItem } from '../types';
import { Sparkles, X, ArrowRight, RotateCcw, MapPin } from 'lucide-react';

interface FlavorMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanVisit?: () => void;
}

export const FlavorMatcherModal: React.FC<FlavorMatcherModalProps> = ({
  isOpen,
  onClose,
  onPlanVisit,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [craving, setCraving] = useState<string | null>(null);
  const [recommendedScoop, setRecommendedScoop] = useState<ScoopItem | null>(null);

  if (!isOpen) return null;

  const handleSelectCraving = (key: string) => {
    setCraving(key);
    setStep(2);
  };

  const handleSelectVibe = (vibe: string) => {
    let matchId = 'iconic-durian';

    if (vibe === 'legendary' || craving === 'custard') {
      matchId = 'iconic-durian';
    } else if (craving === 'chocolate') {
      matchId = 'belgian-dark-truffle';
    } else if (craving === 'fruity') {
      matchId = vibe === 'tart' ? 'alphonso-mango-passion' : 'wild-blueberry-cheesecake';
    } else if (craving === 'nuts') {
      matchId = 'royal-pistachio';
    } else if (craving === 'local') {
      matchId = 'kithul-treacle-coconut';
    } else {
      matchId = 'ceylon-vanilla-honeycomb';
    }

    const found = SIGNATURE_SCOOPS.find((s) => s.id === matchId) || SIGNATURE_SCOOPS[0];
    setRecommendedScoop(found);
  };

  const resetQuiz = () => {
    setStep(1);
    setCraving(null);
    setRecommendedScoop(null);
  };

  const handleTasteAtParlour = () => {
    onClose();
    if (onPlanVisit) {
      onPlanVisit();
    } else {
      document.getElementById('location-contact')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-[#E8DFC8] p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#7A6458] hover:text-[#241A18] p-1.5 rounded-full hover:bg-[#F3EDE3] transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FDE8EC] text-[#8C102A] text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Amore Sommelier</span>
          </div>
          <h3 className="font-serif-title text-2xl font-bold text-[#241A18]">
            Find Your Scoop Soulmate
          </h3>
          <p className="text-xs text-[#5D4E46] mt-1">
            Answer 2 quick questions to discover your ideal flavour for today.
          </p>
        </div>

        {/* Step 1: Craving */}
        {!recommendedScoop && step === 1 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] text-center">
              Step 1: What texture / flavor are you craving?
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { id: 'custard', label: 'Silky, Exotic & Custard-Rich', hint: 'Think velvety tropical cream' },
                { id: 'chocolate', label: 'Deep Bittersweet Cocoa Truffle', hint: 'Rich Belgian 70% dark fudge' },
                { id: 'fruity', label: 'Tangy Berries & Cheesecake Crunch', hint: 'Cheesecake swirl or passionfruit' },
                { id: 'nuts', label: 'Aromatic Roasted Pistachio & Cardamom', hint: 'Nutty Mediterranean luxury' },
                { id: 'local', label: 'Authentic Sri Lankan Kithul Treacle', hint: 'Coconut cream & palm honeycomb' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectCraving(opt.id)}
                  className="p-3 rounded-xl border border-[#E8DFC8] bg-[#FAF7F2] hover:bg-[#F3EDE3] hover:border-[#8C102A] text-left transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#241A18] group-hover:text-[#8C102A]">
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-[#7A6458]">{opt.hint}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#7A6458] group-hover:text-[#8C102A] group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Vibe */}
        {!recommendedScoop && step === 2 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] text-center">
              Step 2: What's your adventurous level today?
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { id: 'legendary', label: 'Bold & Adventurous — The Island Legend!', desc: 'Ready for Akurana’s iconic specialty' },
                { id: 'classic', label: 'Refined Artisanal Comfort', desc: 'Balanced, smooth and reliable' },
                { id: 'tart', label: 'Crisp, Zesty & Refreshing', desc: 'Bright palate cleanser' },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleSelectVibe(v.id)}
                  className="p-3.5 rounded-xl border border-[#E8DFC8] bg-[#FAF7F2] hover:bg-[#FDE8EC] hover:border-[#8C102A] text-left transition-all cursor-pointer"
                >
                  <div className="text-xs sm:text-sm font-bold text-[#241A18]">{v.label}</div>
                  <div className="text-[11px] text-[#7A6458] mt-0.5">{v.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              className="w-full text-center text-xs text-[#7A6458] hover:text-[#241A18] pt-2"
            >
              ← Back to question 1
            </button>
          </div>
        )}

        {/* Result Screen */}
        {recommendedScoop && (
          <div className="space-y-4 text-center animate-fadeIn">
            <div className="relative w-36 h-36 mx-auto rounded-full overflow-hidden border-4 border-[#8C102A]/20 shadow-md">
              <img
                src={recommendedScoop.image}
                alt={recommendedScoop.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C102A]">
                Your Perfect Amore Match
              </span>
              <h4 className="font-serif-title text-xl font-bold text-[#241A18] mt-0.5">
                {recommendedScoop.name}
              </h4>
              <p className="text-xs text-[#7A6458] mt-1 italic">
                "{recommendedScoop.tagline}"
              </p>
            </div>

            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DFC8] text-xs text-[#5D4E46]">
              {recommendedScoop.description}
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={resetQuiz}
                  className="p-3 rounded-full border border-[#E8DFC8] text-[#7A6458] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                  title="Try Again"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={handleTasteAtParlour}
                  className="flex-1 py-3 px-4 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md bg-[#8C102A] text-white hover:bg-[#720B21]"
                >
                  <MapPin className="w-4 h-4 text-amber-300" />
                  <span>Taste at Akurana Parlour (LKR {recommendedScoop.priceLKR})</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
