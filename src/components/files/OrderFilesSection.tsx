import { createClient } from '@/lib/supabase/server';
import { getOrderFiles } from '@/data/domains/private-files';
import { CLOSED_ORDER_STATUSES, normalizeKinds, normalizeMaxMb } from '@/lib/private-files';
import { PrivateFilesPanel } from './PrivateFilesPanel';
import type { ServiceOrderRow } from '@/data/domains/services';

/**
 * قسم الملفات في صفحة طلب الخدمة (ملف 20) — للعميل ومقدّم الخدمة والإدارة.
 *
 * بيظهر لو الخدمة بتقبل ملفات، أو لو فيه ملفات قديمة (الإدارة قفلت
 * الرفع بعدها). الإدارة بتشوف وبتحمّل بس.
 */
export async function OrderFilesSection({
  order,
  viewer,
}: {
  order: ServiceOrderRow;
  viewer: 'customer' | 'instructor' | 'admin';
}) {
  const supabase = await createClient();
  const [{ data: service }, { files, retentionDays }] = await Promise.all([
    order.serviceId
      ? supabase.from('standalone_services').select('*').eq('id', order.serviceId).maybeSingle()
      : Promise.resolve({ data: null }),
    getOrderFiles({ id: order.id, status: order.status, completedAt: order.completedAt }),
  ]);

  const allows = service?.allows_files === true;
  if (!allows && files.length === 0) return null;

  const closed = (CLOSED_ORDER_STATUSES as readonly string[]).includes(order.status);
  // قبل الدفع مفيش رفع — الطلب ممكن مايكملش.
  const started = !['pending', 'awaiting_verification'].includes(order.status);

  return (
    <PrivateFilesPanel
      owner={{ orderId: order.id }}
      files={files}
      rules={{ kinds: normalizeKinds(service?.file_kinds), maxMb: normalizeMaxMb(service?.file_max_mb) }}
      canUpload={allows && !closed && started && viewer !== 'admin'}
      retentionDays={retentionDays}
      closedLabel="قفل الطلب"
      title="ملفات الطلب"
      otherSideLabel="من مقدّم الخدمة"
      emptyText={
        started
          ? viewer === 'customer'
            ? 'ابعت ملفك هنا (القصة، الواجب…)، ومقدّم الخدمة هيسلّمك ملفه هنا كمان.'
            : 'مفيش ملفات لسه.'
          : 'الرفع بيتفتح بعد تأكيد الدفع.'
      }
    />
  );
}
