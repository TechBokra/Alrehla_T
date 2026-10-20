import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AD_PAGES, AD_POSITIONS, placementKey } from './ads';

/**
 * كل صفحة في قايمة الخانات **موصّلة فعلًا**.
 *
 * ── ليه الحارس ده ───────────────────────────────────────────
 *
 * قايمة الخانات (`AD_PAGES`) هي اللي اللوحة بتبني منها مربّعات
 * الاختيار. فلو صفحة موجودة في القايمة ومكوّن `AdSlot` مش مزروع
 * فيها، الإدارة بتختار المكان، وبتحفظ، وبتشوف الإعلان «ظاهر الآن»
 * في اللوحة — **وهو مش ظاهر في أي حتة**. والمعلن ممكن يكون دافع.
 *
 * الغلطة دي مابتطلّعش أي خطأ: مفيش استثناء ولا تحذير، بس إعلان
 * مدفوع مش بيتعرض. فالحارس هنا بدل الاكتشاف بالصدفة.
 */

/** صفحة الخانة ← ملفها. أي صفحة جديدة لازم تدخل هنا وفي `AD_PAGES`. */
const PAGE_FILES: Record<string, string> = {
  home: 'src/app/(client)/page.tsx',
  'enha-lak': 'src/app/(client)/enha-lak/page.tsx',
  library: 'src/app/(client)/enha-lak/library/page.tsx',
  'creative-writing': 'src/app/(client)/creative-writing/page.tsx',
  packages: 'src/app/(client)/creative-writing/packages/page.tsx',
  services: 'src/app/(client)/creative-writing/services/page.tsx',
  aqlam: 'src/app/(aqlam)/aqlam/page.tsx',
  blog: 'src/app/(client)/blog/page.tsx',
  about: 'src/app/(client)/about/page.tsx',
  support: 'src/app/(client)/support/page.tsx',
};

describe('خانات الإعلانات موصّلة بالصفحات', () => {
  it('كل صفحة في القايمة ليها ملف معروف', () => {
    const missing = AD_PAGES.filter((p) => !PAGE_FILES[p.id]).map((p) => p.id);
    expect(missing, 'صفحة في AD_PAGES من غير ملف في PAGE_FILES').toEqual([]);
  });

  it('مفيش ملف في الخريطة مش في القايمة', () => {
    const ids = new Set(AD_PAGES.map((p) => p.id));
    expect(Object.keys(PAGE_FILES).filter((id) => !ids.has(id))).toEqual([]);
  });

  for (const page of AD_PAGES) {
    it(`${page.label} — الخانتين مزروعتين في الصفحة`, () => {
      const file = PAGE_FILES[page.id];
      const path = join(process.cwd(), file);
      expect(existsSync(path), `${file} مش موجود`).toBe(true);

      const src = readFileSync(path, 'utf8');
      expect(src, `${file} مابيستوردش AdSlot`).toContain('AdSlot');

      for (const position of AD_POSITIONS) {
        // ⚠️ بندوّر على `page="x"` و`position="y"` في نفس السطر —
        //    عشان `page="home"` في صفحة المدونة مايعدّيش.
        const pattern = new RegExp(
          `<AdSlot\\s+page="${page.id}"\\s+position="${position}"`,
        );
        expect(
          src,
          `${file} مفيهاش خانة «${placementKey(page.id, position)}»`,
        ).toMatch(pattern);
      }
    });
  }
});
