'use client';

import { useState, useTransition } from 'react';
import { setChildAgeOverride } from '@/actions/child-age-override';
import { Select } from '@/components/forms/Form';

/** استثناء السن (بند ١٠) — من ملف الطفل في لوحة الإدارة. */
export function ChildAgeOverrideSelect({
  childId,
  initial,
}: {
  childId: string;
  initial: 'under_12' | '12_plus' | null;
}) {
  const [value, setValue] = useState(initial ?? '');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <label className="block text-slate-400" htmlFor={`age-ov-${childId}`}>
        استثناء السن في الحجز:
      </label>
      <Select
        id={`age-ov-${childId}`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as '' | 'under_12' | '12_plus';
          const prev = value;
          setValue(next);
          start(async () => {
            const r = await setChildAgeOverride(childId, next);
            if (r.ok) setMsg('اتحفظ ✓');
            else {
              setValue(prev);
              setMsg(r.error);
            }
          });
        }}
        className="!py-1.5 text-xs"
      >
        <option value="">من غير استثناء (حسب تاريخ الميلاد)</option>
        <option value="under_12">يتعامل كأقل من ١٢</option>
        <option value="12_plus">يتعامل كـ١٢ فأكثر</option>
      </Select>
      {msg && (
        <p role="status" className="text-[12px] font-bold text-slate-600">
          {msg}
        </p>
      )}
    </div>
  );
}
