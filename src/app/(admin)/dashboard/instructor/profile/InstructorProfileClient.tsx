'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, CheckCircle2, Sparkles } from 'lucide-react';
import { Instructor } from '@/types';
import { submitInstructorProfileUpdate } from '@/actions/instructors';
import { AvatarPicker } from '@/components/dashboard/AvatarPicker';
import { updateMyProfile } from '@/actions/profiles';
import {
  firstProfileProblem,
  BIO_MIN,
  type OnboardingState,
} from '@/lib/instructor-onboarding';
import { Field, TextInput, TextArea, BusyButton } from '@/components/forms/Form';

interface Props {
  instructor: Instructor;
  email: string;
  avatarUrl?: string;
  hasPendingRequest: boolean;
  /** المدرب الجديد بيكمّل ملفه الأول — كل الخانات إلزامية. */
  onboarding?: OnboardingState;
}

export function InstructorProfileClient({
  instructor,
  email,
  avatarUrl,
  hasPendingRequest,
  onboarding = 'complete',
}: Props) {
  const router = useRouter();
  const firstProfile = onboarding === 'needs_profile';
  const [displayName, setDisplayName] = useState(instructor.displayName ?? '');
  const [bio, setBio] = useState(instructor.bio ?? '');
  const [specialties, setSpecialties] = useState((instructor.specialties ?? []).join('، '));
  const [yearsExperience, setYearsExperience] = useState(instructor.yearsExperience ?? 0);

  const [avatar, setAvatar] = useState(avatarUrl ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // الخانة اللي عليها الخطأ (من الفحص هنا أو من الخادم) — رسالتها تحتها.
  const [errorField, setErrorField] = useState<string | undefined>();
  const err = (f: string) => (errorField === f ? error : undefined);
  const showError = (message: string, field?: string) => {
    setError(message);
    setErrorField(field);
  };

  const parsedSpecialties = () =>
    specialties
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async () => {
    setMessage('');
    setError('');
    setErrorField(undefined);
    // الملف الأول: الرسالة قبل الإرسال، والخادم بيعيد نفس الفحص.
    if (firstProfile) {
      const problem = firstProfileProblem({
        displayName,
        bio,
        specialties: parsedSpecialties(),
        yearsExperience: Number(yearsExperience),
        avatarUrl: avatar,
      });
      if (problem) {
        // الصورة مالهاش `Field` — رسالتها فوق زي ما كانت.
        showError(problem.error, problem.field === 'avatarUrl' ? undefined : problem.field);
        return;
      }
    }
    setIsSaving(true);
    try {
      // ⚠️ **الصورة (ملف 15):** في الملف الأول بتتحفظ على طول (المدرب
      //    مش ظاهر للأهالي لسه، والإدارة بتشوفها وهي بتراجع ملفه). بعد
      //    التفعيل بتروح مع باقي التعديلات للمراجعة، والقديمة تفضل ظاهرة.
      //
      // ⚠️ الأكشنين بقوا بيرجّعوا الخطأ بدل ما يرموه (قاعدة «هـ») —
      //    ولو الأول فشل، التاني مايتبعتش (زي ما كان الرمي بيوقفه).
      const profileResult = await updateMyProfile(
        firstProfile
          ? { fullName: displayName.trim(), avatarUrl: avatar }
          : { fullName: displayName.trim() },
      );
      if (!profileResult.ok) {
        // الاسم هنا هو «الاسم المعروض».
        showError(
          profileResult.error,
          profileResult.field === 'fullName' ? 'displayName' : undefined,
        );
        return;
      }
      const result = await submitInstructorProfileUpdate(instructor.id, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        specialties: parsedSpecialties(),
        yearsExperience: Number(yearsExperience) || 0,
        ...(!firstProfile && avatar && avatar !== (avatarUrl ?? '') ? { avatarUrl: avatar } : {}),
      });
      if (!result.ok) {
        showError(result.error, result.field === 'avatarUrl' ? undefined : result.field);
        return;
      }
      setMessage(
        firstProfile
          ? 'ملفك وصل للإدارة. أول ما يتعتمد وتخلّص التدريب، حسابك هيتفعّل.'
          : 'تم إرسال التعديلات للإدارة للمراجعة. ستظهر على الموقع بعد الاعتماد.'
      );
      router.refresh();
    } catch {
      // للانقطاع وأي حاجة غير متوقعة — الأكشنين بيرجّعوا رسايلهم.
      setError('تعذّر إرسال التعديلات');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      {firstProfile && (
        <div className="mb-8 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <Sparkles className="h-6 w-6 shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="text-base font-black">أهلًا بيك في الرحلة!</p>
            <p className="font-medium">
              طلبك اتقبل. فاضل تكمّل ملفك — <strong>كل الخانات اللي عليها *
              مطلوبة</strong> — وتبعته للإدارة. بعد ما يتعتمد وتخلّص التدريب،
              حسابك بيتفعّل ويبدأ يظهر للأهالي.
            </p>
            <p className="font-medium">
              وتحت كمان تقدر ترفع غلاف لصفحتك وصور إصداراتك وأعمالك (اختياري).
            </p>
          </div>
        </div>
      )}
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

      {error && !errorField && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {/* The picture can now be changed; the two buttons that used to sit here
          had no handler at all. */}
      <AvatarPicker
        value={avatar}
        onChange={setAvatar}
        onError={(message) => showError(message)}
        label={firstProfile ? 'الصورة الشخصية *' : 'الصورة الشخصية'}
        folder="alrehla/avatars"
      />
      {!firstProfile && avatar !== (avatarUrl ?? '') && (
        <p className="-mt-2 text-sm font-medium text-amber-800">
          الصورة الجديدة هتظهر للأهالي بعد ما الإدارة تعتمدها — لحد كده صورتك الحالية هي اللي ظاهرة.
        </p>
      )}

      <hr className="border-slate-100" />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Field
          label="الاسم المعروض"
          name="displayName"
          required={firstProfile}
          error={err('displayName')}
        >
          <TextInput
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="الاسم كما يظهر للطلاب"
          />
        </Field>
        <Field label="البريد الإلكتروني">
          <TextInput
            type="email"
            value={email}
            readOnly
            dir="ltr"
            className="cursor-not-allowed bg-slate-50 text-left text-slate-500"
          />
        </Field>
        <Field
          label={
            <>
              نبذة عنك
              {firstProfile && (
                <span className="font-medium text-slate-500"> — {BIO_MIN} حرف على الأقل</span>
              )}
            </>
          }
          name="bio"
          required={firstProfile}
          error={err('bio')}
          className="md:col-span-2"
        >
          <TextArea
            rows={5}
            className="resize-none"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="اكتب نبذة مختصرة تظهر للطلاب في صفحة المدربين…"
          />
        </Field>
        <Field
          label="سنوات الخبرة"
          name="yearsExperience"
          required={firstProfile}
          error={err('yearsExperience')}
        >
          <TextInput
            type="number"
            min={0}
            value={yearsExperience}
            onChange={(e) => setYearsExperience(Number(e.target.value))}
          />
        </Field>
        <Field
          label="التخصصات (مفصولة بفاصلة)" help="بتظهر كعلامات صغيرة في صفحتك — مثلًا: قصة قصيرة، شعر، كتابة إبداعية."
          name="specialties"
          required={firstProfile}
          error={err('specialties')}
        >
          <TextInput
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            placeholder="مثال: الكتابة للأطفال، بناء الشخصيات"
          />
        </Field>
      </div>

      <div className="flex justify-end pt-8">
        <BusyButton busy={isSaving} pendingLabel="جارٍ الإرسال…" onClick={handleSubmit} className="px-8">
          {firstProfile ? 'ابعت ملفي للإدارة' : 'إرسال للمراجعة'}
        </BusyButton>
      </div>
    </div>
  );
}
