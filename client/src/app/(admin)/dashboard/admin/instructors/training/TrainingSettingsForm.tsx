import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, Field, FormActions, FormSection, SubmitButton, TextInput } from '@/components/forms/Form';
import { saveTrainingSettings } from '@/actions/training';
import type { AdminCourse } from '@/data/domains/(admin)/training/queries';

/**
 * إعدادات التأهيل — «كل ما هو ممكن في لوحة التحكم» (قرار تامر، ٢٧ أكتوبر).
 */
export function TrainingSettingsForm({ course }: { course: AdminCourse }) {
  const topics = course.content.topics ?? [];
  const modules = course.content.modules;
  return (
    <ActionForm action={saveTrainingSettings} successMessage="اتحفظت إعدادات التأهيل." className="space-y-6">
      <Field label="اسم الدورة" name="title" required>
        <TextInput defaultValue={course.title} maxLength={200} />
      </Field>

      <FormSection title="النجاح" columns={2}>
        <Field label="نجاح اختبار الوحدة (٪)" name="modulePassPct" hint="٦٧٪ = سؤالين من ٣.">
          <TextInput type="number" min={1} max={100} dir="ltr" className="text-left" defaultValue={course.modulePassPct} />
        </Field>
        <Field label="نجاح التقييم النهائي (٪)" name="finalPassPct">
          <TextInput type="number" min={1} max={100} dir="ltr" className="text-left" defaultValue={course.finalPassPct} />
        </Field>
      </FormSection>
      <Checkbox name="criticalRequired" defaultChecked={course.criticalRequired} label="الأسئلة الحرجة لازم تبقى كلها صح" />
      <Checkbox
        name="requiredForActivation"
        defaultChecked={course.requiredForActivation}
        label="إلزامي قبل تفعيل المدرب (مايظهرش للعملاء قبل ما يجتازه)"
      />
      <Checkbox name="isActive" defaultChecked={course.isActive} label="التأهيل متاح للمدربين" />

      {!course.settingsReady && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
          الوقت المتوقع والتوقف التلقائي وربط المجالات محتاجين ترحيل 20261027090000 يتشغّل الأول.
        </p>
      )}

      <FormSection title="الوقت" description="بيظهر للمدرب في أول صفحة." columns={3}>
        <Field label="الوقت المتوقع — من (دقيقة)" name="estimateMin">
          <TextInput type="number" min={1} max={1000} dir="ltr" className="text-left" defaultValue={course.estimateMin} />
        </Field>
        <Field label="إلى (دقيقة)" name="estimateMax">
          <TextInput type="number" min={1} max={1000} dir="ltr" className="text-left" defaultValue={course.estimateMax} />
        </Field>
        <Field label="التوقف التلقائي بعد (دقيقة من غير تفاعل)" name="idleMinutes" hint="احتساب وقت الدراسة بيقف بعدها.">
          <TextInput type="number" min={1} max={60} dir="ltr" className="text-left" defaultValue={course.idleMinutes} />
        </Field>
      </FormSection>

      {topics.length > 0 && (
        <div className="space-y-3">
          <div>
            <p className="font-black text-slate-800">مجالات التقييم النهائي ← الوحدات</p>
            <p className="text-sm font-medium text-slate-600">
              لما المدرب يغلط في مجال، التقرير بيقوله يراجع الوحدات المعلّمة قصاده — من غير ما يشوف الإجابات الصحيحة.
            </p>
          </div>
          {topics.map((t, ti) => (
            <fieldset key={t} className="rounded-2xl border border-slate-200 p-3">
              <legend className="px-1 text-sm font-black text-slate-800">{t}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {modules.map((m, mi) => (
                  <Checkbox
                    key={mi}
                    name={`tm_${ti}_${mi}`}
                    defaultChecked={(course.topicModules[t] ?? []).includes(mi)}
                    label={<span className="text-sm">{`${mi + 1}. ${m.title}`}</span>}
                  />
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-xs font-bold text-amber-800">
            لو رفعت نسخة جديدة وترتيب الوحدات اتغيّر، راجع الربط ده.
          </p>
        </div>
      )}

      <FormActions>
        <SubmitButton>حفظ الإعدادات</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
