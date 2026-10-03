'use client';
import { ProductContentFields } from '@/components/dashboard/ProductContentFields';
import { ImageField } from '@/components/dashboard/ImageField';
import { ElectronicPriceField } from '@/components/dashboard/ElectronicPriceField';

import React, { useState, useEffect, useTransition } from 'react';
import { FormError } from '@/components/ui/FormError';
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

  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ⚠️ الأكشن كان بيرمي، وNext بيمسح نصّ الاستثناء في الإنتاج
  //    (قاعدة «هـ») — فالإداري بيشوف صفحة خطأ عامة بدل ما يعرف
  //    أي خانة هي السبب. دلوقتي الرسالة فوق النموذج والخانات
  //    زيّ ما هي.
  const submit = (formData: FormData) =>
    startTransition(async () => {
      setError('');
      setNotice('');
      const result = await saveProduct(formData);
      if (result && !result.ok) setError(result.error);
      else setNotice('اتحفظ ✓');
    });

  return (
    <form action={submit} className="space-y-6">
      <FormError message={error} />
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
          {notice}
        </p>
      )}
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="slug" value={product.slug} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">اسم المنتج</label>
          <input type="text" name="name" defaultValue={product.name} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">النوع / التصنيف</label>
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none">
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
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <div>
          {/* ⚠️ **المالك ثابت** — كان قايمة «المنصة / ناشر» في النموذج. المنصة
              والناشرين بقوا مفصولين في اللوحة (ملاحظة تامر)، فالمنتج بيتعمل
              من قسمه، والمالك بيتحدد من القسم مش من اختيار. */}
          <input type="hidden" name="ownerType" value={ownerType} />
          <p className="mb-4 text-sm font-bold text-slate-700">
            المالك: {ownerType === 'publisher' ? 'دار نشر (شريك)' : 'المنصة'}
          </p>
          {ownerType === 'publisher' && (
            <>
              <label className="block text-sm font-bold text-slate-700 mb-2">اختر الناشر</label>
              <select name="publisherId" defaultValue={product.publisherId || ''} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none">
                <option value="">-- اختر الناشر --</option>
                {publishers.map(pub => (
                  <option key={pub.id} value={pub.id}>{pub.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {ownerType === 'publisher' ? 'نصيب الناشر من النسخة' : 'السعر الورقي'}
            </label>
            <div className="relative">
              <input 
                type="number" 
                name={ownerType === 'publisher' ? 'publisherCost' : 'price'}
                min="0"
                required 
                value={basePrice || ''}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none pl-12" 
              />
              <span className="absolute left-4 top-3 text-slate-400 font-bold">ج.م</span>
            </div>
          </div>
          
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

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">الوصف</label>
        <textarea name="shortDescription" defaultValue={product.shortDescription} rows={3} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"></textarea>
      </div>
      


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
      
      <div className="pt-6 border-t border-slate-100 flex justify-end">
        <button type="submit" disabled={busy} className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50">
          {busy ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
        </button>
      </div>
    </form>
  );
}
