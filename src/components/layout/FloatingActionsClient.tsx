'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, MessageCircle } from 'lucide-react';

/**
 * الزرّان العائمان: «للأعلى» وواتساب.
 *
 * ── قرارات ──────────────────────────────────────────────────
 *
 * • **الأخضر `#128C7E` مش `#25D366`.** الأخضر الفاتح المشهور مع أيقونة
 *   بيضاء بيدّي **1.98:1**، والعنصر غير النصي محتاج 3:1 — يعني الأيقونة
 *   بتبان باهتة على الأخضر. `#128C7E` لون واتساب الرسمي الغامق وبيدّي
 *   **4.14:1**، والدايرة نفسها على خلفية الموقع 4.07:1.
 *
 * • **`start-4` مش `right-4`.** الموقع RTL، و`start` بيترجم يمين
 *   تلقائيًا — ولو اتغيّر الاتجاه يومًا بيمشي معاه بدل ما يتقلب.
 *
 * • **48px** لكل زر — فوق حد الـ44 المطلوب على الموبايل.
 *
 * • زر «للأعلى» بيظهر بعد 400px تمرير بس: زر بيقولك «ارجع لفوق» وإنت
 *   فوق أصلًا مالوش معنى.
 *
 * • التمرير بيحترم «تقليل الحركة»: اللي مفعّلها بياخد قفزة فورية بدل
 *   تمرير ناعم بيدوّخ.
 *
 * • واتساب بيظهر بس لو الرقم متحطّ في الإعدادات — نفس الرقم اللي
 *   الفوتر بيستخدمه، فمفيش حقل جديد في لوحة الإدارة.
 */
export function FloatingActionsClient({ whatsappNumber }: { whatsappNumber?: string }) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    // `passive` عشان المتصفح ما يستناش الدالة قبل ما يمرّر الصفحة.
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const wa = whatsappNumber?.replace(/\D/g, '');

  const scrollUp = () => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  if (!wa && !showTop) return null;

  return (
    <div className="pointer-events-none fixed start-4 bottom-4 z-50 flex flex-col gap-3">
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="تواصل معنا على واتساب"
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#128C7E] text-white shadow-lg transition-[box-shadow,transform] duration-200 ease-[var(--ease-ui)] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128C7E] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}

      <button
        type="button"
        onClick={scrollUp}
        aria-label="العودة إلى أعلى الصفحة"
        className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-[opacity,box-shadow,transform] duration-200 ease-[var(--ease-ui)] hover:bg-slate-800 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5 ${
          showTop ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <ArrowUp className="h-6 w-6" />
      </button>
    </div>
  );
}
