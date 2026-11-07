'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { blogPlanProblem, isBlogPlanStatus } from '@/lib/blog-plan';

/**
 * خطة محتوى المدونة. بترجّع ولا بترمي (قاعدة «هـ»)، وكل تعديل بيتأكد إنه
 * لمس صف فعلًا (قاعدة «و»). المهام في «مهامي» بيفتحها/ينقلها/يقفلها محفّز
 * القاعدة على الجدول — مش الكود ده.
 */
export type BlogPlanResult = { ok: true } | { ok: false; error: string; field?: string };

const DENIED = 'خطة المدونة محتاجة صلاحية «إدارة المحتوى»';
const PATH = '/dashboard/admin/content/blog/plan';

async function admin() {
  try {
    return await requireAdmin('canManageContent', DENIED);
  } catch {
    return null;
  }
}

export async function addBlogPlanItem(formData: FormData): Promise<BlogPlanResult> {
  const user = await admin();
  if (!user) return { ok: false, error: DENIED };

  const input = {
    title: String(formData.get('title') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    plannedFor: String(formData.get('plannedFor') ?? ''),
  };
  const problem = blogPlanProblem(input);
  if (problem) return { ok: false, error: problem.message, field: problem.field };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_plan_items')
    .insert({
      title: input.title.trim(),
      notes: input.notes.trim() || null,
      planned_for: input.plannedFor || null,
      created_by: user.id,
    })
    .select('id')
    .maybeSingle();
  if (error || !data) {
    console.error('addBlogPlanItem', error);
    return {
      ok: false,
      error: error?.code === '42P01' ? 'خطة المدونة محتاجة ملف القاعدة 20261107110000 يتشغّل الأول' : 'تعذّر إضافة البند',
    };
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'blog_plan_item_added',
    entityType: 'blog_plan',
    entityId: data.id,
    metadata: { title: input.title.trim(), plannedFor: input.plannedFor || null },
  });
  revalidatePath(PATH);
  return { ok: true };
}

export async function setBlogPlanStatus(id: string, status: string): Promise<BlogPlanResult> {
  const user = await admin();
  if (!user) return { ok: false, error: DENIED };
  if (!isBlogPlanStatus(status)) return { ok: false, error: 'المرحلة غير معروفة' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_plan_items')
    .update({ status })
    .eq('id', id)
    .select('id');
  if (error) {
    console.error('setBlogPlanStatus', error);
    return { ok: false, error: 'تعذّر تغيير المرحلة' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'البند مش موجود — حدّث الصفحة' };

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'blog_plan_status',
    entityType: 'blog_plan',
    entityId: id,
    metadata: { status },
  });
  revalidatePath(PATH);
  revalidatePath('/dashboard/admin/tasks');
  return { ok: true };
}

/**
 * ربط البند بمقال في المدونة. لو المقال منشور فعلًا البند بيخلص على طول —
 * محفّز النشر بيشتغل بس لما المقال **يتحوّل** لمنشور.
 */
export async function linkBlogPlanPost(id: string, postId: string | null): Promise<BlogPlanResult> {
  const user = await admin();
  if (!user) return { ok: false, error: DENIED };

  const supabase = await createClient();
  let published = false;
  if (postId) {
    const { data: post } = await supabase.from('blog_posts').select('id, is_draft').eq('id', postId).maybeSingle();
    if (!post) return { ok: false, error: 'المقال مش موجود' };
    published = post.is_draft === false;
  }

  const patch: { post_id: string | null; status?: 'done' } = { post_id: postId };
  if (published) patch.status = 'done';

  const { data, error } = await supabase
    .from('blog_plan_items')
    .update(patch)
    .eq('id', id)
    .select('id');
  if (error) {
    console.error('linkBlogPlanPost', error);
    return { ok: false, error: 'تعذّر ربط المقال' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'البند مش موجود — حدّث الصفحة' };

  revalidatePath(PATH);
  return { ok: true };
}
