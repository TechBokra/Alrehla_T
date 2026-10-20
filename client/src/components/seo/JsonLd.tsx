import React from 'react';

/**
 * بيانات منظّمة (Structured Data).
 *
 * ده بلوك مخفي في الصفحة بيشرح لجوجل إن ده **منتج** بسعر وعملة، وده **مقال**
 * بتاريخ نشر، وده **مدرب** بتقييم كذا نجمة. من غيره جوجل بيشوف نصًا بس؛
 * معاه بيقدر يعرض السعر والنجوم جنب نتيجة البحث.
 *
 * ملحوظة أمان: `JSON.stringify` بيهرب علامات التنصيص، بس مش بيهرب `</script>`
 * لو جت جوّه نص من قاعدة البيانات — فبنستبدلها يدويًا. من غير ده، اسم منتج
 * فيه وسم إغلاق يقدر يقفل البلوك ويحقن كود في الصفحة.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
