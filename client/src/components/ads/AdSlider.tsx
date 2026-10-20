'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { slotImageUrlAt } from '@/lib/cloudinary';
import { adIsInternal, type Ad } from '@/lib/ads';

/**
 * سلايدر الإعلانات.
 *
 * ── اللي بيفرق في بانر إعلاني ────────────────────────────────
 *
 * ⚠️ **مكتوب عليه «إعلان»** — حتى لو المعلن هو المنصة. الزائر من
 *    حقه يعرف إن اللي شايفه مدفوع أو ترويجي مش محتوى، ودي مسألة
 *    قانونية في بلاد كتير، وأهم في قسم بيدخله أطفال.
 *
 * ⚠️ **ارتفاع ثابت بنسبة الصورة** (`aspect-[…]`): البانر بيحمّل
 *    بعد باقي الصفحة، ولو مالوش مكان محفوظ المحتوى بينزل تحته
 *    فجأة والزائر بيدوس على حاجة ماكانش قاصدها.
 *
 * ⚠️ **بيحترم `prefers-reduced-motion`**: اللي مطفّي الحركة في
 *    نظامه بيشوف إعلانًا واحدًا ثابتًا والباقي بالأزرار — السلايدر
 *    اللي بيتحرك لوحده بيضايق ناس فعلًا، ومش كلهم بيعرفوا يقفوه.
 *
 * ⚠️ **بيقف عند `hover`/`focus`**: اللي بيقرا الإعلان أو ماشي
 *    بالكيبورد مش عايزه يهرب منه.
 *
 * ⚠️ **التحويل بيمرّ على `/go/ad/<id>`** عشان النقرة تتعدّ على
 *    الخادم — العدّ من المتصفح بيقفله مانع الإعلانات.
 */

const ROTATE_MS = 6000;

export function AdSlider({
  ads,
  placement,
  className = '',
}: {
  ads: Ad[];
  placement: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const count = ads.length;

  useEffect(() => {
    // ⚠️ إعلان واحد = مفيش مؤقّت خالص. مؤقّت بيلف على عنصر واحد
    //    بيصحّي الصفحة كل ٦ ثواني على الفاضي.
    if (count < 2 || paused || reduced) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [count, paused, reduced]);

  /* ⚠️ **مفيش `useEffect` بيصفّر الرقم لو الإعلانات قلّت** (إعلان خلص
     وقته والصفحة اتحدّثت). التصفير في أثر = رسمة زيادة، والـlint
     بيمنعه بحق. الحل إن الرسم نفسه بيحبس الرقم في المدى
     (`Math.min` تحت)، فالرقم الزايد مابيوصلش لمصفوفة أصلًا. */

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  if (count === 0) return null;
  const current = ads[Math.min(index, count - 1)];

  return (
    <section
      aria-label="إعلانات"
      className={`relative w-full ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="rounded-card relative overflow-hidden bg-slate-100">
        {/* نسبة الصورة: ٣:١ على الموبايل (الصورة المخصّصة له) و٦:١ فوق. */}
        <div className="relative aspect-[3/1] w-full sm:aspect-[6/1]">
          {ads.map((ad, i) => (
            <AdFrame key={ad.id} ad={ad} placement={placement} active={i === index} />
          ))}
        </div>

        {/* ⚠️ الكلمة دي مش زينة ولا بتتشال — اقرا رأس الملف. */}
        <span className="pointer-events-none absolute start-2 top-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-[11px] font-bold text-white">
          إعلان
        </span>
      </div>

      {count > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1">
          {/* ⚠️ النقط دي أزرار حقيقية بـ٤٤ بكسل مساحة لمس، والنقطة
              المرسومة صغيرة جوّاها — الحد اللي الموقع كله ماشي عليه. */}
          {ads.map((ad, i) => (
            <button
              key={ad.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`الإعلان ${i + 1} من ${count}`}
              aria-current={i === index}
              className="inline-flex h-[44px] w-[44px] items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
            >
              <span
                className={`block h-2 rounded-full transition-all ${
                  i === index ? 'w-5 bg-slate-700' : 'w-2 bg-slate-300'
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* قارئ الشاشة بيعرف إن اللي ظاهر اتغيّر من غير ما الحركة تقطع قراءته. */}
      <p aria-live="polite" className="sr-only">
        {current.advertiserName ? `إعلان من ${current.advertiserName}` : 'إعلان'}
      </p>
    </section>
  );
}

function AdFrame({ ad, placement, active }: { ad: Ad; placement: string; active: boolean }) {
  const desktop = slotImageUrlAt(ad.imageUrl, '6:1', 1600);
  // الصورة المخصّصة للموبايل، ولو مفيش بناخد الأساسية بقصّة ٣:١.
  const mobile = slotImageUrlAt(ad.imageUrlMobile || ad.imageUrl, '3:1', 800);

  const image = (
    <picture>
      <source media="(min-width: 640px)" srcSet={desktop} />
      <img
        src={mobile}
        alt={ad.advertiserName ? `إعلان من ${ad.advertiserName}` : ad.title}
        className="absolute inset-0 h-full w-full object-cover"
        /* ⚠️ `lazy` + `async`: البانر مش أهم حاجة في الصفحة، ومابيستاهلش
           يأخّر المحتوى اللي الزائر جاي له. */
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </picture>
  );

  const shell = `absolute inset-0 transition-opacity duration-500 ${
    active ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`;

  if (!ad.linkUrl) {
    return (
      <div className={shell} aria-hidden={!active}>
        {image}
      </div>
    );
  }

  const internal = adIsInternal(ad);

  return (
    <a
      href={`/go/ad/${ad.id}?p=${encodeURIComponent(placement)}`}
      className={shell}
      aria-hidden={!active}
      /* ⚠️ العنصر المخفي لازم يخرج من مسار الكيبورد كمان، مش بالعين بس. */
      tabIndex={active ? undefined : -1}
      {...(internal
        ? {}
        : {
            target: '_blank',
            /* ⚠️ `noopener` أمان: من غيرها الصفحة اللي بتفتح تقدر
               تتحكم في صفحتنا. و`sponsored` إفصاح لمحركات البحث
               إن ده لينك إعلاني. */
            rel: 'noopener noreferrer sponsored',
          })}
    >
      {image}
      <span className="sr-only">
        {ad.advertiserName ? `إعلان من ${ad.advertiserName}: ${ad.title}` : ad.title}
        {internal ? '' : ' (بيفتح في نافذة جديدة)'}
      </span>
    </a>
  );
}
