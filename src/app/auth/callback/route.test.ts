import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const exchangeCodeForSession = vi.fn()
const hasRecoverySession = vi.fn()

// Recovery is checked from a verified session, not an admin metadata flag.
vi.mock('@/lib/recovery-session', async () => ({
  hasRecoverySession: (...args: unknown[]) => hasRecoverySession(...args),
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
    hasRecoverySession.mockResolvedValue(true)
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

  it('checks recovery proof when the destination is reset-password', async () => {
    const request = new Request(
      'https://alrehla.app/auth/callback?code=test-code&next=/reset-password',
    )
    await GET(request)
    expect(hasRecoverySession).toHaveBeenCalledWith(expect.any(Object), 'user-1')
  })

  it('does not require recovery proof for ordinary sign-in destinations', async () => {
    const request = new Request(
      'https://alrehla.app/auth/callback?code=test-code&next=/dashboard/student',
    )
    await GET(request)
    expect(hasRecoverySession).not.toHaveBeenCalled()
  })

  it('does not check recovery proof when code exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('bad code') })
    const request = new Request(
      'https://alrehla.app/auth/callback?code=bad&next=/reset-password',
    )
    await GET(request)
    expect(hasRecoverySession).not.toHaveBeenCalled()
  })

  it('rejects a normal sign-in code with a forged recovery destination', async () => {
    hasRecoverySession.mockResolvedValue(false)
    const response = await GET(new Request('https://alrehla.app/auth/callback?code=normal&next=/reset-password'))
    expect(response.headers.get('location')).toBe('https://alrehla.app/auth/auth-code-error')
  })
})
