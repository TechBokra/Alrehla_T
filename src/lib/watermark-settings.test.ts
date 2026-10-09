import { describe, it, expect } from 'vitest';
import {
  cleanWatermarkText,
  DEFAULT_WATERMARK,
  DEFAULT_WATERMARK_TEXT,
  normalizeWatermark,
  watermarkLayer,
} from '@/lib/watermark-settings';

describe('إعدادات العلامة المائية', () => {
  it('مفيش حاجة محفوظة = شغّالة بالشكل الافتراضي (زي ما كانت)', () => {
    expect(normalizeWatermark(undefined)).toEqual(DEFAULT_WATERMARK);
    expect(normalizeWatermark({})).toEqual(DEFAULT_WATERMARK);
  });

  it('مقفولة = مفيش طبقة، والصور زي ما هي', () => {
    expect(watermarkLayer(normalizeWatermark({ enabled: false }))).toBeNull();
  });

  it('اختيار مش معروف بيرجع للافتراضي', () => {
    const w = normalizeWatermark({ style: 'neon', size: 'huge', position: 'top_left' });
    expect(w.style).toBe('light');
    expect(w.size).toBe('medium');
    expect(w.position).toBe('bottom');
  });

  it('الحروف اللي بتكسر الرابط بتتشال، والطول بيتقص', () => {
    expect(cleanWatermarkText('a/b,c%d')).toBe('a b c d');
    expect(cleanWatermarkText('x'.repeat(90)).length).toBe(40);
    expect(normalizeWatermark({ text: '   ' }).text).toBe(DEFAULT_WATERMARK_TEXT);
  });

  it('الطبقة: الشكل والحجم والمكان', () => {
    const dark = watermarkLayer({ ...DEFAULT_WATERMARK, style: 'dark', size: 'large', position: 'center' })!;
    expect(dark).toContain('co_rgb:ffffff');
    expect(dark).toContain('w_0.32');
    expect(dark).toContain('g_center');
    expect(dark).not.toContain('y_0.24');
    const light = watermarkLayer(DEFAULT_WATERMARK)!;
    expect(light).toContain('g_south,y_0.24');
    // مفيش `/` ولا `,` جوّه الكتابة نفسها — كانوا هيكسروا الرابط.
    const custom = watermarkLayer({ ...DEFAULT_WATERMARK, text: 'منصة/الرحلة, 2026' })!;
    expect(custom.split('/').length).toBe(1);
  });
});
