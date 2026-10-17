/**
 * رابط قائمة «أقلام الرحلة» بالفلاتر — **حساب نقي بلا شاشة**، عشان الفلاتر
 * والصفحات والـ«مسح التصفية» كلها تبني الرابط من مكان واحد.
 *
 * القيم الافتراضية (الأحدث، الصفحة الأولى، بلا نوع ولا فئة) مابتتكتبش في
 * الرابط: `/aqlam` الفاضي هو الشكل الأصلي.
 */
export type AqlamListState = { c?: string | null; a?: string | null; s?: string | null; p?: number | null };

export function aqlamListHref(state: AqlamListState): string {
  const q = new URLSearchParams();
  if (state.c) q.set('c', state.c);
  if (state.a) q.set('a', state.a);
  if (state.s && state.s !== 'new') q.set('s', state.s);
  if (state.p && state.p > 1) q.set('p', String(state.p));
  const qs = q.toString();
  return qs ? `/aqlam?${qs}` : '/aqlam';
}
