import { InstructorPayout, PublisherPayout } from '@/types';
import { createClient } from '@/lib/supabase/server';
import type { WithdrawalRequestRow } from '@/data/domains/(admin)/finance/types';

// Import from auth if needed



/**
 * ⚠️ **الخطأ بيتسجّل، مابيتبلعش.** كانت `if (error || !data || !data.length)
 *    return []` — فشاشة مالية بتقول «مفيش مستحقات» سواء دي الحقيقة ولا
 *    القاعدة رفضت الاستعلام. وعلى شاشة فلوس، الفرق بين «مفيش» و«ما
 *    عرفناش» هو الفرق بين قرار صح وقرار على بياض.
 */
export const getInstructorPayouts = async (): Promise<InstructorPayout[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('payouts')
    .select('*')
    .eq('owner_kind', 'instructor')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading instructor payouts', error);
    return [];
  }
  if (!data) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    instructorId: p.owner_id,
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

/** نفس كلام `getInstructorPayouts` فوق — الخطأ بيتسجّل مابيتبلعش. */
export const getPublisherPayouts = async (): Promise<PublisherPayout[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('payouts')
    .select('*')
    .eq('owner_kind', 'publisher')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading publisher payouts', error);
    return [];
  }
  if (!data) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    publisherId: p.owner_id,
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
      'id, instructor_id, publisher_id, provider_id, amount, method, status, payout_details, admin_notes, created_at, instructors(display_name), publishers(name), service_providers(display_name)',
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const instructor = row.instructors as unknown as { display_name: string } | null;
    const publisher = row.publishers as unknown as { name: string } | null;
    const provider = row.service_providers as unknown as { display_name: string } | null;
    // ⚠️ **التلاتة، مش الاتنين.** مقدّم الخدمة المستقل بقى يقدر يطلب
    //    سحبًا (ملف 20261016160000)، ولو فضل الفرع ثنائيًّا كان طلبه
    //    هيتعرض للإدارة باسم «مدرب» — وده أسوأ من إنه مايظهرش.
    const ownerKind: 'instructor' | 'publisher' | 'provider' =
      row.publisher_id != null ? 'publisher' : row.provider_id != null ? 'provider' : 'instructor';
    return {
      id: row.id,
      ownerKind,
      instructorId: row.instructor_id,
      publisherId: row.publisher_id,
      providerId: row.provider_id ?? null,
      ownerName:
        ownerKind === 'publisher'
          ? (publisher?.name ?? 'ناشر')
          : ownerKind === 'provider'
            ? (provider?.display_name ?? 'مقدّم خدمة')
            : (instructor?.display_name ?? 'مدرب'),
      amount: row.amount,
      method: row.method,
      payoutDetails: row.payout_details,
      status: row.status,
      adminNotes: row.admin_notes,
      createdAt: row.created_at,
    };
  });
}
