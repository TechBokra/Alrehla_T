import { formatPrice, decodeSlug } from '@/lib/utils';
import {
  WritingPackage, Instructor, PersonalizedProduct, AddonProduct, SubscriptionTier, 
  Testimonial, CreativeService, BlogPost, UserProfile, Booking, Order, 
  Publisher, InstructorPayout, PublisherPayout, SessionMessage, SessionAttachment, 
  StudyMaterial, InstructorStudent, BoxSubscription, SupportTicket, 
  JoinRequest, SupportSessionRequest, AuditLog, ServiceOrder, CourseSubscription, 
  SupportTicketMessage, FamilyMember, NotificationItem, UserRole,
  PublisherOrder,
  InstructorPricingOption, PricingFormulaSettings, InstructorCompensationProfile, InstructorCertification
} from '@/types';
import { cookies } from 'next/headers';

// Import from auth if needed




import { createPublicClient } from '@/lib/supabase/public';
export { productRedirectPath } from '@/lib/product-display';
import { createClient } from '@/lib/supabase/server';
import { sharePerUnit } from '@/lib/publisher-sales';
import { getPublisherPricingSettings } from '@/data/domains/admin';
import { getSiteSettings } from '@/data/domains/content';
import { watermarkedImageUrl } from '@/lib/cloudinary';
import { publicIdFromUrl } from '@/lib/cloudinary-admin';

/**
 * صور المنتج **بالعلامة المائية** للصفحات العامة (قرار تامر، 1 أكتوبر).
 *
 * ⚠️ **بتتحسب هنا على الخادم، قبل ما المنتج يتبعت للمتصفح** — فرابط
 *    الصورة الأصلية مابيوصلش لحمولة الصفحة خالص. لو اتحسبت في المكوّن،
 *    المنتج كان هيتبعت بالرابط الأصلي جوّه بيانات الصفحة، وأي حد يفتح
 *    المصدر ياخده نضيف.
 *
 * ⚠️ **واللوحات مابتمرّش من هنا** (`getManagedProducts`): الإدارة
 *    والناشر محتاجين الصورة الأصلية — يراجعوها ويبدّلوها.
 *
 * الشعار من «صور الموقع ← الشعار»، وبصيغة طبقة Cloudinary (`/` ← `:`).
 */
async function withWatermark(product: PersonalizedProduct): Promise<PersonalizedProduct> {
  const settings = await getSiteSettings();
  const layer = publicIdFromUrl(settings.images.logo)?.replace(/\//g, ':') ?? null;
  if (!layer) return product;
  return {
    ...product,
    coverImageUrl: watermarkedImageUrl(product.coverImageUrl, layer),
    galleryImageUrls: product.galleryImageUrls?.map((u) => watermarkedImageUrl(u, layer) ?? u),
  };
}

/**
 * صفّ المنتج من القاعدة ← شكل الكود. **مكان واحد للتلات دوال.**
 *
 * ⚠️ كانت التحويلة مكتوبة تلات مرات (القايمة، المنتج الواحد،
 *    المراجعة)، وكل عمود جديد لازم يتضاف في التلاتة. ملف 130 أضاف
 *    عمودين فاتضافوا في التلاتة — **صدفة لا ضمان**. وعمود السنّ (ملف
 *    132) كان هيبقى الرابع: يتضاف في القايمة وينسى صفحة المنتج،
 *    فالكارت يقول «٦–٩» والصفحة ماتقولش حاجة.
 */
function mapProductRow(p: any): PersonalizedProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    electronicPrice: p.electronic_price || undefined,
    shortDescription: p.short_description ?? '',
    coverImageUrl: p.cover_image_url || undefined,
    publisherId: p.publisher_id || undefined,
    ownerType: p.owner_type,
    publisherCost: p.publisher_cost ?? undefined,
    features: p.features || undefined,
    longDescription: p.long_description || undefined,
    galleryImageUrls: p.gallery_image_urls || undefined,
    // ⚠️ `??` لا `||`: السنّ صفر رقم حقيقي، و`||` كانت هتقراه «مفيش».
    minAge: p.min_age ?? undefined,
    maxAge: p.max_age ?? undefined,
    // ⚠️ العمود في القاعدة `text` بـ`CHECK` (قرار ملف 130: الـenum
    //    صعب التعديل)، فالتحويل هنا بيضيّقه للنوع اللي الشاشات
    //    بتتعامل معاه. وأي قيمة غريبة بتتقري «في الانتظار» — الأأمن:
    //    المنتج يفضل مستخبي لحد ما حد يبصّ.
    reviewStatus: (['pending', 'approved', 'rejected'] as const).includes(p.review_status)
      ? p.review_status
      : 'pending',
    reviewNote: p.review_note || undefined,
    isActive: p.is_active ?? true,
    createdAt: p.created_at ?? undefined,
    sortOrder: typeof p.sort_order === 'number' ? p.sort_order : 0,
  };
}

/**
 * ترتيب الإدارة (ملف 06) فوق ترتيب «الأحدث».
 *
 * ⚠️ **بيتعمل هنا مش في الاستعلام** عن قصد: `.order('sort_order')` قبل ما
 *    ملف 06 يتشغّل كان هيرجّع خطأ «العمود مش موجود» — والصفحات العامة
 *    بتعتبر الخطأ «مفيش منتجات»، يعني المتجر كله يفضى. هنا العمود الغايب
 *    = صفر للكل = نفس الترتيب القديم.
 *
 *    والترتيب في JavaScript ثابت (stable)، فالمتساويين (كل المكتبة، أو
 *    الجديد اللي لسه ماترتّبش) بيفضلوا بالأحدث أولًا.
 */
export function byDisplayOrder(a: PersonalizedProduct, b: PersonalizedProduct): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}

/**
 * منتجات المتجر — **للصفحات العامة وحدها**.
 *
 * بتقرا بعميل الزائر (عشان الصفحات تتخزّن)، فبترجّع المعتمد
 * المعروض بس — والفلترة دي **في سياسة القاعدة** (ملف 130)، مش هنا.
 *
 * ⚠️ **كان ليها خيار `includeInactive` واتشال.** من ملف 130 الخيار
 *    ماكانش بيعمل حاجة: سياسة الزائر بتشيل الموقوف قبل ما الطلب
 *    يوصل. واللوحات اللي كانت بتطلبه كانت فاكرة إنها شايفة كله —
 *    شوف `getManagedProducts` تحت. خيار بيوعد بحاجة مش بيعملها
 *    أوحش من غيابه، لأن اللي بعدنا هيستعمله.
 *
 * ⚠️ و`.eq('is_active', true)` باقي رغم إن السياسة بتعمله: لو
 *    السياسة اتوسّعت بعدين لأي سبب، الصفحات العامة تفضل آمنة.
 */
export const getPersonalizedProducts = async (): Promise<PersonalizedProduct[]> => {
  const supabase = createPublicClient();
  const query = supabase
    .from('personalized_products')
    .select('*')
    .eq('is_active', true)
    .eq('review_status', 'approved');
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    if (error) {
      console.error('Error fetching personalized products:', error);
    }
    return [];
  }

  return Promise.all(data.map(mapProductRow).sort(byDisplayOrder).map(withWatermark));
};

/**
 * منتجات لوحات التحكم — **بجلسة الداخل، لا بصلاحية الزائر**.
 *
 * ═══════════════════════════════════════════════════════════
 * 🔴 ليه دالة منفصلة — عطل كان قاعد مستني
 * ═══════════════════════════════════════════════════════════
 *
 * شاشة «المنتجات» في الإدارة، و«منتجاتي» عند الناشر، وصفحة تعديل
 * الناشر كانوا بينادوا `getPersonalizedProducts({ includeInactive:
 * true })`. والدالة دي بتقرا **بعميل الزائر** (`createPublicClient` —
 * من غير كوكيز، عشان الصفحات العامة تتخزّن).
 *
 * ومن ملف 130، سياسة الزائر:
 *     USING ( review_status = 'approved' AND is_active )
 *
 * يعني `includeInactive` **بقت ما بتعملش حاجة** — الفلتر بيحصل في
 * القاعدة قبل ما الكود يطلب. والنتيجة:
 *
 *   • الإدارة توقف منتج ← **يختفي من شاشة المنتجات**، ومفيش مكان
 *     ترجّعه منه. وعمود «موقوف» في الجدول مستحيل يظهر.
 *   • الناشر يعدّل منتجه ← الحارس بيرجّعه «في الانتظار» ← **يختفي من
 *     «منتجاتي»**، وصفحة تعديله بتقول «غير موجود».
 *
 * كل ده **بلا أي خطأ** — مصيدة «ك» بالحرف. وتشخيص 131 قال إن صفر
 * منتجات متأثرة **لحد النهارده**: العطل كان مستني أول إيقاف.
 *
 * ⚠️ **وشاشة المراجعة كانت عارفة المصيدة دي** (`getPendingProducts`
 *    تحت بتقرا بالجلسة وبتشرح ليه). الإصلاح اتعمل في الشاشة الجديدة
 *    وما وصلش للقديمة — درس ٢٠ بشكل تاني.
 *
 * ── ومين بيشوف إيه ──────────────────────────────────────────
 *
 * السياسات هي اللي بتقرّر، لا الدالة: الإداري بيشوف كله (`is_admin()`)،
 * والناشر بيشوف بتاعه بأي حالة + المعتمد العام. والشاشة بتفلتر بالناشر
 * بعد كده — **الفلترة دي عرض، مش حماية**.
 */
export async function getManagedProducts(): Promise<PersonalizedProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('personalized_products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    // ⚠️ بيترمي ولا بيرجّع فاضي: الفاضي هنا بيتقري «مفيش منتجات»،
    //    والإداري يفتكر إن الكتالوج اتمسح. الشاشة بتعرض صفحة الخطأ.
    console.error('تعذّر قراءة منتجات اللوحة', error);
    throw new Error('تعذّر تحميل المنتجات');
  }
  return (data ?? []).map(mapProductRow);
}

/**
 * Add-on products have no table in the database yet — the shape and business
 * rules still need deciding. Until then a customer must never be offered one:
 * they would be selecting, and paying for, something that does not exist.
 * الإضافات المتاحة مع المنتجات المخصّصة.
 *
 * كانت بترجّع قايمة فاضية دايمًا في الإنتاج، وقبلها كانت تلات إضافات
 * بأسعار مكتوبة في كود المتصفح مالهاش جدول. دلوقتي من `addon_products`.
 */
export const getAddonProducts = async (
  options: { includeInactive?: boolean } = {},
): Promise<AddonProduct[]> => {
  const supabase = await createClient();

  const query = supabase
    .from('addon_products')
    .select('id, slug, name, description, price, is_active, sort_order, supports_customization, customization_price')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const { data, error } = options.includeInactive
    ? await query
    : await query.eq('is_active', true);

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    description: a.description ?? undefined,
    price: a.price,
    isActive: a.is_active,
    sortOrder: a.sort_order,
    supportsCustomization: a.supports_customization ?? false,
    customizationPrice: a.customization_price ?? 0,
  }));
};

export const getSubscriptionTiers = async (
  options: { includeInactive?: boolean } = {},
): Promise<SubscriptionTier[]> => {
  // الإدارة بتحتاج تشوف الخطط المقفولة عشان تعدّلها، والزائر لأ.
  // القراءة العامة بلا كوكيز عشان صفحة الاشتراك تفضل مخزّنة مسبقًا.
  const supabase = options.includeInactive
    ? await createClient()
    : createPublicClient();

  const query = supabase
    .from('box_subscription_plans')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('duration_months', { ascending: true });

  if (!options.includeInactive) query.eq('is_active', true);

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return [];
  }

  return data.map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceTotal: plan.price_total,
    priceMonthly: plan.price_monthly,
    durationMonths: plan.duration_months,
    savingsNote: plan.savings_note ?? undefined,
    imageUrl: plan.image_url ?? undefined,
    description: plan.description ?? undefined,
    features: plan.features ?? [],
    isHighlighted: plan.is_highlighted ?? false,
    isActive: plan.is_active ?? true,
    sortOrder: plan.sort_order ?? 0,
    addonDiscountPercent: plan.addon_discount_percent ?? 0,
    freeAddonId: plan.free_addon_id ?? undefined,
  }));
};

export const getPublishers = async (): Promise<Publisher[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('publishers')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    logoUrl: p.logo_url || undefined,
    bio: p.bio,
    isSample: p.is_sample,
    status: p.status
  }));
};

export const getPublisherBySlug = async (rawSlug: string): Promise<Publisher | null> => {
  const slug = decodeSlug(rawSlug);
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('publishers')
    .select('*')
    .eq('slug', slug)
    .single();

  if ((error || !data)) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url || undefined,
    bio: data.bio,
    isSample: data.is_sample ?? false,
    status: data.status
  };
};

/**
 * منتج واحد برابطه.
 *
 * ⚠️ **الموقوف بيرجّع `null`** — والصفحة بتطلع 404. البديل إنها
 *    تعرض المنتج مع منع الشراء، وده أوحش: العميل بيشوف السعر
 *    ويضغط ويترفض، وبيفتكر إن الموقع باظ.
 */
export const getProductBySlug = async (rawSlug: string): Promise<PersonalizedProduct | null> => {
  const slug = decodeSlug(rawSlug);
  const supabase = createPublicClient();
  const { data: current, error } = await supabase.from('personalized_products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  // ── رابط قديم؟ (ملف 136) ─────────────────────────────────
  //
  // الروابط اللي كانت `prod-<رقم>` اتغيّرت لأسماء مقروءة، والقديم
  // اتحفظ في `previous_slugs`. فلو الرابط مش لاقي منتج، بندوّر هنا —
  // والصفحة بتشوف إن `slug` الراجع غير المطلوب فبتحوّل تحويلًا دائمًا
  // (`productRedirectPath`). من غير ده، كل رابط اتبعت على واتساب قبل
  // التغيير كان هيوصل لـ«المنتج غير موجود».
  let data = current;
  if (!data && !error) {
    const { data: moved } = await supabase.from('personalized_products')
      .select('*')
      .contains('previous_slugs', [slug])
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    data = moved;
  }

  if (error || !data) return null;

  // ══ 🔴 هنا كان فيه شرط بيقتل نصّ الكتالوج ══════════════
  //
  // كان:
  //
  //     if (data.owner_type === 'platform') { return {...}; }
  //     return null;
  //
  // يعني **أي منتج ملك ناشر بيرجع «مش موجود»** — والتعليق اللي
  // كان فوقه بيعترف إنه بقايا من أيام البيانات الوهمية
  // («we'll keep the original logic for fallback»).
  //
  // ⚠️ **والمكتبة بطبيعتها إصدارات ناشرين.** يعني أول ما تربط
  //    كتابًا بناشر من لوحة الإدارة، صفحة تخصيصه بتموت بـ404 —
  //    والكتاب فاضل ظاهرًا في الشبكة وبزرّ «تخصيص الغلاف» شغّال
  //    شكلًا. العميل بيضغط فيلاقي «الصفحة غير موجودة».
  //
  // ⚠️ **والعطل كان صامتًا تمامًا**: الدالة بترجّع `null`، والصفحة
  //    بتقرا `null` على إنه «المنتج مش موجود» وتعمل `notFound()`.
  //    مافيش خطأ في أي سجلّ، ومافيش فرق بين «منتج اتحذف» و«منتج
  //    ملك ناشر».
  //
  // **ومالوش أي مبرّر**: كل الأعمدة اللي بتتقري موجودة في
  // النوعين، والصفحات اللي بتستعملها بتفلتر بالتصنيف لا بالملكية.
  return withWatermark(mapProductRow(data));
};


/**
 * طلبات الناشر الحقيقية ونصيبه منها.
 *
 * دي كانت **مخترعة بالكامل**: بتبني الطلبات من بيانات تجريبية، ومعاها
 * `setTimeout(600)` بيقلّد بطء الشبكة عشان تبان حقيقية، وبتحسب نصيب
 * الناشر 70% ثابتة مكتوبة في الكود. يعني أي ناشر بيفتح لوحته كان بيشوف
 * طلبات وأرباح مش موجودة.
 *
 * النسخة دي بتقرا من قاعدة البيانات.
 *
 * ⚠️ **والنصيب بيتقري من `publisher_cost` لا بعكس المعادلة** (ملف
 *    97). كانت بتتحسب بالعكس:
 *
 *        نصيب الناشر = (سعر العميل − الرسم) ÷ المعامل
 *
 *    والعكس ده بيدّي رقمًا صح **طول ما المعادلة ما اتغيّرتش**. أول ما
 *    الإدارة تعدّل النسبة، كل الطلبات القديمة بتتحسب بالمعادلة
 *    الجديدة — فالناشر يفتح لوحته يلاقي نصيبه من بيعة الشهر اللي فات
 *    **اتغيّر لوحده**، ورقم شاشة الطلبات يخالف رقم المستحقات.
 *
 *    `publisher_cost` رقم مخزّن على المنتج، فالشاشتان بيقروا نفس
 *    المصدر.
 *
 * ⚠️ **والقديم لسه بيتحسب بالعكس**: المنتجات اللي اتعملت قبل ملف 97
 *    `publisher_cost` بتاعها فاضي، فبنرجع للعكس عشان مانعرضش صفرًا
 *    على بيعة حقيقية.
 */
export async function getPublisherOrders(): Promise<PublisherOrder[]> {
  const publisher = await getMyPublisher();
  if (!publisher) return [];

  const supabase = await createClient();

  // منتجات الناشر ده.
  const { data: products } = await supabase
    .from('personalized_products')
    .select('id, name, publisher_cost')
    .eq('publisher_id', publisher.id);

  if (!products || products.length === 0) return [];
  const productById = new Map(products.map((p) => [p.id, p]));

  // بنودها في الطلبات.
  const { data: items } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, quantity, unit_price, publisher_cost_snapshot')
    .in('product_id', Array.from(productById.keys()));

  if (!items || items.length === 0) return [];

  // الطلبات نفسها — للحالة والتاريخ.
  const orderIds = Array.from(new Set(items.map((i) => i.order_id)));
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, created_at')
    .in('id', orderIds);

  const orderById = new Map((orders ?? []).map((o) => [o.id, o]));

  const formula = await getPublisherPricingSettings();
  const multiplier = formula.platformMultiplier > 0 ? formula.platformMultiplier : 1;

  const rows: PublisherOrder[] = [];
  for (const item of items) {
    const order = orderById.get(item.order_id);
    if (!order) continue;

    const product = productById.get(item.product_id);
    const totalAmount = item.unit_price * item.quantity;

    // ⚠️ المتثبّت وقت الشراء أولًا (ملف 134) — `sharePerUnit`.
    const unitShare = sharePerUnit({
      snapshot: item.publisher_cost_snapshot,
      currentCost: product?.publisher_cost,
      unitPrice: item.unit_price,
      fixedAdminFee: formula.fixedAdminFee,
      multiplier,
    });

    rows.push({
      id: item.id,
      orderId: item.order_id,
      productName: product?.name ?? 'منتج محذوف',
      quantity: item.quantity,
      totalAmount,
      publisherShare: unitShare * item.quantity,
      status: order.status,
      createdAt: order.created_at,
    });
  }

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The publisher record belonging to the signed-in user, if any. */
export async function getMyPublisher(): Promise<Publisher | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let { data } = await supabase
    .from('publishers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // ⚠️ حساب دوره ناشر ومالوش صف دار نشر — بيتعمل دلوقتي بدل ما لوحته
  //    كلها تطلع «غير موجود» (`@/lib/ensure-publisher`).
  if (!data) {
    const { ensurePublisherRowForPublisher } = await import('@/lib/ensure-publisher');
    const created = await ensurePublisherRowForPublisher(user.id);
    if (!created) return null;
    ({ data } = await supabase.from('publishers').select('*').eq('id', created.id).maybeSingle());
    if (!data) return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url || undefined,
    bio: data.bio,
    isSample: data.is_sample ?? false,
    status: data.status,
  };
}

/**
 * المنتجات المستنية مراجعة — لشاشة الإدارة (ملف 130).
 *
 * ── ⚠️ ليه بعميل الجلسة لا العميل العام ─────────────────────
 *
 * `createPublicClient` بيقرا بلا كوكيز — يعني **بدور الزائر**،
 * وسياسة الزائر بترجّع المعتمد المفعّل وبس. فلو قريت بيه هنا،
 * الشاشة هتبان **فاضية دايمًا وبلا أي خطأ**، والإداري يفتكر إن
 * مفيش حاجة مستنية بينما فيه منتجات واقفة عن البيع.
 *
 * ⚠️ ودي مصيدة «ك» بالظبط: الصفوف الممنوعة بترجع فاضية لا بخطأ.
 */
export async function getPendingProducts(): Promise<
  (PersonalizedProduct & { publisherName?: string })[]
> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('personalized_products')
    .select('*')
    .eq('review_status', 'pending')
    // الأقدم أولًا: اللي مستني من أسبوع يتشاف قبل اللي اتبعت النهارده.
    .order('updated_at', { ascending: true });

  if (error) {
    console.error('تعذّر قراءة المنتجات المستنية', error);
    return [];
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (rows.length === 0) return [];

  // اسم الناشر معاه: شاشة مراجعة بتعرض منتجات بلا أسماء بتخلّي
  // الإداري يفتح تبويبًا تاني لكل واحد عشان يعرف بتاع مين.
  const publisherIds = [
    ...new Set(rows.map((r) => r.publisher_id).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string>();
  if (publisherIds.length > 0) {
    const { data: pubs } = await supabase
      .from('publishers')
      .select('id, name')
      .in('id', publisherIds);
    for (const pub of pubs ?? []) names.set(pub.id, pub.name);
  }

  return rows.map((p) => ({
    ...mapProductRow(p),
    reviewStatus: 'pending' as const,
    publisherName: p.publisher_id
      ? (names.get(p.publisher_id as string) ?? 'ناشر غير معروف')
      : undefined,
  }));
}
