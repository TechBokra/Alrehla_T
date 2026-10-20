import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getWritingPackages } from '@/data/domains/(shared)/writing/packages';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { saveWritingPackage } from '@/actions/writing';
import { ActionForm } from '@/components/dashboard/ActionForm';
import {
  Checkbox,
  Field,
  FormActions,
  FormSection,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
} from '@/components/forms/Form';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const packages = await getWritingPackages();
  const target = packages.find(p => p.id === id);

  if (!target) {
    return <div className="p-8 text-center">الباقة غير موجودة</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`تعديل الباقة: ${target.name}`} backHref="/dashboard/admin/writing/packages" />
      
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* `ActionForm` بدل `<form action>` العادي: خطأ الأكشن بيتعرض فوق
            النموذج والإداري يفضل مكانه بتعديلاته. وبعد الحفظ بيفضل في
            نفس الصفحة برسالة «اتحفظ» عشان لو عايز يكمّل تعديل. */}
        <ActionForm action={saveWritingPackage} successMessage="اتحفظ ✓" className="space-y-6">
          <input type="hidden" name="id" value={target.id} />
          <input type="hidden" name="slug" value={target.slug} />

          <FormSection columns={2}>
            <Field label="اسم الباقة" name="name" required>
              <TextInput defaultValue={target.name} />
            </Field>
            <Field label="الفئة العمرية" help="السن اللي الباقة معمولة له. الأهالي بيشوفوا الباقات على حسب سن الطفل." name="ageGroup" required>
              <Select defaultValue={target.ageGroup}>
                <option value="under_12">أقل من 12 سنة</option>
                <option value="12_plus">12 سنة فأكثر</option>
              </Select>
            </Field>
            <Field
              label="المسار"
              name="track"
              hint="المسار مستقل عن الفئة العمرية — مسارين ممكن يكونوا لنفس السن."
            >
              <Select defaultValue={target.track ?? ''}>
                <option value="">بدون مسار</option>
                <option value="foundation">مسار التأسيس</option>
                <option value="youth">مسار اليافعين والكبار</option>
                <option value="specialization">مسار التخصص</option>
              </Select>
            </Field>
          </FormSection>

          <FormSection columns={2}>
            <Field label="الوصف القصير" help="سطر أو اتنين بيظهروا في كارت الباقة وفي أول صفحتها." name="shortDescription" required>
              <TextInput defaultValue={target.shortDescription} />
            </Field>
            <Field label="الفئة المستهدفة" help="بيظهر في صفحة الباقة تحت «لمين؟» — مثلًا «للي بيحب يكتب ومحتاج يبدأ»." name="targetAudience" required>
              <TextInput defaultValue={target.targetAudience} />
            </Field>
          </FormSection>

          <Field label="الوصف الكامل" name="fullDescription" required>
            <TextArea defaultValue={target.fullDescription} rows={3} />
          </Field>

          <FormSection columns={3}>
            <Field label="السعر (ج.م)" help="السعر اللي ولي الأمر بيدفعه للباقة كلها، وبيظهر في الكارت وفي الحجز." name="price" required>
              <TextInput type="number" defaultValue={target.price} />
            </Field>
            <Field label="عدد الجلسات" name="sessionsCount" required>
              <TextInput type="number" defaultValue={target.sessionsCount} />
            </Field>
            {/* ⚠️ **كان `|| '40 دقيقة'` — والشاشة كانت بتكدب.**

                  الباقة اللي عمودها فاضي في القاعدة كانت بتفتح هنا
                  والخانة مكتوب فيها «40 دقيقة»، فالإداري يبص ويقول
                  «متظبطة» ويقفل. والقيمة ما اتحفظتش أبدًا.

                  وفي نفس الوقت صفحة الباقات العامة بتخفي المدة
                  خالص لما تكون فاضية — فالعميل **مايشوفش مدة
                  الجلسة**، والإدارة شايفاها. نفس فئة العطل بتاعة
                  «السعر النهائي 150 والمحفوظ 100».

                  دلوقتي الخانة بتفضل فاضية، و`required` بيلزم
                  الإداري يكتبها بوعي. ولوحة الإدارة أصلًا بتعدّ
                  الباقات الناقصة (`packagesMissingDuration`). */}
            <Field label="مدة الجلسة" help="نص بيظهر زي ما هو في الكارت — مثلًا «40 دقيقة»." name="sessionDuration" required>
              <TextInput defaultValue={target.sessionDuration ?? ''} placeholder="مثال: 40 دقيقة" />
            </Field>
          </FormSection>

          <FormSection columns={2}>
            <Field label="مدة البرنامج الإجمالية (نص)" help="بيظهر في الكارت جنب «المدة» — مثلًا «شهرين» أو «8 أسابيع»." name="durationText" required>
              <TextInput defaultValue={target.durationText} />
            </Field>
            <Field label="ملاحظة المتطلبات السابقة" help="اختياري. لو الباقة محتاجة حاجة قبلها (مثلًا باقة أساسيات)، اكتبها وهتظهر في صفحة الباقة." name="prerequisiteNote">
              <TextInput defaultValue={target.prerequisiteNote} />
            </Field>
          </FormSection>

          <Checkbox
            id="isActive"
            name="isActive"
            defaultChecked={target.isActive}
            label="الباقة نشطة ومتاحة للحجز"
          />

          <FormActions>
            <SubmitButton>حفظ التعديلات</SubmitButton>
          </FormActions>
        </ActionForm>
      </div>
    </div>
  );
}
