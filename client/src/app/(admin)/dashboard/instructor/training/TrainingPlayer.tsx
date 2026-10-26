'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Lock, Pause, Play, Printer, RotateCcw, Sparkles } from 'lucide-react';
import {
  startTraining,
  submitTrainingFinal,
  submitTrainingModule,
  trainingHeartbeat,
} from '@/actions/training';
import {
  activeDuration,
  allModulesDone,
  doneCount,
  moduleDone,
  finalDraftKey,
  positionKey,
  validPosition,
  DEFAULT_ESTIMATE,
  DEFAULT_IDLE_MINUTES,
  estimateLabel,
  minutesLabel,
  type FinalResult,
  type LearnerCourse,
  type ModuleResult,
  type TrainingProgress,
  type TrainingQuestion,
  type TrainingPosition,
  type TrainingScenario,
} from '@/lib/training';

/** قراءة/كتابة الجهاز — ممكن ترمي (تصفّح خاص)، فكله جوّه try. */
function readLocal<T>(key: string): T | null {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* مش مهم — التقدّم الأساسي في الحساب */
  }
}
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

type View =
  | { kind: 'home' }
  | { kind: 'lesson'; module: number; page: number }
  | { kind: 'final' }
  | { kind: 'result'; result: FinalResult };

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' }) : '—';
const ar = (n: number) => n.toLocaleString('ar-EG');

const btnPrimary =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-2.5 font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-60';
const btnLight =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60';

/**
 * مشغّل التأهيل التأسيسي — نفس تجربة الملف المنفصل (وحدات، صفحات، وقفات
 * تفاعلية، اختبار لكل وحدة، تقييم نهائي)، بس التقدّم متسجّل في حساب
 * المدرب والتصحيح على الخادم.
 */
export function TrainingPlayer({ course, name }: { course: LearnerCourse; name: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<TrainingProgress | null>(course.progress);
  const [view, setView] = useState<View>({ kind: 'home' });
  const topRef = useRef<HTMLDivElement>(null);
  const total = course.modules.length;
  const ready = allModulesDone(progress, total) || !course.learner;

  // ══ الوقت النشط + التوقف التلقائي ═══════════════════════════
  //
  // ⚠️ الوقت بيتحسب بس لما المدرب بيتفاعل (حركة/كتابة/لمس/تمرير) والصفحة
  //    ظاهرة. بعد ٣ دقايق من غير تفاعل الحساب بيقف وبيظهر شريط «متوقف»،
  //    وأي تفاعل بيرجّعه. والقاعدة كمان بتحد كل نداء بدقيقتين.
  const [idle, setIdle] = useState(false);
  const idleMinutes = course.idleMinutes || DEFAULT_IDLE_MINUTES;
  const lastActivity = useRef(0);
  useEffect(() => {
    if (!course.learner) return;
    if (!course.progress) void startTraining(course.id);
    const TICK = 15_000;
    const IDLE_MS = idleMinutes * 60_000;
    lastActivity.current = Date.now();
    let pending = 0;
    let sinceSend = 0;
    const onActivity = () => {
      lastActivity.current = Date.now();
      setIdle(false);
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const id = window.setInterval(() => {
      const active = !document.hidden && Date.now() - lastActivity.current < IDLE_MS;
      setIdle(!active && !document.hidden);
      if (active) pending += TICK / 1000;
      sinceSend += TICK;
      if (sinceSend >= 60_000) {
        sinceSend = 0;
        if (pending > 0) void trainingHeartbeat(pending, course.id);
        pending = 0;
      }
    }, TICK);
    const flush = () => {
      if (pending > 0) void trainingHeartbeat(pending, course.id);
      pending = 0;
    };
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.clearInterval(id);
      window.removeEventListener('pagehide', flush);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [course.id, course.learner, course.progress, idleMinutes]);

  const [flash, setFlash] = useState('');

  const go = useCallback(
    (v: View) => {
      setView(v);
      setFlash('');
      // مكانه في الصفحات بيتفتكر — «كمّل رحلتك» بترجّعه هنا.
      if (v.kind === 'lesson') writeLocal(positionKey(course.id), { module: v.module, page: v.page });
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [course.id],
  );

  /** «توقّف وكمّل بعدين» — مكانه محفوظ، والوحدات اللي اتصحّحت في حسابه. */
  const pause = useCallback(() => {
    setView({ kind: 'home' });
    setFlash('اتحفظ مكانك. ارجع في أي وقت واضغط «كمّل رحلتك» — هتكمّل من نفس الصفحة.');
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const resumeTarget = (): View => {
    const saved = validPosition(readLocal<TrainingPosition>(positionKey(course.id)), course.modules);
    if (saved && !moduleDone(progress, saved.module)) return { kind: 'lesson', ...saved };
    const firstOpen = course.modules.findIndex((_, i) => !moduleDone(progress, i));
    return { kind: 'lesson', module: Math.max(0, firstOpen), page: 0 };
  };

  const markModule = (i: number, r: ModuleResult) => {
    setProgress((p) => {
      const base: TrainingProgress = p ?? {
        startedAt: new Date().toISOString(),
        activeSeconds: 0,
        modules: {},
        finalAttempts: 0,
        bestScore: null,
        passedAt: null,
        passedVersion: null,
      };
      const prev = base.modules[String(i)];
      return {
        ...base,
        modules: {
          ...base.modules,
          [String(i)]: {
            attempts: (prev?.attempts ?? 0) + 1,
            lastScore: r.score,
            bestScore: Math.max(prev?.bestScore ?? 0, r.score),
            total: r.total,
            passedAt: prev?.passedAt ?? (r.passed ? new Date().toISOString() : null),
          },
        },
      };
    });
  };

  const markFinal = (r: FinalResult) => {
    setProgress((p) =>
      p
        ? {
            ...p,
            finalAttempts: p.finalAttempts + 1,
            bestScore: Math.max(p.bestScore ?? 0, r.score),
            passedAt: p.passedAt ?? (r.passed ? new Date().toISOString() : null),
            passedVersion: p.passedVersion ?? (r.passed ? course.version : null),
          }
        : p,
    );
    router.refresh();
  };

  return (
    <div ref={topRef} className="grid scroll-mt-24 gap-6 lg:grid-cols-[18rem_1fr]">
      <Sidebar course={course} progress={progress} view={view} ready={ready} onGo={go} name={name} />
      <main className="min-w-0">
        {!course.learner && (
          <p className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900">
            وضع المعاينة للإدارة — التصحيح شغّال، ومفيش حاجة بتتسجّل.
          </p>
        )}
        {idle && (
          <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <Pause className="h-4 w-4" aria-hidden="true" />
              احتساب الوقت متوقف — مفيش تفاعل من {minutesLabel(idleMinutes)}. تقدّمك محفوظ.
            </p>
            <button
              type="button"
              className={btnLight}
              onClick={() => {
                lastActivity.current = Date.now();
                setIdle(false);
              }}
            >
              <Play className="h-4 w-4" aria-hidden="true" /> كمّل
            </button>
          </div>
        )}
        {flash && view.kind === 'home' && (
          <p role="status" className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
            {flash}
          </p>
        )}
        {view.kind === 'home' && (
          <Home course={course} progress={progress} onGo={go} ready={ready} resume={resumeTarget} />
        )}
        {view.kind === 'lesson' && (
          <Lesson
            key={`${view.module}-${view.page}`}
            course={course}
            moduleIndex={view.module}
            pageIndex={view.page}
            done={moduleDone(progress, view.module)}
            onGo={go}
            onPassed={markModule}
            onPause={course.learner ? pause : undefined}
          />
        )}
        {view.kind === 'final' && (
          <FinalExam
            course={course}
            onPause={course.learner ? pause : undefined}
            onBack={() => go({ kind: 'lesson', module: 0, page: 0 })}
            onResult={(r) => {
              markFinal(r);
              go({ kind: 'result', result: r });
            }}
          />
        )}
        {view.kind === 'result' && (
          <Result
            course={course}
            progress={progress}
            result={view.result}
            name={name}
            onRetry={() => go({ kind: 'final' })}
            onReview={(i) => go({ kind: 'lesson', module: i, page: 0 })}
          />
        )}
      </main>
    </div>
  );
}

// ── الشريط الجانبي ────────────────────────────────────────────

function Sidebar({
  course,
  progress,
  view,
  ready,
  onGo,
  name,
}: {
  course: LearnerCourse;
  progress: TrainingProgress | null;
  view: View;
  ready: boolean;
  onGo: (v: View) => void;
  name: string;
}) {
  const total = course.modules.length;
  const done = doneCount(progress, total);
  const pct = Math.round((done / total) * 100);
  return (
    <aside className="h-fit self-start space-y-4 rounded-3xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24 print:hidden">
      <div>
        <p className="text-sm font-black text-slate-900">مسارك في التأهيل</p>
        <p className="mt-1 text-sm font-medium text-slate-600">
          {name ? `أهلًا ${name} — ` : ''}خلّصت {ar(done)} من {ar(total)} وحدات
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span className="block h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <nav aria-label="وحدات التأهيل" className="space-y-1.5">
        {course.modules.map((m, i) => {
          const isDone = moduleDone(progress, i);
          const current = view.kind === 'lesson' && view.module === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onGo({ kind: 'lesson', module: i, page: 0 })}
              aria-current={current ? 'step' : undefined}
              className={`flex w-full min-h-[44px] items-start gap-3 rounded-2xl p-2.5 text-right transition-colors ${
                current ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-slate-50'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  isDone ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : ar(i + 1)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-snug text-slate-800">{m.title}</span>
                <span className="block text-xs font-medium text-slate-500">{isDone ? 'أكملت اختبار الوحدة' : m.tag}</span>
              </span>
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        disabled={!ready}
        onClick={() => onGo({ kind: 'final' })}
        className={`flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-colors ${
          ready ? 'bg-slate-900 text-white hover:bg-slate-800' : 'cursor-not-allowed bg-slate-100 text-slate-500'
        }`}
      >
        {ready ? <Sparkles className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
        التقييم النهائي{ready ? '' : ' · بعد الوحدات'}
      </button>
      {progress && (
        <p className="text-xs font-medium text-slate-500">
          وقت الدراسة التقريبي: {activeDuration(progress.activeSeconds)}
        </p>
      )}
    </aside>
  );
}

// ── البداية ──────────────────────────────────────────────────

function Home({
  course,
  progress,
  onGo,
  ready,
  resume,
}: {
  course: LearnerCourse;
  progress: TrainingProgress | null;
  onGo: (v: View) => void;
  ready: boolean;
  resume: () => View;
}) {
  const moduleQs = course.modules.reduce((n, m) => n + m.questions.length, 0);
  // مكان محفوظ على الجهاز = بدأ قبل كده (حتى لو لسه ماخلّصش وحدة).
  const [hasSaved, setHasSaved] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- قراءة تخزين المتصفح بعد التحميل (مش متاح على الخادم)
    setHasSaved(!!readLocal(positionKey(course.id)));
  }, [course.id]);
  const started =
    hasSaved || (!!progress && (doneCount(progress, course.modules.length) > 0 || progress.activeSeconds > 0));
  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
      {progress?.passedAt && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-bold">
            اجتزت التأهيل التأسيسي في {when(progress.passedAt)}
            {progress.bestScore != null ? ` بدرجة ${ar(progress.bestScore)}٪` : ''}. الإدارة شايفة النتيجة في ملفك،
            والخطوة الجاية التدريب العملي.
          </p>
        </div>
      )}
      <div>
        <p className="text-sm font-black text-emerald-700">قبل ما تبدأ</p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">منطلق مهني مشترك لميسّري «بداية الرحلة»</h2>
        <p className="mt-3 leading-loose font-medium text-slate-700">
          هتراجع المرجعية التربوية المعتمدة، وتتعرّف على لغة الشغل اللي هتستخدمها في التدريب العملي، وتختبر فهمك
          بمواقف مهنية قصيرة. مش محتاج تحضر محاضرة — بس فهم المبادئ هنا مايغنيش عن التحقق العملي من جاهزيتك.
        </p>
      </div>
      {/* ══ الوقت والتوقف (طلب تامر، ٢٤ أكتوبر) ══ */}
      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
        <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="space-y-1 text-sm leading-relaxed">
          <p className="font-black">
            الوقت المتوقع:{' '}
            {estimateLabel(course.estimateMin || DEFAULT_ESTIMATE.min, course.estimateMax || DEFAULT_ESTIMATE.max)}.
          </p>
          <p className="font-medium">
            ابدأ عندما تكون مستعدًا. يمكنك التوقف والعودة في وقت لاحق؛ ستبقى إجاباتك وتقدمك محفوظة في حسابك،
            ويتوقف احتساب الوقت تلقائيًا عند عدم التفاعل لمدة {minutesLabel(course.idleMinutes || DEFAULT_IDLE_MINUTES)}.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [ar(course.modules.length), 'وحدات تعليمية'],
          [ar(moduleQs), 'سؤال لاختبارات الوحدات'],
          [ar(course.finalQuestions.length), 'سؤال نهائي'],
        ].map(([n, l]) => (
          <div key={l} className="rounded-2xl bg-slate-50 p-4 text-center">
            <p className="text-3xl font-black text-slate-900">{n}</p>
            <p className="mt-1 text-sm font-bold text-slate-600">{l}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-relaxed text-amber-900">
        <p className="font-black">طريقة التأهّل</p>
        <p className="mt-1">
          اختبار كل وحدة بيعدّي بنسبة {ar(course.modulePassPct)}٪ على الأقل. بعد الوحدات كلها بيفتح التقييم النهائي،
          والنجاح فيه {ar(course.finalPassPct)}٪
          {course.criticalRequired && course.criticalTotal > 0
            ? ` مع إجابة صحيحة على الأسئلة الحرجة (${ar(course.criticalTotal)}) الخاصة بالملكية والخصوصية وعدم التأويل والحماية`
            : ''}
          . تقدر تعيد أي اختبار. تقدّمك بيتحفظ في حسابك، والإدارة بتشوف النتيجة من غير ما تبعت حاجة.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {ready ? (
          <button type="button" className={btnPrimary} onClick={() => onGo({ kind: 'final' })}>
            التقييم النهائي <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className={btnPrimary} onClick={() => onGo(resume())}>
            {started ? 'كمّل رحلتك' : 'ابدأ الرحلة'}
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}

// ── الدرس ─────────────────────────────────────────────────────

function Lesson({
  course,
  moduleIndex,
  pageIndex,
  done,
  onGo,
  onPassed,
  onPause,
}: {
  course: LearnerCourse;
  moduleIndex: number;
  pageIndex: number;
  done: boolean;
  onGo: (v: View) => void;
  onPassed: (i: number, r: ModuleResult) => void;
  onPause?: () => void;
}) {
  const m = course.modules[moduleIndex];
  const n = m.pages.length;
  const isQuiz = pageIndex >= n;
  const page = m.pages[pageIndex];
  const last = moduleIndex === course.modules.length - 1;

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-black">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            الوحدة {ar(moduleIndex + 1)} من {ar(course.modules.length)} · {m.tag}
          </span>
          <span className={`rounded-full px-3 py-1 ${done ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            {done ? '✓ أُنجزت' : 'قيد الدراسة'}
          </span>
          {onPause && <PauseButton onPause={onPause} />}
        </div>
        <h2 className="text-2xl font-black text-slate-900">{m.title}</h2>
        <p className="font-medium text-slate-600">{m.subtitle}</p>
        <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-relaxed text-emerald-900">
          <span className="font-black">غاية الوحدة: </span>
          {m.goal}
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-500">
            {isQuiz ? 'اختبار الوحدة' : `صفحة ${ar(pageIndex + 1)} من ${ar(n)}`}
          </span>
          <span className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: n + 1 }, (_, j) => (
              <span key={j} className={`h-2 w-2 rounded-full ${j === pageIndex ? 'bg-emerald-600' : 'bg-slate-200'}`} />
            ))}
          </span>
        </div>
      </header>

      {isQuiz ? (
        <ModuleQuiz
          course={course}
          moduleIndex={moduleIndex}
          onPassed={(r) => onPassed(moduleIndex, r)}
          onPrev={() => onGo({ kind: 'lesson', module: moduleIndex, page: n - 1 })}
          onNext={() => onGo(last ? { kind: 'final' } : { kind: 'lesson', module: moduleIndex + 1, page: 0 })}
          nextLabel={last ? 'التقييم النهائي' : 'الوحدة التالية'}
        />
      ) : (
        <>
          <h3 className="text-xl font-black text-slate-900">{page.title}</h3>
          <div className="space-y-4">
            {page.paragraphs.map((p, i) => (
              <p key={i} className="text-[1.0625rem] leading-loose text-slate-800">
                {p}
              </p>
            ))}
          </div>
          {page.cards && page.cards.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {page.cards.map(([t, d]) => (
                <div key={t} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-black text-slate-900">{t}</p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">{d}</p>
                </div>
              ))}
            </div>
          )}
          {page.note && (
            <p className="rounded-2xl border-r-4 border-emerald-600 bg-emerald-50/60 p-4 font-bold leading-relaxed text-slate-800">
              {page.note}
            </p>
          )}
          {page.scenario && <Scenario scenario={page.scenario} />}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            {pageIndex > 0 ? (
              <button type="button" className={btnLight} onClick={() => onGo({ kind: 'lesson', module: moduleIndex, page: pageIndex - 1 })}>
                <ArrowRight className="h-4 w-4" aria-hidden="true" /> الصفحة السابقة
              </button>
            ) : (
              <button type="button" className={btnLight} onClick={() => onGo({ kind: 'home' })}>
                البداية
              </button>
            )}
            <button type="button" className={btnPrimary} onClick={() => onGo({ kind: 'lesson', module: moduleIndex, page: pageIndex + 1 })}>
              {pageIndex === n - 1 ? 'اختبار الوحدة' : 'الصفحة التالية'}
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function PauseButton({ onPause }: { onPause: () => void }) {
  return (
    <button
      type="button"
      onClick={onPause}
      className="ms-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50"
    >
      <Pause className="h-3.5 w-3.5" aria-hidden="true" /> توقّف وكمّل بعدين
    </button>
  );
}

/** وقفة تفاعلية — تدريب مش تقييم، فالإجابة بتيجي مع المحتوى. */
function Scenario({ scenario }: { scenario: TrainingScenario }) {
  const [pick, setPick] = useState<number | null>(null);
  const ok = pick === scenario.answer;
  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
      <p className="text-sm font-black text-violet-800">وقفة تفاعلية · اختبر قرارك</p>
      <p className="mt-2 font-bold leading-relaxed text-slate-900">{scenario.prompt}</p>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label={scenario.prompt}>
        {scenario.choices.map((c, j) => (
          <Choice key={j} index={j} label={c} selected={pick === j} onSelect={() => setPick(j)} />
        ))}
      </div>
      {pick !== null && (
        <p
          aria-live="polite"
          className={`mt-3 rounded-xl p-3 text-sm font-bold leading-relaxed ${ok ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}
        >
          {ok ? '✓ قرار منسجم مع المنهجية. ' : 'القرار ده محتاج مراجعة. '}
          {scenario.feedback}
        </p>
      )}
    </div>
  );
}

function Choice({
  index,
  label,
  selected,
  onSelect,
  state,
  disabled,
}: {
  index: number;
  label: string;
  selected: boolean;
  onSelect: () => void;
  state?: 'right' | 'wrong';
  disabled?: boolean;
}) {
  const tone =
    state === 'right'
      ? 'border-emerald-400 bg-emerald-50'
      : state === 'wrong'
        ? 'border-rose-300 bg-rose-50'
        : selected
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-slate-200 bg-white hover:border-slate-300';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full min-h-[44px] items-start gap-3 rounded-xl border-2 p-3 text-right transition-colors disabled:cursor-default ${tone}`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
          selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
        }`}
      >
        {ar(index + 1)}
      </span>
      <span className="font-medium leading-relaxed text-slate-800">{label}</span>
    </button>
  );
}

function QuestionBlock({
  number,
  q,
  value,
  onChange,
  review,
}: {
  number: number;
  q: TrainingQuestion;
  value: number | undefined;
  onChange: (v: number) => void;
  review?: { correct: boolean; right: string; why: string };
}) {
  return (
    <fieldset className="space-y-2 rounded-2xl border border-slate-200 p-4">
      <legend className="px-1 font-black leading-relaxed text-slate-900">
        {ar(number)}. {q.q}
      </legend>
      <div role="radiogroup" aria-label={q.q} className="space-y-2">
        {q.opts.map((o, j) => (
          <Choice
            key={j}
            index={j}
            label={o}
            selected={value === j}
            onSelect={() => onChange(j)}
            disabled={!!review}
            state={review && value === j ? (review.correct ? 'right' : 'wrong') : undefined}
          />
        ))}
      </div>
      {review && (
        <p className={`rounded-xl p-3 text-sm font-medium leading-relaxed ${review.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
          <span className="font-black">{review.correct ? '✓ صح. ' : `الأقرب: «${review.right}». `}</span>
          {review.why}
        </p>
      )}
    </fieldset>
  );
}

function useAnswers(count: number) {
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => Array(count).fill(undefined));
  const set = (i: number, v: number) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)));
  const missing = answers.findIndex((a) => a === undefined);
  const restore = useCallback((saved: (number | undefined)[]) => setAnswers(saved), []);
  return { answers, set, missing, restore, reset: () => setAnswers(Array(count).fill(undefined)) };
}

function ModuleQuiz({
  course,
  moduleIndex,
  onPassed,
  onPrev,
  onNext,
  nextLabel,
}: {
  course: LearnerCourse;
  moduleIndex: number;
  onPassed: (r: ModuleResult) => void;
  onPrev: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const qs = course.modules[moduleIndex].questions;
  const { answers, set, missing, reset } = useAnswers(qs.length);
  const [result, setResult] = useState<ModuleResult | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const submit = () => {
    setError('');
    if (missing >= 0) {
      setError(`أكمل السؤال رقم ${ar(missing + 1)} قبل التصحيح.`);
      return;
    }
    start(async () => {
      const r = await submitTrainingModule(moduleIndex, answers as number[], course.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult(r);
      onPassed(r);
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-black text-slate-900">تثبيت الفهم قبل الانتقال</h3>
      <p className="font-medium text-slate-600">
        جاوب على الأسئلة، وهتقرا تعليل كل إجابة بعد التصحيح. النجاح {ar(course.modulePassPct)}٪، وتقدر تعيد.
      </p>
      {result && (
        <div
          role="status"
          className={`rounded-2xl p-4 font-black ${result.passed ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}
        >
          {result.passed ? '✓ عدّيت اختبار الوحدة' : 'محتاج تراجع الوحدة وتعيد'} — {ar(result.score)} من {ar(result.total)}
        </div>
      )}
      {qs.map((q, i) => (
        <QuestionBlock
          key={q.id ?? i}
          number={i + 1}
          q={q}
          value={answers[i]}
          onChange={(v) => set(i, v)}
          review={result?.rows[i]}
        />
      ))}
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <button type="button" className={btnLight} onClick={onPrev}>
          <ArrowRight className="h-4 w-4" aria-hidden="true" /> رجوع للدرس
        </button>
        {!result ? (
          <button type="button" className={btnPrimary} onClick={submit} disabled={pending}>
            {pending ? 'بيتصحّح…' : 'صحّح إجاباتي'}
          </button>
        ) : result.passed ? (
          <button type="button" className={btnPrimary} onClick={onNext}>
            {nextLabel} <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              setResult(null);
              reset();
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> أعد الاختبار
          </button>
        )}
      </div>
    </div>
  );
}

// ── التقييم النهائي ──────────────────────────────────────────

function FinalExam({
  course,
  onBack,
  onResult,
  onPause,
}: {
  course: LearnerCourse;
  onBack: () => void;
  onResult: (r: FinalResult) => void;
  onPause?: () => void;
}) {
  const qs = course.finalQuestions;
  const { answers, set, missing, restore } = useAnswers(qs.length);
  // ⚠️ إجابات التقييم اللي لسه ماتسلّمتش بتتفتكر على الجهاز — لو وقف في
  //    النص ورجع، يلاقيها زي ما سابها.
  const draftKey = finalDraftKey(course.id);
  useEffect(() => {
    const saved = readLocal<(number | null)[]>(draftKey);
    if (Array.isArray(saved) && saved.length === qs.length) restore(saved.map((v) => (typeof v === 'number' ? v : undefined)));
  }, [draftKey, qs.length, restore]);
  useEffect(() => {
    if (answers.some((a) => a !== undefined)) writeLocal(draftKey, answers.map((a) => a ?? null));
  }, [answers, draftKey]);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const submit = () => {
    setError('');
    if (missing >= 0) {
      setError(`ماجاوبتش على السؤال رقم ${ar(missing + 1)} لسه.`);
      document.getElementById(`fq-${missing}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    start(async () => {
      const r = await submitTrainingFinal(answers as number[], course.id);
      if (!r.ok) {
        setError(r.error);
        setConfirming(false);
        return;
      }
      writeLocal(draftKey, null);
      onResult(r);
    });
  };

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black text-emerald-700">المرحلة الأخيرة · قياس الاستيعاب</p>
          {onPause && <PauseButton onPause={onPause} />}
        </div>
        <h2 className="text-2xl font-black text-slate-900">
          التقييم النهائي · {ar(qs.length)} موقف وسؤال
        </h2>
        <p className="font-medium leading-relaxed text-slate-700">
          اختار الإجابة الأقرب لفلسفة «بداية الرحلة». النجاح {ar(course.finalPassPct)}٪ على الأقل
          {course.criticalRequired && course.criticalTotal > 0 ? `، مع صحة الأسئلة الحرجة (${ar(course.criticalTotal)})` : ''}.
          هتشوف تفسير الأخطاء بعد التسليم، وتقدر تعيد.
        </p>
        <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
          ده تقييم للفهم التأسيسي، ومايمنحش اعتمادًا نهائيًا لتقديم الجلسات — بعده التدريب العملي مع الإدارة.
        </p>
      </header>
      {qs.map((q, i) => (
        <div key={q.id ?? i} id={`fq-${i}`} className="scroll-mt-28">
          <QuestionBlock number={i + 1} q={q} value={answers[i]} onChange={(v) => set(i, v)} />
        </div>
      ))}
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      {confirming && !pending && (
        <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-800">
          متأكد؟ الضغطة الجاية بتعتمد إجابات المحاولة دي وتظهر نتيجتها.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <button type="button" className={btnLight} onClick={onBack}>
          رجوع للوحدات
        </button>
        <button type="button" className={btnPrimary} onClick={submit} disabled={pending}>
          {pending ? 'بيتصحّح…' : confirming ? 'أيوه، اعتمد إجاباتي' : 'سلّم المحاولة'}
        </button>
      </div>
    </section>
  );
}

function Result({
  course,
  progress,
  result,
  name,
  onRetry,
  onReview,
}: {
  course: LearnerCourse;
  progress: TrainingProgress | null;
  result: FinalResult;
  name: string;
  onRetry: () => void;
  onReview: (moduleIndex: number) => void;
}) {
  // ⚠️ مفيش إجابات صحيحة في التقرير (قرار تامر، ٢٧ أكتوبر) — الدرجة ونتيجة
  //    المجالات والوحدات اللي يراجعها بس. والقاعدة نفسها مابترجّعهاش.
  const stats = result.topics ?? [];
  const review = (result.reviewModules ?? []).filter((i) => i >= 0 && i < course.modules.length);
  const weakTopics = stats.filter((s) => s.correct < s.total);
  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-8 print:border-0 print:p-0">
      <header className="space-y-2">
        <p className="text-sm font-black text-slate-500">
          تقرير المحاولة · {name} · {when(new Date().toISOString())}
        </p>
        <h2 className="text-2xl font-black text-slate-900">
          {result.passed ? 'اجتزت التقييم التأسيسي' : 'راجع مواضع التعثّر وأعد التقييم'}
        </h2>
      </header>
      <div className={`rounded-2xl p-5 ${result.passed ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
        <p className="text-4xl font-black">{ar(result.score)}٪</p>
        <p className="mt-1 font-bold">
          {ar(result.correct)} من {ar(result.total)} صح
          {result.criticalTotal > 0 ? ` · الأسئلة الحرجة ${ar(result.criticalCorrect)} من ${ar(result.criticalTotal)}` : ''}
          {' · '}المطلوب {ar(result.passPct)}٪
        </p>
        {result.passed && (
          <p className="mt-2 text-sm font-medium">
            النتيجة وصلت للإدارة تلقائيًا. الخطوة الجاية: التدريب العملي — الإدارة هتحدّد معادك.
          </p>
        )}
      </div>

      {stats.length > 0 && (
        <div>
          <h3 className="mb-3 font-black text-slate-900">نتيجة المجالات</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {stats.map((s) => (
              <li key={s.topic} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span className="font-bold text-slate-800">{s.topic}</span>
                <span className={`font-black ${s.correct === s.total ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {ar(s.correct)}/{ar(s.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!result.passed && (review.length > 0 || weakTopics.length > 0) && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <h3 className="font-black text-slate-900">راجع قبل ما تعيد التقييم</h3>
          {review.length > 0 ? (
            <ul className="space-y-2">
              {review.map((i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
                  <span className="text-sm font-bold text-slate-800">
                    الوحدة {ar(i + 1)}: {course.modules[i].title}
                  </span>
                  <button type="button" className={btnLight} onClick={() => onReview(i)}>
                    راجع الوحدة <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-medium text-slate-700">
              راجع الوحدات المرتبطة بالمجالات دي: {weakTopics.map((t) => t.topic).join('، ')}.
            </p>
          )}
          <p className="text-xs font-medium text-slate-600">
            التقرير مابيعرضش الإجابات الصحيحة — الهدف إنك ترجع للمحتوى وتعيد التفكير في المواقف.
          </p>
        </div>
      )}

      <p className="text-xs font-medium text-slate-500">
        محاولات التقييم: {ar(progress?.finalAttempts ?? 1)}
        {progress ? ` · وقت الدراسة التقريبي ${activeDuration(progress.activeSeconds)}` : ''} · الإصدار {course.version}
      </p>

      <div className="flex flex-wrap gap-3 print:hidden">
        {!result.passed && (
          <button type="button" className={btnPrimary} onClick={onRetry}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> أعد التقييم
          </button>
        )}
        <button type="button" className={btnLight} onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" /> اطبع النتيجة
        </button>
      </div>
    </section>
  );
}
