import Link from 'next/link';
import { Check, Clock, Lock, ArrowLeft, Video, EyeOff, Info } from 'lucide-react';
import type { ApprovalStep, StepState } from '@/lib/instructor-approval';

/**
 * طريق المدرب للاعتماد — **اللي المدرب بيشوفه**.
 *
 * ⚠️ **الشاشة دي موجودة لأن المدرب ماكانش عنده أي طريقة يعرف.** كان
 *    بيلاقي شارة «نشط» خضرا وهو مش ظاهر لولا عميل واحد، وصفر إشارة
 *    للمطلوب منه. فيفضل مستني، والإدارة فاكرة إنها بلّغته.
 *
 * ⚠️ **وكل خطوة بتقول دور مين**: «عليك» ولا «على الإدارة». الفرق ده
 *    هو كل الفايدة — المدرب اللي عارف إنه مستني مابيقلقش، واللي عليه
 *    حاجة بيعملها.
 *
 * ⚠️ **ومفيش رقم ولا نسبة إنجاز.** «٥٠٪ خلصت» معلومة مالهاش معنى
 *    لما الخطوة الجاية مش في إيده.
 */

const TONE: Record<StepState, { ring: string; chip: string; label: string }> = {
  done: {
    ring: 'bg-emerald-100 text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-700',
    label: 'تمّت',
  },
  action: {
    ring: 'bg-amber-100 text-amber-800',
    chip: 'bg-amber-50 text-amber-800',
    label: 'عليك',
  },
  waiting: {
    ring: 'bg-sky-100 text-sky-700',
    chip: 'bg-sky-50 text-sky-700',
    label: 'على الإدارة',
  },
  locked: {
    ring: 'bg-slate-100 text-slate-400',
    chip: 'bg-slate-50 text-slate-500',
    label: 'بعدين',
  },
};

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') return <Check className="h-4 w-4" aria-hidden="true" />;
  if (state === 'locked') return <Lock className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Clock className="h-4 w-4" aria-hidden="true" />;
}

export function ApprovalJourney({
  steps,
  trainingLink,
  adminHold,
  supportHref = '/support',
}: {
  steps: ApprovalStep[];
  /** رابط لقاء التدريب لو الإدارة حطّته. */
  trainingLink?: string | null;
  /** `hidden` أو `suspended` — قرار إداري بعد الاعتماد، مش خطوة ناقصة. */
  adminHold?: 'hidden' | 'suspended' | null;
  supportHref?: string;
}) {
  return (
    <section
      aria-labelledby="approval-journey-title"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <h2 id="approval-journey-title" className="text-base font-black text-slate-800">
        طريقك للظهور للعملاء
      </h2>
      <p className="mt-1 text-xs font-medium text-slate-500">
        ملفك مايظهرش في صفحة المدربين غير بعد اجتياز التدريب والاختبار وتفعيل الإدارة.
      </p>

      {/* ⚠️ الحالتين دول بيتقالوا صريح: المدرب معتمد، والإخفاء قرار
          إداري وشغله مستمر. سكوت الشاشة هنا بيخلّيه يفتكر إنه اتشال. */}
      {adminHold && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-700">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {adminHold === 'hidden'
              ? 'ملفك مخفي من الموقع بقرار من الإدارة — وشغلك القائم وجلساتك ومستحقاتك مستمرة زي ما هي.'
              : 'حسابك موقوف مؤقتًا عن استقبال حجوزات جديدة — وشغلك القائم ومستحقاتك محفوظة.'}{' '}
            <Link href={supportHref} className="underline">
              كلّمنا لو محتاج تفاصيل
            </Link>
          </span>
        </p>
      )}

      <ol className="mt-5 space-y-4">
        {steps.map((step, i) => {
          const tone = TONE[step.state];
          const last = i === steps.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3">
              {/* الخط الواصل — بين الدواير مش جوّاها. */}
              {!last && (
                <span
                  aria-hidden="true"
                  className="absolute top-8 start-[13px] h-[calc(100%-8px)] w-px bg-slate-200"
                />
              )}

              <span
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.ring}`}
              >
                <StepIcon state={step.state} />
              </span>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className={`text-sm font-black ${
                      step.state === 'locked' ? 'text-slate-400' : 'text-slate-800'
                    }`}
                  >
                    {step.title}
                  </h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone.chip}`}>
                    {tone.label}
                  </span>
                </div>

                <p
                  className={`mt-1 text-sm font-medium ${
                    step.state === 'locked' ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {step.detail}
                </p>

                {/* رابط التدريب: بيظهر على خطوة التدريب وهي لسه مش تمّت. */}
                {step.key === 'training' && step.state !== 'done' && trainingLink && (
                  <a
                    href={trainingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    /* ⚠️ ٤٤ بكسل — حد اللمس اللي الموقع كله ماشي عليه. */
                    className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white hover:bg-sky-700"
                  >
                    <Video className="h-4 w-4" aria-hidden="true" />
                    ادخل لقاء التدريب
                  </a>
                )}

                {step.href && step.state === 'action' && (
                  <Link
                    href={step.href}
                    className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white hover:bg-amber-600"
                  >
                    {step.hrefLabel ?? 'ابدأ'}
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          التدريب والاختبار بتحدّدهم الإدارة وهي اللي بتسجّل نتيجتهم — مش بتتسجّل من هنا. لو
          استنيت أكتر من اللازم،{' '}
          <Link href={supportHref} className="font-bold underline">
            كلّمنا
          </Link>
          .
        </span>
      </p>
    </section>
  );
}
