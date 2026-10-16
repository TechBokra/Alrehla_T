import { ActionForm } from '@/components/dashboard/ActionForm';
import { SubmitButton } from '@/components/forms/Form';
import { getStudioOrderPanel } from '@/data/domains/(admin)/studio/queries';
import { startStudioProject } from '@/actions/studio';

/**
 * بدء مشروع قصة يدويًا لبند مخصّص من غير مشروع (مسؤول الإنتاج بس).
 *
 * حالة المشاريع الموجودة ومسؤولها وموعدها بقت في «رحلة الطلب» فوق في الصفحة
 * (`OrderJourney`) — اللوحة دي بتظهر بس لو فيه بند ينفع يتبدأ.
 */
export async function StudioOrderPanel({
  orderId,
  paid,
  canManage,
}: {
  orderId: string;
  paid: boolean;
  canManage: boolean;
}) {
  const data = await getStudioOrderPanel(orderId);
  const canStart = canManage && paid && data.mode === 'on' && data.startable.length > 0;
  if (!canStart) return null;

  return (
    <section aria-labelledby="studio-h" className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h4 id="studio-h" className="font-bold text-slate-800">
        مشروع القصة
      </h4>
      {canStart &&
        data.startable.map((i) => (
          <ActionForm
            key={i.orderItemId}
            action={startStudioProject}
            successMessage="اتفتح مشروع القصة."
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <input type="hidden" name="orderItemId" value={i.orderItemId} />
            <input type="hidden" name="orderId" value={orderId} />
            <p className="text-sm font-medium text-slate-600">بند مخصّص من غير مشروع.</p>
            <SubmitButton pendingLabel="جارٍ الفتح…">ابدأ مشروع قصة</SubmitButton>
          </ActionForm>
        ))}
    </section>
  );
}
