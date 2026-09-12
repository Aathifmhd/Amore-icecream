import React, { useState, useEffect } from 'react';
import { AmoreLogo } from './AmoreLogo';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  type User,
} from '../firebase';
import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { verifyAdminCredentials, setAdminSession } from '../utils/adminAuth';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

type AuthMode = 'signin' | 'signup' | 'forgot_password';

export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose, currentUser }) => {
  // Mode: 'signin', 'signup', or 'forgot_password'
  const [mode, setMode] = useState<AuthMode>('signin');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset state when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsLoading(false);
      setShowPassword(false);
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

  // Format Firebase auth error into user-friendly message
  const getFriendlyErrorMessage = (error: any): string => {
    const code = error?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password. Please check and try again.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email. Try signing in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/popup-closed-by-user':
        return 'The Google sign-in window was closed before completion.';
      case 'auth/popup-blocked':
        return 'The sign-in popup was blocked by your browser. Please allow popups.';
      case 'auth/too-many-requests':
        return 'Too many unsuccessful attempts. Please wait a few moments and try again.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not enabled in Firebase Console. Please enable Email/Password under Firebase Console -> Authentication -> Sign-in method, or sign in using Google.';
      default:
        return error?.message || 'Authentication failed. Please try again.';
    }
  };

  // Google Sign In
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsLoading(false);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      setIsLoading(false);
      if (error?.code !== 'auth/cancelled-popup-request') {
        setErrorMessage(getFriendlyErrorMessage(error));
      }
    }
  };

  // Email/Password Submit (Sign In or Sign Up)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    // Forgot password flow
    if (mode === 'forgot_password') {
      setIsLoading(true);
      try {
        await sendPasswordResetEmail(auth, email.trim());
        setIsLoading(false);
        setSuccessMessage('Password reset link sent! Check your inbox.');
      } catch (error: any) {
        setIsLoading(false);
        setErrorMessage(getFriendlyErrorMessage(error));
      }
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    // Check if admin credentials were entered into this modal!
    if (verifyAdminCredentials(email.trim(), password)) {
      setAdminSession(rememberMe);
      setIsLoading(false);
      setSuccessMessage('Admin credentials verified! Entering Operations Console...');
      setTimeout(() => {
        onClose();
        const url = new URL(window.location.href);
        url.searchParams.set('page', 'admin');
        window.history.pushState({}, '', url.toString());
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 500);
      return;
    }

    try {
      if (mode === 'signup') {
        // Create new account
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim() && userCredential.user) {
          await updateProfile(userCredential.user, { displayName: displayName.trim() });
        }
        setIsLoading(false);
        setSuccessMessage('Account created successfully!');
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        // Sign In
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setIsLoading(false);
        setTimeout(() => {
          onClose();
        }, 500);
      }
    } catch (error: any) {
      setIsLoading(false);
      setErrorMessage(getFriendlyErrorMessage(error));
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setIsLoading(false);
    } catch (error: any) {
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
      aria-labelledby="auth-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E8DFC8]/70 overflow-hidden p-6 sm:p-8"
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

        {/* Back button when in forgot password mode */}
        {mode === 'forgot_password' && !currentUser && (
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="absolute top-4 left-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
            aria-label="Back to sign in"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3">
            <AmoreLogo size="md" />
          </div>

          <h2 id="auth-modal-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
            {currentUser
              ? 'Your Account'
              : mode === 'signin'
              ? 'Welcome Back'
              : mode === 'signup'
              ? 'Create an Account'
              : 'Reset Password'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xs">
            {currentUser
              ? 'Manage your Amore orders, tasting favorites, and session.'
              : mode === 'signin'
              ? 'Enter your credentials to access your flavour profile & orders.'
              : mode === 'signup'
              ? 'Sign up to track artisanal orders across Akurana, Colombo & Arugam Bay.'
              : 'Enter your email and we’ll send you instructions to reset your password.'}
          </p>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-emerald-800 text-xs animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="font-semibold flex-1">{successMessage}</p>
          </div>
        )}

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
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>{isLoading ? 'Signing out...' : 'Sign Out'}</span>
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
          /* View: Signed Out Form (Matches Image Structure) */
          <div>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Sign Up Mode: Name Field */}
              {mode === 'signup' && (
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#8C102A] focus:ring-2 focus:ring-[#8C102A]/15 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Email Input Field */}
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#8C102A] focus:ring-2 focus:ring-[#8C102A]/15 transition-all"
                  />
                </div>
              </div>

              {/* Password Input Field (hidden in forgot_password mode) */}
              {mode !== 'forgot_password' && (
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Create a password (min. 6 chars)' : 'Enter your password'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      className="w-full pl-10 pr-11 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#8C102A] focus:ring-2 focus:ring-[#8C102A]/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember Me & Forgot Password Row (Only in Sign In mode) */}
              {mode === 'signin' && (
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 text-slate-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#8C102A] focus:ring-[#8C102A] cursor-pointer"
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="font-semibold text-[#8C102A] hover:text-[#A31634] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Primary Action Button (Sign In / Sign Up / Reset) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 mt-2 rounded-2xl bg-gradient-to-r from-[#8C102A] to-[#A31634] hover:from-[#780D24] hover:to-[#8C102A] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>
                    {mode === 'signin'
                      ? 'Sign In'
                      : mode === 'signup'
                      ? 'Create Account'
                      : 'Send Reset Link'}
                  </span>
                )}
              </button>
            </form>

            {/* OR Divider (in signin and signup modes) */}
            {mode !== 'forgot_password' && (
              <>
                <div className="relative my-4 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      OR
                    </span>
                  </div>
                </div>

                {/* Continue with Google Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50/90 text-slate-700 font-bold text-sm border border-slate-200 shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                  <span>Continue with Google</span>
                </button>
              </>
            )}

            {/* Bottom Toggle Footer */}
            <div className="text-xs text-slate-500 text-center mt-5">
              {mode === 'signin' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-[#8C102A] hover:text-[#A31634] hover:underline cursor-pointer"
                  >
                    Sign up
                  </button>
                </p>
              ) : mode === 'signup' ? (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-[#8C102A] hover:text-[#A31634] hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p>
                  Remembered your password?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-[#8C102A] hover:text-[#A31634] hover:underline cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
