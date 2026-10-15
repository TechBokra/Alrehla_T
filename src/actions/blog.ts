'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { isPublishMode, resolvePublishing, type PublishMode } from '@/lib/blog-publish';
import { cairoLocalToIso } from '@/lib/promotions';

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
  /** منشور / مجدول / مسودة — الحالة اللي الأدمن اختارها صراحةً. */
  publishMode: PublishMode;
  /** موعد النشر المجدول بتوقيت القاهرة `YYYY-MM-DDTHH:mm` (مطلوب لو `scheduled`). */
  scheduledAt: string;
}

type ChecksOk = {
  ok: true;
  row: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    cover_image_url: string | null;
    author_name: string;
    updated_at: string;
  };
};

/** تحقق من النص (العنوان والمحتوى والرابط). حالة النشر بتتحدد لوحدها بعد قراءة المقال الحالي. */
function validate(input: BlogPostInput): ChecksOk | { ok: false; error: string; field: keyof BlogPostInput } {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) return { ok: false, error: 'اكتب عنوان المقال', field: 'title' };
  if (!content) return { ok: false, error: 'اكتب محتوى المقال', field: 'content' };
  if (!isPublishMode(input.publishMode)) {
    return { ok: false, error: 'اختر حالة النشر', field: 'publishMode' };
  }

  const slug = toSlug(input.slug || title);
  if (!slug) {
    return { ok: false, error: 'تعذّر توليد رابط للمقال — غيّر العنوان', field: 'title' };
  }

  return {
    ok: true,
    row: {
      title,
      slug,
      excerpt: input.excerpt.trim(),
      content,
      cover_image_url: input.coverImageUrl.trim() || null,
      author_name: input.authorName.trim() || 'فريق الرحلة',
      updated_at: new Date().toISOString(),
    },
  };
}

export async function saveBlogPost(id: string | null, input: BlogPostInput): Promise<BlogResult> {
  const admin = await requireContentAdmin();
  if (!admin) return { ok: false, error: DENIED };
  const checked = validate(input);
  if (!checked.ok) return checked;
  const supabase = await createClient();

  // الحالة الحالية من القاعدة — مش من المتصفح — عشان تعديل مقال منشور
  // ما يغيّرش تاريخ نشره، ولا حد يقدر يبعت تاريخ مزيّف.
  let existing: { isDraft: boolean; publishedAt: string } | null = null;
  if (id) {
    const { data: current, error: currentError } = await supabase
      .from('blog_posts')
      .select('is_draft, published_at')
      .eq('id', id)
      .maybeSingle();
    if (currentError) {
      console.error('Error reading blog post before save', currentError);
      return { ok: false, error: 'تعذّر حفظ المقال' };
    }
    if (!current) return { ok: false, error: 'المقال غير موجود — ربما اتحذف' };
    existing = { isDraft: current.is_draft, publishedAt: current.published_at };
  }

  const publishing = resolvePublishing({
    mode: input.publishMode,
    scheduledAtIso: cairoLocalToIso(input.scheduledAt),
    existing,
    now: new Date(),
  });
  if (!publishing.ok) return publishing;

  const row = { ...checked.row, is_draft: publishing.isDraft, published_at: publishing.publishedAt };

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
    metadata: { title: row.title, mode: input.publishMode, publishedAt: row.published_at },
  });

  revalidatePath('/dashboard/admin/content/blog');
  refreshPublicPages();
  // والرابط القديم لو العنوان اتغيّر.
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
  refreshPublicPages();
  // صفحات المقالات بقت بتتخزّن — المقال الممسوح مايفضلش ظاهر من الذاكرة.
  redirect('/dashboard/admin/content/blog');
}
