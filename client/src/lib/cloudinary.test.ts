import { describe, it, expect } from 'vitest';
import { optimizedImageUrl, slotImageUrl, slotImageUrlAt, blurPlaceholder, watermarkedImageUrl } from '@/lib/cloudinary';
import { publicIdFromUrl } from '@/lib/cloudinary-admin';
import { DEFAULT_WATERMARK, watermarkLayer } from '@/lib/watermark-settings';

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

/**
 * ⚠️ الاختبارات دي بتحرس **قرار حذف**. شاشة الصور بتقارن صور
 *    Cloudinary بالروابط اللي في القاعدة، والمقارنة دي بتتم برقم
 *    الصورة. لو الاستخراج غلط، صورة شغّالة بتبان «مهجورة» —
 *    والحذف مالوش تراجع.
 */
describe('رقم الصورة من رابطها', () => {
  it('بيستخرج الرقم من رابط عليه تحويلات', () => {
    expect(
      publicIdFromUrl(
        'https://res.cloudinary.com/dwg0hr34g/image/upload/f_auto,q_auto:good,w_900,c_fill,g_auto,ar_4:3/v1/alrehla/site/hero.jpg',
      ),
    ).toBe('alrehla/site/hero');
  });

  it('⚠️ نفس الصورة بتحويلات مختلفة = نفس الرقم', () => {
    const base = 'https://res.cloudinary.com/dwg0hr34g/image/upload';
    const a = publicIdFromUrl(`${base}/w_900,ar_4:3/v1/alrehla/site/hero.jpg`);
    const b = publicIdFromUrl(`${base}/w_2100,ar_21:9/v1/alrehla/site/hero.jpg`);
    // لولا ده، كل مقاس كان هيتحسب صورة لوحدها وواحدة منهم «مهجورة».
    expect(a).toBe(b);
  });

  it('بيشتغل على رابط بلا تحويلات', () => {
    expect(
      publicIdFromUrl('https://res.cloudinary.com/dwg0hr34g/image/upload/v17/alrehla/a/b.png'),
    ).toBe('alrehla/a/b');
  });

  it('بيرجّع فاضي لأي رابط مش من Cloudinary', () => {
    expect(publicIdFromUrl('https://example.com/x.png')).toBeNull();
    expect(publicIdFromUrl('')).toBeNull();
    expect(publicIdFromUrl(null)).toBeNull();
  });
});

describe('العلامة المائية على صور المنتجات', () => {
  const LAYER = watermarkLayer(DEFAULT_WATERMARK)!;

  it('البطاقة في النص تحت، والصورة بمقاس ثابت يتصغّر بعدها', () => {
    expect(watermarkedImageUrl(CLOUD, LAYER)).toBe(
      'https://res.cloudinary.com/dwg0hr34g/image/upload/f_auto,q_auto:good,c_limit,w_1600/l_text:Cairo_40_bold:%D8%A7%D9%84%D8%B1%D8%AD%D9%84%D8%A9%20%20%E2%80%A2%20%20alrehla.org,co_rgb:1e3a8a,fl_relative,w_0.24,o_32,g_south,y_0.24/v1/alrehla/site/x.jpg',
    );
  });

  it('⚠️ بعد العلامة `optimizedImageUrl` مابتكدّسش ولا بتشيلها', () => {
    // الكارت والمعرض بينادوا `optimizedImageUrl` على الرابط اللي جاي من
    // الخادم — لو بتعيد بناءه من الأصل، العلامة كانت هتختفي.
    const marked = watermarkedImageUrl(CLOUD, LAYER)!;
    expect(optimizedImageUrl(marked, 600)).toBe(marked);
  });

  it('من غير شعار، أو صورة مش Cloudinary: الصورة زي ما هي', () => {
    expect(watermarkedImageUrl(CLOUD, null)).toBe(CLOUD);
    expect(watermarkedImageUrl('https://example.com/a.jpg', LAYER)).toBe('https://example.com/a.jpg');
    expect(watermarkedImageUrl(undefined, LAYER)).toBeUndefined();
  });

});

import { addWatermark, watermarkCloudinaryUrlsIn } from './cloudinary';
describe('addWatermark — صور الموقع كلها', () => {
  const L = watermarkLayer(DEFAULT_WATERMARK)!;
  it('بعد تحويل المقاس، قبل رقم النسخة', () => {
    expect(addWatermark('https://res.cloudinary.com/d/image/upload/f_auto,w_700/v12/alrehla/blog/a.jpg', L))
      .toBe(`https://res.cloudinary.com/d/image/upload/f_auto,w_700/l_text:Cairo_40_bold:%D8%A7%D9%84%D8%B1%D8%AD%D9%84%D8%A9%20%20%E2%80%A2%20%20alrehla.org,co_rgb:1e3a8a,fl_relative,w_0.24,o_32,g_south,y_0.24/v12/alrehla/blog/a.jpg`);
  });
  it('صورة خام: بتتصغّر الأول', () => {
    expect(addWatermark('https://res.cloudinary.com/d/image/upload/v12/a.jpg', L))
      .toBe(`https://res.cloudinary.com/d/image/upload/f_auto,q_auto:good,c_limit,w_1600/l_text:Cairo_40_bold:%D8%A7%D9%84%D8%B1%D8%AD%D9%84%D8%A9%20%20%E2%80%A2%20%20alrehla.org,co_rgb:1e3a8a,fl_relative,w_0.24,o_32,g_south,y_0.24/v12/a.jpg`);
  });
  it('مابتتكدّسش، ومابتلمسش غير Cloudinary، ومن غير شعار = زي ما هي', () => {
    const once = addWatermark('https://res.cloudinary.com/d/image/upload/v1/a.jpg', L);
    expect(addWatermark(once, L)).toBe(once);
    expect(addWatermark('https://picsum.photos/1', L)).toBe('https://picsum.photos/1');
    expect(addWatermark('https://res.cloudinary.com/d/image/upload/v1/a.jpg', null)).toBe('https://res.cloudinary.com/d/image/upload/v1/a.jpg');
  });
  it('صور جوّه نص المقال', () => {
    const out = watermarkCloudinaryUrlsIn('![x](https://res.cloudinary.com/d/image/upload/v1/a.jpg) و <img src="https://res.cloudinary.com/d/image/upload/v2/b.png">', L);
    expect(out.match(/l_text:Cairo/g)?.length).toBe(2);
  });
});

describe('isUploadedImageUrl', () => {
  it('بيقبل صورة مرفوعة عندنا بس', async () => {
    const { isUploadedImageUrl } = await import('./cloudinary');
    expect(isUploadedImageUrl('https://res.cloudinary.com/demo/image/upload/v1/alrehla/avatars/a.jpg')).toBe(true);
    expect(isUploadedImageUrl('http://res.cloudinary.com/demo/image/upload/a.jpg')).toBe(false);
    expect(isUploadedImageUrl('https://evil.example/res.cloudinary.com/image/upload/a.jpg')).toBe(false);
    expect(isUploadedImageUrl('https://res.cloudinary.com/demo/video/upload/a.mp4')).toBe(false);
    expect(isUploadedImageUrl('')).toBe(false);
    expect(isUploadedImageUrl(undefined)).toBe(false);
  });
});

describe('downloadableImageUrl', () => {
  it('بالعلامة بس، وباسم ملف إنجليزي آمن', async () => {
    const { downloadableImageUrl, addWatermark } = await import('./cloudinary');
    const marked = addWatermark('https://res.cloudinary.com/d/image/upload/v1/a.jpg', watermarkLayer(DEFAULT_WATERMARK));
    expect(downloadableImageUrl(marked, 'Story Hero 1')).toBe(
      marked.replace('/upload/', '/upload/fl_attachment:story-hero-1/'),
    );
    expect(downloadableImageUrl(marked, 'قصة')).toContain('fl_attachment:alrehla/');
    expect(downloadableImageUrl('https://res.cloudinary.com/d/image/upload/v1/a.jpg')).toBeNull();
    expect(downloadableImageUrl('https://example.com/a.jpg')).toBeNull();
    expect(downloadableImageUrl(null)).toBeNull();
  });
});
