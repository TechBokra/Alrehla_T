import { describe, it, expect } from 'vitest';
import { optimizedImageUrl, slotImageUrl, slotImageUrlAt, blurPlaceholder } from '@/lib/cloudinary';

const CLOUD = 'https://res.cloudinary.com/dwg0hr34g/image/upload/v1/alrehla/site/x.jpg';

/**
 * روابط الصور.
 *
 * المتطلب من صاحب المشروع كان صريحًا: «الصور لما تترفع أيًا كان مقاسها
 * تتظبط على المقاس المطلوب **مش تتقص**». التنفيذ بيعتمد على أمر تحويل
 * بيتبني كنص — وأي غلطة حرف فيه بتعني إما صورة مقصوصة أو رابط مكسور،
 * والاتنين مش هيمسكهم فحص الأنواع ولا البناء.
 */
describe('روابط صور Cloudinary', () => {
  it('لا يلمس رابطًا من خارج Cloudinary', () => {
    const external = 'https://example.com/a.png';
    expect(optimizedImageUrl(external)).toBe(external);
    expect(slotImageUrl(external, 'homeHero')).toBe(external);
  });

  it('يرجع نصًا فارغًا بدل «undefined» في الرابط لو الصورة غير مرفوعة', () => {
    expect(optimizedImageUrl(undefined)).toBe('');
    expect(optimizedImageUrl(null)).toBe('');
    expect(slotImageUrl('', 'logo')).toBe('');
  });

  it('لا يركّب تحويلًا فوق رابط يحمل تحويلًا بالفعل', () => {
    const already =
      'https://res.cloudinary.com/dwg0hr34g/image/upload/f_auto,q_auto/v1/a.jpg';
    expect(optimizedImageUrl(already)).toBe(already);
    expect(slotImageUrl(already, 'homeHero')).toBe(already);
  });

  it('خانات الصور تستخدم قصًّا ذكيًا يملا المكان من غير أشرطة لونية', () => {
    // كان c_pad + b_auto: الصورة كاملة والفراغ يتملّي بلون من أطرافها.
    // الشريط اللوني ده كان بيبان كأنه فلتر، فاتغيّر لقص ذكي (g_auto).
    const url = slotImageUrl(CLOUD, 'homeReading');
    expect(url).toContain('c_fill');
    expect(url).toContain('g_auto');
    expect(url).not.toContain('b_auto');
  });

  it('لا ينزل بجودة الصور: q_auto:good مش q_auto المطلقة', () => {
    expect(slotImageUrl(CLOUD, 'homeReading')).toContain('q_auto:good');
    expect(optimizedImageUrl(CLOUD)).toContain('q_auto:good');
  });

  it('يضبط نسبة الأبعاد المعلنة للخانة', () => {
    expect(slotImageUrl(CLOUD, 'homeReading')).toContain('ar_4:3');
    expect(slotImageUrl(CLOUD, 'aboutTeam')).toContain('ar_2:1');
    expect(slotImageUrl(CLOUD, 'ogImage')).toContain('ar_1200:630');
  });

  it('الشعار والأيقونة بـ c_fit للحفاظ على الشفافية — لا حشو بلون', () => {
    for (const key of ['logo', 'logoDark', 'favicon'] as const) {
      const url = slotImageUrl(CLOUD, key);
      expect(url, key).toContain('c_fit');
      expect(url, key).not.toContain('b_auto');
    }
  });

  it('يطلب الصيغة والجودة التلقائية ودقة الشاشة في كل خانة', () => {
    const url = slotImageUrl(CLOUD, 'homeHero');
    expect(url).toContain('f_auto');
    expect(url).toContain('q_auto');
    expect(url).toContain('dpr_auto');
  });

  it('التحويل يوضع بعد /upload/ مباشرة وإلا تجاهله Cloudinary', () => {
    expect(slotImageUrl(CLOUD, 'homeHero')).toMatch(
      /\/image\/upload\/[^/]+\/v1\/alrehla\/site\/x\.jpg$/,
    );
  });

  it('الصورة التمهيدية صغيرة ومموّهة، وتغيب لو الصورة ليست من Cloudinary', () => {
    const blur = blurPlaceholder(CLOUD);
    expect(blur).toContain('e_blur');
    expect(blur).toContain('w_20');
    expect(blurPlaceholder('https://example.com/a.png')).toBeUndefined();
    expect(blurPlaceholder(undefined)).toBeUndefined();
  });
});

/**
 * ⚠️ الاختبارات دي بتحرس قصّة صورة الهيرو لكل مقاس شاشة.
 *
 * الصورة كانت بتتسلّم 21:9 دايمًا، والحاوية على الموبايل 4:3 —
 * فـ`object-cover` كان بيقصّ قصّة عريضة تاني، وأطراف الصورة تروح.
 */
describe('قصّة لكل مقاس', () => {
  it('بيحط النسبة والعرض المطلوبين', () => {
    const url = slotImageUrlAt(CLOUD, '4:3', 900);
    expect(url).toContain('ar_4:3');
    expect(url).toContain('w_900');
    expect(url).toContain('c_fill');
    expect(url).toContain('g_auto');
  });

  it('⚠️ كل نسبة رابط مستقل — القص بيتحسب من الأصل مش من قصّة قبلها', () => {
    const wide = slotImageUrlAt(CLOUD, '21:9', 2100);
    const tall = slotImageUrlAt(CLOUD, '4:3', 900);
    expect(wide).not.toBe(tall);
    expect(wide).toContain('ar_21:9');
    expect(tall).toContain('ar_4:3');
  });

  it('بيسيب اللي مش من Cloudinary والفاضي زي ما هم', () => {
    expect(slotImageUrlAt('https://example.com/a.png', '4:3', 900))
      .toBe('https://example.com/a.png');
    expect(slotImageUrlAt('', '4:3', 900)).toBe('');
    expect(slotImageUrlAt(null, '4:3', 900)).toBe('');
  });

  it('مبيكدّسش تحويلات على رابط عليه تحويلات', () => {
    const already = 'https://res.cloudinary.com/x/image/upload/w_100/v1/a.jpg';
    expect(slotImageUrlAt(already, '4:3', 900)).toBe(already);
  });
});
