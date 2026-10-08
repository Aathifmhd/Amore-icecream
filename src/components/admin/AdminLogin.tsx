import React, { useState } from 'react';
import { AmoreLogo } from '../AmoreLogo';
import { auth, googleProvider, signInWithPopup, signOut, type User } from '../../firebase';
import { ShieldCheck, ArrowLeft, AlertCircle, LogOut } from 'lucide-react';

interface AdminLoginProps {
  currentUser: User | null;
  onBackToStore: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ currentUser, onBackToStore }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error?.code !== 'auth/cancelled-popup-request' && error?.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Google sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut(auth);
    handleGoogleSignIn();
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#241A18] flex flex-col justify-center items-center px-4 py-12 selection:bg-[#8C102A] selection:text-white relative">
      {/* Decorative background ambient glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#8C102A]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Back to Storefront Link */}
        <button
          type="button"
          onClick={onBackToStore}
          className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#6B5A51] hover:text-[#8C102A] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Amore Storefront</span>
        </button>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-[#E8DFC8]/90">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] mb-4 shadow-2xs">
              <AmoreLogo size="md" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8C102A]/10 text-[#8C102A] text-[11px] font-bold tracking-wider uppercase mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Operations Portal</span>
            </div>
            <h1 className="font-serif-title text-2xl sm:text-3xl font-bold text-[#241A18]">
              Amore Admin Console
            </h1>
            <p className="text-xs text-[#7A6458] mt-1.5">
              Sign in with your staff Google account to manage orders and the menu.
            </p>
          </div>

          {/* Signed in with an account that isn't an admin */}
          {currentUser && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
              <span className="font-medium">
                <strong>{currentUser.email}</strong> doesn't have admin access. Sign in with an approved staff account.
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={currentUser ? handleSwitchAccount : handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Signing in...</span>
              </>
            ) : currentUser ? (
              <>
                <LogOut className="w-4 h-4 text-amber-300" />
                <span>Switch Google account</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#FFC107" d="M21.8 10.2H12v3.9h5.6c-.5 2.5-2.7 4.3-5.6 4.3a6.4 6.4 0 1 1 4.2-11.2l2.8-2.8A10.4 10.4 0 1 0 22 12c0-.6-.1-1.2-.2-1.8z" />
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          {/* Footer Notice */}
          <div className="mt-8 pt-6 border-t border-[#E8DFC8] text-center">
            <p className="text-[11px] text-[#8A7970]">
              Authorized operations personnel across <strong>Akurana</strong>, <strong>Colombo</strong> & <strong>Arugam Bay</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
