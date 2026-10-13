import { createClient } from '@/lib/supabase/server';
import { getOrderFiles } from '@/data/domains/(shared)/files/queries';
import { normalizeKinds, normalizeMaxMb } from '@/lib/private-files';
import { PrivateFilesPanel } from './PrivateFilesPanel';
import type { ServiceOrderRow } from '@/data/domains/(shared)/service-orders/types';

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
  const [{ data: service }, filesResult] = await Promise.all([
    order.serviceId
      ? supabase.from('standalone_services').select('*').eq('id', order.serviceId).maybeSingle()
      : Promise.resolve({ data: null }),
    getOrderFiles({ id: order.id, status: order.status, completedAt: order.completedAt }),
  ]);

  const allows = service?.allows_files === true;
  const files = filesResult.success ? filesResult.data.files : [];
  const retentionDays = filesResult.success ? filesResult.data.retentionDays : 30;
  if (!allows && files.length === 0 && filesResult.success) return null;
  const uploadStatus = ['paid', 'in_progress', 'delivered'].includes(order.status);

  return (
    <PrivateFilesPanel
      owner={{ orderId: order.id }}
      files={files}
      loadError={filesResult.success ? null : filesResult.error.message}
      rules={{ kinds: normalizeKinds(service?.file_kinds), maxMb: normalizeMaxMb(service?.file_max_mb) }}
      canUpload={allows && uploadStatus && viewer !== 'admin' && filesResult.success}
      retentionDays={retentionDays}
      closedLabel="قفل الطلب"
      title="ملفات الطلب"
      otherSideLabel="من مقدّم الخدمة"
      emptyText={
        uploadStatus
          ? viewer === 'customer'
            ? 'ابعت ملفك هنا (القصة، الواجب…)، ومقدّم الخدمة هيسلّمك ملفه هنا كمان.'
            : 'مفيش ملفات لسه.'
          : 'الرفع بيتفتح بعد تأكيد الدفع.'
      }
    />
  );
}
