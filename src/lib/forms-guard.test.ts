import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * ⚠️ **حارس التوحيد — بيمنع الرجوع للخلف.**
 *
 * لوحة الإدارة اتحوّلت كلها على النماذج الموحّدة (`components/forms`)،
 * والعمليات بقت بترجّع الخطأ بدل ما ترميه (قاعدة «هـ»: Next بيمسح نصّ
 * الخطأ اللي بيترمي في الموقع المنشور، فالمستخدم بيشوف رسالة إنجليزي عامة).
 *
 * الاختبار ده بيفشل لو أي حد — أو أي أداة زي Google AI Studio — ضاف:
 *   ١) شاشة في اللوحة فيها خانة (`<input>` / `<select>` / `<textarea>`)
 *      من غير النماذج الموحّدة.
 *   ٢) `throw new Error` في ملف عمليات نضيف، أو زوّد عددها في ملف قديم.
 *
 * لو الفشل مقصود فعلًا (حالة خاصة)، الاستثناء بيتكتب هنا بسبب — مش بيتشال الاختبار.
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p: string) => relative(ROOT, p).split('\\').join('/');

/** شاشات الصور (Cloudinary) — مؤجّلة عن قصد لمرحلة الرفع بالتوقيع. */
const RAW_INPUT_ALLOWED = new Set([
  'src/app/dashboard/admin/media/OrphanGallery.tsx',
  'src/app/dashboard/admin/content/images/SiteImagesClient.tsx',
  'src/app/dashboard/admin/content/settings/PaymentQrUploader.tsx',
]);

/**
 * ملفات عمليات لسه فيها `throw` — الرقم ده **سقف**: ينزل بس، مايزيدش.
 * لما ملف يتنضّف، سطره بيتشال من هنا خالص.
 * (أغلبها بتاع لوحات المدرب والناشر وحساب العميل — المرحلة الجاية.)
 */
const LEGACY_THROWS: Record<string, number> = {
  'src/actions/admin-users.ts': 1, // requireSuperAdmin داخلي — المناديين بيلفّوه
  'src/actions/content.ts': 2, // saveSiteImage — شاشة الصور
  'src/actions/dependent-requests.ts': 1,
  'src/actions/instructor-services.ts': 13,
  'src/actions/instructors.ts': 5,
  'src/actions/portfolio.ts': 6,
  'src/actions/profiles.ts': 10,
  'src/actions/reviews.ts': 9,
  'src/actions/service-orders.ts': 40,
  'src/actions/student-accounts.ts': 1,
  'src/actions/support.ts': 6,
  'src/app/actions/family.ts': 3,
};

const countThrows = (src: string) => (src.match(/throw new Error\(/g) ?? []).length;

describe('حارس توحيد النماذج والعمليات', () => {
  it('كل شاشة في لوحة الإدارة فيها خانة بتستخدم النماذج الموحّدة', () => {
    const offenders = walk(join(ROOT, 'src/app/dashboard/admin'))
      .filter((p) => p.endsWith('.tsx'))
      .filter((p) => !RAW_INPUT_ALLOWED.has(rel(p)))
      .filter((p) => {
        const src = readFileSync(p, 'utf8');
        return /<(input|select|textarea)[\s>]/.test(src) && !src.includes('components/forms/Form');
      })
      .map(rel);
    expect(offenders, 'شاشة إدارة بخانات قديمة — استخدم Field/TextInput/Select من components/forms/Form').toEqual([]);
  });

  it('ملفات العمليات النضيفة مافيهاش throw، والقديمة ماتزيدش', () => {
    const files = [
      ...walk(join(ROOT, 'src/actions')),
      ...walk(join(ROOT, 'src/app/actions')),
    ].filter((p) => p.endsWith('.ts') && !p.endsWith('.test.ts'));

    const problems: string[] = [];
    for (const p of files) {
      const n = countThrows(readFileSync(p, 'utf8'));
      const cap = LEGACY_THROWS[rel(p)] ?? 0;
      if (n > cap) problems.push(`${rel(p)}: ${n} throw (المسموح ${cap}) — رجّع { ok: false, error } بدل ما ترمي`);
    }
    expect(problems).toEqual([]);
  });

  it('السقف بينزل لما ملف يتنضّف — مفيش أرقام قديمة متسيبة', () => {
    const stale = Object.entries(LEGACY_THROWS)
      .filter(([f, cap]) => countThrows(readFileSync(join(ROOT, f), 'utf8')) < cap)
      .map(([f]) => f);
    expect(stale, 'نزّل الرقم في LEGACY_THROWS (أو شيل السطر لو بقى صفر)').toEqual([]);
  });
});
