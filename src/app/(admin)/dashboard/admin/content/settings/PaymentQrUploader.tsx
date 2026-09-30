'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, Trash2, QrCode } from 'lucide-react';
import { uploadImage, optimizedImageUrl } from '@/lib/cloudinary';
import { saveSiteImage } from '@/actions/content';

/**
 * The InstaPay QR the customer scans instead of typing the wallet number.
 *
 * Stored as an image URL in site settings, so it changes from here — not from
 * the code — the same way the wallet number does.
 */
export function PaymentQrUploader({ value }: { value: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = async (url: string, file?: File) => {
    setBusy(true);
    setError('');
    try {
      const finalUrl = file ? (await uploadImage(file, 'alrehla/site')).url : url;
      await saveSiteImage({ key: 'paymentQrUrl', url: finalUrl });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ الصورة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="md:col-span-2">
      <label className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-700">
        <QrCode className="h-4 w-4" /> كود QR للدفع عبر إنستاباي
      </label>

      {error && (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {value ? (
            <Image src={optimizedImageUrl(value, 400)} alt="كود الدفع" fill sizes="200px" className="object-contain p-2" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
              لم يُرفع بعد
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">
              <Upload className="h-4 w-4" />
              {busy ? 'جارٍ…' : value ? 'تغيير الكود' : 'رفع الكود'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void set('', file);
                }}
              />
            </label>
            {value && (
              <button
                type="button"
                disabled={busy}
                onClick={() => set('')}
                className="rounded-xl border border-red-200 bg-white px-3 py-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                aria-label="حذف الكود"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="max-w-sm text-sm font-medium text-slate-500">
            الكود يظهر للعميل في كل شاشات الدفع بجوار رقم المحفظة. خذه من تطبيق
            إنستاباي كصورة، وتأكد أنه يفتح على حسابك قبل رفعه.
          </p>
        </div>
      </div>
    </div>
  );
}
