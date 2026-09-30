import { describe, it, expect } from 'vitest';
import { hidesOwnText } from '@/components/ui/Button';

/**
 * الاختبار ده اتكتب بعد عطل حقيقي: **تلات أزرار نصّها مختفي** —
 * «إتمام الطلب» في السلة، و«إرسال التذكرة» في الدعم، و«إرسال
 * الطلب» في انضم إلينا. كلهم `!bg-slate-900` بلا `!text-`.
 */
describe('hidesOwnText', () => {
  it('🔴 الحالة اللي خلّت «إتمام الطلب» مختفيًا', () => {
    expect(hidesOwnText('w-full !bg-slate-900 shadow-md gap-2')).toBe(true);
  });

  it('الاتنين متجاوَزين = سليم', () => {
    expect(hidesOwnText('!bg-blue-600 !text-white hover:!bg-blue-700')).toBe(false);
  });

  it('مفيش تجاوز خالص = سليم', () => {
    expect(hidesOwnText('w-full justify-center')).toBe(false);
    expect(hidesOwnText('')).toBe(false);
  });

  it('⚠️ تجاوز النصّ وحده مش مشكلة — الخلفية بتفضل بتاعة المكوّن', () => {
    expect(hidesOwnText('!text-slate-700')).toBe(false);
  });

  it('بيمسك التجاوز مهما كان مكانه في السطر', () => {
    expect(hidesOwnText('mt-2 !bg-green-500 w-full')).toBe(true);
    expect(hidesOwnText('!bg-slate-100 !border-0 !text-slate-700')).toBe(false);
  });
});
