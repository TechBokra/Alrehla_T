import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { blockerLabel, hasOrderableRemainder, shippingBlockers } from './shipping-blockers';

const printed = { id: '1', name: 'قصة مطبوعة', format: 'printed' as const, productSlug: 'story' };
const both = { id: '2', name: 'مطبوعة + إلكترونية', format: 'both' as const, productSlug: 'story' };
const electronic = { id: '3', name: 'إلكترونية', format: 'electronic' as const };
const electronicWithAddon = {
  id: '4',
  name: 'إلكترونية + إضافة',
  format: 'electronic' as const,
  addonIds: ['a1'],
};
const box = { id: '5', name: 'صندوق الرحلة', type: 'subscription', boxPlanId: 'p1' };

describe('shippingBlockers', () => {
  it('بيمسك المطبوع والاتنين والصندوق، وبيسيب الإلكتروني', () => {
    const out = shippingBlockers([printed, both, electronic, box]);
    expect(out.map((b) => b.id)).toEqual(['1', '2', '5']);
  });

  it('كل بند بسببه الصح', () => {
    expect(shippingBlockers([printed])[0].reason).toBe('printed');
    expect(shippingBlockers([box])[0].reason).toBe('box');
  });

  /**
   * ⚠️ البند الإلكتروني اللي اتقفل بسبب إضافة لازم يتقاله «الإضافات».
   *    لو قلنا «مطبوعة»، بيدوّر على حاجة مش موجودة في بنده.
   */
  it('الإلكتروني المقفول بإضافة سببه الإضافات مش المطبوع', () => {
    const out = shippingBlockers([electronicWithAddon]);
    expect(out[0].reason).toBe('addons');
    expect(blockerLabel(out[0].reason)).toContain('إضافات');
  });

  it('بيمرّر اسم الرابط لزرار «عدّلها» لما يكون موجود', () => {
    expect(shippingBlockers([printed])[0].slug).toBe('story');
    // السلال القديمة مالهاش `productSlug` — الزرار بيختفي بدل رابط مكسور.
    expect(shippingBlockers([{ id: '9', name: 'قديم', format: 'printed' as const }])[0].slug).toBeUndefined();
  });

  it('كل الأسباب ليها نص عربي', () => {
    for (const r of ['printed', 'addons', 'box'] as const) {
      expect(blockerLabel(r), r).not.toMatch(/[A-Za-z_]{3}/);
      expect(blockerLabel(r).length, r).toBeGreaterThan(8);
    }
  });
});

describe('hasOrderableRemainder', () => {
  /**
   * ⚠️ **ودي بيت القصيد.** الشاشة كانت بتستعمل `cartHasElectronic`،
   *    وهي بترجّع `true` لبند «مطبوعة + إلكترونية» — اللي لسه محتاج
   *    شحن. فالعميل كان بيتقاله «سيب الإلكتروني بس» وهو مالوش بند
   *    إلكتروني في سلّته أصلًا، وزرار الدفع باهت.
   */
  it('«مطبوعة + إلكترونية» لوحدها = مفيش حاجة تتطلب', () => {
    expect(hasOrderableRemainder([both])).toBe(false);
  });

  it('بند إلكتروني حقيقي = فيه حاجة تتطلب', () => {
    expect(hasOrderableRemainder([printed, electronic])).toBe(true);
  });

  it('إلكتروني بإضافة مش بيعدّي', () => {
    expect(hasOrderableRemainder([electronicWithAddon])).toBe(false);
  });

  it('السلة الفاضية = مفيش', () => {
    expect(hasOrderableRemainder([])).toBe(false);
  });
});

describe('شاشة الدفع بتستعمل الفحص الصح', () => {
  const src = readFileSync(
    new URL('../app/(client)/enha-lak/checkout/CheckoutClient.tsx', import.meta.url),
    'utf8',
  )
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('الخروج من الشحن المقفول موجود بزراره', () => {
    expect(src).toMatch(/shippingBlockers\s*\(/);
    expect(src).toContain('احفظها لوقت تاني');
    expect(src).toContain('عدّلها');
    expect(src).toMatch(/saveDeferredItems\(\[item\]\)/);
  });

  /**
   * ⚠️ الحارس الأساسي: `hasElectronic` مايرجعش يقرّر رسالة الشحن
   *    المقفول — ده كان العطل نفسه.
   */
  it('رسالة الشحن المقفول بتعتمد على hasOrderableRemainder مش hasElectronic', () => {
    expect(src).toMatch(/shippingOff\s*\n?\s*\?\s*canOrderRemainder/);
    const offBlock = src.slice(src.indexOf('نعتذر — الشحن غير متاح حاليًا'));
    expect(offBlock.slice(0, 2500)).not.toContain('hasElectronic');
  });
});
