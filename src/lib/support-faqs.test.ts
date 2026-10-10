import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FAQ_CREATIVE_WRITING,
  DEFAULT_FAQ_ENHA_LAK,
  DEFAULT_FAQ_GENERAL,
  DEFAULT_FAQ_PARTNERS,
  parseFaqText,
} from './support-faqs';

describe('parseFaqText', () => {
  it('reads question/answer pairs separated by blank lines', () => {
    const faqs = parseFaqText('س: سؤال أول؟\nج: إجابة أولى.\n\nس: سؤال تاني؟\nج: إجابة تانية.');
    expect(faqs).toEqual([
      { q: 'سؤال أول؟', a: 'إجابة أولى.' },
      { q: 'سؤال تاني؟', a: 'إجابة تانية.' },
    ]);
  });

  it('continues multi-line answers and tolerates spacing and CRLF', () => {
    const faqs = parseFaqText('س :سؤال؟\r\nج:  سطر ١\r\nسطر ٢\r\n');
    expect(faqs).toEqual([{ q: 'سؤال؟', a: 'سطر ١\nسطر ٢' }]);
  });

  it('drops a question without an answer, and text before the first question', () => {
    expect(parseFaqText('مقدمة\nس: من غير إجابة\n\nس: كامل؟\nج: أيوه')).toEqual([
      { q: 'كامل؟', a: 'أيوه' },
    ]);
    expect(parseFaqText('')).toEqual([]);
  });

  it('fills known placeholders and leaves unknown ones', () => {
    const [f] = parseFaqText('س: مدة؟\nج: بعد {مدة_الملفات} يوم {غير_معروف}', { مدة_الملفات: 30 });
    expect(f.a).toBe('بعد 30 يوم {غير_معروف}');
  });

  it('the shipped defaults all parse', () => {
    expect(parseFaqText(DEFAULT_FAQ_ENHA_LAK)).toHaveLength(3);
    expect(parseFaqText(DEFAULT_FAQ_CREATIVE_WRITING)).toHaveLength(5);
    expect(parseFaqText(DEFAULT_FAQ_PARTNERS)).toHaveLength(3);
    const general = parseFaqText(DEFAULT_FAQ_GENERAL, { مدة_الملفات: 30 });
    expect(general).toHaveLength(6);
    expect(general.some((f) => f.a.includes('30 يومًا'))).toBe(true);
  });
});
