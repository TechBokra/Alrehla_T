import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
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
      <DashboardPageHeader
        title="إضافة باقة جديدة"
        backHref="/dashboard/admin/writing/packages"
      />

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
            <Field
              label="الفئة العمرية"
              help="السن اللي الباقة معمولة له. الأهالي بيشوفوا الباقات على حسب سن الطفل."
              name="ageGroup"
              required
            >
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
            <Field
              label="الوصف القصير"
              help="سطر أو اتنين بيظهروا في كارت الباقة وفي أول صفحتها."
              name="shortDescription"
              required
            >
              <TextInput />
            </Field>
            <Field
              label="الفئة المستهدفة"
              help="بيظهر في صفحة الباقة تحت «لمين؟» — مثلًا «للي بيحب يكتب ومحتاج يبدأ»."
              name="targetAudience"
              required
            >
              <TextInput />
            </Field>
          </FormSection>

          <Field label="الوصف الكامل" name="fullDescription" required>
            <TextArea rows={3} />
          </Field>

          <FormSection columns={3}>
            <Field
              label="السعر (ج.م)"
              help="السعر اللي ولي الأمر بيدفعه للباقة كلها، وبيظهر في الكارت وفي الحجز."
              name="price"
              required
            >
              <TextInput type="number" />
            </Field>
            <Field label="عدد الجلسات" name="sessionsCount" required>
              <TextInput type="number" />
            </Field>
            <Field
              label="مدة الجلسة"
              help="نص بيظهر زي ما هو في الكارت — مثلًا «40 دقيقة»."
              name="sessionDuration"
              required
            >
              <TextInput defaultValue="40 دقيقة" />
            </Field>
          </FormSection>

          <FormSection columns={2}>
            <Field
              label="مدة البرنامج الإجمالية (نص)"
              help="بيظهر في الكارت جنب «المدة» — مثلًا «شهرين» أو «8 أسابيع»."
              name="durationText"
              required
            >
              <TextInput />
            </Field>
            <Field
              label="ملاحظة المتطلبات السابقة"
              help="اختياري. لو الباقة محتاجة حاجة قبلها (مثلًا باقة أساسيات)، اكتبها وهتظهر في صفحة الباقة."
              name="prerequisiteNote"
            >
              <TextInput />
            </Field>
          </FormSection>

          <Checkbox
            id="isActive"
            name="isActive"
            defaultChecked
            label="الباقة ظاهرة على الموقع"
          />
          <input type="hidden" name="hasBookingOpen" value="1" />
          <Checkbox
            id="bookingOpen"
            name="bookingOpen"
            defaultChecked
            label="الحجز مفتوح — لو مش متعلّم، الباقة بتظهر «قريبًا» مع زرار «بلّغني لما تفتح»"
          />

          <FormActions>
            <SubmitButton>إضافة الباقة</SubmitButton>
          </FormActions>
        </ActionForm>
      </div>
    </div>
  );
}
