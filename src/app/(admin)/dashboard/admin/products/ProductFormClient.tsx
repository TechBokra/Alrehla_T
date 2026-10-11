'use client';

import React, { useState } from 'react';
import { Publisher, PricingFormulaSettings } from '@/types';
import { customerPriceFromCost } from '@/lib/publisher-pricing';
import { saveProduct } from '@/actions/products';
import { ProductContentFields } from '@/components/dashboard/ProductContentFields';
import { ImageField } from '@/components/dashboard/ImageField';
import { ElectronicPriceField } from '@/components/dashboard/ElectronicPriceField';
import { MoneyInput } from '@/components/dashboard/PublisherCostField';
import { ActionForm } from '@/components/dashboard/ActionForm';
import {
  Field,
  FormActions,
  FormSection,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
} from '@/components/forms/Form';
import {
  ASSIGNABLE_PRODUCT_CATEGORIES,
  PUBLISHER_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from '@/lib/product-categories';

interface Props {
  publishers: Publisher[];
  pricingSettings: PricingFormulaSettings;
  /** المنصة ولا ناشر — من القسم اللي النموذج اتفتح منه. */
  owner: 'platform' | 'publisher';
  /** بعد الإضافة يرجع هنا (قايمة القسم). */
  listHref: string;
}

export function ProductFormClient({ publishers, pricingSettings, owner, listHref }: Props) {
  const ownerType = owner;
  // منتج الناشر «مكتبة» بس — «مخصص» بيتكتب في المنصة من الصفر.
  const categories = owner === 'publisher' ? PUBLISHER_PRODUCT_CATEGORIES : ASSIGNABLE_PRODUCT_CATEGORIES;
  const [category, setCategory] = useState<string>(categories[0]);
  const [basePrice, setBasePrice] = useState(0);
  const [coverImageUrl, setCoverImageUrl] = useState('');

  // سعر العميل بيتحسب من التكلفة مع كل رسم — مش state بيتظبط في effect.
  const finalPrice =
    ownerType === 'publisher' && basePrice > 0
      ? customerPriceFromCost(basePrice, pricingSettings)
      : basePrice;

  /**
   * ⚠️ **النموذج كان `<form action={saveProduct}>` والأكشن بيرمي.**
   *
   *    وNext بيمسح نصّ الاستثناء في الإنتاج (قاعدة «هـ») — فالإداري
   *    بيضغط «حفظ» ويشوف **صفحة خطأ عامة** مالهاش علاقة بالخانة
   *    الغلط. مش زرًّا صامتًا، لكن النتيجة أوحش: بيطلّعه برّه الشاشة.
   *
   *    دلوقتي الأكشن بيرجّع `{ ok:false, error, field? }` و`ActionForm`
   *    بيعرض الرسالة فوق النموذج ويعلّم الخانة، والخانات زيّ ما هي.
   *
   * ⚠️ وبعد النجاح بيرجع للقايمة (`successHref`): كانت بتسكت بعد الحفظ
   *    والنموذج متملّي — نفس عطل «اتضاف ومع ذلك خطأ» عند الناشر:
   *    ضغطة تانية = منتج مكرّر.
   */
  return (
    <ActionForm action={saveProduct} successHref={listHref} className="space-y-6">
      <input type="hidden" name="id" value="" />
      <input type="hidden" name="slug" value="" />

      <FormSection columns={2}>
        <Field label="اسم المنتج" name="name" required>
          <TextInput />
        </Field>
        <Field label="النوع / التصنيف" help="المكتبة: كتاب جاهز والعميل بيخصّص الغلاف بس. قصة مخصصة: القصة بتتعمل من الأول باسم الطفل وصورته («أنت البطل»)." name="category" required>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {/* ⚠️ **كانت ستة، تلاتة منهم القاعدة بترفضهم.**
                «كتاب» و«لعبة» و«ملحق» مش في النوع المعرَّف
                `product_category` — الحفظ بيترفض من القاعدة.
                و«اشتراك» اتشال لأن مفيش ولا شاشة بتعرضه: شاشة
                الاشتراك بتقرا من `box_subscription_plans`، فالمنتج
                كان يتحفظ ويختفي. */}
            {categories.map((c) => (
              <option key={c} value={c}>
                {PRODUCT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <div className="space-y-4">
          {/* ⚠️ **المالك ثابت** — كان قايمة «المنصة / ناشر» في النموذج. المنصة
              والناشرين بقوا مفصولين في اللوحة (ملاحظة تامر)، فالمنتج بيتعمل
              من قسمه، والمالك بيتحدد من القسم مش من اختيار. */}
          <input type="hidden" name="ownerType" value={ownerType} />
          <p className="text-sm font-bold text-slate-700">
            المالك: {ownerType === 'publisher' ? 'دار نشر (شريك)' : 'المنصة'}
          </p>
          {ownerType === 'publisher' && (
            <Field label="دار النشر" help="المنتج هيتسجّل باسم الدار دي، ونصيبها بيتحسب من كل بيعة." name="publisherId" required>
              <Select defaultValue="">
                <option value="">-- اختر الناشر --</option>
                {publishers.map(pub => (
                  <option key={pub.id} value={pub.id}>{pub.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className="space-y-4">
          {/* ⚠️ **الشاشة كانت بتكدب.**
              الخانة اسمها `price`، والشاشة تحتها بتعرض «السعر
              النهائي: 150» — والمحفوظ كان 100. يعني الإداري
              بيشوف رقمًا والعميل بيشوف رقمًا تاني.

              دلوقتي الرقم ده بيتبعت باسمه الصح: نصيب الناشر لو
              المنتج لناشر، وسعر المنصة لو المنتج بتاعها —
              والخادم بيحسب الباقي بنفسه. */}
          <Field
            label={ownerType === 'publisher' ? 'نصيب الناشر من النسخة' : 'السعر الورقي'}
            name={ownerType === 'publisher' ? 'publisherCost' : 'price'}
            required
            hint={
              ownerType === 'publisher'
                ? 'اللي بيوصل الناشر عن كل نسخة — سعر العميل بيتحسب منه.'
                : 'السعر اللي العميل بيدفعه في النسخة الورقية.'
            }
          >
            <MoneyInput
              min="0"
              value={basePrice || ''}
              onChange={(e) => setBasePrice(Number(e.target.value))}
            />
          </Field>

          {ownerType === 'publisher' && basePrice > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">هامش المنصة:</span>
                <span className="font-bold text-blue-700">+{finalPrice - basePrice} ج.م</span>
              </div>
              <div className="flex justify-between font-black text-lg border-t border-blue-200 pt-2 mt-2">
                <span className="text-slate-800">السعر النهائي:</span>
                <span className="text-emerald-600">{finalPrice} ج.م</span>
              </div>
            </div>
          )}
          <ElectronicPriceField category={category} />
        </div>
      </div>

      <Field label="الوصف" name="shortDescription" required hint="سطر قصير بيظهر على كارت المنتج.">
        <TextArea rows={3} />
      </Field>

      <ProductContentFields library />
      {/* كان بيرفع على Supabase Storage — مسار تاني بالكامل عن باقي
          الموقع اللي على Cloudinary. التوحيد بيخلي الصورة تتحسن وتتضغط
          تلقائيًا زي كل صور الموقع. */}
      <ImageField
        name="coverImageUrl"
        label="صورة الغلاف"
        folder="alrehla/products"
        value={coverImageUrl}
        onChange={setCoverImageUrl}
        aspect="cover"
        hint="غلاف الكتاب — يفضّل طولي (3:4)"
        library
      />

      <FormActions>
        <SubmitButton>إضافة المنتج</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
