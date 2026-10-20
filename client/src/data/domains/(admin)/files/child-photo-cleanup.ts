import 'server-only';
import { isAdminApiConfigured, createAdminClient } from '@/lib/supabase/admin';
import { deletePrivateAssets } from '@/lib/cloudinary-admin';
import {
  CHILD_PHOTO_FIELDS,
  isChildPhotoId,
  normalizeChildPhotoDays,
  planChildPhotoSweep,
  type ChildPhotoField,
  type OrderPhotoRow,
} from '@/lib/child-photos';
import { readChildPhotoRetentionDays } from '@/data/domains/(shared)/files/settings';

/**
 * المهمة اليومية: مسح صور الأطفال اللي خلصت مدتها.
 *
 * ── اللي كان ─────────────────────────────────────────────────
 *
 * ⚠️ **مافيش حاجة كانت بتمسح صور الأطفال.** مهمة الملفات الخاصة
 *    بتمسح اللي مسجّل في جدول `private_files`، وصور التخصيص
 *    متخزّنة جوّه `order_items.customization_data` — برّه الجدول
 *    تمامًا. يعني صورة طفل بتفضل على السيرفر للأبد.
 *
 * ── الترتيب هنا مقصود ───────────────────────────────────────
 *
 * ١. نقرا الطلبات وصورها.
 * ٢. نبني الخطة (`planChildPhotoSweep` — دالة نقية ومختبَرة).
 * ٣. **نمسح من Cloudinary الأول.**
 * ٤. وبعدين نفضّي الخانات في القاعدة — **وبس للصور اللي اتمسحت
 *    فعلًا**.
 *
 * ⚠️ **ليه المسح قبل القاعدة؟** لو فضّينا القاعدة الأول ومسح
 *    Cloudinary فشل، تبقى الصورة **موجودة على السيرفر ومفيش
 *    أي سجل بيشاور عليها** — صورة طفل يتيمة مستحيل نلاقيها بعد
 *    كده. بالترتيب ده، فشل القاعدة بيسيب خانة بتشاور لصورة
 *    ممسوحة (الشاشة بتقول «الصورة اتحذفت»)، والتشغيلة الجاية
 *    بتكمّل.
 */

export type ChildPhotoCleanupResult = {
  ok: boolean;
  error?: string;
  /** عناصر الطلبات اللي فيها صور. */
  scanned: number;
  /** صور الخطة. */
  planned: number;
  /** اتمسحت من Cloudinary. */
  deleted: number;
  /** خانات اتفضّت في القاعدة. */
  cleared: number;
  /** صور استنّت لأن طلبًا تانيًا لسه محتاجها. */
  heldBack: number;
  retentionDays: number;
};

const EMPTY = (over: Partial<ChildPhotoCleanupResult> = {}): ChildPhotoCleanupResult => ({
  ok: true,
  scanned: 0,
  planned: 0,
  deleted: 0,
  cleared: 0,
  heldBack: 0,
  retentionDays: 0,
  ...over,
});

type ItemRow = {
  id: string;
  order_id: string;
  customization_data: Record<string, unknown> | null;
  orders: {
    status: string;
    created_at: string | null;
    updated_at: string | null;
    delivered_at: string | null;
    electronic_sent_at: string | null;
  } | null;
};

export async function runChildPhotoCleanup(now: Date = new Date()): Promise<ChildPhotoCleanupResult> {
  // ⚠️ المهمة بتعدّل صفوف طلبات وبتمسح ملفات — محتاجة مفتاح الخدمة.
  //    وغيابه **بيوقف المهمة**، مابيخلّيهاش تمشي ناقصة.
  if (!isAdminApiConfigured()) {
    return EMPTY({ ok: false, error: 'مفتاح الإدارة غير مضبوط — المهمة متوقفة' });
  }

  const admin = createAdminClient();

  /* ⚠️ **قراءة الإعداد قبل أي مسح، وفشلها بيوقف المهمة** — نفس
   *    قاعدة مهمة الملفات الخاصة المكتوبة في `files/settings.ts`:
   *    مهمة بتمسح ماتفترضش مدة. لو رجّعنا «٧ أيام» افتراضيًا
   *    ومعرفناش الإدارة ظبطت كام، نبقى بنمسح صور أطفال بمدة
   *    مش متأكدين منها. */
  let retentionDays: number;
  try {
    retentionDays = normalizeChildPhotoDays(await readChildPhotoRetentionDays(admin));
  } catch (err) {
    console.error('child-photo cleanup: settings read failed', err);
    return EMPTY({ ok: false, error: 'تعذّر قراءة مدة حفظ الصور — المهمة متوقفة' });
  }

  const { data, error } = await admin
    .from('order_items')
    .select(
      'id, order_id, customization_data, orders!inner(status, created_at, updated_at, delivered_at, electronic_sent_at)',
    )
    // ⚠️ الفلتر ده بيقلّل الصفوف، **ومابيحكمش**: الحكم في الدالة
    //    النقية. العنصر اللي مفيهوش صورة مش مشكلة لو عدّى.
    .not('customization_data', 'is', null);

  if (error) {
    console.error('child-photo cleanup: read failed', error);
    return EMPTY({ ok: false, error: `تعذّر قراءة الطلبات: ${error.message}`, retentionDays });
  }

  const rows: OrderPhotoRow[] = [];
  for (const item of (data ?? []) as unknown as ItemRow[]) {
    const custom = item.customization_data ?? {};
    const photos: Partial<Record<ChildPhotoField, string>> = {};
    for (const field of CHILD_PHOTO_FIELDS) {
      const value = custom[field];
      const publicId =
        value && typeof value === 'object'
          ? (value as { publicId?: unknown }).publicId
          : undefined;
      if (isChildPhotoId(publicId)) photos[field] = publicId;
    }
    if (Object.keys(photos).length === 0) continue;

    rows.push({
      itemId: item.id,
      orderId: item.order_id,
      status: item.orders?.status ?? '',
      createdAt: item.orders?.created_at ?? null,
      updatedAt: item.orders?.updated_at ?? null,
      deliveredAt: item.orders?.delivered_at ?? null,
      electronicSentAt: item.orders?.electronic_sent_at ?? null,
      photos,
    });
  }

  const plan = planChildPhotoSweep(rows, now, retentionDays);
  const base = EMPTY({
    scanned: rows.length,
    planned: plan.publicIds.length,
    heldBack: plan.heldBack.length,
    retentionDays,
  });

  if (plan.publicIds.length === 0) return base;

  // ── ٣) Cloudinary ──────────────────────────────────────────
  const result = await deletePrivateAssets('image', plan.publicIds);
  if (!result.ok) {
    console.error('child-photo cleanup: cloudinary delete failed', result.error);
    return { ...base, ok: false, error: result.error };
  }
  const deleted = new Set(result.data.deleted);

  // ── ٤) تفضية الخانات — للصور اللي اتمسحت فعلًا وبس ─────────
  let cleared = 0;
  for (const planned of plan.items) {
    const row = rows.find((r) => r.itemId === planned.itemId);
    if (!row) continue;

    const gone = planned.fields.filter((f) => {
      const id = row.photos[f];
      return typeof id === 'string' && deleted.has(id);
    });
    if (gone.length === 0) continue;

    const item = (data ?? []).find((d) => (d as unknown as ItemRow).id === planned.itemId) as
      | unknown as ItemRow
      | undefined;
    const next: Record<string, unknown> = { ...(item?.customization_data ?? {}) };

    for (const field of gone) {
      /* ⚠️ **بنسيب علامة، مابنشيلش الخانة.**
       *
       *    لو شلناها، شاشة الطلب في اللوحة بتبان كأن ولي الأمر
       *    مارفعش صورة أصلًا — والفريق يسأله يرفع تاني. العلامة
       *    بتخلّي الشاشة تقول «الصورة اتحذفت بعد انتهاء الطلب»،
       *    وده فرق كبير في محادثة مع عميل. */
      next[field] = { deletedAt: now.toISOString() };
    }

    const { data: saved, error: updateError } = await admin
      .from('order_items')
      .update({ customization_data: next as never })
      .eq('id', planned.itemId)
      .select('id');

    if (updateError) {
      console.error('child-photo cleanup: clear failed', planned.itemId, updateError);
      continue;
    }
    // صفر صفوف من غير خطأ = الصلاحيات رفضت بصمت (قاعدة «و»).
    if (!saved || saved.length === 0) {
      console.error('child-photo cleanup: update matched no rows', planned.itemId);
      continue;
    }
    cleared += gone.length;
  }

  return { ...base, deleted: deleted.size, cleared };
}
