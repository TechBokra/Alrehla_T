import { describe, expect, it } from 'vitest';
import { fillContentTokens } from './content-tokens';
import { CONTENT_DEFAULTS } from './site-content';
import { retentionLabel } from './session-recording';

describe('fillContentTokens', () => {
  it('بتبدّل المعروف وبتسيب المجهول زيّ ما هو', () => {
    expect(fillContentTokens('بعد {المدة} و{حاجة}', { المدة: 'أسبوع' })).toBe(
      'بعد أسبوع و{حاجة}',
    );
  });

  it('بتقبل أرقام', () => {
    expect(fillContentTokens('{مدة_الملفات} يومًا', { مدة_الملفات: 30 })).toBe('30 يومًا');
  });

  it('النص الفاضي أو الناقص مابيرميش', () => {
    expect(fillContentTokens('')).toBe('');
    expect(fillContentTokens(undefined as unknown as string)).toBe('');
  });
});

/**
 * ⚠️ **الحارس ده قانوني مش تقني.**
 *
 * مدة حفظ التسجيلات ومدة حفظ الملفات **إعدادات بتتغيّر من اللوحة**.
 * لو الرقم مكتوب في نص السياسة بالإيد، أول ما الإدارة تغيّر الإعداد
 * تبقى سياسة الخصوصية بتوعد ولي الأمر بمدة والنظام بيحذف بمدة تانية —
 * والورقة دي هي اللي ولي الأمر بيوافق عليها قبل الحجز.
 */
describe('سياسة الخصوصية مابتكتبش المدد بإيدها', () => {
  const body = CONTENT_DEFAULTS['privacy.body'];

  it('بتستعمل العلامات', () => {
    expect(body).toContain('{المدة}');
    expect(body).toContain('{مدة_الملفات}');
  });

  it('مفيش مدة محفورة في النص بدل العلامة', () => {
    // التعبيرات دي كانت مكتوبة فعلًا في النص قبل الربط بالإعدادات.
    expect(body).not.toContain('**شهر واحد**');
    expect(body).not.toMatch(/\*\*(أسبوع|أسبوعين|شهر|شهرين)\*\*/);
  });

  it('والعلامات كلها بتتملا وقت العرض — مافيش علامة فاضلة', () => {
    const filled = fillContentTokens(body, {
      المدة: retentionLabel(14),
      مدة_الملفات: 45,
    });
    expect(filled).toContain('14 يومًا');
    expect(filled).toContain('45');
    // أي `{...}` فاضلة = علامة الصفحة مش بتملاها.
    expect(filled).not.toMatch(/\{[^{}\s]+\}/);
  });
});
