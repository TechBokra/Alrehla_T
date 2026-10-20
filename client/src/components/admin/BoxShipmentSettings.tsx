import React from 'react';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, SubmitButton, TextInput } from '@/components/forms/Form';
import { saveBoxShipmentLeadDays } from '@/actions/work-tasks';
import { BOX_LEAD_DAYS_MAX, BOX_LEAD_DAYS_MIN } from '@/lib/box-schedule';

/**
 * الشحنات الشهرية لصندوق الرحلة: اشتراك ٣ أو ٦ أو ١٢ شهر بيتولّد له شحنة لكل شهر، ولكل شحنة مهمة
 * مستقلة بتتفتح قبل موعدها بعدد الأيام ده. موعد المهمة هو موعد الشحنة نفسه، والمسؤولون من مرحلة
 * «شحنة الشهر» تحت (وإلا مسؤولو «التنفيذ»).
 */
export function BoxShipmentSettings({ leadDays }: { leadDays: number }) {
  return (
    <section aria-labelledby="box-ship-h" className="space-y-3 rounded-2xl border border-slate-300 bg-slate-50 p-4">
      <h3 id="box-ship-h" className="font-black text-slate-800">
        الشحنات الشهرية
      </h3>
      <p className="text-xs font-medium leading-6 text-slate-500">
        كل شحنة في الاشتراك ليها مهمة لوحدها بموعد الشحنة نفسه، وتظهر في «مهامي» قبل الموعد بالأيام دي. الشحنة الأولى
        بتتفتح مهمتها لحظة تفعيل الاشتراك. المهمة بتتقفل أول ما الشحنة تتشحن أو تتسلّم.
      </p>
      <ActionForm
        action={saveBoxShipmentLeadDays}
        successMessage="اتحفظ عدد الأيام."
        className="flex flex-wrap items-end gap-3"
      >
        <div className="w-48">
          <Field
            label="فتح المهمة قبل الموعد بـ (أيام)"
            name="leadDays"
            hint={`من ${BOX_LEAD_DAYS_MIN} لـ${BOX_LEAD_DAYS_MAX}`}
          >
            <TextInput name="leadDays" inputMode="numeric" dir="ltr" defaultValue={String(leadDays)} maxLength={2} />
          </Field>
        </div>
        <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ</SubmitButton>
      </ActionForm>
    </section>
  );
}
