'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * ظهور العنصر عند التمرير — **المرحلة ٤ من خطة الهوية**.
 *
 * ── العطل المقيس ────────────────────────────────────────────
 *
 * الموقع فيه **359** `transition-colors` مقابل **18** بس
 * `transition-transform`، و`group-hover:` في **23** موضع من 350+
 * ملف. يعني الموقع **بيغيّر ألوانه ومابيتحركش** — وده بالظبط اللي
 * بيدّي إحساس إنه ساكن.
 *
 * ── والحركة دي ليها شروط، مش زينة ───────────────────────────
 *
 * ⚠️ **مرة واحدة وبس.** العنصر اللي بيختفي ويرجع كل ما تنزل وتطلع
 *    بيحوّل التمرير لتعب. `unobserve` بتتنادى بعد أول ظهور.
 *
 * ⚠️ **الحركة على `opacity` و`transform` وحدهم.** دول الاتنين
 *    الوحيدين اللي المتصفح بيعملهم على كارت الشاشة من غير ما
 *    يعيد حساب التخطيط. أي حركة على `height` أو `top` بتتلعثم
 *    على الأجهزة الضعيفة — وأغلب جمهورنا على موبايل.
 *
 * ⚠️ **واللي مفعّل «تقليل الحركة» مابيشوفش حاجة من ده.** الحالة
 *    الابتدائية نفسها جوّه `motion-safe:` — مش الحركة وبس. يعني
 *    عنده العنصر **بيتولد ظاهرًا** ومافيش أي إزاحة.
 *
 * ⚠️ **ولو الجافاسكريبت وقع، المحتوى لازم يفضل ظاهرًا.** لو
 *    الحالة الابتدائية «مخفي» والمراقب ما اشتغلش، القسم بيختفي
 *    خالص — يعني حركة تجميلية بتاكل محتوى. عشان كده:
 *      • `IntersectionObserver` مش موجود ⇦ يظهر فورًا
 *      • الجافاسكريبت متعطّل ⇦ `<noscript>` بيفرض الظهور
 *
 * ── الاستخدام ───────────────────────────────────────────────
 *
 * بيتلفّ حوالين قسم أو شبكة في **صفحة خادم** عادي:
 *
 *     <Reveal><ProductGrid … /></Reveal>
 *
 * و`delay` بتدّي تدرّجًا بسيطًا بين عناصر الشبكة الواحدة (60ms
 * بين الواحد والتاني) — **ومابيتستخدمش لأكتر من أول قسمين في
 * الصفحة**: الإفراط فيه بيخلّي التصفّح بطيئًا.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  /** تأخير بالملّي ثانية — للتدرّج بين عناصر شبكة واحدة. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    // المتصفح القديم اللي مافيهوش مراقب: المحتوى يظهر فورًا.
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            // مرة واحدة — مافيش تكرار مع كل تمرير.
            observer.unobserve(entry.target);
          }
        }
      },
      // ⚠️ هامش سالب من تحت: العنصر بيبدأ يظهر وهو لسه داخل
      //    الشاشة بـ80 بكسل، مش في اللحظة اللي بيلمس فيها الحافة.
      //    من غيره الحركة بتحصل تحت نظر المستخدم مباشرة فتبان
      //    متأخرة.
      { rootMargin: '0px 0px -80px 0px', threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      // ⚠️ السمة دي هي اللي بيمسكها `<noscript>` تحت. من غيرها
      //    القاعدة هناك مالهاش هدف والمحتوى بيضيع لو الجافاسكريبت
      //    وقع.
      data-reveal-pending={shown ? undefined : ''}
      // الحالة الابتدائية كلها جوّه `motion-safe:` — مع «تقليل
      // الحركة» العنصر بيتولد ظاهرًا ومافيش `opacity-0` أصلًا.
      className={
        'transition-[opacity,transform] duration-[var(--dur-slow)] ease-[var(--ease-ui)] ' +
        (shown
          ? 'opacity-100 translate-y-0'
          : 'motion-safe:translate-y-4 motion-safe:opacity-0') +
        (className ? ` ${className}` : '')
      }
      style={shown ? undefined : { transitionDelay: `${delay}ms` }}
    >
      {children}
      {/* الجافاسكريبت متعطّل: الحالة مابتتغيّرش أبدًا، فالمحتوى
          كان هيفضل مخفيًّا. السطر ده بيفرض الظهور. */}
      <noscript>
        <style>{`[data-reveal-pending]{opacity:1 !important;transform:none !important}`}</style>
      </noscript>
    </div>
  );
}
