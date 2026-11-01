'use client';

import { Field, Select, TextArea } from '@/components/forms/Form';
import type { OpenAnswer, TrainingQuestion } from '@/lib/training';

const ar = (n: number) => n.toLocaleString('ar-EG');

/**
 * سؤال الكتابة في التقييم النهائي (V1.5، السؤال ٢٥).
 *
 * مالوش إجابة صحيحة — بياخد نقطة «إتمام» لو اتكتب فيه أي حاجة، والإدارة
 * بتقرا المضمون. لو فيه خانة `dialogue`، بنسأل الأول «الحوار عن أنهي سن؟».
 */
export function OpenQuestionBlock({
  number,
  q,
  value,
  onChange,
}: {
  number: number;
  q: TrainingQuestion;
  value: OpenAnswer;
  onChange: (next: OpenAnswer) => void;
}) {
  const fields = q.fields ?? [];
  const caseFields = fields.filter((f) => f.id !== 'dialogue');
  const set = (id: string, text: string) => onChange({ ...value, [id]: text });

  return (
    <fieldset className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
      <legend className="px-1 font-black leading-relaxed text-slate-900">
        {ar(number)}. {q.q}
      </legend>
      {q.prompt && <p className="font-medium leading-relaxed text-slate-700">{q.prompt}</p>}
      <p className="rounded-xl bg-white p-3 text-xs font-bold leading-relaxed text-slate-600">
        سؤال كتابة مالوش إجابة صحيحة أو غلط — الإدارة بتقراه عشان تتعرّف على طريقتك مع كل سن. الكتابة
        بتتحفظ على جهازك لحد ما تسلّم.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f.id} className={f.id === 'dialogue' ? 'space-y-3 md:col-span-2' : undefined}>
            {f.id === 'dialogue' && caseFields.length > 0 && (
              <Field label="الحوار عن أنهي حالة؟" name={`${q.id}-dialogueAge`}>
                <Select value={value.dialogueAge ?? ''} onChange={(e) => set('dialogueAge', e.target.value)}>
                  <option value="">اختر</option>
                  {caseFields.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={f.id === 'dialogue' ? f.label : `عمر المشارك: ${f.label}`} name={`${q.id}-${f.id}`}>
              <TextArea
                rows={f.id === 'dialogue' ? 7 : 6}
                maxLength={12000}
                value={value[f.id] ?? ''}
                onChange={(e) => set(f.id, e.target.value)}
                placeholder={
                  f.id === 'dialogue'
                    ? 'الميسّر: …\nالمشارك: …\nالميسّر: …'
                    : 'أول عبارة سأقولها…\nالخطوة أو الأداة التي سأقترحها…\nكيف ألاحظ أثر المساعدة ومتى أغيّرها…'
                }
              />
            </Field>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
