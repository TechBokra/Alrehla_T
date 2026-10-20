import Link from 'next/link';
import { SCROLL_ROW, SCROLL_ROW_MD_OFF } from '@/lib/scroll-row';

/**
 * تبويبات أقسام الصفحة — **روابط لمواضع، مش تبديل محتوى**.
 *
 * ── ليه روابط مش تبويبات بحالة ──────────────────────────────
 *
 * التبويب اللي بيبدّل المحتوى بيخبّي الباقي: الزائر اللي داخل يتفرّج
 * على الباقات بيشوف تلت اللي موجود، ولازم يدوس مرتين عشان يشوف
 * الباقي. والأسوأ إن المخبّي **مش في الصفحة أصلًا** لمحرّكات البحث لو
 * اتعمل بحالة في المتصفح.
 *
 * الروابط دي بتنزل على القسم بسلاسة، فالمحتوى كله موجود ومفهرس،
 * والزائر معاه طريق سريع لأي قسم. ومفيش `'use client'` — صفر جافاسكريبت.
 *
 * ⚠️ **وبتلزق تحت الهيدر** عشان تفضل في المتناول والزائر نازل.
 *    `scroll-mt` على القسم نفسه هو اللي بيمنع العنوان إنه يتخبّى تحت
 *    الشريط اللاصق ده بعد القفزة.
 *
 * ⚠️ **وعلى الموبايل سطر واحد بيتزحلق، مش `flex-wrap`.** ده كان
 *    `flex-wrap` في أول نسخة، وبالقياس على ٣٧٥ بكسل التلات تبويبات
 *    بقوا تلات سطور: الشريط ١١٣ بكسل = **١٤٪ من شاشة الموبايل**،
 *    لازقة فوق طول الوقت وبتاكل من المحتوى. سطر واحد بيتزحلق بقى
 *    ٥٦ بكسل، والقناع (`mask-image`) بيوضّح إن فيه كمان على الجنب —
 *    نفس حلّ شريط التنقل الرئيسي بالظبط.
 */
export function SectionTabs({
  items,
  className = '',
}: {
  items: { id: string; label: string }[];
  className?: string;
}) {
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="أقسام الصفحة"
      className={`sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur-sm md:py-3 ${className}`}
    >
      <ul
        className={`mx-auto w-full max-w-6xl justify-start gap-2 whitespace-nowrap ${SCROLL_ROW} ${SCROLL_ROW_MD_OFF}`}
      >
        {items.map((t) => (
          <li key={t.id}>
            <Link
              href={`#${t.id}`}
              className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
