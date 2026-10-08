'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { assignBookingInstructor } from '@/actions/bookings';
import { Select, BusyButton } from '@/components/forms/Form';

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
    if (!selected || saving) return;
    setSaving(true);
    setMessage(null);
    let result: Awaited<ReturnType<typeof assignBookingInstructor>>;
    try {
      result = await assignBookingInstructor({
        subscriptionId,
        instructorId: selected,
      });
    } catch {
      // ⚠️ لو النداء نفسه وقع كان الزرار بيفضل «جاري الحفظ…» للأبد.
      setMessage({ ok: false, text: 'حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.' });
      return;
    } finally {
      setSaving(false);
    }
    if (result.ok) {
      setMessage({ ok: true, text: `اتعيّن على ${result.sessions} جلسة ✓` });
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.error });
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <label htmlFor={`assign-${subscriptionId}`} className="mb-3 block text-sm font-bold text-slate-700">
        المدرب المسؤول
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {/* العرض على الغلاف — `fieldClass` فيه `w-full` وبيغلب. */}
        <div className="min-w-56">
          <Select
            id={`assign-${subscriptionId}`}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">— اختار مدرب —</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.name}
              </option>
            ))}
          </Select>
        </div>
        <BusyButton
          busy={saving}
          pendingLabel="جاري الحفظ…"
          onClick={save}
          disabled={!selected || selected === currentId}
        >
          تعيين
        </BusyButton>
        {message && (
          <p
            role={message.ok ? 'status' : 'alert'}
            className={`text-sm font-bold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}
          >
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
