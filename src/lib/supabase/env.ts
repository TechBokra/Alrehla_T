/**
 * عنوان Supabase ومفتاحه العام — مكان واحد.
 *
 * بيقبل المفتاح الجديد (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) أو القديم
 * (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
 *
 * ⚠️ **مفيش قيم وهمية ولا «بيانات فاضية» لو المفاتيح ناقصة.** نسخة جوجل
 *    ستوديو كانت بترجّع عنوانًا وهميًّا ونداءات بترد «مفيش بيانات» —
 *    يعني لو المفتاح وقع من Vercel، الموقع كان هيفتح فاضي في صمت (مفيش
 *    منتجات ولا باقات ولا حد يعرف يدخل) بدل ما الغلط يبان. ده نفس العطل
 *    اللي اتلغى في حادثة 2 أكتوبر. المفتاح الناقص لازم يبان كخطأ.
 */
function required(name: string, value: string | undefined): string {
  const v = value?.trim();
  if (!v) throw new Error(`${name} مش متظبط — راجع متغيرات البيئة في Vercel.`);
  return v;
}

export function getSupabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabasePublicKey(): string {
  return required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** @deprecated اسم قديم — `getSupabasePublicKey`. */
export function getSupabaseAnonKey(): string {
  return getSupabasePublicKey();
}
