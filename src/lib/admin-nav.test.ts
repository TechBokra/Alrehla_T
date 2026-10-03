import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_NAV, activeIn, navFor } from './admin-nav';

const all = navFor(() => true);
const hrefs = ADMIN_NAV.flatMap((g) => g.sections.flatMap((s) => s.tabs.map((t) => t.href)));

describe('قايمة لوحة الإدارة', () => {
  it('كل تبويب ليه صفحة فعلًا — مفيش رابط بيودّي على 404', () => {
    const missing = hrefs.filter(
      (h) => !existsSync(join(process.cwd(), 'src/app', h, 'page.tsx')),
    );
    expect(missing).toEqual([]);
  });

  it('مفيش رابط متكرّر في قسمين', () => {
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('القايمة الجانبية أقسام بس — مش كل شاشة', () => {
    const sections = all.flatMap((g) => g.sections);
    expect(sections.length).toBeLessThanOrEqual(16);
    expect(hrefs.length).toBeGreaterThan(sections.length);
  });

  it('الشاشة الداخلية بتعلّم قسمها، مش قسم لوحدها', () => {
    const a = activeIn(all, '/dashboard/admin/products/customization-fields');
    expect(a?.section.label).toBe('المنتجات');
    expect(a?.tab.label).toBe('خانات التخصيص');
    expect(activeIn(all, '/dashboard/admin/products/hero-order')?.section.id).toBe('products');
  });

  it('أطول رابط هو اللي بيكسب', () => {
    // طلب خدمة جوّه /orders — لازم «الخدمات الإبداعية» مش «طلبات المنتجات».
    const s = activeIn(all, '/dashboard/admin/orders/services/abc');
    expect(s?.section.id).toBe('services');
    expect(s?.tab.label).toBe('الطلبات');
    expect(activeIn(all, '/dashboard/admin/orders/xyz')?.section.id).toBe('orders');
    expect(activeIn(all, '/dashboard/admin/subscriptions/box/plans')?.tab.label).toBe('الخطط');
    expect(activeIn(all, '/dashboard/admin')).toBeNull();
  });

  it('التبويب الممنوع بيتشال، والقسم بيودّي لأول تبويب مسموح', () => {
    const onlyOrders = navFor((p) => p === 'canManageOrders');
    const sections = onlyOrders.flatMap((g) => g.sections);
    expect(sections.map((s) => s.id)).toEqual(['orders', 'services']);
    const services = sections.find((s) => s.id === 'services');
    expect(services?.href).toBe('/dashboard/admin/orders/services');
    expect(services?.tabs.map((t) => t.label)).toEqual(['الطلبات']);
    expect(navFor(() => false)).toEqual([]);
  });
});
