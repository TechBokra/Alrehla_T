import Link from 'next/link';
import { PenLine } from 'lucide-react';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { aqlamReadable } from '@/lib/aqlam/settings';

/**
 * رابط «انشر في أقلام الرحلة» في محرر الكتابة. مابيظهرش خالص لما الميزة
 * مقفولة (الإعدادات من الكاش نفسه اللي بيقراه الهيدر، فمفيش استعلام زيادة).
 * بيودّي لنموذج النشر والنص جاهز — والنشر نسخة ثابتة، فالنص الأصلي مش بيتأثر.
 */
export async function AqlamPublishLink({ documentId }: { documentId: string }) {
  const settings = await getSiteSettings();
  if (!aqlamReadable(settings.aqlam)) return null;
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <Link
        href={`/aqlam/publish?doc=${encodeURIComponent(documentId)}`}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-300 px-5 text-sm font-bold text-slate-800 transition-colors hover:border-slate-500 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
      >
        <PenLine className="h-4 w-4" aria-hidden="true" />
        انشر في أقلام الرحلة
      </Link>
    </div>
  );
}
