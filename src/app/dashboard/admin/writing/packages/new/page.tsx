import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
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

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) {
    return <Unauthorized />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="إضافة باقة جديدة" backHref="/dashboard/admin/writing/packages" />

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* `ActionForm` بدل `<form action>` العادي: لو الأكشن رجّع خطأ
            بيتعرض فوق النموذج والإداري يفضل مكانه باللي كتبه، وبعد
            النجاح بيرجع لقايمة الباقات. */}
        <ActionForm
          action={saveWritingPackage}
          successHref="/dashboard/admin/writing/packages"
          className="space-y-6"
        >
          <FormSection columns={2}>
            <Field label="اسم الباقة" name="name" required>
              <TextInput />
            </Field>
            <Field label="الفئة العمرية" name="ageGroup" required>
              <Select>
                <option value="under_12">أقل من 12 سنة</option>
                <option value="12_plus">12 سنة فأكثر</option>
              </Select>
            </Field>
            <Field
              label="المسار"
              name="track"
              hint="المسار مستقل عن الفئة العمرية — مسارين ممكن يكونوا لنفس السن."
            >
              <Select defaultValue="">
                <option value="">بدون مسار</option>
                <option value="foundation">مسار التأسيس</option>
                <option value="youth">مسار اليافعين والكبار</option>
                <option value="specialization">مسار التخصص</option>
              </Select>
            </Field>
          </FormSection>

          <FormSection columns={2}>
            <Field label="الوصف القصير" name="shortDescription" required>
              <TextInput />
            </Field>
            <Field label="الفئة المستهدفة" name="targetAudience" required>
              <TextInput />
            </Field>
          </FormSection>

          <Field label="الوصف الكامل" name="fullDescription" required>
            <TextArea rows={3} />
          </Field>

          <FormSection columns={3}>
            <Field label="السعر (ج.م)" name="price" required>
              <TextInput type="number" />
            </Field>
            <Field label="عدد الجلسات" name="sessionsCount" required>
              <TextInput type="number" />
            </Field>
            <Field label="مدة الجلسة" name="sessionDuration" required>
              <TextInput defaultValue="40 دقيقة" />
            </Field>
          </FormSection>

          <FormSection columns={2}>
            <Field label="مدة البرنامج الإجمالية (نص)" name="durationText" required>
              <TextInput />
            </Field>
            <Field label="ملاحظة المتطلبات السابقة" name="prerequisiteNote">
              <TextInput />
            </Field>
          </FormSection>

          <Checkbox id="isActive" name="isActive" defaultChecked label="الباقة نشطة ومتاحة للحجز" />

          <FormActions>
            <SubmitButton>إضافة الباقة</SubmitButton>
          </FormActions>
        </ActionForm>
      </div>
    </div>
  );
}
