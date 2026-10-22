import React, { useEffect, useRef, useState } from 'react';
import { AmoreLogo } from '../AmoreLogo';
import { ApiError } from '../../api';
import { renderGoogleButton } from '../../customerAuth';
import {
  AdminGate,
  forgetThisDevice,
  isValidCodeFormat,
  setUserCode,
  signInOwnerWithGoogle,
  signInWithPassword,
  skipUserCode,
  unlockWithCode,
} from '../../utils/adminAuth';
import { ShieldCheck, ArrowLeft, AlertCircle, Eye, EyeOff, KeyRound, User as UserIcon, Lock } from 'lucide-react';

interface AdminLoginProps {
  gate: Exclude<AdminGate, 'open'>;
  /** Who set the user code on this device ("Welcome back, …") */
  deviceName: string | null;
  onBackToStore: () => void;
}

const INPUT =
  'w-full px-4 py-3 rounded-xl border border-[#D9CBB7] bg-[#FAF7F2]/60 text-sm font-semibold text-[#241A18] focus:bg-white focus:outline-hidden focus:border-[#81001E] focus:ring-2 focus:ring-[#81001E]/20 transition-all';
const PRIMARY =
  'w-full py-3.5 px-4 rounded-xl bg-[#81001E] hover:bg-[#9A0F2E] text-white font-bold text-sm tracking-wide shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed';
const LINK = 'text-xs font-bold text-[#81001E] hover:underline cursor-pointer';

const message = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

export const AdminLogin: React.FC<AdminLoginProps> = ({ gate, deviceName, onBackToStore }) => {
  // The code screen is the default when this device has one; name + password is always one tap away.
  const [usePassword, setUsePassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');

  const codeRef = useRef<HTMLInputElement>(null);
  const googleRef = useRef<HTMLDivElement>(null);
  const [showGoogle, setShowGoogle] = useState(false);
  const showCodeScreen = gate === 'needs-code' && !usePassword;

  useEffect(() => {
    if (showCodeScreen) codeRef.current?.focus();
  }, [showCodeScreen]);

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithPassword(name, password);
      setPassword('');
      setUsePassword(false);
    } catch (err) {
      setError(message(err, 'Sign-in failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // "Owner? Sign in with Google" shows Google's own button
  useEffect(() => {
    if (!showGoogle || !googleRef.current) return;
    renderGoogleButton(
      googleRef.current,
      async (credential) => {
        setError(null);
        setBusy(true);
        try {
          await signInOwnerWithGoogle(credential);
          setUsePassword(false);
        } catch (err) {
          setError(message(err, 'Google sign-in failed. Please try again.'));
        } finally {
          setBusy(false);
        }
      },
      { text: 'signin_with' }
    ).catch((err) => {
      setShowGoogle(false);
      setError(err?.message || 'Google sign-in is not available right now.');
    });
  }, [showGoogle]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCodeFormat(code)) {
      setError('Enter your 4–6 digit user code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { result, triesLeft, message: why } = await unlockWithCode(code);
      if (result === 'wrong') {
        setError(`Wrong code. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left before name and password are needed.`);
        codeRef.current?.focus();
      } else if (result === 'forgotten') {
        setUsePassword(true);
        setError(why || 'Please sign in with your name and password.');
      }
    } catch (err) {
      setError(message(err, 'Could not check the code. Please try again.'));
    } finally {
      setBusy(false);
      setCode('');
    }
  };

  const handleForgetDevice = async () => {
    await forgetThisDevice();
    setUsePassword(true);
    setError(null);
  };

  const handleSaveCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCodeFormat(newCode)) {
      setError('Use 4 to 6 digits.');
      return;
    }
    if (newCode !== confirmCode) {
      setError('The two codes do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setUserCode(newCode);
    } catch (err) {
      setError(message(err, 'Could not save the code. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // ---- Screens -----------------------------------------------------------

  let title = 'Amore Admin Console';
  let subtitle = 'Sign in with your admin name and password.';
  let body: React.ReactNode;

  if (gate === 'checking') {
    body = (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-[3px] border-[#81001E]/20 border-t-[#81001E] rounded-full animate-spin" />
      </div>
    );
  } else if (gate === 'offer-code') {
    title = 'Set a user code';
    subtitle = 'Next time on this device, open the console with just this code.';
    body = (
      <form onSubmit={handleSaveCode} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#3D2C24] uppercase tracking-wider mb-1.5" htmlFor="new-code">
            New user code (4–6 digits)
          </label>
          <input
            id="new-code"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ''))}
            className={`${INPUT} text-center text-2xl tracking-[0.6em]`}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#3D2C24] uppercase tracking-wider mb-1.5" htmlFor="confirm-code">
            Type it again
          </label>
          <input
            id="confirm-code"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ''))}
            className={`${INPUT} text-center text-2xl tracking-[0.6em]`}
          />
        </div>
        <button type="submit" disabled={busy} className={PRIMARY}>
          <KeyRound className="w-4 h-4 text-amber-200" />
          Save user code
        </button>
        <button type="button" onClick={skipUserCode} className="w-full text-center text-xs font-semibold text-[#7A6458] hover:text-[#241A18] cursor-pointer">
          Not now
        </button>
        <p className="text-[11px] text-[#8A7970] text-center leading-relaxed">
          The code only works on this device. Five wrong tries and the full name and password are needed again.
        </p>
      </form>
    );
  } else if (showCodeScreen) {
    title = deviceName ? `Welcome back, ${deviceName}` : 'Welcome back';
    subtitle = 'Enter your user code to open the console.';
    body = (
      <form onSubmit={handleUnlock} className="space-y-4">
        <input
          ref={codeRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          aria-label="User code"
          placeholder="••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className={`${INPUT} text-center text-3xl tracking-[0.7em] py-4 placeholder:tracking-[0.5em]`}
        />
        <button type="submit" disabled={busy || code.length < 4} className={PRIMARY}>
          <Lock className="w-4 h-4 text-amber-200" />
          {busy ? 'Checking…' : 'Unlock'}
        </button>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => { setUsePassword(true); setError(null); }} className={LINK}>
            Sign in with name and password instead
          </button>
          <button type="button" onClick={handleForgetDevice} className="text-[11px] font-semibold text-[#8A7970] hover:text-[#241A18] cursor-pointer">
            Forget this device
          </button>
        </div>
      </form>
    );
  } else {
    body = (
      <form onSubmit={handlePasswordSignIn} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#3D2C24] uppercase tracking-wider mb-1.5" htmlFor="admin-name">
            Name
          </label>
          <div className="relative">
            <UserIcon className="w-4 h-4 text-[#81001E] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="admin-name"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${INPUT} pl-10`}
              autoFocus
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-[#3D2C24] uppercase tracking-wider mb-1.5" htmlFor="admin-password">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#81001E] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${INPUT} pl-10 pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7A6458] hover:text-[#241A18]"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={busy} className={PRIMARY}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="flex items-center justify-between pt-1">
          {gate === 'needs-code' ? (
            <button type="button" onClick={() => { setUsePassword(false); setError(null); }} className={LINK}>
              Use my user code instead
            </button>
          ) : (
            <span />
          )}
          {!showGoogle && (
            <button type="button" onClick={() => setShowGoogle(true)} className="text-[11px] font-semibold text-[#8A7970] hover:text-[#241A18] cursor-pointer">
              Owner? Sign in with Google
            </button>
          )}
        </div>
        {showGoogle && <div ref={googleRef} className="flex justify-center pt-1 min-h-[44px]" />}
      </form>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#241A18] flex flex-col justify-center items-center px-4 py-12 relative">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#81001E]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <button
          type="button"
          onClick={onBackToStore}
          className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#6B5A51] hover:text-[#81001E] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Amore Storefront</span>
        </button>

        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-[#E8DFC8]/90">
          <div className="text-center mb-7">
            <AmoreLogo size="lg" className="mx-auto mb-4" />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#81001E]/10 text-[#81001E] text-[11px] font-bold tracking-wider uppercase mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Operations Portal</span>
            </div>
            <h1 className="font-serif-title text-2xl sm:text-3xl font-bold text-[#241A18]">{title}</h1>
            <p className="text-xs text-[#7A6458] mt-1.5">{subtitle}</p>
          </div>

          {error && (
            <div role="alert" className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {body}
        </div>
      </div>
    </div>
  );
};
