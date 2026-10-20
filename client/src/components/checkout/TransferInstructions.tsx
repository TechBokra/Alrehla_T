'use client';

import React from 'react';
import Image from 'next/image';
import { optimizedImageUrl } from '@/lib/cloudinary';

/**
 * How the customer pays.
 *
 * The wallet number and the QR both come from site settings, so they change
 * from the admin dashboard — the number used to be a placeholder written into
 * the code (01234567890) on three separate screens.
 */
export function TransferInstructions({
  walletNumber,
  qrUrl,
  accent = 'rose',
}: {
  walletNumber: string;
  qrUrl?: string;
  accent?: 'rose' | 'emerald';
}) {
  const numberClass = accent === 'emerald' ? 'text-emerald-700' : 'text-rose-700';

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm text-slate-600">
        حوّل المبلغ عبر إنستاباي أو محفظة إلكترونية إلى:
      </p>

      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="mb-1 text-xs font-bold text-slate-500">رقم المحفظة</p>
          <p className={`font-mono text-xl font-black select-all ${numberClass}`}>
            {walletNumber}
          </p>
        </div>

        {qrUrl && (
          <div className="flex items-center gap-3">
            <div className="hidden h-12 w-px bg-slate-200 sm:block" />
            <div>
              <p className="mb-1 text-xs font-bold text-slate-500">أو امسح الكود</p>
              <div className="relative h-32 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Image
                  src={optimizedImageUrl(qrUrl, 400)}
                  alt="كود الدفع عبر إنستاباي"
                  fill sizes="220px"
                  className="object-contain p-1.5"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
