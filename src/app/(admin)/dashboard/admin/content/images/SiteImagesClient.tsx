'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, Trash2, MapPin, Crop, Check } from 'lucide-react';
import {
  SITE_IMAGE_SLOTS,
  type SiteImages,
  type SiteImageSlot,
} from '@/lib/site-images';
import { uploadImage, slotImageUrl } from '@/lib/cloudinary';
import { saveSiteImage } from '@/actions/content';

/**
 * Every image slot on the site, in one place.
 *
 * Each slot says where it appears and what shape it should be, so an image
 * can be prepared correctly without opening the code.
 *
 * المعاينة بتستخدم نفس التحويل اللي الموقع بيستخدمه — يعني اللي بتشوفه هنا
 * هو بالظبط اللي الزائر هيشوفه، مش نسخة تانية.
 */
export function SiteImagesClient({ images }: { images: SiteImages }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const upload = async (key: string, file: File | undefined) => {
    if (!file) return;
    setBusyKey(key);
    setError('');
    try {
      const uploaded = await uploadImage(file, 'alrehla/site');
      await saveSiteImage({ key, url: uploaded.url });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر رفع الصورة');
    } finally {
      setBusyKey(null);
    }
  };

  const remove = async (key: string) => {
    setBusyKey(key);
    setError('');
    try {
      await saveSiteImage({ key, url: '' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حذف الصورة');
    } finally {
      setBusyKey(null);
    }
  };

  const brand = SITE_IMAGE_SLOTS.filter((s) => s.group === 'brand');
  const pages = SITE_IMAGE_SLOTS.filter((s) => s.group === 'pages');
  const filled = SITE_IMAGE_SLOTS.filter((s) => images[s.key]).length;

  const row = (slot: SiteImageSlot) => (
    <SlotRow
      key={slot.key}
      slot={slot}
      url={images[slot.key]}
      busy={busyKey === slot.key}
      onUpload={(f) => upload(slot.key, f)}
      onRemove={() => remove(slot.key)}
    />
  );

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-bold">
          {filled} من {SITE_IMAGE_SLOTS.length} صورة مرفوعة
        </p>
        <p className="flex items-start gap-1.5 font-medium">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          ارفع الصورة بأي مقاس — النظام بيظبطها على مقاس المكان{' '}
          <strong>من غير ما يقص منها حاجة</strong>. لو نسبة الصورة مختلفة عن
          نسبة المكان، الفراغ بيتملّي بلون مسحوب من الصورة نفسها.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-black text-slate-800">هوية الموقع</h2>
        {brand.map(row)}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-black text-slate-800">صور الصفحات</h2>
        {pages.map(row)}
      </section>
    </div>
  );
}

function SlotRow({
  slot,
  url,
  busy,
  onUpload,
  onRemove,
}: {
  slot: SiteImageSlot;
  url?: string;
  busy: boolean;
  onUpload: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  // خانات الهوية شفافيتها مهمة، فالمعاينة بخلفية شطرنجية عشان تبان.
  const isBrand = slot.group === 'brand';

  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div
        className={`relative h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-slate-200 ${
          isBrand ? 'bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%)] bg-white [background-position:0_0,8px_8px] [background-size:16px_16px]' : 'bg-slate-100'
        }`}
      >
        {url ? (
          <Image
            src={slotImageUrl(url, slot.key)}
            alt={slot.label}
            fill
            sizes="144px"
            className={isBrand ? 'object-contain p-2' : 'object-cover'}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
            فارغ
          </div>
        )}
      </div>

      <div className="min-w-[200px] flex-1">
        <h3 className="font-black text-slate-800">{slot.label}</h3>
        <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-slate-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {slot.location}
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-xs font-bold text-slate-400">
          <Crop className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {slot.ratio}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">
          <Upload className="h-4 w-4" />
          {busy ? 'جارٍ…' : url ? 'تغيير' : 'رفع صورة'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
        </label>
        {url && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            aria-label="حذف الصورة"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
