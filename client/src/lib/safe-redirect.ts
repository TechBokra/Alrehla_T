/**
 * التحقق من مسار إعادة التوجيه الداخلي لمنع ثغرات Open Redirect.
 *
 * الشروط:
 * 1. يجب أن يبدأ المسار بشرطة مائلة واحدة '/'
 * 2. منع الروابط البروتوكولية النسبية '//' أو استخدام الشرطة المائلة العكسية '\'
 * 3. رفض أي روابط خارجية (http/https أو بروتوكولات أخرى)
 * 4. في حالة غياب القيمة أو عدم صلاحيتها يتم الرجوع للمسار الافتراضي '/'
 */
export function getSafeRedirectPath(path: string | null | undefined): string {
  if (!path || typeof path !== 'string') {
    return '/'
  }

  const trimmed = path.trim()

  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/'
  }

  try {
    const dummyOrigin = 'https://alrehla.local'
    const resolved = new URL(trimmed, dummyOrigin)

    if (resolved.origin !== dummyOrigin) {
      return '/'
    }

    if (!resolved.pathname.startsWith('/') || resolved.pathname.startsWith('//')) {
      return '/'
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return '/'
  }
}
