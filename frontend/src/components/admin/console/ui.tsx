/**
 * Small, consistent building blocks for the operations console:
 * buttons, badges, cards, dialogs, a side panel, a switch and toasts.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---- Button ----------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#81001E] text-white hover:bg-[#9A0F2E] shadow-sm',
  secondary: 'bg-white text-[#241A18] border border-[#E2D8CA] hover:border-[#C9B9A4] hover:bg-[#FBF8F3]',
  ghost: 'text-[#5C4D44] hover:bg-[#F3EDE3]',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: React.ReactNode }
> = ({ variant = 'secondary', size = 'md', icon, className, children, ...rest }) => (
  <button
    type="button"
    {...rest}
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
      size === 'sm' && 'h-9 px-3 text-sm',
      size === 'md' && 'h-11 px-4 text-sm',
      size === 'lg' && 'h-12 px-5 text-base',
      VARIANTS[variant],
      className
    )}
  >
    {icon}
    {children}
  </button>
);

// ---- Badge -----------------------------------------------------------------

export type Tone = 'amber' | 'blue' | 'violet' | 'green' | 'grey' | 'red' | 'crimson';
const TONES: Record<Tone, string> = {
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  grey: 'bg-stone-100 text-stone-600 ring-stone-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  crimson: 'bg-[#81001E]/10 text-[#81001E] ring-[#81001E]/20',
};
export const DOT: Record<Tone, string> = {
  amber: 'bg-amber-500',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
  green: 'bg-emerald-500',
  grey: 'bg-stone-400',
  red: 'bg-red-500',
  crimson: 'bg-[#81001E]',
};

export const Badge: React.FC<{ tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }> = ({
  tone = 'grey',
  dot,
  className,
  children,
}) => (
  <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap', TONES[tone], className)}>
    {dot && <span className={cx('w-1.5 h-1.5 rounded-full', DOT[tone])} />}
    {children}
  </span>
);

// ---- Card ------------------------------------------------------------------

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div {...rest} className={cx('bg-white rounded-2xl border border-[#EAE2D6] shadow-[0_1px_2px_rgba(36,26,24,0.04)]', className)} />
);

/** One figure on a page's top row: an icon and label, the value, and a short hint */
export const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; hint: string; alert?: boolean }> = ({ icon, label, value, hint, alert }) => (
  <Card className={cx('p-4', alert && 'border-red-200 bg-red-50/40')}>
    <p className="text-sm text-[#7A6458] flex items-center gap-2">
      <span className={alert ? 'text-red-600' : 'text-[#81001E]'}>{icon}</span>
      {label}
    </p>
    <p className="text-2xl font-bold text-[#241A18] mt-1.5">{value}</p>
    <p className={cx('text-xs mt-0.5', alert ? 'text-red-700 font-semibold' : 'text-[#8A7970]')}>{hint}</p>
  </Card>
);

// ---- Switch ----------------------------------------------------------------

export const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({
  checked,
  onChange,
  label,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cx(
      'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50',
      checked ? 'bg-emerald-500' : 'bg-stone-300'
    )}
  >
    <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
  </button>
);

// ---- Overlay helpers -------------------------------------------------------

function useOverlay(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
}

/** Centered dialog on desktop, bottom sheet on phones. */
export const Dialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ open, onClose, title, description, children, footer, wide }) => {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 animate-fadeIn cursor-default" />
      <div
        className={cx(
          'relative w-full bg-white shadow-2xl rounded-t-3xl sm:rounded-2xl max-h-[92dvh] flex flex-col animate-sheet-up sm:animate-scaleUp',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#241A18]">{title}</h2>
            {description && <p className="text-sm text-[#6B5A51] mt-1">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -m-2 rounded-lg text-[#7A6458] hover:bg-[#F3EDE3] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children && <div className="px-5 pb-4 overflow-y-auto">{children}</div>}
        {footer && <div className="px-5 py-4 border-t border-[#F0E8DC] flex flex-wrap justify-end gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
};

/**
 * A popup window for details and forms: centred over the page on larger screens,
 * a sheet that slides up from the bottom on phones. Confirmations (Dialog) open above it.
 */
export const Popup: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Wider window, for content with more columns (e.g. an order). */
  wide?: boolean;
}> = ({ open, onClose, title, subtitle, children, footer, wide }) => {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#241A18]/45 backdrop-blur-[2px] animate-fadeIn cursor-default" />
      <div
        className={cx(
          'popup-in relative w-full flex flex-col overflow-hidden bg-[#FCFAF7] shadow-2xl ring-1 ring-black/5',
          'rounded-t-3xl sm:rounded-3xl max-h-[94dvh] sm:max-h-[88vh]',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'
        )}
      >
        <span className="sm:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-[#E2D8CA]" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-3 sm:pt-5 pb-4 bg-white border-b border-[#EAE2D6]">
          <div className="min-w-0">
            <div className="text-lg font-bold text-[#241A18] truncate">{title}</div>
            {subtitle && <div className="text-sm text-[#6B5A51] mt-0.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 -mr-1.5 shrink-0 rounded-full flex items-center justify-center text-[#7A6458] bg-[#F7F3EC] hover:bg-[#EFE7DB] hover:text-[#241A18] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-4 bg-white border-t border-[#EAE2D6] flex flex-wrap gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
};

// ---- Confirm (promise-based replacement for window.confirm) ----------------

interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;

// ---- Toasts ----------------------------------------------------------------

type ToastFn = (message: string, tone?: 'success' | 'error') => void;

const ConsoleUiContext = createContext<{ confirm: ConfirmFn; toast: ToastFn } | null>(null);

export const ConsoleUiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: 'success' | 'error' }[]>([]);
  const nextId = useRef(0);

  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => setPending({ ...o, resolve })), []);
  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };
  const toast = useCallback<ToastFn>((message, tone = 'success') => {
    const id = ++nextId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ConsoleUiContext.Provider value={{ confirm, toast }}>
      {children}
      <Dialog
        open={!!pending}
        onClose={() => close(false)}
        title={pending?.title || ''}
        description={pending?.message}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Go back
            </Button>
            <Button variant={pending?.danger ? 'primary' : 'primary'} className={pending?.danger ? '!bg-red-600 hover:!bg-red-700' : ''} onClick={() => close(true)}>
              {pending?.confirmLabel || 'Confirm'}
            </Button>
          </>
        }
      />
      <div className="fixed z-[90] left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 flex flex-col items-center gap-2 pointer-events-none w-[calc(100%-2rem)] max-w-sm" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto w-full flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl animate-toast-in',
              t.tone === 'success' ? 'bg-[#241A18] text-white' : 'bg-red-600 text-white'
            )}
          >
            {t.tone === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>
    </ConsoleUiContext.Provider>
  );
};

export function useConsoleUi() {
  const ctx = useContext(ConsoleUiContext);
  if (!ctx) throw new Error('useConsoleUi must be used inside ConsoleUiProvider');
  return ctx;
}

// ---- Form fields -----------------------------------------------------------

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({ label, hint, children, className }) => (
  <label className={cx('block', className)}>
    <span className="block text-sm font-semibold text-[#3D2C24] mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-xs text-[#8A7970] mt-1">{hint}</span>}
  </label>
);

export const inputClass =
  'w-full h-11 px-3.5 rounded-xl border border-[#E2D8CA] bg-white text-sm text-[#241A18] placeholder:text-[#A8988B] focus:outline-hidden focus:border-[#81001E] focus:ring-2 focus:ring-[#81001E]/15';

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; children?: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="text-center py-14 px-4">
    {icon && <div className="mx-auto w-12 h-12 rounded-2xl bg-[#F3EDE3] text-[#81001E] flex items-center justify-center mb-3">{icon}</div>}
    <p className="font-semibold text-[#241A18]">{title}</p>
    {children && <div className="text-sm text-[#7A6458] mt-1">{children}</div>}
  </div>
);
