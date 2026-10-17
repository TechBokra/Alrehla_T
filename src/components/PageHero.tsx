import React from 'react';
import { Button } from '@/components/ui/Button';
import { slotImageUrlAt, addWatermark } from '@/lib/cloudinary';

/**
 * بانر الصفحة — **ستايل الموقع الموحّد**.
 *
 * صورة بعرض الشاشة كامل، وتحتها بطاقة بيضا متداخلة معاها من جهة
 * البداية (اليمين في العربي) فيها العنوان وسطر تعريفي ولينكات سريعة.
 *
 * ── ليه مكوّن واحد ──────────────────────────────────────────
 *
 * الشكل ده كان **مكتوب مرتين** (الرئيسية وأقلام الرحلة) بنفس المقاسات
 * ونفس الهوامش السالبة — ومتفرّقين في نسخ بتفرق في تفاصيل صغيرة
 * (واحد بعلامة مائية والتاني لأ، واحد بأزرار النظام والتاني بروابط
 * مكتوبة بالإيد). وصفحتا «إنها لك» و«بداية الرحلة» كان عندهم شكل
 * تالت خالص: صورة محصورة بزوايا مدوّرة، والعنوان في وسط قسم تحتها.
 *
 * نسخة واحدة معناها إن تعديل الشكل بيحصل مرة، وإن الصفحات الأربعة
 * بتفضل متشابهة بعد التعديل.
 *
 * ── التفاصيل اللي بتفرق ─────────────────────────────────────
 *
 * ⚠️ **الصورة بتتقص لكل مقاس على حدة** (`<picture>` بتلات مصادر):
 *    4:3 على الموبايل ← 16:9 ← 21:9 على الشاشة الكبيرة. المتصفح
 *    بيحمّل **واحدة بس** — اللي مقاسها مطابق، فالموبايل بياخد 900
 *    بكسل بدل 2100.
 *
 * ⚠️ **و`<picture>` مش `next/image` عن قصد**: `next/image` مبتعرفش
 *    تدّي قصّات مختلفة لمقاسات مختلفة، وروابط Cloudinary دي متحوّلة
 *    أصلًا فـ`next/image` كانت بتمرّرها زي ما هي.
 *
 * ⚠️ **و`alt=""` عن قصد**: دي صورة زينة، والمعنى في الـ`h1` اللي
 *    تحتها. قارئ الشاشة يعدّيها بدل ما يقرا وصفًا مكرّرًا.
 *
 * ⚠️ **والبانر لازم يكون برّه `PageContainer`** في الصفحات اللي
 *    بتستعمله: الإطار ده بيحط `px-6 md:px-12`، والصورة المفروض تبقى
 *    بعرض الشاشة كامل.
 */
export type HeroLink = {
  href: string;
  label: string;
  /** أيقونة اختيارية جنب النص. */
  icon?: React.ReactNode;
  /** `solid` = الزر الأساسي. `outline` = زر ثانوي بإطار. */
  look?: 'solid' | 'outline';
};

export function PageHero({
  image,
  watermark,
  badge,
  title,
  subtitle,
  links = [],
  fallback,
  bandClassName = 'bg-slate-100',
}: {
  /** رابط الصورة من خانة صور الموقع. فاضي = بيتعرض `fallback`. */
  image?: string;
  /**
   * طبقة العلامة المائية (`getWatermarkLayer()`) — بتتحط على الصورة
   * لو اتبعتت. أقلام الرحلة مابتحطّش علامة على بانرها، فالحقل اختياري.
   */
  watermark?: string | null;
  /** شارة صغيرة فوق العنوان. */
  badge?: React.ReactNode;
  /** الـ`h1` — نص أو عنصر (الرئيسية بتبعت عنوانًا بكلمات ملوّنة). */
  title: React.ReactNode;
  subtitle?: string;
  /** اللينكات السريعة تحت السطر التعريفي. */
  links?: HeroLink[];
  /** اللي يتعرض لما مفيش صورة — بدل مستطيل فاضي. */
  fallback?: React.ReactNode;
  /** لون خلفية شريط الصورة قبل ما تحمّل. */
  bandClassName?: string;
}) {
  const src = (ar: string, w: number) =>
    watermark ? addWatermark(slotImageUrlAt(image, ar, w), watermark) : slotImageUrlAt(image, ar, w);

  return (
    <section className="relative w-full">
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[21/9] ${bandClassName}`}
      >
        {image ? (
          <picture>
            <source media="(min-width: 1024px)" srcSet={src('21:9', 2100)} />
            <source media="(min-width: 640px)" srcSet={src('16:9', 1400)} />
            <img
              src={src('4:3', 900)}
              alt=""
              width={900}
              height={675}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </picture>
        ) : (
          fallback
        )}
      </div>

      <div className="mx-auto w-full max-w-6xl px-4">
        {/* الهامش السالب هو اللي بيخلّي البطاقة تركب على الصورة.
            و`lg:max-w-2xl` بتخلّيها على جهة البداية — اليمين في
            العربي — بدل ما تمتد بعرض الصفحة. */}
        <div className="rounded-card relative -mt-16 bg-white/90 p-6 shadow-lg backdrop-blur-sm md:-mt-24 md:p-10 lg:max-w-2xl">
          {badge}
          <h1 className="mb-4 text-3xl leading-tight font-black text-slate-800 md:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mb-8 max-w-lg text-lg leading-relaxed font-medium text-slate-600">
              {subtitle}
            </p>
          )}
          {links.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {links.map((l) => (
                <Button
                  key={l.href}
                  href={l.href}
                  size="lg"
                  variant={l.look === 'outline' ? 'secondary' : 'primary'}
                >
                  {l.icon}
                  {l.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
