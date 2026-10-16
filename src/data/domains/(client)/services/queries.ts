import type { ServiceProvider, ProviderKind } from '@/types';
import { createPublicClient } from '@/lib/supabase/public';
import { getVisibleInstructors } from '@/data/domains/(shared)/instructors/public';
import { calculateFinalSessionPrice } from '@/lib/utils';


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
  // ⚡ بيانات عامة (معتمدة ومفعّلة) — عميل الزائر عشان الصفحات تتخزّن.
  const supabase = createPublicClient();

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
  // ── ليه `getVisibleInstructors()` مش استعلامًا مباشرًا ────────
  //
  // ⚠️ دي كانت `supabase.from('instructors').select(...)` بمفتاح
  //    المستخدم. وبعد ملف SQL 84 بقت قراءة جدول المدربين
  //    **للمسجَّلين وحدهم** — يعني الاستعلام ده بيرجع **فاضي للزائر**،
  //    بلا أي خطأ (قاعدة «ك»). والنتيجة إن كل مقدّم خدمة كان بيتعرض
  //    للزائر بـ«صفر سنوات خبرة»، والزائر هو بالظبط المشتري المحتمل.
  //
  //    `getVisibleInstructors()` بتمر على دالة `SECURITY DEFINER`
  //    (ملف 83) فبترجّع نفس البيانات للزائر والمسجَّل — ومعاها
  //    `avatar_url` اللي مكانش حد بيطلبه هنا أصلًا.
  const instructorIds = new Set(
    rows.map((r) => r.provider.instructor_id).filter((id): id is string => Boolean(id)),
  );

  const experience = new Map<string, number>();
  const avatars = new Map<string, string>();
  if (instructorIds.size > 0) {
    for (const i of await getVisibleInstructors()) {
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
    // معادلة المقدّمين — نفس اللي بيتحاسب بيها الطلب وقت الشراء،
    // وإلا السعر المعروض في الكتالوج يفرق عن اللي بيتحصّل فعلًا.
    const { data: f } = await supabase
      .from('pricing_formula_settings')
      .select('platform_multiplier, fixed_admin_fee')
      .eq('id', 'provider-default')
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
