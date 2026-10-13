import { createClient } from '@/lib/supabase/server';

/** The latest saved report for a session, if the instructor has written one. */
export async function getSessionReport(sessionId: string): Promise<{
  attendance: 'present' | 'absent';
  report: string;
  createdAt: string;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_reports')
    .select('attendance, report, updated_at')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    attendance: data.attendance === 'absent' ? 'absent' : 'present',
    report: data.report ?? '',
    createdAt: data.updated_at,
  };
}

/**
 * تقارير مجموعة جلسات مرة واحدة (صفحة متابعة الطفل لولي الأمر).
 * القراية بجلسة المستخدم — القاعدة بتسمح لولي الأمر والطفل بس (ملف 17).
 */
export async function getSessionReportsFor(sessionIds: string[]): Promise<
  Map<string, { attendance: 'present' | 'absent'; report: string; createdAt: string }>
> {
  const out = new Map<string, { attendance: 'present' | 'absent'; report: string; createdAt: string }>();
  if (sessionIds.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_reports')
    .select('session_id, attendance, report, updated_at')
    .in('session_id', sessionIds.slice(0, 200));
  if (error) {
    console.error('Error loading session reports', error);
    return out;
  }
  for (const r of data ?? []) {
    out.set(r.session_id, {
      attendance: r.attendance === 'absent' ? 'absent' : 'present',
      report: r.report ?? '',
      createdAt: r.updated_at,
    });
  }
  return out;
}
