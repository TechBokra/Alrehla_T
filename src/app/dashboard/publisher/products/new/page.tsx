import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getMyPublisher } from '@/data/domains/products';
import { saveProduct } from '@/actions/products';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { getPublisherPricingSettings } from '@/data/domains/admin';
import { PublisherCostField } from '@/components/dashboard/PublisherCostField';
import { ProductContentFields } from '@/components/dashboard/ProductContentFields';
import { ImageField } from '@/components/dashboard/ImageField';
import {
  PUBLISHER_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from '@/lib/product-categories';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // الناشر بتاع الحساب اللي داخل. كان مكتوب هنا «أول ناشر في
  // الجدول» — يعني أي ناشر كان بيشوف بيانات الناشر الأول مش بتاعته.
  const myPublisher = await getMyPublisher();
  if (!myPublisher) notFound();

  // المعادلة من القاعدة — عشان الناشر يشوف سعر العميل وهو بيكتب
  // نصيبه. والخادم بيقراها تاني وقت الحفظ ومبيثقش في اللي جاي
  // من الفورم (قاعدة «ف»).
  const formula = await getPublisherPricingSettings();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="إضافة منتج جديد" backHref="/dashboard/publisher/products" />
      
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <ActionForm action={saveProduct} className="space-y-6">
          <input type="hidden" name="id" value="" />
          <input type="hidden" name="slug" value="" />
          <input type="hidden" name="ownerType" value="publisher" />
          <input type="hidden" name="publisherId" value={myPublisher.id} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">اسم المنتج</label>
              <input type="text" name="name" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">النوع / التصنيف</label>
              <select name="category" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none">
                {/* ⚠️ **كانت أربعة، تلاتة منهم القاعدة بترفضهم**
                    («كتاب» و«لعبة» و«ملحق» مش في النوع المعرَّف).
                    والناشر بيعرض إصدارات جاهزة، فالمكتبة هي مساره —
                    و«مخصص» ممنوع عليه عن قصد: القصة المخصصة بتتكتب
                    من الصفر في المنصة، ولو الناشر اختارها كان
                    منتجه يظهر في «أنت البطل» ومعالجه يرفضه. */}
                {PUBLISHER_PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PRODUCT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PublisherCostField formula={formula} />
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">السعر الإلكتروني (اختياري)</label>
              <input type="number" name="electronicPrice" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">الوصف</label>
            <textarea name="shortDescription" rows={3} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"></textarea>
          </div>
          
          {/* ══ 🔴 النموذج ده كان ناقصه نص صفحة المنتج ══════════════
              مافيهوش الوصف الكامل ولا المعرض ولا التفاصيل — والحفظ كان
              بيكتبهم فاضيين **فوق اللي الإدارة كتبته**. الخادم اتقفل
              (`onlySentFields`)، والخانات بقت هنا من نفس مكوّن الإدارة.

              وخانة الغلاف كانت «الصق رابط» — يعني الناشر يرفع الصورة في
              مكان تاني وينسخ الرابط بالإيد. بقت رفعًا مباشرًا. */}
          <ProductContentFields />

          <ImageField
            name="coverImageUrl"
            label="صورة الغلاف"
            folder="alrehla/products"
            value=''
            aspect="cover"
            hint="غلاف الكتاب — يفضّل طولي (3:4) وبعرض ١٢٠٠ بكسل على الأقل"
          />

          <p className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed font-medium text-amber-900">
            أي تعديل بيرجّع المنتج لمراجعة الإدارة، وبيقف عن البيع لحد ما يتوافق عليه.
          </p>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button type="submit" className="rounded-xl bg-amber-500 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-amber-600">
              إضافة المنتج
            </button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
