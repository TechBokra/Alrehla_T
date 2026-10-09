import 'server-only';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { createPublicClient } from '@/lib/supabase/public';
import { deleteAssets, isCloudinaryAdminConfigured, listFolderAssets } from '@/lib/cloudinary-admin';
import { getMediaScan } from '@/data/domains/media';
import { getSiteSettings } from '@/data/domains/content';
import { notifyAdmins } from '@/lib/notifications';
import {
  MEDIA_ORPHANS_KEY,
  normalizeLedger,
  planCleanup,
  type OrphanLedger,
} from '@/lib/media-cleanup';

/**
 * تشغيل المسح التلقائي مرة (المهمة اليومية). التفاصيل والحراسات في
 * `lib/media-cleanup`.
 *
 * ⚠️ بترجّع ولا بترمي: المهمة بتسجّل النتيجة، وأي خطوة فشلت بتوقف
 *    المسح (مش بتكمّل على نص معلومة).
 */
export type CleanupRun =
  | { ok: true; tracked: number; deleted: string[]; skipped?: string }
  | { ok: false; error: string };

/** سجل «متسابة من إمتى» — للشاشة (قراءة بس). */
export async function getOrphanLedger(): Promise<OrphanLedger> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', MEDIA_ORPHANS_KEY)
    .maybeSingle();
  return normalizeLedger(data?.value);
}

export async function runMediaCleanup(now = new Date()): Promise<CleanupRun> {
  if (!isAdminApiConfigured()) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY غير موجود' };
  if (!isCloudinaryAdminConfigured()) return { ok: false, error: 'مفاتيح Cloudinary ناقصة' };

  const settings = (await getSiteSettings()).mediaCleanup;

  const listed = await listFolderAssets();
  if (!listed.ok) return { ok: false, error: listed.error };
  const scan = await getMediaScan();
  if (!scan.complete) {
    return { ok: true, tracked: 0, deleted: [], skipped: `الفحص ناقص: ${scan.failed.join('، ')}` };
  }

  const assets = listed.data.assets;
  const orphanIds = assets.filter((a) => !scan.usage.has(a.publicId)).map((a) => a.publicId);

  const admin = createAdminClient();
  const { data: row, error: readError } = await admin
    .from('site_settings')
    .select('value')
    .eq('key', MEDIA_ORPHANS_KEY)
    .maybeSingle();
  if (readError) return { ok: false, error: `تعذّر قراءة السجل: ${readError.message}` };

  const plan = planCleanup({
    orphanIds,
    ledger: normalizeLedger(row?.value),
    days: settings.days,
    now,
  });

  const save = async (ledger: OrphanLedger) =>
    admin
      .from('site_settings')
      .upsert({ key: MEDIA_ORPHANS_KEY, value: ledger as never }, { onConflict: 'key' });

  // العدّاد بيشتغل دايمًا — حتى لو المسح مقفول — عشان الشاشة تقول
  // «متسابة من إمتى» ولما المسح يتفتح مايبدأش من الصفر.
  const { error: saveError } = await save(plan.ledger);
  if (saveError) return { ok: false, error: `تعذّر حفظ السجل: ${saveError.message}` };

  const tracked = Object.keys(plan.ledger).length;
  if (!settings.enabled) return { ok: true, tracked, deleted: [], skipped: 'المسح التلقائي مقفول من الإعدادات' };
  if (listed.data.truncated) return { ok: true, tracked, deleted: [], skipped: 'قايمة الصور أكبر من الحد' };
  if (assets.length > 0 && orphanIds.length > assets.length / 2) {
    return {
      ok: true,
      tracked,
      deleted: [],
      skipped: 'أكتر من نص الصور متسابة — محتاجة مراجعة بإيد من «مكتبة الوسائط»',
    };
  }
  if (plan.due.length === 0) return { ok: true, tracked, deleted: [] };

  const result = await deleteAssets(plan.due);
  if (!result.ok) return { ok: false, error: result.error };
  const deleted = result.data.deleted;

  const remaining = { ...plan.ledger };
  for (const id of deleted) delete remaining[id];
  await save(remaining);

  // الأثر: أرقام الصور نفسها — زي الحذف من الشاشة.
  const { error: auditError } = await admin.from('audit_logs').insert({
    actor_profile_id: null,
    action: 'مسح تلقائي لصور متسابة',
    entity_type: 'media',
    entity_id: null,
    metadata: { count: deleted.length, days: settings.days, publicIds: deleted } as never,
  });
  if (auditError) console.error('media-cleanup: audit failed', auditError);

  if (deleted.length > 0) {
    await notifyAdmins({
      title: `اتمسح ${deleted.length} صورة متسابة تلقائيًا`,
      message: `صور فضلت مش مستخدمة في أي مكان ${settings.days} يوم. الأرقام في سجل التدقيق.`,
      link: '/dashboard/admin/media',
    });
  }

  return { ok: true, tracked: Object.keys(remaining).length, deleted };
}
