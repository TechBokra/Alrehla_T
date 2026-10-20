/**
 * قائمة «كل النصوص» في إدارة أقلام الرحلة — **حساب نقي بلا شاشة** (حالات، ترتيب،
 * بحث، رابط الفلاتر). الاستعلام نفسه في `data/domains/(shared)/aqlam/admin`.
 */

export const ADMIN_POST_STATUSES = [
  'pending_guardian',
  'pending_review',
  'published',
  'hidden',
  'rejected',
  'removed',
] as const;
export type AdminPostStatus = (typeof ADMIN_POST_STATUSES)[number];

export function isAdminPostStatus(v: unknown): v is AdminPostStatus {
  return (ADMIN_POST_STATUSES as readonly string[]).includes(String(v));
}

export type AdminPostSort = 'new' | 'old' | 'top';
export function isAdminPostSort(v: unknown): v is AdminPostSort {
  return v === 'new' || v === 'old' || v === 'top';
}

/** نمط `like` للبحث في العنوان — بيهرّب `%` و`_` و`\` عشان البحث حرفي. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export type AdminPostsUrlState = {
  st?: string | null;
  c?: string | null;
  a?: string | null;
  s?: string | null;
  q?: string | null;
  p?: number | null;
};

/** رابط شاشة «كل النصوص» بالفلاتر. الافتراضي (الأحدث، الصفحة الأولى) مابيتكتبش. */
export function adminPostsHref(state: AdminPostsUrlState): string {
  const q = new URLSearchParams();
  if (state.st) q.set('st', state.st);
  if (state.c) q.set('c', state.c);
  if (state.a) q.set('a', state.a);
  if (state.s && state.s !== 'new') q.set('s', state.s);
  if (state.q && state.q.trim()) q.set('q', state.q.trim());
  if (state.p && state.p > 1) q.set('p', String(state.p));
  const qs = q.toString();
  return qs ? `/dashboard/admin/aqlam/posts?${qs}` : '/dashboard/admin/aqlam/posts';
}
