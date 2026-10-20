'use client';

import React, { useState } from 'react';
import { Check, Copy, Upload } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { uploadPrivatePhoto } from '@/lib/private-upload-client';
import { makeReceiptRef } from '@/lib/receipt-ref';
import { TransferInstructions } from '@/components/checkout/TransferInstructions';

export type PaymentMethod = 'instapay' | 'vodafone_cash';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  instapay: 'إنستاباي',
  vodafone_cash: 'فودافون كاش',
};

/**
 * خطوة الدفع المشتركة بين طلبات المتجر وحجوزات الكتابة وطلبات الخدمات.
 *
 * ليه الطلب بيتسجّل **قبل** الدفع:
 *   الرقم المرجعي بيتولّد مع الطلب، والعميل محتاجه يكتبه في ملاحظة
 *   التحويل عشان الإدارة تعرف التحويل ده بتاع أنهي طلب. فمفيش طريقة
 *   يوصله الرقم غير إن الطلب يتسجّل الأول.
 *
 * وليه الإيصال إجباري:
 *   قبل كده كان العميل بيكتب «رقم عملية» بإيده والإدارة بتأكد الدفع من
 *   غير ما تشوف أي إثبات. المراجعة اليدوية من غير إيصال مش مراجعة.
 */
export function PaymentProofForm({
  reference,
  amount,
  walletNumber,
  qrUrl,
  accent = 'rose',
  busy,
  onSubmit,
}: {
  reference: string;
  amount: number;
  walletNumber: string;
  qrUrl?: string;
  accent?: 'rose' | 'emerald';
  busy?: boolean;
  onSubmit: (payload: { method: PaymentMethod; receiptUrl: string }) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('instapay');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const accentButton =
    accent === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-rose-600 hover:bg-rose-700';

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('ارفع صورة إيصال التحويل');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      // ⚠️ الإيصال بيترفع **خاص** — فيه رقم التحويل والمحفظة. الطلب بيحفظ
      //    مرجع مش رابط، والإدارة بتشوفه برابط بينتهي (`lib/receipt-ref`).
      const photo = await uploadPrivatePhoto(file, 'receipts', setProgress);
      onSubmit({ method, receiptUrl: makeReceiptRef(photo) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر رفع الإيصال');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-bold text-amber-900">
          طلبك اتسجّل. اكتب الرقم ده في ملاحظة التحويل:
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <span
            dir="ltr"
            className="flex-1 rounded-xl border border-amber-200 bg-white px-4 py-3 text-center font-mono text-lg font-black tracking-wider text-slate-800"
          >
            {reference}
          </span>
          <button
            type="button"
            onClick={copyReference}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-800"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'اتنسخ' : 'نسخ الرقم'}
          </button>
        </div>
        <p className="mt-3 text-xs font-medium text-amber-800">
          من غير الرقم ده ممكن ياخد وقت أطول في مطابقة تحويلك بطلبك.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">المبلغ المطلوب</span>
          <span className="text-xl font-black text-slate-900">{formatPrice(amount)}</span>
        </div>

        <p className="mb-2 text-sm font-bold text-slate-700">وسيلة الدفع</p>
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMethod(value)}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition-colors ${
                method === value
                  ? 'border-slate-900 bg-white text-slate-900'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {METHOD_LABEL[value]}
            </button>
          ))}
        </div>

        <TransferInstructions
          walletNumber={walletNumber}
          qrUrl={qrUrl}
          accent={accent === 'emerald' ? 'emerald' : 'rose'}
        />

        <label className="mb-2 mt-4 block text-sm font-bold text-slate-700">
          صورة الإيصال <span className="text-red-600">*</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-4 transition-colors hover:border-slate-400">
          <Upload className="h-5 w-5 text-slate-400" />
          <span className="flex-1 text-sm font-medium text-slate-600">
            {file ? file.name : 'اختار صورة إيصال التحويل'}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || uploading}
        className={`w-full rounded-xl px-8 py-4 font-black text-white shadow-lg transition-colors disabled:opacity-70 ${accentButton}`}
      >
        {uploading ? `جارٍ رفع الإيصال… ${progress}٪` : busy ? 'جارٍ الإرسال…' : 'أرسل الإيصال للمراجعة'}
      </button>

      <p className="text-center text-xs font-medium text-slate-500">
        بعد الإرسال، الإدارة بتراجع التحويل وتأكد الطلب قبل البدء في تنفيذه.
      </p>
    </form>
  );
}
