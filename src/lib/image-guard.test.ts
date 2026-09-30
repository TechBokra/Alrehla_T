import { describe, it, expect } from 'vitest';
import { isProtectedMedia, type GuardTarget } from './image-guard';

/** عنصر وهمي: `closest` بيرجّع حاجة لو أي محدّد في القايمة بيطابق. */
function el(matches: string[]): GuardTarget {
  return {
    closest: (selector: string) =>
      selector.split(',').some((s) => matches.includes(s.trim())) ? {} : null,
  };
}

describe('منع حفظ الصور', () => {
  it('الصورة بتتقفل', () => {
    expect(isProtectedMedia(el(['img']))).toBe(true);
  });

  it('عنصر جوّه `picture` أو عليه علامة الحماية بيتقفل', () => {
    expect(isProtectedMedia(el(['picture']))).toBe(true);
    expect(isProtectedMedia(el(['[data-protect-media]']))).toBe(true);
  });

  it('⚠️ النص والروابط والخانات مابتتقفلش', () => {
    // قفل الضغط يمين على الصفحة كلها بيكسر «نسخ» رقم التحويل و«فتح
    // في تبويب جديد» — والطلب كان الصور بس.
    expect(isProtectedMedia(el([]))).toBe(false);
  });

  it('الاستثناء الصريح بيغلب', () => {
    expect(isProtectedMedia(el(['img', '[data-allow-save]']))).toBe(false);
  });

  it('هدف مش عنصر (النص نفسه أو المستند) مابيوقعش', () => {
    expect(isProtectedMedia(null)).toBe(false);
    expect(isProtectedMedia({})).toBe(false);
  });
});
