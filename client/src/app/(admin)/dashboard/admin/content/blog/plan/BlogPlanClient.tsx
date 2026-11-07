'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, Select, SubmitButton, TextArea, TextInput, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { StatusBadge, type StatusBadgeType } from '@/components/StatusBadge';
import { addBlogPlanItem, linkBlogPlanPost, setBlogPlanStatus } from '@/actions/blog-plan';
import { useAction } from '@/lib/use-action';
import {
  BLOG_PLAN_ACTIVE,
  BLOG_PLAN_LABELS,
  blogPlanLate,
  nextBlogPlanStatus,
  previousBlogPlanStatus,
  type BlogPlanStatus,
} from '@/lib/blog-plan';
import type { BlogPlanItem, BlogPlanPostChoice } from '@/data/domains/(admin)/content/blog-plan';

const BADGE: Record<BlogPlanStatus, StatusBadgeType> = {
  writing: 'pending',
  review: 'info',
  publishing: 'warning',
  done: 'success',
  dropped: 'neutral',
};

function formatDay(d: string): string {
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
}

export function BlogPlanClient({
  items,
  posts,
  today,
  canAssign,
}: {
  items: BlogPlanItem[];
  posts: BlogPlanPostChoice[];
  today: string;
  canAssign: boolean;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const active = items.filter((i) => BLOG_PLAN_ACTIVE.includes(i.status));
  const closed = items.filter((i) => !BLOG_PLAN_ACTIVE.includes(i.status));

  return (
    <div className="space-y-8">
      <section className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium leading-7 text-slate-700">
        <p>
          كل مقال مخطّط بيمشي <strong>الكتابة ← المراجعة ← النشر</strong>، وكل مرحلة بتظهر مهمة في «مهامي» لمسؤولها
          بموعدها. اربط البند بالمقال لما تبدأ تكتبه في المدونة — وأول ما المقال يتنشر البند بيخلص لوحده.
        </p>
        <p>
          المسؤولين عن كل مرحلة ومهلها من{' '}
          {canAssign ? (
            <Link href="/dashboard/admin/tasks/workflow?group=blog" className="font-bold text-blue-700 hover:underline">
              سير العمل والتوزيع ← المدونة
            </Link>
          ) : (
            <strong>سير العمل والتوزيع ← المدونة</strong>
          )}
          .
        </p>
      </section>

      <section aria-labelledby="add-h" className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 id="add-h" className="mb-4 text-lg font-black text-slate-900">
          مقال جديد في الخطة
        </h2>
        <ActionForm action={addBlogPlanItem} successMessage="اتضاف للخطة — ومهمة «الكتابة» اتفتحت." className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="العنوان المبدئي" name="title" required className="md:col-span-2">
              <TextInput name="title" maxLength={160} placeholder="مثال: ٥ طرق تخلّي طفلك يحب الكتابة" />
            </Field>
            <Field label="ميعاد النشر المخطّط" name="plannedFor">
              <TextInput name="plannedFor" type="date" dir="ltr" />
            </Field>
          </div>
          <Field label="ملاحظات للكاتب" name="notes" hint="الفكرة، الجمهور، مراجع، كلمات بحث…">
            <TextArea name="notes" rows={3} maxLength={2000} />
          </Field>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="جارٍ الإضافة…">إضافة للخطة</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section aria-labelledby="active-h" className="space-y-3">
        <h2 id="active-h" className="text-lg font-black text-slate-900">
          شغّال ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-600">مفيش مقالات مخطّطة دلوقتي.</p>
        ) : (
          <ul className="space-y-3">
            {active.map((item) => (
              <PlanRow key={item.id} item={item} posts={posts} late={blogPlanLate(item, today)} />
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section aria-labelledby="closed-h" className="space-y-3">
          <button
            type="button"
            id="closed-h"
            onClick={() => setShowClosed((v) => !v)}
            aria-expanded={showClosed}
            className="min-h-[44px] text-base font-black text-slate-700 hover:underline"
          >
            {showClosed ? 'إخفاء' : 'عرض'} المنتهي والملغي ({closed.length})
          </button>
          {showClosed && (
            <ul className="space-y-3">
              {closed.map((item) => (
                <PlanRow key={item.id} item={item} posts={posts} late={false} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function PlanRow({ item, posts, late }: { item: BlogPlanItem; posts: BlogPlanPostChoice[]; late: boolean }) {
  const router = useRouter();
  const move = useAction(setBlogPlanStatus, { onSuccess: () => router.refresh(), fallbackError: 'تعذّر تغيير المرحلة' });
  const link = useAction(linkBlogPlanPost, { onSuccess: () => router.refresh(), fallbackError: 'تعذّر ربط المقال' });
  const next = nextBlogPlanStatus(item.status);
  const prev = previousBlogPlanStatus(item.status);
  const isActive = BLOG_PLAN_ACTIVE.includes(item.status);
  const busy = move.pending || link.pending;

  return (
    <li className={`rounded-2xl border bg-white p-5 ${late ? 'border-rose-300' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-black text-slate-900">{item.title}</p>
          <p className="text-sm font-medium text-slate-600">
            {item.plannedFor ? `النشر: ${formatDay(item.plannedFor)}` : 'من غير ميعاد نشر'}
            {late && <span className="ms-2 font-bold text-rose-700">— الميعاد عدّى</span>}
          </p>
        </div>
        <StatusBadge type={BADGE[item.status]} label={BLOG_PLAN_LABELS[item.status]} />
      </div>

      {item.notes && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{item.notes}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-bold text-slate-700">المقال:</span>
        {item.postId ? (
          <Link href={`/dashboard/admin/content/blog/${item.postId}`} className="font-bold text-blue-700 hover:underline">
            {item.postTitle ?? 'مقال محذوف'}
            {item.postPublished ? ' (منشور)' : ' (مسودة)'}
          </Link>
        ) : (
          <span className="text-slate-500">لسه مش مربوط</span>
        )}
        {isActive && (
          <>
            <label className="sr-only" htmlFor={`post-${item.id}`}>
              اربط بمقال
            </label>
            <Select
              id={`post-${item.id}`}
              value={item.postId ?? ''}
              disabled={busy}
              onChange={(e) => link.run(item.id, e.target.value || null)}
              className="!w-auto min-w-[14rem]"
            >
              <option value="">— اختار مقال من المدونة —</option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.published ? ' (منشور)' : ''}
                </option>
              ))}
            </Select>
            <Link href="/dashboard/admin/content/blog/new" className="font-bold text-blue-700 hover:underline">
              اكتب مقال جديد
            </Link>
          </>
        )}
      </div>

      <FormError message={move.error || link.error} className="mt-3" />

      {isActive ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {next && (
            <BusyButton busy={move.pending} onClick={() => move.run(item.id, next)} disabled={busy}>
              {next === 'done' ? 'اتنشر ✓' : `انقل لـ«${BLOG_PLAN_LABELS[next]}»`}
            </BusyButton>
          )}
          {prev && (
            <BusyButton busy={false} variant="secondary" onClick={() => move.run(item.id, prev)} disabled={busy}>
              رجّع لـ«{BLOG_PLAN_LABELS[prev]}»
            </BusyButton>
          )}
          <BusyButton
            busy={false}
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (confirm('إلغاء المقال ده من الخطة؟ مهمته هتتقفل.')) move.run(item.id, 'dropped');
            }}
          >
            إلغاء من الخطة
          </BusyButton>
        </div>
      ) : (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <BusyButton busy={move.pending} variant="secondary" onClick={() => move.run(item.id, 'writing')} disabled={busy}>
            رجّعه للخطة
          </BusyButton>
        </div>
      )}
    </li>
  );
}
