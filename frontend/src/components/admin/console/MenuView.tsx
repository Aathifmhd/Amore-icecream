import React, { useMemo, useRef, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Upload, Images, X, ImageOff } from 'lucide-react';
import { MenuItem, ScoopItem } from '../../../types';
import { CATALOG_PRESET_IMAGES } from '../../../data/iceCreamData';
import {
  createCakeItem,
  createCoffeeItem,
  createScoopItem,
  deleteCakeItem,
  deleteCoffeeItem,
  deleteScoopItem,
  toggleItemStockStatus,
  updateCakeItem,
  updateCoffeeItem,
  updateScoopItem,
} from '../../../utils/menuStorage';
import { formatPrice } from '../../../utils/currency';
import { Badge, Button, Card, Drawer, EmptyState, Field, Switch, cx, inputClass, useConsoleUi } from './ui';
import { MenuData } from './useConsoleData';
import { uploadMenuPhoto } from '../../../utils/imageUpload';
import { ApiError } from '../../../api';

const lkr = (n: number) => formatPrice(n, 'LKR');
type Kind = 'scoops' | 'coffee' | 'cakes';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'scoops', label: 'Ice cream' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'cakes', label: 'Cakes' },
];
const isScoop = (i: ScoopItem | MenuItem): i is ScoopItem => 'conePriceLKR' in i;

// ---- Photo picker ----

const PhotoPicker: React.FC<{ value: string; onChange: (url: string) => void }> = ({ value, onChange }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setNote(null);
    try {
      onChange(await uploadMenuPhoto(file));
    } catch (err) {
      setNote(err instanceof ApiError && err.status === 0 ? err.message : 'Could not use that photo. Try another one (JPEG, PNG or WebP).');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex gap-3 items-start">
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#F3EDE3] shrink-0 flex items-center justify-center">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ImageOff className="w-6 h-6 text-[#A8988B]" />}
        </div>
        <div className="flex flex-col gap-2">
          <Button size="sm" variant="secondary" icon={<Upload className="w-4 h-4" />} disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Uploading…' : 'Upload photo'}
          </Button>
          <Button size="sm" variant="ghost" icon={<Images className="w-4 h-4" />} onClick={() => setShowLibrary((v) => !v)}>
            {showLibrary ? 'Hide photos' : 'Choose from our photos'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {note && <p className="text-xs text-[#8A7970] mt-2">{note}</p>}
      {showLibrary && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {CATALOG_PRESET_IMAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.name}
              onClick={() => {
                onChange(p.url);
                setShowLibrary(false);
              }}
              className={cx('aspect-square rounded-lg overflow-hidden ring-2 cursor-pointer', value === p.url ? 'ring-[#81001E]' : 'ring-transparent hover:ring-[#C9B9A4]')}
            >
              <img src={p.url} alt={p.name} loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- Editor ----

interface Draft {
  name: string;
  tagline: string;
  description: string;
  image: string;
  price: string;
  cone: string;
  cup: string;
  doubleCone: string;
  doubleCup: string;
  popular: boolean;
  signature: boolean;
  available: boolean;
}

const toDraft = (item?: ScoopItem | MenuItem): Draft => {
  if (!item)
    return { name: '', tagline: '', description: '', image: '', price: '', cone: '', cup: '', doubleCone: '', doubleCup: '', popular: false, signature: false, available: true };
  if (isScoop(item))
    return {
      name: item.name,
      tagline: item.tagline,
      description: item.description,
      image: item.image,
      price: '',
      cone: String(item.conePriceLKR),
      cup: String(item.biscuitCupPriceLKR),
      doubleCone: String(item.doubleConePriceLKR ?? ''),
      doubleCup: String(item.doubleCupPriceLKR ?? ''),
      popular: !!item.isPopular,
      signature: !!item.isIconic,
      available: item.isAvailable !== false,
    };
  return {
    name: item.name,
    tagline: item.portionOrTemp || '',
    description: item.description,
    image: item.image || '',
    price: String(item.priceLKR),
    cone: '',
    cup: '',
    doubleCone: '',
    doubleCup: '',
    popular: !!item.popular,
    signature: false,
    available: item.isAvailable !== false,
  };
};

const num = (s: string) => Math.max(0, Math.round(Number(s) || 0));

const ItemEditor: React.FC<{ kind: Kind; item?: ScoopItem | MenuItem; onClose: () => void }> = ({ kind, item, onClose }) => {
  const { confirm, toast } = useConsoleUi();
  const [d, setD] = useState<Draft>(() => toDraft(item));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));
  const scoop = kind === 'scoops';

  const valid = d.name.trim() && (scoop ? num(d.cone) > 0 && num(d.cup) > 0 : num(d.price) > 0);

  const save = () => {
    if (!valid) return;
    const image = d.image || (item?.image ?? '');
    if (scoop) {
      const cone = num(d.cone), cup = num(d.cup);
      const fields: Partial<ScoopItem> = {
        name: d.name.trim(),
        tagline: d.tagline.trim(),
        description: d.description.trim(),
        image,
        conePriceLKR: cone,
        biscuitCupPriceLKR: cup,
        doubleConePriceLKR: num(d.doubleCone) || Math.round(cone * 1.8),
        doubleCupPriceLKR: num(d.doubleCup) || Math.round(cup * 1.8),
        isPopular: d.popular,
        isIconic: d.signature,
        isAvailable: d.available,
      };
      if (item) updateScoopItem(item.id, fields);
      else
        createScoopItem({
          id: `flavour-${Date.now()}`,
          category: 'signature',
          dietary: ['Halal', 'Vegetarian'],
          tastingNotes: ['Creamy', 'Fresh'],
          creaminess: 5,
          sweetness: 4,
          intensity: 4,
          accentColor: '#81001E',
          ...fields,
        } as ScoopItem);
    } else {
      const fields: Partial<MenuItem> = {
        name: d.name.trim(),
        portionOrTemp: d.tagline.trim(),
        description: d.description.trim(),
        image,
        priceLKR: num(d.price),
        popular: d.popular,
        isAvailable: d.available,
      };
      const update = kind === 'coffee' ? updateCoffeeItem : updateCakeItem;
      const create = kind === 'coffee' ? createCoffeeItem : createCakeItem;
      if (item) update(item.id, fields);
      else create({ id: `${kind === 'coffee' ? 'coffee' : 'cake'}-${Date.now()}`, category: kind === 'coffee' ? 'coffee' : 'cakes', ...fields } as MenuItem);
    }
    toast(item ? 'Saved' : `${d.name.trim()} added to the menu`);
    onClose();
  };

  const remove = async () => {
    if (!item) return;
    const ok = await confirm({
      title: `Remove ${item.name} from the menu?`,
      message: 'Customers will no longer see it. If it is only out for today, use “Sold out” instead.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    (kind === 'scoops' ? deleteScoopItem : kind === 'coffee' ? deleteCoffeeItem : deleteCakeItem)(item.id);
    toast(`${item.name} removed`);
    onClose();
  };

  const priceInput = (k: keyof Draft, label: string) => (
    <Field label={label}>
      <input value={d[k] as string} onChange={(e) => set(k, e.target.value.replace(/[^\d]/g, '') as never)} inputMode="numeric" className={inputClass} placeholder="LKR" />
    </Field>
  );

  return (
    <Drawer
      open
      onClose={onClose}
      title={item ? item.name : `New ${kind === 'scoops' ? 'ice cream flavour' : kind === 'coffee' ? 'coffee' : 'cake'}`}
      footer={
        <>
          {item && (
            <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={remove}>
              Remove
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {item ? 'Save' : 'Add to menu'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-xl bg-white border border-[#EAE2D6] px-4 py-3">
          <div>
            <p className="font-semibold text-[#241A18]">{d.available ? 'In stock' : 'Sold out'}</p>
            <p className="text-xs text-[#7A6458]">{d.available ? 'Customers can order it' : 'Shown as sold out on the website'}</p>
          </div>
          <Switch checked={d.available} onChange={(v) => set('available', v)} label="In stock" />
        </div>

        <Field label="Photo">
          <PhotoPicker value={d.image} onChange={(url) => set('image', url)} />
        </Field>
        <Field label="Name">
          <input value={d.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
        </Field>
        <Field label={scoop ? 'Short line under the name' : 'Size / serving'} hint={scoop ? 'e.g. Sun-ripened Alphonso mango' : 'e.g. Hot · 8 oz, or 1 slice'}>
          <input value={d.tagline} onChange={(e) => set('tagline', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Description">
          <textarea value={d.description} onChange={(e) => set('description', e.target.value)} rows={3} className={cx(inputClass, 'h-auto py-2.5')} />
        </Field>

        {scoop ? (
          <div>
            <p className="text-sm font-semibold text-[#3D2C24] mb-2">Prices (LKR)</p>
            <div className="grid grid-cols-2 gap-3">
              {priceInput('cone', 'Waffle cone')}
              {priceInput('cup', 'Biscuit cup')}
              {priceInput('doubleCone', 'Double cone')}
              {priceInput('doubleCup', 'Double biscuit cup')}
            </div>
          </div>
        ) : (
          priceInput('price', 'Price (LKR)')
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#3D2C24]">Labels on the website</p>
          <label className="flex items-center justify-between rounded-xl bg-white border border-[#EAE2D6] px-4 py-3 cursor-pointer">
            <span className="text-sm text-[#241A18]">“Popular”</span>
            <Switch checked={d.popular} onChange={(v) => set('popular', v)} label="Popular" />
          </label>
          {scoop && (
            <label className="flex items-center justify-between rounded-xl bg-white border border-[#EAE2D6] px-4 py-3 cursor-pointer">
              <span className="text-sm text-[#241A18]">“Signature” (our best flavour)</span>
              <Switch checked={d.signature} onChange={(v) => set('signature', v)} label="Signature" />
            </label>
          )}
        </div>
      </div>
    </Drawer>
  );
};

// ---- List ----

export const MenuView: React.FC<{ menu: MenuData }> = ({ menu }) => {
  const { toast } = useConsoleUi();
  const [kind, setKind] = useState<Kind>('scoops');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ item?: ScoopItem | MenuItem } | null>(null);

  const items: (ScoopItem | MenuItem)[] = kind === 'scoops' ? menu.scoops : kind === 'coffee' ? menu.coffee : menu.cakes;
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => (q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items), [items, q]);
  const soldOut = items.filter((i) => i.isAvailable === false).length;

  const priceText = (i: ScoopItem | MenuItem) =>
    isScoop(i) ? `Cone ${lkr(i.conePriceLKR)} · Cup ${lkr(i.biscuitCupPriceLKR)}` : lkr(i.priceLKR);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex p-1 bg-[#F3EDE3] rounded-xl self-start" role="tablist">
          {KINDS.map((k) => {
            const count = (k.id === 'scoops' ? menu.scoops : k.id === 'coffee' ? menu.coffee : menu.cakes).length;
            return (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={kind === k.id}
                onClick={() => {
                  setKind(k.id);
                  setQuery('');
                }}
                className={cx(
                  'h-9 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer',
                  kind === k.id ? 'bg-white text-[#241A18] shadow-sm' : 'text-[#6B5A51] hover:text-[#241A18]'
                )}
              >
                {k.label} <span className="text-[#A8988B] font-medium">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-[#A8988B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an item" aria-label="Search menu" className={cx(inputClass, 'pl-9 pr-9')} />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#8A7970] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditor({})}>
            <span className="hidden sm:inline">Add item</span>
          </Button>
        </div>
      </div>

      <p className="text-sm text-[#6B5A51]">
        {soldOut > 0 ? (
          <>
            <strong className="text-[#241A18]">{soldOut} sold out</strong> · flip the switch when an item is back.
          </>
        ) : (
          'Everything is in stock. Flip the switch to mark an item sold out.'
        )}
      </p>

      <Card className="divide-y divide-[#F0E8DC] overflow-hidden">
        {shown.length === 0 ? (
          <EmptyState title="No items found" />
        ) : (
          shown.map((i) => {
            const available = i.isAvailable !== false;
            return (
              <div key={i.id} className="flex items-center gap-3 px-3 sm:px-4 py-3">
                <button type="button" onClick={() => setEditor({ item: i })} className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group">
                  <span className="w-14 h-14 rounded-xl overflow-hidden bg-[#F3EDE3] shrink-0">
                    {i.image && <img src={i.image} alt="" loading="lazy" className={cx('w-full h-full object-cover', !available && 'grayscale opacity-60')} referrerPolicy="no-referrer" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={cx('font-semibold truncate group-hover:underline', available ? 'text-[#241A18]' : 'text-[#8A7970]')}>{i.name}</span>
                      {!available && <Badge tone="grey">Sold out</Badge>}
                    </span>
                    <span className="block text-sm text-[#7A6458] truncate">{priceText(i)}</span>
                  </span>
                </button>
                <span className="hidden sm:block text-sm w-20 text-right text-[#5C4D44]">{available ? 'In stock' : 'Sold out'}</span>
                <Switch
                  checked={available}
                  label={`${i.name} in stock`}
                  onChange={() => {
                    toggleItemStockStatus(i.id, kind);
                    toast(`${i.name} ${available ? 'marked sold out' : 'back in stock'}`);
                  }}
                />
                <Button size="sm" variant="ghost" aria-label={`Edit ${i.name}`} onClick={() => setEditor({ item: i })} icon={<Pencil className="w-4 h-4" />}>
                  <span className="hidden md:inline">Edit</span>
                </Button>
              </div>
            );
          })
        )}
      </Card>

      {editor && <ItemEditor kind={kind} item={editor.item} onClose={() => setEditor(null)} />}
    </div>
  );
};
