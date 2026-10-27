import { createClient } from '@/lib/supabase/server';
import { OFFER_REQUEST_FILTER, offerRequestKind, type OfferRequestKind } from '@/lib/offer-requests';

/**
 * طلبات تقديم الخدمات — كل اللي مستني قرار، في شاشة واحدة.
 *
 * قبل كده المراجعة كانت جوّه صفحة كل مدرب، والعدّاد في الرئيسية كان
 * بيودّي لقايمة المدربين — فالإدارة ماكانتش تعرف مين اللي طالب (طلب تامر، ٢٧ أكتوبر).
 */
export type OfferRequest = {
  id: string;
  kind: OfferRequestKind;
  providerId: string;
  providerKind: 'instructor' | 'individual' | 'platform' | string;
  providerName: string;
  instructorId: string | null;
  serviceId: string;
  serviceName: string;
  catalogPrice: number;
  requestedPrice: number | null;
  approvedPrice: number | null;
  isActive: boolean;
  adminNotes: string | null;
  /** آخر تحديث للعرض — تقريبًا وقت الطلب. */
  since: string;
};

export async function getOfferRequests(): Promise<OfferRequest[]> {
  const supabase = await createClient();

  const { data: offers } = await supabase
    .from('provider_services')
    .select('id, provider_id, service_id, requested_price, approved_price, status, is_active, admin_notes, created_at, updated_at')
    .or(OFFER_REQUEST_FILTER);

  const open = (offers ?? []).filter((o) => offerRequestKind(o) !== null);
  if (open.length === 0) return [];

  const providerIds = [...new Set(open.map((o) => o.provider_id))];
  const serviceIds = [...new Set(open.map((o) => o.service_id))];

  const [{ data: providers }, { data: services }] = await Promise.all([
    supabase.from('service_providers').select('id, kind, instructor_id, display_name').in('id', providerIds),
    supabase.from('standalone_services').select('id, name, price').in('id', serviceIds),
  ]);

  const providerById = new Map((providers ?? []).map((p) => [p.id, p]));
  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));

  return open
    .map((o) => {
      const p = providerById.get(o.provider_id);
      const s = serviceById.get(o.service_id);
      return {
        id: o.id,
        kind: offerRequestKind(o)!,
        providerId: o.provider_id,
        providerKind: p?.kind ?? 'individual',
        providerName: p?.display_name ?? 'مقدّم غير معروف',
        instructorId: p?.instructor_id ?? null,
        serviceId: o.service_id,
        serviceName: s?.name ?? 'خدمة محذوفة',
        catalogPrice: Number(s?.price ?? 0),
        requestedPrice: o.requested_price == null ? null : Number(o.requested_price),
        approvedPrice: o.approved_price == null ? null : Number(o.approved_price),
        isActive: o.is_active,
        adminNotes: o.admin_notes,
        since: o.updated_at ?? o.created_at,
      };
    })
    // الأقدم الأول — اللي مستني من بدري يتشاف قبل الجديد.
    .sort((a, b) => a.since.localeCompare(b.since));
}
