import React from 'react';
import { AlarmClock, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { formatSpan, type DeadlineState } from '@/lib/work-tasks';
import { formatCairo } from '@/lib/timezone';

export const formatDue = (iso: string) => formatCairo(iso, { dateStyle: 'medium', timeStyle: 'short' });

/** شارة الموعد — بأيقونة ونص (اللون وحده مش معلومة). */
export function DeadlineChip({ d, dueAt }: { d: DeadlineState; dueAt: string | null }) {
  const base = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold';
  const when = dueAt ? formatDue(dueAt) : undefined;
  switch (d.kind) {
    case 'overdue':
      return (
        <span title={when} className={`${base} border-rose-200 bg-rose-50 text-rose-800`}>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> متأخرة {formatSpan(d.ms ?? 0)}
        </span>
      );
    case 'soon':
      return (
        <span title={when} className={`${base} border-amber-300 bg-amber-50 text-amber-900`}>
          <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" /> قربت — فاضل {formatSpan(d.ms ?? 0)}
        </span>
      );
    case 'ok':
      return (
        <span title={when} className={`${base} border-slate-200 bg-slate-50 text-slate-700`}>
          <Clock className="h-3.5 w-3.5" aria-hidden="true" /> الموعد بعد {formatSpan(d.ms ?? 0)}
        </span>
      );
    case 'none':
      return (
        <span className={`${base} border-slate-200 bg-white text-slate-500`}>
          <Clock className="h-3.5 w-3.5" aria-hidden="true" /> من غير موعد
        </span>
      );
    case 'done_on_time':
      return (
        <span title={when} className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> خلصت في الميعاد
        </span>
      );
    case 'done_late':
      return (
        <span title={when} className={`${base} border-rose-200 bg-rose-50 text-rose-800`}>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> خلصت متأخرة {formatSpan(d.ms ?? 0)}
        </span>
      );
    default:
      return null;
  }
}

