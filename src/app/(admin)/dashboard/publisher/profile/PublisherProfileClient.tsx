'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { AvatarPicker } from '@/components/dashboard/AvatarPicker';
import { updateMyPublisherProfile } from '@/actions/profiles';
import type { Publisher } from '@/types';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white';

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
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await updateMyPublisherProfile({
        publisherId: publisher.id,
        name,
        bio,
        logoUrl,
      });
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
          <CheckCircle2 className="h-5 w-5" /> تم الحفظ، والتغييرات ظاهرة على الموقع.
        </div>
      )}

      <AvatarPicker
        value={logoUrl}
        onChange={setLogoUrl}
        onError={setError}
        label="شعار دار النشر"
        folder="alrehla/publishers"
        rounded="xl"
      />

      <hr className="my-8 border-slate-100" />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">اسم دار النشر</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
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
          <label className="text-sm font-bold text-slate-700">نبذة عن دار النشر</label>
          <textarea
            rows={5}
            className={`${inputClass} resize-none`}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="تظهر للعملاء في صفحة دار النشر…"
          />
        </div>
      </div>

      <div className="flex justify-end pt-8">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
        </button>
      </div>
    </div>
  );
}
