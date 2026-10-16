import { describe, expect, it } from 'vitest';
import { isHttpsUrl, qaItemsFor, qaMissing, studioErrorMessage } from './studio';

describe('studio — فحص الجودة', () => {
  it('الموضوع الحسّاس بيضيف بند', () => {
    expect(qaItemsFor(false)).toHaveLength(6);
    expect(qaItemsFor(true)).toHaveLength(7);
  });

  it('بيرجّع الناقص', () => {
    expect(qaMissing({}, false)).toHaveLength(6);
    const full = Object.fromEntries(qaItemsFor(false).map((i) => [i.key, true]));
    expect(qaMissing(full, false)).toEqual([]);
    expect(qaMissing(full, true)).toEqual(['sensitive_review']);
  });

  it('قيمة غير true مش بتتحسب', () => {
    const c = Object.fromEntries(qaItemsFor(false).map((i) => [i.key, 'true']));
    expect(qaMissing(c, false)).toHaveLength(6);
    expect(qaMissing(null, false)).toHaveLength(6);
  });
});

describe('studio — تحقّقات', () => {
  it('رابط https فقط', () => {
    expect(isHttpsUrl('https://res.cloudinary.com/x/y.jpg')).toBe(true);
    expect(isHttpsUrl('http://example.com/a.jpg')).toBe(false);
    expect(isHttpsUrl('https://a b')).toBe(false);
    expect(isHttpsUrl(`https://a.com/${'x'.repeat(500)}`)).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
  });

  it('رسائل الأخطاء', () => {
    expect(studioErrorMessage({ code: '23514', message: 'اعتمد مرجع الشخصية الأول' })).toBe('اعتمد مرجع الشخصية الأول');
    expect(studioErrorMessage({ code: '42501', message: 'permission denied' })).toMatch(/صلاحية/);
    expect(studioErrorMessage({ code: '55000', message: 'x' })).toMatch(/مقفول/);
    expect(studioErrorMessage(null)).toBeTruthy();
  });
});
