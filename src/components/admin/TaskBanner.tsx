import React from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { WORK_STAGE_LABELS, isWorkStage } from '@/lib/work-tasks';

/**
 * «مين ماسك الطلب ده؟» — فوق صفحة الطلب/الحجز/طلب الخدمة عند الإدارة (ملف 14).
 *
 * بيعرض المهمة المفتوحة (مراجعة الدفع أو التنفيذ) ومسؤولها. ولو ملف 14
 * لسه ماتشغّلش أو مفيش مهمة مفتوحة، مابيعرضش حاجة.
 */
export async function TaskBanner({ sourceId }: { sourceId: string }) {
  const supabase = await createClient();
  const { data: tasks, error } = await supabase
    .from('work_tasks')
    .select('stage, assignee_ids')
    .eq('source_id', sourceId)
    .eq('status', 'open');
  if (error || !tasks || tasks.length === 0) return null;

  const ids = Array.from(new Set(tasks.flatMap((t) => t.assignee_ids ?? [])));
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await supabase.from('user_profiles').select('id, full_name').in('id', ids);
    for (const p of people ?? []) names.set(p.id, p.full_name);
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-bold text-blue-900">
        <ClipboardList className="h-5 w-5" aria-hidden="true" />
        {tasks.map((t, i) => (
          <span key={i}>
            {isWorkStage(t.stage) ? WORK_STAGE_LABELS[t.stage] : t.stage}:{' '}
            {(t.assignee_ids ?? []).length
              ? (t.assignee_ids ?? []).map((id) => names.get(id) ?? 'إداري').join('، ')
              : 'من غير مسؤول'}
          </span>
        ))}
      </div>
      <Link href="/dashboard/admin/tasks" className="font-bold text-blue-800 underline underline-offset-4">
        «مهامي»
      </Link>
    </div>
  );
}
