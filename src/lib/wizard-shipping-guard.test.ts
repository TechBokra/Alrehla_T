import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { itemNeedsShipping } from './item-format';

/**
 * ── البلاغ ──────────────────────────────────────────────────
 *
 * تامر (١٨ أكتوبر): «الطلب أصلًا كان مقفول على نسخة إلكترونية فقط،
 * وبرضه وقف في الطلب».
 *
 * وهو كان صح. اللي حصل: اختار «نسخة إلكترونية — من غير شحن»
 * ومعاها **بوستر مطبوع** كإضافة. وقاعدة الشحن الحقيقية هي «مطبوع
 * **أو إضافة**» — فالبند كان محتاج شحن والتوصيل مقفول.
 *
 * ⚠️ **والمعالج باعله التناقض**: الكارت بيقول «من غير شحن»،
 *    والسطر الأزرق بيقول «هتدخل بيانات الشحن في الخطوة الجاية»،
 *    والحارس الأخير بيفحص **النوع وبس** فبيعدّيه. البند بينزل
 *    السلة وبيموت في الدفع.
 */

function strip(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const read = (rel: string) => strip(readFileSync(new URL(rel, import.meta.url), 'utf8'));

describe('قاعدة الشحن نفسها', () => {
  it('⚠️ إلكتروني + إضافة = محتاج شحن — وده أصل البلاغ', () => {
    expect(itemNeedsShipping({ format: 'electronic' })).toBe(false);
    expect(itemNeedsShipping({ format: 'electronic', addonIds: ['poster'] })).toBe(true);
  });

  it('«مطبوعة + إلكترونية» محتاجة شحن برضه', () => {
    expect(itemNeedsShipping({ format: 'both' })).toBe(true);
  });
});

describe('المعالج مابيبيعش تناقض', () => {
  const wizard = read('../components/enha-lak/PersonalizationWizard.tsx');

  /**
   * ⚠️ الحارس كان `format !== 'electronic'` — بيفحص نص القاعدة.
   *    لازم يستعمل نفس الدالة اللي الدفع والقاعدة بيحسبوا بيها،
   *    وإلا بيبقى فيه تعريفين للشحن وواحد منهم غلط.
   */
  it('الحارس الأخير بيستعمل itemNeedsShipping مش فحص النوع لوحده', () => {
    expect(wizard).toMatch(/deliveryPaused && itemNeedsShipping\(/);
    expect(wizard).not.toMatch(/deliveryPaused && format !== 'electronic'/);
  });

  it('ورسالة الرفض بتقول إن السبب الإضافات لما يكون هو السبب', () => {
    expect(wizard).toContain('الإضافات اللي اخترتها بتتشحن');
  });

  it('خطوة الإضافات بتعرف إن التوصيل مقفول', () => {
    expect(wizard).toMatch(/<Step3Addons[^>]*deliveryPaused=\{deliveryPaused\}/);
  });
});

describe('خطوة الإضافات وقت إيقاف التوصيل', () => {
  const step3 = read('../components/enha-lak/wizard-steps/Step3Addons.tsx');

  it('⚠️ مفيش إضافة تتختار — كلها بتتشحن', () => {
    expect(step3).toMatch(/if \(deliveryPaused\) return;/);
    expect(step3).toContain('الإضافات مش متاحة دلوقتي');
    expect(step3).toContain('غير متاحة — التوصيل متوقف مؤقتًا');
  });

  /**
   * ⚠️ والاختيار القديم بيتشال: النموذج محفوظ في المتصفح، والعميل
   *    ممكن يكون اختار قبل ما الإدارة توقف التوصيل.
   */
  it('الاختيار المحفوظ من قبل الإيقاف بيتنضّف', () => {
    expect(step3).toMatch(/setValue\('selectedAddonIds', \[\]\)/);
    expect(step3).toMatch(/setValue\('customizedAddonIds', \[\]\)/);
  });
});

describe('الشاشة مابتوعدش بوعد مش هينفَّذ', () => {
  it('⚠️ سطر «هتدخل بيانات الشحن» مابيظهرش والتوصيل مقفول', () => {
    const step4 = read('../components/enha-lak/wizard-steps/Step4Review.tsx');
    expect(step4).toMatch(/needs && deliveryPaused/);
    expect(step4).toContain('مش هينفع يتطلب دلوقتي');
    // الوعد القديم لسه موجود — بس في الفرع اللي بيتنفّذ فعلًا.
    const promise = step4.indexOf('سيتم إدخال بيانات الشحن');
    const guard = step4.indexOf('needs && deliveryPaused');
    expect(guard).toBeLessThan(promise);
  });

  it('⚠️ كارت «من غير شحن» بيقول الحقيقة لما يكون فيه إضافة', () => {
    const chooser = read('../components/enha-lak/wizard-steps/FormatChooser.tsx');
    expect(chooser).toMatch(/addonsForceShipping/);
    expect(chooser).toContain('والإضافات بتتشحن لعنوانك');
  });
});
