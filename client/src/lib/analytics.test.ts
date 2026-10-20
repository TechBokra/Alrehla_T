import { describe, expect, it } from 'vitest'
import { analyticsUrl, GA_MEASUREMENT_ID, isAnalyticsPage } from './analytics'

describe('GA4 privacy boundaries', () => {
  it('uses the requested measurement ID', () => {
    expect(GA_MEASUREMENT_ID).toBe('G-953D3NL6LV')
  })
  it.each(['/', '/about', '/enha-lak/library', '/sign-in'])('tracks public page %s', path => {
    expect(isAnalyticsPage(path)).toBe(true)
  })
  it.each(['/dashboard', '/dashboard/admin/users', '/account/orders/123', '/auth/callback', '/reset-password', '/set-password', '/notifications'])('excludes private/auth page %s', path => {
    expect(isAnalyticsPage(path)).toBe(false)
  })
  it('strips codes, email addresses and hash tokens from URLs', () => {
    expect(analyticsUrl('https://www.alrehla.org/sign-in?code=secret&email=user@example.com#access_token=secret')).toBe('https://www.alrehla.org/sign-in')
  })
  it('handles an absent or invalid referrer', () => {
    expect(analyticsUrl('')).toBe('')
    expect(analyticsUrl('not a url')).toBe('')
  })
  it('does not disclose a private record ID through the referrer', () => {
    expect(analyticsUrl('https://www.alrehla.org/account/orders/customer-order-id')).toBe('https://www.alrehla.org')
  })
})
