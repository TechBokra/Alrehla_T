/**
 * الفئات العمرية لمنتجات «إنها لك» — **حساب نقي، بلا شاشة**.
 *
 * ── منين الفئات دي ─────────────────────────────────────────
 *
 * الحزم النمائية الأربع في «بداية الرحلة» (الدليل التربوي، الفصل
 * الخامس): أ ٦–٩ · ب ١٠–١٢ · ج ١٣–١٧ · د ١٨–٢٠. قرار تامر إن
 * المتجر يمشي على نفس التقسيم، فالأب بيشوف نفس اللغة في القسمين.
 *
 * ⚠️ **ومفيش فئة تحت ٦** — لأن «بداية الرحلة» بتبدأ من ٦. يعني كتاب
 *    «٣–٥» مش هيظهر تحت أي فئة، وهيظهر في «كل الأعمار» بس. لو
 *    المكتبة ضمّت كتب ما قبل المدرسة، الإضافة **سطر واحد هنا**،
 *    مش ملف قاعدة.
 *
 * ── ليه المنتج بيتخزّن «من سنّ لحد سنّ» مش فئة ─────────────
 *
 * كتاب «٨–١١» لازم يظهر تحت «٦–٩» **وتحت** «١٠–١٢». لو خزّنّا فئة
 * واحدة، بيتحط في واحدة ويختفي من التانية. فالمطابقة هنا **تداخل
 * مدى مع مدى**، لا مساواة.
 */

export type AgeBandId = '6-9' | '10-12' | '13-17' | '18-20';

export type AgeBand = {
  id: AgeBandId;
  min: number;
  max: number;
  /** اللي بيتكتب على زرار الفلتر. */
  label: string;
  /** سطر تحت الرقم — بيقول للأب الفئة دي لمين. */
  hint: string;
  /**
   * ⚠️ **الأصناف مكتوبة كاملة هنا عن قصد.** Tailwind بيبني الألوان
   *    من النصوص اللي بيلاقيها في الكود، والصنف المتركّب وقت التشغيل
   *    (`bg-${color}-100`) **بيتجاهله في صمت** — درس ٣٠.
   *
   * ⚠️ **والتباين مقيس لا مفترض** — بقيم `oklch` الحقيقية من
   *    Tailwind 4 بعد تحويلها لـsRGB (درس ٦):
   *      نص ٩٠٠ على ١٠٠ : كهرماني 8.17 · سماوي 8.24 · بنفسجي 9.28 · زمردي 8.55
   *      أبيض على ٩٠٠  : 9.09 · 9.47 · 11.03 · 9.71
   *    كلها فوق حدّ النص الصغير (4.5:1) بفرق كبير. والشارة فيها نص
   *    دايمًا — **اللون وحده مش معلومة** (درس ٣٣).
   */
  tone: {
    chip: string;
    chipActive: string;
    soft: string;
  };
};

export const AGE_BANDS: readonly AgeBand[] = [
  {
    id: '6-9',
    min: 6,
    max: 9,
    label: '٦–٩ سنين',
    hint: 'أول قراءة لوحده',
    tone: {
      chip: 'border-amber-200 bg-amber-100 text-amber-900',
      chipActive: 'border-amber-900 bg-amber-900 text-white',
      soft: 'from-amber-50 via-white to-amber-100/60',
    },
  },
  {
    id: '10-12',
    min: 10,
    max: 12,
    label: '١٠–١٢ سنة',
    hint: 'حكايات أطول وأسئلة أكتر',
    tone: {
      chip: 'border-sky-200 bg-sky-100 text-sky-900',
      chipActive: 'border-sky-900 bg-sky-900 text-white',
      soft: 'from-sky-50 via-white to-sky-100/60',
    },
  },
  {
    id: '13-17',
    min: 13,
    max: 17,
    label: '١٣–١٧ سنة',
    hint: 'لليافعين',
    tone: {
      chip: 'border-violet-200 bg-violet-100 text-violet-900',
      chipActive: 'border-violet-900 bg-violet-900 text-white',
      soft: 'from-violet-50 via-white to-violet-100/60',
    },
  },
  {
    id: '18-20',
    min: 18,
    max: 20,
    label: '١٨–٢٠ سنة',
    hint: 'للشباب',
    tone: {
      chip: 'border-emerald-200 bg-emerald-100 text-emerald-900',
      chipActive: 'border-emerald-900 bg-emerald-900 text-white',
      soft: 'from-emerald-50 via-white to-emerald-100/60',
    },
  },
];

/** أقصى سنّ مقبول — نفس قيد القاعدة في ملف 132. */
export const MAX_AGE = 20;

export function isAgeBandId(value: unknown): value is AgeBandId {
  return AGE_BANDS.some((b) => b.id === value);
}

export function ageBandById(id: AgeBandId): AgeBand {
  return AGE_BANDS.find((b) => b.id === id)!;
}

/**
 * المنتج مناسب للفئة دي؟
 *
 * ⚠️ **المنتج اللي مالوش سنّ بيرجّع `false` لكل فئة.** عرضه تحت
 *    «١٠–١٢» معناه إننا بنخمّن — والأب اللي اختار سنّ ابنه بيثق إن
 *    الموجود مناسب. بيفضل ظاهرًا في «كل الأعمار».
 *
 * ⚠️ **و«فأكبر» (`maxAge` فاضي) بيتقري لحد آخر سنّ عندنا**، مش
 *    لحد `minAge` — «من ١٣ فأكبر» بيظهر تحت «١٨–٢٠» كمان.
 */
export function productMatchesAgeBand(
  product: { minAge?: number | null; maxAge?: number | null },
  bandId: AgeBandId,
): boolean {
  if (product.minAge === undefined || product.minAge === null) return false;
  const band = ageBandById(bandId);
  const productMax = product.maxAge ?? MAX_AGE;
  return product.minAge <= band.max && productMax >= band.min;
}

/**
 * الفئة اللي تلوّن شارة المنتج — **فئة أصغر سنّ فيه**.
 *
 * ⚠️ مش «كل الفئات اللي بيتداخل معاها»: كارت عليه أربع شارات بيتقري
 *    زحمة لا معلومة. والنص على الشارة بيقول المدى الكامل، فمفيش
 *    معلومة بتضيع — اللون بس هو اللي بيتختار.
 *
 *    وسنّ تحت ٦ (خارج كل الفئات) بيرجّع أول فئة: أقرب لون ليه.
 */
export function primaryAgeBand(product: {
  minAge?: number | null;
  maxAge?: number | null;
}): AgeBand | null {
  if (product.minAge === undefined || product.minAge === null) return null;
  const min = product.minAge;
  return AGE_BANDS.find((b) => min <= b.max) ?? AGE_BANDS[AGE_BANDS.length - 1];
}

const n = (x: number) => x.toLocaleString('ar-EG');

/** «سنة» مع ١١ فأكتر، و«سنين» من ٣ لـ١٠ — زي ما بنقولها. */
const years = (x: number) => (x >= 3 && x <= 10 ? 'سنين' : 'سنة');

/**
 * نص السنّ للعرض: «من ٨ لـ١١ سنة» · «من ١٣ سنة فأكبر» · «٦ سنين».
 * فاضي لو مفيش سنّ — والشاشة بتخفي الشارة بدل ما تكتب «غير محدد».
 */
export function ageLabel(minAge?: number | null, maxAge?: number | null): string {
  if (minAge === undefined || minAge === null) return '';
  if (maxAge === undefined || maxAge === null) return `من ${n(minAge)} ${years(minAge)} فأكبر`;
  if (minAge === maxAge) return `${n(minAge)} ${years(minAge)}`;
  return `من ${n(minAge)} لـ${n(maxAge)} ${years(maxAge)}`;
}

export type AgeInputResult =
  | { ok: true; minAge: number | null; maxAge: number | null }
  | { ok: false; error: string };

/**
 * قراءة خانتَي السنّ من النموذج — **نفس قيود القاعدة بالحرف** (ملف
 * 132)، عشان الإداري ياخد رسالة مفهومة بدل رفض القاعدة الخام.
 *
 * ⚠️ **الخانة `type=number` في الواجهة مش دليل** (قاعدة «ع»): اللي
 *    بيوصل نصّ من المتصفح، وممكن يكون «كلام» أو «٧.٥» أو «-٣».
 *
 * ⚠️ **والأرقام العربية الهندية بتتقبل** («٦» زي «6»): الإداري
 *    بيكتب بالكيبورد العربي، ورفض «٦» بيتقري «الموقع مش فاهمني».
 */
export function parseAgeInput(minRaw: unknown, maxRaw: unknown): AgeInputResult {
  const toInt = (raw: unknown): number | null | 'bad' => {
    if (raw === null || raw === undefined) return null;
    const text = String(raw)
      .trim()
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if (text === '') return null;
    if (!/^\d+$/.test(text)) return 'bad';
    return Number(text);
  };

  const min = toInt(minRaw);
  const max = toInt(maxRaw);

  if (min === 'bad' || max === 'bad') {
    return { ok: false, error: 'السنّ لازم يكون رقمًا صحيحًا (من غير كسور)' };
  }
  if (min === null && max !== null) {
    return { ok: false, error: 'اكتب «من سنّ» الأول — «لحد سنّ» لوحده مالوش معنى' };
  }
  if ((min !== null && min > MAX_AGE) || (max !== null && max > MAX_AGE)) {
    return { ok: false, error: `السنّ لازم يكون من ٠ لـ${n(MAX_AGE)}` };
  }
  if (min !== null && max !== null && min > max) {
    return { ok: false, error: '«من سنّ» لازم يكون أصغر من «لحد سنّ» أو يساويه' };
  }
  return { ok: true, minAge: min, maxAge: max };
}
