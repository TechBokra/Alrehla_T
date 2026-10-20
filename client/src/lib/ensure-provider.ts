import 'server-only';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';

/**
 * صف «مقدّم الخدمة» لحساب دوره `service_provider` — **لو مش موجود، بيتعمل**.
 *
 * ── العطل اللي ده بيقفله ────────────────────────────────────
 *
 * قبول طلب انضمام لرسّام أو معلّق صوتي أو كاتب بيوصّل الإدارة لشاشة
 * «المستخدمين» بالدور `service_provider` متملّي. الشاشة بتعمل الحساب
 * وبتحطّ الدور — **وبس**. ومفيش ولا سطر كان بيعمل صفّ المقدّم في
 * `service_providers`.
 *
 * والنتيجة إن لوحة مقدّم الخدمة بتدوّر على صفّه (`getMyProvider`)
 * ومالاقيهوش: الشخص اتقبل، وعنده دور، ولوحته فاضية أو مكسورة. وده
 * بالظبط اللي الكود نفسه محذّر منه في `admin-users.ts`:
 * **«دور من غير ملف = لوحة فاضية وحساب مكسور»** — اتقفل للناشر
 * (`ensurePublisherRow`) واتنسي للمقدّم.
 *
 * ⚠️ **وبقى له أثر مالي كمان** بعد السجلّ الموحّد (20261016160000):
 *    مستحقات المقدّم بتتسجّل على `service_providers.id`. من غير الصف،
 *    الشغل يكتمل والمستحق مالوش صاحب.
 *
 * ⚠️ **بمفتاح الخدمة عن قصد** — زي نظيرتها عند الناشر. المقدّم مالوش
 *    صلاحية إدراج في الجدول، والدالة بتتنادى بعد ما الدور اتأكد.
 *
 * ⚠️ **والحالة بتبدأ `pending` لا `active`** — وده الفرق المقصود عن
 *    الناشر. شاشة «مقدّمو الخدمة» فيها تفعيل فعلي، ولوحة المقدّم نفسها
 *    بتقول «حسابك تحت المراجعة — لن تصلك طلبات قبل تفعيله». فالتفعيل
 *    التلقائي كان هيخلّي الإدارة تلاقي مقدّمًا شغّالًا ما راجعتهوش.
 */
export async function ensureProviderRow(
  userId: string,
  name: string,
): Promise<{ id: string } | null> {
  if (!isAdminApiConfigured()) {
    console.error('SUPABASE_SERVICE_ROLE_KEY missing — provider row not created');
    return null;
  }
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('service_providers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data: created, error } = await admin
    .from('service_providers')
    .insert({
      // القيد `service_providers_kind_shape`: المستقل له `user_id`
      // و`instructor_id` لازم يفضل فاضي.
      kind: 'individual',
      user_id: userId,
      display_name: name.trim() || 'مقدّم خدمة',
      bio: '',
      status: 'pending',
      is_public: false,
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('Error creating service provider row', error);
    return null;
  }
  return { id: created.id };
}

/**
 * نفس الدالة، بس **بتسأل القاعدة الأول** إن الحساب دوره مقدّم خدمة —
 * للحالة اللي النداء جاي فيها من لوحة المقدّم نفسه، فالحسابات القديمة
 * اللي اتعملت قبل الإصلاح ده تتصلّح أول ما تفتح لوحتها.
 */
export async function ensureProviderRowForProvider(
  userId: string,
): Promise<{ id: string } | null> {
  if (!isAdminApiConfigured()) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.role !== 'service_provider') return null;
  return ensureProviderRow(userId, profile.full_name ?? '');
}
