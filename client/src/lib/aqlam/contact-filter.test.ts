import { describe, it, expect } from 'vitest';
import { checkContactInfo } from './contact-filter';

const blocked = (text: string) => !checkContactInfo(text).ok;
const kindsOf = (text: string) => {
  const r = checkContactInfo(text);
  return r.ok ? [] : r.kinds;
};

describe('أرقام التليفون', () => {
  it('رقم متصل بالأرقام اللاتينية', () => {
    expect(kindsOf('كلمني على 01012345678')).toContain('phone');
  });

  it('أرقام عربية هندية', () => {
    expect(kindsOf('رقمي ٠١٠١٢٣٤٥٦٧٨')).toContain('phone');
  });

  it('أرقام فارسية', () => {
    expect(blocked('۰۱۰۱۲۳۴۵۶۷۸')).toBe(true);
  });

  it('أرقام مفصولة بمسافات', () => {
    expect(blocked('٠١٠ ١٢٣ ٤٥٦ ٧٨')).toBe(true);
  });

  it('أرقام مفصولة بشرط ونقط', () => {
    expect(blocked('010-1234-5678')).toBe(true);
    expect(blocked('010.1234.5678')).toBe(true);
  });

  it('رقم دولي بعلامة +', () => {
    expect(blocked('+20 101 234 5678')).toBe(true);
  });

  it('رقم مكتوب رقم رقم', () => {
    expect(blocked('0 1 0 1 2 3 4 5 6 7 8')).toBe(true);
  });

  it('أرقام مكتوبة حروف', () => {
    expect(blocked('صفر واحد صفر اتنين تلاتة اربعة خمسة ستة سبعة')).toBe(true);
  });

  it('أرقام فيها تشكيل وتطويل بين الحروف', () => {
    expect(blocked('صِفْر واحـــد صفر اتنين ثلاثة أربعة خمسة ستة سبعة')).toBe(true);
  });

  it('سنين متتالية مش رقم تليفون', () => {
    expect(blocked('بين 2024 و 2025 و 2026')).toBe(false);
    expect(blocked('٢٠٢٤ ٢٠٢٥ ٢٠٢٦')).toBe(false);
  });

  it('أرقام قصيرة عادية مش بتتحجب', () => {
    expect(blocked('كان عندي ١٠ قطط و٣ كلاب في ٢٠٢٠')).toBe(false);
    expect(blocked('بيتنا في الدور 12')).toBe(false);
  });
});

describe('البريد والروابط والحسابات', () => {
  it('بريد عادي', () => {
    expect(kindsOf('ابعتلي على ahmed@example.com')).toContain('email');
  });

  it('بريد مموّه', () => {
    expect(blocked('ahmed (at) example dot com')).toBe(true);
  });

  it('رابط كامل', () => {
    expect(kindsOf('شوفوا https://example.com/abc')).toContain('link');
    expect(kindsOf('www.example.org')).toContain('link');
  });

  it('دومين من غير http', () => {
    expect(blocked('زوروا موقعي mysite.com')).toBe(true);
  });

  it('اسم حساب بـ@', () => {
    expect(kindsOf('تابعوني @sara_writes')).toContain('handle');
  });

  it('ذكر تطبيق مع دعوة للتواصل', () => {
    expect(kindsOf('ضيفني على واتساب')).toContain('invite');
    expect(blocked('add me on instagram')).toBe(true);
  });

  it('ذكر تطبيق من غير دعوة مش مشكلة', () => {
    expect(blocked('كنت بتفرج على تيك توك وبعدين نمت')).toBe(false);
  });
});

describe('النص الأدبي العادي بيعدّي', () => {
  it('قصة عادية', () => {
    const text =
      'كان يا ما كان، في قرية صغيرة على طرف الصحراء، بنت اسمها نور. كل صباح كانت بتطلع تجري ورا الغيم، وتقول: يا غيم يا غيم، خدني معاك!';
    expect(checkContactInfo(text).ok).toBe(true);
  });

  it('قصيدة بتشكيل', () => {
    expect(checkContactInfo('وَالنُّجُومُ تَهْمِسُ فِي اللَّيْلِ: لَا تَخَفْ').ok).toBe(true);
  });

  it('نقطة في آخر الجملة مش دومين', () => {
    expect(blocked('وصلت البيت.وبعدين نمت')).toBe(false);
  });
});
