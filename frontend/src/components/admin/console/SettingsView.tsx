/**
 * Settings: new-order sound, this device's user code, the signed-in account, and (super admin)
 * the default prices for every branch and the photo gallery that menu photos are picked from.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ImagePlus, Images, KeyRound, Lock, MapPinned, RotateCcw, Tag, Trash2, Upload, UserCog, Volume2 } from 'lucide-react';
import { ApiError, ADMIN_SESSION_EVENT, type AdminProfile } from '../../../api';
import { getRememberedDevice, isValidCodeFormat, lockConsole, removeUserCode, setUserCode } from '../../../utils/adminAuth';
import { Badge, Button, Card, EmptyState, Field, Popup, Switch, cx, inputClass, useConsoleUi } from './ui';
import {
  addGalleryPhoto,
  addMenuUploadsToGallery,
  GALLERY_CATEGORIES,
  removeGalleryPhoto,
  restoreBuiltInPhotos,
  useGallery,
  type GalleryCategory,
  type GalleryPhoto,
} from './gallery';
import { DefaultPricesView } from './DefaultPricesView';
import { ParlourLocationsView } from './ParlourLocationsView';
import type { MenuData } from './useConsoleData';

const BRANCH_NAME: Record<string, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };
const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

// ---- This device -------------------------------------------------------------

const SoundSettings: React.FC<{ soundOn: boolean; onSoundChange: (on: boolean) => void; onTestSound: () => void }> = ({
  soundOn,
  onSoundChange,
  onTestSound,
}) => (
  <div className="max-w-xl">
    <label className="flex items-center justify-between gap-4 rounded-xl bg-[#FBF8F3] border border-[#EAE2D6] px-4 py-3 cursor-pointer">
      <span>
        <span className="block font-semibold text-[#241A18]">Play a sound for new orders</span>
        <span className="block text-xs text-[#7A6458] mt-0.5">A chime when a new order comes in. The count also shows in the browser tab.</span>
      </span>
      <Switch checked={soundOn} onChange={onSoundChange} label="New-order sound" />
    </label>
    <Button className="mt-3" variant="secondary" icon={<Volume2 className="w-4 h-4" />} onClick={onTestSound}>
      Play test sound
    </Button>
  </div>
);

const UserCodeSettings: React.FC = () => {
  const { toast } = useConsoleUi();
  const [hasCode, setHasCode] = useState(() => Boolean(getRememberedDevice()));
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setHasCode(Boolean(getRememberedDevice()));
    window.addEventListener(ADMIN_SESSION_EVENT, update);
    return () => window.removeEventListener(ADMIN_SESSION_EVENT, update);
  }, []);

  const save = async () => {
    if (!isValidCodeFormat(code)) return setError('Use 4 to 6 digits.');
    if (code !== again) return setError('The two codes do not match.');
    setBusy(true);
    setError(null);
    try {
      await setUserCode(code);
      toast(hasCode ? 'User code changed' : 'User code set for this device');
      setEditing(false);
      setCode('');
      setAgain('');
    } catch (err) {
      setError(errorText(err, 'Could not save the code. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await removeUserCode();
    toast('This device no longer uses a user code');
  };

  const codeInput = (value: string, onChange: (v: string) => void, label: string) => (
    <Field label={label}>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className={cx(inputClass, 'text-center text-xl tracking-[0.5em]')}
      />
    </Field>
  );

  return (
    <div className="max-w-xl">
      <p className="text-sm text-[#6B5A51]">
        {hasCode
          ? 'This device opens the console with your 4–6 digit code. Five wrong tries and the full name and password are needed again.'
          : 'Set a 4–6 digit code so this device opens the console with just the code next time.'}
      </p>
      {editing ? (
        <div className="mt-4 space-y-3">
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            {codeInput(code, setCode, hasCode ? 'New code' : 'Code')}
            {codeInput(again, setAgain, 'Type it again')}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save code'}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={hasCode ? 'secondary' : 'primary'} icon={<KeyRound className="w-4 h-4" />} onClick={() => setEditing(true)}>
            {hasCode ? 'Change code' : 'Set a user code'}
          </Button>
          {hasCode && (
            <>
              <Button variant="secondary" icon={<Lock className="w-4 h-4" />} onClick={lockConsole}>
                Lock now
              </Button>
              <Button variant="ghost" onClick={remove}>
                Remove code
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---- Account ------------------------------------------------------------------

const AccountSettings: React.FC<{ admin: AdminProfile; onOpenUsers: () => void }> = ({ admin, onOpenUsers }) => {
  const isSuper = admin.role !== 'branch';
  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F6D58E] to-[#E8B04B] text-[#3A0611] font-extrabold text-lg flex items-center justify-center shrink-0">
          {(admin.displayName || admin.username).trim()[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[#241A18] truncate">{admin.displayName}</p>
          <p className="text-sm text-[#7A6458] truncate">
            {isSuper ? 'Super admin' : `Branch admin · ${admin.branchId ? BRANCH_NAME[admin.branchId] : ''}`}
            {admin.google ? ' · Google sign-in' : ` · signs in as “${admin.username}”`}
          </p>
        </div>
      </div>
      <p className="text-sm text-[#6B5A51] mt-4">
        {isSuper
          ? 'Change your password, or add and manage branch admins, on the Users page.'
          : 'To change your password, ask the super admin.'}
      </p>
      {isSuper && (
        <Button className="mt-3" variant="secondary" icon={<UserCog className="w-4 h-4" />} onClick={onOpenUsers}>
          Open Users
        </Button>
      )}
    </div>
  );
};

// ---- Photo gallery --------------------------------------------------------------

const AddPhotoPopup: React.FC<{ onClose: () => void; onAdded: () => void }> = ({ onClose, onAdded }) => {
  const { toast } = useConsoleUi();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GalleryCategory>('Ice Cream Flavours');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (f?: File) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    // A readable default name from the file name ("mango-bowl.jpg" → "Mango bowl")
    if (!name) {
      const base = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
      setName(base ? base[0].toUpperCase() + base.slice(1) : '');
    }
  };

  const save = async () => {
    if (!file || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addGalleryPhoto(file, name.trim(), category);
      toast(`${name.trim()} added to the gallery`);
      onAdded();
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not add the photo. Try a JPEG, PNG or WebP.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popup
      open
      onClose={onClose}
      title="Add a photo to the gallery"
      subtitle="It can then be picked for any menu item."
      footer={
        <>
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Upload className="w-4 h-4" />} onClick={save} disabled={!file || !name.trim() || busy}>
            {busy ? 'Uploading…' : 'Add to gallery'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</p>}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cx(
            'w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors',
            preview ? 'border-transparent' : 'border-[#D9CBB7] bg-[#FBF8F3] hover:border-[#81001E]/50'
          )}
        >
          {preview ? (
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-center text-[#7A6458]">
              <ImagePlus className="w-8 h-8 mx-auto mb-2 text-[#81001E]" />
              <span className="block font-semibold text-[#241A18]">Choose a photo</span>
              <span className="block text-xs mt-1">JPEG, PNG or WebP · square photos look best</span>
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} placeholder="e.g. Oreo cookies & cream" />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value as GalleryCategory)} className={inputClass}>
            {GALLERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Popup>
  );
};

const PhotoGallery: React.FC = () => {
  const { confirm, toast } = useConsoleUi();
  const { photos, hiddenCount, waiting, loading, error, reload } = useGallery();
  const [category, setCategory] = useState<'all' | GalleryCategory>('all');
  const [adding, setAdding] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importing = useRef(false);

  // Photos uploaded for menu items join the gallery when it is opened (each picture once)
  const addMenuUploads = async () => {
    if (importing.current) return;
    importing.current = true;
    setImportError(null);
    try {
      const { added } = await addMenuUploadsToGallery();
      if (added) toast(`Added ${added} photo${added === 1 ? '' : 's'} uploaded for menu items`);
      reload();
    } catch (err) {
      setImportError(errorText(err, 'Could not add the photos uploaded for menu items.'));
    } finally {
      importing.current = false;
    }
  };
  useEffect(() => {
    if (waiting > 0 && !importError) addMenuUploads();
  }, [waiting]);

  const shown = useMemo(() => photos.filter((p) => category === 'all' || p.category === category), [photos, category]);
  const count = (c: 'all' | GalleryCategory) => (c === 'all' ? photos.length : photos.filter((p) => p.category === c).length);

  const remove = async (photo: GalleryPhoto) => {
    const ok = await confirm({
      title: `Delete “${photo.name}” from the gallery?`,
      message: photo.builtIn
        ? 'This is one of Amore’s own photos, so you can bring it back later with “Restore Amore’s photos”. Menu items already using it keep it.'
        : 'Menu items already using this photo keep it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await removeGalleryPhoto(photo.id);
      toast(`${photo.name} deleted`);
      reload();
    } catch (err) {
      toast(errorText(err, 'Could not delete the photo'), 'error');
    }
  };

  const restore = async () => {
    try {
      await restoreBuiltInPhotos();
      toast(`${hiddenCount} photo${hiddenCount === 1 ? '' : 's'} restored`);
      reload();
    } catch (err) {
      toast(errorText(err, 'Could not restore the photos'), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Photo category">
          {(['all', ...GALLERY_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cx(
                'h-9 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer border transition-colors',
                category === c ? 'bg-[#81001E] text-white border-[#81001E]' : 'bg-white text-[#5C4D44] border-[#E2D8CA] hover:border-[#C9B9A4]'
              )}
            >
              {c === 'all' ? 'All photos' : c} <span className={category === c ? 'text-white/70' : 'text-[#A8988B]'}>{count(c)}</span>
            </button>
          ))}
        </div>
        <Button variant="primary" icon={<ImagePlus className="w-4 h-4" />} onClick={() => setAdding(true)} className="self-start sm:self-auto">
          Add photo
        </Button>
      </div>

      {error && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{error} Showing Amore's built-in photos.</p>}
      {hiddenCount > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-[#6B5A51]">
          {hiddenCount} of Amore’s own photos {hiddenCount === 1 ? 'is' : 'are'} deleted from the gallery.
          <Button size="sm" variant="ghost" icon={<RotateCcw className="w-4 h-4" />} onClick={restore}>
            Restore Amore’s photos
          </Button>
        </p>
      )}
      {loading && <p className="text-sm text-[#8A7970]">Loading uploaded photos…</p>}
      {importError && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          {importError}
          <Button size="sm" variant="ghost" icon={<RotateCcw className="w-4 h-4" />} onClick={addMenuUploads}>
            Try again
          </Button>
        </p>
      )}

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<Images className="w-6 h-6" />} title="No photos in this category yet">
            Add one with “Add photo”.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {shown.map((p) => (
            <figure key={p.id} className="group bg-white rounded-2xl border border-[#EAE2D6] overflow-hidden shadow-xs">
              <div className="relative aspect-square bg-[#F3EDE3] overflow-hidden">
                <img src={p.url} alt={p.name} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
              </div>
              <figcaption className="flex items-start gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-[#241A18] truncate" title={p.name}>
                    {p.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 min-w-0">
                    <span className="text-xs text-[#8A7970] truncate">{p.category}</span>
                    {p.builtIn ? <Badge tone="grey">Built in</Badge> : <Badge tone="green">Uploaded</Badge>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(p)}
                  aria-label={`Delete ${p.name}`}
                  title="Delete from the gallery"
                  className="w-8 h-8 -mr-1 shrink-0 rounded-full flex items-center justify-center text-[#8A7970] hover:text-red-700 hover:bg-red-50 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {adding && <AddPhotoPopup onClose={() => setAdding(false)} onAdded={reload} />}
    </div>
  );
};

// ---- Page -------------------------------------------------------------------------

type SectionId = 'sound' | 'code' | 'account' | 'prices' | 'gallery' | 'parlours';
type Section = { id: SectionId; icon: React.ReactNode; label: string; desc: string; superOnly?: boolean };

// The settings menu, grouped under headings (like Cargo POS)
const GROUPS: { heading: string; items: Section[] }[] = [
  {
    heading: 'This device',
    items: [
      { id: 'sound', icon: <Bell className="w-4 h-4" />, label: 'New-order sound', desc: 'A chime for new orders. Kept on this device only.' },
      { id: 'code', icon: <KeyRound className="w-4 h-4" />, label: 'User code', desc: 'Open the console on this device with a short code instead of the password.' },
    ],
  },
  {
    heading: 'Account',
    items: [{ id: 'account', icon: <UserCog className="w-4 h-4" />, label: 'Your account', desc: 'Who is signed in here, and where passwords are changed.' }],
  },
  {
    heading: 'Menu',
    items: [
      {
        id: 'prices',
        icon: <Tag className="w-4 h-4" />,
        label: 'Default prices',
        desc: 'The price at every branch, unless a branch has set its own price for an item.',
        superOnly: true,
      },
      { id: 'gallery', icon: <Images className="w-4 h-4" />, label: 'Photo gallery', desc: 'The photos menu items are picked from.', superOnly: true },
    ],
  },
  {
    heading: 'Parlours',
    items: [
      {
        id: 'parlours',
        icon: <MapPinned className="w-4 h-4" />,
        label: 'Locations & delivery',
        desc: 'Where each parlour is on the map, and how far from it we deliver.',
        superOnly: true,
      },
    ],
  },
];
const SECTION_KEY = 'amore_settings_section';

export const SettingsView: React.FC<{
  admin: AdminProfile;
  menu: MenuData;
  soundOn: boolean;
  onSoundChange: (on: boolean) => void;
  onTestSound: () => void;
  onOpenUsers: () => void;
}> = ({ admin, menu, soundOn, onSoundChange, onTestSound, onOpenUsers }) => {
  const isSuper = admin.role !== 'branch';
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isSuper || !i.superOnly) })).filter((g) => g.items.length);
  const all = groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.heading })));

  // The page link (?view=) first, then the section last opened on this device
  const [section, setSection] = useState<SectionId>(() => {
    const ok = (v: string | null) => all.find((i) => i.id === v)?.id;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(SECTION_KEY);
    } catch {
      /* storage blocked */
    }
    return ok(new URLSearchParams(window.location.search).get('view')) || ok(saved) || all[0].id;
  });

  const open = (id: SectionId) => {
    setSection(id);
    try {
      localStorage.setItem(SECTION_KEY, id);
    } catch {
      /* storage blocked */
    }
    const url = new URL(window.location.href);
    url.searchParams.set('view', id);
    window.history.replaceState({}, '', url.toString());
  };

  const cur = all.find((i) => i.id === section) || all[0];

  return (
    <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)] gap-5 items-start">
      {/* Phones and tablets: one row of sections to swipe through */}
      <nav className="lg:hidden flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" aria-label="Settings sections">
        {all.map((i) => (
          <button
            key={i.id}
            type="button"
            aria-current={cur.id === i.id ? 'page' : undefined}
            onClick={() => open(i.id)}
            className={cx(
              'inline-flex items-center gap-2 h-10 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer border transition-colors',
              cur.id === i.id ? 'bg-[#81001E] text-white border-[#81001E]' : 'bg-white text-[#5C4D44] border-[#E2D8CA] hover:border-[#C9B9A4]'
            )}
          >
            {i.icon}
            {i.label}
          </button>
        ))}
      </nav>

      {/* Larger screens: the sections grouped under headings */}
      <nav className="hidden lg:flex flex-col gap-4 sticky top-4 bg-white border border-[#EAE2D6] rounded-2xl p-3 shadow-xs" aria-label="Settings sections">
        {groups.map((g) => (
          <div key={g.heading} className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#A8988B]">{g.heading}</p>
            {g.items.map((i) => (
              <button
                key={i.id}
                type="button"
                aria-current={cur.id === i.id ? 'page' : undefined}
                onClick={() => open(i.id)}
                className={cx(
                  'flex items-center gap-2.5 w-full px-2.5 py-2.5 rounded-lg text-sm font-semibold text-left cursor-pointer transition-colors',
                  cur.id === i.id ? 'bg-[#81001E]/10 text-[#81001E]' : 'text-[#5C4D44] hover:bg-[#F7F3EC] hover:text-[#241A18]'
                )}
              >
                {i.icon}
                <span>{i.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <Card className="min-h-[22rem]">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#F0E8DC]">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A8988B]">{cur.group}</p>
          <h2 className="text-xl font-bold text-[#241A18] mt-0.5">{cur.label}</h2>
          <p className="text-sm text-[#6B5A51] mt-1">{cur.desc}</p>
        </div>
        <div className="px-5 sm:px-6 py-5">
          {cur.id === 'sound' && <SoundSettings soundOn={soundOn} onSoundChange={onSoundChange} onTestSound={onTestSound} />}
          {cur.id === 'code' && <UserCodeSettings />}
          {cur.id === 'account' && <AccountSettings admin={admin} onOpenUsers={onOpenUsers} />}
          {cur.id === 'prices' && isSuper && <DefaultPricesView menu={menu} />}
          {cur.id === 'gallery' && isSuper && <PhotoGallery />}
          {cur.id === 'parlours' && isSuper && <ParlourLocationsView />}
        </div>
      </Card>
    </div>
  );
};
