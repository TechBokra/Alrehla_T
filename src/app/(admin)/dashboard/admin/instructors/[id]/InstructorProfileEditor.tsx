'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X } from 'lucide-react';
import { Instructor } from '@/types';
import { updateInstructorProfileByAdmin } from '@/actions/instructors';

interface Props {
  instructor: Instructor;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white';

/**
 * Direct editing of an instructor's public profile by an admin.
 *
 * These fields feed the instructor card on the public site. Until now there
 * was no screen anywhere — admin or instructor — that could write them.
 */
export function InstructorProfileEditor({ instructor }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [displayName, setDisplayName] = useState(instructor.displayName ?? '');
  const [bio, setBio] = useState(instructor.bio ?? '');
  const [specialties, setSpecialties] = useState((instructor.specialties ?? []).join('، '));
  const [yearsExperience, setYearsExperience] = useState(instructor.yearsExperience ?? 0);

  const cancel = () => {
    setDisplayName(instructor.displayName ?? '');
    setBio(instructor.bio ?? '');
    setSpecialties((instructor.specialties ?? []).join('، '));
    setYearsExperience(instructor.yearsExperience ?? 0);
    setError('');
    setEditing(false);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await updateInstructorProfileByAdmin(instructor.id, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        specialties: specialties
          .split(/[،,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        yearsExperience: Number(yearsExperience) || 0,
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-800">الملف المعروض للطلاب</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">
            النبذة والتخصصات التي تظهر في كارت المدرب على الموقع.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" /> تعديل
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {editing ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">الاسم المعروض</label>
              <input
                className={inputClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">سنوات الخبرة</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">النبذة</label>
              <textarea
                rows={4}
                className={`${inputClass} resize-none`}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">
                التخصصات (مفصولة بفاصلة)
              </label>
              <input
                className={inputClass}
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="مثال: الكتابة للأطفال، بناء الشخصيات"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" /> إلغاء
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> {busy ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-1 font-bold text-slate-700">النبذة</p>
            <p className="leading-relaxed font-medium text-slate-600">
              {instructor.bio || <span className="text-slate-400">— لم تُكتب بعد —</span>}
            </p>
          </div>
          <div>
            <p className="mb-2 font-bold text-slate-700">التخصصات</p>
            {instructor.specialties?.length ? (
              <div className="flex flex-wrap gap-2">
                {instructor.specialties.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400">— لم تُضف بعد —</span>
            )}
          </div>
          <div>
            <p className="mb-1 font-bold text-slate-700">سنوات الخبرة</p>
            <p className="font-medium text-slate-600">{instructor.yearsExperience ?? 0}</p>
          </div>
        </div>
      )}
    </div>
  );
}
