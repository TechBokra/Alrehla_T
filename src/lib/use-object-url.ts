'use client';

import { useEffect, useMemo } from 'react';

/**
 * رابط معاينة مؤقت لملف اختاره المستخدم (صورة قبل رفعها).
 *
 * كان كل مكان بيعمله كده: effect يعمل الرابط ويحطه في state. ده رسم
 * زيادة على الفاضي (أول رسم من غير صورة، وبعدين رسم تاني بيها)، وقواعد
 * React الجديدة بتحذّر منه. هنا الرابط بيتحسب مع الرسم نفسه، والـeffect
 * بيمسحه من الذاكرة لما الملف يتغير أو الشاشة تتقفل.
 */
export function useObjectUrl(file: unknown): string | null {
  const url = useMemo(
    () => (typeof Blob !== 'undefined' && file instanceof Blob ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}
