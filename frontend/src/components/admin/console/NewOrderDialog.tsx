import React, { useMemo, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { BranchId, MenuItem, ScoopItem, SelectedOrderItem, ServingFormat } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { createAdminOrder } from '../../../utils/orderStorage';
import { formatPrice } from '../../../utils/currency';
import { Button, Dialog, Field, cx, inputClass, useConsoleUi } from './ui';
import { formatLabel, shortRef } from './orderMeta';
import { MenuData } from './useConsoleData';

const lkr = (n: number) => formatPrice(n, 'LKR');
const DELIVERY_FEE = 250;
const FREE_DELIVERY_FROM = 3000;

type Pick = { key: string; item: ScoopItem | MenuItem; kind: 'scoop' | 'coffee' | 'cake' };

/** Record a phone or walk-in order. It starts as accepted, ready to prepare. */
export const NewOrderDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  menu: MenuData;
  defaultBranch: BranchId;
  /** A branch admin can only add orders for their own branch. */
  lockBranch?: boolean;
}> = ({
  open,
  onClose,
  menu,
  defaultBranch,
  lockBranch,
}) => {
  const { toast } = useConsoleUi();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState<BranchId>(defaultBranch);
  const [type, setType] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<SelectedOrderItem[]>([]);
  const [pickKey, setPickKey] = useState('');
  const [format, setFormat] = useState<ServingFormat>('waffle-cone');

  const picks: Pick[] = useMemo(
    () => [
      ...menu.scoops.map((s) => ({ key: `s:${s.id}`, item: s, kind: 'scoop' as const })),
      ...menu.coffee.map((c) => ({ key: `c:${c.id}`, item: c, kind: 'coffee' as const })),
      ...menu.cakes.map((c) => ({ key: `k:${c.id}`, item: c, kind: 'cake' as const })),
    ],
    [menu]
  );
  const picked = picks.find((p) => p.key === pickKey);
  const scoopPrice = (s: ScoopItem, f: ServingFormat) =>
    f === 'biscuit-cup' ? s.biscuitCupPriceLKR : f === 'double-cone' ? s.doubleConePriceLKR : f === 'double-biscuit-cup' ? s.doubleCupPriceLKR : s.conePriceLKR;

  const addLine = () => {
    if (!picked) return;
    const isScoop = picked.kind === 'scoop';
    const item = picked.item;
    const price = isScoop ? scoopPrice(item as ScoopItem, format) : (item as MenuItem).priceLKR;
    const fmt = isScoop ? format : undefined;
    setLines((prev) => {
      const i = prev.findIndex((l) => l.itemId === item.id && l.format === fmt);
      if (i >= 0) return prev.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { itemId: item.id, name: item.name, category: isScoop ? 'scoops' : (item as MenuItem).category, format: fmt, priceLKR: price, quantity: 1, image: item.image }];
    });
    setPickKey('');
  };

  const changeQty = (i: number, d: number) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, quantity: Math.max(1, l.quantity + d) } : l)));

  const subtotal = lines.reduce((s, l) => s + l.priceLKR * l.quantity, 0);
  const fee = type === 'delivery' && subtotal > 0 && subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
  const total = subtotal + fee;
  const valid = name.trim() && phone.trim() && lines.length > 0 && (type === 'pickup' || address.trim());

  const reset = () => {
    setName('');
    setPhone('');
    setAddress('');
    setNote('');
    setLines([]);
    setType('pickup');
  };

  const create = () => {
    if (!valid) return;
    const b = AMORE_BRANCHES.find((x) => x.id === branch) || AMORE_BRANCHES[0];
    const order = createAdminOrder({
      customerName: name.trim(),
      contactNumber: phone.trim(),
      branchId: b.id,
      branchName: b.name,
      branchCity: b.city,
      orderType: type,
      deliveryAddress: type === 'delivery' ? address.trim() : '',
      items: lines,
      subtotalLKR: subtotal,
      deliveryFeeLKR: fee,
      grandTotalLKR: total,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      specialNote: note.trim() || 'Manual Admin Order',
    });
    toast(`Order ${shortRef(order.orderReference)} added`);
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="New order"
      description="For phone and walk-in orders. It goes straight to Preparing."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={!valid}>
            Add order{total ? ` · ${lkr(total)}` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Customer name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputClass} placeholder="07X XXX XXXX" />
          </Field>
          <Field label="Branch">
            <select value={branch} onChange={(e) => setBranch(e.target.value as BranchId)} disabled={lockBranch} className={inputClass}>
              {AMORE_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <span className="block text-sm font-semibold text-[#3D2C24] mb-1.5">Type</span>
            <div className="grid grid-cols-2 gap-2">
              {(['pickup', 'delivery'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cx(
                    'h-11 rounded-xl border text-sm font-semibold cursor-pointer',
                    type === t ? 'border-[#81001E] bg-[#81001E]/5 text-[#81001E]' : 'border-[#E2D8CA] text-[#3D2C24]'
                  )}
                >
                  {t === 'pickup' ? 'Pickup / counter' : 'Delivery'}
                </button>
              ))}
            </div>
          </div>
          {type === 'delivery' && (
            <Field label="Delivery address" className="sm:col-span-2">
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="House no., street, area" />
            </Field>
          )}
        </div>

        <div>
          <span className="block text-sm font-semibold text-[#3D2C24] mb-1.5">Items</span>
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={pickKey} onChange={(e) => setPickKey(e.target.value)} className={cx(inputClass, 'flex-1')} aria-label="Choose an item">
              <option value="">Choose an item…</option>
              <optgroup label="Ice cream">
                {picks.filter((p) => p.kind === 'scoop').map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.item.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Coffee">
                {picks.filter((p) => p.kind === 'coffee').map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.item.name} — {lkr((p.item as MenuItem).priceLKR)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cakes">
                {picks.filter((p) => p.kind === 'cake').map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.item.name} — {lkr((p.item as MenuItem).priceLKR)}
                  </option>
                ))}
              </optgroup>
            </select>
            {picked?.kind === 'scoop' && (
              <select value={format} onChange={(e) => setFormat(e.target.value as ServingFormat)} className={cx(inputClass, 'sm:w-52')} aria-label="Cone or cup">
                {(['waffle-cone', 'biscuit-cup', 'double-cone', 'double-biscuit-cup'] as ServingFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {formatLabel(f)} — {lkr(scoopPrice(picked.item as ScoopItem, f))}
                  </option>
                ))}
              </select>
            )}
            <Button variant="secondary" onClick={addLine} disabled={!picked} icon={<Plus className="w-4 h-4" />}>
              Add
            </Button>
          </div>

          {lines.length > 0 && (
            <ul className="mt-3 divide-y divide-[#F0E8DC] border border-[#EAE2D6] rounded-xl">
              {lines.map((l, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-sm">
                    {l.name}
                    {l.format && <span className="text-[#8A7970]"> · {formatLabel(l.format)}</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <button type="button" aria-label="One less" onClick={() => changeQty(i, -1)} className="w-8 h-8 rounded-lg border border-[#E2D8CA] flex items-center justify-center cursor-pointer">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{l.quantity}</span>
                    <button type="button" aria-label="One more" onClick={() => changeQty(i, 1)} className="w-8 h-8 rounded-lg border border-[#E2D8CA] flex items-center justify-center cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </span>
                  <span className="w-24 text-right text-sm font-semibold">{lkr(l.priceLKR * l.quantity)}</span>
                  <button type="button" aria-label={`Remove ${l.name}`} onClick={() => setLines((p) => p.filter((_, j) => j !== i))} className="p-1.5 text-[#8A7970] hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
              <li className="px-3 py-2 text-sm flex justify-between text-[#5C4D44]">
                <span>Delivery</span>
                <span>{type === 'delivery' ? (fee ? lkr(fee) : 'Free') : '—'}</span>
              </li>
              <li className="px-3 py-2 flex justify-between font-bold">
                <span>Total</span>
                <span>{lkr(total)}</span>
              </li>
            </ul>
          )}
        </div>

        <Field label="Note for the kitchen (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </Dialog>
  );
};
