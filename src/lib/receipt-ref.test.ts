import { describe, it, expect } from 'vitest';
import { makeReceiptRef, parseReceiptRef, isValidReceiptRef } from './receipt-ref';

describe('مرجع الإيصال الخاص', () => {
  it('بيتعمل ويتقري تاني', () => {
    const ref = makeReceiptRef({ publicId: 'alrehla/private/receipts/abc', format: 'jpg' });
    expect(ref).toBe('private:jpg:alrehla/private/receipts/abc');
    expect(parseReceiptRef(ref)).toEqual({ publicId: 'alrehla/private/receipts/abc', format: 'jpg' });
    expect(isValidReceiptRef(ref)).toBe(true);
  });

  it('صور الأطفال أو أي مجلّد تاني مش إيصال', () => {
    expect(isValidReceiptRef('private:jpg:alrehla/private/children/abc')).toBe(false);
    expect(isValidReceiptRef('private:jpg:alrehla/private/receipts/../children/x')).toBe(false);
  });

  it('الإيصالات القديمة (رابط Cloudinary عام) بتفضل مقبولة — وأي رابط تاني لأ', () => {
    expect(isValidReceiptRef('https://res.cloudinary.com/dwg0hr34g/image/upload/v1/alrehla/receipts/x.jpg')).toBe(true);
    expect(isValidReceiptRef('https://evil.example/x.jpg')).toBe(false);
    expect(isValidReceiptRef('')).toBe(false);
  });
});
