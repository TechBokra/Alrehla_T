import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, Field, FormActions, SubmitButton, TextInput } from '@/components/forms/Form';
import { saveTrainingSettings } from '@/actions/training';
import type { AdminCourse } from '@/data/domains/(admin)/training/queries';

export function TrainingSettingsForm({ course }: { course: AdminCourse }) {
  return (
    <ActionForm action={saveTrainingSettings} successMessage="اتحفظت إعدادات التأهيل." className="space-y-4">
      <Field label="اسم الدورة" name="title" required>
        <TextInput defaultValue={course.title} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نجاح اختبار الوحدة (٪)" name="modulePassPct" hint="٦٧٪ = سؤالين من ٣ (زي الملف).">
          <TextInput type="number" min={1} max={100} dir="ltr" className="text-left" defaultValue={course.modulePassPct} />
        </Field>
        <Field label="نجاح التقييم النهائي (٪)" name="finalPassPct">
          <TextInput type="number" min={1} max={100} dir="ltr" className="text-left" defaultValue={course.finalPassPct} />
        </Field>
      </div>
      <Checkbox name="criticalRequired" defaultChecked={course.criticalRequired} label="الأسئلة الحرجة لازم تبقى كلها صح" />
      <Checkbox
        name="requiredForActivation"
        defaultChecked={course.requiredForActivation}
        label="إلزامي قبل تفعيل المدرب (مايظهرش للعملاء قبل ما يجتازه)"
      />
      <Checkbox name="isActive" defaultChecked={course.isActive} label="التأهيل متاح للمدربين" />
      <FormActions>
        <SubmitButton>حفظ الإعدادات</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
