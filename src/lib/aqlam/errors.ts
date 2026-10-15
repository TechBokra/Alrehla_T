/**
 * أكواد الأخطاء اللي بترجعها دوال القاعدة (`aqlam_*`) ← رسالة عربي للمستخدم.
 *
 * القاعدة بترجّع **كود** (مش جملة) عشان الواجهة هي اللي تختار الكلام.
 * كود مش معروف بيرجّع رسالة عامة — مش بنعرض نص القاعدة الخام.
 */

export const AQLAM_ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: 'سجّل دخولك الأول.',
  disabled: 'أقلام الرحلة مش متاحة دلوقتي.',
  suspended: 'حسابك موقوف عن أقلام الرحلة حاليًا.',
  invalid: 'في بيانات مش مظبوطة. راجع النموذج وجرّب تاني.',
  invalid_name: 'طريقة عرض الاسم دي مش متاحة، أو الاسم القلمي مش مظبوط.',
  invalid_source: 'المستند اللي اخترته مش تبعك.',
  invalid_birthdate: 'تاريخ الميلاد مش مظبوط.',
  birthdate_required: 'محتاجين تاريخ ميلادك مرة واحدة قبل أول نشر.',
  too_young: 'الحساب المستقل للنشر والتعليق من ١٢ سنة فأكبر.',
  contact_info:
    'النص فيه بيانات تواصل (رقم تليفون أو بريد أو رابط أو اسم حساب). عشان أمان الكتّاب شيلها وجرّب تاني.',
  guardian_locked: 'ولي أمرك قفل ده من إعدادات أقلام الرحلة.',
  rate_limited: 'وصلت للحد اليومي. جرّب تاني بكرة.',
  not_found: 'العنصر ده مش موجود أو اتشال.',
  not_pending: 'القرار ده اتاخد قبل كده.',
  forbidden: 'مش مسموح لك بالإجراء ده.',
  comments_closed: 'التعليقات مقفولة على النص ده.',
  comments_restricted: 'التعليق على نصوص الأصغر من ١٢ سنة للمدربين بس.',
};

export const AQLAM_GENERIC_ERROR = 'حصل خطأ غير متوقع. جرّب تاني بعد شوية.';

export function aqlamErrorMessage(code: unknown): string {
  return typeof code === 'string' && code in AQLAM_ERROR_MESSAGES
    ? AQLAM_ERROR_MESSAGES[code]
    : AQLAM_GENERIC_ERROR;
}

/** رد دالة القاعدة بعد التحقق من شكله. */
export type RpcOutcome =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string; error: string };

export function parseRpcResult(value: unknown): RpcOutcome {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if (v.ok === true) return { ok: true, data: v };
    const code = typeof v.error === 'string' ? v.error : 'unknown';
    return { ok: false, code, error: aqlamErrorMessage(code) };
  }
  return { ok: false, code: 'unknown', error: AQLAM_GENERIC_ERROR };
}
