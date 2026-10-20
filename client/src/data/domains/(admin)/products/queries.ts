import { PersonalizedProduct } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { mapProductRow } from '@/data/domains/(shared)/products/products-internal';

/**
 * منتج واحد لصفحة التعديل (إدارة أو ناشر) — **بالرقم مباشرة** بدل ما
 * الصفحة تجيب الكتالوج كله وتدوّر فيه (مراجعة م. محمد). بالجلسة: السياسات
 * بتقرّر مين يشوفه (الإداري كله، والناشر بتاعه). `null` = مش موجود/مش ليه.
 */
export async function getManagedProductById(id: string): Promise<PersonalizedProduct | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('personalized_products').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('تعذّر قراءة المنتج', error);
    throw new Error('تعذّر تحميل المنتج');
  }
  return data ? mapProductRow(data) : null;
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
  (PersonalizedProduct & { publisherName?: string; isEdit?: boolean; liveName?: string })[]
> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  // ⚠️ ملف 16: تعديلات الناشر على المعتمد (`pending_changes`) مستنية برضه.
  //    قبل ما الملف يتشغّل العمود مش موجود — فبنرجع للاستعلام القديم بدل
  //    ما الشاشة تفضى.
  const base = () =>
    supabase
      .from('personalized_products')
      .select('*')
      // الأقدم أولًا: اللي مستني من أسبوع يتشاف قبل اللي اتبعت النهارده.
      .order('updated_at', { ascending: true });
  let { data, error } = await base().or('review_status.eq.pending,pending_changes.not.is.null');
  if (error) ({ data, error } = await base().eq('review_status', 'pending'));

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
    // تعديل على معتمد: الشاشة بتعرض **المقترح**، ومعاه علامة إنه تعديل.
    ...(p.review_status === 'approved' && p.pending_changes
      ? { ...mapProductRow(p).pendingDraft!, isEdit: true, liveName: String(p.name ?? '') }
      : mapProductRow(p)),
    reviewStatus: 'pending' as const,
    publisherName: p.publisher_id
      ? (names.get(p.publisher_id as string) ?? 'ناشر غير معروف')
      : undefined,
  }));
}
