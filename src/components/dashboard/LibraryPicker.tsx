'use client';

import React, { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Images, Loader2, Search, X } from 'lucide-react';
import { listLibraryImages, type LibraryImage } from '@/actions/media';
import { optimizedImageUrl } from '@/lib/cloudinary';

/** أسماء المجلّدات زي ما الإدارة تعرفها — والمجهول بيظهر باسمه. */
const FOLDER_LABELS: Record<string, string> = {
  site: 'صور الموقع',
  products: 'أغلفة المنتجات',
  'products/gallery': 'معارض المنتجات',
  blog: 'المدونة',
  'box-plans': 'خطط الصندوق',
};

function folderOf(publicId: string): string {
  // alrehla/products/gallery/abc → products/gallery
  return publicId.split('/').slice(1, -1).join('/') || 'أخرى';
}

/**
 * زرار «من المكتبة»: يختار صورة **اترفعت قبل كده** بدل رفعها تاني.
 *
 * ── ليه ─────────────────────────────────────────────────────
 *
 * القاعدة اتبنت من جديد (2 أكتوبر 2026) والصور كلها لسه على
 * Cloudinary، بس الروابط اللي كانت بتقول «الصورة دي مكانها هنا» راحت.
 * من غير الزرار ده، الطريقة الوحيدة كانت تنزيل الصورة ورفعها تاني —
 * ونسخة مكرّرة على المساحة.
 *
 * ⚠️ **للإدارة بس**: الأكشن بيرفض أي حد مالوش صلاحية المحتوى، والزرار
 *    مابيتعرضش أصلًا في نماذج الناشر والمدرب (`library` في الخانات).
 *
 * المكتبة بتتقري **مرة واحدة لما الزرار يتفتح أول مرة**، مش مع فتح
 * الصفحة — أغلب مرات فتح النموذج مابتحتاجهاش.
 */
export function LibraryPicker({
  onPick,
  disabled,
  label = 'من المكتبة',
}: {
  onPick: (url: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [images, setImages] = useState<LibraryImage[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [folder, setFolder] = useState<string>('');
  const [query, setQuery] = useState('');

  const open = async () => {
    dialogRef.current?.showModal();
    if (images || loading) return;
    setLoading(true);
    setError('');
    const result = await listLibraryImages();
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setImages(result.images);
    setTruncated(result.truncated);
  };

  const close = () => dialogRef.current?.close();

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const img of images ?? []) {
      const f = folderOf(img.publicId);
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [images]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (images ?? []).filter(
      (img) =>
        (!folder || folderOf(img.publicId) === folder) &&
        (!q || img.publicId.toLowerCase().includes(q))
    );
  }, [images, folder, query]);

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
      active
        ? 'bg-slate-900 text-white'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`;

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        <Images className="h-4 w-4" />
        {label}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-3xl p-0 backdrop:bg-slate-900/60"
        onClick={(e) => {
          // الضغط على الخلفية (برّه المحتوى) بيقفل.
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h2 className="font-black text-slate-800">
                اختار صورة من المكتبة
              </h2>
              <p className="text-xs font-medium text-slate-500">
                صور اترفعت على الموقع قبل كده — الاختيار مابيرفعش نسخة جديدة.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="إغلاق"
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {images && images.length > 0 && (
            <div className="space-y-3 border-b border-slate-100 p-5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFolder('')}
                  className={chip(!folder)}
                >
                  الكل ({images.length})
                </button>
                {folders.map(([f, count]) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFolder(f)}
                    className={chip(folder === f)}
                  >
                    {FOLDER_LABELS[f] ?? f} ({count})
                  </button>
                ))}
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="دوّر باسم الملف"
                  className="w-full rounded-xl border border-slate-200 py-2 pr-9 pl-3 text-sm focus:border-amber-500 focus:outline-none"
                />
              </label>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5">
            {loading && (
              <p className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل المكتبة…
              </p>
            )}
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                {error}
              </p>
            )}
            {images && images.length === 0 && (
              <p className="py-12 text-center text-sm font-medium text-slate-500">
                المكتبة فاضية — مفيش صور اترفعت لسه.
              </p>
            )}
            {images && images.length > 0 && shown.length === 0 && (
              <p className="py-12 text-center text-sm font-medium text-slate-500">
                مفيش صور بالاسم ده في القسم ده.
              </p>
            )}
            {shown.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {shown.map((img) => (
                  <li key={img.publicId}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(img.url);
                        close();
                      }}
                      className="group block w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-white text-right transition-colors hover:border-amber-500 focus:border-amber-500 focus:outline-none"
                    >
                      <span className="relative block aspect-square bg-slate-50">
                        <Image
                          src={optimizedImageUrl(img.url, 300)}
                          alt=""
                          fill
                          sizes="180px"
                          className="object-contain p-1"
                          referrerPolicy="no-referrer"
                          unoptimized
                        />
                      </span>
                      <span
                        dir="ltr"
                        className="block truncate px-2 py-1.5 text-right font-mono text-[10px] text-slate-500"
                        title={img.publicId}
                      >
                        {img.publicId.split('/').pop()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {truncated && (
              <p className="mt-4 text-center text-xs font-medium text-slate-500">
                المكتبة فيها أكتر من {images?.length} صورة، والظاهر هنا أول{' '}
                {images?.length} بس.
              </p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
