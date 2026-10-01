import { describe, it, expect } from 'vitest';
import { describeCustomization, hasCustomization } from './order-customization';

describe('describeCustomization', () => {
  it('«أنت البطل هنا»: كل الخانات بعناوين عربي + الهدف بالنص الكامل', () => {
    const v = describeCustomization({
      recipientType: 'child',
      childId: 'c1',
      childName: 'ليلى',
      heroDescription: 'شعرها كيرلي',
      storyGoal: 'ثقة',
      familyMemberNames: 'ماما سارة',
      dedicationText: 'لأجمل بطلة',
      childPhoto: { publicId: 'alrehla/private/children/abc', format: 'jpg' },
      selectedAddonIds: ['a1'],
      customizedAddonIds: ['a1'],
      addons: [{ id: 'a1', name: 'ميدالية', price: 120, customized: true }],
    });
    expect(v.fields).toEqual([
      { label: 'اسم الطفل', value: 'ليلى' },
      { label: 'وصف البطل', value: 'شعرها كيرلي' },
      { label: 'الهدف التربوي', value: 'بناء الثقة بالنفس' },
      { label: 'أسماء أفراد العائلة', value: 'ماما سارة' },
      { label: 'الإهداء', value: 'لأجمل بطلة' },
    ]);
    expect(v.photos).toEqual([
      { label: 'صورة الطفل', kind: 'private', publicId: 'alrehla/private/children/abc', format: 'jpg' },
    ]);
    expect(v.addons).toEqual([{ name: 'ميدالية', price: 120, customized: true }]);
  });

  it('هدف كتبه العميل بنفسه بيظهر زي ما هو', () => {
    expect(describeCustomization({ storyGoal: 'يحب أخته' }).fields).toEqual([
      { label: 'الهدف التربوي', value: 'يحب أخته' },
    ]);
  });

  it('طلب قديم: الرابط العام بيظهر — بس من Cloudinary وبس', () => {
    const v = describeCustomization({
      coverPhotoUrl: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg',
      childPhotoUrl: 'javascript:alert(1)',
    });
    expect(v.photos).toEqual([
      { label: 'صورة الغلاف', kind: 'public', url: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg' },
    ]);
  });

  it('رقم صورة برّه المجلّد الخاص بيترفض — مانولّدش رابط موقَّع لأي صورة', () => {
    const v = describeCustomization({
      childPhoto: { publicId: 'alrehla/products/x', format: 'jpg' },
      coverPhoto: { publicId: 'alrehla/private/covers/y', format: 'jpg?x=1' },
    });
    expect(v.photos).toEqual([]);
  });

  it('خانة نصية مش معروفة بتظهر بدل ما تختفي، والأرقام الداخلية لأ', () => {
    const v = describeCustomization({ childId: 'c1', favoriteColor: 'أزرق', recipientType: 'self' });
    expect(v.fields).toEqual([
      { label: 'لمين', value: 'للعميل نفسه' },
      { label: 'بيانات أخرى (favoriteColor)', value: 'أزرق' },
    ]);
  });

  it('بيانات فاضية أو تالفة = مفيش تفاصيل، من غير خطأ', () => {
    for (const raw of [null, undefined, 'x', [], {}, { addons: 'x' }, { addons: [null, { price: 3 }] }]) {
      expect(hasCustomization(describeCustomization(raw))).toBe(false);
    }
  });
});
