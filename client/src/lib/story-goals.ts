/**
 * أهداف التخصيص اللي الإدارة بتتحكم فيها (ملف 12).
 *
 * كانت أربعة ثابتين في `Step2Details`. بقت جدول، وكل هدف ممكن يظهر في
 * كل المنتجات أو منتجات بعينها.
 *
 * ⚠️ **الطلب بيحفظ نص الهدف نفسه** مش رقمه — لو الإدارة غيّرت اسم الهدف
 *    أو مسحته، الطلب القديم بيفضل مقروء. والطلبات الأقدم من كده حافظة
 *    كلمة قصيرة («شجاعة») وبتتترجم في `order-customization.ts`.
 *
 * ⚠️ من غير React ولا قاعدة — عشان يتختبر.
 */

import type { AppliesTo } from './applies-to';

export type StoryGoal = {
  id: string;
  label: string;
  appliesTo: AppliesTo;
  isActive: boolean;
  sortOrder: number;
};

export const GOAL_LABEL_MIN = 2;
export const GOAL_LABEL_MAX = 120;
/** سقف عدد الأهداف — قايمة اختيار، مش كتالوج. */
export const GOALS_MAX = 30;

/**
 * الأربعة اللي كانوا في الكود — بنفس كلام ملف 12.
 *
 * ⚠️ دول **الاحتياطي** لو الجدول مش موجود (الكود اتنشر قبل ما ملف 12
 *    يتشغّل) أو القاعدة وقعت: العميل لازم يلاقي أهداف يختار منها.
 */
export const DEFAULT_GOALS: StoryGoal[] = [
  'الشجاعة والتغلب على الخوف',
  'بناء الثقة بالنفس',
  'تعلم حل المشكلات',
  'التعاون مع الآخرين',
].map((label, i) => ({
  id: `default-${i + 1}`,
  label,
  appliesTo: null,
  isActive: true,
  sortOrder: i + 1,
}));

/** فحص هدف قبل الحفظ من اللوحة — نفس قيد القاعدة برسالة عربي. */
export function validateGoalInput(input: {
  label: unknown;
}): { ok: true; label: string } | { ok: false; error: string } {
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  if (!label) return { ok: false, error: 'اكتب الهدف زي ما هيظهر للعميل' };
  if (label.length < GOAL_LABEL_MIN) return { ok: false, error: `الهدف لازم يبقى ${GOAL_LABEL_MIN} حروف على الأقل` };
  if (label.length > GOAL_LABEL_MAX) return { ok: false, error: `الهدف أطول من ${GOAL_LABEL_MAX} حرف` };
  // ⚠️ 'other' قيمة محجوزة في القايمة لـ«هدف آخر — أكتبه بنفسي».
  if (label.toLowerCase() === 'other') return { ok: false, error: 'الكلمة دي محجوزة — اكتب الهدف بالعربي' };
  return { ok: true, label };
}
