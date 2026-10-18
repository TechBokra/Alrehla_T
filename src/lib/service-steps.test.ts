import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { serviceSteps, methodsSentence } from './service-steps';

describe('methodsSentence', () => {
  it('وسيلة واحدة = كلمة واحدة من غير «أو»', () => {
    expect(methodsSentence(['card'])).toBe('فيزا وماستركارد');
  });

  it('أكتر من وسيلة: فواصل و«أو» قبل الأخيرة', () => {
    expect(methodsSentence(['card', 'fawry', 'valu'])).toBe(
      'فيزا وماستركارد، فوري أو فاليو (تقسيط)',
    );
  });

  it('قايمة فاضية = نص فاضي، مش «أو» معلّقة', () => {
    expect(methodsSentence([])).toBe('');
  });
});

describe('serviceSteps', () => {
  it('تلات خطوات دايمًا، بالترتيب', () => {
    const gw = serviceSteps({ mode: 'gateway', methods: ['card'] });
    expect(gw.map((s) => s.icon)).toEqual(['pen', 'pay', 'deliver']);
    expect(serviceSteps({ mode: 'manual' })).toHaveLength(3);
  });

  /**
   * ⚠️ العطل الأصلي: الخطوة كانت بتقول «ارفع صورة الإيصال» والبوابة
   *    مفتوحة — ومفيش إيصال يرفعه. الاختبار ده بيمنع رجوعها.
   */
  it('البوابة مفتوحة: مفيش كلام عن إيصال ولا تحويل', () => {
    const [, pay] = serviceSteps({ mode: 'gateway', methods: ['card', 'fawry'] });
    expect(pay.text).not.toMatch(/إيصال|إنستاباي|فودافون/);
    expect(pay.title).not.toMatch(/تحويل/);
    expect(pay.text).toContain('فوري');
  });

  it('التحويل اليدوي: الإيصال مذكور', () => {
    const [, pay] = serviceSteps({ mode: 'manual' });
    expect(pay.text).toContain('إيصال');
    expect(pay.title).toContain('تحويل');
  });

  it('وسيلة واحدة بس: الجملة تفضل مفهومة', () => {
    const [, pay] = serviceSteps({ mode: 'gateway', methods: ['valu'] });
    expect(pay.text).toContain('فاليو');
    expect(pay.text).not.toContain('— وبيانات بطاقتك مابتعدّيش على موقعنا، بتتكتب على صفحة البنك. —');
  });

  /**
   * ⚠️ الحارس الحقيقي: الخطوات مامكتوبةش في المكوّن. لو حد رجّع نصًا
   *    ثابتًا جوّه `ServiceCard.tsx`، بيرجع لنفس العطل — نص بيوصف
   *    نظامًا ممكن يكون اتغيّر من اللوحة.
   */
  it('مفيش نص دفع مكتوب بالإيد في مكوّن الخطوات', () => {
    const src = readFileSync(new URL('../components/creative-writing/ServiceCard.tsx', import.meta.url), 'utf8');
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(body).not.toMatch(/إنستاباي|فودافون كاش|ادفع بالتحويل/);
    expect(body).toContain('serviceSteps(');
  });
});
