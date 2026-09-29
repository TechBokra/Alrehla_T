import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Book } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { formatPrice } from '@/lib/utils';
import type { PersonalizedProduct } from '@/types';

/**
 * كارت المنتج — **واحد لصفحتَي المكتبة و«أنت البطل»**.
 *
 * ── ليه اتجمعوا في مكوّن واحد ───────────────────────────────
 *
 * الكارت كان متكرّرًا في الصفحتين بنسختين بدأوا متشابهين وبعدوا:
 * واحدة فيها شارة دار النشر والتانية لأ، وواحدة الكارت كله رابط
 * والتانية لأ، وكل إصلاح كان بيتعمل في واحدة وينسى التانية.
 *
 * ⚠️ **ودي نفس القاعدة المسجَّلة عندنا**: الحاجة اللي بتتوصف في
 *    مكانين بتتناقض. مكان واحد = إصلاح واحد.
 *
 * ── والسعر الإلكتروني اتشال من العرض ────────────────────────
 *
 * 🔴 **الكارت كان بيعرض «نسخة إلكترونية» بسعرها — ومفيش طريقة
 *    تشتريها.** السلة مابتحملش صيغة، و`create_customer_order`
 *    بتسعّر من `price` وحده. يعني الرقم ده وعد مالوش تنفيذ:
 *    العميل بيشوفه، ويدوّر على زرّ مش موجود، ويبعت يسأل.
 *
 *    العمود لسه في القاعدة وفي شاشة الناشر — **البيانات اتسابت،
 *    العرض هو اللي اتوقف** لحد ما السلة تقبل صيغة.
 */
export function ProductCard({
  product,
  publisherName,
  /** الزرّ الأساسي — «تخصيص الغلاف» أو «ابدأ التخصيص». */
  actionLabel,
  actionHref,
  /** زرّ تانٍ اختياري لصفحة تفاصيل المنتج. */
  detailsHref,
  /** الكارت كله رابط لصفحة المنتج (شبكة المكتبة). */
  cardHref,
}: {
  product: PersonalizedProduct;
  publisherName?: string;
  actionLabel: string;
  actionHref: string;
  detailsHref?: string;
  cardHref?: string;
}) {
  return (
    <Card
      accentColor="rose"
      className="relative flex flex-col overflow-hidden p-0 transition-all hover:-translate-y-1 hover:border-rose-300 hover:shadow-xl hover:shadow-rose-500/10"
    >
      {/* ⚠️ الكارت كله رابط، والأزرار جواه `pointer-events-auto`.
          الترتيب ده بيخلّي أي ضغطة على الكارت تروح لصفحة المنتج
          من غير ما تلغي الأزرار. */}
      {cardHref && (
        <Link
          href={cardHref}
          aria-label={product.name}
          className="absolute inset-0 z-0"
        />
      )}

      <div className="relative h-64 w-full bg-slate-100">
        {product.coverImageUrl ? (
          <Image
            src={optimizedImageUrl(product.coverImageUrl, 600)}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
            className="object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <ImagePlaceholder label={product.name} />
        )}

        {publisherName && (
          <div className="pointer-events-none absolute top-4 right-4 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800 shadow-sm backdrop-blur-sm">
            {publisherName}
          </div>
        )}
      </div>

      <div className="z-10 flex flex-1 flex-col p-6">
        <h3 className="pointer-events-none mb-2 text-xl font-bold text-slate-800">
          {product.name}
        </h3>

        {product.shortDescription && (
          <p className="pointer-events-none mb-6 flex-1 text-sm leading-relaxed font-medium text-slate-600 line-clamp-3">
            {product.shortDescription}
          </p>
        )}

        <div className="pointer-events-none mb-6 flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Book className="h-4 w-4 text-slate-500" />
            نسخة مطبوعة
          </span>
          <span className="font-black text-rose-700">{formatPrice(product.price)}</span>
        </div>

        <Button
          href={actionHref}
          accentColor="rose"
          className="pointer-events-auto relative z-20 w-full justify-center"
        >
          {actionLabel}
        </Button>

        {detailsHref && (
          <Button
            href={detailsHref}
            variant="secondary"
            className="pointer-events-auto relative z-20 mt-3 w-full justify-center"
          >
            عرض التفاصيل
          </Button>
        )}
      </div>
    </Card>
  );
}
