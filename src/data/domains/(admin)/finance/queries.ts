import { InstructorPayout, PublisherPayout } from '@/types';
import { createClient } from '@/lib/supabase/server';
import type { WithdrawalRequestRow } from '@/data/domains/(admin)/finance/types';

// Import from auth if needed



export const getInstructorPayouts = async (): Promise<InstructorPayout[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('instructor_payouts')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    instructorId: p.instructor_id,
    period: p.period,
    amount: p.amount,
    status: p.status
  }));
};

/**
 * طلبات السحب المعلّقة للحساب الداخل.
 *
 * ⚠️ **بتعتمد على صلاحيات القاعدة في الفلترة** (قاعدة «ك»): الناشر
 *    بيشوف صفوفه هو وبس، والصفوف اللي مش بتاعته **بترجع فاضية لا
 *    بخطأ**. فالعدد ده بتاعه هو.
 *
 *    والسبب إنها مش بتفلتر بإيدها إن `getMyPublisher` نداء زيادة على
 *    القاعدة في كل تحميل للشاشة، والسياسة بتعمل نفس الشغل.
 */
export const getMyOpenWithdrawalRequests = async (): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('withdrawal_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    console.error('Error counting open withdrawal requests', error);
    // ⚠️ صفر عند الخطأ معناه الشاشة تعرض الزرار، والقاعدة ترفض
    //    الطلب التاني برسالة واضحة. أهون من إخفاء الزرار غلط.
    return 0;
  }
  return count ?? 0;
};

export const getPublisherPayouts = async (): Promise<PublisherPayout[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('publisher_payouts')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    publisherId: p.publisher_id,
    period: p.period,
    amount: p.amount,
    status: p.status
  }));
};

/**
 * طلبات السحب — للمدربين والناشرين.
 *
 * الصلاحيات في القاعدة بتحصر ده على الإدارة وعلى صفوف صاحب الطلب
 * نفسه، فمفيش فلترة هنا عن قصد.
 */
export async function getWithdrawalRequests(): Promise<WithdrawalRequestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select(
      'id, instructor_id, publisher_id, amount, method, status, payout_details, admin_notes, created_at, instructors(display_name), publishers(name)',
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const instructor = row.instructors as unknown as { display_name: string } | null;
    const publisher = row.publishers as unknown as { name: string } | null;
    const isPublisher = row.publisher_id != null;
    return {
      id: row.id,
      ownerKind: (isPublisher ? 'publisher' : 'instructor') as 'instructor' | 'publisher',
      instructorId: row.instructor_id,
      publisherId: row.publisher_id,
      ownerName: isPublisher
        ? publisher?.name ?? 'ناشر'
        : instructor?.display_name ?? 'مدرب',
      amount: row.amount,
      method: row.method,
      payoutDetails: row.payout_details,
      status: row.status,
      adminNotes: row.admin_notes,
      createdAt: row.created_at,
    };
  });
}
