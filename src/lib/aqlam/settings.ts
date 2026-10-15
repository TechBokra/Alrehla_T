/**
 * تشغيل «أقلام الرحلة» وإيقافها — من إعدادات الموقع، بلا استعلام زيادة.
 *
 * بيتخزّن جوّه صف `general` الموجود في `site_settings` (اللي كل صفحة
 * بتقراه أصلًا مرة واحدة)، فالعلم مايكلّفش استعلامًا في أي صفحة.
 *
 * ثلاث حالات:
 *  • `off`    — مقفول: كل المسارات 404 والرابط مش ظاهر. (الافتراضي، وهو
 *                الإيقاف الطارئ.)
 *  • `pilot`  — تجريبي: المسارات بتتفتح بالرابط (للقراءة) من غير رابط في
 *                القائمة ومع noindex، **والنشر والتفاعل لقايمة حسابات
 *                مسموحة بس** — وده محروس في القاعدة مش في الصفحة.
 *  • `public` — مفتوح للكل.
 *
 * ⚠️ ليه القراءة مش محجوبة في التجريبي: حجبها معناه قراءة الكوكيز في
 *    الصفحة، وقراءة الكوكيز بتخلّي الصفحة ديناميكية بلا كاش — وده بالظبط
 *    اللي الفصل ده جه يمنعه. والنصوص الموجودة وقت التجريبي من حسابات
 *    مسموحة بس.
 */

export type AqlamMode = 'off' | 'pilot' | 'public';

export type AqlamSettings = {
  mode: AqlamMode;
  /** معرّفات حسابات مسموحة في التجريبي. */
  allowlist: string[];
};

export const AQLAM_OFF: AqlamSettings = { mode: 'off', allowlist: [] };

export function normalizeAqlamSettings(value: unknown): AqlamSettings {
  const v = (value ?? {}) as { aqlamMode?: unknown; aqlamAllowlist?: unknown };
  const mode: AqlamMode =
    v.aqlamMode === 'public' || v.aqlamMode === 'pilot' ? v.aqlamMode : 'off';
  const allowlist = Array.isArray(v.aqlamAllowlist)
    ? v.aqlamAllowlist.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  return { mode, allowlist };
}

/** الصفحات تتفتح؟ (قراءة) */
export function aqlamReadable(s: AqlamSettings): boolean {
  return s.mode !== 'off';
}

/** رابط القائمة العلوية يظهر؟ — للعامة بس. */
export function aqlamNavVisible(s: AqlamSettings): boolean {
  return s.mode === 'public';
}

/** الحساب ده يقدر ينشر ويتفاعل؟ (نفس منطق `aqlam_enabled_for` في القاعدة.) */
export function aqlamAllowsUser(s: AqlamSettings, userId: string | null | undefined): boolean {
  if (s.mode === 'public') return true;
  if (s.mode === 'pilot') return !!userId && s.allowlist.includes(userId);
  return false;
}
