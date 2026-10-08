'use client';
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

import React, { useState, useEffect } from 'react';
import { Publisher, PersonalizedProduct, PricingFormulaSettings } from '@/types';
import { customerPriceFromCost } from '@/lib/publisher-pricing';
import { saveProduct } from '@/actions/products';
import {
  ASSIGNABLE_PRODUCT_CATEGORIES,
  PUBLISHER_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from '@/lib/product-categories';

interface Props {
  product: PersonalizedProduct;
  publishers: Publisher[];
  pricingSettings: PricingFormulaSettings;
}

export function ProductEditFormClient({ product, publishers, pricingSettings }: Props) {
  // المالك ثابت بعد الإنشاء — نقل منتج من المنصة لناشر (أو العكس) بيغيّر
  // مين بياخد الفلوس، ومكانه مش نموذج تعديل.
  const ownerType = product.ownerType;
  const [category, setCategory] = useState<string>(product.category);
  // ⚠️ **الرقم الابتدائي كان `product.price` دايمًا** — وده سعر
  //    العميل. فشاشة تعديل منتج ناشر كانت بتفتح والنصيب مكتوب فيه
  //    سعر العميل، وأول حفظة تضيف الهامش **فوق الهامش**.
  const [basePrice, setBasePrice] = useState(
    product.ownerType === 'publisher' ? (product.publisherCost ?? product.price) : product.price,
  );
  const [finalPrice, setFinalPrice] = useState(product.price);

  useEffect(() => {
    if (ownerType === 'publisher' && basePrice > 0) {
      setFinalPrice(customerPriceFromCost(basePrice, pricingSettings));
    } else {
      setFinalPrice(basePrice);
    }
  }, [ownerType, basePrice, pricingSettings]);

  // ⚠️ الأكشن كان بيرمي، وNext بيمسح نصّ الاستثناء في الإنتاج
  //    (قاعدة «هـ») — فالإداري بيشوف صفحة خطأ عامة بدل ما يعرف
  //    أي خانة هي السبب. دلوقتي `ActionForm` بيعرض الرسالة فوق
  //    النموذج ويعلّم الخانة لو الأكشن سمّاها، والخانات زيّ ما هي.
  return (
    <ActionForm action={saveProduct} successMessage="اتحفظ ✓" className="space-y-6">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="slug" value={product.slug} />

      <FormSection columns={2}>
        <Field label="اسم المنتج" name="name" required>
          <TextInput defaultValue={product.name} />
        </Field>
        <Field label="النوع / التصنيف" name="category" required>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {/* ⚠️ **كانت ستة، تلاتة منهم القاعدة بترفضهم.**
                «كتاب» و«لعبة» و«ملحق» مش في النوع المعرَّف
                `product_category` — الحفظ بيترفض من القاعدة.
                و«اشتراك» اتشال لأن مفيش ولا شاشة بتعرضه: شاشة
                الاشتراك بتقرا من `box_subscription_plans`، فالمنتج
                كان يتحفظ ويختفي. */}
            {(ownerType === 'publisher' ? PUBLISHER_PRODUCT_CATEGORIES : ASSIGNABLE_PRODUCT_CATEGORIES).map((c) => (
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
            <Field label="دار النشر" name="publisherId" required>
              <Select defaultValue={product.publisherId || ''}>
                <option value="">-- اختر الناشر --</option>
                {publishers.map(pub => (
                  <option key={pub.id} value={pub.id}>{pub.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className="space-y-4">
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
          <ElectronicPriceField category={category} defaultValue={product.electronicPrice} />
        </div>
      </div>

      <Field label="الوصف" name="shortDescription" required hint="سطر قصير بيظهر على كارت المنتج.">
        <TextArea defaultValue={product.shortDescription} rows={3} />
      </Field>

      <ProductContentFields
        longDescription={product.longDescription}
        galleryImageUrls={product.galleryImageUrls}
        features={product.features}
        minAge={product.minAge}
        maxAge={product.maxAge}
        library
      />
      {/* كان خانة نص بتطلب من الإدارة ترفع الصورة في مكان تاني وتنسخ
          الرابط بالإيد. بقى رفعًا مباشرًا زي كل صور الموقع. */}
      <ImageField
        name="coverImageUrl"
        label="صورة الغلاف"
        folder="alrehla/products"
        value={product.coverImageUrl || ''}
        aspect="cover"
        hint="غلاف الكتاب — يفضّل طولي (3:4)"
        library
      />

      <FormActions>
        <SubmitButton>حفظ التعديلات</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
