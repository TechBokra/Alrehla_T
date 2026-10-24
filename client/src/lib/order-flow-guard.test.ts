import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * مسار الطلب في «إنها لك» — قرارات تامر (٢٤ أكتوبر).
 * الاختبارات دي بتقرا الكود عشان التعديلات الجاية ماترجّعش السلوك القديم.
 */
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('مسار الطلب', () => {
  it('المعالجين الاتنين بيروحوا للدفع على طول، مش للسلة', () => {
    expect(read('../components/enha-lak/PersonalizationWizard.tsx')).toContain("CHECKOUT_PATH = '/enha-lak/checkout'");
    const lib = read('../components/enha-lak/LibraryCustomizationWizard.tsx');
    expect(lib).toContain("router.push('/enha-lak/checkout')");
    expect(lib).not.toContain("router.push('/cart')");
  });

  it('زرار آخر خطوة بيقول «متابعة للدفع»', () => {
    for (const rel of [
      '../components/enha-lak/wizard-steps/Step4Review.tsx',
      '../components/enha-lak/wizard-steps/Step3LibraryReview.tsx',
    ]) {
      const src = read(rel);
      expect(src, rel).toContain('متابعة للدفع');
      expect(src, rel).not.toContain('إضافة للسلة');
    }
  });

  it('النسخة بتتختار في خطوة ٣ قبل الإضافات، مش في المراجعة', () => {
    expect(read('../components/enha-lak/wizard-steps/Step3Addons.tsx')).toMatch(/<FormatChooser/);
    expect(read('../components/enha-lak/wizard-steps/Step4Review.tsx')).not.toMatch(/<FormatChooser/);
  });

  it('«هنوصّل فين؟» في المعالجين، والدفع بيبدأ بالمنطقة المحفوظة', () => {
    expect(read('../components/enha-lak/wizard-steps/Step3Addons.tsx')).toMatch(/<DeliveryRegionPicker/);
    expect(read('../app/(client)/enha-lak/custom/[productSlug]/page.tsx')).toMatch(/delivery=\{delivery\}/);
    expect(read('../app/(client)/enha-lak/custom-library/[productSlug]/page.tsx')).toMatch(/delivery=\{delivery\}/);
    expect(read('../app/(client)/enha-lak/checkout/CheckoutClient.tsx')).toMatch(/loadDeliveryRegion\(\)/);
  });

  it('الدفع بيمسك سلة قديمة فيها مطبوع مع إلكتروني قبل القاعدة', () => {
    const src = read('../app/(client)/enha-lak/checkout/CheckoutClient.tsx');
    expect(src).toMatch(/addonConflicts\.length === 0/);
  });

  it('والقاعدة بترفضه في الآخر', () => {
    const sql = read('../../supabase/migrations/20261024140000_electronic_order_addons.sql');
    expect(sql).toMatch(/before insert on public\.order_items/);
    expect(sql).toMatch(/= 'electronic' and v_fmt = 'printed'/);
  });

  it('الإضافات بتتفلتر بالمنتج في صفحتي الطلب، والقاعدة بترفض الغلط', () => {
    for (const rel of [
      '../app/(client)/enha-lak/custom/[productSlug]/page.tsx',
      '../app/(client)/enha-lak/custom-library/[productSlug]/page.tsx',
    ]) {
      expect(read(rel), rel).toMatch(/isVisibleFor\(a\.appliesTo, \{ productId: product\.id \}\)/);
    }
    const sql = read('../../supabase/migrations/20261024160000_addon_applies_to.sql');
    expect(sql).toMatch(/not \(new\.product_id::text = any \(v_applies\)\)/);
  });

  it('طلب اتسجّل ومااتدفعش: بيتحفظ، وبيتعرض للاستكمال، والسلة بتتفضّى بعد الدفع', () => {
    const checkout = read('../app/(client)/enha-lak/checkout/CheckoutClient.tsx');
    expect(checkout).toMatch(/savePendingOrder\(/);
    expect(checkout).toMatch(/getResumableOrder\(pending\.orderId\)/);
    expect(checkout).toContain('اعمل طلب جديد');
    const confirmation = read('../app/(client)/enha-lak/order-confirmation/page.tsx');
    expect(confirmation).toMatch(/<ClearPaidCart orderId=\{order\.id\} \/>/);
  });
});
