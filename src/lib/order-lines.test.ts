import { describe, it, expect } from 'vitest';
import { orderKind, orderLines, orderSubtotal, orderSearchText } from './order-lines';
import type { Order } from '@/types';

const item = (over: Partial<Order['items'][number]> = {}) =>
  ({ productId: 'p1', quantity: 1, unitPrice: 300, format: 'printed', ...over }) as Order['items'][number];

describe('بنود الطلب للعرض', () => {
  it('الإضافات بأسعارها وسعر المنتج من غيرها', () => {
    const [l] = orderLines(
      {
        items: [
          item({
            customizationData: {
              childName: ' ليلى ',
              addons: [
                { id: 'a', name: 'ميدالية', price: 80, customized: true },
                { id: 'b', name: 'دفتر تلوين', price: 70 },
              ],
            } as never,
          }),
        ],
      },
      { p1: 'أنت البطل' },
    );
    expect(l.name).toBe('أنت البطل');
    expect(l.childName).toBe('ليلى');
    expect(l.addons.map((a) => a.name)).toEqual(['ميدالية', 'دفتر تلوين']);
    expect(l.basePrice).toBe(150);
    expect(l.formatLabel).toBe('');
  });

  it('منتج اتمسح بيبان باسم مفهوم', () => {
    expect(orderLines({ items: [item()] }, {})[0].name).toBe('منتج لم يعد معروضًا');
  });

  it('النوع: الصندوق، المكتبة، أنت البطل، والمختلط', () => {
    const cat = { p1: 'custom', p2: 'library' };
    expect(orderKind({ items: [], boxPlanId: 'b1' }, cat)).toBe('box');
    expect(orderKind({ items: [item({ productId: 'p2' })] }, cat)).toBe('library');
    expect(orderKind({ items: [item()] }, cat)).toBe('custom');
    expect(orderKind({ items: [item(), item({ productId: 'p2' })] }, cat)).toBe('mixed');
  });

  it('إجمالي المنتجات: البنود × الكمية، والصندوق من سعر الخطة', () => {
    expect(orderSubtotal({ items: [item({ quantity: 2 })] } as Order)).toBe(600);
    expect(orderSubtotal({ items: [], boxPlanId: 'b', boxDetails: { plan: { price: 1200 } } } as never)).toBe(1200);
  });

  it('البحث بيلاقي الإضافة واسم الطفل والكود', () => {
    const lines = orderLines(
      { items: [item({ customizationData: { childName: 'ليلى', addons: [{ name: 'ميدالية', price: 80 }] } as never })] },
      { p1: 'أنت البطل' },
    );
    const t = orderSearchText(lines, ['RAMADAN10']);
    expect(t).toContain('ميدالية');
    expect(t).toContain('ليلى');
    expect(t).toContain('ramadan10');
  });
});
