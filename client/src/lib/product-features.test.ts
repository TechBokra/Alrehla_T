import { describe, it, expect } from 'vitest';
import { parseFeatures, MAX_FEATURES } from './product-input';

describe('parseFeatures', () => {
  it('بند في كل سطر', () => {
    expect(parseFeatures('٣٢ صفحة\nغلاف مقوّى')).toEqual(['٣٢ صفحة', 'غلاف مقوّى']);
  });

  it('السطور الفاضية بتتشال — وهي بتحصل طبيعي وإنت بتكتب', () => {
    expect(parseFeatures('أول\n\n\nتاني\n')).toEqual(['أول', 'تاني']);
  });

  it('المسافات الزايدة بتتشال', () => {
    expect(parseFeatures('   بند   \n\tتاني\t')).toEqual(['بند', 'تاني']);
  });

  it('المكرّر بيتشال — النسخ واللصق بيكرّر', () => {
    expect(parseFeatures('بند\nبند\nتاني')).toEqual(['بند', 'تاني']);
  });

  it('البند الطويل بيتشال لا بيتقصّ — القصّ بيدّي جملة ناقصة للعميل', () => {
    const long = 'ا'.repeat(81);
    expect(parseFeatures(`قصير\n${long}`)).toEqual(['قصير']);
    expect(parseFeatures('ا'.repeat(80))).toHaveLength(1);
  });

  it(`السقف ${MAX_FEATURES} — عشان الكارت مايتحوّلش لقايمة`, () => {
    const many = Array.from({ length: 20 }, (_, i) => `بند ${i}`).join('\n');
    expect(parseFeatures(many)).toHaveLength(MAX_FEATURES);
  });

  it('الفاضي والغايب بيرجّعوا قايمة فاضية', () => {
    expect(parseFeatures('')).toEqual([]);
    expect(parseFeatures(null)).toEqual([]);
    expect(parseFeatures(undefined)).toEqual([]);
    expect(parseFeatures('\n \n\t\n')).toEqual([]);
  });
});
