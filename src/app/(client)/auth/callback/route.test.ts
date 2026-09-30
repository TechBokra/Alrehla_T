import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const exchangeCodeForSession = vi.fn()
const markRecoverySession = vi.fn()

// ⚠️ العلامة دي هي اللي بتخلّي صفحة الاسترجاع ما تطلبش من الشخص
//    كلمة المرور الحالية — وهو ناسيها أصلًا. الاختبارات تحت بتحرس
//    إنها بتتحطّ في الاسترجاع **وبس**.
vi.mock('@/lib/password-reset-flag', async () => ({
  RECOVERY_PATH: '/reset-password',
  markRecoverySession: (...args: unknown[]) => markRecoverySession(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args),
      },
    }),
}))

describe('Auth Callback Route GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    exchangeCodeForSession.mockResolvedValue({
      error: null,
      data: { user: { id: 'user-1' } },
    })
  })

  it('يعيد التوجيه إلى المسار الداخلي الصالح عند نجاح تسجيل الدخول', async () => {
    const request = new Request(
      'https://alrehla.app/auth/callback?code=test-code&next=/dashboard/student',
    )
    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://alrehla.app/dashboard/student',
    )
  })

  it('يرجع إلى / عند غياب قيمة next', async () => {
    const request = new Request(
      'https://alrehla.app/auth/callback?code=test-code',
    )
    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://alrehla.app/')
  })

  it('يرفض رابط HTTPS خارجي ويرجع إلى /', async () => {
    const request = new Request(
      'https://alrehla.app/auth/callback?code=test-code&next=https://evil.com',
    )
    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://alrehla.app/')
  })

  it('يرفض رابط //example.com ويرجع إلى /', async () => {
    const request = new Request(
      'https://alrehla.app/auth/callback?code=test-code&next=//evil.com',
    )
    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://alrehla.app/')
  })

  it('يعيد التوجيه إلى صفحة الخطأ عند فشل استبدال الكود', async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: 'invalid code' },
    })
    const request = new Request(
      'https://alrehla.app/auth/callback?code=bad-code&next=/account',
    )
    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://alrehla.app/auth/auth-code-error',
    )
  })

  it('⚠️ بيعلّم الجلسة لما الوجهة تكون صفحة الاسترجاع', async () => {
    const request = new Request(
      'https://alrehla.app/auth/callback?code=test-code&next=/reset-password',
    )
    await GET(request)
    expect(markRecoverySession).toHaveBeenCalledWith('user-1')
  })

  it('⚠️ ومابيعلّمش أي وجهة تانية', async () => {
    // لو العلامة اتحطّت في أي دخول عادي، تغيير كلمة المرور هيبقى
    // بلا طلب للكلمة الحالية — يعني الحاجز كله يتفتح.
    const request = new Request(
      'https://alrehla.app/auth/callback?code=test-code&next=/dashboard/student',
    )
    await GET(request)
    expect(markRecoverySession).not.toHaveBeenCalled()
  })

  it('⚠️ ومابيعلّمش لما استبدال الكود يفشل', async () => {
    // كود غلط بيروح لصفحة الخطأ ومفيش حاجة بتتعلّم — ده اللي
    // بيمنع أي حد إنه يعلّم جلسته بنفسه.
    exchangeCodeForSession.mockResolvedValue({ error: new Error('bad code') })
    const request = new Request(
      'https://alrehla.app/auth/callback?code=bad&next=/reset-password',
    )
    await GET(request)
    expect(markRecoverySession).not.toHaveBeenCalled()
  })
})
