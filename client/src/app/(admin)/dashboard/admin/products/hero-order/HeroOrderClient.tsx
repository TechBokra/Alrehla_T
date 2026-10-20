'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ArrowDown, ArrowUp, BookOpen, Loader2 } from 'lucide-react';
import { saveHeroProductOrder } from '@/actions/product-order';
import { moveItem } from '@/lib/customization-fields';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { FormError } from '@/components/ui/FormError';

type Row = { id: string; name: string; coverImageUrl: string | null; visible: boolean };

export function HeroOrderClient({ products }: { products: Row[] }) {
  const [rows, setRows] = useState(products);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const move = async (index: number, direction: -1 | 1) => {
    const next = moveItem(rows, index, direction);
    if (!next || saving) return;
    const before = rows;
    // بيتحرّك قدامك على طول، ولو الحفظ فشل بيرجع مكانه ومعاه السبب.
    setRows(next);
    setSaving(true);
    setError('');
    try {
      const result = await saveHeroProductOrder(next.map((r) => r.id));
      if (!result.ok) {
        setRows(before);
        setError(result.error);
      }
    } catch {
      setRows(before);
      setError('تعذّر حفظ الترتيب — جرّب تاني');
    } finally {
      setSaving(false);
    }
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-3xl border border-slate-200 bg-white py-16 text-center font-medium text-slate-500">
        مفيش منتجات «مخصص» لسه.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <FormError message={error} />
      <ol className="space-y-2">
        {rows.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${
              p.visible ? '' : 'opacity-60'
            }`}
          >
            <span className="w-7 shrink-0 text-center text-sm font-black text-slate-400">
              {(i + 1).toLocaleString('ar-EG')}
            </span>
            <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {p.coverImageUrl ? (
                <Image
                  src={optimizedImageUrl(p.coverImageUrl, 120)}
                  alt=""
                  fill
                  sizes="44px"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <BookOpen className="m-auto mt-4 h-5 w-5 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-slate-800">{p.name}</p>
              {!p.visible && (
                <p className="text-xs font-medium text-slate-500">مش ظاهر للعملاء (موقوف أو مستني مراجعة)</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0 || saving}
                aria-label={`حرّك ${p.name} لفوق`}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1 || saving}
                aria-label={`حرّك ${p.name} لتحت`}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {saving && (
        <p className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> بيتحفظ…
        </p>
      )}
    </div>
  );
}
