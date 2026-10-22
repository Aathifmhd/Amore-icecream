import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, RotateCcw, UtensilsCrossed, BarChart3, CloudOff, ExternalLink, IdCard, LogOut, Lock, MapPin, MoreHorizontal, Settings, UserCog } from 'lucide-react';
import { BranchId, Currency, OrderRecord } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { isCapturedReturnedBill } from '../../../utils/orderStorage';
import { isSoldOutAt } from '../../../utils/stock';
import type { AdminProfile } from '../../../api';
import { AmoreLogo } from '../../AmoreLogo';
import { Button, ConsoleUiProvider, cx, useConsoleUi } from './ui';
import { BranchFilter, inBranch, useMenu, useNewOrderAlert, useOrders, usePendingWrites, useStoredState, chime } from './useConsoleData';
import { SYNC_ERROR_EVENT } from '../../../utils/outbox';
import { stageOf } from './orderMeta';
import { OrdersView } from './OrdersView';
import { OrderDrawer } from './OrderDrawer';
import { NewOrderDialog } from './NewOrderDialog';
import { RefundsView } from './RefundsView';
import { MenuView } from './MenuView';
import { ReportsView } from './ReportsView';
import { EmployeesView } from './EmployeesView';
import { UsersView } from './UsersView';
import { SettingsView } from './SettingsView';

type Section = 'orders' | 'refunds' | 'menu' | 'reports' | 'employees' | 'users' | 'settings';

const ALL_SECTIONS: { id: Section; label: string; icon: React.ReactNode; title: string; group: string; superOnly?: boolean }[] = [
  { id: 'orders', label: 'Orders', icon: <ClipboardList className="w-5 h-5" />, title: 'Orders', group: 'Daily work' },
  { id: 'refunds', label: 'Refunds', icon: <RotateCcw className="w-5 h-5" />, title: 'Refunds', group: 'Daily work' },
  { id: 'menu', label: 'Menu', icon: <UtensilsCrossed className="w-5 h-5" />, title: 'Menu & stock', group: 'Menu' },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" />, title: 'Reports', group: 'Insights' },
  { id: 'employees', label: 'Staff', icon: <IdCard className="w-5 h-5" />, title: 'Employees', group: 'Team' },
  { id: 'users', label: 'Users', icon: <UserCog className="w-5 h-5" />, title: 'Users & access', group: 'Team', superOnly: true },
];
// Settings sits at the bottom of the menu (and in "More" on phones), not with the work pages
const SETTINGS_TITLE = 'Settings';

// Old links (?tab=returns, ?tab=overview…) still land in the right place
function sectionFromUrl(): Section {
  const p = new URLSearchParams(window.location.search);
  const t = p.get('tab') || p.get('section');
  if (t === 'returns' || t === 'returned-bills' || t === 'refunds') return 'refunds';
  if (t === 'menu') return 'menu';
  if (t === 'overview' || t === 'branches' || t === 'reports') return 'reports';
  if (t === 'employees' || t === 'staff') return 'employees';
  if (t === 'users') return 'users';
  if (t === 'settings') return 'settings';
  return 'orders';
}

interface Props {
  /** Who is signed in: a super admin sees everything, a branch admin only their branch. */
  admin: AdminProfile;
  /** Sign out completely (this device also forgets its user code). */
  onSignOut: () => void;
  /** Close the console until the user code is entered again; only when this device has a code. */
  onLock?: () => void;
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

const ConsoleShell: React.FC<Props> = ({ admin, onSignOut, onLock, onBackToStore }) => {
  const orders = useOrders();
  const menu = useMenu();
  const isSuper = admin.role !== 'branch';
  // A branch admin always works on their own branch (the server only sends them its data)
  const lockedBranch: BranchId | null = isSuper ? null : admin.branchId;
  const SECTIONS = ALL_SECTIONS.filter((s) => isSuper || !s.superOnly);
  const [section, setSection] = useState<Section>(() => {
    const s = sectionFromUrl();
    return s === 'settings' || SECTIONS.some((x) => x.id === s) ? s : 'orders';
  });
  const [pickedBranch, setBranch] = useStoredState<BranchFilter>('amore_console_branch', 'all');
  const branch: BranchFilter = lockedBranch ?? pickedBranch;
  const [soundOn, setSoundOn] = useStoredState<boolean>('amore_console_sound', true);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const unsaved = usePendingWrites();
  const { toast } = useConsoleUi();

  // A change the server refused (e.g. the order was changed elsewhere first)
  useEffect(() => {
    const onError = (e: Event) => toast((e as CustomEvent<{ message: string }>).detail.message, 'error');
    window.addEventListener(SYNC_ERROR_EVENT, onError);
    return () => window.removeEventListener(SYNC_ERROR_EVENT, onError);
  }, [toast]);

  const go = (s: Section) => {
    setSection(s);
    setMoreOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', s);
    if (s !== 'settings') url.searchParams.delete('view');
    window.history.replaceState({}, '', url.toString());
    window.scrollTo({ top: 0 });
  };

  const scoped = useMemo(() => orders.filter((o) => inBranch(o, branch)), [orders, branch]);
  const newCount = scoped.filter((o) => stageOf(o) === 'new' && !isCapturedReturnedBill(o)).length;
  const refundCount = scoped.filter((o) => isCapturedReturnedBill(o) && o.refundStatus !== 'completed').length;
  const soldOut = [...menu.scoops, ...menu.coffee, ...menu.cakes].filter((i) =>
    branch === 'all' ? AMORE_BRANCHES.some((b) => isSoldOutAt(i, b.id)) : isSoldOutAt(i, branch)
  ).length;
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
  const title = section === 'settings' ? SETTINGS_TITLE : SECTIONS.find((s) => s.id === section)!.title;

  const changeSound = (on: boolean) => {
    setSoundOn(on);
    if (on) chime(); // confirms it works, and unlocks audio on browsers that need a tap first
  };

  const branchPicker = lockedBranch ? (
    <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#F3EDE3] text-sm font-semibold text-[#241A18] whitespace-nowrap">
      <MapPin className="w-4 h-4 text-[#81001E]" /> {BRANCH_SHORT[lockedBranch]}
    </span>
  ) : (
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
    <div className="min-h-screen bg-[#F7F3EC] text-[#241A18] lg:pl-[76px]">
      {/* Menu (desktop): a slim icon rail that opens over the page on hover */}
      <aside className="console-rail hidden lg:flex" aria-label="Console menu">
        <div className="rail-brand">
          <AmoreLogo size="sm" showShadow={false} />
          <div className="rail-label leading-tight">
            <p className="font-serif-title text-lg font-bold text-white">Amore</p>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#E8B04B]">Operations</p>
          </div>
        </div>

        <nav className="rail-nav" aria-label="Console">
          {SECTIONS.map((s, i) => {
            const b = badges[s.id];
            const startsGroup = i === 0 || SECTIONS[i - 1].group !== s.group;
            return (
              <React.Fragment key={s.id}>
                {startsGroup && (
                  <div className="rail-group" aria-hidden="true">
                    <span className="rail-label">{s.group}</span>
                  </div>
                )}
                <button type="button" onClick={() => go(s.id)} aria-current={section === s.id ? 'page' : undefined} aria-label={s.label} className="rail-item">
                  {s.icon}
                  <span className="rail-label flex-1 text-left">{s.label}</span>
                  {b && <span className={cx('rail-badge', b.tone)}>{b.n}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="rail-foot">
          <button type="button" onClick={() => go('settings')} aria-current={section === 'settings' ? 'page' : undefined} aria-label={SETTINGS_TITLE} className="rail-item">
            <Settings />
            <span className="rail-label">{SETTINGS_TITLE}</span>
          </button>
          {onLock && (
            <button type="button" onClick={onLock} aria-label="Lock" className="rail-item rail-quiet">
              <Lock />
              <span className="rail-label">Lock</span>
            </button>
          )}
          <button type="button" onClick={onSignOut} aria-label="Sign out" className="rail-item rail-quiet rail-danger">
            <LogOut />
            <span className="rail-label">Sign out</span>
          </button>
        </div>

        <div className="rail-user" title={admin.displayName}>
          <span className="rail-avatar" aria-hidden="true">
            {(admin.displayName || admin.username).trim()[0]?.toUpperCase()}
          </span>
          <span className="rail-label min-w-0 leading-tight pr-4">
            <span className="block font-semibold text-white truncate">{admin.displayName}</span>
            <span className="block text-xs text-[#E9D9C6]/70 truncate">
              {isSuper ? 'Super admin' : `Branch admin · ${lockedBranch ? BRANCH_SHORT[lockedBranch] : ''}`}
            </span>
          </span>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-[#F7F3EC]/90 backdrop-blur-md border-b border-[#EAE2D6]">
        <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
          <span className="lg:hidden">
            <AmoreLogo size="sm" showShadow={false} />
          </span>
          <h1 className="text-xl font-bold flex-1 truncate">{title}</h1>
          {unsaved > 0 && (
            <span
              role="status"
              title="No connection to the server right now. Your changes are kept on this device and sent automatically."
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold whitespace-nowrap"
            >
              <CloudOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Saving {unsaved} change{unsaved === 1 ? '' : 's'}…</span>
              <span className="sm:hidden">{unsaved}</span>
            </span>
          )}
          {section !== 'users' && section !== 'settings' && branchPicker}
          {/* Phones have this in the "More" menu */}
          <span className="hidden lg:block">
            <Button variant="secondary" size="sm" icon={<ExternalLink className="w-4 h-4" />} onClick={onBackToStore}>
              View website
            </Button>
          </span>
          <div className="relative lg:hidden">
            <button type="button" aria-label="More" onClick={() => setMoreOpen((v) => !v)} className="w-10 h-10 rounded-xl bg-white border border-[#E2D8CA] flex items-center justify-center cursor-pointer">
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {moreOpen && (
              <>
                <button type="button" aria-label="Close menu" className="fixed inset-0 cursor-default" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-[#EAE2D6] p-2 z-10 animate-scaleUp">
                  <button type="button" onClick={() => go('settings')} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm hover:bg-[#F3EDE3] cursor-pointer">
                    <Settings className="w-4 h-4" /> {SETTINGS_TITLE}
                  </button>
                  <button type="button" onClick={onBackToStore} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm hover:bg-[#F3EDE3] cursor-pointer">
                    <ExternalLink className="w-4 h-4" /> View website
                  </button>
                  {onLock && (
                    <button type="button" onClick={onLock} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm hover:bg-[#F3EDE3] cursor-pointer">
                      <Lock className="w-4 h-4" /> Lock
                    </button>
                  )}
                  <button type="button" onClick={onSignOut} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-red-700 hover:bg-red-50 cursor-pointer">
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 lg:px-8 py-5 lg:py-7 pb-28 lg:pb-10 max-w-[1500px]">
        {section === 'orders' && <OrdersView orders={orders} branch={branch} onOpenOrder={(o) => setOpenRef(o.orderReference)} onNewOrder={() => setNewOrderOpen(true)} />}
        {section === 'refunds' && <RefundsView orders={orders} branch={branch} lockedBranch={lockedBranch} />}
        {section === 'menu' && <MenuView menu={menu} branch={branch} canEdit={isSuper} />}
        {section === 'reports' && <ReportsView orders={orders} branch={branch} />}
        {section === 'employees' && <EmployeesView branch={branch} lockedBranch={lockedBranch} />}
        {section === 'users' && isSuper && <UsersView me={admin} />}
        {section === 'settings' && (
          <SettingsView admin={admin} soundOn={soundOn} onSoundChange={changeSound} onTestSound={chime} onOpenUsers={() => go('users')} />
        )}
      </main>

      {/* Bottom tabs (phones / tablets) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#EAE2D6] pb-safe" aria-label="Console">
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${SECTIONS.length}, minmax(0, 1fr))` }}>
          {SECTIONS.map((s) => {
            const b = badges[s.id];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => go(s.id)}
                aria-current={section === s.id ? 'page' : undefined}
                className={cx('relative flex flex-col items-center justify-center gap-0.5 text-[11px] sm:text-xs font-semibold cursor-pointer', section === s.id ? 'text-[#81001E]' : 'text-[#7A6458]')}
              >
                <span className={cx('relative flex items-center justify-center w-12 h-7 rounded-full transition-colors', section === s.id && 'bg-[#81001E]/10')}>
                  {s.icon}
                  {b && <span className={cx('absolute -top-1.5 right-0 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center ring-2 ring-white', b.tone)}>{b.n}</span>}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>

      <OrderDrawer order={openOrder} onClose={() => setOpenRef(null)} />
      <NewOrderDialog
        open={newOrderOpen}
        onClose={() => setNewOrderOpen(false)}
        menu={menu}
        defaultBranch={branch === 'all' ? 'akurana' : branch}
        lockBranch={Boolean(lockedBranch)}
      />
    </div>
  );
};
