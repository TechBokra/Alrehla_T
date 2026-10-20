import { describe, it, expect } from 'vitest';
import { briefMessage, cleanServiceDetails, deliveryLabel } from './service-details';

const img = 'https://res.cloudinary.com/x/image/upload/a.jpg';

describe('تفاصيل الخدمة (ملف 09)', () => {
  it('الفاضي كله = null — الخدمة القديمة بتفضل زي ما هي', () => {
    expect(cleanServiceDetails({})).toEqual({
      ok: true,
      row: {
        cover_image_url: null,
        gallery_image_urls: null,
        long_description: null,
        deliverables: null,
        requirements: null,
        delivery_days: null,
      },
    });
  });

  it('النقط سطر لكل واحدة، والفاضي والمكرّر بيتشالوا', () => {
    const r = cleanServiceDetails({ deliverablesText: ' نسخة مراجَعة \n\nنسخة مراجَعة\nملاحظات مكتوبة' });
    expect(r.ok && r.row.deliverables).toEqual(['نسخة مراجَعة', 'ملاحظات مكتوبة']);
  });

  it('الصور من Cloudinary بتاعنا بس', () => {
    expect(cleanServiceDetails({ coverImageUrl: 'https://evil.com/a.jpg' }).ok).toBe(false);
    expect(cleanServiceDetails({ galleryImageUrls: [img, 'http://x.com/b.png'] }).ok).toBe(false);
    const r = cleanServiceDetails({ coverImageUrl: img, galleryImageUrls: [img, img] });
    expect(r.ok && r.row.gallery_image_urls).toEqual([img]);
  });

  it('مدة التسليم: فاضي أو صفر = مش محددة، وغير كده من 1 لـ 90', () => {
    expect(cleanServiceDetails({ deliveryDays: 0 }).ok).toBe(true);
    expect(cleanServiceDetails({ deliveryDays: 7 })).toMatchObject({ ok: true, row: { delivery_days: 7 } });
    expect(cleanServiceDetails({ deliveryDays: 91 }).ok).toBe(false);
    expect(cleanServiceDetails({ deliveryDays: 2.5 }).ok).toBe(false);
  });

  it('الحدود برسالة عربي', () => {
    expect(cleanServiceDetails({ longDescription: 'x'.repeat(5001) })).toMatchObject({ ok: false });
    expect(cleanServiceDetails({ deliverablesText: Array.from({ length: 9 }, (_, i) => `${i}`).join('\n') })).toMatchObject({ ok: false });
  });
});

describe('كلام العرض', () => {
  it('مدة التسليم', () => {
    expect(deliveryLabel(undefined)).toBeNull();
    expect(deliveryLabel(1)).toBe('التسليم خلال يوم واحد');
    expect(deliveryLabel(2)).toBe('التسليم خلال يومين');
    expect(deliveryLabel(7)).toBe('التسليم خلال ٧ أيام');
    expect(deliveryLabel(14)).toBe('التسليم خلال ١٤ يوم');
  });

  it('تفاصيل الطلب: الفاضي مابيبعتش رسالة', () => {
    expect(briefMessage('   ')).toBeNull();
    expect(briefMessage(' عايز مراجعة قصة ')).toBe('📝 تفاصيل الطلب من العميل:\nعايز مراجعة قصة');
  });
});
