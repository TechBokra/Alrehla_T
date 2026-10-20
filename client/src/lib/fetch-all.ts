/**
 * قراية كل الصفوف من غير ما حاجة تضيع لما البيانات تكبر.
 *
 * ⚠️ **Supabase بيرجّع ١٠٠٠ صف بالكتير في الطلب الواحد — من غير أي
 *    رسالة.** يعني يوم الطلب رقم ١٠٠١ هيختفي من قايمة الإدارة وكأنه
 *    مش موجود. `fetchAllPages` بتقرا على دفعات لحد ما تخلّص.
 *
 * ⚠️ **و`.in('id', [...])` بيتبعت في الرابط نفسه** — كل رقم ٣٧ حرف، فبعد
 *    كام مية رقم الرابط بيطول عن الحد وبيفشل، والطلبات بتظهر من غير
 *    منتجاتها. `chunks` بتقسّم القايمة لدفعات صغيرة.
 */

export const PAGE_SIZE = 1000;
export const IN_CHUNK = 100;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** بتنادي `page(from, to)` لحد ما دفعة ترجع أقل من `PAGE_SIZE`. */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => Page<T>,
  pageSize = PAGE_SIZE,
): Promise<{ data: T[]; error: unknown }> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: all, error };
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return { data: all, error: null };
  }
}

/** بتقسّم القايمة لدفعات (من غير تكرار ولا فاضي). */
export function chunks<T>(list: readonly T[], size = IN_CHUNK): T[][] {
  const unique = Array.from(new Set(list));
  const out: T[][] = [];
  for (let i = 0; i < unique.length; i += size) out.push(unique.slice(i, i + size));
  return out;
}

/** `.in()` على دفعات وبيجمّع النتيجة — أي دفعة فشلت بتتسجّل وتتساب. */
export async function fetchIn<T, K>(
  ids: readonly K[],
  query: (part: K[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = IN_CHUNK,
  options: { throwOnError?: boolean } = {},
): Promise<T[]> {
  const parts = await Promise.all(chunks(ids, size).map((part) => query(part)));
  const out: T[] = [];
  let firstError: unknown;
  for (const { data, error } of parts) {
    if (error) {
      console.error('fetchIn', error);
      firstError ??= error;
    }
    out.push(...(data ?? []));
  }
  if (options.throwOnError && firstError) throw firstError;
  return out;
}
