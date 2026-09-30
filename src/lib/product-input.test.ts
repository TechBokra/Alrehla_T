import { describe, it, expect } from 'vitest';
import { validateProductInput, slugFromName, onlySentFields } from './product-input';

const base = { name: 'قصة البحر', shortDescription: 'وصف', price: '500' };

describe('سعر المنتج', () => {
  it('الرقم السليم بيعدّي', () => {
    const r = validateProductInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.price).toBe(500);
  });

  it('⚠️ الخانة الفاضية كانت بتبقى صفر — يعني منتج مجاني', () => {
    // `Number('')` بترجّع صفر لا NaN. فمنتج بيتحفظ بسعر صفر،
    // والعميل يطلبه ويدفع لا شيء.
    const r = validateProductInput({ ...base, price: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('السعر');
  });

  it('⚠️ النص غير الرقمي كان بيبقى NaN — وPostgres بيقبله', () => {
    // `numeric` في Postgres بيقبل NaN فعلًا، والشاشة بتعرض
    // «NaN ج.م» للعميل.
    const r = validateProductInput({ ...base, price: 'خمسمية' });
    expect(r.ok).toBe(false);
  });

  it('⚠️ السالب كان بيتحفظ زي ما هو', () => {
    expect(validateProductInput({ ...base, price: '-500' }).ok).toBe(false);
  });

  it('والصفر كمان', () => {
    expect(validateProductInput({ ...base, price: '0' }).ok).toBe(false);
  });

  it('ورقم أكبر من المتوقّع بيترفض — حارس على الصفر الزيادة', () => {
    expect(validateProductInput({ ...base, price: '99000000' }).ok).toBe(false);
  });

  it('السعر الإلكتروني اختياري، وبيتحقَّق لو اتكتب', () => {
    expect(validateProductInput({ ...base, electronicPrice: '' }).ok).toBe(true);
    expect(validateProductInput({ ...base, electronicPrice: '250' }).ok).toBe(true);
    expect(validateProductInput({ ...base, electronicPrice: '-1' }).ok).toBe(false);
  });
});

describe('اسم المنتج', () => {
  it('الفاضي بيترفض', () => {
    const r = validateProductInput({ ...base, name: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('اسم المنتج');
  });

  it('والمسافات بتتشال من الطرفين', () => {
    const r = validateProductInput({ ...base, name: '  قصة البحر  ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.name).toBe('قصة البحر');
  });
});

describe('رابط المنتج من اسمه', () => {
  it('⚠️ العربي بيتساب عربيًّا', () => {
    // المتصفح بيعرض الرابط العربي مقروءًا وبيشفّره لما يتنسخ.
    // تحويله لحروف لاتينية بيدّي نصًّا مالوش معنى للعميل ولا
    // لمحرّك البحث.
    expect(slugFromName('اعماق البحار')).toBe('اعماق-البحار');
  });

  it('والإنجليزي بيتحوّل لحروف صغيرة', () => {
    expect(slugFromName('Deep Sea Adventures')).toBe('deep-sea-adventures');
  });

  it('علامات الترقيم بتتشال والشرط المتكررة بتتجمع', () => {
    expect(slugFromName('قصة: البحر!! — الجزء الأول')).toBe(
      'قصة-البحر-الجزء-الأول',
    );
  });

  it('⚠️ الاسم اللي كله رموز بيرجع للشكل القديم لا لرابط فاضي', () => {
    expect(slugFromName('!!!', 123)).toBe('prod-123');
    expect(slugFromName('   ', 123)).toBe('prod-123');
  });

  it('والرابط الطويل بيتقصّ', () => {
    expect(slugFromName('ا'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe('🔴 الخانة اللي ما وصلتش ماتمسحش القديم', () => {
  // نموذج الناشر ماكانش فيه المعرض ولا الوصف الكامل، والحفظ كان
  // بيكتبهم `null` — فتصحيح حرف واحد منه كان بيمسح صور الإدارة.
  const fields = {
    galleryImageUrls: { gallery_image_urls: null },
    longDescription: { long_description: null },
    minAge: { min_age: 6, max_age: 9 },
  };

  it('نموذج مافيهوش الخانات = مفيش أعمدة تتكتب', () => {
    const form = new FormData();
    form.append('name', 'كتاب');
    expect(onlySentFields(form, fields)).toEqual({});
  });

  it('⚠️ الخانة موجودة وفاضية = مسح مقصود، بيتكتب `null`', () => {
    const form = new FormData();
    form.append('galleryImageUrls', '');
    expect(onlySentFields(form, fields)).toEqual({ gallery_image_urls: null });
  });

  it('خانتا السنّ بيتكتبوا مع بعض', () => {
    const form = new FormData();
    form.append('minAge', '6');
    expect(onlySentFields(form, fields)).toEqual({ min_age: 6, max_age: 9 });
  });
});
