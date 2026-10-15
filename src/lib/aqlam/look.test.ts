import { describe, it, expect } from 'vitest';
import { bandBar, bandBorder, bandSoft, readingLook } from './look';
import { AGE_BANDS } from '@/lib/age-bands';

describe('شكل أقلام الرحلة حسب السن والنوع', () => {
  it('كل فئة عمرية ليها لون مميّز، وخارج الفئات محايد', () => {
    const bars = AGE_BANDS.map((b) => bandBar(b.id));
    expect(new Set(bars).size).toBe(AGE_BANDS.length);
    expect(bandBar(null)).toBe('bg-slate-300');
    expect(bandBorder(null)).toBe('border-slate-200');
    expect(bandSoft(null)).toContain('slate');
  });

  it('الأصغر سنًّا بخط أكبر وتباعد أوسع', () => {
    expect(readingLook('6-9', 'story').text).toContain('text-xl');
    expect(readingLook('10-12', 'story').text).toContain('text-lg');
    expect(readingLook('13-17', 'story').text).toBe('text-lg leading-loose');
    expect(readingLook(null, 'article').text).toBe('text-lg leading-loose');
  });

  it('القصيدة متوسّطة بعرض أضيق، وباقي الأنواع عرض قراءة عادي', () => {
    expect(readingLook(null, 'poem').wrap).toContain('text-center');
    expect(readingLook(null, 'poem').wrap).toContain('max-w-xl');
    expect(readingLook(null, 'story').wrap).toBe('mx-auto max-w-2xl');
  });
});
