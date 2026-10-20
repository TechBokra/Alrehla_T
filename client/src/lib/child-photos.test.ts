import { describe, expect, it } from 'vitest';
import {
  CHILD_PHOTO_PREFIXES,
  DEFAULT_CHILD_PHOTO_RETENTION_DAYS,
  finishedAt,
  itemEligibility,
  normalizeChildPhotoDays,
  planChildPhotoSweep,
  type OrderPhotoRow,
} from './child-photos';

const now = new Date('2026-10-18T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

const row = (over: Partial<OrderPhotoRow> = {}): OrderPhotoRow => ({
  itemId: 'i1',
  orderId: 'o1',
  status: 'delivered',
  createdAt: daysAgo(40),
  updatedAt: daysAgo(30),
  deliveredAt: daysAgo(30),
  electronicSentAt: null,
  photos: { childPhoto: `${CHILD_PHOTO_PREFIXES[0]}aaa` },
  ...over,
});

describe('المدة', () => {
  it('القيمة الغريبة بترجع للافتراضي', () => {
    expect(normalizeChildPhotoDays('سبعة')).toBe(DEFAULT_CHILD_PHOTO_RETENTION_DAYS);
    expect(normalizeChildPhotoDays(0)).toBe(DEFAULT_CHILD_PHOTO_RETENTION_DAYS);
    expect(normalizeChildPhotoDays(-5)).toBe(DEFAULT_CHILD_PHOTO_RETENTION_DAYS);
    expect(normalizeChildPhotoDays(1000)).toBe(90);
    expect(normalizeChildPhotoDays('14')).toBe(14);
  });
});

describe('إيه اللي خلصت مدته', () => {
  it('طلب اتسلّم ومرّت المدة = مؤهّل', () => {
    expect(itemEligibility(row(), now, 7)).toBe('finished');
  });

  it('طلب اتسلّم إمبارح = مش مؤهّل', () => {
    expect(itemEligibility(row({ deliveredAt: daysAgo(1), updatedAt: daysAgo(1) }), now, 7)).toBeNull();
  });

  /**
   * ⚠️ أهم اختبار: الطلب اللي الاستوديو بيرسمه **مابيتلمسش** مهما
   *    طال. مسح صورته معناه إن الفريق يقف ويطلبها من ولي الأمر تاني.
   */
  it('الطلب الشغّال مابيتلمسش مهما قدم', () => {
    for (const status of ['paid', 'preparing', 'shipped']) {
      const r = row({ status, deliveredAt: null, updatedAt: daysAgo(300), createdAt: daysAgo(300) });
      expect(itemEligibility(r, now, 7), status).toBeNull();
    }
  });

  it('الطلب المتروك بلا دفع بيخلص بعد ٣٠ يوم', () => {
    const abandoned = row({ status: 'pending', createdAt: daysAgo(31), deliveredAt: null, updatedAt: daysAgo(31) });
    expect(itemEligibility(abandoned, now, 7)).toBe('abandoned');
    const fresh = row({ status: 'pending', createdAt: daysAgo(5), deliveredAt: null, updatedAt: daysAgo(5) });
    expect(itemEligibility(fresh, now, 7)).toBeNull();
  });

  it('التاريخ الناقص أو البايظ = مش مؤهّل', () => {
    expect(
      itemEligibility(row({ deliveredAt: null, updatedAt: null, electronicSentAt: null }), now, 7),
    ).toBeNull();
    expect(itemEligibility(row({ deliveredAt: 'يوم الحد', updatedAt: null }), now, 7)).toBeNull();
  });

  it('تاريخ النهاية بياخد الأحدث', () => {
    const r = row({ deliveredAt: daysAgo(30), electronicSentAt: daysAgo(10), updatedAt: daysAgo(40) });
    expect(finishedAt(r)).toBe(new Date(daysAgo(10)).getTime());
  });
});

describe('الصورة المشتركة بين طلبين', () => {
  const shared = `${CHILD_PHOTO_PREFIXES[0]}children/shared`;

  /**
   * ⚠️ **ده الفخ الحقيقي.** بالقياس على القاعدة: ٢٢ عنصر طلب و١٣
   *    صورة — يعني ولي أمر بيعيد الطلب بنفس الصورة. مسحها بناءً على
   *    الطلب اللي خلص بيكسر الطلب اللي لسه شغّال.
   */
  it('مابتتمسحش لو طلب تاني لسه شغّال', () => {
    const plan = planChildPhotoSweep(
      [
        row({ itemId: 'old', status: 'delivered', photos: { childPhoto: shared } }),
        row({
          itemId: 'live',
          status: 'paid',
          deliveredAt: null,
          updatedAt: daysAgo(1),
          photos: { childPhoto: shared },
        }),
      ],
      now,
      7,
    );
    expect(plan.publicIds).toEqual([]);
    expect(plan.heldBack).toEqual([shared]);
    // وماينفعش نفضّي خانة العنصر القديم والصورة لسه موجودة.
    expect(plan.items).toEqual([]);
  });

  it('بتتمسح لما الطلبين الاتنين يخلصوا', () => {
    const plan = planChildPhotoSweep(
      [
        row({ itemId: 'a', photos: { childPhoto: shared } }),
        row({ itemId: 'b', photos: { childPhoto: shared } }),
      ],
      now,
      7,
    );
    expect(plan.publicIds).toEqual([shared]);
    expect(plan.items.map((i) => i.itemId).sort()).toEqual(['a', 'b']);
    expect(plan.heldBack).toEqual([]);
  });
});

describe('الخطة', () => {
  it('بتشيل أي رقم برّه المجلّدات المسموحة', () => {
    const plan = planChildPhotoSweep(
      [row({ photos: { childPhoto: 'alrehla/site/logo', secondPhoto: 'x/y/z' } })],
      now,
      7,
    );
    expect(plan.publicIds).toEqual([]);
  });

  /**
   * ⚠️ **إيصال الدفع سجل مالي.** لو رقم إيصال وصل لخانة صورة
   *    بالغلط، المهمة دي كانت هتمسحه بعد أسبوع — والمحاسبة
   *    والمنازعات بتتبنى عليه. الشرط على المجلّد الكامل عشان كده.
   */
  it('إيصالات الدفع ممنوعة تمامًا', () => {
    const plan = planChildPhotoSweep(
      [row({ photos: { childPhoto: 'alrehla/private/receipts/r1' } })],
      now,
      7,
    );
    expect(plan.publicIds).toEqual([]);
    expect(plan.items).toEqual([]);
  });

  it('وبتقبل مجلّدي الأطفال والأغلفة', () => {
    const plan = planChildPhotoSweep(
      [
        row({ itemId: 'a', photos: { childPhoto: 'alrehla/private/children/x' } }),
        row({ itemId: 'b', photos: { coverPhoto: 'alrehla/private/covers/y' } }),
      ],
      now,
      7,
    );
    expect(plan.publicIds.sort()).toEqual([
      'alrehla/private/children/x',
      'alrehla/private/covers/y',
    ]);
  });

  it('بتجمع أكتر من خانة في نفس العنصر', () => {
    const plan = planChildPhotoSweep(
      [
        row({
          photos: {
            childPhoto: `${CHILD_PHOTO_PREFIXES[0]}a`,
            secondPhoto: `${CHILD_PHOTO_PREFIXES[0]}b`,
            coverPhoto: `${CHILD_PHOTO_PREFIXES[0]}c`,
          },
        }),
      ],
      now,
      7,
    );
    expect(plan.publicIds.sort()).toEqual([
      `${CHILD_PHOTO_PREFIXES[0]}a`,
      `${CHILD_PHOTO_PREFIXES[0]}b`,
      `${CHILD_PHOTO_PREFIXES[0]}c`,
    ]);
    expect(plan.items[0].fields.sort()).toEqual(['childPhoto', 'coverPhoto', 'secondPhoto']);
  });

  it('بتحترم الحد الأقصى للتشغيلة', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row({ itemId: `i${i}`, photos: { childPhoto: `${CHILD_PHOTO_PREFIXES[0]}p${i}` } }),
    );
    expect(planChildPhotoSweep(rows, now, 7, { max: 4 }).publicIds).toHaveLength(4);
  });

  it('مفيش صور = خطة فاضية', () => {
    expect(planChildPhotoSweep([row({ photos: {} })], now, 7)).toEqual({
      publicIds: [],
      items: [],
      heldBack: [],
    });
  });
});
