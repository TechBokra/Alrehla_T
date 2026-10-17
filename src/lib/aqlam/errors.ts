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
  too_young: 'ده متاح من ١٢ سنة فأكبر.',
  not_editable: 'النص ده ما ينفعش يتعدّل دلوقتي (مخفي أو مشال).',
  pen_name_required: 'صفحتك العامة محتاجة اسم قلم. اكتبه الأول.',
  contact_info:
    'النص فيه بيانات تواصل (رقم تليفون أو بريد أو رابط أو اسم حساب). عشان أمان الكتّاب شيلها وجرّب تاني.',
  guardian_locked: 'ولي أمرك قفل ده من إعدادات أقلام الرحلة.',
  rate_limited: 'وصلت للحد اليومي المسموح. جرّب تاني بعد شوية.',
  not_found: 'العنصر ده مش موجود أو اتشال.',
  not_pending: 'القرار ده اتاخد قبل كده.',
  forbidden: 'مش مسموح لك بالإجراء ده.',
  comments_closed: 'التعليقات مقفولة على النص ده.',
  needs_admin_request:
    'قفل التعليقات بيتم بطلب للإدارة مع السبب. اكتب السبب واضغط «ابعت الطلب».',
  reason_required: 'اكتب السبب بالطول المطلوب علشان الإدارة تقدر تراجع الطلب.',
  already_pending: 'في طلب لسه بيستنى قرار الإدارة.',
  already_locked: 'التعليقات مقفولة بالفعل.',
  note_required: 'اكتب سبب الرفض علشان ولي الأمر يعرفه.',
  pin_limit: 'وصلت للحد الأقصى من النصوص المثبّتة. شيل تثبيت نص الأول.',
  not_published: 'التثبيت للنصوص المنشورة بس.',
  not_pinned: 'النص ده مش مثبّت.',
  comments_restricted: 'التعليق على نصوص الأصغر من ١٢ سنة للمدربين بس.',
  // لوحة الضبط (كل كود هنا بيرجع من دالة في القاعدة لما الإدارة تقفل حاجة).
  publishing_closed: 'النشر متوقف مؤقتًا. تقدر تقرأ وتشجّع زي العادة.',
  comments_off: 'التعليقات متوقفة مؤقتًا.',
  reactions_off: 'الملصقات متوقفة مؤقتًا.',
  reaction_disabled: 'الملصق ده مش متاح دلوقتي.',
  editing_closed: 'تعديل النصوص متوقف مؤقتًا.',
  removal_closed: 'شيل النصوص متوقف مؤقتًا. تواصل مع الدعم لو محتاج.',
  category_disabled: 'التصنيف ده مش متاح دلوقتي. اختار تصنيفًا تاني.',
  name_mode_disabled: 'طريقة عرض الاسم دي مش متاحة دلوقتي. اختار تانية.',
  blocked_word: 'النص فيه كلمات مش مناسبة للنشر. عدّل الصياغة وجرّب تاني.',
  writer_pages_closed: 'صفحات الكتّاب العامة متوقفة حاليًا.',
  config_invalid: 'في خانة قيمتها مش مظبوطة. راجع الخانات وجرّب تاني.',
  category_in_use: 'ما ينفعش تحذف تصنيفًا عليه نصوص — عطّله بدل الحذف.',
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
