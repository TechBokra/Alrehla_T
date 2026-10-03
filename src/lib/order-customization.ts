/**
 * تفاصيل تخصيص بند في طلب — **بالشكل اللي الإدارة بتنفّذ منه**.
 *
 * ── المشكلة ────────────────────────────────────────────────
 *
 * صفحة الطلب في الإدارة كانت بتعرض «المنتج · السعر · الكمية» وبس.
 * اسم الطفل، وصف البطل، الهدف التربوي، الإهداء، الصور، الإضافات
 * المخصّصة — كلها محفوظة في `order_items.customization_data` و**مش
 * ظاهرة في أي شاشة**. يعني طلب «أنت البطل هنا» مدفوع ومحدّش يقدر
 * ينفّذه من غير ما يفتح قاعدة البيانات.
 *
 * الدالة دي بتقرا البيانات الخام وبترجّع: خانات بعناوين عربي، والصور
 * (خاصة أو قديمة عامة)، والإضافات. **مابتعتمدش على شكل ثابت**: أي خانة
 * نصية مش معروفة بتظهر تحت «بيانات أخرى» بدل ما تختفي.
 */

import { readExtraAnswers } from './customization-fields';

export type CustomizationPhoto =
  | { label: string; kind: 'private'; publicId: string; format: string }
  | { label: string; kind: 'public'; url: string };

export type CustomizationAddon = { name: string; price: number | null; customized: boolean };

export type CustomizationView = {
  fields: { label: string; value: string }[];
  photos: CustomizationPhoto[];
  addons: CustomizationAddon[];
};

/** نفس اختيارات `Step2Details` — والقيمة المحفوظة هي الكلمة القصيرة. */
const STORY_GOALS: Record<string, string> = {
  'شجاعة': 'الشجاعة والتغلب على الخوف',
  'ثقة': 'بناء الثقة بالنفس',
  'حل المشكلات': 'تعلم حل المشكلات',
  'تعاون': 'التعاون مع الآخرين',
};

const FIELDS: [key: string, label: string][] = [
  ['childName', 'اسم الطفل'],
  ['heroDescription', 'وصف البطل'],
  ['storyGoal', 'الهدف التربوي'],
  ['familyMemberNames', 'أسماء أفراد العائلة'],
  ['dedicationText', 'الإهداء'],
  ['coverChoice', 'اختيار الغلاف'],
  ['notes', 'ملاحظات'],
];

const PRIVATE_PHOTOS: [key: string, label: string][] = [
  ['childPhoto', 'صورة الطفل'],
  ['secondPhoto', 'صورة إضافية'],
  ['coverPhoto', 'صورة الغلاف'],
];

/** طلبات قبل الصور الخاصة: الرابط العام محفوظ مباشرة. */
const LEGACY_PHOTOS: [key: string, label: string][] = [
  ['childPhotoUrl', 'صورة الطفل'],
  ['secondPhotoUrl', 'صورة إضافية'],
  ['coverPhotoUrl', 'صورة الغلاف'],
];

/** خانات داخلية — أرقام للربط، مالهاش معنى للي بينفّذ. */
const INTERNAL = new Set([
  'recipientType', 'childId', 'selectedAddonIds', 'customizedAddonIds', 'addons',
  // صندوق الرحلة (ملف 140) — بيتعرضوا من `describeBoxDetails`.
  'monthlyGoals', 'plan',
  // خانات الإدارة (ملف 06) — بتتعرض بأسمائها تحت.
  'extraFields',
]);

function text(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function privatePhoto(v: unknown): { publicId: string; format: string } | null {
  if (!v || typeof v !== 'object') return null;
  const { publicId, format } = v as Record<string, unknown>;
  // ⚠️ `publicId` لازم يكون في المجلّد الخاص: ده رقم جاي من المتصفح،
  //    ومن غير الشرط ده عميل يقدر يحط رقم أي صورة في الحساب والإدارة
  //    تولّد له رابطًا موقَّعًا ليها.
  if (typeof publicId !== 'string' || !publicId.startsWith('alrehla/private/')) return null;
  if (typeof format !== 'string' || !/^[a-z0-9]{2,5}$/.test(format)) return null;
  return { publicId, format };
}

function publicUrl(v: unknown): string | null {
  const s = text(v);
  return s && /^https:\/\/res\.cloudinary\.com\//.test(s) ? s : null;
}

export function describeCustomization(raw: unknown): CustomizationView {
  const view: CustomizationView = { fields: [], photos: [], addons: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return view;
  const data = raw as Record<string, unknown>;
  const used = new Set<string>(INTERNAL);

  if (data.recipientType === 'self') {
    view.fields.push({ label: 'لمين', value: 'للعميل نفسه' });
  }

  for (const [key, label] of FIELDS) {
    used.add(key);
    const value = text(data[key]);
    if (!value) continue;
    view.fields.push({
      label,
      value: key === 'storyGoal' ? (STORY_GOALS[value] ?? value) : value,
    });
  }

  // ⭐ ملف 06: خانات الإدارة — بالاسم اللي العميل جاوب عليه وقت الطلب.
  for (const a of readExtraAnswers(data.extraFields)) {
    view.fields.push(a);
  }

  for (const [key, label] of PRIVATE_PHOTOS) {
    used.add(key);
    const p = privatePhoto(data[key]);
    if (p) view.photos.push({ label, kind: 'private', ...p });
  }
  for (const [key, label] of LEGACY_PHOTOS) {
    used.add(key);
    const url = publicUrl(data[key]);
    if (url) view.photos.push({ label, kind: 'public', url });
  }

  if (Array.isArray(data.addons)) {
    for (const a of data.addons) {
      if (!a || typeof a !== 'object') continue;
      const { name, price, customized } = a as Record<string, unknown>;
      const n = text(name);
      if (!n) continue;
      view.addons.push({
        name: n,
        price: typeof price === 'number' && Number.isFinite(price) ? price : null,
        customized: customized === true,
      });
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (used.has(key)) continue;
    const t = text(value);
    if (t) view.fields.push({ label: `بيانات أخرى (${key})`, value: t });
  }

  return view;
}

/** في تفاصيل أصلًا؟ — عشان الصفحة ماتعرضش كارت فاضي لمنتج عادي. */
export function hasCustomization(view: CustomizationView): boolean {
  return view.fields.length > 0 || view.photos.length > 0 || view.addons.length > 0;
}

/** الخطة وقت الشراء + أهداف الشهور — طلب اشتراك صندوق الرحلة (ملف 140). */
export type BoxDetailsView = {
  planName: string;
  months: number;
  price: number | null;
  shippingPerMonth: number | null;
  addonDiscountPercent: number;
  freeAddonName: string | null;
  /** `null` = «تختاره الإدارة». */
  goals: (string | null)[];
};

export function describeBoxDetails(raw: unknown): BoxDetailsView | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const plan = (data.plan && typeof data.plan === 'object' ? data.plan : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const months = Math.max(1, Math.trunc(num(plan.months) ?? 1));
  const rawGoals = Array.isArray(data.monthlyGoals) ? data.monthlyGoals : [];
  return {
    planName: text(plan.name) ?? 'صندوق الرحلة',
    months,
    price: num(plan.price),
    shippingPerMonth: num(plan.shippingPerMonth),
    addonDiscountPercent: num(plan.addonDiscountPercent) ?? 0,
    freeAddonName: text(plan.freeAddonName),
    goals: Array.from({ length: months }, (_, i) => text(rawGoals[i])),
  };
}
