import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PackageCard, perSessionPrice } from './PackageCard';
import type { WritingPackage } from '@/types';

const base: WritingPackage = {
  id: 'p1',
  slug: 'golden-words',
  name: 'رحلة الكلمات الذهبية',
  ageGroup: 'under_12',
  track: 'foundation',
  price: 8400,
  durationText: '3 أشهر',
  sessionsCount: 12,
  sessionDuration: 'من 40 الى 50 دقيقة',
  targetAudience: '',
  shortDescription: 'من الصفحة البيضاء... إلى أول حكاية تحمل توقيعه.',
  fullDescription: '',
  isActive: true,
  bookingOpen: true,
  imageUrl: null,
};

describe('PackageCard', () => {
  it('سعر الجلسة = السعر ÷ عدد الجلسات', () => {
    expect(perSessionPrice(base)).toBe(700);
    expect(perSessionPrice({ price: 100, sessionsCount: 0 })).toBeNull();
  });

  it('من غير صورة: خلفية المسار، وزرار الحجز، وسعر الجلسة', () => {
    const html = renderToStaticMarkup(<PackageCard pkg={base} />);
    expect(html).not.toContain('<img');
    expect(html).toContain('from-emerald-100');
    expect(html).toContain('اختار مدربك واحجز');
    expect(html).toContain('للجلسة');
  });

  it('بصورة: الصورة بتظهر', () => {
    const html = renderToStaticMarkup(
      <PackageCard pkg={{ ...base, imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/alrehla/packages/a.jpg' }} />,
    );
    expect(html).toContain('<img');
    expect(html).toContain('alt="رحلة الكلمات الذهبية"');
  });

  it('المقفولة: «قريبًا» ومفيش رابط حجز', () => {
    const html = renderToStaticMarkup(<PackageCard pkg={{ ...base, track: 'specialization', bookingOpen: false }} />);
    expect(html).toContain('قريبًا');
    expect(html).not.toContain('/creative-writing/booking?package=');
    expect(html).toContain('from-violet-100');
  });
});
