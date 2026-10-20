import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUYING_ROLES, staffPurchaseBlock } from './buying-roles';
import type { UserRole } from '@/types';

/** كل أدوار القاعدة — من `user_role_enum` في الأنواع المولّدة. */
const ALL_ROLES: UserRole[] = [
  'visitor',
  'customer',
  'student',
  'instructor',
  'publisher',
  'general_supervisor',
  'super_admin',
  'service_provider',
];

function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function read(rel: string): string {
  return strip(readFileSync(new URL(rel, import.meta.url), 'utf8'));
}

describe('staffPurchaseBlock', () => {
  it('العميل والطالب بيطلبوا', () => {
    expect(staffPurchaseBlock('customer')).toBeNull();
    expect(staffPurchaseBlock('student')).toBeNull();
  });

  it('الزائر بيتعامل معاه حارس الدخول، مش ده', () => {
    expect(staffPurchaseBlock('visitor')).toBeNull();
    expect(staffPurchaseBlock(null)).toBeNull();
    expect(staffPurchaseBlock(undefined)).toBeNull();
  });

  it('أدوار الشغل كلها بتترفض، وكل واحد باسمه', () => {
    const expected: Record<string, string> = {
      instructor: 'مدرب',
      service_provider: 'مقدّم خدمة',
      publisher: 'دار نشر',
      general_supervisor: 'إداري',
      super_admin: 'مدير نظام',
    };
    for (const [role, label] of Object.entries(expected)) {
      const block = staffPurchaseBlock(role as UserRole);
      expect(block, role).not.toBeNull();
      expect(block?.label, role).toBe(label);
      // الرسالة بتقول الحل — مش «غير مصرح لك».
      expect(block?.message, role).toContain('حساب جديد بإيميل تاني');
      expect(block?.message, role).toContain(label);
    }
  });

  /**
   * ⚠️ **الحارس بالاستبعاد مش بقايمة منع.** الاختبار ده بيمسك اليوم
   *    اللي حد يضيف دورًا جديدًا في القاعدة: لو كان بقايمة منع، الدور
   *    الجديد كان هيشتري بالسكوت. كده بيترفض لحد ما حد يقرّر.
   */
  it('أي دور مش في قايمة الشراء بيترفض — بما فيه دور ماتعرفناهوش', () => {
    for (const role of ALL_ROLES) {
      const allowed = role === 'visitor' || BUYING_ROLES.includes(role);
      expect(staffPurchaseBlock(role) === null, role).toBe(allowed);
    }
    expect(staffPurchaseBlock('translator' as UserRole)).not.toBeNull();
  });
});

/**
 * ── الحارس موصّل فعلًا ──────────────────────────────────────
 *
 * ⚠️ الدرس من `dependent-guard.test.ts`: اختبار بيدوّر على الاسم
 *    بس بيفضل ناجح بعد ما الحارس يتشال — الاسم بيعيش في سطر
 *    الاستيراد. فبندوّر على **النداء**.
 */
describe('الحارس موصّل في كل طريق شراء', () => {
  it('requireBuyer بيفحص الدور (طلبات المنتجات والصندوق والحجز)', () => {
    const src = read('./auth-guard.ts');
    expect(src).toMatch(/blockIfStaffAccount\s*\(/);
    expect(src).toMatch(/staffPurchaseBlock\s*\(/);
    // ولازم يبقى **جوّه** requireBuyer، مش معرَّف وبس.
    const body = src.slice(src.indexOf('export async function requireBuyer'));
    expect(body.slice(0, 300)).toMatch(/blockIfStaffAccount\s*\(/);
  });

  it('createServiceOrder بيفحص الدور', () => {
    const src = read('../actions/service-orders.ts');
    expect(src).toMatch(/staffPurchaseBlock\s*\(/);
  });

  it('requireShopper بيحوّل حساب الشغل قبل المعالج', () => {
    const src = read('./require-shopper.ts');
    expect(src).toMatch(/staffPurchaseBlock\s*\(/);
    expect(src).toContain('/enha-lak/staff-account');
  });

  it('صفحة الطلب وصفحة الحجز بيعرضوا الشرح مكان النموذج', () => {
    for (const rel of [
      '../app/(client)/creative-writing/services/[serviceId]/order/page.tsx',
      '../app/(client)/creative-writing/booking/page.tsx',
    ]) {
      const src = read(rel);
      expect(src, rel).toMatch(/staffPurchaseBlock\s*\(/);
      expect(src, rel).toMatch(/<StaffAccountNotice/);
    }
  });

  /**
   * ⚠️ والمحفّز في القاعدة هو الحارس الحقيقي — الكود بيدّي الرسالة
   *    بس. الملف لازم يفضل موجود عشان أي قاعدة جديدة تتبني بيه.
   */
  it('ملف الترحيل اللي بيقفل الباب في القاعدة موجود', () => {
    const sql = readFileSync(
      new URL('../../supabase/migrations/20261018120000_staff_accounts_do_not_buy.sql', import.meta.url),
      'utf8',
    );
    expect(sql).toContain('block_suspended_purchase');
    expect(sql).toMatch(/NOT IN \('customer', 'student', 'visitor'\)/);
    // والترحيل مابيمسحش ولا بيعدّل بيانات.
    expect(sql).not.toMatch(/\b(drop|delete|truncate|update)\s+(table|from|only)?/i);
  });
});
