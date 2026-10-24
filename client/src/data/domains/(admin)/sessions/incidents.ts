import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** بلاغات الجلسات للإدارة (بند ١١). `null` = الجدول لسه مش موجود. */
export type AdminIncident = {
  id: string;
  sessionId: string | null;
  sessionNumber: number | null;
  reporterName: string;
  reporterRole: string;
  severity: 'normal' | 'urgent';
  category: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  assignedName: string | null;
  adminNote: string | null;
  resolution: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  session_id: string | null;
  reporter_profile_id: string;
  reporter_role: string;
  severity: 'normal' | 'urgent';
  category: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  assigned_to: string | null;
  admin_note: string | null;
  resolution: string | null;
  created_at: string;
};

export async function getIncidentsForAdmin(): Promise<AdminIncident[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_incidents' as never)
    .select(
      'id, session_id, reporter_profile_id, reporter_role, severity, category, description, status, assigned_to, admin_note, resolution, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return null;
  const rows = (data ?? []) as unknown as Row[];

  const profileIds = [...new Set(rows.flatMap((r) => [r.reporter_profile_id, r.assigned_to]).filter(Boolean))] as string[];
  const sessionIds = [...new Set(rows.map((r) => r.session_id).filter(Boolean))] as string[];

  const [{ data: profiles }, { data: sessions }] = await Promise.all([
    profileIds.length
      ? supabase.from('user_profiles').select('id, full_name').in('id', profileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    sessionIds.length
      ? supabase.from('sessions').select('id, session_number').in('id', sessionIds)
      : Promise.resolve({ data: [] as { id: string; session_number: number }[] }),
  ]);
  const name = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? '—']));
  const num = new Map((sessions ?? []).map((s) => [s.id, s.session_number]));

  const order = { open: 0, in_progress: 1, resolved: 2 } as const;
  return rows
    .map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      sessionNumber: r.session_id ? (num.get(r.session_id) ?? null) : null,
      reporterName: name.get(r.reporter_profile_id) ?? '—',
      reporterRole: r.reporter_role,
      severity: r.severity,
      category: r.category,
      description: r.description,
      status: r.status,
      assignedName: r.assigned_to ? (name.get(r.assigned_to) ?? '—') : null,
      adminNote: r.admin_note,
      resolution: r.resolution,
      createdAt: r.created_at,
    }))
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        (a.severity === b.severity ? 0 : a.severity === 'urgent' ? -1 : 1) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

/** عدد العاجل اللي لسه محدّش قفله — لشريط التنبيه في لوحة الإدارة. */
export async function countOpenUrgentIncidents(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('session_incidents' as never)
    .select('id', { count: 'exact', head: true })
    .eq('severity', 'urgent')
    .eq('status', 'open');
  return error ? 0 : (count ?? 0);
}
