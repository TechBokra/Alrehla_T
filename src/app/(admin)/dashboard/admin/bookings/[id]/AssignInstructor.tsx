'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { assignBookingInstructor } from '@/actions/bookings';

/**
 * تعيين مدرب للحجز.
 *
 * لو العميل ما اختارش مدرب، الجلسات بتتعمل بلا مدرب ومحدش بيشوف الحجز
 * في لوحة المدربين. الشاشة كانت بتعرض «لم يُحدَّد» من غير أي طريقة
 * تصلّحه.
 */
export function AssignInstructor({
  subscriptionId,
  instructors,
  currentId,
}: {
  subscriptionId: string;
  instructors: { id: string; name: string }[];
  currentId?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState(currentId ?? '');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    const result = await assignBookingInstructor({
      subscriptionId,
      instructorId: selected,
    });
    setSaving(false);
    if (result.ok) {
      setMessage({ ok: true, text: `اتعيّن على ${result.sessions} جلسة ✓` });
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.error });
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="mb-3 text-sm font-bold text-slate-700">المدرب المسؤول</p>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-w-56 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800"
        >
          <option value="">— اختار مدرب —</option>
          {instructors.map((instructor) => (
            <option key={instructor.id} value={instructor.id}>
              {instructor.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={saving || !selected || selected === currentId}
          className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
        >
          {saving ? 'جاري الحفظ…' : 'تعيين'}
        </button>
        {message && (
          <p className={`text-sm font-bold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">
        بيتعيّن على الاشتراك وعلى كل جلساته اللي لسه ما تمّتش، وبيوصل
        إشعار للمدرب.
      </p>
    </div>
  );
}
