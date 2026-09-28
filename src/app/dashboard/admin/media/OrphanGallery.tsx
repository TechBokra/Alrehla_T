'use client';

import React, { useState, useTransition } from 'react';
import Image from 'next/image';
import { Trash2, Loader2, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { deleteUnusedMedia } from '@/actions/media';
import { FormError } from '@/components/ui/FormError';
import { formatCairo } from '@/lib/timezone';

export type OrphanAsset = {
  publicId: string;
  url: string;
  bytes: number;
  format: string;
  createdAt: string;
};

/**
 * معرض الصور المهجورة — **وهو المكان الوحيد اللي فيه حذف**.
 *
 * ⚠️ **الصور المستخدَمة مالهاش مربّع اختيار أصلًا** — مش معطَّل،
 *    مش موجود. عرضها في معرض تاني بلا أي وسيلة تحديد معناه إن
 *    ضغطة غلط مش ممكنة، مش إنها متمنوعة.
 *
 * ⚠️ **والتأكيد بيقول العدد والحجم.** «متأكد؟» مجرّدة بتتضغط
 *    بالعادة. رقم قدّام عينك بيخلّيك تقرا.
 */
export function OrphanGallery({ assets }: { assets: OrphanAsset[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = assets.length > 0 && selected.size === assets.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(assets.map((a) => a.publicId)));

  const selectedBytes = assets
    .filter((a) => selected.has(a.publicId))
    .reduce((sum, a) => sum + a.bytes, 0);

  const remove = () => {
    const ids = [...selected];
    if (ids.length === 0) return;

    const mb = (selectedBytes / 1024 / 1024).toFixed(1);
    const sure = window.confirm(
      `هتحذف ${ids.length} صورة (${mb} ميجا) نهائيًّا من Cloudinary.\n\n` +
        'الحذف مالوش تراجع. لو واحدة منهم مستخدَمة في الموقع، مكانها هيبقى فاضي.\n\n' +
        'تأكيد؟',
    );
    if (!sure) return;

    startTransition(async () => {
      setError('');
      setNotice('');
      const result = await deleteUnusedMedia(ids);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      setNotice(
        `اتحذف ${result.deleted} صورة${result.skipped ? ` · ${result.skipped} ما اتحذفتش` : ''}.`,
      );
    });
  };

  if (assets.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center font-medium text-slate-400">
        كل صور المجلّد مستخدمة — مفيش حاجة للحذف.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <FormError message={error} />
      {notice && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleAll}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-slate-400 disabled:opacity-50"
        >
          {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          {allSelected ? 'إلغاء التحديد' : 'حدّد الكل'}
        </button>

        <button
          type="button"
          onClick={remove}
          disabled={busy || selected.size === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          احذف المحدَّد
          {selected.size > 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {selected.size} · {(selectedBytes / 1024 / 1024).toFixed(1)} ميجا
            </span>
          )}
        </button>

        {selected.size > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            الحذف نهائي ومالوش تراجع
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {assets.map((asset) => {
          const isOn = selected.has(asset.publicId);
          return (
            <label
              key={asset.publicId}
              className={`block cursor-pointer overflow-hidden rounded-2xl border-2 bg-white transition-colors ${
                isOn ? 'border-rose-500' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="relative aspect-square bg-slate-100">
                <Image
                  src={asset.url}
                  alt=""
                  fill
                  sizes="220px"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                  unoptimized
                />
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(asset.publicId)}
                  disabled={busy}
                  className="absolute top-2 right-2 h-5 w-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
              </div>
              <div className="space-y-1 p-3">
                <p
                  dir="ltr"
                  className="truncate text-right font-mono text-[11px] text-slate-500"
                  title={asset.publicId}
                >
                  {asset.publicId}
                </p>
                <p className="text-xs font-bold text-slate-600">
                  {(asset.bytes / 1024).toFixed(0)} ك.ب · {asset.format}
                </p>
                {asset.createdAt && (
                  <p className="text-xs font-medium text-slate-400">
                    {formatCairo(asset.createdAt, { dateStyle: 'medium' })}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
