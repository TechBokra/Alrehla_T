'use client';

import React from 'react';
import { AdminPermission } from '@/types';
import { updateRolePermissions } from '@/actions/admin-permissions';
import type { EditableAdminRole } from '@/data/domains/auth';

/**
 * صلاحيات دور واحد — الحفظ بيسري على **كل** اللي في الدور.
 */
export function RolePermissionsEditor({
  role,
  title,
  people,
  initial,
  labels,
  allPermissions,
  disabled,
}: {
  role: EditableAdminRole;
  title: string;
  people: string[];
  initial: AdminPermission[];
  labels: Record<string, string>;
  allPermissions: AdminPermission[];
  disabled?: boolean;
}) {
  const [selected, setSelected] = React.useState<AdminPermission[]>(initial);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const changed =
    selected.length !== initial.length ||
    selected.some((p) => !initial.includes(p));

  async function save() {
    setSaving(true);
    setMessage(null);
    const result = await updateRolePermissions({ role, permissions: selected });
    setSaving(false);
    setMessage(
      result.ok
        ? {
            ok: true,
            text:
              people.length > 0
                ? `اتحفظت لـ${people.length} ${people.length === 1 ? 'شخص' : 'أشخاص'}. بتبان لهم بعد تحديث الصفحة.`
                : 'اتحفظت. أي حد تضيفه للدور ده هياخدها.',
          }
        : { ok: false, text: result.error }
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-black text-slate-800">{title}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {people.length === 0
              ? 'مفيش حد في الدور ده لسه — اللي هتضيفه هياخد الصلاحيات دي'
              : `${people.length} ${people.length === 1 ? 'شخص' : 'أشخاص'}: ${people.join('، ')}`}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
          {selected.length} من {allPermissions.length}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {allPermissions.map((permission) => {
          const on = selected.includes(permission);
          return (
            <label
              key={permission}
              className={`flex items-center gap-3 rounded-2xl border p-3 ${
                disabled
                  ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                  : on
                    ? 'cursor-pointer border-amber-300 bg-amber-50/50'
                    : 'cursor-pointer border-slate-200 hover:border-amber-300'
              }`}
            >
              <input
                type="checkbox"
                disabled={disabled || saving}
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

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving || disabled || !changed}
          className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ…' : `حفظ صلاحيات «${title}»`}
        </button>
        {message && (
          <p
            className={`text-sm font-bold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
