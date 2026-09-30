import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Building2, Palette } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { formatPrice } from '@/lib/utils';
import type { PersonalizedProduct } from '@/types';
import { AgeBadge } from '@/components/enha-lak/AgeBadge';
import { primaryAgeBand } from '@/lib/age-bands';
import { cn } from '@/lib/utils';

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
 *    بتسعّر من `price` وحده. يعني الرقم ده وعد مالوش تنفيذ.
 *
 * ═══════════════════════════════════════════════════════════
 * 🔴 **الغلاف كان بيتقصّ — وده مقيس مش مفترَض**
 * ═══════════════════════════════════════════════════════════
 *
 * قياس على الموقع المنشور (صفحة المكتبة، لابتوب 1440):
 *
 *     الصورة الأصلية على Cloudinary : 396×395  ← **مربّعة**
 *     الصندوق اللي بتتعرض فيه        : 218×256  ← مستطيل طولي
 *     object-fit                      : cover
 *
 * `h-64` ارتفاع **ثابت** والعرض متغيّر حسب الشبكة، و`object-cover`
 * بتملا الصندوق وتقصّ الزيادة. يعني الغلاف المربّع كان بيتقصّ من
 * فوق ومن تحت — **وأعلى الغلاف هو مكان العنوان واسم المؤلف**.
 *
 * ── والحل مش تغيير النسبة لـ3/4 ─────────────────────────────
 *
 * أغلفة الكتب المفروض تبقى طولية، **بس المرفوع فعلًا مربّع**. لو
 * عملنا الصندوق `3/4` مع `cover`، القصّ بيزيد مش بيقلّ.
 *
 * **فالصندوق بقى `4/5` والصورة `object-contain`:**
 *
 *   • `contain` **مابتقصّش أبدًا** — الغلاف بيبان كامل مهما كانت
 *     نسبته. المربّع بياخد عرض الصندوق وبيسيب شريطين فوق وتحت،
 *     والطولي بيملاه. **ومحدش محتاج يعدّل الكود لما الأغلفة
 *     الحقيقية تترفع.**
 *   • خلفية متدرّجة فاتحة + ظل تحت الغلاف = شكل «كتاب على رفّ»
 *     بدل صورة مقصوصة لازقة في حواف الكارت.
 *
 * ⚠️ **وباقي عطل مش في الكود:** الأصل 396 بكسل وبس. الكارت عرضه
 *    ~290 على اللابتوب، فالصورة شبه مكبّرة لأقصاها وبتبان ناعمة.
 *    ده بند **محتوى** (الأغلفة تترفع بدقة 1200 بكسل على الأقل)،
 *    والكود هنا بيعرض أحسن ما يقدر من الموجود.
 */
export function ProductCard({
  product,
  publisherName,
  /** الزرّ الأساسي — «تخصيص الغلاف» أو «ابدأ التخصيص». */
  actionLabel,
  actionHref,
  /** رابط تانٍ اختياري لصفحة تفاصيل المنتج. */
  detailsHref,
  detailsLabel = 'عرض التفاصيل',
  /** الكارت كله رابط لصفحة المنتج (شبكة المكتبة). */
  cardHref,
}: {
  product: PersonalizedProduct;
  publisherName?: string;
  actionLabel: string;
  actionHref: string;
  detailsHref?: string;
  detailsLabel?: string;
  cardHref?: string;
}) {
  // لون خلفية الغلاف من الفئة العمرية — فالرفّ بيتقري بالعين قبل
  // الكلام: الأصفر للصغار، والسماوي بعدهم، وهكذا. ومن غير سنّ بيفضل
  // لون القسم.
  const band = primaryAgeBand(product);
  const isLibrary = product.category === 'library';

  return (
    <Card
      accentColor="rose"
      interactive
      // `h-full` عشان الكارت ياخد ارتفاع خانة الشبكة كاملًا حتى
      // وهو ملفوف في `Reveal` — فالأسعار والأزرار بتتراصّ على خط
      // واحد عبر الصف مهما اختلفت أطوال الأسماء.
      // ⚠️ `rounded-[1.75rem]` وحدّ أعرض: الزوايا المدوّرة أكتر هي أرخص
      //    طريقة لشكل «كتاب أطفال» من غير ما نغيّر المكوّن العام `Card`.
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border-2 p-0 hover:shadow-xl hover:shadow-rose-500/10"
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

      {/* ══ لوح الغلاف ══════════════════════════════════════
          نسبة أبعاد لا ارتفاع ثابت: الارتفاع بيتحسب من العرض،
          فالكارت بيتصرّف بنفس الشكل في شبكة ٢ و٣ و٤ أعمدة. */}
      <div
        className={cn(
          'relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-b',
          band ? band.tone.soft : 'from-rose-50 via-white to-slate-50',
        )}
      >
        {product.coverImageUrl ? (
          <Image
            src={optimizedImageUrl(product.coverImageUrl, 600)}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 300px"
            // ⚠️ `contain` مش `cover` — دي الحتة اللي بتمنع القصّ.
            //    و`p-6` بيسيب هامش حوالين الغلاف فيبان كأنه واقف
            //    على رفّ لا لازق في حواف الكارت.
            //    و`drop-shadow` بيمشي مع حدود الصورة نفسها (مش مع
            //    الصندوق)، فالظل بيقع تحت الغلاف بالظبط.
            //
            //    الحركة على `transform` وحدها وجوّه `motion-safe:` —
            //    اللي مفعّل «تقليل الحركة» في جهازه بياخدها ساكنة.
            className="object-contain p-6 drop-shadow-lg transition-transform duration-[var(--dur-slow)] ease-[var(--ease-ui)] motion-safe:group-hover:scale-[1.04]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <ImagePlaceholder label={product.name} />
        )}

        {/* ══ الملصقات على الغلاف ═══════════════════════════════
            ⚠️ **شارة الناشر اتشالت من هنا قبل كده** لأن الشارة فوق
               الصورة بتتقري زخرفة. السنّ مختلف: هو أول سؤال عند الأب
               («ينفع لابني؟»)، ومكانه على الغلاف بيجاوبه قبل ما يقرا
               الاسم. ومكتوب نصًّا، مش لون وبس. */}
        <AgeBadge
          minAge={product.minAge}
          maxAge={product.maxAge}
          className="pointer-events-none absolute top-3 right-3 -rotate-3"
        />

        {/* «غلاف مخصص فقط» — المصفوفة التنفيذية §3.3 بتطلبها بالاسم:
            «مهمة جدًّا لمنع الالتباس». من غيرها الأب ممكن يفتكر إن
            كتاب المكتبة بيتكتب باسم ابنه زي «أنت البطل هنا». */}
        {isLibrary && (
          <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-rose-800 shadow-sm ring-1 ring-rose-100">
            <Palette className="h-3.5 w-3.5" aria-hidden="true" />
            غلاف مخصص فقط
          </span>
        )}
      </div>

      <div className="z-10 flex flex-1 flex-col p-5">
        <h3 className="pointer-events-none mb-1 text-xl leading-snug font-bold text-slate-800">
          {product.name}
        </h3>

        {/* ══ الناشر ═══════════════════════════════════════
            ⚠️ **كان شارة عائمة فوق الغلاف.** والشارة اللي فوق صورة
               تُقرأ زخرفةً لا معلومة: العين بتعدّي عليها وهي بتبصّ
               على الغلاف، وعلى غلاف فاتح كانت بتتوه فيه.

               واسم الناشر في المكتبة **مش تفصيلة**: هو اللي بيقول
               للأب إن الكتاب ده من دار يعرفها. مكانه تحت الاسم،
               في سطر بيتقري. */}
        {publisherName && (
          <p className="pointer-events-none mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{publisherName}</span>
          </p>
        )}

        {product.shortDescription && (
          <p className="pointer-events-none mb-3 line-clamp-2 text-sm leading-relaxed font-medium text-slate-600">
            {product.shortDescription}
          </p>
        )}

        {/* ══ تفاصيل الكتاب ════════════════════════════════
            ⚠️ **الحقل ده كان موجود في القاعدة ومعروض في صفحة
               التفاصيل وحدها.** يعني العميل في شبكة المكتبة
               مابيشوفش أي فرق بين كتاب وكتاب غير الاسم والصورة —
               ولازم يفتح كل واحد عشان يعرف.

            ⚠️ **واتنين بس عن قصد**: التلاتة بتخلّي الكروت أطوال
               مختلفة، والعشرة بتحوّل الكارت لقايمة. والباقي في
               صفحة التفاصيل. */}
        {product.features && product.features.length > 0 && (
          <ul className="pointer-events-none mb-3 flex flex-wrap gap-1.5">
            {product.features.slice(0, 2).map((feature, i) => (
              <li
                key={i}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600"
              >
                {feature}
              </li>
            ))}
            {product.features.length > 2 && (
              <li className="px-1 py-0.5 text-[11px] font-bold text-slate-500">
                +{product.features.length - 2}
              </li>
            )}
          </ul>
        )}

        {/* ══ السعر ═════════════════════════════════════════
            كان جوّه صندوق رمادي بيقاسم «نسخة مطبوعة» نفس الحجم
            والوزن — فالرقم، وهو أهم معلومة في الكارت، كان بيتوه.
            دلوقتي الصيغة سطر صغير رمادي **فوق** الرقم، والرقم
            وحده هو الكبير. و`mt-auto` بتثبّته تحت مهما طال الاسم،
            فالأسعار بتتراصّ على خط واحد عبر الصف كله. */}
        <div className="pointer-events-none mt-auto mb-4 border-t border-slate-100 pt-4">
          <span className="block text-[11px] font-bold tracking-wide text-slate-500">
            نسخة مطبوعة
          </span>
          <span className="text-enha-lak-strong text-2xl font-black">
            {formatPrice(product.price)}
          </span>
        </div>

        <Button
          href={actionHref}
          accentColor="rose"
          className="pointer-events-auto relative z-20 w-full justify-center"
        >
          {actionLabel}
        </Button>

        {/* ⚠️ كان زرًّا تانيًا بعرض الكارت كله. زرّان متساويان في
            الحجم بيخلّوا العميل يقف يقارن بينهم — والزرّ ده مش
            مقابل للأول: التخصيص هو الهدف، والتفاصيل مجرّد قراءة.
            بقى رابط نصّي، والسهم بينزلق عند المرور (حركة على
            `transform` وجوّه `motion-safe:`). */}
        {detailsHref && (
          <Link
            href={detailsHref}
            className="group/details text-enha-lak-strong pointer-events-auto relative z-20 mt-3 inline-flex min-h-[44px] items-center justify-center gap-1.5 text-sm font-bold"
          >
            {detailsLabel}
            <ArrowLeft className="h-4 w-4 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-ui)] motion-safe:group-hover/details:-translate-x-1" />
          </Link>
        )}
      </div>
    </Card>
  );
}
