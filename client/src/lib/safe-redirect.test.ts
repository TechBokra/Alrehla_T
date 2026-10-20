import { describe, it, expect } from 'vitest'
import { getSafeRedirectPath } from './safe-redirect'

describe('getSafeRedirectPath', () => {
  it('يحافظ على المسارات الداخلية الصالحة', () => {
    expect(getSafeRedirectPath('/')).toBe('/')
    expect(getSafeRedirectPath('/account')).toBe('/account')
    expect(getSafeRedirectPath('/dashboard')).toBe('/dashboard')
    expect(getSafeRedirectPath('/dashboard/student')).toBe('/dashboard/student')
    expect(getSafeRedirectPath('/enha-lak')).toBe('/enha-lak')
    expect(getSafeRedirectPath('/bdayet-alrehla')).toBe('/bdayet-alrehla')
    expect(getSafeRedirectPath('/account?tab=orders')).toBe('/account?tab=orders')
    expect(getSafeRedirectPath('/profile#section')).toBe('/profile#section')
  })

  it('يرجع إلى / عند غياب قيمة next أو كونها فارغة', () => {
    expect(getSafeRedirectPath(undefined)).toBe('/')
    expect(getSafeRedirectPath(null)).toBe('/')
    expect(getSafeRedirectPath('')).toBe('/')
    expect(getSafeRedirectPath('   ')).toBe('/')
  })

  it('يرفض الروابط الخارجية الكاملة (HTTPS و HTTP)', () => {
    expect(getSafeRedirectPath('https://example.com')).toBe('/')
    expect(getSafeRedirectPath('https://example.com/dashboard')).toBe('/')
    expect(getSafeRedirectPath('http://example.com')).toBe('/')
    expect(getSafeRedirectPath('http://example.com/account')).toBe('/')
    expect(getSafeRedirectPath('https://evil.com')).toBe('/')
  })

  it('يرفض الروابط النسبية البروتوكولية (//example.com)', () => {
    expect(getSafeRedirectPath('//example.com')).toBe('/')
    expect(getSafeRedirectPath('//example.com/account')).toBe('/')
    expect(getSafeRedirectPath('///example.com')).toBe('/')
  })

  it('يرفض محاولات التجاوز بالشرطة المائلة العكسية والبروتوكولات الأخرى', () => {
    expect(getSafeRedirectPath('/\\example.com')).toBe('/')
    expect(getSafeRedirectPath('\\example.com')).toBe('/')
    expect(getSafeRedirectPath('javascript:alert(1)')).toBe('/')
    expect(getSafeRedirectPath('data:text/html,test')).toBe('/')
  })

  /**
   * التجاوزات المرمَّزة — أشهر طريقة لكسر فحص إعادة التوجيه.
   *
   * الفكرة إن المهاجم يكتب الشرطة المائلة بترميزها (`%2F`) أو الشرطة
   * العكسية (`%5C`) عشان يعدّي من فحص النص، ويعوّل على إن المتصفح
   * هيفكّ الترميز بعد كده ويقراها رابطًا خارجيًا.
   *
   * ⚠️ السلوك المطلوب إن الناتج يفضل **على نفس النطاق**: إما `/` وإما
   *    مسار داخلي بالترميز زي ما هو. لو يوم رجعت الدالة قيمة بتبدأ
   *    بـ`//` أو فيها نطاق تاني، يبقى الفحص اتكسر.
   */
  it('التجاوزات المرمَّزة تفضل داخل الموقع', () => {
    for (const attempt of [
      '/%5C%5Cevil.com',
      '/%2F%2Fevil.com',
      '/\t//evil.com',
      '/..//evil.com',
    ]) {
      const result = getSafeRedirectPath(attempt)
      expect(result.startsWith('/')).toBe(true)
      expect(result.startsWith('//')).toBe(false)
      expect(result).not.toContain('evil.com/')
      // `new URL(result, origin)` لازم تفضل على نفس النطاق.
      expect(new URL(result, 'https://alrehla.local').origin).toBe('https://alrehla.local')
    }
  })
})
