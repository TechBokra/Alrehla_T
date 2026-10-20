import { redirect } from 'next/navigation';

/**
 * «نصوصي» اتنقلت لـ«ملفي» (`/aqlam/me`). الرابط القديم فضل شغّال لأن إشعارات
 * ورسايل اتبعتت بيه قبل كده — بيوصّل لنفس المكان ويحافظ على رسالة النجاح.
 */
export default async function MineRedirect({ searchParams }: { searchParams: Promise<{ posted?: string }> }) {
  const sp = await searchParams;
  redirect(sp.posted ? `/aqlam/me?posted=${encodeURIComponent(sp.posted)}` : '/aqlam/me');
}
