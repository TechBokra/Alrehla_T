/**
 * روابط صور Cloudinary (التحسين، والمقاسات، والعلامة المائية).
 *
 * الرفع نفسه في `lib/upload-client` (العام) و`lib/private-upload-client`
 * (صور الأطفال والإيصالات) — الاتنين بتذكرة موقّعة من السيرفر.
 */


/**
 * بيرفع الملف لـCloudinary — بـ`XMLHttpRequest` مش `fetch` عشان نعرف
 * النسبة: صورة ١٠ ميجا على موبايل بتاخد وقت، والزرار اللي بيقول
 * «جارٍ الرفع…» بس من غير ما يتحرّك بيخلّي الناس تضغط تاني أو تقفل.
 */
export function cloudinaryPost(
  url: string,
  body: FormData,
  onProgress?: (percent: number) => void,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as Record<string, unknown>);
        } catch {
          reject(new Error('تعذّر رفع الصورة'));
        }
      } else {
        console.error('Cloudinary upload failed', xhr.status, xhr.responseText);
        reject(new Error('تعذّر رفع الصورة، برجاء المحاولة مرة أخرى'));
      }
    };
    xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع — اتأكد من النت وجرّب تاني'));
    xhr.send(body);
  });
}

/**
 * A delivery URL that is optimised for the browser asking for it.
 *
 * Images were served exactly as uploaded: an 8MB phone photo reached every
 * visitor at full size. `f_auto` picks the best format the browser supports
 * (usually WebP or AVIF), `q_auto` picks a quality that is visually
 * indistinguishable, and `c_limit,w_…` caps the width without ever enlarging
 * or cropping. This typically cuts the bytes transferred by more than half,
 * which is what actually consumes a Cloudinary plan.
 *
 * A non-Cloudinary URL is returned untouched, so this is safe to apply to any
 * image the site has.
 */
export function optimizedImageUrl(url: string | null | undefined, width = 800): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  // Don't stack transformations on a URL that already carries some.
  if (/\/upload\/[a-z]{1,3}_/.test(url)) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto:good,c_limit,w_${width}/`);
}

/**
 * رابط صورة مظبوط على مقاس خانة معيّنة — **من غير قص**.
 *
 * المشكلة اللي بيحلّها: الصور بتترفع بأي مقاس (صورة موبايل طولية، لقطة شاشة
 * عريضة)، والموقع بيعرضها في مكان له نسبة ثابتة. الطريقة الافتراضية في CSS
 * (`object-cover`) بتملا المكان بقص الأطراف — فالوش يتقطع أو العنوان يختفي.
 *
 * الحل هنا إن Cloudinary هو اللي يظبط المقاس قبل ما الصورة توصل المتصفح:
 *
 *   c_pad + b_auto  → الصورة كاملة جوّه المقاس المطلوب، والفراغ الجانبي
 *                     بيتملّي بلون مسحوب من أطراف الصورة نفسها، فالنتيجة
 *                     بتبان طبيعية مش إطار أبيض.
 *   c_fit           → الصورة كاملة من غير ملء — للشعارات والأيقونات، عشان
 *                     الشفافية ما تتحوّلش للون.
 *
 * في الحالتين الصورة بتوصل بالنسبة المضبوطة، فـ `object-cover` في CSS
 * مالهاش أي حاجة تقصّها.
 *
 * `dpr_auto` بيخلي الشاشات عالية الدقة تاخد نسخة أوضح من غير ما الشاشات
 * العادية تحمّل بايت زيادة.
 */
import { SITE_IMAGE_BY_KEY, type SiteImageKey } from '@/lib/site-images';

export function slotImageUrl(
  url: string | null | undefined,
  key: SiteImageKey,
): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (/\/upload\/[a-z]{1,3}_/.test(url)) return url;

  const slot = SITE_IMAGE_BY_KEY[key];
  if (!slot) return optimizedImageUrl(url);

  // q_auto لوحدها بتنزل لجودة منخفضة على الصور اللي فيها تدرّجات
  // ناعمة، فبتبان مبقّعة. :good بيحط حد أدنى للجودة والفرق في الحجم بسيط.
  const parts = ['f_auto', 'q_auto:good', 'dpr_auto', `w_${slot.w}`];
  if (slot.fit === 'pad') {
    // قص ذكي: Cloudinary بيحلّل الصورة ويقص حواليها، فالصورة بتملا
    // المكان بالكامل من غير أشرطة لونية على الجنب.
    //
    // اللي كان قبله: c_pad + b_auto — الصورة كاملة والفراغ بيتملّي بلون
    // مسحوب من أطرافها. ما كانش بيقص حاجة، لكن الشريط اللوني بيبان
    // كأنه فلتر على الصورة.
    parts.push('c_fill', 'g_auto');
    if (slot.ar) parts.push(`ar_${slot.ar}`);
  } else {
    parts.push('c_fit');
    if (slot.ar) parts.push(`h_${slot.w}`);
  }

  return url.replace('/upload/', `/upload/${parts.join(',')}/`);
}

/**
 * نفس صورة الخانة، **بنسبة ومقاس مختلفين** — للصور اللي حاويتها
 * بتغيّر شكلها حسب الشاشة.
 *
 * ── المشكلة ─────────────────────────────────────────────────
 *
 * `slotImageUrl` بتسلّم نسبة واحدة ثابتة لكل خانة. وصورة الهيرو
 * نسبتها `21:9`، لكن الحاوية في الصفحة بتتغيّر:
 *
 *     موبايل 4:3  ←  تابلت 16:9  ←  لابتوب 21:9
 *
 * يعني على الموبايل، `object-cover` في CSS بياخد صورة **عريضة جدًا**
 * ويقصّها لمربّع تقريبًا — **فمش بيبان منها غير الشريط الأوسط**،
 * وأطراف الصورة بتروح. وأغلب الزوار على الموبايل.
 *
 * ── والحل مش تصغير الصورة ───────────────────────────────────
 *
 * ⚠️ **الفرق اللي بيهم**: القص هنا بيتحسب من **الصورة الأصلية**، مش
 *    من نسخة الـ21:9. يعني `g_auto` بيحلّل الصورة كلها ويختار أحسن
 *    قصّة 4:3 — بدل ما ياخد قصّة عريضة اتقصّت أصلًا ويقصّها تاني.
 *    قص القص بيضيّع نص الصورة؛ ده بيحافظ عليها.
 *
 * ⚠️ **وبيوفّر بايتات كمان**: الموبايل بيحمّل 900 بكسل عرض بدل 2100.
 *
 * بتترجع فاضية لو الرابط مش من Cloudinary أو عليه تحويلات قبل كده —
 * وساعتها الاستدعاء بيرجع للسلوك العادي.
 */
export function slotImageUrlAt(
  url: string | null | undefined,
  ar: string,
  width: number,
): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (/\/upload\/[a-z]{1,3}_/.test(url)) return url;

  const parts = ['f_auto', 'q_auto:good', 'dpr_auto', `w_${width}`, 'c_fill', 'g_auto', `ar_${ar}`];
  return url.replace('/upload/', `/upload/${parts.join(',')}/`);
}

/**
 * صورة بديلة صغيرة جدًا (20 بكسل مموّهة) تُعرض لحظة تحميل الصورة الأصلية.
 *
 * بدل ما المكان يفضل فاضي أبيض وبعدين الصورة تنطّ فيه، بيظهر شكل مموّه
 * بألوان الصورة الحقيقية — الصفحة بتحس مستقرة وأسرع حتى لو الوقت واحد.
 */
export function blurPlaceholder(url: string | null | undefined): string | undefined {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return undefined;
  }
  if (/\/upload\/[a-z]{1,3}_/.test(url)) return undefined;
  return url.replace('/upload/', '/upload/f_auto,q_auto:low,e_blur:800,w_20/');
}

/**
 * صورة منتج **بالعلامة المائية** (شكلها من الإعدادات — `lib/watermark-settings`).
 *
 * ── قرار تامر (1 أكتوبر): «لازم كدا في الكل» ──────────────────
 *
 * ⚠️ **العلامة على الصورة نفسها من Cloudinary** — مش طبقة CSS فوقها.
 *    الطبقة بتتشال من أدوات المطوّر في ثانية؛ اللي على البكسل بيفضل في
 *    أي لقطة شاشة أو حفظ.
 *
 * ⚠️ **والعرض ١٦٠٠ ثابت عن قصد**: الرابط ده بيتحسب **على الخادم** قبل
 *    ما المنتج يتبعت للمتصفح (`data/domains/products.ts`) — فرابط الصورة
 *    الأصلية **مابيوصلش للصفحة خالص**. والتصغير لمقاس الكارت بيعمله
 *    `next/image` بعدها.
 *
 * ⚠️ **العلامة مقفولة (أو صورة مش على Cloudinary) = الصورة زي ما
 *    هي** — العلامة إضافة، وغيابها مايوقعش الصفحة.
 */
export function watermarkedImageUrl(
  url: string | null | undefined,
  watermark: string | null,
): string | undefined {
  if (!url) return undefined;
  if (!watermark) return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  // متحوّلة قبل كده (عليها علامة أو مقاس) — مانكدّسش.
  if (/\/upload\/[a-z]{1,3}_/.test(url)) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto:good,c_limit,w_1600/${watermark}/`);
}

/*
 * شكل العلامة نفسها (الكتابة، اللون، الحجم، المكان، والتشغيل) من
 * «الإعدادات العامة» — `lib/watermark-settings`. الدوال هنا بتاخد الطبقة
 * جاهزة (`watermark`)، و`null` = مقفولة والصورة بتطلع زي ما هي.
 */

/**
 * رابط **تحميل** لصورة عليها العلامة (قرار تامر: «العملاء يحمّلوا الصور
 * بالعلامة — دعاية لينا»). Cloudinary بيبعتها كملف بدل ما يفتحها
 * (`fl_attachment`) — اتجرّب: الاسم بيوصل `alrehla-….jpg`.
 *
 * ⚠️ **صورة من غير علامة = `null`** (والزرار مابيظهرش): التحميل مسموح
 *    بالعلامة بس، مش الأصل.
 */
export function downloadableImageUrl(url: string | null | undefined, name = 'alrehla'): string | null {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return null;
  if (!url.includes('/l_')) return null;
  const safe =
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'alrehla';
  return url.replace('/upload/', `/upload/fl_attachment:${safe}/`);
}

/**
 * العلامة المائية على صورة **متحوّلة أو لأ** — لصور الموقع كلها (قرار تامر:
 * «على الكل»): خطط الصندوق، أغلفة المقالات وصورها، وصور أقسام الموقع.
 *
 * الفرق عن `watermarkedImageUrl`: دي بتشتغل **بعد** تحويل المقاس
 * (`slotImageUrl`، `optimizedImageUrl`)، فالشعار بيتحط على الصورة بمقاسها
 * النهائي بدل ما يتكدّس فوقه قص تاني يقص الشعار نفسه.
 *
 * ⚠️ مش للشعار نفسه ولا لكود الدفع (QR) ولا الصور الشخصية — الصفحة هي
 *    اللي بتقرر تناديها على إيه.
 */
export function addWatermark(url: string | null | undefined, watermark: string | null): string {
  if (!url) return '';
  if (!watermark || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (url.includes('/l_')) return url; // عليها علامة قبل كده
  const base = /\/upload\/[a-z]{1,3}_/.test(url) ? url : optimizedImageUrl(url, 1600);
  const [head, rest] = base.split('/upload/');
  const segs = rest.split('/');
  let i = 0;
  while (i < segs.length - 1 && /^[a-z]{1,3}_/.test(segs[i])) i++;
  segs.splice(i, 0, watermark);
  return `${head}/upload/${segs.join('/')}`;
}

/**
 * صور Cloudinary **جوّه نص** (محتوى مقال) — كل رابط بتتحط عليه العلامة.
 */
export function watermarkCloudinaryUrlsIn(text: string, watermark: string | null): string {
  if (!text || !watermark) return text;
  return text.replace(/https:\/\/res\.cloudinary\.com\/[^\s"')<>]+?\/upload\/[^\s"')<>]+/g, (u) => addWatermark(u, watermark));
}

/**
 * رابط صورة مرفوعة عندنا على Cloudinary (`https://res.cloudinary.com/…/image/upload/…`).
 *
 * بيتفحص على الخادم قبل ما رابط جاي من المتصفح يتحفظ كصورة شخصية —
 * من غيره أي نداء مباشر كان يقدر يحط رابط لأي موقع برّه.
 */
export function isUploadedImageUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 1000 &&
    /^https:\/\/res\.cloudinary\.com\/[^/\s]+\/image\/upload\/\S+$/.test(value)
  );
}
