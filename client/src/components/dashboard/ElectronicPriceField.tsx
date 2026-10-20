import React from 'react';
import { Field } from '@/components/forms/Form';
import { MoneyInput } from '@/components/dashboard/PublisherCostField';

/**
 * سعر النسخة الإلكترونية — **لمنتجات «أنت البطل هنا» وحدها** (قرار تامر:
 * «دي فقط في إنها لك مش في المكتبة»).
 *
 * ⚠️ الخانة بتختفي لغير «مخصص» — ولما تختفي **مابتتبعتش**، فالخادم
 *    مابيلمسش العمود (`onlySentFields`). والقاعدة نفسها بترفض الطلب
 *    الإلكتروني لأي تصنيف غير «مخصص» (ملف 138)، فالإخفاء هنا راحة
 *    مش حماية.
 * ⚠️ فاضية = **مفيش نسخة إلكترونية** للمنتج ده، والعميل مابيشوفش
 *    الاختيار أصلًا.
 */
export function ElectronicPriceField({
  category,
  defaultValue,
}: {
  category: string;
  defaultValue?: number;
}) {
  if (category !== 'custom') return null;
  return (
    <Field
      label="سعر النسخة الإلكترونية"
      name="electronicPrice"
      hint="اختياري — فاضية = النسخة الإلكترونية مش متاحة. بتتبعت للعميل بالإيميل، ومن غير شحن."
    >
      <MoneyInput min="1" defaultValue={defaultValue || ''} />
    </Field>
  );
}
