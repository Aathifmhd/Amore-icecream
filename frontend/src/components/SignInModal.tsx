import React, { useState, useEffect, useRef } from 'react';
import { AmoreLogo } from './AmoreLogo';
import { ApiError } from '../api';
import { renderGoogleButton, signInWithGoogleCredential, signOutCustomer, type User } from '../customerAuth';
import { X, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [buttonReady, setButtonReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  // The latest onClose, without re-drawing Google's button every time the page re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reset state when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Google's "Sign in with Google" button (loaded when the window opens)
  useEffect(() => {
    if (!isOpen || currentUser || !googleButtonRef.current) return;
    let cancelled = false;
    setButtonReady(false);
    renderGoogleButton(googleButtonRef.current, async (credential) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        await signInWithGoogleCredential(credential);
        onCloseRef.current();
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    })
      .then(() => !cancelled && setButtonReady(true))
      .catch((error) => !cancelled && setErrorMessage(error?.message || 'Google sign-in is not available right now.'));
    return () => {
      cancelled = true;
    };
  }, [isOpen, currentUser]);

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

  const handleSignOut = () => {
    signOutCustomer();
  };

  return (
    <div
      className="mobile-sheet-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="mobile-sheet-panel relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E8DFC8]/70 overflow-hidden p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3">
            <AmoreLogo size="md" />
          </div>

          <h2 id="auth-modal-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
            {currentUser ? 'Your Account' : 'Sign in to Amore'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xs">
            {currentUser
              ? 'Manage your Amore orders, tasting favorites, and session.'
              : 'Use your Google account to order and follow your orders across Akurana, Colombo & Arugam Bay.'}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-800 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="font-semibold flex-1">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-800 font-bold ml-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* View: User is Already Signed In */}
        {currentUser ? (
          <div className="flex flex-col items-center">
            <div className="w-full bg-[#FAF7F2] rounded-2xl p-4 border border-[#E8DFC8] shadow-2xs mb-6 flex items-center gap-3.5">
              {currentUser.photoURL ? (
                <img loading="lazy" decoding="async"
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
                  <span className="text-sm font-bold text-slate-800 truncate">
                    {currentUser.displayName || 'Amore Member'}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                    <CheckCircle2 className="w-3 h-3 mr-0.5 text-green-600" />
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-3 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>Sign Out</span>
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
          /* View: Signed out — Google's button */
          <div className="flex flex-col items-center gap-4">
            <div className="w-full min-h-[44px] flex justify-center relative">
              <div ref={googleButtonRef} className={`w-full flex justify-center ${isLoading ? 'opacity-40 pointer-events-none' : ''}`} />
              {(!buttonReady || isLoading) && !errorMessage && (
                <div className="absolute inset-0 flex items-center justify-center" aria-label="Loading">
                  <div className="w-6 h-6 border-2 border-[#8C102A]/25 border-t-[#8C102A] rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500 text-center leading-relaxed max-w-xs">
              We only use your name and email to look after your orders. Amore never sees your Google password.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
