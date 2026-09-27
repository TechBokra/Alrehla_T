import React from 'react';

type SectionProps = {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  id?: string;
};

/**
 * قسم في صفحة عامة — وهو **صاحب الإيقاع الرأسي الوحيد** في الموقع.
 *
 * ── الفراغ اتقلّ، والسبب حسابي مش ذوقي ──────────────────────
 *
 * كان `py-16 md:py-24` = 96 بكسل فوق و96 تحت على اللابتوب. ولأن
 * الأقسام بتيجي ورا بعضها، الفراغ بين قسمين كان **192 بكسل** — شاشة
 * موبايل تقريبًا من الفضا بين فقرتين.
 *
 * وقبل أول قسم كان بيتجمّع كده:
 *
 *     24 (فوق الهيدر) + 64 (الهيدر) + 96 (فراغ القسم) = 184 بكسل
 *
 * يعني ربع شاشة اللابتوب فاضي قبل أول كلمة في أغلب الصفحات.
 *
 * دلوقتي `py-12 md:py-16` = 64 بكسل، فالفراغ بين قسمين 128 والفراغ
 * قبل الأول 128 (مع `pt-10` من `PageContainer`).
 *
 * ⚠️ **الأرقام دي مش قاعدة مقدّسة**: القسم اللي عايز يتنفّس أكتر
 *    بيبعت `className="py-20"` ويكسبها — `className` بييجي بعد
 *    الافتراضي فبيغلب عليه.
 */
export function Section({ children, className = '', containerClassName = '', id }: SectionProps) {
  return (
    <section id={id} className={`py-12 md:py-16 px-4 ${className}`}>
      <div className={`max-w-6xl mx-auto ${containerClassName}`}>
        {children}
      </div>
    </section>
  );
}
