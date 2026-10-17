import Link from 'next/link';
import { ArrowDown, ArrowUp, Pin, PinOff } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { DecisionButton } from '@/components/forms/DecisionButton';
import { TextInput } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import {
  ADMIN_POSTS_PAGE_SIZE,
  labelUsers,
  listAdminPostsPage,
  listPinnedAdminPosts,
  type AdminPostListRow,
  type AdminUserLabel,
} from '@/data/domains/(shared)/aqlam/admin';
import { moderatePost, pinPost } from '@/actions/aqlam';
import { Heading, Person } from '../_shared';
import {
  ADMIN_POST_STATUSES,
  adminPostsHref,
  isAdminPostSort,
  isAdminPostStatus,
  type AdminPostSort,
} from '@/lib/aqlam/admin-list';
import { AGE_BANDS, ageBandById, isAgeBandId } from '@/lib/age-bands';
import {
  AQLAM_CATEGORIES,
  AQLAM_LIMITS,
  AQLAM_REMOVED_RETENTION_DAYS,
  categoryLabel,
  isAqlamCategory,
} from '@/lib/aqlam/post';
import { postStatusLabel } from '@/lib/aqlam/status-labels';
import { hasAdminPermission, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ st?: string; c?: string; a?: string; s?: string; q?: string; p?: string }>;

const chip =
  'inline-flex min-h-[40px] shrink-0 items-center rounded-full border px-4 text-sm font-bold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ';
const chipOff = 'border-slate-200 bg-white text-slate-700 hover:border-slate-400';
const chipOn = 'border-slate-900 bg-slate-900 text-white';
const chipRow = 'flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const SORTS: { key: AdminPostSort; label: string }[] = [
  { key: 'new', label: 'الأحدث' },
  { key: 'old', label: 'الأقدم' },
  { key: 'top', label: 'الأكتر تشجيعًا' },
];

/** إجراءات نص واحد: تثبيت/إخفاء/استرجاع/إزالة (والسبب اختياري ويوصل لسجل المراجعة). */
function PostActions({ p, pinnedCount }: { p: AdminPostListRow; pinnedCount: number }) {
  if (p.status === 'removed') {
    const purgeAt = p.removedAt
      ? formatDate(new Date(Date.parse(p.removedAt) + AQLAM_REMOVED_RETENTION_DAYS * 86_400_000).toISOString())
      : null;
    return (
      <p className="text-xs font-bold text-slate-500">
        اتشال{p.removedAt ? ` ${formatDate(p.removedAt)}` : ''}
        {purgeAt && ` · بيتمسح نهائيًا ${purgeAt}`}
      </p>
    );
  }
  if (p.status === 'pending_review') {
    return (
      <Link href="/dashboard/admin/aqlam#review" className="text-sm font-bold text-slate-900 underline underline-offset-4">
        راجعه من الصندوق
      </Link>
    );
  }
  if (p.status === 'pending_guardian') {
    return <p className="text-xs font-bold text-slate-500">بانتظار موافقة ولي الأمر.</p>;
  }
  return (
    <div className="flex flex-wrap items-end gap-3">
      {p.status === 'published' && !p.pinned && pinnedCount >= AQLAM_LIMITS.maxPinned && (
        <p className="text-xs font-bold text-amber-800">وصلت للحد الأقصى للمثبّت — فُكّ تثبيت نص الأول.</p>
      )}
      {p.status === 'published' && (
        <ActionForm action={pinPost}>
          <input type="hidden" name="postId" value={p.id} />
          {p.pinned ? (
            <DecisionButton name="op" value="unpin" variant="secondary" pendingLabel="جارٍ…">
              <PinOff className="ml-1.5 h-4 w-4" aria-hidden="true" />
              فك التثبيت
            </DecisionButton>
          ) : (
            <DecisionButton
              name="op"
              value="pin"
              variant="secondary"
              pendingLabel="جارٍ…"
              disabled={pinnedCount >= AQLAM_LIMITS.maxPinned}
            >
              <Pin className="ml-1.5 h-4 w-4" aria-hidden="true" />
              تثبيت
            </DecisionButton>
          )}
        </ActionForm>
      )}
      <ActionForm action={moderatePost} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="postId" value={p.id} />
        <label className="sr-only" htmlFor={`reason-${p.id}`}>
          السبب (اختياري)
        </label>
        <TextInput id={`reason-${p.id}`} name="reason" maxLength={300} placeholder="السبب (اختياري)" className="!w-48" />
        {p.status === 'published' ? (
          <DecisionButton name="decision" value="hide" variant="secondary" pendingLabel="جارٍ…">
            إخفاء
          </DecisionButton>
        ) : p.status === 'hidden' ? (
          <DecisionButton name="decision" value="restore" variant="secondary" pendingLabel="جارٍ…">
            استرجاع
          </DecisionButton>
        ) : null}
        <DecisionButton name="decision" value="remove" variant="secondary" accentColor="enhaLak" pendingLabel="جارٍ…">
          إزالة
        </DecisionButton>
      </ActionForm>
    </div>
  );
}

export default async function AqlamPostsAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) return <Unauthorized />;
  const sp = await searchParams;

  const status = isAdminPostStatus(sp.st) ? sp.st : null;
  const category = isAqlamCategory(sp.c) ? sp.c : null;
  const band = isAgeBandId(sp.a) ? sp.a : null;
  const sort: AdminPostSort = isAdminPostSort(sp.s) ? sp.s : 'new';
  const q = (sp.q ?? '').trim().slice(0, 80);
  const page = Math.max(1, Math.min(500, Number.parseInt(sp.p ?? '1', 10) || 1));

  const [{ rows, total }, pinned] = await Promise.all([
    listAdminPostsPage({ status, category, band, sort, q, page }),
    listPinnedAdminPosts(),
  ]);
  const labels: Map<string, AdminUserLabel> = await labelUsers([
    ...rows.map((p) => p.writerId),
    ...pinned.map((p) => p.writerId),
  ]);

  const cur = { st: status, c: category, a: band, s: sort, q };
  const hasNext = page * ADMIN_POSTS_PAGE_SIZE < total;
  const filtered = Boolean(status || category || band || q.length >= 2 || sort !== 'new');

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-12 px-6 py-12">
      <DashboardPageHeader title="أقلام الرحلة — كل النصوص" />

      {/* ── المختارات المثبّتة ── */}
      <section aria-labelledby="pinned" className="space-y-4">
        <Heading id="pinned">
          المختارات المثبّتة ({pinned.length.toLocaleString('ar-EG')} من {AQLAM_LIMITS.maxPinned.toLocaleString('ar-EG')})
        </Heading>
        <p className="text-sm font-medium text-slate-500">
          بتظهر في أول صفحة «أقلام الرحلة» في شريط «مختارات الرحلة» بالترتيب ده. لتثبيت نص منشور استخدم «تثبيت» من القايمة
          تحت. النص اللي بيتخبّى أو يتشال بيتفك تثبيته لوحده.
        </p>
        {pinned.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">مفيش نصوص مثبّتة.</p>
        ) : (
          <ol className="space-y-2">
            {pinned.map((p, i) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-amber-950">
                    {(i + 1).toLocaleString('ar-EG')}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/aqlam/p/${p.id}`}
                      className="block truncate font-black text-slate-900 underline-offset-4 hover:underline"
                    >
                      {p.title}
                    </Link>
                    <span className="text-xs font-medium text-slate-500">{p.displayName}</span>
                  </div>
                </div>
                <ActionForm action={pinPost} className="flex items-center gap-2">
                  <input type="hidden" name="postId" value={p.id} />
                  <DecisionButton name="op" value="up" variant="secondary" pendingLabel="…" disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">حرّك لفوق</span>
                  </DecisionButton>
                  <DecisionButton
                    name="op"
                    value="down"
                    variant="secondary"
                    pendingLabel="…"
                    disabled={i === pinned.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">حرّك لتحت</span>
                  </DecisionButton>
                  <DecisionButton name="op" value="unpin" variant="secondary" pendingLabel="جارٍ…">
                    فك التثبيت
                  </DecisionButton>
                </ActionForm>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ── كل النصوص ── */}
      <section aria-labelledby="all" className="space-y-5">
        <Heading id="all">كل النصوص ({total.toLocaleString('ar-EG')})</Heading>

        <nav aria-label="تصفية النصوص" className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="space-y-1.5">
            <span className="text-xs font-black text-slate-500">الحالة</span>
            <div className={chipRow}>
              <Link href={adminPostsHref({ ...cur, st: null })} className={chip + (!status ? chipOn : chipOff)} aria-current={!status ? 'true' : undefined}>
                الكل
              </Link>
              {ADMIN_POST_STATUSES.map((st) => (
                <Link
                  key={st}
                  href={adminPostsHref({ ...cur, st })}
                  className={chip + (status === st ? chipOn : chipOff)}
                  aria-current={status === st ? 'true' : undefined}
                >
                  {postStatusLabel(st).label}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-black text-slate-500">النوع</span>
            <div className={chipRow}>
              <Link href={adminPostsHref({ ...cur, c: null })} className={chip + (!category ? chipOn : chipOff)} aria-current={!category ? 'true' : undefined}>
                الكل
              </Link>
              {AQLAM_CATEGORIES.map((c) => (
                <Link
                  key={c.key}
                  href={adminPostsHref({ ...cur, c: c.key })}
                  className={chip + (category === c.key ? chipOn : chipOff)}
                  aria-current={category === c.key ? 'true' : undefined}
                >
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-black text-slate-500">السن</span>
            <div className={chipRow}>
              <Link href={adminPostsHref({ ...cur, a: null })} className={chip + (!band ? chipOn : chipOff)} aria-current={!band ? 'true' : undefined}>
                الكل
              </Link>
              {AGE_BANDS.map((b) => (
                <Link
                  key={b.id}
                  href={adminPostsHref({ ...cur, a: b.id })}
                  className={chip + (band === b.id ? b.tone.chipActive : b.tone.chip)}
                  aria-current={band === b.id ? 'true' : undefined}
                >
                  {b.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-black text-slate-500">الترتيب</span>
            <div className={chipRow}>
              {SORTS.map((o) => (
                <Link
                  key={o.key}
                  href={adminPostsHref({ ...cur, s: o.key })}
                  className={chip + (sort === o.key ? chipOn : chipOff)}
                  aria-current={sort === o.key ? 'true' : undefined}
                >
                  {o.label}
                </Link>
              ))}
            </div>
          </div>
          <form method="get" action="/dashboard/admin/aqlam/posts" className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
            {status && <input type="hidden" name="st" value={status} />}
            {category && <input type="hidden" name="c" value={category} />}
            {band && <input type="hidden" name="a" value={band} />}
            {sort !== 'new' && <input type="hidden" name="s" value={sort} />}
            <div className="min-w-0 flex-1">
              <label htmlFor="aqlam-post-q" className="mb-1 block text-sm font-bold text-slate-700">
                بحث في العنوان
              </label>
              <input
                id="aqlam-post-q"
                name="q"
                type="search"
                defaultValue={q}
                maxLength={80}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-[48px] items-center rounded-full bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              بحث
            </button>
            {filtered && (
              <Link
                href="/dashboard/admin/aqlam/posts"
                className="inline-flex min-h-[48px] items-center px-2 text-sm font-bold text-slate-700 underline underline-offset-4"
              >
                مسح التصفية
              </Link>
            )}
          </form>
        </nav>

        {rows.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
            {filtered ? 'مفيش نصوص بالتصفية دي.' : 'لسه مفيش نصوص.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((p) => {
              const st = postStatusLabel(p.status);
              const b = p.ageBand && isAgeBandId(p.ageBand) ? ageBandById(p.ageBand) : null;
              return (
                <li key={p.id} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {p.status === 'published' ? (
                      <Link href={`/aqlam/p/${p.id}`} className="font-black text-slate-900 underline-offset-4 hover:underline [overflow-wrap:anywhere]">
                        {p.title}
                      </Link>
                    ) : (
                      <span className="font-black text-slate-900 [overflow-wrap:anywhere]">{p.title}</span>
                    )}
                    <span className="flex items-center gap-2">
                      {p.pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-amber-950">
                          <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                          مثبّت
                        </span>
                      )}
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.tone}`}>{st.label}</span>
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {categoryLabel(p.category) || 'نص'}
                    {b && ` · ${b.label}`} · يظهر باسم {p.displayName} · {formatDate(p.publishedAt ?? p.createdAt)}
                    {p.status === 'published' &&
                      ` · ${p.reactionCount.toLocaleString('ar-EG')} تشجيع · ${p.commentCount.toLocaleString('ar-EG')} تعليق`}
                  </p>
                  <p className="text-xs">
                    الكاتب: <Person id={p.writerId} labels={labels} />
                  </p>
                  <PostActions p={p} pinnedCount={pinned.length} />
                </li>
              );
            })}
          </ul>
        )}

        {(page > 1 || hasNext) && (
          <nav aria-label="الصفحات" className="flex items-center justify-between">
            {page > 1 ? (
              <Link href={adminPostsHref({ ...cur, p: page - 1 })} className={chip + chipOff}>
                السابق
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm font-bold text-slate-500">صفحة {page.toLocaleString('ar-EG')}</span>
            {hasNext ? (
              <Link href={adminPostsHref({ ...cur, p: page + 1 })} className={chip + chipOff}>
                التالي
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
