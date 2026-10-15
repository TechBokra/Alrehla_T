/** تسمية حالة النص للكاتب (الواجهة فقط — القاعدة بتتعامل بالمفاتيح). */
export const POST_STATUS_LABELS: Record<string, { label: string; tone: string; help: string }> = {
  pending_guardian: {
    label: 'بانتظار ولي الأمر',
    tone: 'bg-amber-100 text-amber-900',
    help: 'ولي أمرك لازم يوافق الأول.',
  },
  pending_review: {
    label: 'قيد المراجعة',
    tone: 'bg-sky-100 text-sky-900',
    help: 'فريق الرحلة بيراجعه قبل النشر.',
  },
  published: { label: 'منشور', tone: 'bg-emerald-100 text-emerald-900', help: '' },
  hidden: {
    label: 'مخفي مؤقتًا',
    tone: 'bg-slate-200 text-slate-800',
    help: 'اتخبّى لحد ما يتراجع.',
  },
  rejected: { label: 'مرفوض', tone: 'bg-rose-100 text-rose-900', help: 'ماتنشرش.' },
};

export function postStatusLabel(status: string) {
  return POST_STATUS_LABELS[status] ?? { label: status, tone: 'bg-slate-100 text-slate-800', help: '' };
}

/** الرسالة اللي بتظهر بعد النشر (`?posted=<status>`). */
export function postedMessage(status: string | undefined): string | null {
  switch (status) {
    case 'published':
      return 'اتنشر نصك! ألف مبروك.';
    case 'pending_guardian':
      return 'وصل لولي أمرك. أول ما يوافق هيدخل المراجعة.';
    case 'pending_review':
      return 'وصل للمراجعة. هنبلغك أول ما يتنشر.';
    default:
      return null;
  }
}
