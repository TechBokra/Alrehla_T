'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { AvatarPicker } from '@/components/dashboard/AvatarPicker';
import { updateMyProfile } from '@/actions/profiles';
import { requestNameChange } from '@/actions/dependent-requests';
import { useAction } from '@/lib/use-action';
import { FormError, FormSuccess } from '@/components/ui/FormError';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white';

export function StudentProfileClient({
  fullName: initialName,
  email,
  avatarUrl: initialAvatar,
  isDependent = false,
}: {
  fullName: string;
  email: string;
  avatarUrl: string;
  isDependent?: boolean;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [nameSent, setNameSent] = useState('');

  const nameRequest = useAction(requestNameChange, {
    onSuccess: (result) => {
      if (result.ok) {
        setNameSent('اتبعت طلب تغيير الاسم لولي أمرك. هتشوف رده في «طلباتي».');
        setFullName(initialName);
      }
    },
    fallbackError: 'تعذّر إرسال طلب تغيير الاسم.',
  });

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      // للمستخدم الفردي: الاسم بيتحفظ مباشرة دون حاجة لموافقة.
      // للطفل التابع: الاسم بيضبطه ولي أمره، والصورة بتتحفظ على طول.
      const targetName = isDependent ? initialName : fullName.trim();
      await updateMyProfile({ fullName: targetName, avatarUrl });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ البيانات');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> تم الحفظ بنجاح.
        </div>
      )}

      <AvatarPicker
        value={avatarUrl}
        onChange={setAvatarUrl}
        onError={setError}
        label="الصورة الشخصية"
        folder="alrehla/avatars"
      />

      <hr className="my-8 border-slate-100" />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">الاسم</label>
          <input
            className={inputClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          {isDependent ? (
            <>
              <p className="text-xs font-medium text-slate-500">
                اسمك بيظبطه ولي أمرك — لأنه اللي بيتطبع على كتابك ويشوفه مدربك.
                اكتب الاسم اللي عايزه واطلب منه يوافق.
              </p>
              <FormError message={nameRequest.error} />
              <FormSuccess message={nameSent} />
              <button
                type="button"
                disabled={nameRequest.pending || fullName.trim() === initialName.trim()}
                aria-busy={nameRequest.pending || undefined}
                onClick={() => {
                  setNameSent('');
                  nameRequest.run(fullName);
                }}
                className="inline-flex min-h-[44px] items-center rounded-xl bg-amber-500 px-5 font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {nameRequest.pending ? 'جارٍ الإرسال…' : 'اطلب تغيير الاسم'}
              </button>
            </>
          ) : (
            <p className="text-xs font-medium text-slate-500">
              اسمك الكامل الظاهر في حسابك والجلسات والتقارير. يمكنك تعديله وحفظه مباشرة.
            </p>
          )}
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
          <p className="text-xs font-medium text-slate-500">
            لتغيير البريد، تواصل مع الإدارة.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-8">
        <button
          type="button"
          onClick={save}
          disabled={busy || (!isDependent && fullName.trim().length < 2)}
          className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
        </button>
      </div>
    </div>
  );
}
