import { describe, expect, it } from 'vitest';
import { fromUrlToken, toUrlToken, whatsappLink } from './join-token';

// شكل مفاتيح القاعدة: base64 لـ٣٢ بايت = ٤٤ حرف بـ`=` في الآخر.
const TOKEN = 'ab+c/def+gh/ijklmnopqrstuvwxyz0123456789AB+=';

describe('رابط النقاش', () => {
  it('⚠️ الرابط مافيهوش / ولا + ولا =، وبيرجع لأصله بالظبط', () => {
    const url = toUrlToken(TOKEN);
    expect(url).not.toMatch(/[+/=]/);
    expect(fromUrlToken(url)).toBe(TOKEN);
  });
  it('الروابط القديمة (encodeURIComponent) لسه بتشتغل', () => {
    expect(fromUrlToken(encodeURIComponent(TOKEN))).toBe(TOKEN);
    expect(fromUrlToken(TOKEN.replace(/\+/g, ' '))).toBe(TOKEN);
  });
});

describe('واتساب', () => {
  it('رقم مصري محلي ← دولي، والرسالة مشفّرة', () => {
    expect(whatsappLink('010 1234 5678', 'أهلًا')).toBe(`https://wa.me/201012345678?text=${encodeURIComponent('أهلًا')}`);
    expect(whatsappLink('+966 50 123 4567', 'x')).toContain('wa.me/966501234567');
    expect(whatsappLink('00971501234567', 'x')).toContain('wa.me/971501234567');
    expect(whatsappLink('', 'x')).toBeNull();
  });
});
