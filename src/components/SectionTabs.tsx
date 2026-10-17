import Link from 'next/link';

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
      className={`sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-sm ${className}`}
    >
      <ul className="mx-auto flex w-full max-w-6xl flex-wrap justify-center gap-2 md:justify-start">
        {items.map((t) => (
          <li key={t.id}>
            <Link
              href={`#${t.id}`}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
