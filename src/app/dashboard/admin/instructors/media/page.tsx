import Image from 'next/image';
import Link from 'next/link';
import { ImageIcon } from 'lucide-react';
import { requireAdmin } from '@/lib/auth-guard';
import { getPendingInstructorMedia } from '@/data/domains/instructor-media';
import { reviewInstructorMedia } from '@/actions/instructor-media';
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
  const pending = await getPendingInstructorMedia();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-black text-slate-900">مراجعة صور المدربين</h1>
        <p className="text-sm font-medium text-slate-600">
          الغلاف والأعمال مابتظهرش في الصفحات العامة قبل الاعتماد.
        </p>
      </header>

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
    </div>
  );
}
