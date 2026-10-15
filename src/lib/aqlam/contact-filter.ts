/**
 * فلتر بيانات التواصل — بيمنع نشر رقم تليفون أو بريد أو رابط أو حساب في
 * نص أو تعليق.
 *
 * ── ليه موجود ───────────────────────────────────────────────
 *
 * «أقلام الرحلة» بيكتب فيها أطفال ويافعين، وبيقراها ناس مجهولة. أسهل طريقة
 * للإضرار بيهم إن حد يكتب رقمه أو حسابه في تعليق، أو إن طفل ينشر رقم أمه.
 * مفيش رسايل خاصة في المنصة أصلًا، فالنص العام هو الباب الوحيد.
 *
 * ── الحيل اللي بيمسكها ──────────────────────────────────────
 *
 *  • أرقام عربية هندية (٠١٠…) وفارسية.
 *  • أرقام مفصولة بمسافات أو شرط أو نقط («٠١٠ ١٢٣ ٤٥٦ ٧٨»).
 *  • أرقام مكتوبة حروف («صفر واحد صفر اتنين…»).
 *  • تشكيل وتطويل بين الحروف («واتــساب»).
 *  • بريد مموّه («name (at) mail dot com»).
 *
 * ⚠️ **ده فلتر مش درع.** حد مصمّم هيلاقي طريقة. وظيفته يمنع الغلطة
 *    العفوية والمحاولة الكسولة، والباقي بلاغات + إخفاء سريع. ولذلك فيه
 *    نسخة مبسّطة منه في القاعدة (`aqlam_contains_contact`) كشبكة أمان لو
 *    حد كلّم الدالة مباشرة من غير الواجهة.
 *
 * ⚠️ **وتفادي الإنذار الكاذب مقصود:** «في ٢٠٢٤ ٢٠٢٥ ٢٠٢٦» مش رقم تليفون.
 *    رفض نص سليم بيخسّر كاتب — فالسنين المفصولة بتتستثنى.
 */

export type ContactKind = 'phone' | 'email' | 'link' | 'handle' | 'invite';

export type ContactCheck =
  | { ok: true }
  | { ok: false; kinds: ContactKind[]; message: string };

export const CONTACT_BLOCKED_MESSAGE =
  'النص فيه بيانات تواصل (رقم تليفون أو بريد أو رابط أو اسم حساب). عشان أمان الكتّاب شيلها وجرّب تاني.';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** تطبيع للفحص بس — النص المخزّن بيفضل زي ما كُتب. */
export function normalizeForScan(input: string): string {
  return (
    input
      .normalize('NFKC')
      // الأرقام العربية الهندية والفارسية ← لاتيني
      .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      // التشكيل والتطويل وعلامات الاتجاه والأحرف غير المرئية
      .replace(/[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
      // توحيد الحروف المتشابهة عشان المقارنة بالكلمات
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .toLowerCase()
  );
}

/** أرقام مكتوبة حروف — كل كلمة رقم واحد. */
const DIGIT_WORDS = new Set([
  'صفر', 'زيرو', 'واحد', 'واحده', 'اتنين', 'اثنين', 'تنين', 'تلاته', 'ثلاثه', 'تلات',
  'اربعه', 'اربع', 'خمسه', 'خمس', 'سته', 'ست', 'سبعه', 'سبع', 'تمانيه', 'ثمانيه', 'تمن',
  'تسعه', 'تسع',
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
]);

/** كلمات «تواصل معايا» اللي بتخلّي ذكر تطبيق = دعوة للتواصل. */
const INVITE_INTENT =
  /(كلمني|كلمنا|ضيفني|ضيفوني|راسلني|راسلوني|تواصل معي|تواصلوا معي|تواصل معايا|ابعتلي|ابعت لي|ابعتوا لي|رقمي|حسابي|اتصل بي|اتصلوا بي|اضفني|dm me|add me|text me|contact me|message me|my number|my account)/;

const APP_NAMES =
  /(واتس|whats|تليجرام|تلجرام|telegram|انستا|instagram|insta|سناب|snap|تيك توك|تيكتوك|tiktok|ديسكورد|discord|فيسبوك|facebook|ماسنجر|messenger|سيجنال|signal)/;

/** أرقام تليفون: متصلة (٨+) أو مفصولة بفواصل (٩+) ما لم تكن كلها سنين. */
function hasPhone(text: string): boolean {
  if (/\d{8,}/.test(text)) return true;

  // مجموعات أرقام بينها فاصل أو اتنين («٠١٠ ١٢٣ ٤٥٦ ٧٨» / «٠١٠ - ١٢٣»).
  const runs = text.match(/\d+(?:[\s.\-_/()·،,]{1,3}\d+)+/g) ?? [];
  for (const run of runs) {
    const groups = run.match(/\d+/g) ?? [];
    const total = groups.join('').length;
    if (total < 9) continue;
    const allYears = groups.every((g) => /^(19|20|21)\d{2}$/.test(g));
    if (!allYears) return true;
  }
  return false;
}

/** «صفر واحد صفر اتنين تلاتة…» — ٨ كلمات أرقام ورا بعض. */
function hasSpelledPhone(text: string): boolean {
  const words = text.split(/[\s.\-_/()·،,]+/).filter(Boolean);
  let streak = 0;
  for (const w of words) {
    if (DIGIT_WORDS.has(w) || /^\d$/.test(w)) {
      streak += 1;
      if (streak >= 8) return true;
    } else {
      streak = 0;
    }
  }
  return false;
}

function hasEmail(text: string): boolean {
  if (/[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(\s*\.\s*[a-z]{2,})/.test(text)) return true;
  // مموّه: name (at) mail (dot) com
  return /[a-z0-9._%+-]+\s*[\[(]\s*at\s*[\])]\s*[a-z0-9-]+\s*(\.|[\[(]?\s*dot\s*[\])]?)\s*[a-z]{2,}/.test(
    text,
  );
}

const TLDS = 'com|net|org|io|me|app|co|info|eg|link|ly|tv|gg|xyz|online|site|store|shop|dev';

function hasLink(text: string): boolean {
  if (/(https?:\/\/|www\.)\S+/.test(text)) return true;
  return new RegExp(`\\b[a-z0-9-]{2,}\\.(${TLDS})\\b`).test(text);
}

function hasHandle(text: string): boolean {
  return /(^|[\s(])@[a-z0-9_.]{3,}/.test(text);
}

function hasInvite(text: string): boolean {
  return APP_NAMES.test(text) && INVITE_INTENT.test(text);
}

/** بيفحص نص واحد ويقول فيه بيانات تواصل ولا لأ. */
export function checkContactInfo(input: string): ContactCheck {
  const text = normalizeForScan(input);
  const kinds: ContactKind[] = [];
  if (hasPhone(text) || hasSpelledPhone(text)) kinds.push('phone');
  if (hasEmail(text)) kinds.push('email');
  if (hasLink(text)) kinds.push('link');
  if (hasHandle(text)) kinds.push('handle');
  if (hasInvite(text)) kinds.push('invite');
  if (kinds.length === 0) return { ok: true };
  return { ok: false, kinds, message: CONTACT_BLOCKED_MESSAGE };
}
