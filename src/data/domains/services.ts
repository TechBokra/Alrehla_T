import { createClient } from '@/lib/supabase/server';
import { getPublicInstructors } from '@/data/domains/writing';
import { calculateFinalSessionPrice } from '@/lib/utils';
import type {
  CreativeService,
  InstructorServiceOffer,
  ProviderKind,
  ServiceProvider,
} from '@/types';

/**
 * Standalone creative services ("الخدمات الإبداعية").
 *
 * This module reads from the database only — it has no mock fallback by
 * design. The services page used to keep its own hardcoded copy of this
 * list, the two drifted apart, and a placeholder entry ended up live on
 * the site. One source of truth, deliberately.
 */

export async function getStandaloneServices(options?: {
  /**
   * شاشات الإدارة بس. الموقع العام والمدرب بيشوفوا المفعّل بس، عشان
   * خدمة موقوفة ما تتطلبش وما تتعرضش للعميل.
   */
  includeInactive?: boolean;
}): Promise<CreativeService[]> {
  const supabase = await createClient();
  // ⚠️ `*` عن قصد: خانات ملف 09 (الصورة والنماذج…) لو اتطلبت بالاسم قبل ما
  //    الملف يتشغّل، الاستعلام كله بيقع ← الصفحة تقول «مفيش خدمات».
  let query = supabase.from('standalone_services').select('*');

  if (!options?.includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    description: row.description ?? '',
    category: row.category ?? undefined,
    priceType: row.price_type === 'starts_from' ? 'starts_from' : 'fixed',
    sortOrder: row.sort_order ?? undefined,
    isActive: row.is_active,
    coverImageUrl: row.cover_image_url || undefined,
    galleryImageUrls: row.gallery_image_urls?.length ? row.gallery_image_urls : undefined,
    longDescription: row.long_description || undefined,
    deliverables: row.deliverables?.length ? row.deliverables : undefined,
    requirements: row.requirements || undefined,
    deliveryDays: row.delivery_days ?? undefined,
  }));
}

/**
 * Every offer belonging to one instructor, whatever its status.
 * Used by the admin screen and by the instructor's own dashboard.
 *
 * بتقرا من `provider_services` مش من `instructor_services`.
 *
 * ليه: الجدولين كانوا شغالين مع بعض، والبيع بيمر من `provider_services`
 * وحده. فالشاشة كانت بتعرض للمدرب عروضًا «معتمدة ومفعّلة» من الجدول
 * القديم، والعميل لا يشوفها ولا يقدر يطلبها. دلوقتي الشاشة بتعرض اللي
 * العميل شايفه فعلًا.
 */
export async function getInstructorServiceOffers(
  instructorId: string
): Promise<InstructorServiceOffer[]> {
  const supabase = await createClient();

  const { data: provider } = await supabase
    .from('service_providers')
    .select('id')
    .eq('instructor_id', instructorId)
    .maybeSingle();

  // مدرب لسه ملوش صف مقدّم خدمة = مفيش عروض. الصف بيتعمل أول ما يقدّم
  // عرض (في `actions/instructor-services.ts`).
  if (!provider) return [];

  const { data, error } = await supabase
    .from('provider_services')
    .select('*')
    .eq('provider_id', provider.id);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    instructorId,
    serviceId: row.service_id,
    requestedPrice: row.requested_price ?? undefined,
    approvedPrice: row.approved_price ?? undefined,
    status: row.status as InstructorServiceOffer['status'],
    isActive: row.is_active,
    adminNotes: row.admin_notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * مقدّمو الخدمة اللي العميل بيختار منهم.
 *
 * بيقرا من `provider_services` مش من `instructor_services`: مقدّم الخدمة
 * بقى يقدر يكون المنصة نفسها، أو مدرب، أو مستقل مش مدرب.
 *
 * التسعير — وده الجزء اللي كان غلط:
 *   • مدرب أو مستقل: السعر المعتمد هو **مستحقه هو**، والعميل بيدفع فوقه
 *     معادلة المنصة. الصفحة كانت بتعرض المستحق والخادم بيحاسب بالسعر
 *     النهائي — فرق بين اللي اتعرض واللي اتحاسب.
 *   • المنصة: السعر المعتمد هو **سعر العميل** مباشرة. مفيش مستحق ولا
 *     هامش فوق هامش.
 *
 * الترتيب بالأرخص عشان «يبدأ من» يبقى صادق.
 */
export async function getProvidersForService(
  serviceId: string
): Promise<ServiceProvider[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('provider_services')
    .select(
      'id, approved_price, provider_id, service_providers(id, kind, display_name, bio, status, instructor_id)'
    )
    .eq('service_id', serviceId)
    .eq('status', 'approved')
    .eq('is_active', true);

  if (error || !data) return [];

  const rows = data
    .map((row) => {
      const provider = row.service_providers as unknown as {
        id: string;
        kind: ProviderKind;
        display_name: string;
        bio: string;
        status: string;
        instructor_id: string | null;
      } | null;
      if (!provider || provider.status !== 'active') return null;
      if (row.approved_price == null) return null;
      return { row, provider };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (rows.length === 0) return [];

  // سنوات الخبرة والصورة موجودتان على صف المدرب وملفه، مش على مقدّم
  // الخدمة. استعلام واحد للكل بدل واحد لكل مقدّم.
  //
  // ── ليه `getPublicInstructors()` مش استعلامًا مباشرًا ────────
  //
  // ⚠️ دي كانت `supabase.from('instructors').select(...)` بمفتاح
  //    المستخدم. وبعد ملف SQL 84 بقت قراءة جدول المدربين
  //    **للمسجَّلين وحدهم** — يعني الاستعلام ده بيرجع **فاضي للزائر**،
  //    بلا أي خطأ (قاعدة «ك»). والنتيجة إن كل مقدّم خدمة كان بيتعرض
  //    للزائر بـ«صفر سنوات خبرة»، والزائر هو بالظبط المشتري المحتمل.
  //
  //    `getPublicInstructors()` بتمر على دالة `SECURITY DEFINER`
  //    (ملف 83) فبترجّع نفس البيانات للزائر والمسجَّل — ومعاها
  //    `avatar_url` اللي مكانش حد بيطلبه هنا أصلًا.
  const instructorIds = new Set(
    rows.map((r) => r.provider.instructor_id).filter((id): id is string => Boolean(id)),
  );

  const experience = new Map<string, number>();
  const avatars = new Map<string, string>();
  if (instructorIds.size > 0) {
    for (const i of await getPublicInstructors()) {
      if (!instructorIds.has(i.id)) continue;
      experience.set(i.id, i.yearsExperience ?? 0);
      if (i.avatarUrl) avatars.set(i.id, i.avatarUrl);
    }
  }

  // معادلة المنصة تُقرأ مرة واحدة. لو مش متاحة، ما بنخترعش هامش —
  // بنحاسب بسعر المقدّم زي ما هو.
  const needsFormula = rows.some((r) => r.provider.kind !== 'platform');
  let formula: { platformMultiplier: number; fixedAdminFee: number } | null = null;
  if (needsFormula) {
    const { data: f } = await supabase
      .from('pricing_formula_settings')
      .select('platform_multiplier, fixed_admin_fee')
      .eq('id', 'default')
      .maybeSingle();
    if (f) {
      formula = {
        platformMultiplier: f.platform_multiplier,
        fixedAdminFee: f.fixed_admin_fee,
      };
    }
  }

  return rows
    .map(({ row, provider }) => {
      const approved = row.approved_price as number;
      const isPlatform = provider.kind === 'platform';
      const price = isPlatform
        ? approved
        : formula
          ? calculateFinalSessionPrice(approved, formula)
          : approved;

      return {
        offerId: row.id,
        providerId: provider.id,
        kind: provider.kind,
        instructorId: provider.instructor_id,
        displayName: provider.display_name,
        bio: provider.bio,
        yearsExperience: provider.instructor_id
          ? (experience.get(provider.instructor_id) ?? 0)
          : 0,
        avatarUrl: provider.instructor_id
          ? avatars.get(provider.instructor_id)
          : undefined,
        price,
        providerEarning: isPlatform ? null : approved,
      } satisfies ServiceProvider;
    })
    .sort((a, b) => a.price - b.price);
}

export type ServiceOrderRow = {
  id: string;
  buyerProfileId: string;
  serviceId: string | null;
  serviceName: string;
  instructorId: string | null;
  instructorName: string | null;
  providerId: string | null;
  /** اسم مقدّم الخدمة — المنصة أو المدرب أو المستقل. */
  providerName: string | null;
  providerKind: 'platform' | 'instructor' | 'individual' | null;
  /** موعد التسليم المتفق عليه. بيتحط وقت تأكيد الدفع. */
  dueAt: string | null;
  dueNote: string | null;
  amount: number;
  status: string;
  transactionReference: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  paymentReceiptUrl: string | null;
  createdAt: string;
  deliveredAt: string | null;
  completedAt: string | null;
  instructorEarning: number | null;
  /** لمين الخدمة: المشتري نفسه، أو فرد من عائلته. */
  participantType: 'self' | 'child';
  /** اسم المستفيد لما يكون فرد من العائلة. فاضي لما الطلب للمشتري. */
  participantName: string | null;
  /** تاريخ ميلاد المستفيد — مقدّم الخدمة بيظبط الشغل على السن. */
  participantBirthDate: string | null;
};

async function mapServiceOrders(rows: any[]): Promise<ServiceOrderRow[]> {
  return rows.map((row) => {
    const service = row.standalone_services as { name: string } | null;
    const instructor = row.instructors as { display_name: string } | null;
    const provider = row.service_providers as
      | { display_name: string; kind: 'platform' | 'instructor' | 'individual' }
      | null;
    const participant = row.child_profiles as
      | { full_name: string; birth_date: string | null }
      | null;
    return {
      id: row.id,
      buyerProfileId: row.buyer_profile_id,
      serviceId: row.standalone_service_id,
      serviceName: service?.name ?? 'خدمة غير معروفة',
      instructorId: row.instructor_id,
      instructorName: instructor?.display_name ?? null,
      providerId: row.provider_id ?? null,
      // الاسم القديم بيفضل احتياطي للطلبات اللي اتعملت قبل نظام المقدّمين.
      providerName: provider?.display_name ?? instructor?.display_name ?? null,
      providerKind: provider?.kind ?? (instructor ? 'instructor' : null),
      dueAt: row.due_at ?? null,
      dueNote: row.due_note ?? null,
      amount: row.amount,
      status: row.status,
      transactionReference: row.transaction_reference,
      paymentReference: row.payment_reference ?? null,
      paymentMethod: row.payment_method ?? null,
      paymentReceiptUrl: row.payment_receipt_url ?? null,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at ?? null,
      completedAt: row.completed_at ?? null,
      instructorEarning: row.instructor_earning ?? null,
      participantType: (row.participant_type === 'child' ? 'child' : 'self') as 'self' | 'child',
      participantName: participant?.full_name ?? null,
      participantBirthDate: participant?.birth_date ?? null,
    };
  });
}

// اسم المستفيد جاي مع الطلب. من غيره مقدّم الخدمة بينفّذ شغل مايعرفش
// هو لمين — وفي خدمة تربوية للأطفال ده فرق في المحتوى نفسه مش في
// العرض بس.
const SERVICE_ORDER_SELECT =
  'id, buyer_profile_id, standalone_service_id, instructor_id, provider_id, due_at, due_note, amount, status, transaction_reference, payment_reference, payment_method, payment_receipt_url, created_at, delivered_at, completed_at, instructor_earning, participant_type, child_id, standalone_services(name), instructors(display_name), service_providers(display_name, kind), child_profiles(full_name, birth_date)';

/** Every service order — row-level security limits this to admins. */
export async function getAllServiceOrders(): Promise<ServiceOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return mapServiceOrders(data);
}

/** The signed-in customer's own service orders. */
export async function getMyServiceOrders(): Promise<ServiceOrderRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT)
    .eq('buyer_profile_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return mapServiceOrders(data);
}

/**
 * The instructor record belonging to the signed-in user, if any.
 * Returns null for anyone who is not an instructor.
 */
export async function getMyInstructorId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('instructors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}

/** Service orders placed for one instructor, newest first. */
export async function getServiceOrdersForInstructor(
  instructorId: string
): Promise<ServiceOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT)
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return mapServiceOrders(data);
}

/** طلبات مقدّم خدمة بعينه — المنصة أو مدرب أو مستقل. */
export async function getServiceOrdersByProvider(
  providerId: string
): Promise<ServiceOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT)
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return mapServiceOrders(data);
}

/**
 * One service order, for the order screen.
 *
 * Row-level security decides who may read it: the buyer, the assigned
 * instructor, or an admin. Anyone else gets null, so the page itself does not
 * have to repeat the authorisation rule.
 */
export async function getServiceOrderDetail(orderId: string): Promise<ServiceOrderRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT)
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) return null;
  const [row] = await mapServiceOrders([data]);
  return row ?? null;
}

export type ServiceOrderMessage = {
  id: string;
  orderId: string;
  senderProfileId: string;
  senderName: string;
  body: string;
  isDelivery: boolean;
  createdAt: string;
};

/** The conversation on one order, oldest first. */
export async function getServiceOrderMessages(
  orderId: string
): Promise<ServiceOrderMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_order_messages')
    .select('id, order_id, sender_profile_id, body, is_delivery, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const senderIds = Array.from(new Set(data.map((m) => m.sender_profile_id)));
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', senderIds);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return data.map((m) => ({
    id: m.id,
    orderId: m.order_id,
    senderProfileId: m.sender_profile_id,
    senderName: nameById.get(m.sender_profile_id) ?? 'مستخدم',
    body: m.body,
    isDelivery: m.is_delivery,
    createdAt: m.created_at,
  }));
}

