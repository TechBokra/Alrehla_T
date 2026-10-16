import { createClient } from '@/lib/supabase/server';
import { parseRpcResult } from '@/lib/aqlam/errors';

/** قراءة بصلاحية المستخدم نفسه (RLS): نصوصه، وللولي نصوص أبنائه. */

export type MyPostRow = {
  id: string;
  title: string;
  status: string;
  displayName: string;
  createdAt: string;
  publishedAt: string | null;
  reactionCount: number;
  commentCount: number;
  category: string;
  editedAt: string | null;
  /** مستند مساحة الكتابة اللي النسخة اتاخدت منه (إشارة بس). */
  sourceDocumentId: string | null;
};

const COLUMNS =
  'id,title,status,display_name,created_at,published_at,reaction_count,comment_count,category,edited_at,source_document_id';

type PostRowDb = {
  id: string;
  title: string;
  status: string;
  display_name: string;
  created_at: string;
  published_at: string | null;
  reaction_count: number;
  comment_count: number;
  category: string;
  edited_at: string | null;
  source_document_id: string | null;
};

function toMyPostRow(p: PostRowDb): MyPostRow {
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    displayName: p.display_name,
    createdAt: p.created_at,
    publishedAt: p.published_at,
    reactionCount: p.reaction_count,
    commentCount: p.comment_count,
    category: p.category,
    editedAt: p.edited_at,
    sourceDocumentId: p.source_document_id,
  };
}

export async function listMyPosts(userId: string): Promise<MyPostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_posts')
    .select(COLUMNS)
    .eq('writer_id', userId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('Error listing my aqlam posts', error);
    throw new Error('تعذّر تحميل نصوصك');
  }
  return (data ?? []).map(toMyPostRow);
}

/** نص واحد من نصوصي للتعديل (كامل). null لو مش بتاعي أو اتشال. */
export type MyPostDetail = MyPostRow & {
  body: string;
  ageGroup: 'under_12' | '12_plus';
  allowIndexing: boolean;
  commentsEnabled: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getMyPost(userId: string, postId: string): Promise<MyPostDetail | null> {
  if (!UUID_RE.test(postId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_posts')
    .select(`${COLUMNS},body,age_group,allow_indexing,comments_enabled`)
    .eq('id', postId)
    .eq('writer_id', userId)
    .neq('status', 'removed')
    .maybeSingle();
  if (error) {
    console.error('Error reading my aqlam post', error);
    throw new Error('تعذّر تحميل النص');
  }
  if (!data) return null;
  return {
    ...toMyPostRow(data),
    body: data.body,
    ageGroup: data.age_group === '12_plus' ? '12_plus' : 'under_12',
    allowIndexing: data.allow_indexing,
    commentsEnabled: data.comments_enabled,
  };
}

/** ملف الكاتب (اسم القلم والنبذة وخيار الصفحة العامة). RLS: صاحبه بس. */
export type MyWriterProfile = {
  penName: string;
  bio: string;
  isPublic: boolean;
  slug: string | null;
};

export async function getMyWriterProfile(userId: string): Promise<MyWriterProfile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_writer_profiles')
    .select('pen_name,bio,public_profile,public_slug')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Error reading my aqlam writer profile', error);
    throw new Error('تعذّر تحميل ملفك');
  }
  return {
    penName: data?.pen_name ?? '',
    bio: data?.bio ?? '',
    isPublic: data?.public_profile === true,
    slug: data?.public_slug ?? null,
  };
}

export type GuardianPostRow = MyPostRow & { body: string; writerId: string };

/** نصوص الأبناء اللي بتستنى قرار ولي الأمر. RLS بتقصرها على أبنائه. */
export async function listPostsAwaitingGuardian(): Promise<GuardianPostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_posts')
    .select(`${COLUMNS},body,writer_id`)
    .eq('status', 'pending_guardian')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) {
    console.error('Error listing posts awaiting guardian', error);
    throw new Error('تعذّر تحميل النصوص');
  }
  return (data ?? []).map((p) => ({
    ...toMyPostRow(p),
    body: p.body,
    writerId: p.writer_id,
  }));
}

/** حالة الحساب الحالي في أقلام الرحلة (من دالة القاعدة `aqlam_my_status`). */
export type MyAqlamStatus = {
  enabled: boolean;
  suspended: boolean;
  isChild: boolean;
  ageGroup: 'under_12' | '12_plus';
  needsBirthdate: boolean;
  publishingLocked: boolean;
  fullName: string;
  isAdmin: boolean;
  isInstructor: boolean;
};

export async function getMyAqlamStatus(): Promise<MyAqlamStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_my_status');
  if (error) {
    console.error('aqlam_my_status failed', error);
    return null;
  }
  const out = parseRpcResult(data);
  if (!out.ok) return null;
  const s = out.data;
  return {
    enabled: s.enabled === true,
    suspended: s.suspended === true,
    isChild: s.is_child === true,
    ageGroup: s.age_group === '12_plus' ? '12_plus' : 'under_12',
    needsBirthdate: s.needs_birthdate === true,
    publishingLocked: s.publishing_locked === true,
    fullName: typeof s.full_name === 'string' ? s.full_name : '',
    isAdmin: s.is_admin === true,
    isInstructor: s.is_instructor === true,
  };
}

/** إعدادات القفل لأبناء ولي الأمر الحالي (RLS). غياب الصف = مسموح. */
export async function listGuardianSettings(): Promise<
  Record<string, { publishingAllowed: boolean; commentsAllowed: boolean }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_guardian_settings')
    .select('child_id,publishing_allowed,comments_allowed');
  if (error) {
    console.error('Error listing aqlam guardian settings', error);
    throw new Error('تعذّر تحميل الإعدادات');
  }
  return Object.fromEntries(
    (data ?? []).map((r) => [
      r.child_id,
      { publishingAllowed: r.publishing_allowed, commentsAllowed: r.comments_allowed },
    ]),
  );
}
