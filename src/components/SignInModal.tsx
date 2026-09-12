import React, { useState, useEffect } from 'react';
import { AmoreLogo } from './AmoreLogo';
import { auth, googleProvider, signInWithPopup, signOut, type User } from '../firebase';
import { X, LogIn, LogOut, CheckCircle2, ShieldCheck, Sparkles, Heart, AlertCircle } from 'lucide-react';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsLoading(false);
      // Automatically close modal after small delay upon successful sign in
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (error: any) {
      console.error('Sign-in error:', error);
      setIsLoading(false);
      if (error?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('The sign-in popup was closed before completing. Please try again.');
      } else if (error?.code === 'auth/popup-blocked') {
        setErrorMessage('Your browser blocked the sign-in popup. Please allow popups for this site.');
      } else if (error?.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else {
        setErrorMessage(error?.message || 'Failed to sign in with Google. Please try again.');
      }
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Sign-out error:', error);
      setIsLoading(false);
      setErrorMessage('Could not sign out. Please try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-[#FAF7F2] rounded-3xl shadow-2xl border border-[#E8DFC8] overflow-hidden p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#EAE0D0] transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3">
            <AmoreLogo size="lg" />
          </div>
          <h2 id="signin-modal-title" className="text-2xl font-bold font-serif-title text-[#241A18]">
            {currentUser ? 'Your Amore Account' : 'Welcome to Amore'}
          </h2>
          <p className="text-xs text-[#7A6458] mt-1 max-w-xs">
            Speciality Ice Cream, Coffee & Cakes &bull; Akurana &bull; Colombo &bull; Arugam Bay
          </p>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-800 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-600 hover:text-red-900 font-bold ml-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Body Content: Signed In vs Signed Out */}
        {currentUser ? (
          <div className="flex flex-col items-center">
            {/* User Profile Card */}
            <div className="w-full bg-white rounded-2xl p-4 border border-[#E8DFC8] shadow-xs mb-6 flex items-center gap-3.5">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User Profile'}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#8C102A]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#8C102A] text-white flex items-center justify-center font-bold text-lg">
                  {(currentUser.displayName || currentUser.email || 'A')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[#241A18] truncate">
                    {currentUser.displayName || 'Amore Guest'}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                    <CheckCircle2 className="w-3 h-3 mr-0.5 text-green-600" />
                    Active
                  </span>
                </div>
                <p className="text-xs text-[#7A6458] truncate">{currentUser.email}</p>
              </div>
            </div>

            {/* Sync Perks */}
            <div className="w-full space-y-2.5 mb-6 text-xs text-[#5D4E46]">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F4EDE2]/80">
                <Sparkles className="w-4 h-4 text-[#8C102A] shrink-0" />
                <span>Your orders and tasting preferences are securely synced.</span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F4EDE2]/80">
                <ShieldCheck className="w-4 h-4 text-[#8C102A] shrink-0" />
                <span>One-tap WhatsApp updates for all branch pickups.</span>
              </div>
            </div>

            {/* Actions */}
            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>{isLoading ? 'Signing out...' : 'Sign Out of Amore'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-sm transition-all shadow-md cursor-pointer active:scale-[0.99]"
              >
                Continue Browsing
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Benefits list */}
            <div className="w-full bg-white rounded-2xl p-4 border border-[#E8DFC8] shadow-xs mb-6 space-y-3 text-xs text-[#5D4E46]">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#8C102A]/10 text-[#8C102A] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  ✓
                </span>
                <span>
                  <strong className="text-[#241A18]">Live Order Tracking:</strong> Keep track of your scoop & cake orders in real-time.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#8C102A]/10 text-[#8C102A] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  ✓
                </span>
                <span>
                  <strong className="text-[#241A18]">Faster Checkout:</strong> Instant contact info and branch pickup auto-fill.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#8C102A]/10 text-[#8C102A] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  ✓
                </span>
                <span>
                  <strong className="text-[#241A18]">Cross-Device Sync:</strong> View orders placed on mobile from your laptop anytime.
                </span>
              </div>
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-[#FDFBF7] text-[#241A18] font-bold text-sm border-2 border-[#D9CBB7] hover:border-[#8C102A] shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 text-[#8C102A]">
                  <div className="w-5 h-5 border-2 border-[#8C102A] border-t-transparent rounded-full animate-spin" />
                  <span>Connecting with Google...</span>
                </div>
              ) : (
                <>
                  {/* Google SVG Icon */}
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span className="group-hover:text-[#8C102A] transition-colors">
                    Continue with Google
                  </span>
                </>
              )}
            </button>

            {/* Bottom Footer Disclaimer */}
            <p className="text-[11px] text-[#8A7970] text-center mt-4 leading-relaxed">
              Fast & secure login powered by Google Firebase.
              <br />
              We respect your privacy and will never share your email.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
