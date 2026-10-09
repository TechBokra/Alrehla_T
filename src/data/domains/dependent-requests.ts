import { createClient } from '@/lib/supabase/server';

/**
 * قراءة طلبات الأبناء.
 *
 * صلاحيات القاعدة هي اللي بتحدد مين يشوف إيه: ولي الأمر يشوف طلبات
 * أبنائه، والطفل يشوف طلباته هو. الكود هنا مش بيفلتر بالدور — القاعدة
 * بتعمل ده (`can_see_dependent_request`).
 */
export type DependentRequestRow = {
  id: string;
  childProfileId: string;
  childName: string;
  kind: 'service' | 'package' | 'name_change' | 'product';
  /** اسم المطلوب: الباقة أو الخدمة، أو الاسم الجديد لطلب تغيير الاسم. */
  targetName: string;
  /** الاسم اللي الطفل طلبه — لطلبات `name_change` وبس (ملف SQL 93). */
  requestedName: string | null;
  providerName: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  guardianNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

const SELECT =
  'id, child_profile_id, kind, service_id, provider_id, package_id, instructor_id, requested_name, note, status, guardian_note, created_at, decided_at, child_profiles(full_name), standalone_services(name), creative_writing_packages(name), service_providers(display_name)';

function map(rows: unknown[]): DependentRequestRow[] {
  return (rows as Record<string, any>[]).map((row) => ({
    id: row.id,
    childProfileId: row.child_profile_id,
    childName: row.child_profiles?.full_name ?? 'فرد العائلة',
    kind:
      row.kind === 'package' || row.kind === 'name_change' || row.kind === 'product' ? row.kind : 'service',
    targetName:
      row.kind === 'name_change'
        ? (row.requested_name ?? 'اسم جديد')
        : row.kind === 'product'
          ? (row.personalized_products?.name ?? 'قصة مابقتش معروضة')
        : row.kind === 'package'
          ? (row.creative_writing_packages?.name ?? 'باقة محذوفة')
          : (row.standalone_services?.name ?? 'خدمة محذوفة'),
    requestedName: row.requested_name ?? null,
    providerName: row.service_providers?.display_name ?? null,
    note: row.note ?? null,
    status: row.status,
    guardianNote: row.guardian_note ?? null,
    createdAt: row.created_at,
    decidedAt: row.decided_at ?? null,
  }));
}

/** كل الطلبات اللي الداخل دلوقتي مسموح له يشوفها. */
export async function getDependentRequests(): Promise<DependentRequestRow[]> {
  const supabase = await createClient();
  // ملف 16 ضاف «قصة» (`product_id`). قبله العمود مش موجود — فبنرجع للقديم.
  const run = (cols: string) =>
    supabase.from('dependent_requests').select(cols).order('created_at', { ascending: false });
  let { data, error } = await run(`${SELECT}, product_id, personalized_products(name)`);
  if (error) ({ data, error } = await run(SELECT));

  if (error || !data) {
    if (error) console.error('Error loading dependent requests', error);
    return [];
  }
  return map(data);
}

/** عدّاد المعلّق — بيظهر جنب رابط «طلبات الأبناء». */
export async function countPendingDependentRequests(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('dependent_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) return 0;
  return count ?? 0;
}
