'use client';

import { useEffect, type RefObject } from 'react';

/**
 * يجرّ التبويب الحالي لداخل الشاشة في شريط بيتمرّر أفقيًّا.
 *
 * ── العطل اللي بيقفله ───────────────────────────────────────
 *
 * قِسْت القايمة الفرعية على `/creative-writing/services` على شاشة
 * موبايل 375 بكسل:
 *
 *     عرض المحتوى: 475  ·  عرض الشاشة: 343  ·  scrollLeft: 0
 *     التبويب الحالي «الخدمات الإبداعية» عند left = **−115**
 *
 * ⚠️ **يعني التبويب اللي بيقول للزائر هو فين — بره الشاشة تمامًا.**
 *    بيفتح صفحة الخدمات فيشوف «الباقات · عن البرنامج · المدربون»
 *    ومفيش واحد فيهم متعلَّم، فيفتكر إنه في مكان تاني. ونفس الحكاية
 *    على `/packages` و`/instructors`.
 *
 * والشريط كمان بيخفي الـscrollbar (`[&::-webkit-scrollbar]:hidden`)،
 * فمفيش أي علامة إن فيه حاجة على الجنب أصلًا.
 *
 * ── ليه `scrollIntoView` مش حساب يدوي ───────────────────────
 *
 * ⚠️ `scrollLeft` في الاتجاه من اليمين للشمال **اتجاهه بيختلف من
 *    متصفح للتاني** (سالب لصفر، أو صفر لموجب). الحساب اليدوي بيطلع
 *    مظبوط على متصفح وبالعكس على غيره. `scrollIntoView` بيسيب
 *    المتصفح يحسبها، و`block: 'nearest'` بيمنعه إنه يلف الصفحة رأسيًّا
 *    وإحنا لسه بنفتحها.
 */
export function useActiveIntoView(
  containerRef: RefObject<HTMLElement | null>,
  /** بيتغيّر مع الصفحة، فالتأثير بيتنفّذ تاني عند التنقّل. */
  key: string,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const active = container.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;

    // لو باين أصلًا مانلمسش حاجة — اللف بلا سبب بيحسّ إن الصفحة بتتحرّك
    // لوحدها.
    const box = container.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.left >= box.left && item.right <= box.right) return;

    active.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [containerRef, key]);
}
