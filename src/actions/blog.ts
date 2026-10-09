'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';

/**
 * Writing and publishing blog posts.
 *
 * The admin editor was a `<form>` with no action whose fields were filled with
 * hard-coded sample text ("كيف تشجع طفلك على القراءة") rather than the real
 * article, and whose save button had no handler — so there was no way to
 * publish or edit a post from inside the site at all.
 */

/**
 * ⚠️ **الدوال هنا بترجّع ولا بترمي** (قاعدة «هـ») — Next بيمسح نصّ
 *    الاستثناء في الإنتاج، فـ«اكتب عنوان المقال» كانت بتوصل «خطأ غير متوقع».
 */
export type BlogResult =
  | { ok: true; id: string }
  | { ok: false; error: string; field?: keyof BlogPostInput };

const DENIED = 'غير مصرح لك بإدارة المدونة';

/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال. */
async function requireContentAdmin() {
  // ⚠️ `requireAdmin` بترمي — فبتتلفّ هنا وترجع `null` (قاعدة «هـ»).
  try {
    return await requireAdmin('canManageContent', DENIED);
  } catch {
    return null;
  }
}

/**
 * A URL-safe slug. Arabic characters are kept — Arabic URLs work fine and a
 * transliterated slug would be worse for search than the real title.
 */
function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  authorName: string;
  /** Unpublished posts are dated in the future, which is how the list marks a draft. */
  isPublished: boolean;
  publishedAt: string;
}

function validate(input: BlogPostInput) {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) return { ok: false as const, error: 'اكتب عنوان المقال', field: 'title' as const };
  if (!content) return { ok: false as const, error: 'اكتب محتوى المقال', field: 'content' as const };

  const slug = toSlug(input.slug || title);
  if (!slug) {
    return { ok: false as const, error: 'تعذّر توليد رابط للمقال — غيّر العنوان', field: 'title' as const };
  }

  // A draft is simply not yet published: it keeps a future date so the public
  // listing, which orders and filters by date, never shows it.
  const publishedAt = input.isPublished
    ? input.publishedAt || new Date().toISOString()
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  return {
    ok: true as const,
    row: {
      title,
      slug,
      excerpt: input.excerpt.trim(),
      content,
      cover_image_url: input.coverImageUrl.trim() || null,
      author_name: input.authorName.trim() || 'فريق الرحلة',
      published_at: publishedAt,
      updated_at: new Date().toISOString(),
    },
  };
}

export async function saveBlogPost(id: string | null, input: BlogPostInput): Promise<BlogResult> {
  const admin = await requireContentAdmin();
  if (!admin) return { ok: false, error: DENIED };
  const checked = validate(input);
  if (!checked.ok) return checked;
  const row = checked.row;
  const supabase = await createClient();

  const { data, error } = id
    ? await supabase.from('blog_posts').update(row).eq('id', id).select('id, slug').single()
    : await supabase.from('blog_posts').insert(row).select('id, slug').single();

  if (error || !data) {
    console.error('Error saving blog post', error);
    if (String(error?.message ?? '').toLowerCase().includes('duplicate')) {
      return { ok: false, error: 'يوجد مقال آخر بنفس الرابط — غيّر العنوان أو الرابط', field: 'slug' };
    }
    return { ok: false, error: 'تعذّر حفظ المقال' };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: id ? 'blog_post_updated' : 'blog_post_created',
    entityType: 'BlogPost',
    entityId: data.id,
    metadata: { title: row.title, published: input.isPublished },
  });

  revalidatePath('/dashboard/admin/content/blog');
  revalidatePath('/blog');
  revalidatePath(`/blog/${data.slug}`);
  // والرابط القديم لو العنوان اتغيّر.
  revalidatePath('/blog/[slug]', 'page');
  return { ok: true, id: data.id };
}

/** بعد النجاح بيحوّل لقايمة المقالات — فمش بيرجع حاجة غير لو فشل. */
export async function deleteBlogPost(id: string): Promise<{ ok: false; error: string } | void> {
  const admin = await requireContentAdmin();
  if (!admin) return { ok: false, error: DENIED };
  const supabase = await createClient();

  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  if (error) {
    console.error('Error deleting blog post', error);
    return { ok: false, error: 'تعذّر حذف المقال' };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'blog_post_deleted',
    entityType: 'BlogPost',
    entityId: id,
  });

  revalidatePath('/dashboard/admin/content/blog');
  revalidatePath('/blog');
  // صفحات المقالات بقت بتتخزّن — المقال الممسوح مايفضلش ظاهر من الذاكرة.
  revalidatePath('/blog/[slug]', 'page');
  redirect('/dashboard/admin/content/blog');
}
