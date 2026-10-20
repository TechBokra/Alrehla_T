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

    // ══ 🔴 الشرط ده اتكتب بعد عطل حقيقي على المنشور ═════════
    //
    // أول نسخة كانت بتظهّر العنصر على `isIntersecting` **وحدها**.
    // والنتيجة اتقاست على الموقع المنشور: قفزة تمرير لآخر الصفحة
    // مرة واحدة ⇦ الكتب فضلت `opacity: 0` **للأبد**.
    //
    // السبب إن العنصر اللي بيعدّي من تحت الشاشة لفوقها **في إطار
    // واحد** المراقب بيحسبه «مش متقاطع» — فمابيتنادى بالظهور أبدًا.
    //
    // ⚠️ **ودي مش حالة نادرة ولا مصطنعة**، بتحصل مع:
    //      • رابط بعلامة `#` بيوقّعك في نصّ الصفحة
    //      • رجوع المتصفح لمكان التمرير القديم بعد Back أو تحديث
    //      • `Ctrl+End` أو زرّ «تخطَّ إلى المحتوى»
    //
    // ⚠️ **ولاحظ إن `<noscript>` تحت مابيغطّيش الحالة دي**: هو
    //    بيحمي من «الجافاسكريبت متعطّل»، والجافاسكريبت هنا شغّال
    //    تمامًا — وبيخفي المحتوى.
    //
    // ⚠️ **والسبب الحقيقي أدقّ من كده، وأنا غلطت فيه أول مرة:**
    //    المراقب مابيبعتش تقريرًا فيه `isIntersecting: false`؛ هو
    //    **مابيتنادى أصلًا**. التقرير بيتبعت عند **تغيّر الحالة**،
    //    والعنصر اللي كان «برّه من تحت» وبقى «برّه من فوق» حالته
    //    ما اتغيّرتش — الاتنين «برّه».
    //
    //    يعني فحص `entry.boundingClientRect` جوّه المراقب **عمره
    //    ما هيتنفّذ** في الحالة دي. الإصلاح لازم يبقى **برّه**
    //    المراقب.
    //
    // ── فالحماية بقت تلات طبقات ────────────────────────────
    //
    //   ① فحص فوري عند التركيب — الصفحة اللي بتفتح متمرّرة أصلًا
    //   ② المراقب — الحالة العادية، وكفء لأنه مابيشتغلش على
    //      الخيط الرئيسي
    //   ③ مستمع تمرير خفيف — شبكة الأمان للقفزة. `passive` عشان
    //      مايأخّرش التمرير، ومخنوق بإطار عرض واحد عشان القراءة
    //      تحصل مرة في الإطار لا مع كل حدث
    //
    // ⚠️ **والتلاتة بيتشالوا مع أول ظهور** — مفيش مستمع فاضل
    //    شغّالًا بعد ما العنصر بان.
    const REVEAL_MARGIN = 80;

    /** دخل الشاشة، أو عدّى فوقها خالص. */
    const visibleOrPassed = () => {
      const r = node.getBoundingClientRect();
      return r.top < window.innerHeight - REVEAL_MARGIN || r.bottom <= 0;
    };

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (visibleOrPassed()) cleanup(true);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cleanup(true);
      },
      // ⚠️ هامش سالب من تحت: العنصر بيبدأ يظهر وهو لسه داخل
      //    الشاشة بـ80 بكسل، مش في اللحظة اللي بيلمس فيها الحافة.
      //    من غيره الحركة بتحصل تحت نظر المستخدم مباشرة فتبان
      //    متأخرة.
      { rootMargin: `0px 0px -${REVEAL_MARGIN}px 0px`, threshold: 0.05 },
    );

    function cleanup(show: boolean) {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      if (show) setShown(true);
    }

    // ① الصفحة فتحت وهي متمرّرة (رابط `#`، رجوع، تحديث): العنصر
    //    اللي فوق مكان التمرير مش هيدخل الشاشة تاني.
    if (visibleOrPassed()) {
      setShown(true);
      return;
    }

    observer.observe(node);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => cleanup(false);
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
