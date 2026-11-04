import type { CourseContent, OpenAnswer } from '@/lib/training';

/**
 * مراجعة الإدارة لمحاولة التقييم النهائي — ترشيح المدرب لكل فئة عمرية.
 *
 * ⚠️ مفيش هنا «توصية آلية» (الملف V1.5 نفسه بيمنعها): بنجمع **إشارات**
 *    بس — إجابة موقف كل فئة (adminBand)، وملاحظات المتابعة على الاختيارات
 *    الغلط، وإجابات سؤال الكتابة لكل سن. القرار للإدارة.
 */

export const REVIEW_BANDS = [
  { code: 'A', label: '6–9 سنوات', openField: 'age7' },
  { code: 'B', label: '10–12 سنة', openField: 'age11' },
  { code: 'C', label: '13–17 سنة', openField: 'age15' },
  { code: 'DE', label: '18 سنة فما فوق', openField: 'age19' },
] as const;

export type BandCode = (typeof REVIEW_BANDS)[number]['code'];
export type BandDecision = 'recommended' | 'followup' | 'not_yet';

export const BAND_DECISION_LABEL: Record<BandDecision, string> = {
  recommended: 'مرشّح',
  followup: 'محتاج متابعة',
  not_yet: 'مش دلوقتي',
};

export type AdminReview = { bands: Partial<Record<BandCode, BandDecision>>; note: string | null };

export function readAdminReview(raw: unknown): AdminReview | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { bands?: unknown; note?: unknown };
  const bands: AdminReview['bands'] = {};
  if (r.bands && typeof r.bands === 'object') {
    for (const b of REVIEW_BANDS) {
      const v = (r.bands as Record<string, unknown>)[b.code];
      if (v === 'recommended' || v === 'followup' || v === 'not_yet') bands[b.code] = v;
    }
  }
  return { bands, note: typeof r.note === 'string' ? r.note : null };
}

export type BandSignal = {
  code: BandCode;
  label: string;
  /** موقف الفئة في الاختيارات (لو الملف فيه). */
  situation: { question: string; picked: string | null; aligned: boolean } | null;
  /** اللي كتبه عن السن ده في سؤال الكتابة. */
  written: string | null;
};

export type Followup = { questionNumber: number; question: string; picked: string; category: string; observation: string; followup: string };

export type AttemptSignals = {
  bands: BandSignal[];
  followups: Followup[];
  /** إجابات سؤال الكتابة كلها (للعرض)، بالترتيب. */
  open: { questionId: string; question: string; fields: { id: string; label: string; text: string }[]; dialogueAge: string | null }[];
};

export function attemptSignals(
  content: CourseContent,
  selected: Record<string, number> | null,
  openAnswers: Record<string, OpenAnswer> | null,
): AttemptSignals {
  const sel = selected ?? {};
  const open = openAnswers ?? {};
  const qs = content.finalQuestions;

  const openQ = qs.filter((q) => q.type === 'open_response');
  const firstOpen = openQ[0] ? (open[openQ[0].id] ?? {}) : {};

  const bands: BandSignal[] = REVIEW_BANDS.map((b) => {
    const q = qs.find((x) => x.adminBand === b.code && x.type !== 'open_response');
    const pick = q ? sel[q.id] : undefined;
    return {
      code: b.code,
      label: b.label,
      situation: q
        ? { question: q.q, picked: Number.isInteger(pick) ? (q.opts[pick as number] ?? null) : null, aligned: pick === q.correct }
        : null,
      written: (firstOpen[b.openField] ?? '').trim() || null,
    };
  });

  const followups: Followup[] = [];
  qs.forEach((q, i) => {
    const pick = sel[q.id];
    if (!Number.isInteger(pick)) return;
    const rule = content.adminFollowups?.[q.id]?.[String(pick)];
    if (rule) {
      followups.push({
        questionNumber: i + 1,
        question: q.q,
        picked: q.opts[pick] ?? '',
        category: rule[0],
        observation: rule[1],
        followup: rule[2],
      });
    }
  });

  return {
    bands,
    followups,
    open: openQ.map((q) => {
      const a = open[q.id] ?? {};
      return {
        questionId: q.id,
        question: q.q,
        fields: (q.fields ?? []).map((f) => ({ id: f.id, label: f.label, text: (a[f.id] ?? '').trim() })),
        dialogueAge: a.dialogueAge ? ((q.fields ?? []).find((f) => f.id === a.dialogueAge)?.label ?? a.dialogueAge) : null,
      };
    }),
  };
}
