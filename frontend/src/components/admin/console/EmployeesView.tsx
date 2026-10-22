/**
 * Employees: each branch admin keeps the staff records of their own branch; the super admin
 * sees every branch's. Records are private (NIC, salary, photo) and are only loaded from the
 * server for an admin allowed to see them.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IdCard, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { BranchId } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { api, ApiError } from '../../../api';
import { photoDataUrl } from '../../../utils/imageUpload';
import { formatPrice } from '../../../utils/currency';
import { Badge, Button, Card, Popup, EmptyState, Field, cx, inputClass, useConsoleUi } from './ui';
import { BranchFilter } from './useConsoleData';

export interface Employee {
  id: string;
  branchId: BranchId;
  fullName: string;
  position: string;
  phone: string;
  nic: string;
  address: string;
  joinedOn: string;
  emergencyName: string;
  emergencyPhone: string;
  salaryLKR: number | null;
  notes: string;
  photo: string;
  updatedAt: string;
}

type Draft = Omit<Employee, 'id' | 'updatedAt' | 'salaryLKR'> & { salary: string };

const BRANCH_SHORT: Record<BranchId, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };
const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

const toDraft = (e: Employee | undefined, branchId: BranchId): Draft => ({
  branchId: e?.branchId ?? branchId,
  fullName: e?.fullName ?? '',
  position: e?.position ?? '',
  phone: e?.phone ?? '',
  nic: e?.nic ?? '',
  address: e?.address ?? '',
  joinedOn: e?.joinedOn ?? '',
  emergencyName: e?.emergencyName ?? '',
  emergencyPhone: e?.emergencyPhone ?? '',
  salary: e?.salaryLKR != null ? String(e.salaryLKR) : '',
  notes: e?.notes ?? '',
  photo: e?.photo ?? '',
});

const Avatar: React.FC<{ e: Pick<Employee, 'photo' | 'fullName'>; size?: string }> = ({ e, size = 'w-12 h-12' }) =>
  e.photo ? (
    <img src={e.photo} alt="" className={cx(size, 'rounded-full object-cover shrink-0 bg-[#F3EDE3]')} />
  ) : (
    <span className={cx(size, 'rounded-full shrink-0 bg-[#81001E]/10 text-[#81001E] font-bold flex items-center justify-center')}>
      {(e.fullName || '?').trim()[0]?.toUpperCase()}
    </span>
  );

const EmployeeEditor: React.FC<{
  employee?: Employee;
  defaultBranch: BranchId;
  lockedBranch: BranchId | null;
  onSaved: (e: Employee) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}> = ({ employee, defaultBranch, lockedBranch, onSaved, onDeleted, onClose }) => {
  const { confirm, toast } = useConsoleUi();
  const [d, setD] = useState<Draft>(() => toDraft(employee, lockedBranch ?? defaultBranch));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const valid = d.fullName.trim() && d.position.trim() && d.phone.trim();

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    try {
      set('photo', await photoDataUrl(file));
    } catch {
      setError('Could not use that photo. Try a JPEG or PNG.');
    }
  };

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    const { salary, ...rest } = d;
    const body = { ...rest, salaryLKR: salary.trim() ? Number(salary) : null, ...(lockedBranch && { branchId: lockedBranch }) };
    try {
      const { employee: saved } = employee
        ? await api<{ employee: Employee }>(`/employees/${employee.id}`, { method: 'PATCH', body, as: 'admin' })
        : await api<{ employee: Employee }>('/employees', { method: 'POST', body, as: 'admin' });
      onSaved(saved);
      toast(employee ? 'Saved' : `${saved.fullName} added`);
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not save. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!employee) return;
    const ok = await confirm({
      title: `Remove ${employee.fullName}?`,
      message: 'Their record will be deleted for good.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/employees/${employee.id}`, { method: 'DELETE', as: 'admin' });
      onDeleted(employee.id);
      toast(`${employee.fullName} removed`);
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not remove. Please try again.'));
    }
  };

  const text = (k: keyof Draft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <Field label={label} hint={hint}>
      <input value={d[k] as string} onChange={(e) => set(k, e.target.value as never)} className={inputClass} {...props} />
    </Field>
  );

  return (
    <Popup
      open
      onClose={onClose}
      title={employee ? employee.fullName : 'New employee'}
      subtitle={employee ? `${employee.position} · ${BRANCH_SHORT[employee.branchId]}` : undefined}
      footer={
        <>
          {employee && (
            <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={remove}>
              Remove
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid || busy}>
            {busy ? 'Saving…' : employee ? 'Save' : 'Add employee'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</p>}

        <div className="flex items-center gap-4">
          <Avatar e={d} size="w-20 h-20" />
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>
              {d.photo ? 'Change photo' : 'Add photo'}
            </Button>
            {d.photo && (
              <Button size="sm" variant="ghost" icon={<X className="w-4 h-4" />} onClick={() => set('photo', '')}>
                Remove photo
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </div>
        </div>

        {!lockedBranch && (
          <Field label="Branch">
            <select value={d.branchId} onChange={(e) => set('branchId', e.target.value as BranchId)} className={inputClass}>
              {AMORE_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {BRANCH_SHORT[b.id]}
                </option>
              ))}
            </select>
          </Field>
        )}
        {text('fullName', 'Full name', { autoComplete: 'off' })}
        <div className="grid sm:grid-cols-2 gap-4">
          {text('position', 'Position', {}, 'e.g. Scooper, Barista, Cashier')}
          {text('phone', 'Phone', { inputMode: 'tel' })}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="NIC number" hint="9 digits + V/X, or 12 digits">
            <input value={d.nic} onChange={(e) => set('nic', e.target.value.toUpperCase().replace(/[^0-9VX]/g, ''))} maxLength={12} className={inputClass} />
          </Field>
          {text('joinedOn', 'Date joined', { type: 'date' })}
        </div>
        <Field label="Address">
          <textarea value={d.address} onChange={(e) => set('address', e.target.value)} rows={2} className={cx(inputClass, 'h-auto py-2.5')} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          {text('emergencyName', 'Emergency contact')}
          {text('emergencyPhone', 'Emergency phone', { inputMode: 'tel' })}
        </div>
        <Field label="Monthly salary (LKR)">
          <input value={d.salary} onChange={(e) => set('salary', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" className={inputClass} />
        </Field>
        <Field label="Notes">
          <textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={cx(inputClass, 'h-auto py-2.5')} />
        </Field>
        <p className="text-xs text-[#8A7970]">Only this branch's admin and the super admin can see these details.</p>
      </div>
    </Popup>
  );
};

export const EmployeesView: React.FC<{ branch: BranchFilter; lockedBranch: BranchId | null }> = ({ branch, lockedBranch }) => {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ employee?: Employee } | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<{ employees: Employee[] }>(`/employees${branch === 'all' ? '' : `?branch=${branch}`}`, { as: 'admin' })
      .then((r) => setEmployees(r.employees))
      .catch((err) => setError(errorText(err, 'Could not load employees.')));
  }, [branch]);

  useEffect(() => {
    setEmployees(null);
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      (employees || []).filter(
        (e) => !q || [e.fullName, e.position, e.phone, e.nic].some((v) => v.toLowerCase().includes(q))
      ),
    [employees, q]
  );

  const saved = (e: Employee) =>
    setEmployees((list) => {
      const rest = (list || []).filter((x) => x.id !== e.id);
      // A super admin looking at one branch: an employee moved elsewhere drops out of the list
      return branch !== 'all' && e.branchId !== branch ? rest : [...rest, e].sort((a, b) => a.fullName.localeCompare(b.fullName));
    });

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="w-4 h-4 text-[#A8988B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find by name, position, phone or NIC" aria-label="Search employees" className={cx(inputClass, 'pl-9')} />
        </div>
        <span className="flex-1 hidden sm:block" />
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditor({})}>
          <span className="hidden sm:inline">Add employee</span>
        </Button>
      </div>

      {error && (
        <Card className="p-5 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">{error}</p>
          <Button size="sm" variant="secondary" onClick={load}>
            Try again
          </Button>
        </Card>
      )}

      {!error && (
        <Card className="divide-y divide-[#F0E8DC] overflow-hidden">
          {employees === null ? (
            <div className="flex justify-center py-14">
              <div className="w-7 h-7 border-[3px] border-[#81001E]/20 border-t-[#81001E] rounded-full animate-spin" aria-label="Loading" />
            </div>
          ) : shown.length === 0 ? (
            <EmptyState icon={<IdCard className="w-6 h-6" />} title={employees.length === 0 ? 'No employees yet' : 'Nobody matches that search'}>
              {employees.length === 0 && 'Add your team with “Add employee”.'}
            </EmptyState>
          ) : (
            shown.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEditor({ employee: e })}
                className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-[#FBF8F3] cursor-pointer"
              >
                <Avatar e={e} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#241A18] truncate">{e.fullName}</span>
                    {branch === 'all' && <Badge tone="grey">{BRANCH_SHORT[e.branchId]}</Badge>}
                  </span>
                  <span className="block text-sm text-[#7A6458] truncate">
                    {e.position} · {e.phone}
                  </span>
                </span>
                <span className="hidden md:block text-sm text-right text-[#5C4D44] shrink-0">
                  {e.salaryLKR != null && <span className="block font-semibold">{formatPrice(e.salaryLKR, 'LKR')}</span>}
                  {e.joinedOn && <span className="block text-xs text-[#8A7970]">Since {new Date(e.joinedOn).toLocaleDateString()}</span>}
                </span>
              </button>
            ))
          )}
        </Card>
      )}

      {editor && (
        <EmployeeEditor
          employee={editor.employee}
          defaultBranch={branch === 'all' ? 'akurana' : branch}
          lockedBranch={lockedBranch}
          onSaved={saved}
          onDeleted={(id) => setEmployees((list) => (list || []).filter((x) => x.id !== id))}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
};
