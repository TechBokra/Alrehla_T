import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * حرّاس شكل الموبايل.
 *
 * ── ليه الملف ده موجود ──────────────────────────────────────
 *
 * التبويبات اللي اتضافت النهارده اتكتبت `flex-wrap`، واللي بيبان
 * سليم على الشاشة الكبيرة. بالقياس على ٣٧٥ بكسل التلات تبويبات بقوا
 * **تلات سطور**: الشريط ١١٣ بكسل، لازق فوق طول الوقت، **١٤٪ من
 * شاشة الموبايل** بتتاكل من المحتوى في كل لحظة.
 *
 * المشكلة إن الغلطة دي **مابتبانش في المتصفح العادي** — لازم تقيس
 * على مقاس موبايل حقيقي عشان تشوفها. فالحارس هنا بدل القياس.
 */

const read = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

/**
 * الكود من غير التعليقات.
 *
 * ⚠️ **لازم**: التعليقات في الملفات دي بتشرح الغلطة بالاسم (بتكتب
 *    `flex-wrap` بالحرف عشان تقول «ده كان كده وبقى كده»)، فحارس
 *    بيدوّر في الملف كله بيلقى الكلمة في الشرح ويفشل وهو غلطان.
 */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

describe('شكل الموبايل — الصف اللي بيتزحلق', () => {
  const row = codeOnly(read('lib/scroll-row.ts'));

  it('التعليقات اتشالت فعلًا قبل الفحص', () => {
    // الحارس بيتأكد من نفسه: لو الشيل مابيشيلش، الفحص اللي تحت بلا معنى.
    expect(codeOnly('/* `flex-wrap` في الشرح */ const a = 1;')).not.toContain('flex-wrap');
    expect(codeOnly('// `flex-wrap` في الشرح\nconst a = 1;')).not.toContain('flex-wrap');
    expect(row).toContain('SCROLL_ROW'); // ومافضلش ملف فاضي
  });

  it('سطر واحد بيتزحلق، مش سطور بتتلفّ', () => {
    expect(row).toContain('flex-nowrap');
    expect(row).toContain('overflow-x-auto');
    // ⚠️ `flex-wrap` من غير بادئة مقاس = السطور بترجع تتلفّ على الموبايل.
    expect(row).not.toMatch(/(?<![a-z:-])flex-wrap/);
    expect(row).toContain('md:flex-wrap');
  });

  it('وفيه تلاشي على الطرفين عشان الزائر يعرف إن فيه كمان', () => {
    expect(row).toContain('mask-image:linear-gradient');
  });

  /**
   * ⚠️ **الكلاس لازم يكون نص كامل.** Tailwind بيقرا الملفات كنصوص؛
   *    لو الكلاس اتجمّع من قطع، مش هيلاقيه ومش هيطلّعه في الـCSS —
   *    والتلاشي يختفي في النسخة المنشورة بس.
   */
  it('الكلاس مكتوب كامل عشان Tailwind يلاقيه', () => {
    expect(row).toContain(
      '[mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]',
    );
  });

  it('الشاشات الأربعة بتستعمل نفس المصدر، مش نسخة لكل واحدة', () => {
    const users = [
      'components/SectionTabs.tsx',
      'components/SectionSubNav.tsx',
      'components/layout/NavLinks.tsx',
      'app/(client)/support/SupportClient.tsx',
    ];
    for (const file of users) {
      const src = codeOnly(read(file));
      expect(src, `${file} مابيستوردش SCROLL_ROW`).toContain('SCROLL_ROW');
      // ولا بيكتب القناع لنفسه تاني.
      expect(src, `${file} فيه نسخة من القناع`).not.toContain('mask-image:linear-gradient');
    }
  });
});

describe('مساحات اللمس على الموبايل', () => {
  /**
   * الحد ٤٤ بكسل — اللي الموقع كله ماشي عليه. الروابط اللي جوّه سطر
   * كتابة مستثناة (دي كتابة، مش زرار)؛ اللي هنا كلها دعوات أساسية.
   */
  const CONTROLS: { file: string; near: string }[] = [
    { file: 'components/SectionTabs.tsx', near: 'rounded-full border' },
    { file: 'components/creative-writing/PackageCard.tsx', near: 'justify-center gap-1' },
    { file: 'app/(client)/blog/page.tsx', near: 'rounded-lg px-2 font-bold' },
  ];

  for (const { file, near } of CONTROLS) {
    it(`${file} — الزرار مش أقل من ٤٤ بكسل`, () => {
      const src = codeOnly(read(file));
      const line = src.split('\n').find((l) => l.includes(near));
      expect(line, `مالقيتش السطر اللي فيه «${near}» — الكلاسات اتغيّرت؟`).toBeDefined();
      expect(line).toContain('min-h-[44px]');
    });
  }
});
