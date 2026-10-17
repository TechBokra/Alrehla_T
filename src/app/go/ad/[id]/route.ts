import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { recordAdClick } from '@/actions/ads';
import { adIsLive, isAdPlacement } from '@/lib/ads';
import { getServerNow } from '@/data/server-time';

/**
 * نقرة إعلان: بتتسجّل، وبعدين تحويل.
 *
 * ── ليه مسار خادم مش `onClick` في المتصفح ────────────────────
 *
 * العدّ من المتصفح بيضيع: مانع الإعلانات بيقفل النداء، والزائر اللي
 * بيدوس وسط التحميل بيمشي قبل ما النداء يخرج، والـ`sendBeacon`
 * مابتشتغلش من غير جافاسكريبت. المسار ده بيتسجّل على الخادم **قبل**
 * التحويل، فالنقرة محسوبة طالما الزائر وصل.
 *
 * ── الأمان ──────────────────────────────────────────────────
 *
 * ⚠️ **الهدف بييجي من القاعدة، مش من الرابط.** لو كان
 *    `/go/ad?to=https://…` كان أي حد يبعت لينك من نطاقنا بيودّي
 *    لأي مكان — صفحة تصيّد على دومين الرحلة. هنا الـ`id` بس اللي
 *    بييجي من الزائر، والعنوان بيتقرا من صف الإعلان.
 *
 * ⚠️ **وإعلان مش شغّال مابيحوّلش**: لينك قديم من سكرين شوت أو من
 *    محرّك بحث بيرجّع الزائر للرئيسية، مش لمعلن خلص عقده.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const home = new URL('/', request.nextUrl.origin);

  // ⚠️ `id` من الزائر: لو مش UUID، القاعدة بترمي خطأ نوع. بنرجّع
  //    الرئيسية بدل صفحة خطأ.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.redirect(home, { status: 302 });
  }

  const placementParam = request.nextUrl.searchParams.get('p');
  const placement = placementParam && isAdPlacement(placementParam) ? placementParam : null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('ads')
    .select('id, link_url, is_active, starts_at, ends_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error loading ad for click', error);
    return NextResponse.redirect(home, { status: 302 });
  }

  // ⚠️ **فرق مهم:** السياسة العامة بترجّع الشغّال بس، فإعلان موقوف
  //    بيرجع `null` — نفس نتيجة «مش موجود». الاتنين بيروّحوا
  //    الرئيسية، فمفيش تسريب لوجود إعلان مخفي.
  if (!data) return NextResponse.redirect(home, { status: 302 });

  const now = getServerNow();
  if (
    !adIsLive(
      {
        isActive: data.is_active as boolean,
        startsAt: data.starts_at as string | null,
        endsAt: data.ends_at as string | null,
      },
      now,
    )
  ) {
    return NextResponse.redirect(home, { status: 302 });
  }

  // ⚠️ **التسجيل قبل التحويل، والفشل مابيوقفش التحويل** — اللي داس
  //    عايز يوصل. `recordAdClick` بتتعامل مع الخطأ جوّاها.
  await recordAdClick(id, placement);

  const link = (data.link_url as string | null)?.trim();
  if (!link) return NextResponse.redirect(home, { status: 302 });

  // المسار الداخلي بيتحوّل لعنوان كامل على نطاقنا؛ والخارجي زي ما هو
  // (و`cleanAdLink` وقت الحفظ ضمنت إنه `https://` أو `/…` وبس).
  const target = link.startsWith('/') ? new URL(link, request.nextUrl.origin) : new URL(link);

  return NextResponse.redirect(target, { status: 302 });
}
