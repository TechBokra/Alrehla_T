'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { AvatarPicker } from '@/components/dashboard/AvatarPicker';
import { updateMyProfile } from '@/actions/profiles';
import { requestNameChange } from '@/actions/dependent-requests';
import { useAction } from '@/lib/use-action';
import { FormError, FormSuccess } from '@/components/ui/FormError';
import { Field, TextInput, BusyButton } from '@/components/forms/Form';

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
  // الخانة اللي الخادم رجّع عليها الخطأ — الرسالة بتظهر تحتها.
  const [errorField, setErrorField] = useState<string | undefined>();
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
    setErrorField(undefined);
    setSaved(false);
    try {
      // للمستخدم الفردي: الاسم بيتحفظ مباشرة دون حاجة لموافقة.
      // للطفل التابع: الاسم بيضبطه ولي أمره، والصورة بتتحفظ على طول.
      const targetName = isDependent ? initialName : fullName.trim();
      // ⚠️ الأكشن بقى بيرجّع الخطأ بدل ما يرميه (قاعدة «هـ») — لازم يتقري.
      const result = await updateMyProfile({ fullName: targetName, avatarUrl });
      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field);
        return;
      }
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
      {/* الخطأ اللي على خانة بعينها بيظهر تحتها؛ الباقي هنا. */}
      <FormError message={errorField ? '' : error} className="mb-6" />
      {saved && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> تم الحفظ بنجاح.
        </div>
      )}

      <AvatarPicker
        value={avatarUrl}
        onChange={setAvatarUrl}
        onError={(message) => {
          setError(message);
          setErrorField(undefined);
        }}
        label="الصورة الشخصية"
        folder="alrehla/avatars"
      />

      <hr className="my-8 border-slate-100" />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Field
            label="الاسم"
            name="fullName"
            required={!isDependent}
            error={
              errorField === 'fullName'
                ? error
                : nameRequest.errorField === 'name'
                  ? nameRequest.error
                  : undefined
            }
            hint={
              isDependent ? (
                <>
                  اسمك بيظبطه ولي أمرك — لأنه اللي بيتطبع على كتابك ويشوفه مدربك.
                  اكتب الاسم اللي عايزه واطلب منه يوافق.
                </>
              ) : (
                'اسمك الكامل الظاهر في حسابك والجلسات والتقارير. يمكنك تعديله وحفظه مباشرة.'
              )
            }
          >
            <TextInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          {isDependent && (
            <>
              <FormError message={nameRequest.errorField ? '' : nameRequest.error} />
              <FormSuccess message={nameSent} />
              <BusyButton
                busy={nameRequest.pending}
                pendingLabel="جارٍ الإرسال…"
                disabled={fullName.trim() === initialName.trim()}
                onClick={() => {
                  setNameSent('');
                  nameRequest.run(fullName);
                }}
              >
                اطلب تغيير الاسم
              </BusyButton>
            </>
          )}
        </div>
        <Field label="البريد الإلكتروني" hint="لتغيير البريد، تواصل مع الإدارة.">
          <TextInput
            type="email"
            value={email}
            readOnly
            dir="ltr"
            className="cursor-not-allowed text-left text-slate-500"
          />
        </Field>
      </div>

      <div className="flex justify-end pt-8">
        <BusyButton
          busy={busy}
          onClick={save}
          disabled={!isDependent && fullName.trim().length < 2}
        >
          حفظ التغييرات
        </BusyButton>
      </div>
    </div>
  );
}
