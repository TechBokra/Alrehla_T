import { describe, expect, it } from 'vitest';
import { addonAllowedWith, addonDeliveredAs, keepAllowedAddons } from './addon-availability';

const printed = { id: 'p', deliveryFormat: 'printed' };
const electronic = { id: 'e', deliveryFormat: 'electronic' };
const both = { id: 'b', deliveryFormat: 'both' };
const legacy = { id: 'l', deliveryFormat: undefined }; // من قبل العمود = مطبوعة

describe('addonAllowedWith', () => {
  it('⚠️ النسخة الإلكترونية: الإلكترونية و«الاتنين» بس', () => {
    expect(addonAllowedWith(electronic, 'electronic')).toBe(true);
    expect(addonAllowedWith(both, 'electronic')).toBe(true);
    expect(addonAllowedWith(printed, 'electronic')).toBe(false);
    expect(addonAllowedWith(legacy, 'electronic')).toBe(false);
  });

  it('المطبوعة و«الاتنين»: كل الإضافات', () => {
    for (const f of ['printed', 'both'] as const) {
      for (const a of [printed, electronic, both]) expect(addonAllowedWith(a, f)).toBe(true);
    }
  });
});

describe('addonDeliveredAs', () => {
  it('إضافة «الاتنين» مع نسخة إلكترونية بتوصل إلكترونية بس — من غير شحن', () => {
    expect(addonDeliveredAs(both, 'electronic')).toBe('electronic');
    expect(addonDeliveredAs(both, 'printed')).toBe('both');
  });
});

describe('keepAllowedAddons', () => {
  it('لما العميل يحوّل لإلكتروني، المطبوع بيتشال من اختياره', () => {
    expect(keepAllowedAddons([printed, electronic, both], ['p', 'e', 'b'], 'electronic')).toEqual(['e', 'b']);
  });
  it('إضافة اتمسحت من الكتالوج بتتشال', () => {
    expect(keepAllowedAddons([electronic], ['gone', 'e'], 'printed')).toEqual(['e']);
  });
});
