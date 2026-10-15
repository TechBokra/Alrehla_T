import { notFound } from 'next/navigation';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { aqlamReadable, type AqlamSettings } from '@/lib/aqlam/settings';

/**
 * بوابة كل صفحة في أقلام الرحلة: العلم مقفول ← 404.
 * بترجّع الإعدادات (من الكاش) لمن يحتاج الحالة (تجريبي/عام).
 */
export async function requireAqlamReadable(): Promise<AqlamSettings> {
  const settings = await getSiteSettings();
  if (!aqlamReadable(settings.aqlam)) notFound();
  return settings.aqlam;
}

/** صفحات التجريبي مش بتتفهرس أبدًا، ولا صفحات الحساب. */
export function robotsFor(settings: AqlamSettings, indexable: boolean) {
  return indexable && settings.mode === 'public' ? undefined : { index: false, follow: false };
}
