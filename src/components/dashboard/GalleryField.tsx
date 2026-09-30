'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Upload, Trash2 } from 'lucide-react';
import { uploadImage, optimizedImageUrl } from '@/lib/cloudinary';

const MAX = 8;

/**
 * معرض صور المنتج — رفع متعدّد بترتيب وحذف.
 *
 * ── ليه مكوّن لوحده ─────────────────────────────────────────
 *
 * `ImageField` الموجود بيتعامل مع **صورة واحدة**، والمعرض محتاج
 * قايمة بترتيب. ولفّ `ImageField` تمن مرات كان هيدّي تمن خانات
 * فاضية على الشاشة حتى لو المنتج مالوش غير صورة واحدة.
 *
 * ── والقيم بتوصل للخادم في خانة مخفية واحدة ─────────────────
 *
 * سطر لكل رابط — **نفس شكل خانة التفاصيل**، فالخادم بيقراهم بنفس
 * الطريقة ومفيش شكل تاني يتعلّم.
 *
 * ⚠️ **والخادم بيعيد التحقّق من كل رابط** (لازم يكون من Cloudinary
 *    بتاعنا). الخانة المخفية دي نصّ في النموذج، وأي حد يقدر يبعت
 *    اللي هو عايزه — الواجهة مش دليل (قاعدة «ع»).
 */
export function GalleryField({
  name,
  folder,
  value = [],
}: {
  name: string;
  folder: string;
  value?: string[];
}) {
  const [urls, setUrls] = useState<string[]>(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      // ⚠️ **واحدة ورا التانية لا كلهم مع بعض**: الرفع المتوازي
      //    لتمن صور بيخنق الشبكة على الموبايل وبيخلّي بعضها يفشل
      //    بلا سبب واضح.
      const added: string[] = [];
      for (const file of Array.from(files).slice(0, MAX - urls.length)) {
        const uploaded = await uploadImage(file, folder);
        added.push(uploaded.url);
      }
      setUrls((prev) => [...new Set([...prev, ...added])].slice(0, MAX));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر رفع الصور');
    } finally {
      setBusy(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= urls.length) return;
    setUrls((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold text-slate-700">
        صور إضافية للمنتج{' '}
        <span className="font-medium text-slate-500">
          (صفحات من جوّه الكتاب، الغلاف الخلفي… حد أقصى {MAX})
        </span>
      </label>

      {/* القيم بتتبعت مع النموذج — سطر لكل رابط، زيّ خانة التفاصيل. */}
      <input type="hidden" name={name} value={urls.join('\n')} />

      {error && (
        <p className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm font-bold">
          {error}
        </p>
      )}

      {urls.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {urls.map((url, i) => (
            <li
              key={url}
              className="relative w-24 overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className="relative aspect-square w-full bg-slate-50">
                <Image
                  src={optimizedImageUrl(url, 200)}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-contain p-1"
                  referrerPolicy="no-referrer"
                />
              </div>
              {/* ⚠️ الترتيب بأزرار لا بالسحب: السحب مابيشتغلش باللمس
                  من غير شغل كتير، ومابيوصلش للي بيتنقّل بالكيبورد. */}
              <div className="flex items-center justify-between border-t border-slate-100 px-1 py-1">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label="حرّك لليمين"
                  className="px-1.5 text-slate-600 disabled:opacity-30"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => setUrls((p) => p.filter((u) => u !== url))}
                  aria-label="امسح الصورة"
                  className="text-danger px-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === urls.length - 1}
                  aria-label="حرّك لليسار"
                  className="px-1.5 text-slate-600 disabled:opacity-30"
                >
                  ‹
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {urls.length < MAX && (
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">
          <Upload className="h-4 w-4" />
          {busy ? 'جارٍ الرفع…' : 'أضف صورًا'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => pick(e.target.files)}
          />
        </label>
      )}
    </div>
  );
}
