import type { ServiceProviderAccount, ProviderKind } from '@/types';
import { createClient } from '@/lib/supabase/server';

export { getServiceOrdersByProvider } from '@/data/domains/(admin)/service-orders/queries';

/**
 * مقدّمو الخدمة — القراءة من ناحية الإدارة.
 *
 * الملف ده بيقرا الجدولين الجداد (`service_providers` و`provider_services`).
 * القراءة العامة اللي الزائر بيشوفها موجودة في `services.ts` — هنا الإدارة
 * بتشوف الكل، بما فيه المعلّق والموقوف.
 */

/** عرض خدمة واحدة من مقدّم واحد، كما تراه الإدارة. */
export type ProviderOffering = {
  id: string;
  providerId: string;
  serviceId: string;
  serviceName: string;
  /** سعر الخدمة المكتوب في كتالوج الخدمات — مرجع للمقارنة. */
  catalogPrice: number;
  requestedPrice: number | null;
  approvedPrice: number | null;
  status: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  adminNotes: string | null;
};

export type ProviderWithOfferings = ServiceProviderAccount & {
  /** البريد لو مقدّم مستقل أو مدرب له حساب — بيساعد الإدارة تتأكد مين ده. */
  email: string | null;
  offerings: ProviderOffering[];
};

function mapProvider(row: any): ServiceProviderAccount {
  return {
    id: row.id,
    kind: row.kind as ProviderKind,
    userId: row.user_id,
    instructorId: row.instructor_id,
    displayName: row.display_name,
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? undefined,
    status: row.status,
    isPublic: row.is_public,
    createdAt: row.created_at,
  };
}

/**
 * كل مقدّمي الخدمة ومعاهم عروضهم.
 *
 * تلات استعلامات ثابتة مهما كان عدد المقدّمين، بدل استعلام لكل واحد.
 */
export async function getProvidersForAdmin(): Promise<ProviderWithOfferings[]> {
  const supabase = await createClient();

  const [{ data: providers }, { data: offerings }, { data: services }] =
    await Promise.all([
      supabase
        .from('service_providers')
        .select('*')
        .order('kind', { ascending: true })
        .order('display_name', { ascending: true }),
      supabase.from('provider_services').select('*'),
      supabase.from('standalone_services').select('id, name, price'),
    ]);

  if (!providers) return [];

  const serviceById = new Map(
    (services ?? []).map((s) => [s.id, { name: s.name, price: s.price }]),
  );

  // البريد بييجي من جدول إداري منفصل، لأن جدول المستخدمين قراءته عامة
  // فالبريد مش متخزّن فيه.
  const userIds = providers.map((p) => p.user_id).filter((id): id is string => Boolean(id));
  const emailByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: emails } = await supabase
      .from('user_emails')
      .select('user_id, email')
      .in('user_id', userIds);
    for (const e of emails ?? []) emailByUser.set(e.user_id, e.email);
  }

  return providers.map((p) => ({
    ...mapProvider(p),
    email: p.user_id ? (emailByUser.get(p.user_id) ?? null) : null,
    offerings: (offerings ?? [])
      .filter((o) => o.provider_id === p.id)
      .map((o) => {
        const service = serviceById.get(o.service_id);
        return {
          id: o.id,
          providerId: o.provider_id,
          serviceId: o.service_id,
          serviceName: service?.name ?? 'خدمة محذوفة',
          catalogPrice: service?.price ?? 0,
          requestedPrice: o.requested_price,
          approvedPrice: o.approved_price,
          status: (o.status ?? 'pending') as ProviderOffering['status'],
          isActive: o.is_active,
          adminNotes: o.admin_notes,
        };
      })
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName, 'ar')),
  }));
}

/** صف مقدّم الخدمة الخاص بالمستخدم الحالي — للوحة مقدّم الخدمة. */
export async function getMyProvider(): Promise<ServiceProviderAccount | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // مقدّم مستقل: مربوط بالحساب مباشرة.
  const { data: direct } = await supabase
    .from('service_providers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (direct) return mapProvider(direct);

  // مدرب: مربوط من خلال صف المدرب.
  const { data: instructor } = await supabase
    .from('instructors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!instructor) return null;

  const { data: viaInstructor } = await supabase
    .from('service_providers')
    .select('*')
    .eq('instructor_id', instructor.id)
    .maybeSingle();

  return viaInstructor ? mapProvider(viaInstructor) : null;
}

/**
 * نفس `getMyProvider`، وبتعمل الصف لو الحساب دوره مقدّم خدمة ومالوش صف.
 *
 * ⚠️ **للحسابات اللي اتعملت قبل `ensure-provider`.** الدور كان بيتحط من
 *    شاشة المستخدمين والصف مابيتعملش، فلوحة المقدّم كانت بتفضل فاضية
 *    للأبد. اللوحة بتنادي دي، فالحساب بيتصلّح أول ما صاحبه يفتحها —
 *    زي نظيرتها عند الناشر بالظبط.
 */
export async function getMyProviderEnsured(): Promise<ServiceProviderAccount | null> {
  const existing = await getMyProvider();
  if (existing) return existing;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { ensureProviderRowForProvider } = await import('@/lib/ensure-provider');
  const created = await ensureProviderRowForProvider(user.id);
  return created ? getMyProvider() : null;
}

/** حساب صالح لإضافته كمقدّم خدمة مستقل. */
export type ProviderCandidate = {
  userId: string;
  email: string;
  fullName: string;
};

/**
 * الحسابات اللي ينفع تتضاف كمقدّمي خدمة مستقلين.
 *
 * بنستبعد المدربين (ليهم صف مقدّم تلقائي) واللي مضاف كمقدّم بالفعل —
 * عشان الإدارة تختار من قايمة كل اللي فيها ينفع، بدل ما تكتب بريد
 * وتكتشف بعد الحفظ إنه مش صالح.
 */
export async function getProviderCandidates(): Promise<ProviderCandidate[]> {
  const supabase = await createClient();

  const [{ data: emails }, { data: instructors }, { data: providers }] =
    await Promise.all([
      supabase.from('user_emails').select('user_id, email'),
      supabase.from('instructors').select('user_id'),
      supabase.from('service_providers').select('user_id'),
    ]);

  if (!emails) return [];

  const taken = new Set<string>();
  for (const i of instructors ?? []) if (i.user_id) taken.add(String(i.user_id));
  for (const p of providers ?? []) if (p.user_id) taken.add(String(p.user_id));

  const free = emails.filter((e) => !taken.has(String(e.user_id)));
  if (free.length === 0) return [];

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', free.map((e) => e.user_id));

  const nameById = new Map((profiles ?? []).map((p) => [String(p.id), p.full_name]));

  return free
    .map((e) => ({
      userId: String(e.user_id),
      email: e.email,
      fullName: nameById.get(String(e.user_id)) ?? '',
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}
