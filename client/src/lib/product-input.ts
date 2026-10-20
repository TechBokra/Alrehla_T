import { z } from 'zod';

/**
 * تحقّق مدخلات المنتج — **أول استعمال لـ`zod` في دوال الخادم**.
 *
 * ── ليه ده مش تحسينًا شكليًّا ────────────────────────────────
 *
 * `saveProduct` كانت بتاخد السعر كده:
 *
 *     const rawPrice = Number(formData.get('price'));
 *
 * و`Number` مابترفضش حاجة — بترجّع رقمًا أو `NaN`:
 *
 *   • الخانة فاضية  → **صفر**  → **منتج مجاني**: العميل يطلبه ويدفع لا شيء
 *   • نص غير رقمي   → `NaN`   → `numeric` في Postgres **بيقبل NaN**،
 *                                والشاشة بتعرض «NaN ج.م» للعميل
 *   • رقم سالب      → يتحفظ زي ما هو
 *
 * ⚠️ **والخانة `required` في النموذج مش دليل** (قاعدة «ع»): اللي
 *    بيوصل للخادم نصّ من المتصفح، وأي حد يقدر يبعت اللي هو عايزه.
 *
 * ⚠️ **ونصيب الناشر كان متحقَّقًا منه فعلًا، وسعر المنصة لأ.** يعني
 *    الحارس كان موجود على نصّ المسار وناقص على نصّه التاني — وده
 *    أوحش من غيابه كله، لأنه بيدّي إحساسًا إن الموضوع متغطّى.
 */

/** أقصى سعر معقول — حارس على الصفر الزيادة لا قاعدة عمل. */
const MAX_PRICE = 1_000_000;

/**
 * ⚠️ **`.optional()` بتتحطّ جوّه المعالجة لا برّاها.**
 *
 *    `z.preprocess(...).optional()` بتفحص **المُدخَل** هل هو
 *    `undefined` — والمعالجة لسه ما اشتغلتش. فالنصّ الفاضي بيدخل،
 *    المعالجة بتحوّله لـ`undefined`، والرقم جوّه بيرفضه.
 *
 *    الاختبار هو اللي مسك ده: «السعر الإلكتروني اختياري» سقط،
 *    **وكان محقًّا** — فاتصلّح الكود لا الاختبار.
 *
 * ⚠️ **ومكتوبين صريحين لا بدالة بعلم.** الدالة اللي بترجّع
 *    `n` أو `n.optional()` نوعها اتحاد، فـTypeScript بيستنتج
 *    `number | undefined` **حتى للمطلوب** — والحمولة بترفض.
 */
const toNumber = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : Number(v);

const numberRules = z
  .number({ invalid_type_error: 'السعر لازم يكون رقم' })
  // ⚠️ `finite` بترفض `NaN` و`Infinity`. من غيرها `Number('كلام')`
  //    بتعدّي، و`numeric` في Postgres **بيقبل NaN** فعلًا.
  .finite('السعر لازم يكون رقم')
  .positive('السعر لازم يكون أكبر من صفر')
  .max(MAX_PRICE, 'السعر أكبر من المتوقّع — اتأكّد من الرقم');

const requiredPrice = z.preprocess(toNumber, numberRules);
const optionalPrice = z.preprocess(toNumber, numberRules.optional());

export const productInputSchema = z.object({
  name: z
    .string({ required_error: 'اكتب اسم المنتج' })
    .trim()
    .min(2, 'اسم المنتج قصير أوي')
    .max(120, 'اسم المنتج طويل أوي'),
  shortDescription: z
    .string()
    .trim()
    .max(600, 'الوصف طويل أوي')
    .optional()
    .or(z.literal('')),
  price: requiredPrice,
  /** فاضي = مفيش نسخة إلكترونية. */
  electronicPrice: optionalPrice,
});

export type ProductInput = z.infer<typeof productInputSchema>;

export type ProductInputResult =
  | { ok: true; data: ProductInput }
  | { ok: false; error: string };

/**
 * تحقّق بيرجّع **أول رسالة عربية مفهومة** بدل ما يرمي.
 *
 * ⚠️ Next بيمسح نصّ الاستثناء في الإنتاج (قاعدة «هـ»)، فالرمي هنا
 *    كان بيوصل للإداري كصفحة خطأ عامة — يضغط «حفظ» فيشوف شاشة
 *    مالهاش علاقة، ومايعرفش أي خانة هي السبب.
 */
export function validateProductInput(raw: {
  name?: unknown;
  shortDescription?: unknown;
  price?: unknown;
  electronicPrice?: unknown;
}): ProductInputResult {
  // ⚠️ `formData.get` بيرجّع `null` للخانة الغايبة من النموذج — وzod
  //    بيقبل «مش موجود» لا `null`، فكان بيرفض بـ«Invalid input» بالإنجليزي
  //    (نفس عطل صورة المدرب). الغايب = مش موجود.
  const clean = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v === null ? undefined : v]),
  );
  const parsed = productInputSchema.safeParse(clean);
  if (parsed.success) return { ok: true, data: parsed.data };

  const first = parsed.error.issues[0];
  // اسم الخانة بيتحط قدّام الرسالة عشان الإداري يعرف يروح فين.
  const label: Record<string, string> = {
    name: 'اسم المنتج',
    shortDescription: 'الوصف',
    price: 'السعر',
    electronicPrice: 'السعر الإلكتروني',
  };
  const field = String(first?.path?.[0] ?? '');
  const prefix = label[field] ? `${label[field]}: ` : '';
  return { ok: false, error: `${prefix}${first?.message ?? 'بيانات غير صالحة'}` };
}

/**
 * رابط المنتج من اسمه.
 *
 * ── ليه ده اتغيّر ───────────────────────────────────────────
 *
 * الرابط كان `prod-${Date.now()}` — رقم توليد تلقائي **بيظهر
 * للعميل في شريط العنوان**، وفي نتايج البحث، وفي أي رابط بيتبعت
 * على واتساب. وفيه منتجان على الإنتاج بالشكل ده فعلًا
 * (`prod-1789588253939` و`prod-1789588225745`).
 *
 * ⚠️ **والعربي بيتساب عربيًّا.** المتصفحات بتعرض الرابط العربي
 *    مقروءًا، وبتشفّره لما يتنسخ. تحويله لحروف لاتينية بيدّي
 *    نصًّا مالوش معنى لا للعميل ولا لمحرّك البحث.
 *
 * ⚠️ **والرابط بيتعمل للمنتج الجديد وبس.** تغيير رابط منتج قائم
 *    بيكسر كل رابط اتبعت له قبل كده — والزائر بيوصل لـ404 بلا
 *    سبب ظاهر.
 */
export function slugFromName(name: string, fallbackSeed = Date.now()): string {
  const slug = name
    .trim()
    .toLowerCase()
    // المسافات وعلامات الترقيم بتبقى شرطة
    .replace(/[\s_]+/g, '-')
    // بنسيب الحروف والأرقام (عربي ولاتيني) والشرطة وبس
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  // اسم كله رموز (أو فاضي بعد التنظيف) مالوش رابط مقروء — بنرجع
  // للشكل القديم بدل ما نرجّع رابطًا فاضيًا.
  return slug || `prod-${fallbackSeed}`;
}

/** أقصى عدد بنود تفاصيل — حارس على الشاشة لا قاعدة عمل. */
export const MAX_FEATURES = 8;

/**
 * تفاصيل المنتج من نصّ «سطر لكل بند».
 *
 * ── ليه دالة مستقلة ─────────────────────────────────────────
 *
 * المنطق ده كان هيتكتب جوّه `saveProduct` — ومنطق جوّه أكشن خادم
 * **مابيتختبرش**: عشان تجرّبه لازم تزوّر `FormData` وعميل قاعدة
 * وجلسة مستخدم. برّه، كل حالة بتتجرّب بسطر.
 *
 * ── والقواعد مقصودة ─────────────────────────────────────────
 *
 * ⚠️ **الفاضي بيتشال**: النصّ اللي فيه سطر فاضي بين البنود (وده
 *    اللي بيحصل طبيعي وإنت بتكتب) كان هيدخل بندًا فاضيًا يطلع
 *    شريحة فاضية في الكارت.
 *
 * ⚠️ **والمكرّر بيتشال**: النسخ واللصق بيكرّر، والبندان المتطابقان
 *    في الكارت بيبانوا غلطة عرض لا غلطة إدخال.
 *
 * ⚠️ **والطويل بيتشال لا بيتقصّ**: البند اللي أطول من ٨٠ حرفًا مش
 *    «تفصيلة»، ده وصف — مكانه خانة الوصف. وقصّه كان هيدّي جملة
 *    ناقصة معروضة للعميل.
 */
export function parseFeatures(raw: string | null | undefined): string[] {
  return [
    ...new Set(
      (raw ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.length <= 80),
    ),
  ].slice(0, MAX_FEATURES);
}

/**
 * الأعمدة اللي خانتها **وصلت فعلًا** من النموذج — وبس.
 *
 * ── العطل اللي بيقفله ───────────────────────────────────────
 *
 * `saveProduct` كانت بتكتب التفاصيل والوصف الكامل والمعرض في كل
 * حفظة. والخانة اللي مش في النموذج `formData.get()` بترجّعها `null`،
 * فكانت بتتكتب `null` **فوق القيمة الموجودة**.
 *
 * ونموذج الناشر ماكانش فيه الخانات دي. يعني الإدارة تضيف صورًا
 * ووصفًا للكتاب، والناشر يصلّح حرفًا في الوصف القصير، **فكل ده
 * يتمسح في صمت** — والشاشة تقول «اتحفظ».
 *
 * ⚠️ **والفرق اللي لازم يفضل واضح:**
 *      • الخانة مش في النموذج       ← العمود ماينكتبش، القديم يفضل
 *      • الخانة في النموذج وفاضية    ← اتمسحت عن قصد، تتكتب `null`
 *    `formData.has()` بتفرّق بينهم؛ `formData.get() || null` لأ.
 *
 * `fields`: اسم الخانة في النموذج ← الأعمدة اللي بتتكتب لو وصلت.
 */
export function onlySentFields(
  form: { has(name: string): boolean },
  fields: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, columns] of Object.entries(fields)) {
    if (form.has(field)) Object.assign(out, columns);
  }
  return out;
}
