import { describe, it, expect } from 'vitest';
import { actionErrorOf, isControlFlowError } from './use-action';

/**
 * قراءة شكل نتيجة الأكشن.
 *
 * ── ليه ده يستاهل اختبارًا ──────────────────────────────────
 *
 * المشروع فيه **شكلان مختلطان** للنتيجة: `{ ok }` و`{ success }`.
 * ولو الدالة دي قرأت شكلًا منهم غلط، النتيجة مش خطأ في الشاشة —
 * النتيجة إن **الفشل بيعدّي كأنه نجاح**، والمستخدم يفتكر إن اللي
 * عمله اتحفظ وهو ما اتحفظش.
 *
 * وده أخطر من الزر الصامت: الزر الصامت بيخلّي المستخدم يحاول تاني،
 * أما النجاح الكاذب فبيخلّيه يمشي ومطمّن.
 */

describe('actionErrorOf — قراءة نتيجة الأكشن', () => {
  it('النجاح بشكل ok', () => {
    expect(actionErrorOf({ ok: true })).toBeNull();
    expect(actionErrorOf({ ok: true, orderId: 'x' })).toBeNull();
  });

  it('النجاح بشكل success', () => {
    expect(actionErrorOf({ success: true })).toBeNull();
  });

  it('الفشل بشكل ok بيطلّع الرسالة', () => {
    expect(actionErrorOf({ ok: false, error: 'العربة فاضية' })).toBe('العربة فاضية');
  });

  it('الفشل بشكل success بيطلّع الرسالة', () => {
    expect(actionErrorOf({ success: false, error: 'تعذّر الحفظ' })).toBe('تعذّر الحفظ');
  });

  it('فشل بلا رسالة بياخد نصًا بديلًا — مش فاضي', () => {
    // ⚠️ لو رجعت `''` هنا، `FormError` مش هترسم حاجة والزر يبقى
    //    صامتًا تاني — وده بالظبط اللي الخطاف موجود عشانه.
    const message = actionErrorOf({ ok: false });
    expect(message).toBeTruthy();
    expect(message).toContain('مشكلة');

    expect(actionErrorOf({ ok: false, error: '   ' })).toBeTruthy();
  });

  it('النتيجة اللي مش بالشكلين دول = نجاح', () => {
    // أكشنز بترجّع بيانات مباشرة، ودي مش فشل.
    expect(actionErrorOf(undefined)).toBeNull();
    expect(actionErrorOf(null)).toBeNull();
    expect(actionErrorOf(['a', 'b'])).toBeNull();
    expect(actionErrorOf({ id: '1', name: 'باقة' })).toBeNull();
  });

  it('الشكل التالت: { error } لوحده — وده شكل تسجيل الدخول', () => {
    // ⚠️ `signIn` و`signUp` في `actions/auth.ts` بيرجّعوا `{ error }`
    //    بلا `ok` ولا `success`. لو الشكل ده ما اتقراش، **فشل تسجيل
    //    الدخول بيعدّي كأنه نجاح** — المستخدم يفضل مكانه بلا سبب.
    expect(actionErrorOf({ error: 'Invalid login credentials' })).toBe(
      'Invalid login credentials',
    );
    expect(actionErrorOf({ error: '' })).toBeTruthy();
  });
});

describe('isControlFlowError — الانتقال مش عطل', () => {
  it('بيميّز انتقال Next', () => {
    // ⚠️ الأكشن اللي بينجح وبيودّي لصفحة تانية بيرمي استثناء.
    //    لو `useAction` بلعه، المستخدم هيشوف «حصلت مشكلة» على عملية
    //    **تمّت فعلًا** — فيعيدها، فيطلع طلب مكرر أو دفعة تانية.
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/dashboard;307;',
    });
    expect(isControlFlowError(redirectError)).toBe(true);

    const notFound = Object.assign(new Error('NEXT_NOT_FOUND'), {
      digest: 'NEXT_NOT_FOUND',
    });
    expect(isControlFlowError(notFound)).toBe(true);
  });

  it('العطل العادي مش انتقال', () => {
    expect(isControlFlowError(new Error('تعذّر الحفظ'))).toBe(false);
    expect(isControlFlowError({ digest: 'something-else' })).toBe(false);
    expect(isControlFlowError(null)).toBe(false);
    expect(isControlFlowError(undefined)).toBe(false);
    expect(isControlFlowError('نص')).toBe(false);
  });
});

describe('staleOrOffline', () => {
  it('الصفحة القديمة والانقطاع ليهم رسالة واضحة', async () => {
    const { staleOrOffline } = await import('./use-action');
    expect(staleOrOffline('Failed to find Server Action "abc". This request might be from an older or newer deployment.')).toContain('حدّث الصفحة');
    expect(staleOrOffline('Failed to fetch')).toContain('الاتصال');
    expect(staleOrOffline('An error occurred in the Server Components render')).toBeNull();
  });
});
