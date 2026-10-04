'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { notifyAdmins } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';
import { normalizePhone, isValidPhone, PHONE_ERROR } from '@/lib/phone';

/**
 * A customer asking for a support session.
 *
 * This used to push the request onto an in-memory array and return success, so
 * every enquiry a customer sent was silently lost: they were told it had been
 * received, and nobody ever saw it.
 */
export async function submitSupportSessionRequest(
  contactName: string,
  contactPhone: string,
  message: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ⚠️ الرقم ده هو **الطريق الوحيد** للرد على الطلب — لو فيه حروف
  //    الطلب بيوصل وميتردّش عليه. و`type="tel"` مش بيمنع الحروف.
  const phone = normalizePhone(contactPhone);
  if (!isValidPhone(phone)) {
    throw new Error(PHONE_ERROR);
  }

  const { error } = await supabase.from('support_session_requests').insert({
    user_id: user?.id ?? null,
    contact_name: contactName,
    contact_phone: phone,
    message,
    status: 'pending',
  });

  if (error) {
    console.error('Error submitting support session request', error);
    throw new Error('تعذّر إرسال الطلب، برجاء المحاولة مرة أخرى');
  }

  await notifyAdmins({
    event: 'support',
    title: 'طلب جلسة دعم جديد',
    message: `${contactName} طلب جلسة دعم.`,
    link: '/dashboard/admin/support/session-requests',
  });

  revalidatePath('/dashboard/admin/support/session-requests');
  revalidatePath('/account/support');
  return { success: true };
}

/**
 * A customer opening a support ticket.
 *
 * The public support form was a `<form>` with no action and a
 * `type="button"` submit: every ticket a customer wrote was discarded at the
 * moment they clicked send, while the page promised a reply within 24 hours.
 */
export async function createSupportTicket(params: {
  subject: string;
  category: string;
  message: string;
}) {
  const subject = params.subject.trim();
  const message = params.message.trim();
  if (!subject) throw new Error('اكتب موضوع التذكرة');
  if (!message) throw new Error('اكتب تفاصيل المشكلة');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('يجب تسجيل الدخول لفتح تذكرة دعم');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: user.id,
      requester_name: profile?.full_name ?? 'عميل',
      subject,
      category: params.category || 'عام',
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !ticket) {
    console.error('Error creating support ticket', error);
    throw new Error('تعذّر فتح التذكرة، برجاء المحاولة مرة أخرى');
  }

  const { error: messageError } = await supabase.from('support_ticket_messages').insert({
    ticket_id: ticket.id,
    sender_profile_id: user.id,
    message,
  });

  if (messageError) console.error('Error adding first ticket message', messageError);

  await notifyAdmins({
    event: 'support',
    title: 'تذكرة دعم جديدة',
    message: subject,
    link: `/dashboard/admin/support/tickets/${ticket.id}`,
  });

  revalidatePath('/account/support');
  revalidatePath('/dashboard/admin/support/tickets');
  revalidatePath('/dashboard/admin');
  return { success: true, ticketId: ticket.id };
}

/** A reply on a ticket, from the customer or from support. */
export async function replyToSupportTicket(ticketId: string, message: string) {
  const text = message.trim();
  if (!text) throw new Error('اكتب الرد أولاً');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');

  const { error } = await supabase.from('support_ticket_messages').insert({
    ticket_id: ticketId,
    sender_profile_id: user.id,
    message: text,
  });

  if (error) {
    console.error('Error replying to ticket', error);
    throw new Error('تعذّر إرسال الرد');
  }

  // A reply from support means the customer has been answered.
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('user_id')
    .eq('id', ticketId)
    .maybeSingle();

  if (ticket && ticket.user_id !== user.id) {
    await supabase
      .from('support_tickets')
      .update({ status: 'answered', updated_at: new Date().toISOString() })
      .eq('id', ticketId);
  }

  revalidatePath(`/dashboard/admin/support/tickets/${ticketId}`);
  revalidatePath('/account/support');
  revalidatePath('/dashboard/admin');
  return { success: true };
}

/** Closing a ticket. */
export async function closeSupportTicket(ticketId: string) {
  await requireAdmin('canManageSupport', 'إغلاق التذاكر متاح للإدارة فقط');
  const supabase = await createClient();
  const { error } = await supabase
    .from('support_tickets')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  if (error) {
    console.error('Error closing ticket', error);
    throw new Error('تعذّر إغلاق التذكرة');
  }

  revalidatePath(`/dashboard/admin/support/tickets/${ticketId}`);
  revalidatePath('/dashboard/admin/support/tickets');
  revalidatePath('/dashboard/admin');
  return { success: true };
}
