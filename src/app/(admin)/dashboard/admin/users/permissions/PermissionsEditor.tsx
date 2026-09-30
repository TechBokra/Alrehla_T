'use client';

import React from 'react';
import { AdminPermission } from '@/types';
import { updateAdminPermissions } from '@/actions/admin-permissions';

export type AdminRow = {
  id: string;
  fullName: string;
  role: 'super_admin' | 'general_supervisor';
  /** فاضي = ماشي على الافتراضي بتاع دوره. */
  permissions: AdminPermission[] | null;
  defaults: AdminPermission[];
};

export function PermissionsEditor({
  admin,
  labels,
  allPermissions,
  editable,
}: {
  admin: AdminRow;
  labels: Record<string, string>;
  allPermissions: AdminPermission[];
  editable: boolean;
}) {
  const [useDefault, setUseDefault] = React.useState(admin.permissions === null);
  const [selected, setSelected] = React.useState<AdminPermission[]>(
    admin.permissions ?? admin.defaults
  );
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const effective = useDefault ? admin.defaults : selected;

  async function save() {
    setSaving(true);
    setMessage(null);
    const result = await updateAdminPermissions({
      userId: admin.id,
      permissions: selected,
      useRoleDefault: useDefault,
    });
    setSaving(false);
    setMessage(
      result.ok
        ? { ok: true, text: 'اتحفظت. التغيير بيبان له بعد ما يعمل تحديث للصفحة.' }
        : { ok: false, text: result.error }
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-black text-slate-800">{admin.fullName}</p>
          <p className="text-sm font-bold text-slate-500">
            {admin.role === 'super_admin' ? 'مدير النظام' : 'مشرف عام'}
            {admin.permissions === null ? ' — على الافتراضي' : ' — صلاحيات مخصّصة'}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
          {effective.length} من {allPermissions.length}
        </span>
      </div>

      {!editable ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
          {admin.id ? 'تعديل الصلاحيات متاح لمدير النظام فقط، ولحسابات غير حسابه.' : ''}
        </p>
      ) : (
        <>
          <label className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={useDefault}
              onChange={(e) => setUseDefault(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300"
            />
            <span className="text-sm font-bold text-slate-700">
              سيبه على الافتراضي بتاع دوره — أي تغيير في الافتراضي بعدين يسري عليه
            </span>
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            {allPermissions.map((permission) => {
              const on = effective.includes(permission);
              return (
                <label
                  key={permission}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    useDefault
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                      : 'cursor-pointer border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={useDefault}
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
              disabled={saving}
              className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ…' : 'حفظ الصلاحيات'}
            </button>
            {message && (
              <p
                className={`text-sm font-bold ${
                  message.ok ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {message.text}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
