import { describe, expect, it } from 'vitest';
import {
  AD_PLACEMENTS,
  adIsInternal,
  adIsLive,
  adStatus,
  cleanAdLink,
  cleanPlacements,
  parseAdInput,
  placementKey,
  visibleAds,
  type Ad,
} from './ads';

const now = new Date('2026-10-17T12:00:00Z');

const ad = (over: Partial<Ad> = {}): Ad => ({
  id: 'a1',
  title: 'إعلان',
  advertiserName: null,
  imageUrl: 'https://res.cloudinary.com/x/a.png',
  imageUrlMobile: null,
  linkUrl: null,
  placements: ['home:top'],
  startsAt: null,
  endsAt: null,
  isActive: true,
  sortOrder: 0,
  ...over,
});

describe('الخانات', () => {
  it('كل صفحة لها خانة فوق وخانة تحت', () => {
    expect(AD_PLACEMENTS).toContainEqual(
      expect.objectContaining({ key: 'home:top', pageId: 'home', position: 'top' }),
    );
    expect(AD_PLACEMENTS).toContainEqual(expect.objectContaining({ key: 'home:bottom' }));
    expect(AD_PLACEMENTS.length).toBe(20); // ١٠ صفحات × موضعين
  });

  it('المفاتيح مفيش فيها تكرار', () => {
    const keys = AD_PLACEMENTS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('بتشيل المجهول والمكرّر', () => {
    expect(cleanPlacements(['home:top', 'home:top', 'خانة_مختلقة', 5, null])).toEqual(['home:top']);
    expect(cleanPlacements('home:top')).toEqual([]);
  });

  it('مفتاح الخانة = صفحة:موضع', () => {
    expect(placementKey('blog', 'bottom')).toBe('blog:bottom');
  });
});

describe('التوقيت', () => {
  it('من غير تواريخ = ظاهر', () => {
    expect(adIsLive(ad(), now)).toBe(true);
  });

  it('الموقوف مش ظاهر مهما كان التوقيت', () => {
    expect(adIsLive(ad({ isActive: false }), now)).toBe(false);
    expect(adStatus(ad({ isActive: false }), now)).toBe('paused');
  });

  it('المجدول مش ظاهر قبل بدايته', () => {
    const a = ad({ startsAt: '2026-10-18T00:00:00Z' });
    expect(adIsLive(a, now)).toBe(false);
    expect(adStatus(a, now)).toBe('scheduled');
  });

  it('المنتهي مش ظاهر', () => {
    const a = ad({ endsAt: '2026-10-17T11:59:59Z' });
    expect(adIsLive(a, now)).toBe(false);
    expect(adStatus(a, now)).toBe('ended');
  });

  /**
   * ⚠️ لحظة البداية بالظبط = ظاهر، ولحظة النهاية بالظبط = مش ظاهر.
   *    الحدّين لازم يكونوا محدّدين عشان إعلانين متتابعين
   *    مايظهروش مع بعض ولا يحصل وقت مفيش فيه إعلان.
   */
  it('الحدود: البداية داخلة والنهاية خارجة', () => {
    expect(adIsLive(ad({ startsAt: now.toISOString() }), now)).toBe(true);
    expect(adIsLive(ad({ endsAt: now.toISOString() }), now)).toBe(false);
  });

  it('التاريخ البايظ مابيخفيش الإعلان', () => {
    expect(adIsLive(ad({ startsAt: 'يوم الاتنين' }), now)).toBe(true);
    expect(adIsLive(ad({ endsAt: 'بكرة' }), now)).toBe(true);
  });
});

describe('visibleAds', () => {
  it('بتجيب إعلانات الخانة المطلوبة بس', () => {
    const list = [ad({ id: 'a' }), ad({ id: 'b', placements: ['blog:top'] })];
    expect(visibleAds(list, 'home:top', now).map((a) => a.id)).toEqual(['a']);
  });

  it('بترتّب بالترتيب اليدوي', () => {
    const list = [
      ad({ id: 'tany', sortOrder: 2 }),
      ad({ id: 'awwal', sortOrder: 1 }),
      ad({ id: 'talet', sortOrder: 3 }),
    ];
    expect(visibleAds(list, 'home:top', now).map((a) => a.id)).toEqual(['awwal', 'tany', 'talet']);
  });

  it('بتستبعد اللي مش شغّال', () => {
    const list = [ad({ id: 'live' }), ad({ id: 'off', isActive: false })];
    expect(visibleAds(list, 'home:top', now).map((a) => a.id)).toEqual(['live']);
  });
});

describe('اللينك', () => {
  it('بيقبل المسار الداخلي وhttps', () => {
    expect(cleanAdLink('/creative-writing/packages')).toEqual({
      ok: true,
      url: '/creative-writing/packages',
    });
    expect(cleanAdLink('https://example.com/x')).toEqual({ ok: true, url: 'https://example.com/x' });
    expect(cleanAdLink('  ')).toEqual({ ok: true, url: null });
  });

  /**
   * ⚠️ `//evil.com` شكله مسار، والمتصفح بيروح بيه لنطاق تاني.
   *    والبانر بيدوس عليه زائر واثق في الموقع.
   */
  it('بيرفض الشرطتين وhttp وjavascript وdata', () => {
    for (const bad of ['//evil.com', 'http://x.com', 'javascript:alert(1)', 'data:text/html,x']) {
      expect(cleanAdLink(bad).ok, bad).toBe(false);
    }
  });

  it('المعلن داخلي لو اللينك داخلي أو مفيش لينك', () => {
    expect(adIsInternal({ linkUrl: '/aqlam' })).toBe(true);
    expect(adIsInternal({ linkUrl: null })).toBe(true);
    expect(adIsInternal({ linkUrl: 'https://example.com' })).toBe(false);
  });
});

describe('parseAdInput', () => {
  const good = {
    title: 'باقة الشرارة',
    imageUrl: 'https://res.cloudinary.com/x/a.png',
    placements: ['home:top'],
    isActive: 'on',
    sortOrder: '2',
  };

  it('بيقبل المدخل السليم', () => {
    const r = parseAdInput(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sortOrder).toBe(2);
      expect(r.value.isActive).toBe(true);
      expect(r.value.advertiserName).toBeNull();
    }
  });

  it('بيرفض من غير عنوان أو صورة أو مكان', () => {
    expect(parseAdInput({ ...good, title: '  ' })).toMatchObject({ ok: false });
    expect(parseAdInput({ ...good, imageUrl: '' })).toMatchObject({ ok: false });
    expect(parseAdInput({ ...good, placements: [] })).toMatchObject({ ok: false });
    expect(parseAdInput({ ...good, placements: ['مختلق'] })).toMatchObject({ ok: false });
  });

  it('بيرفض نهاية قبل بداية — نفس شرط القاعدة', () => {
    const r = parseAdInput({
      ...good,
      startsAt: '2026-11-01T00:00',
      endsAt: '2026-10-01T00:00',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('بعد البداية');
  });

  it('بيرفض اللينك الخطر برسالة مفهومة', () => {
    const r = parseAdInput({ ...good, linkUrl: 'javascript:alert(1)' });
    expect(r.ok).toBe(false);
  });

  it('مفيش تواريخ = مفيش حد', () => {
    const r = parseAdInput(good);
    if (r.ok) {
      expect(r.value.startsAt).toBeNull();
      expect(r.value.endsAt).toBeNull();
    }
  });
});
