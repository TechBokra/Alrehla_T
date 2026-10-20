import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { accountMessage, greetByName, SIGN_IN_PATH } from './account-message';

/**
 * رسالة بيانات الحساب — الاختبارات دي على الحاجات اللي **وقعت فعلًا**،
 * مش على صياغة النص.
 */
describe('رسالة بيانات الحساب', () => {
  const parts = { code: 'KVxU-AtfY-3yHm', email: 'mona@example.com' };

  /**
   * الرسالة عربية (RTL) والرمز لاتيني (LTR). لو الرمز جه وسط سطر عربي
   * أو جابت نقطة وراه، ترتيبه البصري بيتبهدل والنقطة بتتنسخ معاه —
   * فالمستلم يدخل برمز غلط ويقول إن البيانات مش شغّالة.
   */
  it('الرمز في سطر لوحده ومفيش علامة بعده', () => {
    const lines = accountMessage(parts).split('\n');
    const line = lines.find((l) => l.includes(parts.code));
    expect(line).toBe(parts.code);
  });

  /**
   * الرمز هو كلمة مرور الحساب المؤقتة **ومالهاش مدة**؛ اللي بيبطّلها
   * إن صاحبه يحطّ كلمة مروره. فأي كلام عن وقت بينتهي = كذب على المستلم.
   */
  it('مفيش وعد بصلاحية بتنتهي بالوقت', () => {
    const msg = accountMessage(parts);
    for (const word of ['تنتهي', 'صلاحية', 'ساعة', 'ساعات', 'خلال 24']) {
      expect(msg).not.toContain(word);
    }
  });

  it('البريد والرمز في الرسالة، والرابط بيظهر لو اتبعت بس', () => {
    expect(accountMessage(parts)).toContain(parts.email);
    expect(accountMessage(parts)).not.toContain('رابط الدخول');
    expect(accountMessage({ ...parts, loginUrl: 'https://x.test/sign-in' })).toContain(
      'رابط الدخول: https://x.test/sign-in',
    );
  });

  it('الترحيب بالاسم، وبيرجع للمحايد لو الاسم فاضي', () => {
    expect(greetByName('منى')).toContain('منى');
    expect(greetByName('   ')).toBeUndefined();
    expect(greetByName(null)).toBeUndefined();
    expect(accountMessage(parts)).toContain('أهلًا بحضرتك');
  });
});

/**
 * ⚠️ **تلات شاشات كانت بتبعت `${SITE_URL}/login` — وهو مش موجود.**
 *    المسار `/sign-in`، فكل مدرب اتعمل له رمز من صفحته استلم رابط
 *    بيوديه على 404. الاختبار ده بيمنع رجوعه.
 */
describe('رابط الدخول في الرسالة', () => {
  it('المسار /sign-in ومفيش شاشة بتكتب /login', () => {
    expect(SIGN_IN_PATH).toBe('/sign-in');

    const screens = [
      'src/app/(admin)/dashboard/admin/users/UsersClient.tsx',
      'src/app/(admin)/dashboard/admin/users/[id]/AdminUserDetailClient.tsx',
      'src/app/(admin)/dashboard/admin/instructors/[id]/AdminInstructorClient.tsx',
      'src/app/(admin)/dashboard/admin/instructors/InstructorsClient.tsx',
      'src/app/(admin)/dashboard/admin/join-requests/[id]/JoinInstructorAccount.tsx',
      'src/components/dashboard/TempCodeBox.tsx',
    ];
    const offenders = screens.filter((f) => readFileSync(f, 'utf8').includes('/login'));
    expect(offenders).toEqual([]);
  });
});
