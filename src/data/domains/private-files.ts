import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { CLOSED_ORDER_STATUSES, fileExpiryDate } from '@/lib/private-files';
import { getSiteSettings } from './content';

/** ملف للعرض في الشاشة — من غير رقمه على Cloudinary (التحميل بأكشن). */
export type PrivateFileView = {
  id: string;
  fileName: string;
  bytes: number;
  createdAt: string;
  /** رفعه الطرف التاني (مقدّم الخدمة / المدرب). */
  fromProvider: boolean;
  uploadedByMe: boolean;
  /** يقدر يمسحه: رافعه، أو ولي أمر صاحب المستند الأصغر من ١٢. */
  canDelete: boolean;
  deleted: boolean;
  /** هيتمسح إمتى (ISO) — `null` لو الطلب لسه شغال. */
  expiresAt: string | null;
};

type Row = {
  id: string;
  file_name: string;
  bytes: number;
  created_at: string;
  is_delivery: boolean;
  uploader_profile_id: string;
  deleted_at: string | null;
};

/**
 * ملفات طلب أو مستند — بجلسة المستخدم، فـRLS بيرجّعها لأطرافه بس.
 *
 * ⚠️ قبل ملف 20 الجدول مش موجود ← قايمة فاضية (مش خطأ في الصفحة).
 */
async function listFiles(
  column: 'order_id' | 'document_id',
  id: string,
  owner: { closed: boolean; closedAt?: string | null },
  /** ولي الأمر بيتحكّم في محتوى صاحب المستند (أصغر من ١٢). */
  manageAll = false,
): Promise<{ files: PrivateFileView[]; retentionDays: number }> {
  const supabase = await createClient();
  const [{ data: { user } }, settings, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    getSiteSettings(),
    supabase
      .from('private_files')
      .select('id, file_name, bytes, created_at, is_delivery, uploader_profile_id, deleted_at')
      .eq(column, id)
      .order('created_at', { ascending: true }),
  ]);
  const retentionDays = settings.fileRetentionDays;
  if (error || !data) return { files: [], retentionDays };

  return {
    retentionDays,
    files: (data as Row[]).map((f) => ({
      id: f.id,
      fileName: f.file_name,
      bytes: f.bytes,
      createdAt: f.created_at,
      fromProvider: f.is_delivery,
      uploadedByMe: f.uploader_profile_id === user?.id,
      canDelete: f.uploader_profile_id === user?.id || manageAll,
      deleted: Boolean(f.deleted_at),
      expiresAt: fileExpiryDate({ createdAt: f.created_at }, owner, retentionDays)?.toISOString() ?? null,
    })),
  };
}

export function getOrderFiles(order: { id: string; status: string; completedAt?: string | null }) {
  const closed = (CLOSED_ORDER_STATUSES as readonly string[]).includes(order.status);
  return listFiles('order_id', order.id, { closed, closedAt: order.completedAt ?? null });
}

export function getDocumentFiles(
  doc: { id: string; status: string; updatedAt?: string | null },
  options: { manageAll?: boolean } = {},
) {
  // المستند «بيتقفل» لما المدرب يراجعه.
  const closed = doc.status === 'reviewed';
  return listFiles('document_id', doc.id, { closed, closedAt: closed ? doc.updatedAt ?? null : null }, options.manageAll);
}
