import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, FormActions, Select, SubmitButton, TextInput } from '@/components/forms/Form';
import { sanctionUser } from '@/actions/aqlam';

/**
 * «عقوبة» على حساب معروف — بتتفتح تحت الصف نفسه (نص/بلاغ/نتيجة بحث).
 * الحساب بيتبعت مخفي: الإدارة مش بتكتب رقم حساب، بتختار الشخص من الصف.
 */
export function SanctionBox({ userId, label }: { userId: string; label: string }) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50 open:bg-white">
      <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-sm font-bold text-rose-800 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none">
        عقوبة على {label}
      </summary>
      <div className="border-t border-slate-200 p-4">
        <ActionForm action={sanctionUser} successMessage="اتسجّلت العقوبة." className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <Field label="النوع" name="kind" required>
            <Select name="kind" defaultValue="warning">
              <option value="warning">تحذير (بيوصله إشعار، ومابيوقفش حاجة)</option>
              <option value="suspension_7d">إيقاف ٧ أيام عن النشر والتفاعل</option>
              <option value="permanent">إيقاف دائم (تقدر ترفعه بعدين)</option>
            </Select>
          </Field>
          <Field label="السبب" name="reason" required hint="بيوصل لصاحب الحساب في إشعار، فاكتبه بأدب وبوضوح.">
            <TextInput name="reason" maxLength={500} required />
          </Field>
          <FormActions>
            <SubmitButton pendingLabel="جارٍ التسجيل…">تسجيل العقوبة</SubmitButton>
          </FormActions>
        </ActionForm>
      </div>
    </details>
  );
}
