'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { AdminPermission } from '@/types';
import {
  saveAdminRole,
  deleteAdminRole,
  assignAdminRole,
} from '@/actions/admin-permissions';
import type { AdminRoleRow } from '@/data/domains/auth';

type Message = { ok: boolean; text: string } | null;

function Feedback({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role={message.ok ? 'status' : 'alert'}
      className={`text-sm font-bold ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}
    >
      {message.text}
    </p>
  );
}

function PermissionChecklist({
  selected,
  setSelected,
  labels,
  allPermissions,
  disabled,
}: {
  selected: AdminPermission[];
  setSelected: React.Dispatch<React.SetStateAction<AdminPermission[]>>;
  labels: Record<string, string>;
  allPermissions: AdminPermission[];
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {allPermissions.map((permission) => {
        const on = selected.includes(permission);
        return (
          <label
            key={permission}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${
              on
                ? 'border-amber-300 bg-amber-50/50'
                : 'border-slate-200 hover:border-amber-300'
            }`}
          >
            <input
              type="checkbox"
              disabled={disabled}
              checked={on}
              onChange={(e) =>
                setSelected((prev) =>
                  e.target.checked
                    ? [...prev, permission]
                    : prev.filter((p) => p !== permission)
                )
              }
              className="h-5 w-5 rounded border-slate-300"
            />
            <span className="text-sm font-bold text-slate-700">
              {labels[permission] ?? permission}
            </span>
          </label>
        );
      })}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-amber-500';

/** دور إداري واحد: اسمه وصلاحياته ومين فيه — والحفظ بيسري على الكل. */
export function AdminRoleEditor({
  role,
  people,
  labels,
  allPermissions,
}: {
  role: AdminRoleRow;
  people: string[];
  labels: Record<string, string>;
  allPermissions: AdminPermission[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState(role.name);
  const [selected, setSelected] = React.useState<AdminPermission[]>(
    role.permissions
  );
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<Message>(null);

  const changed =
    name.trim() !== role.name ||
    selected.length !== role.permissions.length ||
    selected.some((p) => !role.permissions.includes(p));

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveAdminRole({
      id: role.id,
      name,
      permissions: selected,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    setMessage({
      ok: true,
      text:
        people.length > 0
          ? `اتحفظ لـ${people.length} ${people.length === 1 ? 'شخص' : 'أشخاص'}. بيبان لهم بعد تحديث الصفحة.`
          : 'اتحفظ.',
    });
    router.refresh();
  }

  async function remove() {
    const sure = window.confirm(
      `هتمسح دور «${role.name}».` +
        (people.length > 0
          ? `\n\n${people.length} ${people.length === 1 ? 'شخص' : 'أشخاص'} فيه هيرجعوا للدور الافتراضي.`
          : '') +
        '\n\nتأكيد؟'
    );
    if (!sure) return;
    setBusy(true);
    setMessage(null);
    const result = await deleteAdminRole(role.id);
    setBusy(false);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              aria-label="اسم الدور"
              className={`${inputClass} max-w-xs text-lg font-black`}
            />
            {role.isDefault && (
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                الافتراضي
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-500">
            {people.length === 0
              ? 'مفيش حد في الدور ده لسه'
              : `${people.length} ${people.length === 1 ? 'شخص' : 'أشخاص'}: ${people.join('، ')}`}
          </p>
          {role.isDefault && (
            <p className="text-xs font-medium text-slate-400">
              أي إداري جديد بيبدأ هنا، ومايتمسحش.
            </p>
          )}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
          {selected.length} من {allPermissions.length}
        </span>
      </div>

      <PermissionChecklist
        selected={selected}
        setSelected={setSelected}
        labels={labels}
        allPermissions={allPermissions}
        disabled={busy}
      />

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={busy || !changed}
          className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'جاري الحفظ…' : 'حفظ'}
        </button>
        {!role.isDefault && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            مسح الدور
          </button>
        )}
        <Feedback message={message} />
      </div>
    </div>
  );
}

/** إضافة دور إداري جديد. */
export function NewAdminRole({
  labels,
  allPermissions,
}: {
  labels: Record<string, string>;
  allPermissions: AdminPermission[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [selected, setSelected] = React.useState<AdminPermission[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<Message>(null);

  async function create() {
    setBusy(true);
    setMessage(null);
    const result = await saveAdminRole({ name, permissions: selected });
    setBusy(false);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    setName('');
    setSelected([]);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-6 font-bold text-slate-600 transition-colors hover:border-amber-400 hover:text-slate-900"
      >
        <Plus className="h-5 w-5" />
        دور إداري جديد
      </button>
    );
  }

  return (
    <div className="rounded-3xl border-2 border-amber-300 bg-white p-6 shadow-sm">
      <p className="mb-3 text-lg font-black text-slate-800">دور إداري جديد</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="اسم الدور — مثلًا: مسؤول دعم"
        aria-label="اسم الدور الجديد"
        className={`${inputClass} mb-4 max-w-sm`}
      />
      <PermissionChecklist
        selected={selected}
        setSelected={setSelected}
        labels={labels}
        allPermissions={allPermissions}
        disabled={busy}
      />
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'جاري الإضافة…' : 'إضافة الدور'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMessage(null);
          }}
          disabled={busy}
          className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600 hover:text-slate-900"
        >
          إلغاء
        </button>
        <Feedback message={message} />
      </div>
    </div>
  );
}

/** الإداريين: أنهي دور لكل واحد. */
export function PeopleAssignment({
  people,
  roles,
}: {
  people: { id: string; fullName: string; adminRoleId: string | null }[];
  roles: { id: string; name: string; isDefault: boolean }[];
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-lg font-black text-slate-800">الإداريين وأدوارهم</p>
      <p className="mt-1 mb-4 text-sm font-medium text-slate-500">
        الحفظ فوري لكل شخص. التغيير بيبان له بعد ما يعمل تحديث للصفحة.
      </p>
      {people.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
          مفيش إداريين غير مدير النظام. ضيف حد من «المستخدمين» بدور «إداري».
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} roles={roles} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonRow({
  person,
  roles,
}: {
  person: { id: string; fullName: string; adminRoleId: string | null };
  roles: { id: string; name: string; isDefault: boolean }[];
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(person.adminRoleId ?? '');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<Message>(null);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setBusy(true);
    setMessage(null);
    const chosen = roles.find((r) => r.id === next);
    // الافتراضي بيتخزّن فاضي — فلو اتغيّر اسمه أو صلاحياته بيفضل ماشي عليه.
    const result = await assignAdminRole({
      userId: person.id,
      adminRoleId: chosen && !chosen.isDefault ? chosen.id : null,
    });
    setBusy(false);
    if (!result.ok) {
      setValue(previous);
      setMessage({ ok: false, text: result.error });
      return;
    }
    setMessage({ ok: true, text: 'اتحفظ' });
    router.refresh();
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="font-bold text-slate-800">{person.fullName}</span>
      <div className="flex items-center gap-3">
        <Feedback message={message} />
        <select
          value={value}
          disabled={busy}
          onChange={(e) => change(e.target.value)}
          aria-label={`الدور الإداري لـ${person.fullName}`}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:border-amber-500 focus:outline-none disabled:opacity-60"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}
