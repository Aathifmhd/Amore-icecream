/**
 * Settings: new-order sound, this device's user code, the signed-in account, and (super admin)
 * the photo gallery that menu photos are picked from.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ImagePlus, Images, KeyRound, Lock, ShieldCheck, Trash2, Upload, UserCog, Volume2 } from 'lucide-react';
import { ApiError, ADMIN_SESSION_EVENT, type AdminProfile } from '../../../api';
import { getRememberedDevice, isValidCodeFormat, lockConsole, removeUserCode, setUserCode } from '../../../utils/adminAuth';
import { Badge, Button, Card, EmptyState, Field, Popup, Switch, cx, inputClass, useConsoleUi } from './ui';
import { addGalleryPhoto, GALLERY_CATEGORIES, removeGalleryPhoto, useGallery, type GalleryCategory } from './gallery';

const BRANCH_NAME: Record<string, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };
const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

const SettingCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <Card className="p-5">
    <div className="flex items-center gap-3 mb-4">
      <span className="w-10 h-10 rounded-xl bg-[#81001E]/10 text-[#81001E] flex items-center justify-center shrink-0">{icon}</span>
      <h2 className="font-bold text-[#241A18]">{title}</h2>
    </div>
    {children}
  </Card>
);

// ---- General ---------------------------------------------------------------

const UserCodeCard: React.FC = () => {
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
    <SettingCard icon={<KeyRound className="w-5 h-5" />} title="User code on this device">
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
    </SettingCard>
  );
};

const GeneralSettings: React.FC<{
  admin: AdminProfile;
  soundOn: boolean;
  onSoundChange: (on: boolean) => void;
  onTestSound: () => void;
  onOpenUsers: () => void;
}> = ({ admin, soundOn, onSoundChange, onTestSound, onOpenUsers }) => {
  const isSuper = admin.role !== 'branch';
  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      <SettingCard icon={<Bell className="w-5 h-5" />} title="Notifications">
        <label className="flex items-center justify-between gap-4 rounded-xl bg-[#FBF8F3] border border-[#EAE2D6] px-4 py-3 cursor-pointer">
          <span>
            <span className="block font-semibold text-[#241A18]">New-order sound</span>
            <span className="block text-xs text-[#7A6458] mt-0.5">A chime when a new order comes in. The count also shows in the browser tab.</span>
          </span>
          <Switch checked={soundOn} onChange={onSoundChange} label="New-order sound" />
        </label>
        <Button className="mt-3" variant="ghost" size="sm" icon={<Volume2 className="w-4 h-4" />} onClick={onTestSound}>
          Play test sound
        </Button>
        <p className="text-xs text-[#8A7970] mt-2">This setting is kept on this device only.</p>
      </SettingCard>

      <UserCodeCard />

      <SettingCard icon={isSuper ? <ShieldCheck className="w-5 h-5" /> : <UserCog className="w-5 h-5" />} title="Your account">
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
      </SettingCard>
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
  const { photos, loading, error, reload } = useGallery();
  const [category, setCategory] = useState<'all' | GalleryCategory>('all');
  const [adding, setAdding] = useState(false);

  const shown = useMemo(() => photos.filter((p) => category === 'all' || p.category === category), [photos, category]);
  const count = (c: 'all' | GalleryCategory) => (c === 'all' ? photos.length : photos.filter((p) => p.category === c).length);

  const remove = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Remove “${name}” from the gallery?`,
      message: 'Menu items already using this photo keep it.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await removeGalleryPhoto(id);
      toast(`${name} removed`);
      reload();
    } catch (err) {
      toast(errorText(err, 'Could not remove the photo'), 'error');
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
      {loading && <p className="text-sm text-[#8A7970]">Loading uploaded photos…</p>}

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<Images className="w-6 h-6" />} title="No photos in this category yet">
            Add one with “Add photo”.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
          {shown.map((p) => (
            <figure key={p.id} className="group bg-white rounded-2xl border border-[#EAE2D6] overflow-hidden shadow-xs">
              <div className="relative aspect-square bg-[#F3EDE3] overflow-hidden">
                <img src={p.url} alt={p.name} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                {!p.builtIn && (
                  <button
                    type="button"
                    onClick={() => remove(p.id, p.name)}
                    aria-label={`Remove ${p.name}`}
                    className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 text-red-700 shadow flex items-center justify-center cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <figcaption className="px-3 py-2.5">
                <p className="font-semibold text-sm text-[#241A18] truncate" title={p.name}>
                  {p.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-[#8A7970] truncate flex-1">{p.category}</span>
                  {p.builtIn ? <Badge tone="grey">Built in</Badge> : <Badge tone="green">Uploaded</Badge>}
                </div>
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

export const SettingsView: React.FC<{
  admin: AdminProfile;
  soundOn: boolean;
  onSoundChange: (on: boolean) => void;
  onTestSound: () => void;
  onOpenUsers: () => void;
}> = (props) => {
  const isSuper = props.admin.role !== 'branch';
  const [tab, setTab] = useState<'general' | 'gallery'>(() =>
    isSuper && new URLSearchParams(window.location.search).get('view') === 'gallery' ? 'gallery' : 'general'
  );

  const choose = (t: 'general' | 'gallery') => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === 'gallery') url.searchParams.set('view', 'gallery');
    else url.searchParams.delete('view');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="space-y-5">
      {isSuper && (
        <div className="inline-flex p-1 bg-[#F3EDE3] rounded-xl" role="tablist">
          {(
            [
              ['general', 'General'],
              ['gallery', 'Photo gallery'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => choose(id)}
              className={cx(
                'h-9 px-4 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer',
                tab === id ? 'bg-white text-[#241A18] shadow-sm' : 'text-[#6B5A51] hover:text-[#241A18]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {tab === 'gallery' && isSuper ? <PhotoGallery /> : <GeneralSettings {...props} />}
    </div>
  );
};
