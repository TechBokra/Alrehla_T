import { describe, it, expect } from 'vitest';
import { absoluteUrl, trimDescription } from './seo';
import { productSchema, instructorSchema, articleSchema, breadcrumbSchema } from './structured-data';

describe('absoluteUrl', () => {
  it('لا يكرر الشرطة المائلة', () => {
    expect(absoluteUrl('/about')).not.toContain('//about');
    expect(absoluteUrl('/')).toMatch(/\/$/);
  });

  it('يضيف الشرطة لو المسار جه من غيرها', () => {
    expect(absoluteUrl('about')).toBe(absoluteUrl('/about'));
  });
});

describe('trimDescription', () => {
  it('يسيب الوصف القصير زي ما هو', () => {
    expect(trimDescription('وصف قصير')).toBe('وصف قصير');
  });

  it('يقص الطويل من غير ما يعدي الحد', () => {
    const long = 'كلمة '.repeat(80);
    const out = trimDescription(long, 160);
    expect(out.length).toBeLessThanOrEqual(161);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('productSchema', () => {
  it('يكتب السعر لما يكون موجود', () => {
    const schema = productSchema({ name: 'قصة', path: '/p/1', price: 250 }) as any;
    expect(schema.offers.price).toBe('250');
    expect(schema.offers.priceCurrency).toBe('EGP');
  });

  // عرض سعر مش موجود لجوجل = بيانات كاذبة، وبيتعاقب عليها.
  it('ما يكتبش عرضًا لما مفيش سعر', () => {
    const schema = productSchema({ name: 'قصة', path: '/p/1' }) as any;
    expect(schema.offers).toBeUndefined();
  });
});

describe('instructorSchema', () => {
  it('يكتب التقييم لما يكون فيه تقييمات حقيقية', () => {
    const schema = instructorSchema({ name: 'سارة', path: '/i/1', rating: 4.5, ratingCount: 8 }) as any;
    expect(schema.aggregateRating.ratingValue).toBe('4.5');
    expect(schema.aggregateRating.reviewCount).toBe(8);
  });

  it('ما يكتبش نجوم من غير تقييمات', () => {
    expect((instructorSchema({ name: 'سارة', path: '/i/1', rating: null, ratingCount: 0 }) as any).aggregateRating)
      .toBeUndefined();
    expect((instructorSchema({ name: 'سارة', path: '/i/1', rating: 5, ratingCount: 0 }) as any).aggregateRating)
      .toBeUndefined();
  });
});

describe('articleSchema', () => {
  it('ينسب المقال لكاتبه لو مذكور، وللمنصة لو مش مذكور', () => {
    expect((articleSchema({ title: 'ع', path: '/blog/a', author: 'تامر', siteName: 'الرحلة' }) as any).author.name)
      .toBe('تامر');
    expect((articleSchema({ title: 'ع', path: '/blog/a', siteName: 'الرحلة' }) as any).author['@type'])
      .toBe('Organization');
  });
});

describe('breadcrumbSchema', () => {
  it('يرقّم الخطوات بالترتيب', () => {
    const schema = breadcrumbSchema([
      { name: 'الرئيسية', path: '/' },
      { name: 'المدونة', path: '/blog' },
    ]) as any;
    expect(schema.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
  });
});
