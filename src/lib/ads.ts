/**
 * الإعلانات — **الخانات والتوقيت والتحقق، بلا شاشة ولا قاعدة**.
 *
 * ⚠️ من غير React وبلا `server-only` عن قصد: اللوحة بتستعمله للتحقق
 *    قبل الحفظ، والصفحات العامة بتستعمله للفلترة، والاختبار بيشتغل
 *    عليه من غير متصفح.
 */

/* ── الخانات ──────────────────────────────────────────────────────
 *
 * ⚠️ **الخانة = صفحة + موضع.** قرار تامر: خانتين في كل صفحة، فوق
 *    (تحت البانر قبل المحتوى) وتحت (آخر الصفحة) — عشان نفس الصفحة
 *    تقدر تعرض إعلانين مختلفين، والإدارة تحدّد لكل إعلان مكانه
 *    بالظبط مش الصفحة بس.
 *
 * ⚠️ **المفتاح بيتخزّن في القاعدة**، فتغيير مفتاح قديم بيفقد ربط
 *    الإعلانات الموجودة بخانتها. الإضافة آمنة، والتغيير لأ.
 */
export const AD_POSITIONS = ['top', 'bottom'] as const;
export type AdPosition = (typeof AD_POSITIONS)[number];

export type AdPage = {
  /** جزء المفتاح الخاص بالصفحة. */
  id: string;
  /** اسم الصفحة في اللوحة. */
  label: string;
};

export const AD_PAGES: AdPage[] = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'enha-lak', label: 'إنها لك' },
  { id: 'library', label: 'مكتبة إنها لك' },
  { id: 'creative-writing', label: 'بداية الرحلة' },
  { id: 'packages', label: 'الباقات' },
  { id: 'services', label: 'الخدمات الإبداعية' },
  { id: 'aqlam', label: 'أقلام الرحلة' },
  { id: 'blog', label: 'المدونة' },
  { id: 'about', label: 'رحلتنا' },
  { id: 'support', label: 'الدعم والمساعدة' },
];

const POSITION_LABEL: Record<AdPosition, string> = {
  top: 'فوق',
  bottom: 'تحت',
};

/** مفتاح الخانة اللي بيتخزّن في `ads.placements`. */
export function placementKey(pageId: string, position: AdPosition): string {
  return `${pageId}:${position}`;
}

export type AdPlacement = { key: string; label: string; pageId: string; position: AdPosition };

/** كل الخانات المتاحة — اللوحة بتبني منها قايمة الاختيار. */
export const AD_PLACEMENTS: AdPlacement[] = AD_PAGES.flatMap((page) =>
  AD_POSITIONS.map((position) => ({
    key: placementKey(page.id, position),
    label: `${page.label} — ${POSITION_LABEL[position]}`,
    pageId: page.id,
    position,
  })),
);

const PLACEMENT_KEYS = new Set(AD_PLACEMENTS.map((p) => p.key));

export function isAdPlacement(value: unknown): value is string {
  return typeof value === 'string' && PLACEMENT_KEYS.has(value);
}

/** بيشيل المجهول والمكرّر — خانة اتشالت من الكود مابتكسرش إعلان قديم. */
export function cleanPlacements(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(isAdPlacement))];
}

/* ── الإعلان ──────────────────────────────────────────────────────── */

export type Ad = {
  id: string;
  title: string;
  advertiserName: string | null;
  imageUrl: string;
  imageUrlMobile: string | null;
  linkUrl: string | null;
  placements: string[];
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  sortOrder: number;
};

/**
 * مين المعلن: المنصة ولا برّه.
 *
 * ⚠️ **بيتحدّد من اللينك مش من خانة منفصلة.** خانة «نوع المعلن»
 *    بتتناقض مع اللينك: حد يختار «داخلي» ويحط لينك برّه. اللينك هو
 *    الحقيقة الوحيدة.
 */
export function adIsInternal(ad: Pick<Ad, 'linkUrl'>): boolean {
  const url = ad.linkUrl?.trim();
  if (!url) return true; // بانر من غير تحويل = بتاعنا
  return url.startsWith('/');
}

/* ── التوقيت ──────────────────────────────────────────────────────
 *
 * ⚠️ **`now` بيتمرّر، مابيتقراش هنا.** نفس قاعدة باقي الموقع
 *    (`data/domains/(shared)/content/timing.ts`): الوقت بييجي من
 *    السيرفر مرة واحدة، فالصفحة كلها بتحسب بنفس اللحظة والاختبار
 *    يقدر يثبّتها.
 */

function parsed(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * الإعلان شغّال في اللحظة دي؟
 *
 * ⚠️ **التاريخ الغلط = «مفيش حد»، مش «مخفي».** لو انكتب تاريخ بايظ
 *    في القاعدة، الإعلان يفضل ظاهر بدل ما يختفي في سكوت والإدارة
 *    تدوّر على السبب. والقاعدة بترفض أصلًا نهاية قبل بداية.
 */
export function adIsLive(ad: Pick<Ad, 'isActive' | 'startsAt' | 'endsAt'>, now: Date): boolean {
  if (!ad.isActive) return false;
  const at = now.getTime();
  const starts = parsed(ad.startsAt);
  const ends = parsed(ad.endsAt);
  if (starts !== null && starts > at) return false;
  if (ends !== null && ends <= at) return false;
  return true;
}

/** حالة الإعلان في اللوحة — الإدارة لازم تعرف ليه مش ظاهر. */
export type AdStatus = 'live' | 'scheduled' | 'ended' | 'paused';

export function adStatus(ad: Pick<Ad, 'isActive' | 'startsAt' | 'endsAt'>, now: Date): AdStatus {
  if (!ad.isActive) return 'paused';
  const at = now.getTime();
  const starts = parsed(ad.startsAt);
  const ends = parsed(ad.endsAt);
  if (ends !== null && ends <= at) return 'ended';
  if (starts !== null && starts > at) return 'scheduled';
  return 'live';
}

export const AD_STATUS_LABELS: Record<AdStatus, string> = {
  live: 'ظاهر الآن',
  scheduled: 'مجدول',
  ended: 'انتهى',
  paused: 'موقوف',
};

/** إعلانات خانة واحدة، الشغّال بس، مرتّبة زي ما الإدارة ظبطت. */
export function visibleAds(ads: Ad[], placement: string, now: Date): Ad[] {
  return ads
    .filter((ad) => ad.placements.includes(placement) && adIsLive(ad, now))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'ar'));
}

/* ── التحقق قبل الحفظ ─────────────────────────────────────────────── */

export const AD_TITLE_MAX = 120;
export const AD_ADVERTISER_MAX = 80;

/**
 * اللينك المقبول: مسار داخلي (`/…`) أو `https://`.
 *
 * ⚠️ **`http://` مرفوض**: الموقع كله على https، ولينك إعلان على http
 *    بيطلّع تحذير أمان للزائر على بانر إحنا حاطينه.
 *
 * ⚠️ **و`javascript:` و`data:` مرفوضين** — دول تنفيذ كود مش تحويل،
 *    والبانر بيدوس عليه زائر واثق في الموقع.
 */
export function cleanAdLink(raw: unknown): { ok: true; url: string | null } | { ok: false; error: string } {
  const url = String(raw ?? '').trim();
  if (!url) return { ok: true, url: null };
  if (url.startsWith('/')) {
    // `//evil.com` مسار في الشكل بس المتصفح بيقراه نطاق تاني.
    if (url.startsWith('//')) return { ok: false, error: 'اللينك الداخلي لازم يبدأ بشرطة واحدة: /…' };
    return { ok: true, url };
  }
  if (url.startsWith('https://')) return { ok: true, url };
  return {
    ok: false,
    error: 'اللينك لازم يكون مسارًا داخليًا يبدأ بـ / أو رابطًا يبدأ بـ https://',
  };
}

export type AdInput = {
  title: string;
  advertiserName: string | null;
  imageUrl: string;
  imageUrlMobile: string | null;
  linkUrl: string | null;
  placements: string[];
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  sortOrder: number;
};

/** الفورم ← إعلان سليم، أو رسالة عربية واحدة بالسبب. */
export function parseAdInput(raw: {
  title?: unknown;
  advertiserName?: unknown;
  imageUrl?: unknown;
  imageUrlMobile?: unknown;
  linkUrl?: unknown;
  placements?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
}): { ok: true; value: AdInput } | { ok: false; error: string } {
  const title = String(raw.title ?? '').trim().slice(0, AD_TITLE_MAX);
  if (!title) return { ok: false, error: 'اكتب عنوانًا للإعلان (للتعريف في اللوحة).' };

  const imageUrl = String(raw.imageUrl ?? '').trim();
  if (!imageUrl) return { ok: false, error: 'ارفع صورة الإعلان.' };

  const link = cleanAdLink(raw.linkUrl);
  if (!link.ok) return { ok: false, error: link.error };

  const placements = cleanPlacements(raw.placements);
  if (placements.length === 0) {
    return { ok: false, error: 'اختر مكانًا واحدًا على الأقل يظهر فيه الإعلان.' };
  }

  const startsAt = String(raw.startsAt ?? '').trim() || null;
  const endsAt = String(raw.endsAt ?? '').trim() || null;
  if (startsAt && Number.isNaN(new Date(startsAt).getTime())) {
    return { ok: false, error: 'تاريخ البداية مش مقروء.' };
  }
  if (endsAt && Number.isNaN(new Date(endsAt).getTime())) {
    return { ok: false, error: 'تاريخ النهاية مش مقروء.' };
  }
  // ⚠️ نفس شرط القاعدة — الرسالة هنا عربية قبل ما الطلب يوصلها.
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return { ok: false, error: 'تاريخ النهاية لازم يكون بعد البداية.' };
  }

  const order = Number(raw.sortOrder);

  return {
    ok: true,
    value: {
      title,
      advertiserName: String(raw.advertiserName ?? '').trim().slice(0, AD_ADVERTISER_MAX) || null,
      imageUrl,
      imageUrlMobile: String(raw.imageUrlMobile ?? '').trim() || null,
      linkUrl: link.url,
      placements,
      startsAt,
      endsAt,
      isActive: raw.isActive === true || raw.isActive === 'on' || raw.isActive === 'true',
      sortOrder: Number.isFinite(order) ? Math.trunc(order) : 0,
    },
  };
}
