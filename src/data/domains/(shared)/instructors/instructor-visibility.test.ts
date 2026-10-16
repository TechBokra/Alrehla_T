import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isPubliclyVisible } from './public';
import type { PublicInstructor } from '@/types';

const asInstructor = (status: string): PublicInstructor =>
  ({ id: 'i1', status } as unknown as PublicInstructor);

/**
 * ⚠️ **دالة `public_instructors()` في القاعدة مالهاش فلتر حالة خالص.**
 *    فالفلترة كلها في الكود — وما كانتش بتحصل في قايمة المدربين ولا
 *    في صفحة الملف ولا في خريطة الموقع. النتيجة إن حساب تجريبي ومدرب
 *    موقوف وملف فاضي كانوا معروضين للزوار ومفهرَسين في جوجل.
 */
describe('مين بيتعرض للزوار', () => {
  it('المفعَّل وحده', () => {
    expect(isPubliclyVisible(asInstructor('active'))).toBe(true);
  });

  it('المخفي والموقوف وتحت التدريب لأ', () => {
    for (const s of ['hidden', 'suspended', 'pending_training', 'pending_approval']) {
      expect(isPubliclyVisible(asInstructor(s))).toBe(false);
    }
  });
});

/**
 * الصفحات العامة لازم تنادي `getVisibleInstructors` /
 * `getVisibleInstructorById` — مش النسخة الخام.
 *
 * الخام مسموحة في لوحة الإدارة ولوحة المدرب نفسه: المدرب المخفي
 * المفروض يفضل شايف لوحته وشغّال، والإدارة لازم تشوف الكل.
 */
const PUBLIC_DIRS = ['src/app/(client)', 'src/data/domains/(client)'];
const EXTRA_PUBLIC_FILES = ['src/app/sitemap.ts'];
const RAW = /getPublicInstructors|getPublicInstructorById/;

/**
 * الاستثناءات — وكلها من نوع واحد: **الشخص مرتبط بالمدرب ده بالفعل.**
 *
 * الفرق مش شكلي. صفحات الاكتشاف (القايمة، الملف، الحجز، خريطة الموقع)
 * بتعرّف الزائر على حد جديد — ودي لازم تتفلتر. إنما الطالب اللي حاجز
 * جلسة مع مدرب اتخفى بعدها لازم يفضل شايف اسمه في صفحة جلسته، والولي
 * كمان في متابعة ابنه. فلترتهم كانت هتفضّي صفحة جلسة قائمة من اسم
 * المدرب — يعني الإخفاء يضرب عميل دافع.
 */
const ALLOWED_RAW = new Set([
  'src/data/domains/(client)/sessions/page-data.ts',
  'src/data/domains/(client)/family/follow-up.ts',
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !name.includes('.test.')) out.push(full);
  }
  return out;
}

describe('الصفحات العامة بتنادي النسخة المفلترة', () => {
  it('مفيش صفحة عامة بتنادي قايمة المدربين الخام', () => {
    const files = [...PUBLIC_DIRS.flatMap(walk), ...EXTRA_PUBLIC_FILES];
    const offenders = files.filter(
      (f) => !ALLOWED_RAW.has(f) && RAW.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  // الاستثناء لازم يفضل مقصودًا: لو الملف اتشال أو اتصلّح، يتشال من
  // القايمة كمان بدل ما تفضل بتغطّي على حاجة مش موجودة.
  it('كل استثناء لسه بينادي الخام فعلًا', () => {
    for (const f of ALLOWED_RAW) {
      expect(RAW.test(readFileSync(f, 'utf8')), f).toBe(true);
    }
  });
});
