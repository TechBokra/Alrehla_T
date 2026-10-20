import { beforeEach, describe, expect, it, vi } from 'vitest'
import { googleOAuthRedirect, signInWithGoogle } from './google-sign-in'

const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }))
vi.mock('./client', () => ({ createClient: () => ({ auth: { signInWithOAuth } }) }))

describe('Google OAuth', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset()
    signInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com/' }, error: null })
  })

  it('returns to localhost, rather than a hard-coded production origin', () => {
    const callback = new URL(googleOAuthRedirect('http://localhost:3000', '/account/orders/enha-lak'))
    expect(callback.origin).toBe('http://localhost:3000')
    expect(callback.pathname).toBe('/auth/callback')
    expect(callback.searchParams.get('next')).toBe('/account/orders/enha-lak')
  })

  it('defaults to the existing role-based dashboard router', () => {
    expect(new URL(googleOAuthRedirect('https://www.alrehla.org', null)).searchParams.get('next')).toBe('/dashboard')
  })

  it.each(['https://evil.example', '//evil.example', '/\\evil.example'])('rejects an external return path: %s', next => {
    expect(new URL(googleOAuthRedirect('http://localhost:3000', next)).searchParams.get('next')).toBe('/')
  })

  it('preserves a safe return path and its wizard step', () => {
    expect(new URL(googleOAuthRedirect('http://localhost:3000', '/enha-lak/custom/book?step=2')).searchParams.get('next')).toBe('/enha-lak/custom/book?step=2')
  })

  it('uses the cookie client and Google identity provider without inbox scopes', async () => {
    await signInWithGoogle('http://localhost:3000', null)
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback?next=%2Fdashboard',
        queryParams: { prompt: 'select_account' },
      },
    })
  })

  it('does not treat an OAuth error as a successful navigation', async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: 'provider disabled' } })
    await expect(signInWithGoogle('http://localhost:3000', null)).rejects.toThrow('تعذّر تسجيل الدخول')
  })

  it('rejects an empty redirect URL even without an SDK error', async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null })
    await expect(signInWithGoogle('http://localhost:3000', null)).rejects.toThrow('تعذّر تسجيل الدخول')
  })
})
