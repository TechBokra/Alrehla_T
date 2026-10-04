import {
  WritingPackage, Instructor, PersonalizedProduct, AddonProduct, SubscriptionTier, 
  Testimonial, CreativeService, BlogPost, UserProfile, Booking, Order, 
  Publisher, InstructorPayout, PublisherPayout, SessionMessage, SessionAttachment, 
  StudyMaterial, InstructorStudent, BoxSubscription, SupportTicket, 
  JoinRequest, SupportSessionRequest, AuditLog, ServiceOrder, CourseSubscription, 
  SupportTicketMessage, FamilyMember, NotificationItem, UserRole,
  PublisherOrder,
  InstructorPricingOption, PricingFormulaSettings, InstructorCompensationProfile, InstructorCertification
} from '@/types';
import { cookies } from 'next/headers';

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


import { createClient } from '@/lib/supabase/server';

export const getAllSupportTickets = async (): Promise<SupportTicket[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((t: any) => ({
    id: t.id,
    requesterName: t.requester_name,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.created_at
  }));
};


export const getJoinRequests = async (): Promise<JoinRequest[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('join_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((r: any) => ({
    id: r.id,
    applicantName: r.applicant_name,
    requestedRole: r.requested_role,
    status: r.status,
    createdAt: r.created_at,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    portfolioUrl: r.portfolio_url ?? undefined,
    message: r.message ?? undefined,
  }));
};


export const getSupportSessionRequests = async (): Promise<SupportSessionRequest[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('support_session_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((r: any) => ({
    id: r.id,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    message: r.message,
    status: r.status,
    createdAt: r.created_at
  }));
};

export async function getAuditLogs(): Promise<AuditLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_profile_id, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    actorProfileId: row.actor_profile_id ?? undefined,
    action: row.action,
    entityType: row.entity_type ?? '',
    entityId: row.entity_id ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: row.created_at,
  }));
}


/**
 * Writes a real audit entry. This used to push onto an in-memory array, which
 * meant every recorded action was lost the moment the server restarted — the
 * audit log was, in effect, not an audit log.
 */
export async function logAuditAction(
  data: Omit<import('@/types').AuditLog, 'id' | 'createdAt'>
) {
  const supabase = await createClient();
  const { error } = await supabase.from('audit_logs').insert({
    actor_profile_id: data.actorProfileId ?? null,
    action: data.action,
    entity_type: data.entityType ?? null,
    entity_id: data.entityId ?? null,
    metadata: (data.metadata as never) ?? null,
  });
  if (error) console.error('Error writing audit log', error);
}


export const getPublisherPricingSettings = async (): Promise<PricingFormulaSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('pricing_formula_settings')
    .select('*')
    .eq('id', 'publisher-default')
    .single();

  if (error || !data) {
    return { id: 'publisher-default', platformMultiplier: 1, fixedAdminFee: 0, updatedAt: new Date().toISOString() };
  }

  return {
    id: data.id,
    platformMultiplier: data.platform_multiplier,
    fixedAdminFee: data.fixed_admin_fee,
    updatedAt: data.updated_at
  };
};

export type WithdrawalRequestRow = {
  id: string;
  /**
   * صاحب الطلب — مدرب أو ناشر (ملف SQL 100).
   *
   * ⚠️ **واحد بس من الرقمين متملّي**، والقاعدة بتفرض ده بقيد. وقبل
   *    ملف 100 كان الجدول للمدرب وحده، فالناشر مكانش يقدر يطلب سحبه
   *    من الموقع خالص.
   */
  ownerKind: 'instructor' | 'publisher';
  instructorId: string | null;
  publisherId: string | null;
  /** اسم المدرب أو الناشر — اللي الإدارة بتشوفه. */
  ownerName: string;
  amount: number;
  method: string;
  /**
   * بيانات التحويل اللي المدرب كتبها (ملف SQL 92).
   *
   * ⚠️ من غيرها الطلب **مينفعش يتنفّذ**: الإدارة بتشوف «تحويل بنكي»
   *    وبس. الطلبات القديمة — اللي اتعملت قبل الإصلاح — فاضية هنا.
   */
  payoutDetails: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
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
