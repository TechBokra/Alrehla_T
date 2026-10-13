import type { CreativeService, InstructorServiceOffer } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { normalizeMaxMb, normalizeKinds } from '@/lib/private-files';

/**
 * Standalone creative services ("الخدمات الإبداعية").
 *
 * This module reads from the database only — it has no mock fallback by
 * design. The services page used to keep its own hardcoded copy of this
 * list, the two drifted apart, and a placeholder entry ended up live on
 * the site. One source of truth, deliberately.
 */

export async function getStandaloneServices(options?: {
  /**
   * شاشات الإدارة بس. الموقع العام والمدرب بيشوفوا المفعّل بس، عشان
   * خدمة موقوفة ما تتطلبش وما تتعرضش للعميل.
   */
  includeInactive?: boolean;
}): Promise<CreativeService[]> {
  // ⚡ الموقع العام بعميل الزائر (من غير كوكيز) — عشان صفحة الخدمات تتخزّن
  //    وتتبعت من Vercel على طول بدل ما تتبني مع كل زيارة. الإدارة بالجلسة.
  const supabase = options?.includeInactive ? await createClient() : createPublicClient();
  // ⚠️ `*` عن قصد: خانات ملف 09 (الصورة والنماذج…) لو اتطلبت بالاسم قبل ما
  //    الملف يتشغّل، الاستعلام كله بيقع ← الصفحة تقول «مفيش خدمات».
  let query = supabase.from('standalone_services').select('*');

  if (!options?.includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    description: row.description ?? '',
    category: row.category ?? undefined,
    priceType: row.price_type === 'starts_from' ? 'starts_from' : 'fixed',
    sortOrder: row.sort_order ?? undefined,
    isActive: row.is_active,
    coverImageUrl: row.cover_image_url || undefined,
    galleryImageUrls: row.gallery_image_urls?.length ? row.gallery_image_urls : undefined,
    longDescription: row.long_description || undefined,
    deliverables: row.deliverables?.length ? row.deliverables : undefined,
    requirements: row.requirements || undefined,
    deliveryDays: row.delivery_days ?? undefined,
    // ملف 20 — قبله الخانات مش موجودة = الرفع مقفول.
    allowsFiles: row.allows_files === true,
    fileMaxMb: normalizeMaxMb(row.file_max_mb),
    fileKinds: normalizeKinds(row.file_kinds),
  }));
}

/**
 * Every offer belonging to one instructor, whatever its status.
 * Used by the admin screen and by the instructor's own dashboard.
 *
 * بتقرا من `provider_services` مش من `instructor_services`.
 *
 * ليه: الجدولين كانوا شغالين مع بعض، والبيع بيمر من `provider_services`
 * وحده. فالشاشة كانت بتعرض للمدرب عروضًا «معتمدة ومفعّلة» من الجدول
 * القديم، والعميل لا يشوفها ولا يقدر يطلبها. دلوقتي الشاشة بتعرض اللي
 * العميل شايفه فعلًا.
 */
export async function getInstructorServiceOffers(
  instructorId: string
): Promise<InstructorServiceOffer[]> {
  const supabase = await createClient();

  let { data: provider } = await supabase
    .from('service_providers')
    .select('id')
    .eq('instructor_id', instructorId)
    .maybeSingle();

  // مدرب اتعمل له صف «فرد» قبل ما يبقى مدرب (#6BJL) — عروضه هناك.
  if (!provider) {
    const { data: inst } = await supabase.from('instructors').select('user_id').eq('id', instructorId).maybeSingle();
    if (inst?.user_id) {
      ({ data: provider } = await supabase
        .from('service_providers')
        .select('id')
        .eq('user_id', inst.user_id)
        .limit(1)
        .maybeSingle());
    }
  }

  // مدرب لسه ملوش صف مقدّم خدمة = مفيش عروض. الصف بيتعمل أول ما يقدّم
  // عرض (في `actions/instructor-services.ts`).
  if (!provider) return [];

  const { data, error } = await supabase
    .from('provider_services')
    .select('*')
    .eq('provider_id', provider.id);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    instructorId,
    serviceId: row.service_id,
    requestedPrice: row.requested_price ?? undefined,
    approvedPrice: row.approved_price ?? undefined,
    status: row.status as InstructorServiceOffer['status'],
    isActive: row.is_active,
    adminNotes: row.admin_notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * عدد مقدّمي الخدمة اللي **العميل يقدر يطلب منهم فعلًا** لكل خدمة.
 *
 * ⚠️ (#SGCB في اختبار الإدارة) «تفعيل» الخدمة لوحده مابيخلّيهاش تتطلب:
 *    لازم مقدّم مفعّل عارضها بسعر معتمد — وإلا بتظهر «قريبًا». الرقم ده
 *    بيظهر في شاشة الخدمات عشان الإدارة تعرف من غير ما تجرّب كعميل.
 *    نفس شروط `getProvidersForService`.
 */
export async function getOrderableProviderCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('provider_services')
    .select('service_id, approved_price, service_providers(status)')
    .eq('status', 'approved')
    .eq('is_active', true);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const provider = row.service_providers as unknown as { status: string } | null;
    if (!provider || provider.status !== 'active' || row.approved_price == null) continue;
    counts[row.service_id] = (counts[row.service_id] ?? 0) + 1;
  }
  return counts;
}
