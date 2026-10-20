'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { ANSWER_MAX, answerKey, type CustomizationField } from '@/lib/customization-fields';

/**
 * خانات التخصيص اللي الإدارة ضافتها (ملف 06) — تحت خانات الأساس.
 *
 * ⚠️ الإلزام **مش في مخطّط zod** (الخانات بتيجي من القاعدة مش ثابتة في
 *    الكود): المعالج بيفحصها بـ`checkExtraAnswers` مع «الخطوة التالية»
 *    ومع «إضافة للسلة»، وبيقول اسم الخانة الناقصة.
 */
export function ExtraFieldsSection({ fields }: { fields: CustomizationField[] }) {
  const { register } = useFormContext();
  if (fields.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-slate-100 pt-4">
      {fields.map((f) => {
        const id = `extra-${f.id}`;
        return (
          <div key={f.id} className="space-y-2">
            <label htmlFor={id} className="text-sm font-bold text-slate-700">
              {f.label} {f.isRequired ? '(إلزامي)' : '(اختياري)'}
            </label>
            <input
              id={id}
              type="text"
              maxLength={ANSWER_MAX}
              placeholder={f.placeholder}
              {...register(`extraFields.${answerKey(f.id)}`)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        );
      })}
    </div>
  );
}

/** نفس الخانات في خطوة المراجعة. */
export function ExtraFieldsReview({
  fields,
  answers,
}: {
  fields: CustomizationField[];
  answers: Record<string, unknown> | undefined;
}) {
  const filled = fields
    .map((f) => ({ label: f.label, value: String(answers?.[answerKey(f.id)] ?? '').trim() }))
    .filter((a) => a.value);
  if (filled.length === 0) return null;
  return (
    <>
      {filled.map((a) => (
        <div key={a.label}>
          <span className="mb-1 block text-slate-500">{a.label}:</span>
          <span className="font-bold text-slate-800">{a.value}</span>
        </div>
      ))}
    </>
  );
}
