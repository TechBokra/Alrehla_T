import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import { formatCairo } from '@/lib/timezone';

export type SessionReportView = {
  attendance: 'present' | 'absent';
  report: string;
  createdAt: string;
};

/**
 * تقرير المدرب عن جلسة — للطالب وولي الأمر (ملاحظة الفريق، 10 أكتوبر:
 * «تقرير الجلسة بيظهر للإدارة بس»).
 *
 * القراية محمية في القاعدة (ملف 17): ولي الأمر، والطالب المستقل، وحساب
 * الطفل — وبس.
 */
export function SessionReportCard({ report, compact = false }: { report: SessionReportView; compact?: boolean }) {
  const present = report.attendance === 'present';
  return (
    <div className={`rounded-2xl border bg-white ${compact ? 'p-4' : 'p-6'} ${present ? 'border-emerald-200' : 'border-amber-200'}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <FileText className="h-5 w-5 text-slate-500" aria-hidden="true" />
        <p className="font-black text-slate-800">تقرير المدرب</p>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
            present ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {present ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {present ? 'حضر' : 'غاب'}
        </span>
        <span className="text-xs font-medium text-slate-400">
          {formatCairo(report.createdAt, { dateStyle: 'medium' })}
        </span>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
        {report.report || 'سجّل المدرب الحضور بدون ملاحظات.'}
      </p>
    </div>
  );
}
