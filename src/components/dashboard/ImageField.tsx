'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Upload, Trash2 } from 'lucide-react';
import { uploadImage, optimizedImageUrl } from '@/lib/cloudinary';
import { LibraryPicker } from '@/components/dashboard/LibraryPicker';

/**
 * حقل صورة موحّد للوحة الإدارة.
 *
 * الموقع كان فيه **ثلاث طرق مختلفة** لحط صورة:
 *   1. رفع على Cloudinary (صور الموقع، المدونة، الصور الشخصية)
 *   2. رفع على Supabase Storage (إضافة منتج) — مسار تاني بالكامل
 *   3. لصق رابط الصورة بالإيد في خانة نص (تعديل منتج)
 *
 * التلاتة دول بيعملوا نفس الحاجة بثلاث طرق، وواحد منهم بيطلب من
 * الإدارة تروح ترفع الصورة في مكان تاني وتنسخ الرابط. المكوّن ده
 * بيوحّدهم على Cloudinary — نفس المسار اللي بيتحسن ويتضغط تلقائيًا.
 *
 * بيشتغل مع النماذج اللي بتبعت FormData: بيسيب `<input type="hidden">`
 * فيه الرابط، فالحقل بيتبعت مع النموذج من غير أي كود إضافي.
 */
export function ImageField({
  name,
  label,
  folder,
  value,
  onChange,
  hint,
  aspect = 'wide',
  library = false,
}: {
  /** اسم الحقل في النموذج — بيتبعت كـ hidden input. */
  name: string;
  label: string;
  /** مجلد Cloudinary، مثال: alrehla/products */
  folder: string;
  value?: string;
  onChange?: (url: string) => void;
  hint?: string;
  aspect?: 'wide' | 'square' | 'cover';
  /** زرار «من المكتبة» — **للإدارة بس**؛ الناشر والمدرب مايشوفوش صور غيرهم. */
  library?: boolean;
}) {
  const [url, setUrl] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (next: string) => {
    setUrl(next);
    onChange?.(next);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const uploaded = await uploadImage(file, folder);
      set(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر رفع الصورة');
    } finally {
      setBusy(false);
    }
  };

  const box =
    aspect === 'square'
      ? 'h-32 w-32'
      : aspect === 'cover'
        ? 'h-44 w-32'
        : 'h-32 w-52';

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-slate-700">{label}</label>

      {/* الرابط بيتبعت مع النموذج — الحقل ده هو اللي بيوصل للخادم. */}
      <input type="hidden" name={name} value={url} />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div
          className={`relative ${box} shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100`}
        >
          {url ? (
            <Image
              src={optimizedImageUrl(url, 500)}
              alt={label}
              fill
              sizes="208px"
              className="object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
              بدون صورة
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">
            <Upload className="h-4 w-4" />
            {busy ? 'جارٍ الرفع…' : url ? 'تغيير' : 'رفع صورة'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>

          {library && <LibraryPicker onPick={set} disabled={busy} />}

          {url && (
            <button
              type="button"
              onClick={() => set('')}
              className="rounded-xl border border-red-200 bg-white px-3 py-2 text-red-600 transition-colors hover:bg-red-50"
              aria-label="إزالة الصورة"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {hint && <p className="text-xs font-medium text-slate-500">{hint}</p>}
    </div>
  );
}
