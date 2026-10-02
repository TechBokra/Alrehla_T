import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockLogAuditAction = vi.fn();
vi.mock('@/lib/audit', () => ({
  logAuditAction: (...args: unknown[]) => mockLogAuditAction(...args),
}));

const mockRequireAdmin = vi.fn();
const mockRequireSuperAdmin = vi.fn();
const mockRequireUser = vi.fn();
const mockGetDependentGuardian = vi.fn();
vi.mock('@/lib/auth-guard', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  requireSuperAdmin: (...args: unknown[]) => mockRequireSuperAdmin(...args),
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  getDependentGuardian: (...args: unknown[]) => mockGetDependentGuardian(...args),
}));

const mockGetCurrentUser = vi.fn();
vi.mock('@/data/domains/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  ALL_ADMIN_PERMISSIONS: [
    'canManageUsers',
    'canManageInstructors',
    'canManagePublishers',
    'canManageCatalog',
    'canManageSubscriptions',
    'canManageOrders',
    'canManageBookings',
    'canManageSupport',
    'canManageContent',
    'canManageFinance',
    'canViewAuditLogs',
  ],
}));

const mockNotifyUser = vi.fn();
const mockGetInstructorUserId = vi.fn();
const mockNotifyAdmins = vi.fn();
vi.mock('@/lib/notifications', () => ({
  notifyUser: (...args: unknown[]) => mockNotifyUser(...args),
  getInstructorUserId: (...args: unknown[]) => mockGetInstructorUserId(...args),
  notifyAdmins: (...args: unknown[]) => mockNotifyAdmins(...args),
}));

let mockSupabase: any;
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(mockSupabase),
}));

import { updateUserRole } from '@/actions/admin-users';
import { saveAdminRole, deleteAdminRole, assignAdminRole } from '@/actions/admin-permissions';
import { cancelDependentRequest } from '@/actions/dependent-requests';
import {
  markInstructorPayoutAsPaid,
  markPublisherPayoutAsPaid,
} from '@/actions/finance';
import { approveProfileUpdateRequest } from '@/actions/instructors';
import {
  setServiceOrderStatusByAdmin,
  startServiceOrder,
  deliverServiceOrder,
  confirmServiceOrderReceipt,
  confirmServiceOrderPayment,
} from '@/actions/service-orders';

describe('Zero-Row Mutation Hardening Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. updateUserRole (src/actions/admin-users.ts)', () => {
    it('returns success when row is successfully updated', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Super Admin',
        role: 'super_admin',
      });

      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: 'target-user-1' }, error: null });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      const result = await updateUserRole('target-user-1', 'general_supervisor');

      expect(result).toEqual({ ok: true });
      expect(fromMock).toHaveBeenCalledWith('user_profiles');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'general_supervisor' })
      );
      expect(eqMock).toHaveBeenCalledWith('id', 'target-user-1');
      expect(selectMock).toHaveBeenCalledWith('id');
      expect(mockLogAuditAction).toHaveBeenCalled();
    });

    it('بيكتب الدور الإداري مع «إداري»، ومابيلمسوش مع أي دور تاني', async () => {
      mockRequireAdmin.mockResolvedValue({ id: 'admin-1', fullName: 'Super Admin', role: 'super_admin' });
      const roleId = '22222222-2222-2222-2222-222222222222';

      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: 't' }, error: null });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockSupabase = { from: vi.fn().mockReturnValue({ update: updateMock }) };

      await updateUserRole('t', 'general_supervisor', roleId);
      expect(updateMock.mock.calls[0][0]).toMatchObject({ admin_role_id: roleId });

      await updateUserRole('t', 'general_supervisor', null);
      expect(updateMock.mock.calls[1][0]).toMatchObject({ admin_role_id: null });

      await updateUserRole('t', 'publisher', roleId);
      expect(updateMock.mock.calls[2][0]).not.toHaveProperty('admin_role_id');

      // رقم مش صالح = رفض، مش افتراضي في صمت.
      const bad = await updateUserRole('t', 'general_supervisor', 'not-a-uuid');
      expect(bad.ok).toBe(false);
      expect(updateMock).toHaveBeenCalledTimes(3);
    });

    it('returns failure when 0 rows are affected (no matching row)', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Super Admin',
        role: 'super_admin',
      });

      // maybeSingle returns null when 0 rows were updated
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      const result = await updateUserRole('non-existent-user', 'student');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('المستخدم غير موجود أو تعذّر تحديث دوره');
      }
      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });

    it('enforces authorization restriction (non-admin rejection)', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('غير مصرح لك بتعديل أدوار المستخدمين'));

      await expect(updateUserRole('target-user-1', 'student')).rejects.toThrow(
        'غير مصرح لك بتعديل أدوار المستخدمين'
      );
      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });
  });

  describe('2. الأدوار الإدارية (src/actions/admin-permissions.ts)', () => {
    const superAdmin = { id: 'super-admin-1', fullName: 'Super Admin', role: 'super_admin' };

    /** سلسلة Supabase وهمية: أي نداء بيرجّع نفسه، و`maybeSingle` بالنتيجة. */
    function mockChain(result: { data: unknown; error: unknown }) {
      const calls: Record<string, unknown[][]> = {};
      const chain: Record<string, unknown> = {};
      for (const m of ['update', 'insert', 'delete', 'eq', 'select']) {
        chain[m] = vi.fn((...args: unknown[]) => {
          (calls[m] ??= []).push(args);
          return chain;
        });
      }
      chain.maybeSingle = vi.fn().mockResolvedValue(result);
      const fromMock = vi.fn().mockReturnValue(chain);
      mockSupabase = { from: fromMock };
      return { fromMock, calls };
    }

    it('saveAdminRole: بيعدّل دور موجود وبينضّف التكرار والمسافات', async () => {
      mockGetCurrentUser.mockResolvedValue(superAdmin);
      const { fromMock, calls } = mockChain({ data: { id: 'role-1' }, error: null });

      const result = await saveAdminRole({
        id: 'role-1',
        name: '  محاسب   أول ',
        permissions: ['canManageFinance', 'canManageFinance', 'hack' as never],
      });

      expect(result).toEqual({ ok: true });
      expect(fromMock).toHaveBeenCalledWith('admin_roles');
      const row = calls.update[0][0] as { name: string; permissions: string[] };
      expect(row.name).toBe('محاسب أول');
      expect(row.permissions).toEqual(['canManageFinance']);
      expect(calls.eq[0]).toEqual(['id', 'role-1']);
      expect(mockLogAuditAction).toHaveBeenCalled();
    });

    it('saveAdminRole: صفر صفوف = فشل، مش «تم»', async () => {
      mockGetCurrentUser.mockResolvedValue(superAdmin);
      mockChain({ data: null, error: null });

      const result = await saveAdminRole({ id: 'x', name: 'محاسب', permissions: ['canManageFinance'] });

      expect(result.ok).toBe(false);
      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });

    it('saveAdminRole: الاسم المكرر بيرجع رسالة مفهومة', async () => {
      mockGetCurrentUser.mockResolvedValue(superAdmin);
      mockChain({ data: null, error: { code: '23505', message: 'duplicate' } });

      const result = await saveAdminRole({ name: 'محاسب', permissions: ['canManageFinance'] });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('بنفس الاسم');
    });

    it('saveAdminRole: بيرفض الاسم القصير والصلاحيات الفاضية من غير ما يكلّم القاعدة', async () => {
      mockGetCurrentUser.mockResolvedValue(superAdmin);
      const { fromMock } = mockChain({ data: { id: 'r' }, error: null });

      expect((await saveAdminRole({ name: 'ا', permissions: ['canManageFinance'] })).ok).toBe(false);
      expect((await saveAdminRole({ name: 'محاسب', permissions: [] })).ok).toBe(false);
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('كل الأكشنز لمدير النظام بس', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'supervisor-1',
        fullName: 'General Supervisor',
        role: 'general_supervisor',
      });
      const { fromMock } = mockChain({ data: { id: 'r' }, error: null });

      expect((await saveAdminRole({ name: 'محاسب', permissions: ['canManageFinance'] })).ok).toBe(false);
      expect((await deleteAdminRole('r')).ok).toBe(false);
      expect((await assignAdminRole({ userId: 'supervisor-1', adminRoleId: 'r' })).ok).toBe(false);
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('deleteAdminRole: مايمسحش الافتراضي (الشرط في الاستعلام نفسه)', async () => {
      mockGetCurrentUser.mockResolvedValue(superAdmin);
      const { calls } = mockChain({ data: null, error: null });

      const result = await deleteAdminRole('default-role');

      expect(result.ok).toBe(false);
      expect(calls.eq).toContainEqual(['is_default', false]);
    });

    it('assignAdminRole: للإداريين بس، والافتراضي بيتخزّن فاضي', async () => {
      mockGetCurrentUser.mockResolvedValue(superAdmin);
      const { calls } = mockChain({ data: { id: 'u1' }, error: null });

      const result = await assignAdminRole({ userId: 'u1', adminRoleId: null });

      expect(result).toEqual({ ok: true });
      expect((calls.update[0][0] as { admin_role_id: unknown }).admin_role_id).toBeNull();
      expect(calls.eq).toContainEqual(['role', 'general_supervisor']);
    });
  });

  describe('3. cancelDependentRequest (src/actions/dependent-requests.ts)', () => {
    it('returns success when pending request owned by child is successfully cancelled', async () => {
      mockRequireUser.mockResolvedValue({ id: 'child-user-1' });
      mockGetDependentGuardian.mockResolvedValue({
        childId: 'child-prof-1',
        guardianId: 'guardian-prof-1',
        fullName: 'الابن',
      });

      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: 'req-1' }, error: null });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqStatusMock = vi.fn().mockReturnValue({ select: selectMock });
      const eqChildMock = vi.fn().mockReturnValue({ eq: eqStatusMock });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqChildMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      const result = await cancelDependentRequest('req-1');

      expect(result).toEqual({ ok: true });
      expect(fromMock).toHaveBeenCalledWith('dependent_requests');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled' })
      );
      expect(eqIdMock).toHaveBeenCalledWith('id', 'req-1');
      expect(eqChildMock).toHaveBeenCalledWith('child_profile_id', 'child-prof-1');
      expect(eqStatusMock).toHaveBeenCalledWith('status', 'pending');
      expect(selectMock).toHaveBeenCalledWith('id');
    });

    it('returns failure when 0 rows are affected (request does not exist or not owned or not pending)', async () => {
      mockRequireUser.mockResolvedValue({ id: 'child-user-1' });
      mockGetDependentGuardian.mockResolvedValue({
        childId: 'child-prof-1',
        guardianId: 'guardian-prof-1',
        fullName: 'الابن',
      });

      // maybeSingle returns null when no matching row meets the criteria
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqStatusMock = vi.fn().mockReturnValue({ select: selectMock });
      const eqChildMock = vi.fn().mockReturnValue({ eq: eqStatusMock });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqChildMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      const result = await cancelDependentRequest('req-already-processed');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('الطلب مش موجود أو ولي أمرك بتّ فيه خلاص');
      }
    });

    it('does not succeed when request is not pending or not owned by child (query constraints verify zero rows)', async () => {
      mockRequireUser.mockResolvedValue({ id: 'child-user-1' });
      mockGetDependentGuardian.mockResolvedValue({
        childId: 'child-prof-1',
        guardianId: 'guardian-prof-1',
        fullName: 'الابن',
      });

      // Database returns null because status is approved/rejected or childId doesn't match
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqStatusMock = vi.fn().mockReturnValue({ select: selectMock });
      const eqChildMock = vi.fn().mockReturnValue({ eq: eqStatusMock });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqChildMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      const result = await cancelDependentRequest('approved-req-id');

      expect(result.ok).toBe(false);
      // Confirms all conditions are strictly chained
      expect(eqIdMock).toHaveBeenCalledWith('id', 'approved-req-id');
      expect(eqChildMock).toHaveBeenCalledWith('child_profile_id', 'child-prof-1');
      expect(eqStatusMock).toHaveBeenCalledWith('status', 'pending');
    });

    it('enforces unauthorized access when user is not a dependent', async () => {
      mockRequireUser.mockResolvedValue({ id: 'some-user' });
      mockGetDependentGuardian.mockResolvedValue(null);

      const result = await cancelDependentRequest('req-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('غير مصرح');
      }
    });
  });

  describe('4. markInstructorPayoutAsPaid (src/actions/finance.ts)', () => {
    it('returns success and records audit when earnings payout row is successfully updated', async () => {
      mockRequireSuperAdmin.mockResolvedValue({
        id: 'super-admin-1',
        fullName: 'Super Admin',
        role: 'super_admin',
      });

      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'payout-1', instructor_id: 'inst-1', amount: 500, status: 'paid' },
        error: null,
      });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      const result = await markInstructorPayoutAsPaid('payout-1');

      expect(result).toEqual({ success: true });
      expect(fromMock).toHaveBeenCalledWith('instructor_payouts');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'paid' })
      );
      expect(eqMock).toHaveBeenCalledWith('id', 'payout-1');
      expect(selectMock).toHaveBeenCalledWith('id, instructor_id, amount, status');
      expect(mockLogAuditAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'instructor_payout_marked_paid',
          entityId: 'payout-1',
          metadata: { instructorId: 'inst-1', amount: 500 },
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/admin/finance/instructor-payouts');
    });

    it('fails and prevents audit log when 0 rows are affected (no matching payout record)', async () => {
      mockRequireSuperAdmin.mockResolvedValue({
        id: 'super-admin-1',
        fullName: 'Super Admin',
        role: 'super_admin',
      });

      // 0 rows affected -> maybeSingle returns null
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      await expect(markInstructorPayoutAsPaid('non-existent-payout')).rejects.toThrow(
        'سجل الدفعة غير موجود أو تعذّر تحديثه'
      );

      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('enforces authorization rules (super admin required)', async () => {
      mockRequireSuperAdmin.mockRejectedValue(new Error('غير مصرح لك بإدارة المدفوعات'));

      await expect(markInstructorPayoutAsPaid('payout-1')).rejects.toThrow(
        'غير مصرح لك بإدارة المدفوعات'
      );

      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });

    it('enforces status/database error rules and does not record successful audit on database failure', async () => {
      mockRequireSuperAdmin.mockResolvedValue({
        id: 'super-admin-1',
        fullName: 'Super Admin',
        role: 'super_admin',
      });

      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' },
      });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      await expect(markInstructorPayoutAsPaid('payout-1')).rejects.toThrow('تعذّر تسجيل الدفع');
      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });
  });

  describe('5. markPublisherPayoutAsPaid (src/actions/finance.ts)', () => {
    it('returns success and records audit when earnings payout row is successfully updated', async () => {
      mockRequireSuperAdmin.mockResolvedValue({
        id: 'super-admin-1',
        fullName: 'Super Admin',
        role: 'super_admin',
      });

      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'pub-payout-1', publisher_id: 'pub-1', amount: 1200, status: 'paid' },
        error: null,
      });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      const result = await markPublisherPayoutAsPaid('pub-payout-1');

      expect(result).toEqual({ success: true });
      expect(fromMock).toHaveBeenCalledWith('publisher_payouts');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'paid' })
      );
      expect(eqMock).toHaveBeenCalledWith('id', 'pub-payout-1');
      expect(selectMock).toHaveBeenCalledWith('id, publisher_id, amount, status');
      expect(mockLogAuditAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'publisher_payout_marked_paid',
          entityId: 'pub-payout-1',
          metadata: { publisherId: 'pub-1', amount: 1200 },
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/admin/finance/publisher-payouts');
    });

    it('fails and prevents audit log when 0 rows are affected (no matching payout record)', async () => {
      mockRequireSuperAdmin.mockResolvedValue({
        id: 'super-admin-1',
        fullName: 'Super Admin',
        role: 'super_admin',
      });

      // 0 rows affected -> maybeSingle returns null
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      await expect(markPublisherPayoutAsPaid('non-existent-pub-payout')).rejects.toThrow(
        'سجل الدفعة غير موجود أو تعذّر تحديثه'
      );

      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('enforces authorization rules (super admin required)', async () => {
      mockRequireSuperAdmin.mockRejectedValue(new Error('غير مصرح لك بإدارة المدفوعات'));

      await expect(markPublisherPayoutAsPaid('pub-payout-1')).rejects.toThrow(
        'غير مصرح لك بإدارة المدفوعات'
      );

      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });

    it('enforces status/database error rules and does not record successful audit on database failure', async () => {
      mockRequireSuperAdmin.mockResolvedValue({
        id: 'super-admin-1',
        fullName: 'Super Admin',
        role: 'super_admin',
      });

      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' },
      });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      mockSupabase = { from: fromMock };

      await expect(markPublisherPayoutAsPaid('pub-payout-1')).rejects.toThrow('تعذّر تسجيل الدفع');
      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });
  });

  describe('6. approveProfileUpdateRequest (src/actions/instructors.ts)', () => {
    it('successfully updates instructor profile and then approves request', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });
      mockGetInstructorUserId.mockResolvedValue('user-inst-1');

      const instructorMaybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'inst-1' },
        error: null,
      });
      const instructorSelectMock = vi.fn().mockReturnValue({ maybeSingle: instructorMaybeSingleMock });
      const instructorEqMock = vi.fn().mockReturnValue({ select: instructorSelectMock });
      const instructorUpdateMock = vi.fn().mockReturnValue({ eq: instructorEqMock });

      const requestSelectSingleMock = vi.fn().mockResolvedValue({
        data: {
          id: 'req-1',
          instructor_id: 'inst-1',
          requested_changes: { bio: 'New bio', specialties: ['Writing'] },
          status: 'pending',
        },
        error: null,
      });
      const requestSelectEqMock = vi.fn().mockReturnValue({ single: requestSelectSingleMock });
      const requestSelectMock = vi.fn().mockReturnValue({ eq: requestSelectEqMock });

      const requestUpdateMaybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'req-1' },
        error: null,
      });
      const requestUpdateSelectMock = vi.fn().mockReturnValue({ maybeSingle: requestUpdateMaybeSingleMock });
      const requestUpdateEqMock = vi.fn().mockReturnValue({ select: requestUpdateSelectMock });
      const requestUpdateMock = vi.fn().mockReturnValue({ eq: requestUpdateEqMock });

      const fromMock = vi.fn((table: string) => {
        if (table === 'instructors') {
          return { update: instructorUpdateMock };
        }
        if (table === 'profile_update_requests') {
          return {
            select: requestSelectMock,
            update: requestUpdateMock,
          };
        }
        return {};
      });

      mockSupabase = { from: fromMock };

      const result = await approveProfileUpdateRequest('req-1');

      expect(result).toEqual({ success: true });
      expect(instructorUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bio: 'New bio',
          specialties: ['Writing'],
          updated_at: expect.any(String),
        })
      );
      expect(instructorEqMock).toHaveBeenCalledWith('id', 'inst-1');
      expect(requestUpdateMock).toHaveBeenCalledWith({ status: 'approved' });
      expect(requestUpdateEqMock).toHaveBeenCalledWith('id', 'req-1');
      expect(mockLogAuditAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'instructor_profile_update_approved',
          entityId: 'req-1',
          metadata: { instructorId: 'inst-1' },
        })
      );
      expect(mockNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientProfileId: 'user-inst-1',
          link: '/dashboard/instructor/profile',
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/admin/instructors/inst-1');
    });

    it('fails and does NOT approve request when instructor profile UPDATE affects zero rows', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      // 0 rows affected on instructor profile update
      const instructorMaybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const instructorSelectMock = vi.fn().mockReturnValue({ maybeSingle: instructorMaybeSingleMock });
      const instructorEqMock = vi.fn().mockReturnValue({ select: instructorSelectMock });
      const instructorUpdateMock = vi.fn().mockReturnValue({ eq: instructorEqMock });

      const requestSelectSingleMock = vi.fn().mockResolvedValue({
        data: {
          id: 'req-1',
          instructor_id: 'non-existent-inst',
          requested_changes: { bio: 'New bio' },
          status: 'pending',
        },
        error: null,
      });
      const requestSelectEqMock = vi.fn().mockReturnValue({ single: requestSelectSingleMock });
      const requestSelectMock = vi.fn().mockReturnValue({ eq: requestSelectEqMock });

      const requestUpdateMock = vi.fn();

      const fromMock = vi.fn((table: string) => {
        if (table === 'instructors') {
          return { update: instructorUpdateMock };
        }
        if (table === 'profile_update_requests') {
          return {
            select: requestSelectMock,
            update: requestUpdateMock,
          };
        }
        return {};
      });

      mockSupabase = { from: fromMock };

      await expect(approveProfileUpdateRequest('req-1')).rejects.toThrow(
        'التعديلات مروّحتش للقاعدة — ملف المدرب مش موجود أو الصلاحيات مش سامحة.'
      );

      // Invariant: Request must NEVER be marked as approved when instructor update affects 0 rows!
      expect(requestUpdateMock).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('fails and does NOT approve request when instructor profile UPDATE encounters a database error', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const instructorMaybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database failure' },
      });
      const instructorSelectMock = vi.fn().mockReturnValue({ maybeSingle: instructorMaybeSingleMock });
      const instructorEqMock = vi.fn().mockReturnValue({ select: instructorSelectMock });
      const instructorUpdateMock = vi.fn().mockReturnValue({ eq: instructorEqMock });

      const requestSelectSingleMock = vi.fn().mockResolvedValue({
        data: {
          id: 'req-1',
          instructor_id: 'inst-1',
          requested_changes: { bio: 'New bio' },
          status: 'pending',
        },
        error: null,
      });
      const requestSelectEqMock = vi.fn().mockReturnValue({ single: requestSelectSingleMock });
      const requestSelectMock = vi.fn().mockReturnValue({ eq: requestSelectEqMock });

      const requestUpdateMock = vi.fn();

      const fromMock = vi.fn((table: string) => {
        if (table === 'instructors') {
          return { update: instructorUpdateMock };
        }
        if (table === 'profile_update_requests') {
          return {
            select: requestSelectMock,
            update: requestUpdateMock,
          };
        }
        return {};
      });

      mockSupabase = { from: fromMock };

      await expect(approveProfileUpdateRequest('req-1')).rejects.toThrow('تعذّر تطبيق التعديلات');

      // Invariant: Request must NEVER be marked as approved on DB error
      expect(requestUpdateMock).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockNotifyUser).not.toHaveBeenCalled();
    });

    it('enforces authorization rules (canManageInstructors required)', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('غير مصرح لك بإدارة المدربين'));

      await expect(approveProfileUpdateRequest('req-1')).rejects.toThrow('غير مصرح لك بإدارة المدربين');
      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });

    it('enforces business validation: rejects when request is not found', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const requestSelectSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const requestSelectEqMock = vi.fn().mockReturnValue({ single: requestSelectSingleMock });
      const requestSelectMock = vi.fn().mockReturnValue({ eq: requestSelectEqMock });

      const fromMock = vi.fn((table: string) => {
        if (table === 'profile_update_requests') {
          return { select: requestSelectMock };
        }
        return {};
      });

      mockSupabase = { from: fromMock };

      await expect(approveProfileUpdateRequest('missing-req')).rejects.toThrow('الطلب غير موجود');
    });

    it('enforces business validation: rejects when request status is not pending', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const requestSelectSingleMock = vi.fn().mockResolvedValue({
        data: {
          id: 'req-1',
          instructor_id: 'inst-1',
          requested_changes: {},
          status: 'approved',
        },
        error: null,
      });
      const requestSelectEqMock = vi.fn().mockReturnValue({ single: requestSelectSingleMock });
      const requestSelectMock = vi.fn().mockReturnValue({ eq: requestSelectEqMock });

      const fromMock = vi.fn((table: string) => {
        if (table === 'profile_update_requests') {
          return { select: requestSelectMock };
        }
        return {};
      });

      mockSupabase = { from: fromMock };

      await expect(approveProfileUpdateRequest('req-1')).rejects.toThrow('تم البتّ في هذا الطلب من قبل');
    });
  });

  describe('7. setServiceOrderStatusByAdmin (src/actions/service-orders.ts)', () => {
    it('enforces authorization: requires admin with canManageOrders permission', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('غير مصرح لك بإدارة الطلبات'));

      await expect(
        setServiceOrderStatusByAdmin('order-1', 'cancelled', 'سبب الإلغاء')
      ).rejects.toThrow('غير مصرح لك بإدارة الطلبات');

      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('validates reason: rejects empty reason before checking order', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      await expect(
        setServiceOrderStatusByAdmin('order-1', 'cancelled', '   ')
      ).rejects.toThrow('اكتب السبب');

      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });

    it('validates existence: rejects non-existent order', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const orderMaybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const orderEqMock = vi.fn().mockReturnValue({ maybeSingle: orderMaybeSingleMock });
      const orderSelectMock = vi.fn().mockReturnValue({ eq: orderEqMock });

      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'service_orders') return { select: orderSelectMock };
          return {};
        }),
      };

      await expect(
        setServiceOrderStatusByAdmin('non-existent', 'cancelled', 'سبب الإلغاء')
      ).rejects.toThrow('الطلب غير موجود');

      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('prevents invalid transition: completed order cannot be cancelled or refunded', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const orderMaybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'order-1', status: 'completed', buyer_profile_id: 'buyer-1' },
        error: null,
      });
      const orderEqMock = vi.fn().mockReturnValue({ maybeSingle: orderMaybeSingleMock });
      const orderSelectMock = vi.fn().mockReturnValue({ eq: orderEqMock });

      const updateMock = vi.fn();

      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: orderSelectMock,
              update: updateMock,
            };
          }
          return {};
        }),
      };

      await expect(
        setServiceOrderStatusByAdmin('order-1', 'cancelled', 'إلغاء طلب')
      ).rejects.toThrow('لا يمكن إلغاء أو استرجاع طلب مكتمل');

      await expect(
        setServiceOrderStatusByAdmin('order-1', 'refunded', 'استرجاع طلب')
      ).rejects.toThrow('لا يمكن إلغاء أو استرجاع طلب مكتمل');

      expect(updateMock).not.toHaveBeenCalled();
      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('prevents invalid transition: already cancelled order cannot be cancelled again', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const orderMaybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'order-1', status: 'cancelled', buyer_profile_id: 'buyer-1' },
        error: null,
      });
      const orderEqMock = vi.fn().mockReturnValue({ maybeSingle: orderMaybeSingleMock });
      const orderSelectMock = vi.fn().mockReturnValue({ eq: orderEqMock });

      const updateMock = vi.fn();

      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: orderSelectMock,
              update: updateMock,
            };
          }
          return {};
        }),
      };

      await expect(
        setServiceOrderStatusByAdmin('order-1', 'cancelled', 'إلغاء مكرر')
      ).rejects.toThrow('الطلب ملغي بالفعل');

      expect(updateMock).not.toHaveBeenCalled();
      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('prevents invalid transition: already refunded order cannot be refunded or cancelled', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const orderMaybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'order-1', status: 'refunded', buyer_profile_id: 'buyer-1' },
        error: null,
      });
      const orderEqMock = vi.fn().mockReturnValue({ maybeSingle: orderMaybeSingleMock });
      const orderSelectMock = vi.fn().mockReturnValue({ eq: orderEqMock });

      const updateMock = vi.fn();

      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: orderSelectMock,
              update: updateMock,
            };
          }
          return {};
        }),
      };

      await expect(
        setServiceOrderStatusByAdmin('order-1', 'refunded', 'استرجاع مكرر')
      ).rejects.toThrow('تم استرجاع هذا الطلب بالفعل');

      await expect(
        setServiceOrderStatusByAdmin('order-1', 'cancelled', 'إلغاء بعد استرجاع')
      ).rejects.toThrow('تم استرجاع هذا الطلب بالفعل');

      expect(updateMock).not.toHaveBeenCalled();
      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('succeeds on valid cancellation transition from in_progress and executes status-guarded update', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const orderMaybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'order-1', status: 'in_progress', buyer_profile_id: 'buyer-1' },
        error: null,
      });
      const orderEqMock = vi.fn().mockReturnValue({ maybeSingle: orderMaybeSingleMock });
      const orderSelectMock = vi.fn().mockReturnValue({ eq: orderEqMock });

      const updateSelectMock = vi.fn().mockResolvedValue({
        data: [{ id: 'order-1' }],
        error: null,
      });
      const updateStatusEqMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ eq: updateStatusEqMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: orderSelectMock,
              update: updateMock,
            };
          }
          return {};
        }),
      };

      const result = await setServiceOrderStatusByAdmin('order-1', 'cancelled', 'العميل تراجع');

      expect(result).toEqual({ ok: true });
      expect(updateMock).toHaveBeenCalledWith({ status: 'cancelled' });
      expect(updateIdEqMock).toHaveBeenCalledWith('id', 'order-1');
      expect(updateStatusEqMock).toHaveBeenCalledWith('status', 'in_progress');
      expect(mockNotifyUser).toHaveBeenCalledWith({
        event: 'order_status',
        recipientProfileId: 'buyer-1',
        title: 'تم إلغاء طلبك',
        message: 'العميل تراجع',
        link: '/account/orders/creative-writing/order-1',
      });
      expect(mockLogAuditAction).toHaveBeenCalledWith({
        actorProfileId: 'admin-1',
        actorName: 'Admin User',
        action: 'service_order_cancelled',
        entityType: 'ServiceOrder',
        entityId: 'order-1',
        metadata: { reason: 'العميل تراجع' },
      });
      expect(mockRevalidatePath).toHaveBeenCalled();
    });

    it('succeeds on valid refund transition from paid and notifies buyer with refund title', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const orderMaybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'order-2', status: 'paid', buyer_profile_id: 'buyer-2' },
        error: null,
      });
      const orderEqMock = vi.fn().mockReturnValue({ maybeSingle: orderMaybeSingleMock });
      const orderSelectMock = vi.fn().mockReturnValue({ eq: orderEqMock });

      const updateSelectMock = vi.fn().mockResolvedValue({
        data: [{ id: 'order-2' }],
        error: null,
      });
      const updateStatusEqMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ eq: updateStatusEqMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: orderSelectMock,
              update: updateMock,
            };
          }
          return {};
        }),
      };

      const result = await setServiceOrderStatusByAdmin('order-2', 'refunded', 'استرجاع المبلغ');

      expect(result).toEqual({ ok: true });
      expect(updateMock).toHaveBeenCalledWith({ status: 'refunded' });
      expect(updateIdEqMock).toHaveBeenCalledWith('id', 'order-2');
      expect(updateStatusEqMock).toHaveBeenCalledWith('status', 'paid');
      expect(mockNotifyUser).toHaveBeenCalledWith({
        event: 'order_status',
        recipientProfileId: 'buyer-2',
        title: 'تم استرجاع طلبك',
        message: 'استرجاع المبلغ',
        link: '/account/orders/creative-writing/order-2',
      });
      expect(mockLogAuditAction).toHaveBeenCalledWith({
        actorProfileId: 'admin-1',
        actorName: 'Admin User',
        action: 'service_order_refunded',
        entityType: 'ServiceOrder',
        entityId: 'order-2',
        metadata: { reason: 'استرجاع المبلغ' },
      });
    });

    it('fails when update affects zero rows (concurrent status change) and prevents side effects', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const orderMaybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'order-1', status: 'paid', buyer_profile_id: 'buyer-1' },
        error: null,
      });
      const orderEqMock = vi.fn().mockReturnValue({ maybeSingle: orderMaybeSingleMock });
      const orderSelectMock = vi.fn().mockReturnValue({ eq: orderEqMock });

      // Zero rows affected due to concurrent status change or deletion
      const updateSelectMock = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const updateStatusEqMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ eq: updateStatusEqMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: orderSelectMock,
              update: updateMock,
            };
          }
          return {};
        }),
      };

      await expect(
        setServiceOrderStatusByAdmin('order-1', 'cancelled', 'إلغاء متزامن')
      ).rejects.toThrow('الطلب مش موجود أو تغيّرت حالته — التغيير مروّحش للقاعدة.');

      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('fails when database returns an error on update and prevents side effects', async () => {
      mockRequireAdmin.mockResolvedValue({
        id: 'admin-1',
        fullName: 'Admin User',
        role: 'admin',
      });

      const orderMaybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'order-1', status: 'paid', buyer_profile_id: 'buyer-1' },
        error: null,
      });
      const orderEqMock = vi.fn().mockReturnValue({ maybeSingle: orderMaybeSingleMock });
      const orderSelectMock = vi.fn().mockReturnValue({ eq: orderEqMock });

      const updateSelectMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection error' },
      });
      const updateStatusEqMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ eq: updateStatusEqMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: orderSelectMock,
              update: updateMock,
            };
          }
          return {};
        }),
      };

      await expect(
        setServiceOrderStatusByAdmin('order-1', 'cancelled', 'فشل قاعدة البيانات')
      ).rejects.toThrow('تعذّر تحديث حالة الطلب');

      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('8. startServiceOrder (src/actions/service-orders.ts)', () => {
    it('enforces authentication and assigned instructor authorization', async () => {
      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      };
      await expect(startServiceOrder('order-1')).rejects.toThrow('يجب تسجيل الدخول أولاً');

      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'other-user' } } }) },
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'order-1', instructor_id: 'inst-1', status: 'paid', buyer_profile_id: 'buyer-1' },
                  }),
                }),
              }),
            };
          }
          if (table === 'instructors') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      await expect(startServiceOrder('order-1')).rejects.toThrow('هذا الطلب ليس مسنَدًا إليك');
    });

    it('requires order to be in paid status', async () => {
      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'instructor-user' } } }) },
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'order-1', instructor_id: 'inst-1', status: 'pending', buyer_profile_id: 'buyer-1' },
                  }),
                }),
              }),
            };
          }
          if (table === 'instructors') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'inst-1' } }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      await expect(startServiceOrder('order-1')).rejects.toThrow('لا يمكن بدء التنفيذ قبل تأكيد الدفع');
    });

    it('succeeds on valid status transition with status guard in update', async () => {
      const updateSelectMock = vi.fn().mockResolvedValue({ data: [{ id: 'order-1' }], error: null });
      const updateStatusEqMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ eq: updateStatusEqMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'instructor-user' } } }) },
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'order-1', instructor_id: 'inst-1', status: 'paid', buyer_profile_id: 'buyer-1' },
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          if (table === 'instructors') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'inst-1' } }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await startServiceOrder('order-1');
      expect(result).toEqual({ ok: true });
      expect(updateMock).toHaveBeenCalledWith({ status: 'in_progress' });
      expect(updateIdEqMock).toHaveBeenCalledWith('id', 'order-1');
      expect(updateStatusEqMock).toHaveBeenCalledWith('status', 'paid');
      expect(mockNotifyUser).toHaveBeenCalledWith({
        event: 'order_status',
        recipientProfileId: 'buyer-1',
        title: 'بدأ تنفيذ طلبك',
        message: 'المدرب بدأ العمل على طلبك.',
        link: '/account/orders/creative-writing/order-1',
      });
      expect(mockRevalidatePath).toHaveBeenCalled();
    });

    it('fails when update affects zero rows (concurrent state change)', async () => {
      const updateSelectMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const updateStatusEqMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ eq: updateStatusEqMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'instructor-user' } } }) },
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'order-1', instructor_id: 'inst-1', status: 'paid', buyer_profile_id: 'buyer-1' },
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          if (table === 'instructors') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'inst-1' } }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      await expect(startServiceOrder('order-1')).rejects.toThrow('الطلب مش موجود أو تغيّرت حالته — التغيير مروّحش للقاعدة.');
      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('9. deliverServiceOrder (src/actions/service-orders.ts)', () => {
    it('aborts without inserting delivery message if update affects zero rows', async () => {
      const insertMessageMock = vi.fn();
      const updateSelectMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const updateInMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ in: updateInMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'instructor-user' } } }) },
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'order-1', instructor_id: 'inst-1', status: 'in_progress', buyer_profile_id: 'buyer-1' },
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          if (table === 'instructors') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'inst-1' } }),
                  }),
                }),
              }),
            };
          }
          if (table === 'service_order_messages') {
            return { insert: insertMessageMock };
          }
          return {};
        }),
      };

      await expect(
        deliverServiceOrder('order-1', 'هذا هو نص التسليم النهائي للمشروع المطلوب')
      ).rejects.toThrow('الطلب مش موجود أو تغيّرت حالته — التسليم مااتسجّلش.');

      // Atomic safety: message must NOT be inserted if status update failed
      expect(insertMessageMock).not.toHaveBeenCalled();
      expect(mockNotifyUser).not.toHaveBeenCalled();
    });

    it('succeeds: updates status first, then inserts delivery message and notifies buyer', async () => {
      const insertMessageMock = vi.fn().mockResolvedValue({ error: null });
      const updateSelectMock = vi.fn().mockResolvedValue({ data: [{ id: 'order-1' }], error: null });
      const updateInMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ in: updateInMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'instructor-user' } } }) },
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'order-1', instructor_id: 'inst-1', status: 'in_progress', buyer_profile_id: 'buyer-1' },
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          if (table === 'instructors') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'inst-1' } }),
                  }),
                }),
              }),
            };
          }
          if (table === 'service_order_messages') {
            return { insert: insertMessageMock };
          }
          return {};
        }),
      };

      const result = await deliverServiceOrder('order-1', 'هذا هو نص التسليم النهائي للمشروع المطلوب');
      expect(result).toEqual({ ok: true });
      expect(updateMock).toHaveBeenCalled();
      expect(updateIdEqMock).toHaveBeenCalledWith('id', 'order-1');
      expect(updateInMock).toHaveBeenCalledWith('status', ['in_progress', 'paid']);
      expect(insertMessageMock).toHaveBeenCalledWith({
        order_id: 'order-1',
        sender_profile_id: 'instructor-user',
        body: 'هذا هو نص التسليم النهائي للمشروع المطلوب',
        is_delivery: true,
      });
      expect(mockNotifyUser).toHaveBeenCalledWith({
        event: 'order_status',
        recipientProfileId: 'buyer-1',
        title: 'تم تسليم طلبك',
        message: 'راجع ما سلّمه المدرب وأكّد الاستلام.',
        link: '/account/orders/creative-writing/order-1',
      });
    });
  });

  describe('10. confirmServiceOrderReceipt & completeOrder (src/actions/service-orders.ts)', () => {
    it('enforces buyer ownership and delivered status', async () => {
      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'wrong-user' } } }) },
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'order-1', buyer_profile_id: 'real-buyer', status: 'delivered' },
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      await expect(confirmServiceOrderReceipt('order-1')).rejects.toThrow('هذا الطلب ليس طلبك');
    });

    it('rejects completion if order is not in delivered status', async () => {
      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'buyer-1' } } }) },
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'order-1', buyer_profile_id: 'buyer-1', status: 'in_progress' },
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      await expect(confirmServiceOrderReceipt('order-1')).rejects.toThrow('لم يُسلَّم هذا الطلب بعد');
    });

    it('fails when update affects zero rows (concurrent state change)', async () => {
      const updateSelectMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const updateStatusEqMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ eq: updateStatusEqMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'buyer-1' } } }) },
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'order-1', buyer_profile_id: 'buyer-1', status: 'delivered', amount: 500, instructor_id: 'inst-1' },
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          return {};
        }),
      };

      await expect(confirmServiceOrderReceipt('order-1')).rejects.toThrow(
        'الطلب مش موجود أو تغيّرت حالته — الإقفال مروّحش للقاعدة.'
      );
      expect(mockNotifyUser).not.toHaveBeenCalled();
    });

    /**
     * ⚠️ **العقد اتغيّر هنا عن قصد — اقرا قبل ما تعدّل.**
     *
     * الاختبار ده كان بيثبّت إن فشل تسجيل المستحق **بيرمي**. والرمي
     * كان غلط في محلّه: الطلب بيبقى `completed` فعلًا قبل السطر ده،
     * فالعميل كان يشوف رسالة خطأ على عملية **تمّت** — وميقدرش يعيد
     * المحاولة، لأن الإقفال مشروط بـ`status = 'delivered'`.
     *
     * الغرض الحقيقي من الاختبار مكتوب في سطره الأخير:
     * **المدرب مايتبلّغش بحصيلة مااتسجّلتش.** والعقد الجديد بيحافظ
     * على ده ويزوّد عليه:
     *
     *   • مبيرميش — العملية تمّت فعلًا
     *   • **بيبلّغ الإدارة** — دي الجهة اللي تقدر تصلّح
     *   • ورسالة المدرب بتتغيّر: «تحت المراجعة» مش «أُضيفت حصيلتك»
     *
     * ⚠️ لو رجّع حد الرسالة الثابتة «وأُضيفت حصيلتك إلى مستحقاتك»،
     *    الاختبار ده بيسقط. **ما يتغيّرش عشان يعدّي** — ده بالظبط
     *    الكذب اللي بيمنعه.
     */
    it('لا يرمي عند فشل تسجيل المستحق، وبيبلّغ الإدارة ومبيكدبش على المدرب', async () => {
      const updateSelectMock = vi.fn().mockResolvedValue({ data: [{ id: 'order-1' }], error: null });
      const updateStatusEqMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ eq: updateStatusEqMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'buyer-1' } } }) },
        // الدالة في القاعدة بترفض (مثلًا الصلاحيات أو عطل مؤقت).
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'permission denied for table instructor_payouts' },
        }),
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'order-1', buyer_profile_id: 'buyer-1', status: 'delivered', amount: 500, instructor_id: 'inst-1' },
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          return {};
        }),
      };

      // العملية تمّت — فمفيش رمي في وش العميل.
      await expect(confirmServiceOrderReceipt('order-1')).resolves.toEqual({ ok: true });

      // الإدارة لازم تعرف.
      expect(mockNotifyAdmins).toHaveBeenCalled();

      // والمدرب مايتقالوش إن حصيلته اتضافت.
      const messages = mockNotifyUser.mock.calls
        .map((call) => String((call[0] as { message?: string })?.message ?? ''))
        .join(' | ');
      expect(messages).not.toContain('وأُضيفت حصيلتك إلى مستحقاتك');
      expect(messages).toContain('تحت المراجعة');
    });
  });

  describe('11. confirmServiceOrderPayment (src/actions/service-orders.ts)', () => {
    it('enforces admin authorization and prevents confirming already paid/closed order', async () => {
      mockRequireAdmin.mockResolvedValue({ id: 'admin-1', fullName: 'Admin' });

      // Zero rows affected because status is already 'paid' or 'completed'
      const updateSelectMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const updateInMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const updateIdEqMock = vi.fn().mockReturnValue({ in: updateInMock });
      const updateMock = vi.fn().mockReturnValue({ eq: updateIdEqMock });

      mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'service_orders') {
            return { update: updateMock };
          }
          return {};
        }),
      };

      await expect(confirmServiceOrderPayment('order-1')).rejects.toThrow(
        'الطلب مش موجود أو تم تأكيد دفعه مسبقاً — التغيير مروّحش للقاعدة.'
      );

      expect(updateInMock).toHaveBeenCalledWith('status', ['pending', 'awaiting_verification']);
      expect(mockNotifyUser).not.toHaveBeenCalled();
      expect(mockLogAuditAction).not.toHaveBeenCalled();
    });
  });
});
