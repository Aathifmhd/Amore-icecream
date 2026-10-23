import React, { useState } from 'react';
import { AlertCircle, KeyRound, Loader2, Phone } from 'lucide-react';
import { AmoreLogo } from '../components/AmoreLogo';
import { ApiError } from '../api';
import { riderSignIn } from './riderApi';

/** Phone number + PIN. The parlour manager adds riders and gives them their PIN. */
export const RiderLogin: React.FC<{ notice?: string | null; onSignedIn: () => void }> = ({ notice, onSignedIn }) => {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.replace(/\D/g, '').length < 9) return setError('Enter your mobile number, e.g. 077 123 4567.');
    if (!/^\d{4,6}$/.test(pin)) return setError('Enter your 4 to 6 digit PIN.');
    setBusy(true);
    setError(null);
    try {
      await riderSignIn(phone, pin);
      onSignedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Check your internet and try again.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full h-14 pl-12 pr-4 rounded-2xl bg-white border border-[#E0D5C3] text-lg text-[#241A18] outline-hidden focus:border-[#8C102A] focus:ring-2 focus:ring-[#8C102A]/15 placeholder:text-[#B5A796]';

  return (
    <div className="min-h-[100dvh] bg-[#FAF7F2] flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md w-full mx-auto">
        <div className="text-center">
          <AmoreLogo size="lg" className="mx-auto" />
          <h1 className="font-serif-title text-3xl font-bold text-[#241A18] mt-5">Amore Riders</h1>
          <p className="text-[#7A6458] mt-2">Sign in to see orders ready to deliver.</p>
        </div>

        <form onSubmit={submit} noValidate className="mt-8 space-y-4">
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </p>
          )}
          <label className="block">
            <span className="block text-sm font-bold text-[#5C4D44] mb-1.5">Mobile number</span>
            <span className="relative block">
              <Phone className="w-5 h-5 text-[#A8988B] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="077 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={field}
              />
            </span>
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-[#5C4D44] mb-1.5">PIN</span>
            <span className="relative block">
              <KeyRound className="w-5 h-5 text-[#A8988B] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={6}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className={`${field} tracking-[0.4em]`}
              />
            </span>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full h-14 rounded-2xl bg-[#8C102A] hover:bg-[#A31634] text-white text-lg font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-60"
          >
            {busy && <Loader2 className="w-5 h-5 animate-spin" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-[#8A7970] mt-6">Forgot your PIN? Ask your parlour manager.</p>
      </div>
    </div>
  );
};
