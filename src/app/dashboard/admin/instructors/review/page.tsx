import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2, ImageIcon, User } from 'lucide-react';
import { requireAdmin } from '@/lib/auth-guard';
import {
  getInstructorMediaForAdmin,
  getInstructorReviewGroups,
  type InstructorReviewGroup,
} from '@/data/domains/instructor-media';
import { getWritingPackages } from '@/data/domains/writing';
import { reviewInstructorMedia, revokeInstructorMedia } from '@/actions/instructor-media';
import { reviewProfileRequest, approveAllForInstructor } from '@/actions/instructor-review';
import { getInstructorChangeItems } from '@/lib/request-summary';
import { isProfileComplete } from '@/lib/instructor-onboarding';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * مراجعة ملفات المدربين — **المكان الواحد**.
 *
 * المدرب بيعدّل ملفه وصوره من صفحة واحدة («ملفي وصوري» + «الإعدادات»
 * للجدول والباقات)، والإدارة كانت بتراجع الملف في صفحة كل مدرب والصور
 * في شاشة تانية. دلوقتي كل اللي مستني — تعديلات الملف والغلاف وصور
 * الأعمال — هنا، متجمّع بالمدرب، ومع البيانات الحالية للمقارنة.
 *
 * ⚠️ **والصورة بتتعرض `contain` لا `cover`**: الإداري بيوافق على اللي
 *    **هو شايفه**. لو الشاشة قصّت الصورة، هو بيوافق على جزء والعميل
 *    بيشوف الكامل.
 */
export default async function InstructorReviewPage() {
  await requireAdmin('canManageInstructors');
  const [groups, decided, packages] = await Promise.all([
    getInstructorReviewGroups(),
    getInstructorMediaForAdmin(),
    getWritingPackages(),
  ]);
  const pkgNames = packages.map((p) => ({ id: p.id, name: p.name }));

  // الصور اللي اتبتّ فيها، بالمدرب — «إيه اللي ظاهر في صفحة فلان؟».
  const byInstructor = new Map<string, typeof decided>();
  for (const item of decided) {
    const list = byInstructor.get(item.instructorId) ?? [];
    list.push(item);
    byInstructor.set(item.instructorId, list);
  }

  const pendingCount = groups.reduce((n, g) => n + g.requests.length + g.media.length, 0);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-black text-slate-900">مراجعة ملفات المدربين</h1>
        <p className="text-sm font-medium text-slate-600">
          كل اللي المدربين بعتوه للمراجعة في مكان واحد: تعديلات الملف (الاسم،
          النبذة، التخصصات، سنين الخبرة، الجدول، الباقات) و<strong>الغلاف وصور
          الإصدارات والأعمال</strong>. ولا حاجة منهم بتظهر للأهالي قبل ما تعتمدها.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-xl font-black text-slate-900">
          مستني المراجعة {pendingCount > 0 && `(${pendingCount})`}
        </h2>

        {groups.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-lg font-black text-slate-800">مفيش حاجة مستنية</p>
            <p className="text-sm font-medium text-slate-600">
              أول ما مدرب يبعت تعديل في ملفه أو يرفع صورة، هتلاقيه هنا.
            </p>
          </Card>
        ) : (
          groups.map((group) => (
            <InstructorGroup key={group.instructorId} group={group} packages={pkgNames} />
          ))
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-black text-slate-900">الصور اللي اتبتّ فيها</h2>
        <p className="text-sm font-medium text-slate-600">
          «ظاهرة» = في صفحة المدرب العامة دلوقتي. لو صورة اتعتمدت بالغلط، اسحبها
          بسبب — بتتحوّل «مرفوضة» والسبب بيوصل للمدرب.
        </p>

        {byInstructor.size === 0 ? (
          <Card className="py-10 text-center text-sm font-medium text-slate-600">
            لسه مفيش صور معتمدة أو مرفوضة.
          </Card>
        ) : (
          [...byInstructor.entries()].map(([instructorId, items]) => (
            <Card key={instructorId} className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/dashboard/admin/instructors/${instructorId}`}
                  className="text-brand-strong font-black hover:underline"
                >
                  {items[0].instructorName}
                </Link>
                <Link
                  href={`/creative-writing/instructors/${instructorId}`}
                  target="_blank"
                  className="text-xs font-bold text-slate-600 hover:underline"
                >
                  صفحته العامة ↗
                </Link>
              </div>

              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200"
                  >
                    <div className="relative aspect-[4/3] w-full bg-slate-50">
                      <Image
                        src={optimizedImageUrl(item.imageUrl, 600)}
                        alt={item.title ?? 'صورة مدرب'}
                        fill
                        sizes="(max-width: 768px) 100vw, 320px"
                        className="object-contain p-3"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                          {item.kind === 'cover' ? 'غلاف' : 'عمل'}
                        </span>
                        <StatusBadge
                          type={item.status === 'approved' ? 'success' : 'danger'}
                          label={item.status === 'approved' ? 'ظاهرة' : 'مرفوضة'}
                        />
                      </div>
                      {item.title && (
                        <p className="text-sm font-bold text-slate-800">{item.title}</p>
                      )}
                      {item.status === 'rejected' && item.adminFeedback && (
                        <p className="text-xs font-medium text-slate-600">
                          السبب: {item.adminFeedback}
                        </p>
                      )}
                      {item.status === 'approved' && (
                        <ActionForm action={revokeInstructorMedia} className="mt-auto space-y-2 pt-2">
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            name="feedback"
                            maxLength={300}
                            placeholder="سبب السحب — بيوصل للمدرب"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-medium outline-none focus:border-amber-500 md:text-sm"
                          />
                          <Button type="submit" variant="secondary" accentColor="enhaLak">
                            سحب الاعتماد
                          </Button>
                        </ActionForm>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PROFILE_FIELDS: {
  key: 'displayName' | 'bio' | 'specialties' | 'yearsExperience';
  label: string;
}[] = [
  { key: 'displayName', label: 'الاسم المعروض' },
  { key: 'bio', label: 'النبذة' },
  { key: 'specialties', label: 'التخصصات' },
  { key: 'yearsExperience', label: 'سنين الخبرة' },
];

function show(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join('، ') : '—';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function InstructorGroup({
  group,
  packages,
}: {
  group: InstructorReviewGroup;
  packages: { id: string; name: string }[];
}) {
  const isNew = !isProfileComplete(group);
  const current: Record<string, unknown> = {
    displayName: group.displayName,
    bio: group.bio,
    specialties: group.specialties,
    yearsExperience: group.yearsExperience,
  };

  return (
    <Card className="space-y-6 p-6">
      {/* رأس المدرب */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
            {group.avatarUrl ? (
              <Image
                src={optimizedImageUrl(group.avatarUrl, 200)}
                alt={group.displayName}
                fill
                sizes="64px"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="m-auto mt-4 h-8 w-8 text-slate-300" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/admin/instructors/${group.instructorId}`}
                className="text-lg font-black text-slate-900 hover:underline"
              >
                {group.displayName}
              </Link>
              {isNew && <StatusBadge type="pending" label="مدرب جديد — ملفه الأول" />}
            </div>
            <p className="text-xs font-medium text-slate-500">
              {group.requests.length > 0 && `${group.requests.length} تعديل ملف`}
              {group.requests.length > 0 && group.media.length > 0 && ' · '}
              {group.media.length > 0 && `${group.media.length} صورة`}
            </p>
          </div>
        </div>

        <ActionForm action={approveAllForInstructor}>
          <input type="hidden" name="instructorId" value={group.instructorId} />
          <Button type="submit" accentColor="journey">
            اعتماد كل اللي مستني
          </Button>
        </ActionForm>
      </div>

      {isNew && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-medium text-sky-900">
          بعد ما تعتمد ملفه الأول: من{' '}
          <Link
            href={`/dashboard/admin/instructors/${group.instructorId}`}
            className="font-bold underline"
          >
            صفحته
          </Link>{' '}
          علّم «اجتاز التدريب» وبعدين «تفعيل» — ساعتها بس بيظهر للأهالي.
        </p>
      )}

      {/* تعديلات الملف */}
      {group.requests.map((req) => {
        const changes = req.requestedChanges;
        const profileRows = PROFILE_FIELDS.filter((f) => changes[f.key] !== undefined);
        const otherItems = getInstructorChangeItems(
          Object.fromEntries(
            Object.entries(changes).filter(
              ([k]) => !PROFILE_FIELDS.some((f) => f.key === k)
            )
          ) as Parameters<typeof getInstructorChangeItems>[0],
          packages
        );

        return (
          <div key={req.id} className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-black text-slate-900">تعديل في الملف</p>
              <span className="text-xs font-medium text-slate-500">
                {new Date(req.createdAt).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE })}
              </span>
            </div>

            {profileRows.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="p-3 text-right font-bold">الخانة</th>
                      <th className="p-3 text-right font-bold">الحالي</th>
                      <th className="p-3 text-right font-bold">المطلوب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileRows.map((f) => (
                      <tr key={f.key} className="border-t border-slate-100 align-top">
                        <td className="p-3 font-bold text-slate-700">{f.label}</td>
                        <td className="p-3 whitespace-pre-line text-slate-500">{show(current[f.key])}</td>
                        <td className="p-3 font-medium whitespace-pre-line text-slate-900">
                          {show(changes[f.key])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {otherItems.length > 0 && (
              <ul className="space-y-1 text-sm">
                {otherItems.map((item, i) => (
                  <li key={i}>
                    <span className="font-bold text-amber-900">• {item.title}:</span>{' '}
                    <span className="text-slate-700">{item.detail}</span>
                  </li>
                ))}
              </ul>
            )}

            <ActionForm action={reviewProfileRequest} className="space-y-3">
              <input type="hidden" name="id" value={req.id} />
              {/* ⚠️ خانة السبب ظاهرة دايمًا: الرفض بلا سبب بيترفض، والخانة
                  المخفية كانت هتخلّي الرسالة عن خانة الإداري مش شايفها. */}
              <input
                name="feedback"
                maxLength={300}
                placeholder="سبب الرفض — بيوصل للمدرب"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-medium outline-none focus:border-amber-500 md:text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="decision" value="approved" accentColor="journey">
                  اعتماد التعديل
                </Button>
                <Button
                  type="submit"
                  name="decision"
                  value="rejected"
                  variant="secondary"
                  accentColor="enhaLak"
                >
                  رفض
                </Button>
              </div>
            </ActionForm>
          </div>
        );
      })}

      {/* الصور */}
      {group.media.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 font-black text-slate-900">
            <ImageIcon className="h-5 w-5 text-slate-400" /> صور جديدة
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.media.map((item) => (
              <li
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-slate-50 to-white">
                  <Image
                    src={optimizedImageUrl(item.imageUrl, 800)}
                    alt={item.title ?? 'صورة للمراجعة'}
                    fill
                    sizes="(max-width: 768px) 100vw, 360px"
                    className="object-contain p-4"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800 shadow-sm">
                    {item.kind === 'cover' ? 'غلاف الصفحة' : 'إصدار / عمل'}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  {item.title && <p className="font-bold text-slate-800">{item.title}</p>}
                  {item.contribution && (
                    <p className="text-sm font-medium text-slate-600">{item.contribution}</p>
                  )}
                  <ActionForm action={reviewInstructorMedia} className="mt-auto space-y-2 pt-2">
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      name="feedback"
                      maxLength={300}
                      placeholder="سبب الرفض — بيوصل للمدرب"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-medium outline-none focus:border-amber-500 md:text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" name="decision" value="approved" accentColor="journey">
                        اعتماد
                      </Button>
                      <Button
                        type="submit"
                        name="decision"
                        value="rejected"
                        variant="secondary"
                        accentColor="enhaLak"
                      >
                        رفض
                      </Button>
                    </div>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
