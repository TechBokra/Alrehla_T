import { describe, it, expect } from 'vitest';
import {
  customizationPath,
  isProductCategory,
  productCategoryLabel,
  ASSIGNABLE_PRODUCT_CATEGORIES,
  PUBLISHER_PRODUCT_CATEGORIES,
} from './product-categories';

/**
 * ⚠️ **الاختبارات دي بتحرس قرار تقسيم، مش دالة صغيرة.**
 *
 * القرار: **التصنيف يقرّر المسار، والمالك يقرّر الفلوس.**
 *
 * وقبله كان الاتنين بيتنافسوا، والنتيجة إن منتج واحد ليه طريقان
 * مختلفان حسب الزرار اللي العميل داس عليه (اتنين من خمس منتجات في
 * القاعدة كانوا كده فعلًا — ملف 98).
 */
describe('مسار التخصيص', () => {
  it('«مخصص» بيروح لمعالج القصة الكاملة', () => {
    expect(customizationPath('custom', 'my-story')).toEqual({
      href: '/enha-lak/custom/my-story',
      label: 'ابدأ التخصيص',
    });
  });

  it('«مكتبة» بيروح لتخصيص الغلاف — مهما كان المالك', () => {
    // ⚠️ دي الحالة اللي كانت مكسورة: منتج مكتبة **للمنصة** كان
    //    بيروح لمعالج القصة الكاملة لأن الصفحة بتسأل المالك الأول.
    expect(customizationPath('library', 'deep-sea')).toEqual({
      href: '/enha-lak/custom-library/deep-sea',
      label: 'تخصيص الغلاف وإضافة للسلة',
    });
  });

  it('«اشتراك» ملوش معالج منتج', () => {
    expect(customizationPath('subscription', 'x')).toBeNull();
  });

  it('التصنيف الغايب أو الغريب ملوش مسار', () => {
    expect(customizationPath(null, 'x')).toBeNull();
    expect(customizationPath('book', 'x')).toBeNull();
  });
});

describe('التصنيفات الصالحة', () => {
  it('القاعدة بتقبل تلاتة وبس', () => {
    expect(isProductCategory('library')).toBe(true);
    expect(isProductCategory('custom')).toBe(true);
    expect(isProductCategory('subscription')).toBe(true);
  });

  it('اللي كانت النماذج بتعرضه وترفضه القاعدة', () => {
    // ⚠️ التلاتة دول كانوا في قوايم الإضافة، والحفظ بيترفض.
    expect(isProductCategory('book')).toBe(false);
    expect(isProductCategory('game')).toBe(false);
    expect(isProductCategory('accessory')).toBe(false);
  });

  it('مفيش قيمة غريبة بتعدّي', () => {
    expect(isProductCategory('')).toBe(false);
    expect(isProductCategory(null)).toBe(false);
    expect(isProductCategory(undefined)).toBe(false);
    expect(isProductCategory(1)).toBe(false);
  });
});

describe('قوايم النماذج', () => {
  it('«اشتراك» مش معروض للإدارة — مفيش شاشة بتعرضه', () => {
    expect(ASSIGNABLE_PRODUCT_CATEGORIES).not.toContain('subscription');
    expect(ASSIGNABLE_PRODUCT_CATEGORIES).toEqual(['library', 'custom']);
  });

  it('الناشر في المكتبة وبس — «مخصص» بيقفل عليه طريقًا مسدودًا', () => {
    expect(PUBLISHER_PRODUCT_CATEGORIES).toEqual(['library']);
    expect(PUBLISHER_PRODUCT_CATEGORIES).not.toContain('custom');
  });

  it('كل قيمة معروضة لازم تكون صالحة في القاعدة', () => {
    // الحارس ده بيمسك لو حد ضاف قيمة للقايمة من غير ما يضيفها للنوع.
    for (const c of [...ASSIGNABLE_PRODUCT_CATEGORIES, ...PUBLISHER_PRODUCT_CATEGORIES]) {
      expect(isProductCategory(c)).toBe(true);
    }
  });
});

describe('تسمية التصنيف', () => {
  it('بترجّع الاسم العربي', () => {
    expect(productCategoryLabel('library')).toBe('مكتبة');
    expect(productCategoryLabel('custom')).toBe('مخصص');
  });

  it('التصنيف الغريب بيبان زي ما هو — مش بيتسمّى «اشتراك»', () => {
    // ⚠️ شاشة الإدارة كانت بتكتب «اشتراك» على **أي حاجة** مش
    //    library ولا custom — يعني قيمة غريبة كانت بتتخفي وراء
    //    اسم غلط بدل ما تبان.
    expect(productCategoryLabel('book')).toBe('book');
    expect(productCategoryLabel(null)).toBe('غير محدَّد');
  });
});
