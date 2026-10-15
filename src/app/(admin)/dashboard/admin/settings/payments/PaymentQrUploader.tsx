'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, Trash2, QrCode } from 'lucide-react';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { uploadImage } from '@/lib/upload-client';
import { saveTransferDetails } from '@/actions/payments';
import { LibraryPicker } from '@/components/dashboard/LibraryPicker';

/**
 * كود QR بتاع إنستاباي اللي العميل بيمسحه بدل ما يكتب رقم المحفظة.
 *
 * ⚠️ بيتحفظ مع رقم المحفظة في نفس النداء، عشان ما يحصلش إن الكود
 *    يتغيّر والرقم لأ (أو العكس) والعميل يحوّل لحساب غلط.
 */
export function PaymentQrUploader({
  value,
  walletNumber,
  onSaved,
}: {
  value: string;
  walletNumber: string;
  onSaved: (url: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = async (url: string, file?: File) => {
    setBusy(true);
    setError('');
    try {
      const finalUrl = file
        ? (await uploadImage(file, 'alrehla/site')).url
        : url;
      const result = await saveTransferDetails({ walletNumber, qrUrl: finalUrl || null });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(finalUrl);
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
            <Image
              src={optimizedImageUrl(value, 400)}
              alt="كود الدفع"
              fill
              sizes="200px"
              className="object-contain p-2"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
              لم يُرفع بعد
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
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
            <LibraryPicker onPick={(url) => void set(url)} disabled={busy} />
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
