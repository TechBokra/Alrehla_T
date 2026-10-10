import 'server-only';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { deletePrivateAssets } from '@/lib/cloudinary-admin';
import { CLOSED_ORDER_STATUSES, fileExpired } from '@/lib/private-files';
import { getSiteSettings } from './content';

/**
 * المهمة اليومية (ملف 20): مسح ملفات الطلبات ومساحة الكتابة اللي مدتها
 * خلصت — نفس قاعدة العرض بالظبط (`fileExpired`): المدة من قفل الطلب أو
 * مراجعة المستند، أو من الرفع لو بعدها.
 *
 * الملف بيتمسح من Cloudinary، والصف بيفضل وعليه `deleted_at` — عشان
 * الشاشة تقول «اتمسح» بدل ما الملف يختفي من غير تفسير.
 *
 * ⚠️ لحد ٣٠٠ ملف في المرة — الباقي بكرة.
 */
export async function runPrivateFilesCleanup(now = new Date()): Promise<
  { ok: true; checked: number; deleted: number } | { ok: false; error: string }
> {
  if (!isAdminApiConfigured()) return { ok: false, error: 'مفتاح الخدمة مش متظبط على الخادم' };
  const admin = createAdminClient();
  const days = (await getSiteSettings()).fileRetentionDays;

  const { data: files, error } = await admin
    .from('private_files')
    .select('id, order_id, document_id, public_id, resource_type, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) {
    // قبل ملف 20 الجدول مش موجود — مفيش حاجة تتعمل.
    if (error.code === '42P01' || error.code === 'PGRST205') return { ok: true, checked: 0, deleted: 0 };
    return { ok: false, error: error.message };
  }
  if (!files?.length) return { ok: true, checked: 0, deleted: 0 };

  const orderIds = [...new Set(files.map((f) => f.order_id).filter(Boolean))] as string[];
  const docIds = [...new Set(files.map((f) => f.document_id).filter(Boolean))] as string[];
  const [orders, docs] = await Promise.all([
    orderIds.length
      ? admin.from('service_orders').select('id, status, completed_at').in('id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    docIds.length
      ? admin.from('portfolio_documents').select('id, status, updated_at').in('id', docIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (orders.error || docs.error) return { ok: false, error: 'تعذّر قراءة الطلبات والمستندات' };

  const orderState = new Map(
    (orders.data ?? []).map((o: { id: string; status: string; completed_at: string | null }) => [
      o.id,
      { closed: (CLOSED_ORDER_STATUSES as readonly string[]).includes(o.status), closedAt: o.completed_at },
    ]),
  );
  const docState = new Map(
    (docs.data ?? []).map((d: { id: string; status: string; updated_at: string | null }) => [
      d.id,
      { closed: d.status === 'reviewed', closedAt: d.status === 'reviewed' ? d.updated_at : null },
    ]),
  );

  const expired = files.filter((f) => {
    const owner = f.order_id ? orderState.get(f.order_id) : docState.get(f.document_id as string);
    return owner ? fileExpired({ createdAt: f.created_at }, owner, days, now) : false;
  });

  let deleted = 0;
  for (const type of ['raw', 'image'] as const) {
    const batch = expired.filter((f) => (f.resource_type === 'image' ? 'image' : 'raw') === type);
    for (let i = 0; i < batch.length; i += 100) {
      const chunk = batch.slice(i, i + 100);
      const result = await deletePrivateAssets(type, chunk.map((f) => f.public_id));
      if (!result.ok) {
        console.error('private files cleanup: delete failed', result.error);
        continue;
      }
      const gone = new Set(result.data.deleted);
      const ids = chunk.filter((f) => gone.has(f.public_id)).map((f) => f.id);
      if (ids.length) {
        await admin.from('private_files').update({ deleted_at: now.toISOString() }).in('id', ids);
        deleted += ids.length;
      }
    }
  }
  return { ok: true, checked: files.length, deleted };
}
