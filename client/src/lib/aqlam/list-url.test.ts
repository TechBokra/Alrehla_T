import { describe, it, expect } from 'vitest';
import { aqlamListHref } from './list-url';

describe('رابط قائمة أقلام الرحلة', () => {
  it('الافتراضي رابط فاضي', () => {
    expect(aqlamListHref({})).toBe('/aqlam');
    expect(aqlamListHref({ s: 'new', p: 1, c: null, a: null })).toBe('/aqlam');
  });

  it('الفلاتر بتتكتب في الرابط', () => {
    expect(aqlamListHref({ c: 'story' })).toBe('/aqlam?c=story');
    expect(aqlamListHref({ c: 'poem', a: '13-17', s: 'top', p: 3 })).toBe('/aqlam?c=poem&a=13-17&s=top&p=3');
  });

  it('تغيير فلتر بيرجّع للصفحة الأولى لو اتبعت من غير p', () => {
    const current = { c: 'story', a: '6-9', s: 'top' };
    expect(aqlamListHref({ ...current, c: undefined })).toBe('/aqlam?a=6-9&s=top');
  });

  it('الترتيب الافتراضي من الإعداد مابيتكتبش في الرابط', () => {
    expect(aqlamListHref({ s: 'top' }, 'top')).toBe('/aqlam');
    expect(aqlamListHref({ s: 'new' }, 'top')).toBe('/aqlam?s=new');
    expect(aqlamListHref({ s: 'old' })).toBe('/aqlam?s=old');
  });
});
