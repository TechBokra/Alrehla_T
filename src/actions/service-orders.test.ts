import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ⚠️ **عمليات طلبات الخدمة بترجّع ولا بترمي** (قاعدة «هـ»).
 *
 * Next بيمسح نصّ أي خطأ بيترمي من أكشن في الإنتاج — فالعميل ومقدّم
 * الخدمة والإدارة كانوا بيشوفوا رسالة إنجليزي عامة بدل السبب العربي.
 * الاختبارات دي بتثبّت إن كل طريق فشل **متوقَّع** بيرجع
 * `{ ok: false, error }` بالرسالة العربية، ومن غير أي أثر جانبي
 * (تحديث، إشعار، سجل تدقيق، مستحق).
 *
 * اختبارات «صفر صفوف» نفسها في `zero-row-mutations.test.ts` (الأقسام ٧–١١).
 */

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockLogAuditAction = vi.fn();
vi.mock('@/lib/audit', () => ({
  logAuditAction: (...args: unknown[]) => mockLogAuditAction(...args),
}));

const mockRequireAdmin = vi.fn();
const mockGetDependentGuardian = vi.fn();
vi.mock('@/lib/auth-guard', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  getDependentGuardian: (...args: unknown[]) => mockGetDependentGuardian(...args),
}));

/**
 * الدور بيتقرا من القاعدة عشان حساب الشغل مايطلبش (ملاحظة تامر ١٨
 * أكتوبر). الافتراضي هنا «عميل» — والاختبار بيغيّره لما يكون هو الموضوع.
 */
const mockGetCurrentUser = vi.fn();
vi.mock('@/data/domains/(shared)/auth/queries', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

const mockNotifyUser = vi.fn();
const mockNotifyAdmins = vi.fn();
const mockGetInstructorUserId = vi.fn();
const mockGetProviderUserId = vi.fn();
vi.mock('@/lib/notifications', () => ({
  notifyUser: (...args: unknown[]) => mockNotifyUser(...args),
  notifyAdmins: (...args: unknown[]) => mockNotifyAdmins(...args),
  getInstructorUserId: (...args: unknown[]) => mockGetInstructorUserId(...args),
  getProviderUserId: (...args: unknown[]) => mockGetProviderUserId(...args),
}));

let mockSupabase: any;
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(mockSupabase),
}));

import {
  createServiceOrder,
  sendServiceOrderMessage,
  deliverServiceOrder,
  confirmServiceOrderReceipt,
  confirmServiceOrderPayment,
  closeServiceOrderByAdmin,
  setServiceOrderDueDate,
  submitServiceOrderPayment,
} from '@/actions/service-orders';

/** سلسلة استعلام: كل دالة بترجع نفسها، والـ`await` بيرجّع النتيجة. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'eq', 'in', 'maybeSingle', 'single']) c[m] = vi.fn(() => c);
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return c;
}

type OrderRow = Record<string, unknown> | null;

/** قاعدة وهمية: صف طلب واحد، ونتيجة التحديث، ونتيجة إدراج الرسالة. */
function fakeDb({
  user = { id: 'buyer-1' } as { id: string } | null,
  order = null as OrderRow,
  updateResult = { data: [{ id: 'order-1' }], error: null } as unknown,
  insertResult = { error: null } as unknown,
  rpcResult = { data: null, error: null } as unknown,
  instructorRow = null as unknown,
} = {}) {
  const update = vi.fn(() => chain(updateResult));
  const insert = vi.fn(() => chain(insertResult));
  const rpc = vi.fn(() => Promise.resolve(rpcResult));
  const db = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'service_orders') return { select: vi.fn(() => chain({ data: order })), update };
      if (table === 'service_order_messages') return { insert };
      if (table === 'instructors') return { select: vi.fn(() => chain({ data: instructorRow })) };
      return { select: vi.fn(() => chain({ data: null })) };
    }),
  };
  return { db, update, insert, rpc };
}

const deliveredOrder = {
  id: 'order-1',
  buyer_profile_id: 'buyer-1',
  instructor_id: 'inst-1',
  status: 'delivered',
  amount: 500,
  instructor_earning: 400,
  standalone_service_id: 'svc-1',
};

const noSideEffects = () => {
  expect(mockNotifyUser).not.toHaveBeenCalled();
  expect(mockNotifyAdmins).not.toHaveBeenCalled();
  expect(mockLogAuditAction).not.toHaveBeenCalled();
  expect(mockRevalidatePath).not.toHaveBeenCalled();
};

describe('service-orders: الفشل المتوقَّع بيرجع نتيجة مش استثناء', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'u-1', role: 'customer' });
  });

  describe('createServiceOrder', () => {
    it('مش مسجَّل دخول ← { ok:false } بالرسالة العربية', async () => {
      mockSupabase = fakeDb({ user: null }).db;
      await expect(createServiceOrder({ serviceId: 'svc-1' })).resolves.toEqual({
        ok: false,
        error: 'يجب تسجيل الدخول أولاً',
      });
      noSideEffects();
    });

    it('حساب طفل تابع ← { ok:false } ومفيش إدراج', async () => {
      const { db, insert } = fakeDb();
      mockSupabase = db;
      mockGetDependentGuardian.mockResolvedValue({ childId: 'c', guardianId: 'g', fullName: 'x' });
      await expect(createServiceOrder({ serviceId: 'svc-1' })).resolves.toEqual({
        ok: false,
        error: 'طلب الخدمة محتاج موافقة ولي أمرك. كلّمه يعمله من حسابه.',
      });
      expect(insert).not.toHaveBeenCalled();
    });

    it('التحقق من نوع الحساب نفسه فشل (getDependentGuardian بترمي) ← { ok:false } بنفس الرسالة', async () => {
      mockSupabase = fakeDb().db;
      mockGetDependentGuardian.mockRejectedValue(new Error('تعذّر التحقق من نوع الحساب. جرّب تاني.'));
      await expect(createServiceOrder({ serviceId: 'svc-1' })).resolves.toEqual({
        ok: false,
        error: 'تعذّر التحقق من نوع الحساب. جرّب تاني.',
      });
    });

    it('فرد عائلة من غير اختيار ← { ok:false, field: childId }', async () => {
      mockSupabase = fakeDb().db;
      mockGetDependentGuardian.mockResolvedValue(null);
      await expect(
        createServiceOrder({ serviceId: 'svc-1', participantType: 'child', childId: null }),
      ).resolves.toEqual({ ok: false, error: 'اختار المستفيد من الخدمة', field: 'childId' });
    });

    /**
     * ⚠️ قرار تامر (١٨ أكتوبر): حساب الشغل مايطلبش بنفس الحساب.
     *    وأهم حالة: **مقدّم الخدمة بيطلب خدمة** — كان بيقدر يطلبها
     *    من نفسه، فيدفع لنفسه والعمولة تتحسب على معاملة مالهاش وجود.
     */
    it.each([
      ['service_provider', 'مقدّم خدمة'],
      ['instructor', 'مدرب'],
      ['general_supervisor', 'إداري'],
      ['super_admin', 'مدير نظام'],
      ['publisher', 'دار نشر'],
    ])('حساب %s ← { ok:false } ومفيش طلب', async (role, label) => {
      const { db, insert } = fakeDb();
      mockSupabase = db;
      mockGetDependentGuardian.mockResolvedValue(null);
      mockGetCurrentUser.mockResolvedValue({ id: 'u-1', role });

      const result = await createServiceOrder({ serviceId: 'svc-1' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toContain(label);
      // الرسالة بتقول الحل، مش «غير مصرح» وبس.
      expect(result.error).toContain('حساب جديد بإيميل تاني');
      expect(insert).not.toHaveBeenCalled();
      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });

    it('العميل والطالب مابيتأثروش', async () => {
      for (const role of ['customer', 'student']) {
        mockSupabase = fakeDb().db;
        mockGetDependentGuardian.mockResolvedValue(null);
        mockGetCurrentUser.mockResolvedValue({ id: 'u-1', role });
        const result = await createServiceOrder({ serviceId: 'svc-1' });
        // بيفشل لأسباب تانية (قاعدة وهمية) — المهم إنه مش رفض الدور.
        if (!result.ok) expect(result.error).not.toContain('حساب جديد بإيميل تاني');
      }
    });
  });

  describe('sendServiceOrderMessage', () => {
    it('رسالة فاضية ← { ok:false, field: body } ومفيش إدراج', async () => {
      const { db, insert } = fakeDb();
      mockSupabase = db;
      await expect(sendServiceOrderMessage('order-1', '   ')).resolves.toEqual({
        ok: false,
        error: 'اكتب رسالة أولاً',
        field: 'body',
      });
      expect(insert).not.toHaveBeenCalled();
      noSideEffects();
    });

    it('الإدراج فشل ← { ok:false } ومفيش إشعار', async () => {
      mockSupabase = fakeDb({ insertResult: { error: { message: 'rls' } } }).db;
      await expect(sendServiceOrderMessage('order-1', 'سلام')).resolves.toEqual({
        ok: false,
        error: 'تعذّر إرسال الرسالة',
      });
      noSideEffects();
    });
  });

  describe('deliverServiceOrder', () => {
    const inProgress = { ...deliveredOrder, status: 'in_progress' };

    it('حالة غلط (اتسلّم قبل كده) ← { ok:false } ومفيش تحديث', async () => {
      const { db, update } = fakeDb({
        user: { id: 'inst-user' },
        order: deliveredOrder,
        instructorRow: { id: 'inst-1' },
      });
      mockSupabase = db;
      await expect(deliverServiceOrder('order-1', 'رسالة تسليم طويلة كفاية')).resolves.toEqual({
        ok: false,
        error: 'لا يمكن التسليم في هذه الحالة',
      });
      expect(update).not.toHaveBeenCalled();
      noSideEffects();
    });

    it('رسالة تسليم قصيرة ← { ok:false, field: deliveryMessage } ومفيش تحديث', async () => {
      const { db, update } = fakeDb({
        user: { id: 'inst-user' },
        order: inProgress,
        instructorRow: { id: 'inst-1' },
      });
      mockSupabase = db;
      await expect(deliverServiceOrder('order-1', 'تم')).resolves.toEqual({
        ok: false,
        error: 'اكتب رسالة التسليم للعميل (ما الذي سلّمته وأين يجده)',
        field: 'deliveryMessage',
      });
      expect(update).not.toHaveBeenCalled();
    });

    it('رسالة التسليم ما اتحفظتش بعد التحديث ← { ok:false } والعميل مايتبلّغش «تم التسليم»', async () => {
      mockSupabase = fakeDb({
        user: { id: 'inst-user' },
        order: inProgress,
        instructorRow: { id: 'inst-1' },
        updateResult: { data: [{ id: 'order-1', status: 'delivered' }], error: null },
        insertResult: { error: { message: 'rls' } },
      }).db;
      await expect(deliverServiceOrder('order-1', 'رسالة تسليم طويلة كفاية')).resolves.toEqual({
        ok: false,
        error: 'تعذّر إرسال الرسالة',
      });
      expect(mockNotifyUser).not.toHaveBeenCalled();
    });
  });

  describe('confirmServiceOrderReceipt', () => {
    it('مش مسجَّل دخول ← { ok:false } ومفيش تحديث', async () => {
      const { db, update } = fakeDb({ user: null });
      mockSupabase = db;
      await expect(confirmServiceOrderReceipt('order-1')).resolves.toEqual({
        ok: false,
        error: 'يجب تسجيل الدخول أولاً',
      });
      expect(update).not.toHaveBeenCalled();
      noSideEffects();
    });

    it('الطلب مش موجود ← { ok:false, «الطلب غير موجود» }', async () => {
      mockSupabase = fakeDb({ order: null }).db;
      await expect(confirmServiceOrderReceipt('order-1')).resolves.toEqual({
        ok: false,
        error: 'الطلب غير موجود',
      });
    });

    it('فشل الإقفال في القاعدة ← { ok:false } ومفيش مستحق اتسجّل', async () => {
      const { db, rpc } = fakeDb({
        order: deliveredOrder,
        updateResult: { data: null, error: { message: 'db down' } },
      });
      mockSupabase = db;
      await expect(confirmServiceOrderReceipt('order-1')).resolves.toEqual({
        ok: false,
        error: 'تعذّر إقفال الطلب',
      });
      expect(rpc).not.toHaveBeenCalled();
      noSideEffects();
    });

    it('نجاح ← المستحق بيتسجّل مرة واحدة من القاعدة والمدرب بيتبلّغ', async () => {
      const { db, rpc } = fakeDb({ order: deliveredOrder });
      mockSupabase = db;
      mockGetInstructorUserId.mockResolvedValue('inst-user');
      await expect(confirmServiceOrderReceipt('order-1')).resolves.toEqual({ ok: true });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('record_service_order_earning', { p_order_id: 'order-1' });
      expect(mockNotifyAdmins).not.toHaveBeenCalled();
      expect(mockNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientProfileId: 'inst-user',
          message: 'تم تأكيد الاستلام، وأُضيفت حصيلتك إلى مستحقاتك.',
        }),
      );
    });
  });

  describe('عمليات الإدارة', () => {
    it('confirmServiceOrderPayment: مش إداري ← { ok:false } بالرسالة ومفيش تحديث', async () => {
      const { db, update } = fakeDb();
      mockSupabase = db;
      mockRequireAdmin.mockRejectedValue(new Error('غير مصرح لك بإدارة الطلبات'));
      await expect(confirmServiceOrderPayment('order-1')).resolves.toEqual({
        ok: false,
        error: 'غير مصرح لك بإدارة الطلبات',
      });
      expect(update).not.toHaveBeenCalled();
      noSideEffects();
    });

    it('confirmServiceOrderPayment: خطأ قاعدة ← { ok:false, «تعذّر تأكيد الدفع» }', async () => {
      mockSupabase = fakeDb({ updateResult: { data: null, error: { message: 'x' } } }).db;
      mockRequireAdmin.mockResolvedValue({ id: 'admin-1', fullName: 'Admin' });
      await expect(confirmServiceOrderPayment('order-1')).resolves.toEqual({
        ok: false,
        error: 'تعذّر تأكيد الدفع',
      });
      noSideEffects();
    });

    it('closeServiceOrderByAdmin: حالة غلط ← { ok:false } ومفيش إقفال ولا سجل', async () => {
      const { db, update, rpc } = fakeDb({ order: { ...deliveredOrder, status: 'in_progress' } });
      mockSupabase = db;
      mockRequireAdmin.mockResolvedValue({ id: 'admin-1', fullName: 'Admin' });
      await expect(closeServiceOrderByAdmin('order-1', 'سبب')).resolves.toEqual({
        ok: false,
        error: 'هذا الطلب ليس في حالة "تم التسليم"',
      });
      expect(update).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
      noSideEffects();
    });

    it('closeServiceOrderByAdmin: سبب فاضي ← { ok:false, field: reason }', async () => {
      mockSupabase = fakeDb({ order: deliveredOrder }).db;
      mockRequireAdmin.mockResolvedValue({ id: 'admin-1', fullName: 'Admin' });
      await expect(closeServiceOrderByAdmin('order-1', '  ')).resolves.toEqual({
        ok: false,
        error: 'اكتب سبب الإقفال',
        field: 'reason',
      });
    });

    it('closeServiceOrderByAdmin: صفر صفوف ← { ok:false } ومفيش مستحق ولا سجل تدقيق', async () => {
      const { db, rpc } = fakeDb({ order: deliveredOrder, updateResult: { data: [], error: null } });
      mockSupabase = db;
      mockRequireAdmin.mockResolvedValue({ id: 'admin-1', fullName: 'Admin' });
      await expect(closeServiceOrderByAdmin('order-1', 'العميل مابيردّش')).resolves.toEqual({
        ok: false,
        error: 'الطلب مش موجود أو تغيّرت حالته — الإقفال مروّحش للقاعدة.',
      });
      expect(rpc).not.toHaveBeenCalled();
      noSideEffects();
    });

    it('setServiceOrderDueDate: مش إداري ← { ok:false } بدل الرمي', async () => {
      const { db, update } = fakeDb();
      mockSupabase = db;
      mockRequireAdmin.mockRejectedValue(new Error('غير مصرح لك بإدارة الطلبات'));
      await expect(setServiceOrderDueDate('order-1', '2026-12-01', 'اتفاق')).resolves.toEqual({
        ok: false,
        error: 'غير مصرح لك بإدارة الطلبات',
      });
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('submitServiceOrderPayment', () => {
    it('مش مسجَّل دخول ← { ok:false } (كانت بترمي من loadOrderFor)', async () => {
      const { db, update } = fakeDb({ user: null });
      mockSupabase = db;
      await expect(
        submitServiceOrderPayment('order-1', {
          method: 'instapay',
          receiptUrl: 'private:jpg:alrehla/private/receipts/abc',
        }),
      ).resolves.toEqual({ ok: false, error: 'يجب تسجيل الدخول أولاً' });
      expect(update).not.toHaveBeenCalled();
      noSideEffects();
    });
  });
});
