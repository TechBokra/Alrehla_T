/** Small catalog helpers shared by the product and add-on feature modules. */
export function productSlug(
  name: string,
  suffix = crypto.randomUUID().slice(0, 8),
) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "product";
  return `${base}-${suffix}`;
}
export function catalogError(error: unknown): string {
  const value = error as {
    code?: string;
    statusCode?: number;
    status?: number;
  } | null;
  if (value?.code === "23505")
    return "رابط المنتج مستخدم بالفعل. حاول الإنشاء مرة أخرى.";
  if (
    value?.code === "42501" ||
    [401, 403].includes(value?.statusCode ?? value?.status ?? 0)
  )
    return "ليس لديك صلاحية لحفظ هذا السجل.";
  if (value?.code === "23514")
    return "تعذّر الحفظ لأن البيانات لا تطابق قواعد المنتج.";
  return "تعذّر حفظ البيانات. القيم محفوظة في النموذج؛ حاول مرة أخرى.";
}
