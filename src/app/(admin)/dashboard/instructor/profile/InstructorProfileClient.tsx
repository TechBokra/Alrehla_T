'use client';

import React, { useState } from 'react';
import { Info, CheckCircle2 } from 'lucide-react';
import { Instructor } from '@/types';
import { submitInstructorProfileUpdate } from '@/actions/instructors';
import { AvatarPicker } from '@/components/dashboard/AvatarPicker';
import { updateMyProfile } from '@/actions/profiles';

interface Props {
  instructor: Instructor;
  email: string;
  avatarUrl?: string;
  hasPendingRequest: boolean;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white';

export function InstructorProfileClient({
  instructor,
  email,
  avatarUrl,
  hasPendingRequest,
}: Props) {
  const [displayName, setDisplayName] = useState(instructor.displayName ?? '');
  const [bio, setBio] = useState(instructor.bio ?? '');
  const [specialties, setSpecialties] = useState((instructor.specialties ?? []).join('، '));
  const [yearsExperience, setYearsExperience] = useState(instructor.yearsExperience ?? 0);

  const [avatar, setAvatar] = useState(avatarUrl ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      // The picture belongs to the account, not to the reviewed profile, so it
      // saves immediately; the rest goes to the admin for review.
      await updateMyProfile({ fullName: displayName.trim(), avatarUrl: avatar });
      await submitInstructorProfileUpdate(instructor.id, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        specialties: specialties
          .split(/[،,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        yearsExperience: Number(yearsExperience) || 0,
      });
      setMessage('تم إرسال التعديلات للإدارة للمراجعة. ستظهر على الموقع بعد الاعتماد.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال التعديلات');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-8 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
        <Info className="h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-bold">مراجعة البيانات</p>
          <p>
            أي تغيير في الاسم أو النبذة أو التخصصات يُرسل للإدارة للمراجعة، ويظهر للطلاب بعد
            الاعتماد.
          </p>
        </div>
      </div>

      {hasPendingRequest && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          لديك طلب تعديل قيد المراجعة. أي إرسال جديد يُضاف كطلب منفصل.
        </div>
      )}

      {message && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> {message}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {/* The picture can now be changed; the two buttons that used to sit here
          had no handler at all. */}
      <AvatarPicker
        value={avatar}
        onChange={setAvatar}
        onError={setError}
        label="الصورة الشخصية"
        folder="alrehla/avatars"
      />

      <hr className="border-slate-100" />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">الاسم المعروض</label>
          <input
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="الاسم كما يظهر للطلاب"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            readOnly
            dir="ltr"
            className={`${inputClass} cursor-not-allowed text-left text-slate-500`}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-bold text-slate-700">نبذة عنك</label>
          <textarea
            rows={5}
            className={`${inputClass} resize-none`}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="اكتب نبذة مختصرة تظهر للطلاب في صفحة المدربين…"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">سنوات الخبرة</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={yearsExperience}
            onChange={(e) => setYearsExperience(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">التخصصات (مفصولة بفاصلة)</label>
          <input
            className={inputClass}
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            placeholder="مثال: الكتابة للأطفال، بناء الشخصيات"
          />
        </div>
      </div>

      <div className="flex justify-end pt-8">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {isSaving ? 'جارٍ الإرسال…' : 'إرسال للمراجعة'}
        </button>
      </div>
    </div>
  );
}
