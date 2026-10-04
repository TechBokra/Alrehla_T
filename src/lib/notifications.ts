import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import type { NotificationEvent } from '@/lib/notification-events';

/**
 * الأنواع الموقوفة من شاشة «أنواع الإشعارات».
 *
 * القراءة بعميل بلا كوكيز عشان ما تكسرش التخزين المؤقت، وأي فشل معناه
 * «مفيش حاجة موقوفة» — الإشعار بيتبعت. الإعداد ما ينفعش يبقى سبب في
 * إن إشعار مهم يسقط بسبب غلطة في القراءة.
 */
async function isEventDisabled(event?: NotificationEvent): Promise<boolean> {
  if (!event) return false;
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'notifications')
      .maybeSingle();
    const disabled = (data?.value as { disabled?: string[] } | null)?.disabled;
    return Array.isArray(disabled) && disabled.includes(event);
  } catch {
    return false;
  }
}

/**
 * Sending an in-app notification.
 *
 * The `notifications` table existed from the beginning and nothing in the site
 * ever wrote to it — every approval, delivery and payment happened silently and
 * the person only found out by opening the right screen by chance.
 *
 * Writing goes through a guarded database function rather than a plain insert:
 * a direct insert policy would let any signed-in user send a notification to
 * anyone, which is an open door for spam.
 *
 * Notifications are never load-bearing. A failure is logged and swallowed so
 * that it can never turn a successful approval or delivery into an error.
 */
export async function notifyUser(params: {
  recipientProfileId: string | null | undefined;
  title: string;
  message?: string;
  link?: string;
  /** نوع الإشعار — عشان شاشة الأنواع تقدر توقفه. */
  event?: NotificationEvent;
}) {
  const { recipientProfileId, title, message, link } = params;
  if (!recipientProfileId || !title.trim()) return;
  if (await isEventDisabled(params.event)) return;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc('notify_user', {
      p_recipient: recipientProfileId,
      p_title: title,
      p_message: message ?? null,
      p_link: link ?? null,
    });
    if (error) console.error('Error sending notification', error);
  } catch (err) {
    console.error('Error sending notification', err);
  }
}

/**
 * إشعار لكل الإدارة.
 *
 * `notifyUser` ما بتنفعش هنا: بترفض أي مُرسِل مش إداري ومش طرف في طلب
 * يجمعه بالمستلِم — والعميل اللي بيرفع إثبات دفع أو بيطلب مراجعة مش
 * واحد منهم. فكل الإشعارات الجاية للإدارة كانت بتسقط بصمت.
 *
 * الدالة دي ما بتاخدش مستلِم أصلًا: القاعدة هي اللي بتختار الإداريين،
 * فمفيش طريق لإرسال إشعار لأي حد تاني.
 */
export async function notifyAdmins(params: {
  title: string;
  message?: string;
  link?: string;
  event?: NotificationEvent;
}) {
  if (!params.title.trim()) return;
  if (await isEventDisabled(params.event)) return;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc('notify_admins', {
      p_title: params.title,
      p_message: params.message ?? null,
      p_link: params.link ?? null,
    });
    if (error) console.error('Error notifying admins', error);
  } catch (err) {
    console.error('Error notifying admins', err);
  }
}

/** The user profile behind an instructor record, for notifying them. */
export async function getInstructorUserId(instructorId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('instructors')
    .select('user_id')
    .eq('id', instructorId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/**
 * حساب الناشر اللي بيستقبل الإشعارات.
 *
 * ⚠️ بترجع فاضي لو الناشر مالوش حساب دخول — ودي حالة حقيقية:
 *    `publishers.user_id` بيقبل الفراغ، فالدار ممكن تكون مسجّلة
 *    في الكتالوج من غير ما حد منها يدخل الموقع.
 */
export async function getPublisherUserId(publisherId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('publishers')
    .select('user_id')
    .eq('id', publisherId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/**
 * حساب مقدّم الخدمة اللي بيستقبل الإشعارات على الطلب.
 *
 * بترجع فاضي لما المنصة هي المقدّم — مفيش شخص بعينه يتبعتله إشعار،
 * والإدارة بتشوف الطلب في لوحتها أصلًا.
 */
export async function getProviderUserId(providerId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_providers')
    .select('kind, user_id, instructor_id')
    .eq('id', providerId)
    .maybeSingle();

  if (!data || data.kind === 'platform') return null;
  if (data.user_id) return data.user_id;
  if (data.instructor_id) return getInstructorUserId(data.instructor_id);
  return null;
}
