'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { updateMyProfile } from '@/actions/profile';

export function ProfileForm({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(fullName);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const changed = name.trim() !== fullName.trim();

  async function save() {
    setSaving(true);
    setMessage(null);
    const result = await updateMyProfile(name);
    setSaving(false);
    if (result.ok) {
      setMessage({ ok: true, text: 'اتحفظ ✓' });
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.error });
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-6 font-black text-slate-800">بياناتك</h2>

      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">الاسم</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            البريد الإلكتروني
          </label>
          <input
            value={email}
            dir="ltr"
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left font-medium text-slate-500"
          />
          <p className="mt-2 text-xs font-medium text-slate-500">
            تغيير البريد بيحتاج تأكيد على العنوان الجديد — كلّمنا من الدعم لو
            محتاج تغيّره.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={save}
            disabled={saving || !changed}
            className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
          >
            {saving ? 'جاري الحفظ…' : 'حفظ'}
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
      </div>
    </div>
  );
}
