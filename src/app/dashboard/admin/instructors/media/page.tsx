import Image from 'next/image';
import Link from 'next/link';
import { ImageIcon } from 'lucide-react';
import { requireAdmin } from '@/lib/auth-guard';
import {
  getPendingInstructorMedia,
  getInstructorMediaForAdmin,
} from '@/data/domains/instructor-media';
import { reviewInstructorMedia, revokeInstructorMedia } from '@/actions/instructor-media';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { optimizedImageUrl } from '@/lib/cloudinary';

/**
 * مراجعة صور المدربين.
 *
 * ⚠️ **الشاشة دي هي اللي بتخلّي «الموافقة» حقيقية.** من غيرها
 *    الصور بتدخل `pending` وتفضل كده للأبد، والمدرب يفتكر إن
 *    الموقع باظ.
 *
 * ⚠️ **والصورة بتتعرض `contain` لا `cover`**: الإداري بيوافق على
 *    اللي **هو شايفه**. لو الشاشة قصّت الصورة، هو بيوافق على جزء
 *    والعميل بيشوف الكامل.
 */
export default async function InstructorMediaReviewPage() {
  await requireAdmin('canManageInstructors');
  const [pending, decided] = await Promise.all([
    getPendingInstructorMedia(),
    getInstructorMediaForAdmin(),
  ]);

  // تجميع بالمدرب — الإداري بيسأل «إيه اللي ظاهر في صفحة فلان؟».
  const byInstructor = new Map<string, typeof decided>();
  for (const item of decided) {
    const list = byInstructor.get(item.instructorId) ?? [];
    list.push(item);
    byInstructor.set(item.instructorId, list);
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-black text-slate-900">صور المدربين</h1>
        <p className="text-sm font-medium text-slate-600">
          كل مدرب يقدر يرفع من «ملفي وصوري» في لوحته: <strong>غلاف</strong> لصفحته
          العامة و<strong>صور إصداراته وأعماله</strong>. الصور دي مابتظهرش في
          صفحته قبل ما تعتمدها هنا. (الصورة الشخصية مش هنا — المدرب بيغيّرها
          بنفسه.)
        </p>
      </header>

      <h2 className="text-xl font-black text-slate-900">
        مستنية المراجعة {pending.length > 0 && `(${pending.length})`}
      </h2>

      {pending.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <ImageIcon className="h-12 w-12 text-slate-300" />
          <p className="text-lg font-black text-slate-800">مفيش صور مستنية</p>
          <p className="text-sm font-medium text-slate-600">
            أول ما مدرب يرفع صورة هتلاقيها هنا.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {pending.map((item) => (
            <Card key={item.id} className="flex flex-col overflow-hidden p-0">
              <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-slate-50 to-white">
                <Image
                  src={optimizedImageUrl(item.imageUrl, 800)}
                  alt={item.title ?? 'صورة للمراجعة'}
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-contain p-4"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800 shadow-sm backdrop-blur-sm">
                  {item.kind === 'cover' ? 'غلاف بروفايل' : 'عمل'}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-5">
                <Link
                  href={`/dashboard/admin/instructors/${item.instructorId}`}
                  className="text-brand-strong text-sm font-black hover:underline"
                >
                  {item.instructorName}
                </Link>

                {item.title && (
                  <p className="font-bold text-slate-800">{item.title}</p>
                )}
                {item.contribution && (
                  <p className="text-sm font-medium text-slate-600">
                    {item.contribution}
                  </p>
                )}

                <ActionForm action={reviewInstructorMedia} className="mt-auto space-y-3 pt-2">
                  <input type="hidden" name="id" value={item.id} />

                  {/* ⚠️ خانة السبب ظاهرة دايمًا لا بتظهر بعد الضغط:
                      الأكشن بيرفض الرفض بلا سبب، والخانة المخفية
                      كانت هتخلّي الرفض يفشل برسالة عن خانة الإداري
                      مش شايفها. */}
                  <textarea
                    name="feedback"
                    rows={2}
                    maxLength={300}
                    placeholder="سبب الرفض — بيوصل للمدرب"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-medium outline-none focus:border-amber-500 md:text-sm"
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="submit"
                      name="decision"
                      value="approved"
                      accentColor="journey"
                    >
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
            </Card>
          ))}
        </div>
      )}

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
                        <ActionForm
                          action={revokeInstructorMedia}
                          className="mt-auto space-y-2 pt-2"
                        >
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            name="feedback"
                            maxLength={300}
                            placeholder="سبب السحب — بيوصل للمدرب"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-medium outline-none focus:border-amber-500 md:text-sm"
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            accentColor="enhaLak"
                          >
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
