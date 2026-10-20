import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserProfile } from '@/types';

/**
 * اختبارات الحُرّاس.
 *
 * ── ليه الملف ده موجود ──────────────────────────────────────
 *
 * قبله كان في المشروع 53 اختبارًا، كلهم على دوال حسابية نقية: الأسعار،
 * المواعيد، الصور، نصوص الصفحات. **ولا اختبار واحد على الصلاحيات** —
 * مع إن كل الثغرات اللي وقعت فعلًا كانت في الصلاحيات، مش في الحساب.
 *
 * الاختبارات دي **مش** بتختبر حماية قاعدة البيانات — دي مبتتجربش من
 * هنا، ولازم استعلام على القاعدة الحقيقية. اللي بتختبره: إن الطبقة
 * التانية في الكود بتفضل شغّالة، وإنها **بتفشل مقفولة** لما تقع.
 *
 * والاختبار الأهم في الملف هو `getDependentGuardian` عند فشل التحقق:
 * ده بالظبط العطل اللي عاش في الإنتاج — الحارس رجّع «مش تابع» عند
 * الفشل، فعدّى الطفل وكمّل طلبًا متكاملًا.
 */

const getCurrentUser = vi.fn();
const createClient = vi.fn();

vi.mock("@/data/domains/(shared)/auth/queries", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClient(),
}));

import {
  requireUser,
  requireAdmin,
  requireSuperAdmin,
  requireAnyAdmin,
  requireInstructor,
  requireNotDependent,
  getDependentGuardian,
} from '@/lib/auth-guard';

/** زائر: ده اللي `getCurrentUser` بترجّعه لما مفيش تسجيل دخول. */
const visitor: UserProfile = {
  id: 'visitor-user',
  fullName: 'زائر',
  email: '',
  role: 'visitor',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function user(overrides: Partial<UserProfile>): UserProfile {
  return {
    id: 'u-1',
    fullName: 'مستخدم',
    email: 'u@example.com',
    role: 'customer',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** عميل Supabase وهمي بردّ محدَّد على `rpc('my_dependent_link')`. */
function supabaseWithRpc(result: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(result) };
}

beforeEach(() => {
  getCurrentUser.mockReset();
  createClient.mockReset();
});

// ────────────────────────────────────────────────────────────
describe('requireUser', () => {
  it('يرفض الزائر', async () => {
    getCurrentUser.mockResolvedValue(visitor);
    await expect(requireUser()).rejects.toThrow('يجب تسجيل الدخول');
  });

  it('يقبل المستخدم المسجّل', async () => {
    getCurrentUser.mockResolvedValue(user({ role: 'customer' }));
    await expect(requireUser()).resolves.toMatchObject({ role: 'customer' });
  });
});

// ────────────────────────────────────────────────────────────
describe('requireAdmin', () => {
  it('يرفض العميل العادي', async () => {
    getCurrentUser.mockResolvedValue(user({ role: 'customer' }));
    await expect(requireAdmin('canManageCatalog')).rejects.toThrow();
  });

  it('يرفض المدرب', async () => {
    getCurrentUser.mockResolvedValue(user({ role: 'instructor' }));
    await expect(requireAdmin('canManageCatalog')).rejects.toThrow();
  });

  /**
   * ⚠️ ده اللي كسر `saveWritingPackage`: الدالة كانت بلا أي تحقق، فأي
   * حساب مسجّل يقدر يغيّر سعر باقة. الاختبار بيثبّت إن الدور وحده
   * مش كفاية — لازم الصلاحية نفسها.
   */
  it('يرفض المشرف اللي معهوش الصلاحية المطلوبة', async () => {
    getCurrentUser.mockResolvedValue(
      user({ role: 'general_supervisor', permissions: ['canManageSupport'] }),
    );
    await expect(requireAdmin('canManageCatalog')).rejects.toThrow();
  });

  it('يقبل المشرف اللي معاه الصلاحية', async () => {
    getCurrentUser.mockResolvedValue(
      user({ role: 'general_supervisor', permissions: ['canManageCatalog'] }),
    );
    await expect(requireAdmin('canManageCatalog')).resolves.toBeTruthy();
  });

  it('يرفض الزائر', async () => {
    getCurrentUser.mockResolvedValue(visitor);
    await expect(requireAdmin('canManageCatalog')).rejects.toThrow();
  });
});

// ────────────────────────────────────────────────────────────
describe('requireSuperAdmin', () => {
  it('يرفض المشرف العام حتى لو معاه كل الصلاحيات', async () => {
    getCurrentUser.mockResolvedValue(
      user({
        role: 'general_supervisor',
        permissions: ['canManageFinance', 'canManageUsers'],
      }),
    );
    await expect(requireSuperAdmin()).rejects.toThrow();
  });

  it('يقبل مدير النظام', async () => {
    getCurrentUser.mockResolvedValue(user({ role: 'super_admin' }));
    await expect(requireSuperAdmin()).resolves.toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────
describe('requireAnyAdmin', () => {
  it('يقبل لو معاه واحدة من الصلاحيات', async () => {
    getCurrentUser.mockResolvedValue(
      user({ role: 'general_supervisor', permissions: ['canManageInstructors'] }),
    );
    await expect(
      requireAnyAdmin(['canManageCatalog', 'canManageInstructors']),
    ).resolves.toBeTruthy();
  });

  it('يرفض لو معهوش ولا واحدة', async () => {
    getCurrentUser.mockResolvedValue(
      user({ role: 'general_supervisor', permissions: ['canManageSupport'] }),
    );
    await expect(
      requireAnyAdmin(['canManageCatalog', 'canManageInstructors']),
    ).rejects.toThrow();
  });
});

// ────────────────────────────────────────────────────────────
describe('requireInstructor', () => {
  it('يرفض غير المدرب', async () => {
    getCurrentUser.mockResolvedValue(user({ role: 'customer' }));
    await expect(requireInstructor()).rejects.toThrow('للمدربين فقط');
  });

  it('يرفض المدرب اللي مالوش ملف مدرب', async () => {
    getCurrentUser.mockResolvedValue(user({ role: 'instructor' }));
    createClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
      }),
    });
    await expect(requireInstructor()).rejects.toThrow('لا يوجد ملف مدرب');
  });

  it('يرجّع معرّف المدرب لما الملف موجود', async () => {
    getCurrentUser.mockResolvedValue(user({ role: 'instructor' }));
    createClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { id: 'ins-9' } }) }),
        }),
      }),
    });
    await expect(requireInstructor()).resolves.toMatchObject({
      instructorId: 'ins-9',
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('getDependentGuardian', () => {
  it('يرجّع ولي الأمر لما الحساب تابع', async () => {
    createClient.mockResolvedValue(
      supabaseWithRpc({
        data: [
          {
            child_profile_id: 'c-1',
            guardian_profile_id: 'g-1',
            full_name: 'طفل',
          },
        ],
        error: null,
      }),
    );
    await expect(getDependentGuardian('u-1')).resolves.toEqual({
      childId: 'c-1',
      guardianId: 'g-1',
      fullName: 'طفل',
    });
  });

  it('يرجّع null لما الحساب مش تابع (صفر صفوف بلا خطأ)', async () => {
    createClient.mockResolvedValue(supabaseWithRpc({ data: [], error: null }));
    await expect(getDependentGuardian('u-1')).resolves.toBeNull();
  });

  /**
   * ⚠️⚠️ **أهم اختبار في الملف.**
   *
   * ده العطل اللي عاش في الإنتاج: الكود كان بيستعلم `child_profiles`
   * مباشرةً، والطفل ممنوع منه بالصلاحيات، فالاستعلام بيرجع **صفر صفوف
   * بلا أي خطأ** — والدالة بترجّع `null`، والحارس يفهمها «ده مش حساب
   * تابع» **ويعدّيه**.
   *
   * يعني الحارس فشل **مفتوحًا**: شكله شغّال وهو ما اشتغلش ولا مرة.
   *
   * لو أي حد رجّع `null` هنا بدل ما يرمي، الاختبار ده بيوقعه. **ما
   * يتغيّرش عشان يعدّي** — التغيير نفسه هو العطل.
   */
  it('يرمي — ولا يرجّع null — لما التحقق نفسه يفشل', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createClient.mockResolvedValue(
      supabaseWithRpc({ data: null, error: { message: 'permission denied' } }),
    );
    await expect(getDependentGuardian('u-1')).rejects.toThrow(
      'تعذّر التحقق من نوع الحساب',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Error resolving dependent link',
      expect.objectContaining({ message: 'permission denied' }),
    );
    errorSpy.mockRestore();
  });
});

// ────────────────────────────────────────────────────────────
describe('requireNotDependent', () => {
  it('يمنع حساب الطفل التابع من الشراء', async () => {
    getCurrentUser.mockResolvedValue(user({ role: 'student' }));
    createClient.mockResolvedValue(
      supabaseWithRpc({
        data: [
          {
            child_profile_id: 'c-1',
            guardian_profile_id: 'g-1',
            full_name: 'طفل',
          },
        ],
        error: null,
      }),
    );
    await expect(requireNotDependent('الشراء')).rejects.toThrow(
      'موافقة ولي أمرك',
    );
  });

  it('يمرّر الحساب العادي', async () => {
    getCurrentUser.mockResolvedValue(user({ role: 'customer' }));
    createClient.mockResolvedValue(supabaseWithRpc({ data: [], error: null }));
    await expect(requireNotDependent('الشراء')).resolves.toMatchObject({
      role: 'customer',
    });
  });

  /**
   * الحارس بيفشل **مقفولًا**: لو التحقق نفسه وقع، العملية تقف — مش
   * تعدّي. النسخة القديمة كانت بتعدّي.
   */
  it('يوقف العملية لما التحقق يفشل', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getCurrentUser.mockResolvedValue(user({ role: 'student' }));
    createClient.mockResolvedValue(
      supabaseWithRpc({ data: null, error: { message: 'boom' } }),
    );
    await expect(requireNotDependent('الشراء')).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      'Error resolving dependent link',
      expect.objectContaining({ message: 'boom' }),
    );
    errorSpy.mockRestore();
  });

  it('يرفض الزائر قبل ما يسأل القاعدة أصلًا', async () => {
    getCurrentUser.mockResolvedValue(visitor);
    await expect(requireNotDependent('الشراء')).rejects.toThrow(
      'يجب تسجيل الدخول',
    );
    expect(createClient).not.toHaveBeenCalled();
  });
});
