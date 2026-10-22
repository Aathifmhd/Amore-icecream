import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, RotateCcw, UtensilsCrossed, BarChart3, Bell, BellOff, ExternalLink, LogOut, Lock, MoreHorizontal } from 'lucide-react';
import { BranchId, Currency, OrderRecord } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { isCapturedReturnedBill } from '../../../utils/orderStorage';
import { AmoreLogo } from '../../AmoreLogo';
import { ConsoleUiProvider, cx } from './ui';
import { BranchFilter, inBranch, useMenu, useNewOrderAlert, useOrders, useStoredState, chime } from './useConsoleData';
import { stageOf } from './orderMeta';
import { OrdersView } from './OrdersView';
import { OrderDrawer } from './OrderDrawer';
import { NewOrderDialog } from './NewOrderDialog';
import { RefundsView } from './RefundsView';
import { MenuView } from './MenuView';
import { ReportsView } from './ReportsView';

type Section = 'orders' | 'refunds' | 'menu' | 'reports';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode; title: string }[] = [
  { id: 'orders', label: 'Orders', icon: <ClipboardList className="w-5 h-5" />, title: 'Orders' },
  { id: 'refunds', label: 'Refunds', icon: <RotateCcw className="w-5 h-5" />, title: 'Refunds' },
  { id: 'menu', label: 'Menu', icon: <UtensilsCrossed className="w-5 h-5" />, title: 'Menu & stock' },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" />, title: 'Reports' },
];

// Old links (?tab=returns, ?tab=overview…) still land in the right place
function sectionFromUrl(): Section {
  const p = new URLSearchParams(window.location.search);
  const t = p.get('tab') || p.get('section');
  if (t === 'returns' || t === 'returned-bills' || t === 'refunds') return 'refunds';
  if (t === 'menu') return 'menu';
  if (t === 'overview' || t === 'branches' || t === 'reports') return 'reports';
  return 'orders';
}

interface Props {
  onSignOut: () => void;
  /** "Lock" when this device has a user code, otherwise "Sign Out" */
  signOutLabel?: string;
  onBackToStore: () => void;
  currency?: Currency;
  onToggleCurrency?: (c: Currency) => void;
}

const BRANCH_SHORT: Record<BranchId, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };

export const OperationsConsole: React.FC<Props> = (props) => (
  <ConsoleUiProvider>
    <ConsoleShell {...props} />
  </ConsoleUiProvider>
);

const ConsoleShell: React.FC<Props> = ({ onSignOut, signOutLabel = 'Sign Out', onBackToStore }) => {
  const orders = useOrders();
  const menu = useMenu();
  const [section, setSection] = useState<Section>(sectionFromUrl);
  const [branch, setBranch] = useStoredState<BranchFilter>('amore_console_branch', 'all');
  const [soundOn, setSoundOn] = useStoredState<boolean>('amore_console_sound', true);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const go = (s: Section) => {
    setSection(s);
    setMoreOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', s);
    window.history.replaceState({}, '', url.toString());
    window.scrollTo({ top: 0 });
  };

  const scoped = useMemo(() => orders.filter((o) => inBranch(o, branch)), [orders, branch]);
  const newCount = scoped.filter((o) => stageOf(o) === 'new' && !isCapturedReturnedBill(o)).length;
  const refundCount = scoped.filter((o) => isCapturedReturnedBill(o) && o.refundStatus !== 'completed').length;
  const soldOut = [...menu.scoops, ...menu.coffee, ...menu.cakes].filter((i) => i.isAvailable === false).length;
  useNewOrderAlert(newCount, soundOn);

  // Keep the open order in sync with live updates
  const openOrder: OrderRecord | null = openRef ? orders.find((o) => o.orderReference === openRef) || null : null;
  useEffect(() => {
    if (openRef && !openOrder) setOpenRef(null);
  }, [openRef, openOrder]);

  const badges: Partial<Record<Section, { n: number; tone: string }>> = {
    orders: newCount ? { n: newCount, tone: 'bg-amber-500 text-white' } : undefined,
    refunds: refundCount ? { n: refundCount, tone: 'bg-red-600 text-white' } : undefined,
    menu: soldOut ? { n: soldOut, tone: 'bg-stone-400 text-white' } : undefined,
  };
  const current = SECTIONS.find((s) => s.id === section)!;
  const SignOutIcon = signOutLabel === 'Lock' ? Lock : LogOut;

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next) chime(); // confirms it works, and unlocks audio on browsers that need a tap first
  };

  const branchPicker = (
    <>
      <div className="hidden xl:inline-flex p-1 bg-[#F3EDE3] rounded-xl" role="radiogroup" aria-label="Branch">
        {(['all', ...AMORE_BRANCHES.map((b) => b.id)] as BranchFilter[]).map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={branch === b}
            onClick={() => setBranch(b)}
            className={cx(
              'h-9 px-3 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap',
              branch === b ? 'bg-white text-[#241A18] shadow-sm' : 'text-[#6B5A51] hover:text-[#241A18]'
            )}
          >
            {b === 'all' ? 'All branches' : BRANCH_SHORT[b]}
          </button>
        ))}
      </div>
      <select
        value={branch}
        onChange={(e) => setBranch(e.target.value as BranchFilter)}
        aria-label="Branch"
        className="xl:hidden h-10 pl-3 pr-8 rounded-xl border border-[#E2D8CA] bg-white text-sm font-semibold text-[#241A18] max-w-[11rem]"
      >
        <option value="all">All branches</option>
        {AMORE_BRANCHES.map((b) => (
          <option key={b.id} value={b.id}>
            {BRANCH_SHORT[b.id]}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F7F3EC] text-[#241A18] lg:pl-20 xl:pl-60">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-20 xl:w-60 flex-col bg-white border-r border-[#EAE2D6] z-30">
        <div className="flex items-center justify-center xl:justify-start gap-3 px-5 h-16 border-b border-[#F0E8DC]">
          <AmoreLogo size="sm" showShadow={false} />
          <div className="leading-tight hidden xl:block">
            <p className="font-bold">Amore</p>
            <p className="text-xs text-[#8A7970]">Operations</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1" aria-label="Console">
          {SECTIONS.map((s) => {
            const b = badges[s.id];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => go(s.id)}
                aria-current={section === s.id ? 'page' : undefined}
                title={s.label}
                className={cx(
                  'relative w-full flex items-center justify-center xl:justify-start gap-3 h-11 px-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors',
                  section === s.id ? 'bg-[#81001E] text-white' : 'text-[#3D2C24] hover:bg-[#F3EDE3]'
                )}
              >
                {s.icon}
                <span className="flex-1 text-left hidden xl:block">{s.label}</span>
                {b && (
                  <span
                    className={cx(
                      'min-w-5 h-5 xl:min-w-6 xl:h-6 px-1.5 rounded-full text-[11px] xl:text-xs font-bold flex items-center justify-center absolute top-0.5 right-1.5 xl:static',
                      section === s.id ? 'bg-white text-[#81001E]' : b.tone
                    )}
                  >
                    {b.n}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[#F0E8DC] space-y-1">
          <button
            type="button"
            onClick={toggleSound}
            title={`New-order sound: ${soundOn ? 'On' : 'Off'}`}
            className="w-full flex items-center justify-center xl:justify-start gap-3 h-10 px-3 rounded-xl text-sm text-[#3D2C24] hover:bg-[#F3EDE3] cursor-pointer"
          >
            {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            <span className="hidden xl:inline">
              New-order sound: <strong>{soundOn ? 'On' : 'Off'}</strong>
            </span>
          </button>
          <button type="button" onClick={onBackToStore} title="View website" className="w-full flex items-center justify-center xl:justify-start gap-3 h-10 px-3 rounded-xl text-sm text-[#3D2C24] hover:bg-[#F3EDE3] cursor-pointer">
            <ExternalLink className="w-4 h-4" /> <span className="hidden xl:inline">View website</span>
          </button>
          <button type="button" onClick={onSignOut} title={signOutLabel} className="w-full flex items-center justify-center xl:justify-start gap-3 h-10 px-3 rounded-xl text-sm text-red-700 hover:bg-red-50 cursor-pointer">
            <SignOutIcon className="w-4 h-4" /> <span className="hidden xl:inline">{signOutLabel}</span>
          </button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-[#F7F3EC]/90 backdrop-blur-md border-b border-[#EAE2D6]">
        <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
          <span className="lg:hidden">
            <AmoreLogo size="sm" showShadow={false} />
          </span>
          <h1 className="text-xl font-bold flex-1 truncate">{current.title}</h1>
          {branchPicker}
          <div className="relative lg:hidden">
            <button type="button" aria-label="More" onClick={() => setMoreOpen((v) => !v)} className="w-10 h-10 rounded-xl bg-white border border-[#E2D8CA] flex items-center justify-center cursor-pointer">
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {moreOpen && (
              <>
                <button type="button" aria-label="Close menu" className="fixed inset-0 cursor-default" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-[#EAE2D6] p-2 z-10 animate-scaleUp">
                  <button type="button" onClick={toggleSound} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm hover:bg-[#F3EDE3] cursor-pointer">
                    {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />} New-order sound: <strong>{soundOn ? 'On' : 'Off'}</strong>
                  </button>
                  <button type="button" onClick={onBackToStore} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm hover:bg-[#F3EDE3] cursor-pointer">
                    <ExternalLink className="w-4 h-4" /> View website
                  </button>
                  <button type="button" onClick={onSignOut} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-red-700 hover:bg-red-50 cursor-pointer">
                    <SignOutIcon className="w-4 h-4" /> {signOutLabel}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 lg:px-8 py-5 lg:py-7 pb-28 lg:pb-10 max-w-[1500px]">
        {section === 'orders' && <OrdersView orders={orders} branch={branch} onOpenOrder={(o) => setOpenRef(o.orderReference)} onNewOrder={() => setNewOrderOpen(true)} />}
        {section === 'refunds' && <RefundsView orders={orders} branch={branch} />}
        {section === 'menu' && <MenuView menu={menu} />}
        {section === 'reports' && <ReportsView orders={orders} branch={branch} />}
      </main>

      {/* Bottom tabs (phones / tablets) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#EAE2D6] pb-safe" aria-label="Console">
        <div className="grid grid-cols-4 h-16">
          {SECTIONS.map((s) => {
            const b = badges[s.id];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => go(s.id)}
                aria-current={section === s.id ? 'page' : undefined}
                className={cx('relative flex flex-col items-center justify-center gap-0.5 text-xs font-semibold cursor-pointer', section === s.id ? 'text-[#81001E]' : 'text-[#7A6458]')}
              >
                <span className="relative">
                  {s.icon}
                  {b && <span className={cx('absolute -top-2 -right-3 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center', b.tone)}>{b.n}</span>}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>

      <OrderDrawer order={openOrder} onClose={() => setOpenRef(null)} />
      <NewOrderDialog open={newOrderOpen} onClose={() => setNewOrderOpen(false)} menu={menu} defaultBranch={branch === 'all' ? 'akurana' : branch} />
    </div>
  );
};
