import React, { useState } from 'react';
import { AmoreLogo } from '../AmoreLogo';
import { verifyAdminCredentials, setAdminSession, ADMIN_EMAIL } from '../../utils/adminAuth';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBackToStore: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onBackToStore }) => {
  const [identifier, setIdentifier] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    setTimeout(() => {
      if (verifyAdminCredentials(identifier, password)) {
        setAdminSession(rememberMe);
        setIsLoading(false);
        onLoginSuccess();
      } else {
        setIsLoading(false);
        setErrorMsg('Invalid credentials. Please use admin@email.com and your password.');
      }
    }, 400);
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
              Sign in to manage live orders, menu catalog, and branch operations.
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Username Input */}
            <div>
              <label className="block text-xs font-bold text-[#3D2C24] uppercase tracking-wider mb-1.5">
                Admin Email / Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8C102A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@email.com"
                  autoComplete="username email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#D9CBB7] bg-[#FAF7F2]/50 text-sm font-semibold text-[#241A18] focus:bg-white focus:outline-hidden focus:border-[#8C102A] focus:ring-2 focus:ring-[#8C102A]/20 transition-all"
                />
              </div>
              <span className="text-[10px] text-[#7A6458] mt-1 block">
                Default: <strong>admin@email.com</strong>
              </span>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-bold text-[#3D2C24] uppercase tracking-wider mb-1.5">
                Security Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8C102A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#D9CBB7] bg-[#FAF7F2]/50 text-sm font-semibold text-[#241A18] focus:bg-white focus:outline-hidden focus:border-[#8C102A] focus:ring-2 focus:ring-[#8C102A]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A6458] hover:text-[#241A18] transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#5D4E46]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-[#8C102A] focus:ring-[#8C102A] w-4 h-4 border-[#D9CBB7]"
                />
                <span>Remember session</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-300" />
                  <span>Enter Dashboard</span>
                </>
              )}
            </button>
          </form>

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

