'use client';

import { useState, useTransition } from 'react';
import { reviewTrainingAttempt } from '@/actions/training';
import { BusyButton, Field, Select, TextArea } from '@/components/forms/Form';
import {
  BAND_DECISION_LABEL,
  REVIEW_BANDS,
  type AdminReview,
  type AttemptSignals,
  type BandDecision,
} from '@/lib/training-review';

const DECISION_TONE: Record<BandDecision, string> = {
  recommended: 'bg-emerald-50 text-emerald-800',
  followup: 'bg-amber-50 text-amber-900',
  not_yet: 'bg-slate-100 text-slate-700',
};

/**
 * مراجعة محاولة التقييم النهائي: إشارات لكل فئة عمرية + ترشيح الإدارة.
 *
 * ⚠️ مفيش توصية آلية — الإشارات للقراية، والترشيح قرار الإدارة (الملف V1.5
 *    بيقول كده صراحة: «لا يجوز ترتيب المدربين أو اعتماد توزيعهم بهذه الإجابات»).
 */
export function AttemptReviewPanel({
  attemptId,
  instructorId,
  signals,
  review,
  reviewedAt,
}: {
  attemptId: string;
  instructorId: string;
  signals: AttemptSignals;
  review: AdminReview | null;
  reviewedAt: string | null;
}) {
  const [bands, setBands] = useState<Record<string, string>>(() => ({ ...(review?.bands ?? {}) }));
  const [note, setNote] = useState(review?.note ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setMsg(null);
    start(async () => {
      const r = await reviewTrainingAttempt({ attemptId, instructorId, bands, note });
      setMsg(r.ok ? { ok: true, text: 'اتحفظ الترشيح.' } : { ok: false, text: r.error });
    });
  };

  const hasOpen = signals.open.length > 0;

  return (
    <div className="space-y-5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div>
        <p className="font-black text-slate-900">الترشيح للفئات العمرية — آخر محاولة</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
          الإشارات تحت للقراءة بس: موقف واحد لكل فئة + اللي كتبه عن كل سن. مش ترتيب ولا اعتماد —
          الترشيح قرارك، ويُستكمل بالمناقشة والتدريب العملي.
        </p>
      </div>

      <ul className="space-y-3">
        {signals.bands.map((b) => {
          const band = REVIEW_BANDS.find((x) => x.code === b.code)!;
          const decision = bands[b.code] as BandDecision | undefined;
          return (
            <li key={b.code} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-black text-slate-900">{band.label}</span>
                {decision && (
                  <span className={`rounded-full px-3 py-0.5 text-xs font-black ${DECISION_TONE[decision]}`}>
                    {BAND_DECISION_LABEL[decision]}
                  </span>
                )}
              </div>
              {b.situation ? (
                <p className="text-sm leading-relaxed text-slate-700">
                  <span className={`font-black ${b.situation.aligned ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {b.situation.aligned ? 'موقف الفئة: استجابة منسجمة. ' : 'موقف الفئة: يستحق مناقشة. '}
                  </span>
                  اختار: «{b.situation.picked ?? 'لم يحدّد'}»
                </p>
              ) : (
                <p className="text-xs font-medium text-slate-500">مفيش موقف مخصص للفئة دي في الإصدار ده.</p>
              )}
              {hasOpen &&
                (b.written ? (
                  <blockquote className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
                    {b.written}
                  </blockquote>
                ) : (
                  <p className="text-xs font-bold text-slate-500">ماكتبش حاجة عن السن ده.</p>
                ))}
              <Field label="ترشيحك" name={`band-${b.code}`} className="max-w-xs">
                <Select value={bands[b.code] ?? ''} onChange={(e) => setBands((p) => ({ ...p, [b.code]: e.target.value }))}>
                  <option value="">— لسه —</option>
                  {(Object.keys(BAND_DECISION_LABEL) as BandDecision[]).map((d) => (
                    <option key={d} value={d}>
                      {BAND_DECISION_LABEL[d]}
                    </option>
                  ))}
                </Select>
              </Field>
            </li>
          );
        })}
      </ul>

      {signals.open.map((o) => {
        const dialogue = o.fields.find((f) => f.id === 'dialogue');
        return dialogue ? (
          <div key={o.questionId} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-black text-slate-900">
              الحوار التطبيقي{o.dialogueAge ? ` — حالة ${o.dialogueAge}` : ''}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">
              {dialogue.text || 'ماكتبش حوار.'}
            </p>
          </div>
        ) : null;
      })}

      {signals.followups.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-black text-amber-900">نقاط للمناقشة ({signals.followups.length})</p>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-amber-950">
            {signals.followups.map((f) => (
              <li key={f.questionNumber}>
                <span className="font-black">
                  س{f.questionNumber} · {f.category}:
                </span>{' '}
                {f.observation} <span className="font-bold">← {f.followup}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Field label="ملاحظة للإدارة (اختياري)" name="review-note">
        <TextArea rows={3} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <BusyButton busy={pending} onClick={save}>
          احفظ الترشيح
        </BusyButton>
        {msg && (
          <span role="status" className={`text-sm font-bold ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>
            {msg.text}
          </span>
        )}
        {!msg && reviewedAt && (
          <span className="text-xs font-medium text-slate-500">
            آخر مراجعة: {new Date(reviewedAt).toLocaleDateString('ar-EG')}
          </span>
        )}
      </div>
    </div>
  );
}
