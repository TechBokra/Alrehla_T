import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getManagedProductById, getMyPublisher } from '@/data/domains/products';
import { saveProduct } from '@/actions/products';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { getPublisherPricingSettings } from '@/data/domains/admin';
import { PublisherCostField } from '@/components/dashboard/PublisherCostField';
import { ProductContentFields } from '@/components/dashboard/ProductContentFields';
import { ImageField } from '@/components/dashboard/ImageField';
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
  PUBLISHER_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from '@/lib/product-categories';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // الناشر بتاع الحساب اللي داخل. كان مكتوب هنا «أول ناشر في
  // الجدول» — يعني أي ناشر كان بيشوف بيانات الناشر الأول مش بتاعته.
  const myPublisher = await getMyPublisher();
  if (!myPublisher) notFound();

  const target = await getManagedProductById(id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!target) notFound();
  // المنتج لازم يكون بتاع الناشر ده. من غير السطر ده، ناشر يقدر يفتح
  // صفحة تعديل منتج ناشر تاني بمجرد إنه يعرف رقمه.
  if (target.publisherId !== myPublisher.id) notFound();
  // ملف 16 (#GRXN): لو فيه تعديل مستني، الفورم بيكمّل منه — مش من المعروض.
  const shown = target.pendingDraft ?? target;

  const formula = await getPublisherPricingSettings();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="تعديل المنتج" backHref="/dashboard/publisher/products" />
      
      {target.pendingDraft && (
        <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">
          عندك تعديل مستني الإدارة — البيانات تحت هي اللي بعتّها. المنتج المعروض على الموقع لسه بالنسخة القديمة.
        </p>
      )}
      {target.reviewStatus === 'approved' && !target.pendingDraft && target.reviewNote && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          آخر تعديل اترفض: {target.reviewNote}
        </p>
      )}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <ActionForm
          action={saveProduct}
          successMessage={target.reviewStatus === 'approved' ? 'اتحفظ ✓ — التعديل راح للإدارة، والمنتج المعروض فاضل زي ما هو لحد الموافقة.' : 'اتحفظ ✓ — التعديل راح للإدارة تراجعه.'}
          className="space-y-6"
        >
          <input type="hidden" name="id" value={target.id} />
          <input type="hidden" name="slug" value={target.slug} />
          <input type="hidden" name="ownerType" value="publisher" />
          <input type="hidden" name="publisherId" value={myPublisher.id} />

          <FormSection columns={2}>
            <Field label="اسم المنتج" name="name" required>
              <TextInput defaultValue={shown.name} />
            </Field>
            <Field label="النوع / التصنيف" name="category" required>
              <Select defaultValue={shown.category}>
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
              </Select>
            </Field>
          </FormSection>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PublisherCostField formula={formula} defaultCost={shown.publisherCost} />
            {/* «السعر الإلكتروني» اتشال: النسخة الإلكترونية لـ«أنت البطل هنا» وحدها،
                والناشر منتجاته مكتبة بس (قرار تامر). الخادم مابيلمسش العمود لو
                الخانة مش مبعوتة. */}
          </div>

          <Field label="الوصف" name="shortDescription" required hint="سطر قصير بيظهر على كارت المنتج.">
            <TextArea defaultValue={shown.shortDescription} rows={3} />
          </Field>
          
          {/* ══ 🔴 النموذج ده كان ناقصه نص صفحة المنتج ══════════════
              مافيهوش الوصف الكامل ولا المعرض ولا التفاصيل — والحفظ كان
              بيكتبهم فاضيين **فوق اللي الإدارة كتبته**. الخادم اتقفل
              (`onlySentFields`)، والخانات بقت هنا من نفس مكوّن الإدارة.

              وخانة الغلاف كانت «الصق رابط» — يعني الناشر يرفع الصورة في
              مكان تاني وينسخ الرابط بالإيد. بقت رفعًا مباشرًا. */}
          <ProductContentFields
            longDescription={shown.longDescription}
            galleryImageUrls={shown.galleryImageUrls}
            features={shown.features}
            minAge={shown.minAge}
            maxAge={shown.maxAge}
          />

          <ImageField
            name="coverImageUrl"
            label="صورة الغلاف"
            folder="alrehla/products"
            value={shown.coverImageUrl || ''}
            aspect="cover"
            hint="غلاف الكتاب — يفضّل طولي (3:4) وبعرض ١٢٠٠ بكسل على الأقل"
          />

          <p className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed font-medium text-amber-900">
            أي تعديل بيرجّع المنتج لمراجعة الإدارة، وبيقف عن البيع لحد ما يتوافق عليه.
          </p>

          <FormActions>
            <SubmitButton>حفظ التغييرات</SubmitButton>
          </FormActions>
        </ActionForm>
      </div>
    </div>
  );
}
