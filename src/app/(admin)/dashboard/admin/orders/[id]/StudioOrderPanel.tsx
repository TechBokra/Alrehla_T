import Link from 'next/link';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { SubmitButton } from '@/components/forms/Form';
import { StatusBadge } from '@/components/StatusBadge';
import { getStudioOrderPanel, getStudioStages } from '@/data/domains/(admin)/studio/queries';
import { startStudioProject } from '@/actions/studio';
import { statusLabel, statusTone } from '@/lib/studio';

/**
 * لوحة «مشروع القصة» في صفحة الطلب — رابط للمشروع، وبدء يدوي لمسؤول الإنتاج.
 *
 * بتتعرض بس لو فيه مشروع للطلب، أو لو الاستوديو شغّال وفيه بند ينفع يتبدأ —
 * فالطلبات العادية مابتشوفش حاجة (ومفيش استعلام ثقيل: 3 استعلامات صغيرة).
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
  const [data, stages] = await Promise.all([getStudioOrderPanel(orderId), getStudioStages()]);
  const canStart = canManage && paid && data.mode === 'on' && data.startable.length > 0;
  if (data.projects.length === 0 && !canStart) return null;

  return (
    <section aria-labelledby="studio-h" className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h4 id="studio-h" className="font-bold text-slate-800">
        مشروع القصة
      </h4>
      {data.projects.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge label={statusLabel(p.status, stages.labels)} type={statusTone(p.status)} />
          <Link href={`/dashboard/admin/studio/${p.id}`} className="text-sm font-bold text-slate-700 underline">
            فتح المشروع في الاستوديو
          </Link>
        </div>
      ))}
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
