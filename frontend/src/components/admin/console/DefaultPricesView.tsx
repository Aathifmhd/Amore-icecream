/**
 * Settings → Default prices (super admin only): the price every branch charges unless it has set
 * its own. Change any item here, or set a whole column at once, then save.
 */
import React, { useMemo, useState } from 'react';
import { RotateCcw, Tag } from 'lucide-react';
import { BranchId, MenuItem, ScoopItem } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { updateCakeItem, updateCoffeeItem, updateScoopItem } from '../../../utils/menuStorage';
import { branchChanges } from '../../../utils/branchMenu';
import { Button, Card, cx, inputClass, useConsoleUi } from './ui';
import type { MenuData } from './useConsoleData';

type Kind = 'scoops' | 'coffee' | 'cakes';
type PriceKey = 'conePriceLKR' | 'biscuitCupPriceLKR' | 'doubleConePriceLKR' | 'doubleCupPriceLKR' | 'priceLKR';
type Col = { key: PriceKey; label: string };

const KINDS: { id: Kind; label: string }[] = [
  { id: 'scoops', label: 'Ice cream' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'cakes', label: 'Cakes' },
];
const SCOOP_COLS: Col[] = [
  { key: 'conePriceLKR', label: 'Waffle cone' },
  { key: 'biscuitCupPriceLKR', label: 'Biscuit cup' },
  { key: 'doubleConePriceLKR', label: 'Double cone' },
  { key: 'doubleCupPriceLKR', label: 'Double cup' },
];
const PRICE_COL: Col[] = [{ key: 'priceLKR', label: 'Price' }];
const BRANCH_SHORT: Record<BranchId, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };
const MAX_PRICE = 1_000_000;

const cellKey = (kind: Kind, id: string, key: PriceKey) => `${kind}:${id}:${key}`;
const digits = (s: string) => s.replace(/[^\d]/g, '').slice(0, 7);
// The console's input look without its full width (for the inline "Set every" controls)
const inlineInput = inputClass.replace('w-full ', '');

export const DefaultPricesView: React.FC<{ menu: MenuData }> = ({ menu }) => {
  const { toast } = useConsoleUi();
  const [kind, setKind] = useState<Kind>('scoops');
  // What has been typed, by kind:item:price; anything not here shows the saved default price
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fillCol, setFillCol] = useState<PriceKey>('conePriceLKR');
  const [fillValue, setFillValue] = useState('');

  const itemsOf = (k: Kind): (ScoopItem | MenuItem)[] => (k === 'scoops' ? menu.scoops : k === 'coffee' ? menu.coffee : menu.cakes);
  const colsOf = (k: Kind) => (k === 'scoops' ? SCOOP_COLS : PRICE_COL);
  const saved = (item: ScoopItem | MenuItem, key: PriceKey) => (item as unknown as Record<string, number | undefined>)[key];
  const valueOf = (k: Kind, item: ScoopItem | MenuItem, key: PriceKey) => drafts[cellKey(k, item.id, key)] ?? String(saved(item, key) ?? '');

  // Every typed price that differs from what is saved, across all three kinds
  const changes = useMemo(() => {
    const out: { kind: Kind; item: ScoopItem | MenuItem; fields: Partial<Record<PriceKey, number>> }[] = [];
    let invalid = 0;
    for (const { id: k } of KINDS) {
      for (const item of itemsOf(k)) {
        const fields: Partial<Record<PriceKey, number>> = {};
        for (const { key } of colsOf(k)) {
          const typed = drafts[cellKey(k, item.id, key)];
          if (typed === undefined) continue;
          if (typed === '' || Number(typed) > MAX_PRICE) {
            invalid += 1;
            continue;
          }
          if (Number(typed) !== saved(item, key)) fields[key] = Number(typed);
        }
        if (Object.keys(fields).length) out.push({ kind: k, item, fields });
      }
    }
    return { list: out, invalid };
  }, [drafts, menu]);

  const type = (k: Kind, id: string, key: PriceKey, v: string) => setDrafts((d) => ({ ...d, [cellKey(k, id, key)]: digits(v) }));

  const fillAll = () => {
    if (!fillValue) return;
    const key = kind === 'scoops' ? fillCol : 'priceLKR';
    setDrafts((d) => {
      const next = { ...d };
      for (const item of itemsOf(kind)) next[cellKey(kind, item.id, key)] = fillValue;
      return next;
    });
    const label = colsOf(kind).find((c) => c.key === key)?.label.toLowerCase();
    toast(`Every ${KINDS.find((x) => x.id === kind)!.label.toLowerCase()} ${label} set to LKR ${Number(fillValue).toLocaleString()} · save to apply`);
    setFillValue('');
  };

  const save = () => {
    if (!changes.list.length || changes.invalid) return;
    for (const { kind: k, item, fields } of changes.list) {
      if (k === 'scoops') updateScoopItem(item.id, fields);
      else (k === 'coffee' ? updateCoffeeItem : updateCakeItem)(item.id, fields);
    }
    const n = changes.list.length;
    setDrafts({});
    toast(`Default prices saved for ${n} item${n === 1 ? '' : 's'}`);
  };

  const cols = colsOf(kind);
  const items = itemsOf(kind);
  const scoopGrid = 'sm:grid-cols-[minmax(0,1fr)_repeat(4,7.5rem)]';
  const oneGrid = 'sm:grid-cols-[minmax(0,1fr)_9rem]';

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="font-bold text-[#241A18] flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#81001E]" /> Default prices
          </h2>
          <p className="text-sm text-[#6B5A51] mt-1">
            The price at every branch, unless a branch has set its own price for an item (shown as “price different at …”). Only the
            super admin can change default prices.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="inline-flex p-1 bg-[#F3EDE3] rounded-xl self-start" role="tablist">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={kind === k.id}
                onClick={() => setKind(k.id)}
                className={cx(
                  'h-9 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer',
                  kind === k.id ? 'bg-white text-[#241A18] shadow-sm' : 'text-[#6B5A51] hover:text-[#241A18]'
                )}
              >
                {k.label} <span className="text-[#A8988B] font-medium">{itemsOf(k.id).length}</span>
              </button>
            ))}
          </div>

          {/* Set one price for a whole column */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#5C4D44]">
            <span>Set every</span>
            {kind === 'scoops' ? (
              <select
                value={fillCol}
                onChange={(e) => setFillCol(e.target.value as PriceKey)}
                aria-label="Which price"
                className={cx(inlineInput, 'h-10 pr-8 cursor-pointer')}
              >
                {SCOOP_COLS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-semibold text-[#241A18]">{KINDS.find((x) => x.id === kind)!.label.toLowerCase()} price</span>
            )}
            <span>to</span>
            <span className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#A8988B]">LKR</span>
              <input
                value={fillValue}
                onChange={(e) => setFillValue(digits(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && fillAll()}
                inputMode="numeric"
                aria-label="Price for all"
                className={cx(inlineInput, 'h-10 w-32 pl-11 text-right tabular-nums')}
              />
            </span>
            <Button variant="secondary" onClick={fillAll} disabled={!fillValue}>
              Apply
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className={cx('hidden sm:grid gap-3 px-4 py-2.5 bg-[#F7F3EC] text-xs font-semibold uppercase tracking-wide text-[#8A7970]', kind === 'scoops' ? scoopGrid : oneGrid)}>
          <span>Item</span>
          {cols.map((c) => (
            <span key={c.key} className="text-right">
              {c.label}
            </span>
          ))}
        </div>
        <div className="divide-y divide-[#F0E8DC]">
          {items.map((item) => {
            const differentAt = AMORE_BRANCHES.map((b) => b.id).filter((b) => cols.some((c) => c.key in branchChanges(item, b)));
            return (
              <div key={item.id} className={cx('grid grid-cols-1 gap-3 px-4 py-3 sm:items-center', kind === 'scoops' ? scoopGrid : oneGrid)}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-11 rounded-xl overflow-hidden bg-[#F3EDE3] shrink-0">
                    {item.image && <img src={item.image} alt="" loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-[#241A18] truncate">{item.name}</span>
                    {differentAt.length > 0 && (
                      <span className="block text-xs text-amber-800">(price different at {differentAt.map((b) => BRANCH_SHORT[b]).join(' & ')})</span>
                    )}
                  </span>
                </div>
                <div className={cx('grid gap-2 sm:contents', cols.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                  {cols.map((c) => {
                    const v = valueOf(kind, item, c.key);
                    const typed = drafts[cellKey(kind, item.id, c.key)];
                    const changed = typed !== undefined && typed !== '' && Number(typed) !== saved(item, c.key);
                    const bad = typed !== undefined && (typed === '' || Number(typed) > MAX_PRICE);
                    return (
                      <label key={c.key} className="block">
                        <span className="sm:sr-only block text-xs text-[#8A7970] mb-1">{c.label}</span>
                        <span className="relative block">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#A8988B]">LKR</span>
                          <input
                            value={v}
                            onChange={(e) => type(kind, item.id, c.key, e.target.value)}
                            inputMode="numeric"
                            aria-label={`${item.name} ${c.label} default price`}
                            className={cx(
                              inputClass,
                              'h-10 pl-11 text-right tabular-nums',
                              changed && 'border-amber-400 bg-amber-50',
                              bad && 'border-red-400 bg-red-50'
                            )}
                          />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {(changes.list.length > 0 || changes.invalid > 0) && (
        <div className="sticky bottom-3 z-10">
          <Card className="px-4 py-3 flex flex-wrap items-center gap-3 shadow-lg border-[#E2D8CA]">
            <p className="text-sm text-[#3D2C24] flex-1 min-w-48">
              {changes.invalid > 0 ? (
                <span className="text-red-700">Enter a price (up to LKR 1,000,000) in every box.</span>
              ) : (
                <>
                  <strong>
                    {changes.list.length} item{changes.list.length === 1 ? '' : 's'}
                  </strong>{' '}
                  with new default prices — every branch without its own price charges them once saved.
                </>
              )}
            </p>
            <Button variant="ghost" icon={<RotateCcw className="w-4 h-4" />} onClick={() => setDrafts({})}>
              Discard
            </Button>
            <Button variant="primary" onClick={save} disabled={!changes.list.length || changes.invalid > 0}>
              Save prices
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};
