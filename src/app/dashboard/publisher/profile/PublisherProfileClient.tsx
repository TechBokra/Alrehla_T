'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { AvatarPicker } from '@/components/dashboard/AvatarPicker';
import { updateMyPublisherProfile } from '@/actions/profiles';
import type { Publisher } from '@/types';
import { Field, TextInput, TextArea, BusyButton } from '@/components/forms/Form';

export function PublisherProfileClient({
  publisher,
  email,
}: {
  publisher: Publisher;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(publisher.name);
  const [bio, setBio] = useState(publisher.bio ?? '');
  const [logoUrl, setLogoUrl] = useState(publisher.logoUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // الخانة اللي الخادم رجّع عليها الخطأ — رسالتها بتظهر تحتها.
  const [errorField, setErrorField] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError('');
    setErrorField(undefined);
    setSaved(false);
    try {
      // ⚠️ الأكشن بقى بيرجّع الخطأ بدل ما يرميه (قاعدة «هـ»).
      const result = await updateMyPublisherProfile({
        publisherId: publisher.id,
        name,
        bio,
        logoUrl,
      });
      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('تعذّر حفظ البيانات');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      {error && !errorField && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> تم الحفظ، والتغييرات ظاهرة على الموقع.
        </div>
      )}

      <AvatarPicker
        value={logoUrl}
        onChange={setLogoUrl}
        onError={(message) => {
          setError(message);
          setErrorField(undefined);
        }}
        label="شعار دار النشر"
        folder="alrehla/publishers"
        rounded="xl"
      />

      <hr className="my-8 border-slate-100" />

      <div className="grid gap-6 md:grid-cols-2">
        <Field
          label="اسم دار النشر"
          name="name"
          required
          error={errorField === 'name' ? error : undefined}
        >
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
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
        <Field label="نبذة عن دار النشر" name="bio" className="md:col-span-2">
          <TextArea
            rows={5}
            className="resize-none"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="تظهر للعملاء في صفحة دار النشر…"
          />
        </Field>
      </div>

      <div className="flex justify-end pt-8">
        <BusyButton busy={busy} onClick={save} className="px-8">
          حفظ التغييرات
        </BusyButton>
      </div>
    </div>
  );
}
