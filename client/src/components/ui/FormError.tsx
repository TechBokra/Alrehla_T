import React from 'react';

/**
 * صندوق رسالة الخطأ — شكل واحد في كل الموقع.
 *
 * كان كل شاشة بتكتب `<div className="rounded-xl border border-red-200 …">`
 * بإيدها، فالشكل بيختلف من شاشة لشاشة، والأهم إن الشاشة اللي نسيت
 * تكتبه **بتسكت** عند الخطأ.
 *
 * ⚠️ `role="alert"` مهمّة: من غيرها المستخدم اللي بيستعمل قارئ صوتي
 *    مبيسمعش الرسالة خالص — الشاشة بتتغيّر وهو مش واخد باله. وده نفس
 *    عطل «الزر الصامت» بالظبط، بس لفئة تانية من الناس.
 */
export function FormError({
  message,
  className = '',
}: {
  /** نص الرسالة — فاضي يعني مفيش خطأ، والمكوّن مبيرسمش حاجة. */
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 ${className}`}
    >
      {message}
    </div>
  );
}

/**
 * رسالة نجاح — نفس المنطق بالعكس.
 *
 * `role="status"` مش `alert`: النجاح بيتقال من غير ما يقاطع اللي
 * المستخدم بيعمله.
 */
export function FormSuccess({
  message,
  className = '',
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;

  return (
    <div
      role="status"
      className={`rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 ${className}`}
    >
      {message}
    </div>
  );
}

/**
 * رسالة «تمّت، بس لسه ناقصها حاجة منك».
 *
 * ⚠️ مش أخضر ومش أحمر **عن قصد**. الحالة اللي المكوّن ده ليها هي
 *    العملية اللي نجحت والمستخدم لسه مطلوب منه خطوة — زي حساب اتعمل
 *    ومستني تأكيد بريد. الأخضر بيقول «خلاص» فالمستخدم بيقفل الصفحة،
 *    والأحمر بيقول «فشل» فبيعيد التسجيل من الأول ويعمل حساب تاني.
 */
export function FormNotice({
  message,
  className = '',
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;

  return (
    <div
      role="status"
      className={`rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 ${className}`}
    >
      {message}
    </div>
  );
}
