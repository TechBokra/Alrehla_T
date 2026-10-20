/**
 * عنوان الموقع — من غير أي استيراد، فبيتستعمل في الشاشات (المتصفح) والخادم.
 *
 * ⚠️ الصح إن `NEXT_PUBLIC_SITE_URL` يتظبط في Vercel على الدومين
 *    (`https://www.alrehla.org`). القيمة اللي تحت شبكة أمان بس.
 *    (كان `alrehlat.vercel.app` مكتوب بإيده في رسايل الدخول للمدربين.)
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alrehla.org').replace(/\/+$/, '');

/** النص المكتوب على العلامة المائية — الدومين من غير `www` (أقصر وأوضح). */
export const WATERMARK_TEXT = 'alrehla.org';
