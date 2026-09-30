import { describe, it, expect } from 'vitest';
import {
  sortProducts,
  filterProducts,
  resultLabel,
  hasActiveFilter,
  productState,
} from './product-display';
import type { PersonalizedProduct } from '@/types';

function product(over: Partial<PersonalizedProduct> = {}): PersonalizedProduct {
  return {
    id: 'p1',
    slug: 'p1',
    name: 'قصة',
    category: 'library',
    price: 100,
    shortDescription: '',
    ownerType: 'platform',
    isActive: true,
    ...over,
  } as PersonalizedProduct;
}

describe('الترتيب', () => {
  it('⚠️ «الأحدث» بالتاريخ لا بالرقم', () => {
    // كان `id.localeCompare`، ورقم المنتج uuid عشوائي — يعني
    // «الأحدث» كانت ترتيبًا عشوائيًّا ثابتًا، ومفيش تاريخ معروض
    // يكذّبه فماحدّش لاحظ.
    const older = product({ id: 'zzz', name: 'قديمة', createdAt: '2026-01-01' });
    const newer = product({ id: 'aaa', name: 'جديدة', createdAt: '2026-09-01' });
    expect(sortProducts([older, newer], 'newest').map((p) => p.name)).toEqual([
      'جديدة',
      'قديمة',
    ]);
  });

  it('⚠️ المنتج بلا تاريخ بيروح لآخر القايمة', () => {
    // الفاضي مش «أحدث حاجة».
    const dated = product({ name: 'بتاريخ', createdAt: '2026-01-01' });
    const undated = product({ name: 'بلا تاريخ' });
    expect(sortProducts([undated, dated], 'newest').map((p) => p.name)).toEqual([
      'بتاريخ',
      'بلا تاريخ',
    ]);
  });

  it('السعر من الأقل للأعلى ومن الأعلى للأقل', () => {
    const cheap = product({ name: 'رخيصة', price: 50 });
    const pricey = product({ name: 'غالية', price: 500 });
    expect(sortProducts([pricey, cheap], 'price-asc')[0].name).toBe('رخيصة');
    expect(sortProducts([cheap, pricey], 'price-desc')[0].name).toBe('غالية');
  });

  it('الترتيب مابيغيّرش القايمة الأصلية', () => {
    const list = [product({ name: 'ب', price: 2 }), product({ name: 'أ', price: 1 })];
    sortProducts(list, 'price-asc');
    expect(list.map((p) => p.name)).toEqual(['ب', 'أ']);
  });
});

describe('الفلترة', () => {
  it('⚠️ البحث بيشمل الوصف مش الاسم بس', () => {
    // العميل بيدوّر بكلمة فاكرها من القصة، مش باسمها الكامل.
    const p = product({ name: 'رحلة', shortDescription: 'قصة عن ديناصور صغير' });
    expect(filterProducts([p], { query: 'ديناصور' })).toHaveLength(1);
  });

  it('البحث مابيفرّقش بين كبير وصغير', () => {
    const p = product({ name: 'Deep Sea' });
    expect(filterProducts([p], { query: 'deep' })).toHaveLength(1);
  });

  it('«كل دور النشر» مابتفلترش', () => {
    const a = product({ id: 'a', publisherId: 'pub-1' });
    const b = product({ id: 'b' });
    expect(filterProducts([a, b], { publisherId: 'all' })).toHaveLength(2);
  });

  it('الفلترة بدار نشر بعينها', () => {
    const a = product({ id: 'a', publisherId: 'pub-1' });
    const b = product({ id: 'b', publisherId: 'pub-2' });
    expect(filterProducts([a, b], { publisherId: 'pub-1' }).map((p) => p.id)).toEqual(['a']);
  });

  it('الفلترة بالفئة العمرية — بالتداخل', () => {
    const young = product({ id: 'young', minAge: 6, maxAge: 9 });
    const bridge = product({ id: 'bridge', minAge: 8, maxAge: 11 });
    const teen = product({ id: 'teen', minAge: 13 });
    const none = product({ id: 'none' });
    const all = [young, bridge, teen, none];
    expect(filterProducts(all, { ageBand: '10-12' }).map((p) => p.id)).toEqual(['bridge']);
    expect(filterProducts(all, { ageBand: '6-9' }).map((p) => p.id)).toEqual(['young', 'bridge']);
  });

  it('⚠️ فئة غريبة من الرابط = كل الأعمار، مش رف فاضي', () => {
    // `?age=3-5` أو رابط اتقصّ في واتساب — مايستاهلش «مفيش نتايج».
    const all = [product({ id: 'a', minAge: 6 }), product({ id: 'b' })];
    expect(filterProducts(all, { ageBand: '3-5' })).toHaveLength(2);
    expect(hasActiveFilter({ ageBand: '3-5' })).toBe(false);
  });

  it('الناشر والسن مع بعض', () => {
    const a = product({ id: 'a', publisherId: 'pub-1', minAge: 6, maxAge: 9 });
    const b = product({ id: 'b', publisherId: 'pub-2', minAge: 6, maxAge: 9 });
    const c = product({ id: 'c', publisherId: 'pub-1', minAge: 13 });
    expect(
      filterProducts([a, b, c], { publisherId: 'pub-1', ageBand: '6-9' }).map((p) => p.id),
    ).toEqual(['a']);
  });
});

describe('جملة العدد وحالة الفلتر', () => {
  it('الكل ظاهر', () => {
    expect(resultLabel(4, 4)).toBe('4 كتاب');
    expect(resultLabel(1, 1)).toBe('كتاب واحد');
  });

  it('⚠️ الفلتر قصّ النتايج فالعدد بيقول كده', () => {
    // من غير الجملة دي العميل مايعرفش إنه بيبصّ على جزء.
    expect(resultLabel(2, 9)).toBe('2 من 9');
  });

  it('مفيش منتجات أصلًا = مفيش جملة', () => {
    expect(resultLabel(0, 0)).toBe('');
  });

  it('⚠️ التفرقة بين «مفيش نتايج» و«مفيش منتجات»', () => {
    // نفس الشاشة البيضا بتحتاج رسالتين مختلفتين: «غيّر الفلتر»
    // مالهاش معنى لو الرفّ فاضي أصلًا.
    expect(hasActiveFilter({})).toBe(false);
    expect(hasActiveFilter({ publisherId: 'all' })).toBe(false);
    expect(hasActiveFilter({ query: '   ' })).toBe(false);
    expect(hasActiveFilter({ query: 'بحر' })).toBe(true);
    expect(hasActiveFilter({ publisherId: 'pub-1' })).toBe(true);
    expect(hasActiveFilter({ ageBand: '6-9' })).toBe(true);
    expect(hasActiveFilter({ ageBand: 'all' })).toBe(false);
  });
});

describe('حالة المنتج في اللوحات', () => {
  it('🔴 «معروض» محتاج الاتنين: مفعّل ومعتمد', () => {
    // كان بيتقري من `isActive` وحده — فالمستني كان مكتوب عليه «معروض».
    expect(productState({ isActive: true, reviewStatus: 'pending' })).toBe('pending');
    expect(productState({ isActive: true, reviewStatus: 'approved' })).toBe('live');
  });

  it('الإيقاف بيغلب أي حالة مراجعة', () => {
    expect(productState({ isActive: false, reviewStatus: 'approved' })).toBe('stopped');
    expect(productState({ isActive: false, reviewStatus: 'rejected' })).toBe('stopped');
  });

  it('المرفوض بيتقال مرفوض', () => {
    expect(productState({ isActive: true, reviewStatus: 'rejected' })).toBe('rejected');
  });

  it('⚠️ حالة مش معروفة = مستني، مش معروض', () => {
    expect(productState({ isActive: true, reviewStatus: undefined })).toBe('pending');
  });
});
