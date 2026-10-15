/**
 * كل صورة في الموقع مش منتج ولا شخص ولا مقال.
 *
 * كانت كلها `https://picsum.photos/...` — صور عشوائية من الإنترنت معروضة
 * على إنها صور المنصة. كل خانة معرّفة هنا مرة واحدة، ومعاها مكانها بالظبط،
 * عشان شاشة الإدارة تعرضها ومحدش يضطر يدوّر في الكود.
 *
 * ليه فيه `ar` و`w` و`fit` جنب الوصف؟
 * عشان الصورة تتظبط على مقاس الخانة **من غير قص**. الوصف للبني آدم،
 * والثلاثة دول للكود: بيتحوّلوا لأمر تحويل على Cloudinary بيحط الصورة
 * جوّه المقاس المطلوب كامله.
 */

export type SiteImageKey =
  | 'logo'
  | 'logoDark'
  | 'favicon'
  | 'ogImage'
  | 'homeHero'
  | 'homeReading'
  | 'homeWriting'
  | 'homeFamily'
  | 'aboutTeam'
  | 'creativeSlide1'
  | 'enhaLakSlide1'
  | 'aqlamHero';

/**
 * إزاي الصورة تتظبط على المقاس:
 *   pad     — قص ذكي: الصورة بتملا المقاس بالكامل، وCloudinary بيحدد
 *             الجزء المهم فيها ويقص حواليه. (الاسم اتساب زي ما هو عشان
 *             ما نكسرش الخانات المتخزّنة.)
 *             كان قبل كده: الصورة كاملة والفراغ يتملّي بلون مسحوب من
 *             أطرافها — والشريط اللوني ده كان بيبان كأنه فلتر.
 *   contain — تتصغّر كاملة من غير ما تتملّي (بتفضل بنسبتها الأصلية).
 *             للشعارات والأيقونات اللي الشفافية فيها مهمة.
 */
export type SiteImageFit = 'pad' | 'contain';

export type SiteImageSlot = {
  key: SiteImageKey;
  /** What it is, in the admin screen. */
  label: string;
  /** Exactly where it appears on the site. */
  location: string;
  /** الوصف اللي بيتعرض في شاشة الإدارة. */
  ratio: string;
  /** نسبة الأبعاد اللي Cloudinary بيظبط عليها — فاضية = تُترك كما هي. */
  ar?: string;
  /** العرض المستهدف بالبكسل. */
  w: number;
  fit: SiteImageFit;
  /** خانات الهوية بتتعرض في مجموعة منفصلة فوق. */
  group: 'brand' | 'pages';
};

export const SITE_IMAGE_SLOTS: SiteImageSlot[] = [
  /* ---------------- الهوية ---------------- */
  {
    key: 'logo',
    label: 'شعار الموقع',
    location: 'الهيدر في كل صفحات الموقع',
    ratio: 'أفقي — يفضّل PNG أو SVG بخلفية شفافة، ارتفاع 80 بكسل أو أكثر',
    w: 240,
    fit: 'contain',
    group: 'brand',
  },
  {
    key: 'logoDark',
    label: 'الشعار على خلفية داكنة',
    location: 'الفوتر والأقسام الداكنة — اختياري',
    ratio: 'نفس الشعار بنسخة فاتحة اللون. لو فاضي، بيُستخدم الشعار العادي',
    w: 240,
    fit: 'contain',
    group: 'brand',
  },
  {
    key: 'favicon',
    label: 'أيقونة التبويب',
    location: 'تبويب المتصفح والمفضلة وشاشة الهاتف',
    ratio: 'مربعة (1:1) — 512×512، والأفضل خلفية شفافة',
    ar: '1:1',
    w: 512,
    fit: 'contain',
    group: 'brand',
  },
  {
    key: 'ogImage',
    label: 'صورة المشاركة',
    location: 'تظهر لما حد يبعت رابط الموقع على واتساب أو فيسبوك',
    ratio: 'عريضة (1.91:1) — 1200×630',
    ar: '1200:630',
    w: 1200,
    fit: 'pad',
    group: 'brand',
  },

  /* ---------------- صفحات الموقع ---------------- */
  {
    key: 'homeHero',
    label: 'الصورة الرئيسية',
    location: 'الصفحة الرئيسية — بانر بعرض الصفحة',
    ratio: 'عريضة جدًا (21:9) — 2100×900 أو أكبر',
    ar: '21:9',
    w: 2100,
    fit: 'pad',
    group: 'pages',
  },
  {
    key: 'homeReading',
    label: 'صورة قسم «إنها لك»',
    location: 'الصفحة الرئيسية — قسم القصص المخصصة',
    ratio: 'أفقية (4:3) — 800×600 أو أكبر',
    ar: '4:3',
    w: 1000,
    fit: 'pad',
    group: 'pages',
  },
  {
    key: 'homeWriting',
    label: 'صورة قسم «بداية الرحلة»',
    location: 'الصفحة الرئيسية — قسم الكتابة الإبداعية',
    ratio: 'أفقية (4:3) — 800×600 أو أكبر',
    ar: '4:3',
    w: 1000,
    fit: 'pad',
    group: 'pages',
  },
  {
    key: 'homeFamily',
    label: 'صورة قسم العائلة',
    location: 'الصفحة الرئيسية — القسم قبل الأخير',
    ratio: 'مربعة (1:1) — 800×800 أو أكبر',
    ar: '1:1',
    w: 1000,
    fit: 'pad',
    group: 'pages',
  },
  {
    key: 'aboutTeam',
    label: 'صورة صفحة «رحلتنا»',
    location: 'صفحة رحلتنا — الصورة العريضة',
    ratio: 'عريضة (2:1) — 1200×600 أو أكبر',
    ar: '2:1',
    w: 1400,
    fit: 'pad',
    group: 'pages',
  },
  {
    key: 'creativeSlide1',
    label: 'بانر «بداية الرحلة»',
    location: 'أعلى صفحة «بداية الرحلة» — صورة واحدة',
    ratio: 'عريضة (16:9) — 1600×900',
    ar: '16:9',
    w: 1600,
    fit: 'pad',
    group: 'pages',
  },
  {
    key: 'enhaLakSlide1',
    label: 'بانر «إنها لك»',
    location: 'أعلى صفحة «إنها لك» — صورة واحدة',
    ratio: 'عريضة (16:9) — 1600×900',
    ar: '16:9',
    w: 1600,
    fit: 'pad',
    group: 'pages',
  },
  {
    key: 'aqlamHero',
    label: 'بانر «أقلام الرحلة»',
    location: 'أعلى صفحة أقلام الرحلة — صورة واحدة عريضة',
    ratio: 'عريضة (16:9) — 1600×900',
    ar: '16:9',
    w: 1600,
    fit: 'pad',
    group: 'pages',
  },
];

export const SITE_IMAGE_BY_KEY: Record<string, SiteImageSlot> = Object.fromEntries(
  SITE_IMAGE_SLOTS.map((s) => [s.key, s]),
);

export type SiteImages = Partial<Record<SiteImageKey, string>>;
