'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, MessageSquarePlus, Clock, PenLine } from 'lucide-react';
import { decideStoryPreview } from '@/actions/story-preview';
import { Field, TextArea } from '@/components/forms/Form';
import {
  PREVIEW_NOTE_MAX,
  noteProblem,
  paragraphsOf,
  previewState,
  type PreviewRow,
} from '@/lib/story-preview';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

const TONE = {
  awaiting: 'border-amber-300 bg-amber-50 text-amber-900',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  changes: 'border-sky-200 bg-sky-50 text-sky-900',
  superseded: 'border-slate-200 bg-slate-50 text-slate-700',
} as const;

function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ar-EG', {
    timeZone: PLATFORM_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * معاينة نص قصة واحدة + قرار ولي الأمر.
 *
 * ⚠️ **الزرارين الاتنين بنفس الوزن البصري.** لو «وافق» كان كبيرًا
 *    أخضر و«اطلب تعديل» سطرًا صغيرًا، بنكون بنضغط عليه يوافق —
 *    وهو دفع ٨٥٠ جنيه وله حق يقول لأ. الموافقة أخضر وطلب التعديل
 *    بإطار، والاتنين نفس الحجم.
 *
 * ⚠️ **ومافيش تأكيد على الموافقة.** الموافقة بتفتح الرسم وخلاص —
 *    مابتصرفش فلوس ولا بتمسح حاجة، فنافذة «متأكد؟» بتبقى عرقلة
 *    بلا سبب. طلب التعديل هو اللي محتاج خطوة زيادة (الملاحظة).
 */
export function StoryPreviewCard({
  row,
  productName,
}: {
  row: PreviewRow;
  productName: string;
}) {
  const state = previewState(row);
  const [mode, setMode] = useState<'idle' | 'changes'>('idle');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const paragraphs = paragraphsOf(row.body);

  const submit = (approve: boolean) => {
    setError('');
    if (!approve) {
      const problem = noteProblem(note);
      if (problem) {
        setError(problem);
        return;
      }
    }
    startTransition(async () => {
      const result = await decideStoryPreview({
        versionId: row.versionId,
        approve,
        note: approve ? undefined : note,
      });
      // ⚠️ الفشل بيتعرض جوّه الكارت جنب الزرار اللي العميل دوسه —
      //    مش في شريط فوق الصفحة ممكن يبقى بره الشاشة.
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-black text-slate-900">{productName}</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            النسخة {row.versionNo.toLocaleString('ar-EG')}
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <Clock className="h-4 w-4" aria-hidden="true" />
          وصلتك {when(row.sentAt)}
        </p>
      </header>

      <div className={`mb-6 rounded-2xl border p-5 ${TONE[state.kind]}`}>
        <p className="font-black">{state.title}</p>
        <p className="mt-1 text-sm font-medium leading-relaxed">{state.text}</p>
      </div>

      {/* ══ النص ══════════════════════════════════════════════
          ⚠️ `whitespace-pre-line` مش كفاية لوحدها: النص بيتكتب
             بفقرات مفصولة بسطر فاضي، والعرض الخام بيخليها كتلة
             واحدة تقيلة على العين. الفقرات بتتفصل فعليًا. */}
      <div className="rounded-2xl bg-slate-50 p-5 md:p-7">
        {paragraphs.length === 0 ? (
          <p className="text-sm font-bold text-amber-800">
            النص وصل فاضي — كلّمنا من «الدعم والمساعدة» وإحنا نبعته تاني.
          </p>
        ) : (
          <div className="space-y-4 text-[1.0625rem] leading-loose text-slate-800">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ══ القرار ════════════════════════════════════════════ */}
      {state.kind === 'awaiting' && (
        <div className="mt-6">
          {mode === 'idle' ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={pending}
                onClick={() => submit(true)}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-70"
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                {pending ? 'جارٍ التسجيل…' : 'النص عاجبني — ابدأوا الرسم'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setMode('changes')}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 px-6 py-3 font-black text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-70"
              >
                <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
                فيه حاجة عايزة تتعدّل
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-5">
              {/* ⚠️ `Field`/`TextArea` من `components/forms/Form` — مش
                  خانة خام. حارس `forms-guard` مسك النسخة الأولى من
                  الشاشة دي وهي بخانة خام، والسبب إن الخانات الموحّدة
                  هي اللي بتوصّل خطأ الخادم جوّه الخانة نفسها. */}
              <Field
                label="عايز نعدّل إيه بالظبط؟"
                name="note"
                required
                hint="كل ما تكون محدّد، كل ما النسخة الجاية تطلع أقرب لاللي في بالك. مثال: «اسم البطلة غلط، واسمها نور مش نورا» أو «الجزء بتاع المدرسة طويل، قصّروه»."
                error={error}
              >
                <TextArea
                  rows={4}
                  maxLength={PREVIEW_NOTE_MAX}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    if (error) setError('');
                  }}
                />
              </Field>
              <p className="mt-1 text-xs font-medium text-slate-400">
                {note.trim().length.toLocaleString('ar-EG')} /{' '}
                {PREVIEW_NOTE_MAX.toLocaleString('ar-EG')}
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit(false)}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-black text-white transition-colors hover:bg-slate-800 disabled:opacity-70"
                >
                  <PenLine className="h-5 w-5" aria-hidden="true" />
                  {pending ? 'جارٍ الإرسال…' : 'ابعت الملاحظة للمحرّر'}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMode('idle');
                    setError('');
                  }}
                  className="min-h-[44px] rounded-xl px-6 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-70"
                >
                  رجوع
                </button>
              </div>
            </div>
          )}

          {/* ⚠️ الخطأ في وضع «تعديل» بيبان جوّه الخانة (`Field`)؛
              السطر ده لفشل **الموافقة** — ومالهاش خانة تحمل
              رسالتها، فلازم مكان خاص بيها. */}
          {error && mode === 'idle' && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
            >
              {error}
            </p>
          )}
        </div>
      )}

      {/* ⚠️ القرار المتسجّل بيتعرض بنصّه: ولي الأمر لازم يشوف
          إحنا فهمنا منه إيه — ولو الفريق سجّله بالنيابة، يشوف ده
          كمان ويقدر يعترض. */}
      {row.decisionAt && (
        <footer className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">
          <p className="font-bold text-slate-700">
            قرارك اتسجّل {when(row.decisionAt)}
            {row.decidedByMe ? '' : ' — سجّله فريق الرحلة بالنيابة عنك'}
          </p>
          {row.decisionNote && <p className="mt-1 leading-relaxed">{row.decisionNote}</p>}
          {!row.decidedByMe && (
            <p className="mt-2 font-bold text-amber-800">
              لو ده مش قرارك، كلّمنا من «الدعم والمساعدة» فورًا.
            </p>
          )}
        </footer>
      )}
    </article>
  );
}
