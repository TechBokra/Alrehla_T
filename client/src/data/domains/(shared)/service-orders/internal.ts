import { createClient } from '@/lib/supabase/server';
import type { QueryReadOptions } from '@/data/query-result';
import type { ServiceOrderRow } from '@/data/domains/(shared)/service-orders/types';

export async function mapServiceOrders(
  rows: any[],
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: QueryReadOptions = {},
): Promise<ServiceOrderRow[]> {
  // child_id is an application reference, not a PostgREST foreign-key join.
  // Reuse the session client so child-profile RLS remains enforced.
  const childIds = [...new Set(rows
    .filter((row) => row.participant_type === 'child' && typeof row.child_id === 'string' && row.child_id)
    .map((row) => row.child_id as string))];
  const participants = new Map<string, { full_name: string; birth_date: string | null }>();
  // Bound URL size and result size for large admin lists; never query per order.
  for (let start = 0; start < childIds.length; start += 200) {
    const { data, error } = await supabase.from('child_profiles')
      .select('id, full_name, birth_date')
      .in('id', childIds.slice(start, start + 200));
    if (error && options.throwOnError) throw error;
    if (error) {
      console.error('Service-order participant lookup failed', { code: error.code });
      continue;
    }
    for (const child of data ?? []) participants.set(child.id, child);
  }
  return rows.map((row) => {
    const service = row.standalone_services as { name: string } | null;
    const instructor = row.instructors as { display_name: string } | null;
    const provider = row.service_providers as
      | { display_name: string; kind: 'platform' | 'instructor' | 'individual' }
      | null;
    const participant = row.participant_type === 'child' ? participants.get(row.child_id) : undefined;
    return {
      id: row.id,
      buyerProfileId: row.buyer_profile_id,
      serviceId: row.standalone_service_id,
      serviceName: service?.name ?? 'خدمة غير معروفة',
      instructorId: row.instructor_id,
      instructorName: instructor?.display_name ?? null,
      providerId: row.provider_id ?? null,
      // الاسم القديم بيفضل احتياطي للطلبات اللي اتعملت قبل نظام المقدّمين.
      providerName: provider?.display_name ?? instructor?.display_name ?? null,
      providerKind: provider?.kind ?? (instructor ? 'instructor' : null),
      dueAt: row.due_at ?? null,
      dueNote: row.due_note ?? null,
      amount: row.amount,
      status: row.status,
      transactionReference: row.transaction_reference,
      paymentReference: row.payment_reference ?? null,
      paymentMethod: row.payment_method ?? null,
      paymentReceiptUrl: row.payment_receipt_url ?? null,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at ?? null,
      completedAt: row.completed_at ?? null,
      instructorEarning: row.instructor_earning ?? null,
      participantType: (row.participant_type === 'child' ? 'child' : 'self') as 'self' | 'child',
      participantName: participant?.full_name ?? null,
      participantBirthDate: participant?.birth_date ?? null,
    };
  });
}

// Related child profiles are loaded explicitly: this schema has no child_id FK.
export const SERVICE_ORDER_SELECT =
  'id, buyer_profile_id, standalone_service_id, instructor_id, provider_id, due_at, due_note, amount, status, transaction_reference, payment_reference, payment_method, payment_receipt_url, created_at, delivered_at, completed_at, instructor_earning, participant_type, child_id, standalone_services(name), instructors(display_name), service_providers(display_name, kind)';
