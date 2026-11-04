import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * حراس شاشة الدفع — من بلاغ تامر (١٨ أكتوبر، بصورة الشاشة).
 *
 * تلات حاجات في نفس الشاشة، وكل واحدة منهم بتوصل لعميل دافع
 * آلاف الجنيهات:
 *
 *   ١. تنبيه «الصندوق بيتطلب لوحده» كان في **خطوة الدفع**، وهو
 *      كلام عن محتويات السلة.
 *   ٢. البند من غير صورة كان بيطلّع **أيقونة صورة مكسورة** —
 *      واشتراك الصندوق مالوش صورة منتج أصلًا.
 *   ٣. الزرار كان بيقول «واعرض بيانات التحويل» والبوابة شغّالة،
 *      والسطر الأزرق فوقه بسطرين بيقول إنه هيتحوّل لصفحة دفع.
 */

const SRC = '../app/(client)/enha-lak/checkout/CheckoutClient.tsx';

function read(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

/** بيشيل التعليقات — فيها نص عربي بيوصف العطل نفسه. */
function body(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('شاشة الدفع', () => {
  const src = body(read(SRC));

  it('⚠️ البند من غير صورة بيطلّع أيقونة، مش صورة مكسورة', () => {
    // `<Image>` لازم يبقى تحت شرط وجود الصورة.
    expect(src).toMatch(/item\.imageUrl\s*\?/);
    expect(src).toMatch(/<Package\b/);
    // وماينفعش `optimizedImageUrl` يتحطّ في `src` من غير الشرط.
    // `[\s\S]` بدل العلم `s` — الهدف في tsconfig أقدم منه.
    const imgLine = src.match(/<Image[^>]*optimizedImageUrl\([^)]*\)[\s\S]*?\/>/)?.[0] ?? '';
    expect(imgLine).not.toBe('');
    const before = src.slice(0, src.indexOf(imgLine));
    expect(before.slice(-200)).toMatch(/item\.imageUrl\s*\?/);
  });

  it('⚠️ نص الزرار بيتبع إعداد الدفع، مش مكتوب ثابت', () => {
    // ⚠️ من ٢٤ أكتوبر: زرار واحد — «ادفع X» مع البوابة.
    const btn = src.slice(src.indexOf('جارٍ تسجيل الطلب…'), src.indexOf('جارٍ تسجيل الطلب…') + 500);
    expect(btn).toContain('gateway');
    expect(btn).toContain('ادفع {formatPrice(grandTotal)}');
    expect(btn).toContain('سجّل الطلب واعرض بيانات التحويل');
  });

  it('⚠️ ضغطة واحدة: الزرار بيسجّل الطلب ويفتح صفحة الدفع على طول', () => {
    // «المتابعة للدفع» ← «سجّل وكمّل» ← «ادفع» بقوا ضغطة واحدة.
    expect(src).not.toContain('المتابعة للدفع');
    const submit = src.slice(src.indexOf('const handleShippingSubmit'), src.indexOf('const placeOrder'));
    expect(submit).toMatch(/placeOrder\(\)/);
    const place = src.slice(src.indexOf('const placeOrder'));
    expect(place).toMatch(/startGatewayPayment\(result\.orderId/);
    expect(place).toMatch(/window\.location\.assign\(pay\.url\)/);
  });

  it('⚠️ تنبيه الصندوق في ملخّص الطلب، مش في خطوة الدفع', () => {
    const notice = 'اشتراك صندوق الرحلة بيتطلب لوحده';
    expect(src).toContain(notice);
    // لازم يبقى **بعد** عنوان «ملخص الطلب» — يعني في الشريط الجانبي.
    expect(src.indexOf(notice)).toBeGreaterThan(src.indexOf('ملخص الطلب'));
    // ومابيبقاش مرتين.
    expect(src.split(notice).length - 1).toBe(1);
  });

  /**
   * ⚠️ الزرار المقفول لازم يقول هو مقفول ليه — في كل الحالات
   *    اللي بتقفله. `canContinue` ليها سطرها، و`mixedBox` كمان.
   */
  it('كل سبب بيقفل الزرار ليه سطر بيشرحه', () => {
    expect(src).toMatch(/!canContinue\s*&&/);
    expect(src).toMatch(/mixedBox\s*&&\s*\(/);
  });
});

describe('شاشة إعدادات الشحن في اللوحة', () => {
  const src = body(read('../app/(admin)/dashboard/admin/settings/shipping/ShippingRatesClient.tsx'));

  /**
   * ⚠️ بلاغ تامر «الشحن معطّل والطلب عدّى» — وسجل التدقيق بيقول
   *    إن التوصيل رجع يشتغل من ١٥ أكتوبر. المربّع المعلَّم اللي
   *    مادسّش عليه «حفظ» كان شكله زيّ المحفوظ بالظبط.
   */
  it('الحالة المحفوظة مكتوبة، والتغيير المش محفوظ بيتقال', () => {
    expect(src).toContain('الوضع الحالي على الموقع');
    expect(src).toContain('لسه مش محفوظ');
    expect(src).toMatch(/const dirty =/);
    expect(src).toMatch(/disabled=\{busy \|\| !dirty\}/);
  });
});
