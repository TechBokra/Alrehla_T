import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * ⚠️ **حارس التوحيد — بيمنع الرجوع للخلف.**
 *
 * كل اللوحات وحساب العميل اتحوّلوا على النماذج الموحّدة (`components/forms`)،
 * والعمليات بقت بترجّع الخطأ بدل ما ترميه (قاعدة «هـ»: Next بيمسح نصّ
 * الخطأ اللي بيترمي في الموقع المنشور، فالمستخدم بيشوف رسالة إنجليزي عامة).
 *
 * الاختبار ده بيفشل لو أي حد — أو أي أداة زي Google AI Studio — ضاف:
 *   ١) شاشة في أي لوحة (الإدارة، المدرب، الناشر، الطالب) أو حساب العميل فيها خانة (`<input>` / `<select>` / `<textarea>`)
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

/**
 * شاشات وخانات الصور (Cloudinary) — مؤجّلة عن قصد لمرحلة الرفع بالتوقيع.
 * (`ImageField`/`GalleryField` هما نفسهم خانة الرفع اللي الكيت بيلفّها.)
 */
const RAW_INPUT_ALLOWED = new Set([
  'src/app/dashboard/admin/media/OrphanGallery.tsx',
  'src/app/dashboard/admin/content/images/SiteImagesClient.tsx',
  'src/app/dashboard/admin/content/settings/PaymentQrUploader.tsx',
  'src/components/dashboard/ImageField.tsx',
  'src/components/dashboard/GalleryField.tsx',
  'src/components/dashboard/ProfileFormShell.tsx', // مش مستخدم في أي شاشة
  // أدوات بحث وفلترة واختيار — مش نماذج حفظ، ومستخدمة جوه نماذج الكيت.
  'src/app/dashboard/instructor/sessions/InstructorSessionsClient.tsx',
  'src/app/account/bookings/AccountBookingsClient.tsx',
  'src/app/support/SupportClient.tsx',
  'src/components/dashboard/AvatarPicker.tsx',
  'src/components/dashboard/InviteLinkBox.tsx',
  'src/components/dashboard/LibraryPicker.tsx',
  'src/components/dashboard/PackagePicker.tsx',
  'src/components/dashboard/Pagination.tsx',
  'src/components/dashboard/SessionsList.tsx',
  'src/components/dashboard/SimpleDataTable.tsx',
  'src/components/dashboard/WeeklySchedulePicker.tsx',
]);

/** كل اللوحات وحساب العميل — مش لوحة الإدارة بس. */
const FORM_DIRS = [
  'src/app/dashboard',
  'src/app/account',
  'src/app/support',
  'src/components/dashboard',
  'src/components/services',
];

/**
 * ملفات عمليات لسه فيها `throw` — الرقم ده **سقف**: ينزل بس، مايزيدش.
 * لما ملف يتنضّف، سطره بيتشال من هنا خالص.
 */
const LEGACY_THROWS: Record<string, number> = {
  'src/actions/content.ts': 2, // saveSiteImage — شاشة الصور (Cloudinary، مؤجّلة)
};

const countThrows = (src: string) => (src.match(/throw new Error\(/g) ?? []).length;

describe('حارس توحيد النماذج والعمليات', () => {
  it('كل شاشة في اللوحات وحساب العميل فيها خانة بتستخدم النماذج الموحّدة', () => {
    const offenders = FORM_DIRS.flatMap((d) => walk(join(ROOT, d)))
      .filter((p) => p.endsWith('.tsx'))
      .filter((p) => !RAW_INPUT_ALLOWED.has(rel(p)))
      .filter((p) => {
        const src = readFileSync(p, 'utf8');
        return /<(input|select|textarea)[\s>]/.test(src) && !src.includes('components/forms/Form');
      })
      .map(rel);
    expect(offenders, 'شاشة بخانات قديمة — استخدم Field/TextInput/Select من components/forms/Form').toEqual([]);
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
