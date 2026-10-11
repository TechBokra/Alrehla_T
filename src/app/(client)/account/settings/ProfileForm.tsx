'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { updateMyProfile } from '@/actions/profile';
import { Field, TextInput, BusyButton } from '@/components/forms/Form';

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
  // الخانة اللي الخادم رجّع عليها الخطأ — الرسالة بتظهر تحتها.
  const [errorField, setErrorField] = React.useState<string | undefined>();

  const changed = name.trim() !== fullName.trim();

  async function save() {
    setSaving(true);
    setMessage(null);
    setErrorField(undefined);
    try {
      const result = await updateMyProfile(name);
      if (result.ok) {
        setMessage({ ok: true, text: 'اتحفظ ✓' });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
        setErrorField(result.field);
      }
    } catch {
      setMessage({ ok: false, text: 'تعذّر الحفظ — جرّب تاني' });
    } finally {
      setSaving(false);
    }
  }

  // خطأ الاسم بيظهر تحت الخانة؛ الباقي جنب زرار الحفظ.
  const nameError = message && !message.ok && errorField === 'fullName' ? message.text : undefined;

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-6 font-black text-slate-800">بياناتك</h2>

      <div className="space-y-5">
        <Field label="الاسم" name="fullName" required error={nameError}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </Field>

        <Field
          label="البريد الإلكتروني"
          hint={
            <>
              تغيير البريد بيحتاج تأكيد على العنوان الجديد — كلّمنا من الدعم لو
              محتاج تغيّره.
            </>
          }
        >
          <TextInput
            value={email}
            dir="ltr"
            disabled
            className="cursor-not-allowed text-left font-medium"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-4">
          <BusyButton
            busy={saving}
            pendingLabel="جاري الحفظ…"
            onClick={save}
            disabled={!changed}
          >
            حفظ
          </BusyButton>
          {message && !nameError && (
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
