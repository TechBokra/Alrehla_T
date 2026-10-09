export const GA_MEASUREMENT_ID = 'G-953D3NL6LV'

/** Auth/private pages and their record IDs must not enter marketing analytics. */
export function isAnalyticsPage(pathname: string): boolean {
  const privateRoots = ['/dashboard', '/account', '/auth', '/forgot-password', '/reset-password', '/set-password', '/notifications']
  return !privateRoots.some(root => pathname === root || pathname.startsWith(`${root}/`))
}

/** Strip query strings/fragments: they may contain OAuth codes or customer data. */
export function analyticsUrl(value: string): string {
  try {
    const url = new URL(value)
    if (!isAnalyticsPage(url.pathname)) return url.origin
    return `${url.origin}${url.pathname}`
  } catch {
    return ''
  }
}
