import 'server-only';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';

/**
 * إرسال إيميل عن طريق Resend — للتنبيهات العاجلة بس (بند ١١، ٢٤ أكتوبر).
 *
 * ⚠️ **المفتاح في Vercel بس** (`RESEND_API_KEY`) — مابيتكتبش في
 *    القاعدة ولا في الكود. ولو مش موجود، الإرسال بيتخطّى بهدوء
 *    والإشعار جوّه الموقع بيفضل شغّال.
 *
 * ⚠️ **مابترميش أبدًا.** فشل الإيميل مايوقعش البلاغ نفسه.
 *
 * المتغيّرات:
 *   RESEND_API_KEY   إجباري للإرسال
 *   RESEND_FROM      اختياري — الافتراضي «الرحلة <alerts@alrehla.org>»
 *   ALERT_EMAILS     اختياري — إيميلات مفصولة بفاصلة. لو فاضي، بيتبعت
 *                    لكل حسابات الإدارة (super_admin / general_supervisor).
 */

export type EmailResult = { sent: true; count: number } | { sent: false; reason: string };

const DEFAULT_FROM = 'الرحلة <alerts@alrehla.org>';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** إيميلات الإدارة اللي بتستلم التنبيه العاجل. */
export async function adminAlertEmails(): Promise<string[]> {
  const fromEnv = (process.env.ALERT_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (fromEnv.length > 0) return fromEnv;

  if (!isAdminApiConfigured()) return [];
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from('user_profiles')
      .select('id')
      .in('role', ['super_admin', 'general_supervisor']);
    const emails: string[] = [];
    for (const a of admins ?? []) {
      const { data } = await admin.auth.admin.getUserById(a.id);
      if (data?.user?.email) emails.push(data.user.email);
    }
    return [...new Set(emails)];
  } catch (e) {
    console.error('adminAlertEmails', e);
    return [];
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** إيميل نصّي بسيط من اليمين للشمال. `lines` نص عادي بيتعمله escape. */
export async function sendEmail(params: {
  to: string[];
  subject: string;
  lines: string[];
  link?: { href: string; label: string };
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'no-key' };
  if (params.to.length === 0) return { sent: false, reason: 'no-recipients' };

  const body = params.lines.map((l) => `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`).join('');
  const button = params.link
    ? `<p><a href="${escapeHtml(params.link.href)}" style="display:inline-block;background:#be123c;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(params.link.label)}</a></p>`
    : '';
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7;color:#0f172a">${body}${button}</div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || DEFAULT_FROM,
        to: params.to,
        subject: params.subject,
        html,
        text: [...params.lines, params.link ? `${params.link.label}: ${params.link.href}` : ''].join('\n'),
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('sendEmail Resend error', res.status, await res.text().catch(() => ''));
      return { sent: false, reason: `http-${res.status}` };
    }
    return { sent: true, count: params.to.length };
  } catch (e) {
    console.error('sendEmail', e);
    return { sent: false, reason: 'network' };
  }
}
