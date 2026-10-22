/**
 * Users: the admin logins. Only the super admin sees this page (and the server only lets the
 * super admin use it). Branch admins are added, changed and removed here.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { BranchId } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { api, ApiError, type AdminProfile } from '../../../api';
import { signOutAdmin } from '../../../utils/adminAuth';
import { Badge, Button, Card, Drawer, EmptyState, Field, cx, inputClass, useConsoleUi } from './ui';
import { timeAgo } from './orderMeta';

interface AdminUser extends AdminProfile {
  createdAt: string | null;
  lastLoginAt: string | null;
  locked: boolean;
}

const BRANCH_SHORT: Record<BranchId, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };
const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

const PasswordFields: React.FC<{
  password: string;
  confirm: string;
  onChange: (password: string, confirm: string) => void;
  label: string;
  hint?: string;
}> = ({ password, confirm, onChange, label, hint }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-4">
      <Field label={label} hint={hint}>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => onChange(e.target.value, confirm)}
            className={cx(inputClass, 'pr-11')}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#7A6458] cursor-pointer"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </Field>
      <Field label="Type it again">
        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => onChange(password, e.target.value)} className={inputClass} />
      </Field>
    </div>
  );
};

const UserEditor: React.FC<{
  user?: AdminUser;
  me: AdminProfile;
  onSaved: (u: AdminUser) => void;
  onDeleted: (username: string) => void;
  onClose: () => void;
}> = ({ user, me, onSaved, onDeleted, onClose }) => {
  const { confirm: ask, toast } = useConsoleUi();
  const isNew = !user;
  const isBranch = isNew || user.role === 'branch';
  const isMe = user?.username === me.username;
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState('');
  const [branchId, setBranchId] = useState<BranchId>(user?.branchId ?? 'akurana');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginName = username.trim().toLowerCase();
  const passwordProblem =
    password && password.length < 8 ? 'At least 8 characters' : password && password !== confirm ? 'The two passwords are different' : null;
  const valid = displayName.trim() && (!isNew || (/^[a-z0-9._-]{2,40}$/.test(loginName) && password)) && !passwordProblem;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        const { user: created } = await api<{ user: AdminUser }>('/admin/users', {
          method: 'POST',
          body: { username: loginName, displayName: displayName.trim(), branchId, password },
          as: 'admin',
        });
        onSaved(created);
        toast(`${created.displayName} can now sign in as “${created.username}”`);
      } else {
        const { user: updated, signedOutSelf } = await api<{ user: AdminUser; signedOutSelf: boolean }>(
          `/admin/users/${encodeURIComponent(user.username)}`,
          {
            method: 'PATCH',
            body: { displayName: displayName.trim(), ...(isBranch && { branchId }), ...(password && { password }) },
            as: 'admin',
          }
        );
        if (signedOutSelf) {
          // A new password signs this login out everywhere, including here
          signOutAdmin();
          return;
        }
        onSaved(updated);
        toast(password ? `Saved. ${updated.displayName} is signed out everywhere and uses the new password now.` : 'Saved');
      }
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not save. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    if (!user) return;
    try {
      const { user: updated } = await api<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(user.username)}`, {
        method: 'PATCH',
        body: { unlock: true },
        as: 'admin',
      });
      onSaved(updated);
      toast(`${updated.displayName} can sign in again`);
    } catch (err) {
      setError(errorText(err, 'Could not unlock. Please try again.'));
    }
  };

  const remove = async () => {
    if (!user) return;
    const ok = await ask({
      title: `Remove ${user.displayName}?`,
      message: `“${user.username}” will be signed out and can no longer sign in. Their branch's orders and employees stay.`,
      confirmLabel: 'Remove login',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/users/${encodeURIComponent(user.username)}`, { method: 'DELETE', as: 'admin' });
      onDeleted(user.username);
      toast(`${user.displayName} removed`);
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not remove. Please try again.'));
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? 'New branch admin' : user.displayName}
      subtitle={user ? `Signs in as “${user.username}”` : 'They will only see their own branch.'}
      footer={
        <>
          {user && isBranch && !isMe && (
            <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={remove}>
              Remove
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid || busy}>
            {busy ? 'Saving…' : isNew ? 'Add branch admin' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</p>}

        {user?.locked && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-900">Locked after too many wrong passwords.</p>
            <Button size="sm" variant="secondary" icon={<Lock className="w-4 h-4" />} onClick={unlock}>
              Unlock
            </Button>
          </div>
        )}

        <Field label="Name" hint="Shown in the console, e.g. Colombo Manager">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
        </Field>
        {isNew && (
          <Field label="Login name" hint="What they type to sign in. Letters, numbers, dot, dash or underscore — no spaces.">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
              autoCapitalize="none"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
        )}
        {isBranch && (
          <Field label="Branch">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value as BranchId)} className={inputClass}>
              {AMORE_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {BRANCH_SHORT[b.id]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <PasswordFields
          label={isNew ? 'Password' : 'New password (optional)'}
          hint={
            isNew
              ? 'At least 8 characters. Give it to them privately; they can set a user code after signing in.'
              : isMe
              ? 'Changing your own password signs you out everywhere, including here.'
              : 'Leave empty to keep the current one. A new password signs them out everywhere.'
          }
          password={password}
          confirm={confirm}
          onChange={(p, c) => {
            setPassword(p);
            setConfirm(c);
          }}
        />
        {passwordProblem && <p className="text-sm text-red-700 -mt-2">{passwordProblem}</p>}
      </div>
    </Drawer>
  );
};

export const UsersView: React.FC<{ me: AdminProfile }> = ({ me }) => {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ user?: AdminUser } | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<{ users: AdminUser[] }>('/admin/users', { as: 'admin' })
      .then((r) => setUsers(r.users))
      .catch((err) => setError(errorText(err, 'Could not load the admin logins.')));
  }, []);
  useEffect(load, [load]);

  const saved = (u: AdminUser) =>
    setUsers((list) => {
      const rest = (list || []).filter((x) => x.username !== u.username);
      return [...rest, u].sort((a, b) => (a.role === b.role ? a.displayName.localeCompare(b.displayName) : a.role === 'superadmin' ? -1 : 1));
    });

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <p className="text-sm text-[#6B5A51] flex-1">
          Branch admins see and run only their own branch: its orders, refunds, reports, stock and employees. Only you can add or change logins.
        </p>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditor({})}>
          <span className="hidden sm:inline">Add branch admin</span>
        </Button>
      </div>

      {error ? (
        <Card className="p-5 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">{error}</p>
          <Button size="sm" variant="secondary" onClick={load}>
            Try again
          </Button>
        </Card>
      ) : (
        <Card className="divide-y divide-[#F0E8DC] overflow-hidden">
          {users === null ? (
            <div className="flex justify-center py-14">
              <div className="w-7 h-7 border-[3px] border-[#81001E]/20 border-t-[#81001E] rounded-full animate-spin" aria-label="Loading" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState icon={<UserCog className="w-6 h-6" />} title="No logins yet" />
          ) : (
            users.map((u) => (
              <button
                key={u.username}
                type="button"
                onClick={() => setEditor({ user: u })}
                className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-[#FBF8F3] cursor-pointer"
              >
                <span
                  className={cx(
                    'w-11 h-11 rounded-full flex items-center justify-center shrink-0',
                    u.role === 'superadmin' ? 'bg-[#81001E] text-white' : 'bg-[#81001E]/10 text-[#81001E]'
                  )}
                >
                  {u.role === 'superadmin' ? <ShieldCheck className="w-5 h-5" /> : <UserCog className="w-5 h-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#241A18] truncate">{u.displayName}</span>
                    {u.username === me.username && <Badge tone="grey">You</Badge>}
                    {u.locked && <Badge tone="amber">Locked</Badge>}
                  </span>
                  <span className="block text-sm text-[#7A6458] truncate">
                    {u.role === 'superadmin' ? 'Super admin' : `Branch admin · ${u.branchId ? BRANCH_SHORT[u.branchId] : '—'}`} · “{u.username}”
                  </span>
                </span>
                <span className="hidden sm:block text-xs text-[#8A7970] text-right shrink-0">
                  {u.lastLoginAt ? `Signed in ${timeAgo(u.lastLoginAt)}` : 'Never signed in'}
                </span>
              </button>
            ))
          )}
        </Card>
      )}

      <p className="text-xs text-[#8A7970]">Owner Google accounts set on the server (OWNER_EMAILS) can also open the console as super admin.</p>

      {editor && (
        <UserEditor
          user={editor.user}
          me={me}
          onSaved={saved}
          onDeleted={(username) => setUsers((list) => (list || []).filter((x) => x.username !== username))}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
};
