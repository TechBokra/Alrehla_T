import 'server-only';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { slugFromName } from '@/lib/product-input';

/**
 * صف «دار النشر» لحساب دوره ناشر — **لو مش موجود، بيتعمل**.
 *
 * ── العطل اللي ده بيقفله ────────────────────────────────────
 *
 * لوحة الناشر كلها (منتجاتي، إضافة منتج، ملفي) بتدوّر على صفّه في جدول
 * `publishers`. **ومفيش ولا سطر في الكود كان بيعمل الصف ده** — في
 * القاعدة القديمة الناشرين اتعملوا بإيد في القاعدة. فبعد إعادة البناء،
 * أي حساب الإدارة تخلّيه «ناشر» بيفتح «منتجاتي» يلاقي «الصفحة غير
 * موجودة»، ومالوش أي طريقة يضيف منتج. (ملاحظة فريق العمل.)
 *
 * دلوقتي الصف بيتعمل:
 *   • لما الإدارة تخلّي حد «ناشر» (إنشاء أو تغيير دور)
 *   • ولو الحساب ناشر من قبل كده ومالوش صف — أول ما يفتح لوحته
 *
 * ⚠️ **بمفتاح الخدمة عن قصد.** الناشر مالوش صلاحية إدراج في الجدول (ولا
 *    المفروض يبقى له — كان هيعمل لنفسه دور نشر كتير). والدالة دي
 *    بتتنادى بعد ما اتأكدنا إن الدور «ناشر» فعلًا من القاعدة.
 *
 * ⚠️ **الحالة «نشطة» (`active`) من الأول**: الدور نفسه اتحدد بإيد الإدارة،
 *    ومفيش شاشة في اللوحة بتفعّل دار نشر — لو بدأت «قيد المراجعة» كانت
 *    هتفضل كده للأبد، واسمها مايظهرش جنب كتبها ولا في فلتر المكتبة.
 *    وكل منتج لسه بيعدّي على مراجعة الإدارة لوحده قبل ما يظهر.
 */
export async function ensurePublisherRow(
  userId: string,
  name: string,
): Promise<{ id: string } | null> {
  if (!isAdminApiConfigured()) {
    console.error('SUPABASE_SERVICE_ROLE_KEY missing — publisher row not created');
    return null;
  }
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('publishers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const cleanName = name.trim() || 'دار نشر';
  const base = slugFromName(cleanName);

  // الرابط لازم يبقى فريد — لو الاسم متاخد، بنزوّد رقم.
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: taken } = await admin
      .from('publishers')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const { data: created, error } = await admin
    .from('publishers')
    .insert({ user_id: userId, name: cleanName, slug, bio: '', status: 'active' })
    .select('id')
    .single();

  if (error || !created) {
    console.error('Error creating publisher row', error);
    return null;
  }
  return { id: created.id };
}

/**
 * نفس الدالة، بس **بتسأل القاعدة الأول** إن الحساب دوره ناشر — للحالة
 * اللي النداء جاي فيها من لوحة الناشر نفسه.
 */
export async function ensurePublisherRowForPublisher(userId: string): Promise<{ id: string } | null> {
  if (!isAdminApiConfigured()) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.role !== 'publisher') return null;
  return ensurePublisherRow(userId, profile.full_name ?? '');
}
