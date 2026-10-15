import React from 'react';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, Field, Select, SubmitButton, TextInput } from '@/components/forms/Form';
import { saveTaskStep } from '@/actions/work-tasks';
import { TASK_STEP_OWNER_LABELS, type TaskStep, type TaskStepOwner } from '@/lib/work-tasks';

const STUDIO_OWNERS: Exclude<TaskStepOwner, 'rule'>[] = ['editor', 'art_lead', 'manager'];

/**
 * محرّر مراحل نوع واحد: الاسم · الشرح · المهلة بالساعات · (الاستوديو: صاحب المرحلة وظهور
 * التبويب). كل مرحلة فورم لوحدها ببتحفظ لوحدها، وخطأها بيظهر فوقها.
 *
 * ⚠️ المهلة بتتطبّق على المهام اللي **بتدخل المرحلة بعد الحفظ** — المهام المفتوحة بتفضل بموعدها
 *    (وتتعدّل من تفاصيل المهمة). المهلة الفاضية = من غير موعد.
 */
export function TaskStepsEditor({ steps, line }: { steps: TaskStep[]; line: TaskStep['line'] }) {
  const isStudio = line === 'studio';
  if (steps.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
        مفيش مراحل متسجّلة — محتاج تطبيق migration «مواعيد المهام» على قاعدة البيانات.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {steps.map((s) => {
        const generic = s.step === 'payment' || s.step === 'fulfilment';
        return (
          <li key={s.step} className="rounded-2xl border border-slate-200 bg-white p-4">
            <ActionForm action={saveTaskStep} successMessage="اتحفظت." className="space-y-4">
              <input type="hidden" name="line" value={s.line} />
              <input type="hidden" name="step" value={s.step} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span dir="ltr" className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">
                  {s.step}
                </span>
                {generic && !isStudio && (
                  <span className="text-xs font-medium text-slate-500">
                    {s.step === 'payment'
                      ? 'مهلة مراجعة الدفع'
                      : 'المهلة الافتراضية لو حالة الطلب الدقيقة مالهاش مهلة'}
                  </span>
                )}
              </div>
              <div className={`grid grid-cols-1 gap-4 ${isStudio ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                <Field label="اسم المرحلة" name="label" required className={isStudio ? 'md:col-span-2' : 'md:col-span-2'}>
                  <TextInput name="label" defaultValue={s.label} maxLength={60} />
                </Field>
                <Field label="المهلة (ساعات)" name="slaHours" hint="فاضية = من غير موعد">
                  <TextInput
                    name="slaHours"
                    inputMode="decimal"
                    dir="ltr"
                    defaultValue={s.slaHours === null ? '' : String(s.slaHours)}
                    placeholder="مثال: 24"
                  />
                </Field>
                {isStudio && (
                  <Field label="صاحب المرحلة" name="ownerKind" required>
                    <Select name="ownerKind" defaultValue={s.ownerKind === 'rule' ? 'manager' : s.ownerKind}>
                      {STUDIO_OWNERS.map((o) => (
                        <option key={o} value={o}>
                          {TASK_STEP_OWNER_LABELS[o]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="شرح قصير للمرحلة" name="hint" className="md:col-span-full">
                  <TextInput name="hint" defaultValue={s.hint ?? ''} maxLength={300} />
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {isStudio ? (
                  <Checkbox
                    name="showTab"
                    defaultChecked={s.showTab}
                    label="أظهر تبويب المرحلة في صندوق الاستوديو"
                    hint="التبويب اللي فيه مشاريع بيظهر دايمًا حتى لو مخفي."
                  />
                ) : (
                  <span />
                )}
                <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ</SubmitButton>
              </div>
            </ActionForm>
          </li>
        );
      })}
    </ul>
  );
}
