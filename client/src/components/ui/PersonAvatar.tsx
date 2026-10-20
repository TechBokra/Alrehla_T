import React from 'react';
import Image from 'next/image';
import { optimizedImageUrl } from '@/lib/cloudinary';

/**
 * صورة شخص — مدرب أو مقدّم خدمة — بالحرف الأول كبديل.
 *
 * ── ليه مكوّن مشترك ─────────────────────────────────────────
 *
 * «الصورة موجودة في القاعدة وطبقة العرض مش بتطلبها» تكرّرت في هذا
 * المشروع **خمس مرات** في أماكن مختلفة: صفحة المدرب، كارت قائمة
 * المدربين، معالج حجز الباقة، كارت مقدّم الخدمة، وشاشة تأكيد الحجز.
 *
 * وفي كل مرة كان الإصلاح هو نفس العشرين سطرًا متكرّرين. الصح إنهم
 * يبقوا في مكان واحد: مين ينسى يحط الصورة بعد كده هيبقى ناسي **سطرًا
 * واحدًا** ظاهرًا، مش ناسي منطقًا كاملًا.
 *
 * ⚠️ `alt=""` عن قصد: الاسم مكتوب جنب الصورة دايمًا، فقارئ الشاشة
 *    مايكرّرش نفس المعلومة مرتين.
 */
export function PersonAvatar({
  name,
  avatarUrl,
  size = 48,
  className = '',
}: {
  /** الاسم — بيتاخد منه الحرف الأول لما مفيش صورة. */
  name: string;
  avatarUrl?: string | null;
  /** القُطر بالبكسل. */
  size?: number;
  className?: string;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 overflow-hidden rounded-full bg-slate-200 ${className}`}
    >
      {avatarUrl ? (
        <Image
          src={optimizedImageUrl(avatarUrl, size * 2)}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center font-bold text-slate-600"
          style={{ fontSize: Math.max(12, Math.round(size * 0.4)) }}
        >
          {name.trim().charAt(0) || '؟'}
        </span>
      )}
    </div>
  );
}
