/**
 * التأهيل التأسيسي الذاتي للمدربين — طلب تامر (٢٤ أكتوبر).
 *
 * «بدل ما ملف التأهيل منفصل، نخليه داخل الموقع ومرتبط بملف المدربين
 *  ولوحة التحكم».
 *
 * ── الفرق عن الملف المنفصل ──────────────────────────────────
 *
 *   • المحتوى في القاعدة (`training_courses`)، والإجابات الصحيحة
 *     **مابتوصلش للمتصفح** — التصحيح في القاعدة
 *     (`training_submit_module` / `training_submit_final`).
 *   • التقدّم متسجّل باسم حساب المدرب، والإدارة بتشوفه في ملفه.
 *   • ⚠️ **الاجتياز مش اعتماد** (الملف نفسه بيقول كده): قرار
 *     `training_passed` بيفضل للإدارة بعد التدريب العملي. التأهيل
 *     خطوة قبله، وإلزامية قبل التفعيل لو الإدارة اختارت.
 */

export const FOUNDATION_COURSE_ID = 'foundation';

/**
 * الافتراضي لو الإعدادات لسه ماوصلتش (قبل ترحيل 20261027090000).
 * القيم الحقيقية من لوحة التحكم ← «التأهيل التأسيسي» (قرار تامر، ٢٧ أكتوبر).
 */
export const DEFAULT_ESTIMATE = { min: 45, max: 60 };
export const DEFAULT_IDLE_MINUTES = 3;

const AR_COUNT: Record<number, string> = { 1: 'دقيقة واحدة', 2: 'دقيقتين', 3: 'ثلاث دقائق', 4: 'أربع دقائق', 5: 'خمس دقائق', 10: 'عشر دقائق' };

/** «ثلاث دقائق» / «١٥ دقيقة» — بالفصحى زي نص الصفحة. */
export function minutesLabel(n: number): string {
  if (AR_COUNT[n]) return AR_COUNT[n];
  const ar = n.toLocaleString('ar-EG');
  return n <= 10 ? `${ar} دقائق` : `${ar} دقيقة`;
}

/** «من ٤٥ إلى ٦٠ دقيقة» (أو «حوالي ٣٠ دقيقة» لو الرقمين واحد). */
export function estimateLabel(min: number, max: number): string {
  const ar = (n: number) => n.toLocaleString('ar-EG');
  return min === max ? `حوالي ${ar(min)} دقيقة` : `من ${ar(min)} إلى ${ar(max)} دقيقة`;
}

/** مكان المدرب في الصفحات — بيتفتكر على الجهاز (التقدّم نفسه في حسابه). */
export type TrainingPosition = { module: number; page: number };

export function positionKey(courseId: string): string {
  return `alrehla:training:${courseId}:pos`;
}

export function finalDraftKey(courseId: string): string {
  return `alrehla:training:${courseId}:final`;
}

/** مكان محفوظ صالح للدورة دي؟ (المحتوى ممكن يتغيّر بنسخة جديدة.) */
export function validPosition(
  raw: unknown,
  modules: { pages: unknown[] }[],
): TrainingPosition | null {
  const p = raw as Partial<TrainingPosition> | null;
  if (!p || !Number.isInteger(p.module) || !Number.isInteger(p.page)) return null;
  const m = modules[p.module as number];
  if (!m || (p.page as number) < 0 || (p.page as number) > m.pages.length) return null;
  return { module: p.module as number, page: p.page as number };
}

export type TrainingCard = [string, string];

export type TrainingScenario = {
  prompt: string;
  choices: string[];
  answer: number;
  feedback: string;
};

export type TrainingPage = {
  title: string;
  paragraphs: string[];
  cards?: TrainingCard[];
  note?: string;
  scenario?: TrainingScenario;
};

/** خانة كتابة في سؤال مفتوح (V1.5: خانة لكل سن + حوار). */
export type OpenField = { id: string; label: string; type?: 'textarea' | string };

/**
 * سؤال زي ما بيوصل للمدرب — من غير الإجابة ولا التعليل.
 *
 * `type: 'open_response'` (من V1.5): سؤال كتابة مالوش إجابة صحيحة.
 * بياخد نقطة «إتمام» لو اتكتب فيه أي حاجة، ومضمونه بيتقرا من الإدارة
 * (قرار الملف نفسه: «لا توجد درجة لجودة المضمون أو توصية آلية»).
 */
export type TrainingQuestion = {
  id: string;
  q: string;
  opts: string[];
  topic?: string;
  type?: 'multiple_choice' | 'open_response';
  prompt?: string;
  fields?: OpenField[];
};

export function isOpenQuestion(q: { type?: string } | null | undefined): boolean {
  return q?.type === 'open_response';
}

/** إجابة السؤال المفتوح: نص لكل خانة (+ `dialogueAge` لو موجود). */
export type OpenAnswer = Record<string, string>;

export type TrainingModule = {
  title: string;
  subtitle: string;
  tag: string;
  goal: string;
  pages: TrainingPage[];
  questions: TrainingQuestion[];
};

export type ModuleProgress = {
  attempts: number;
  lastScore: number;
  bestScore: number;
  total: number;
  passedAt: string | null;
};

export type TrainingProgress = {
  startedAt: string;
  activeSeconds: number;
  modules: Record<string, ModuleProgress>;
  finalAttempts: number;
  bestScore: number | null;
  passedAt: string | null;
  passedVersion: string | null;
};

export type LearnerCourse = {
  id: string;
  title: string;
  version: string;
  modulePassPct: number;
  finalPassPct: number;
  criticalRequired: boolean;
  criticalTotal: number;
  topics: string[];
  modules: TrainingModule[];
  finalQuestions: TrainingQuestion[];
  progress: TrainingProgress | null;
  /** من لوحة التحكم — ممكن تغيب قبل الترحيل، فالقراءة بالافتراضي. */
  estimateMin?: number;
  estimateMax?: number;
  idleMinutes?: number;
  /** false = إداري بيعاين (التصحيح شغّال، ومفيش حفظ). */
  learner: boolean;
};

export type ReviewRow = {
  correct: boolean;
  selected: number;
  right: string;
  why: string;
  id?: string;
  topic?: string;
  critical?: boolean;
};

export type ModuleResult = { score: number; total: number; passed: boolean; rows: ReviewRow[] };

export type FinalResult = {
  attemptId: string | null;
  score: number;
  correct: number;
  total: number;
  criticalCorrect: number;
  criticalTotal: number;
  passed: boolean;
  passPct: number;
  /**
   * نتيجة كل مجال، والوحدات اللي محتاجة مراجعة (أرقام من 0).
   * ⚠️ مفيش إجابات صحيحة ولا صح/غلط لكل سؤال — قرار تامر (٢٧ أكتوبر).
   */
  topics?: { topic: string; correct: number; total: number }[];
  reviewModules?: number[];
};

export function moduleDone(progress: TrainingProgress | null, index: number): boolean {
  return typeof progress?.modules?.[String(index)]?.passedAt === 'string';
}

export function doneCount(progress: TrainingProgress | null, total: number): number {
  let n = 0;
  for (let i = 0; i < total; i++) if (moduleDone(progress, i)) n++;
  return n;
}

export function allModulesDone(progress: TrainingProgress | null, total: number): boolean {
  return total > 0 && doneCount(progress, total) === total;
}

/** المدة النشطة: «٢ س، ١٥ د». */
export function activeDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ar = (n: number) => n.toLocaleString('ar-EG');
  return h > 0 ? `${ar(h)} س، ${ar(m)} د` : `${ar(m)} د`;
}

/** نتيجة المجالات في محاولة نهائية. */
export function topicStats(topics: string[], rows: ReviewRow[]) {
  return topics
    .map((topic) => {
      const qs = rows.filter((r) => r.topic === topic);
      return { topic, total: qs.length, correct: qs.filter((r) => r.correct).length };
    })
    .filter((t) => t.total > 0);
}

/** حالة المدرب في التأهيل — سطر واحد للإدارة ولوحته. */
export type TrainingStatus = 'not_started' | 'in_progress' | 'ready_for_final' | 'passed';

export function trainingStatus(progress: TrainingProgress | null, moduleCount: number): TrainingStatus {
  if (!progress) return 'not_started';
  if (progress.passedAt) return 'passed';
  if (allModulesDone(progress, moduleCount)) return 'ready_for_final';
  return 'in_progress';
}

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  not_started: 'مابدأش',
  in_progress: 'بيدرس',
  ready_for_final: 'خلّص الوحدات — فاضل التقييم النهائي',
  passed: 'اجتاز التأهيل',
};

/** قراءة صف التقدّم من القاعدة (snake_case أو اللي راجع من الدالة). */
export function readProgress(raw: unknown): TrainingProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const pick = (a: string, b: string) => (r[a] ?? r[b]) as unknown;
  const modules = (pick('modules', 'modules') ?? {}) as Record<string, ModuleProgress>;
  return {
    startedAt: String(pick('startedAt', 'started_at') ?? ''),
    activeSeconds: Number(pick('activeSeconds', 'active_seconds') ?? 0) || 0,
    modules: modules && typeof modules === 'object' ? modules : {},
    finalAttempts: Number(pick('finalAttempts', 'final_attempts') ?? 0) || 0,
    bestScore: (pick('bestScore', 'best_score') as number | null) ?? null,
    passedAt: (pick('passedAt', 'passed_at') as string | null) ?? null,
    passedVersion: (pick('passedVersion', 'passed_version') as string | null) ?? null,
  };
}

// ══ استيراد نسخة جديدة من ملف HTML ═══════════════════════════
//
// ⚠️ الإدارة بتستلم الدورة كملف HTML (زي v5). بدل ما حد يحوّلها بإيده،
//    شاشة الإدارة بتقرا `const COURSE_DATA = {...};` من الملف وتتحقق
//    منها قبل الحفظ. أي ملف مش بالشكل ده بيترفض برسالة.

export type CourseContent = {
  modules: (Omit<TrainingModule, 'questions'> & {
    questions: (TrainingQuestion & { correct: number; why: string })[];
  })[];
  finalQuestions: (TrainingQuestion & {
    correct: number;
    why: string;
    critical?: boolean;
    /** للإدارة بس: الموقف ده بيخص أنهي فئة عمرية (A/B/C/DE). */
    adminBand?: string;
  })[];
  topics: string[];
  /**
   * للإدارة بس (`ADMIN_FOLLOWUP_RULES` في الملف): لكل سؤال، لكل اختيار
   * غلط ← [المجال، الملاحظة، المتابعة المقترحة].
   */
  adminFollowups?: Record<string, Record<string, [string, string, string]>>;
};

export type ImportResult =
  | { ok: true; content: CourseContent; version: string | null; title: string | null; passPct: number | null }
  | { ok: false; error: string };

function extractObject(src: string, marker: RegExp): string | null {
  const m = marker.exec(src);
  if (!m) return null;
  let i = src.indexOf('{', m.index + m[0].length - 1);
  if (i < 0) return null;
  const start = i;
  let depth = 0;
  let inStr: string | null = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") inStr = c;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

export function validateContent(raw: unknown): { ok: true; content: CourseContent } | { ok: false; error: string } {
  const c = raw as Partial<CourseContent> | null;
  if (!c || !Array.isArray(c.modules) || c.modules.length === 0) {
    return { ok: false, error: 'مفيش وحدات في الملف.' };
  }
  if (!Array.isArray(c.finalQuestions) || c.finalQuestions.length === 0) {
    return { ok: false, error: 'مفيش أسئلة تقييم نهائي في الملف.' };
  }
  const mcOk = (q: { q?: unknown; opts?: unknown; correct?: unknown }) =>
    typeof q?.q === 'string' &&
    Array.isArray(q.opts) &&
    q.opts.length >= 2 &&
    Number.isInteger(q.correct) &&
    (q.correct as number) >= 0 &&
    (q.correct as number) < q.opts.length;
  // السؤال المفتوح مالوش إجابة صحيحة — المطلوب نص السؤال وخانات الكتابة.
  const openOk = (q: { q?: unknown; fields?: unknown }) =>
    typeof q?.q === 'string' &&
    Array.isArray(q.fields) &&
    q.fields.length > 0 &&
    q.fields.every((f) => typeof f?.id === 'string' && /^[a-z0-9_]{1,40}$/i.test(f.id) && typeof f?.label === 'string');
  const qOk = (q: { type?: unknown; q?: unknown; opts?: unknown; correct?: unknown; fields?: unknown }) =>
    q?.type === 'open_response' ? openOk(q) : mcOk(q);
  for (const [i, m] of c.modules.entries()) {
    if (typeof m?.title !== 'string' || !Array.isArray(m.pages) || m.pages.length === 0) {
      return { ok: false, error: `الوحدة ${i + 1} ناقصة (العنوان أو الصفحات).` };
    }
    if (!Array.isArray(m.questions) || m.questions.length === 0 || !m.questions.every(mcOk)) {
      return { ok: false, error: `أسئلة الوحدة ${i + 1} ناقصة أو إجابتها الصحيحة مش محدّدة.` };
    }
    for (const [j, p] of m.pages.entries()) {
      if (typeof p?.title !== 'string' || !Array.isArray(p.paragraphs)) {
        return { ok: false, error: `الوحدة ${i + 1}، الصفحة ${j + 1}: ناقص العنوان أو الفقرات.` };
      }
    }
  }
  const badFinal = c.finalQuestions.findIndex((q) => !qOk(q));
  if (badFinal >= 0) {
    return {
      ok: false,
      error: isOpenQuestion(c.finalQuestions[badFinal])
        ? `السؤال النهائي ${badFinal + 1} (سؤال كتابة): ناقص نص السؤال أو خانات الإجابة.`
        : `السؤال النهائي ${badFinal + 1} ناقص أو إجابته الصحيحة مش محدّدة.`,
    };
  }
  if (!c.finalQuestions.some((q) => !isOpenQuestion(q))) {
    return { ok: false, error: 'التقييم النهائي محتاج سؤال اختيار واحد على الأقل.' };
  }
  const ids = c.finalQuestions.map((q) => q.id);
  if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
    return { ok: false, error: 'كل سؤال نهائي محتاج رقم تعريف (id) مختلف.' };
  }
  const topics = Array.isArray(c.topics) && c.topics.length > 0
    ? c.topics.filter((t): t is string => typeof t === 'string')
    : [...new Set(c.finalQuestions.map((q) => q.topic).filter((t): t is string => typeof t === 'string'))];
  const content = { modules: c.modules, finalQuestions: c.finalQuestions, topics } as CourseContent;
  if (c.adminFollowups && typeof c.adminFollowups === 'object') content.adminFollowups = c.adminFollowups;
  return { ok: true, content };
}

/** كائن JS بمفاتيح من غير تنصيص (`{f18:{0:[…]}}`) ← JSON. `null` لو ماتقراش. */
export function parseLooseObject(src: string): Record<string, Record<string, [string, string, string]>> | null {
  // بنحط التنصيص على المفاتيح بس — بره النصوص.
  let out = '';
  let inStr: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === '\\') out += src[++i] ?? '';
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      out += '"';
      if (c === "'") {
        // نص بعلامة مفردة ← نحوّله لمزدوجة.
        let j = i + 1;
        let body = '';
        while (j < src.length && src[j] !== "'") {
          if (src[j] === '\\') body += src[j++];
          body += src[j++];
        }
        out += body.replace(/"/g, '\\"') + '"';
        i = j;
        inStr = null;
      }
      continue;
    }
    const key = /^[A-Za-z_0-9]+(?=\s*:)/.exec(src.slice(i));
    if (key && /[{,\s]$/.test(out.trimEnd().slice(-1) || '{')) {
      out += `"${key[0]}"`;
      i += key[0].length - 1;
      continue;
    }
    out += c;
  }
  try {
    const v = JSON.parse(out.replace(/,\s*([}\]])/g, '$1'));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** يقرا ملف HTML بتاع الدورة (أو JSON) ويرجّع المحتوى بعد التحقق. */
export function importCourseFile(text: string): ImportResult {
  let data: unknown;
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: 'ملف JSON مش سليم.' };
    }
  } else {
    const obj = extractObject(text, /const\s+COURSE_DATA\s*=\s*/);
    if (!obj) return { ok: false, error: 'مالقيتش بيانات الدورة (COURSE_DATA) في الملف.' };
    try {
      data = JSON.parse(obj);
    } catch {
      return { ok: false, error: 'بيانات الدورة في الملف مش بصيغة سليمة.' };
    }
    // ملاحظات المتابعة للإدارة — كائن JS (مفاتيح من غير علامات تنصيص).
    const rules = extractObject(text, /const\s+ADMIN_FOLLOWUP_RULES\s*=\s*/);
    if (rules && data && typeof data === 'object') {
      const parsed = parseLooseObject(rules);
      if (parsed) (data as Record<string, unknown>).adminFollowups = parsed;
    }
    const topicsMatch = /const\s+TOPICS\s*=\s*(\[[^\]]*\])/.exec(text);
    if (topicsMatch && data && typeof data === 'object' && !('topics' in data)) {
      try {
        (data as Record<string, unknown>).topics = JSON.parse(topicsMatch[1]);
      } catch {
        /* المجالات بتتستنتج من الأسئلة */
      }
    }
  }
  const checked = validateContent(data);
  if (!checked.ok) return checked;

  const version =
    /version\s*:\s*'([^']+)'/.exec(text)?.[1] ?? /الإصدار[^0-9]{0,20}([0-9]+(?:\.[0-9]+)+)/.exec(text)?.[1] ?? null;
  const title = /<title>([^<|]+)/.exec(text)?.[1]?.trim() ?? null;
  const pass = /REQUIRED_SCORE\s*=\s*(\d+)/.exec(text)?.[1];
  return { ok: true, content: checked.content, version, title, passPct: pass ? Number(pass) : null };
}
