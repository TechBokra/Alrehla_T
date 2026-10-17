import { createClient } from '@/lib/supabase/server';
import { parseRpcResult } from '@/lib/aqlam/errors';

/**
 * قراءات شاشة الإدارة — بصلاحية المسؤول نفسه (سياسات RLS للإدارة).
 * مفيش أي استعلام هنا بيتنفّذ في صفحات الزوار.
 */

export type AdminPostRow = {
  id: string;
  title: string;
  body: string;
  status: string;
  displayName: string;
  writerId: string;
  ageGroup: string;
  createdAt: string;
  featured: boolean;
};

const POST_COLUMNS = 'id,title,body,status,display_name,writer_id,age_group,created_at,featured_at';

export async function listAdminPosts(statuses: string[], limit = 50): Promise<AdminPostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_posts')
    .select(POST_COLUMNS)
    .in('status', statuses)
    .order('created_at', { ascending: statuses.includes('pending_review') })
    .limit(limit);
  if (error) {
    console.error('Error listing aqlam posts for admin', error);
    throw new Error('تعذّر تحميل النصوص');
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    status: p.status,
    displayName: p.display_name,
    writerId: p.writer_id,
    ageGroup: p.age_group,
    createdAt: p.created_at,
    featured: !!p.featured_at,
  }));
}

export type AdminReportRow = {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  reason: string;
  details: string | null;
  createdAt: string;
  /** عنوان النص أو نص التعليق (للمعاينة). */
  preview: string;
  postId: string | null;
  targetStatus: string | null;
  /** صاحب النص أو التعليق المبلّغ عنه (للعقوبة). */
  writerId: string | null;
};

export async function listOpenReports(limit = 50): Promise<AdminReportRow[]> {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from('aqlam_reports')
    .select('id,target_type,target_id,reason,details,created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('Error listing aqlam reports', error);
    throw new Error('تعذّر تحميل البلاغات');
  }
  const rows = reports ?? [];
  const postIds = rows.filter((r) => r.target_type === 'post').map((r) => r.target_id);
  const commentIds = rows.filter((r) => r.target_type === 'comment').map((r) => r.target_id);

  const [posts, comments] = await Promise.all([
    postIds.length
      ? supabase.from('aqlam_posts').select('id,title,status,writer_id').in('id', postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length
      ? supabase.from('aqlam_comments').select('id,body,post_id,status,author_id').in('id', commentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const postMap = new Map((posts.data ?? []).map((p) => [p.id, p]));
  const commentMap = new Map((comments.data ?? []).map((c) => [c.id, c]));

  return rows.map((r) => {
    const isPost = r.target_type === 'post';
    const post = isPost ? postMap.get(r.target_id) : undefined;
    const comment = isPost ? undefined : commentMap.get(r.target_id);
    return {
      id: r.id,
      targetType: isPost ? 'post' : 'comment',
      targetId: r.target_id,
      reason: r.reason,
      details: r.details,
      createdAt: r.created_at,
      preview: isPost ? (post?.title ?? '(محذوف)') : (comment?.body ?? '(محذوف)'),
      postId: isPost ? r.target_id : (comment?.post_id ?? null),
      targetStatus: isPost ? (post?.status ?? null) : (comment?.status ?? null),
      writerId: isPost ? (post?.writer_id ?? null) : (comment?.author_id ?? null),
    };
  });
}

// ── طلبات أولياء الأمور (قفل التعليقات) ─────────────────────────────────────

export type AdminGuardianRequest = {
  id: string;
  childName: string;
  guardianId: string;
  reason: string;
  createdAt: string;
};

/** الطلبات اللي بتستنى قرار الإدارة (الأقدم أولًا). */
export async function listPendingGuardianRequests(limit = 50): Promise<AdminGuardianRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_guardian_requests')
    .select('id,child_name,guardian_id,reason,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('Error listing aqlam guardian requests for admin', error);
    throw new Error('تعذّر تحميل طلبات أولياء الأمور');
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    childName: r.child_name,
    guardianId: r.guardian_id,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

// ── الحسابات والعقوبات ───────────────────────────────────────────────────────

/** حساب كما تعرضه الإدارة: الاسم والبريد (من دالة بصلاحية الإدارة فقط). */
export type AdminUserLabel = { id: string; fullName: string; email: string | null };

function toLabels(value: unknown): AdminUserLabel[] {
  const out = parseRpcResult(value);
  if (!out.ok || !Array.isArray(out.data.users)) return [];
  return (out.data.users as Record<string, unknown>[]).flatMap((u) =>
    typeof u.id === 'string'
      ? [
          {
            id: u.id,
            fullName: typeof u.full_name === 'string' ? u.full_name : '',
            email: typeof u.email === 'string' ? u.email : null,
          },
        ]
      : [],
  );
}

/** بحث بالاسم أو البريد أو رقم الحساب (حد أدنى حرفين). فاضي لو مفيش نتيجة. */
export async function findUsers(query: string): Promise<AdminUserLabel[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_admin_find_users', { p_query: q });
  if (error) {
    console.error('aqlam_admin_find_users failed', error);
    throw new Error('تعذّر البحث عن الحسابات');
  }
  return toLabels(data);
}

/** أسماء وبريد مجموعة حسابات (لعرضها بدل الأرقام). لو فشل: خريطة فاضية والأرقام تتعرض. */
export async function labelUsers(ids: string[]): Promise<Map<string, AdminUserLabel>> {
  const unique = Array.from(new Set(ids.filter(Boolean))).slice(0, 100);
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_admin_find_users', { p_ids: unique });
  if (error) {
    console.error('aqlam_admin_find_users (ids) failed', error);
    return new Map();
  }
  return new Map(toLabels(data).map((u) => [u.id, u]));
}

export type AdminSanctionRow = {
  id: string;
  userId: string;
  kind: 'warning' | 'suspension_7d' | 'permanent';
  reason: string;
  createdAt: string;
  expiresAt: string | null;
  liftedAt: string | null;
  /** إيقاف سارٍ دلوقتي (التحذير مش إيقاف). */
  active: boolean;
};

export async function listSanctions(limit = 30): Promise<AdminSanctionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_sanctions')
    .select('id,user_id,kind,reason,created_at,expires_at,lifted_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Error listing aqlam sanctions', error);
    throw new Error('تعذّر تحميل العقوبات');
  }
  const now = Date.now();
  return (data ?? []).map((r) => {
    const kind = r.kind === 'permanent' || r.kind === 'suspension_7d' ? r.kind : 'warning';
    return {
      id: r.id,
      userId: r.user_id,
      kind,
      reason: r.reason,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      liftedAt: r.lifted_at,
      active:
        kind !== 'warning' && !r.lifted_at && (!r.expires_at || new Date(r.expires_at).getTime() > now),
    };
  });
}

// ── نسخ النصوص قبل التعديل ──────────────────────────────────────────────────

export type AdminPostEdit = { oldTitle: string; oldBody: string; createdAt: string };

/** النسخ القديمة لنصوص معيّنة (الأحدث أولًا). دليل لو نص سليم اتبدّل بنص مخالف. */
export async function listPostEdits(postIds: string[]): Promise<Map<string, AdminPostEdit[]>> {
  const ids = Array.from(new Set(postIds)).slice(0, 100);
  const out = new Map<string, AdminPostEdit[]>();
  if (ids.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_post_edits')
    .select('post_id,old_title,old_body,created_at')
    .in('post_id', ids)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    // مش حرج: الشاشة بتشتغل من غير النسخ القديمة.
    console.error('Error listing aqlam post edits', error);
    return out;
  }
  for (const e of data ?? []) {
    const list = out.get(e.post_id) ?? [];
    list.push({ oldTitle: e.old_title, oldBody: e.old_body, createdAt: e.created_at });
    out.set(e.post_id, list);
  }
  return out;
}
