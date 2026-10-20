/** Restrict email redirects to application origins; never trust arbitrary Host headers. */
export function getAuthOrigin(origin: string | null, siteUrl: string): string {
  const fallback = new URL(siteUrl).origin;
  if (!origin) return fallback;
  try {
    const url = new URL(origin);
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return fallback;
    const trusted = new Set([fallback, 'https://alrehla.org', 'https://www.alrehla.org', 'https://alrehlat.vercel.app']);
    if (process.env.VERCEL_URL) trusted.add(`https://${process.env.VERCEL_URL}`);
    const local = process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return trusted.has(url.origin) || local ? url.origin : fallback;
  } catch {
    return fallback;
  }
}
