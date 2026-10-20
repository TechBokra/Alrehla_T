import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

/**
 * خدمة الروابط المختصرة لمنصة الرحلة:
 *
 * تحويل الروابط الطويلة أو المشفرة باللغة العربية إلى روابط قصيرة ونظيفة:
 * - المقالات: /s/b/:idOrSlug -> /blog/:slug
 * - المنتجات: /s/p/:idOrSlug -> /enha-lak/product/:slug
 * - الخدمات: /s/s/:id -> /creative-writing/services/:id
 * - الأقسام:
 *    /s/el -> /enha-lak
 *    /s/lib -> /enha-lak/library
 *    /s/custom -> /enha-lak/custom
 *    /s/cw -> /creative-writing
 *    /s/pkg -> /creative-writing/packages
 *    /s/services -> /creative-writing/services
 *    /s/blog -> /blog
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    return NextResponse.redirect(new URL('/', request.url), 307);
  }

  const [section, identifier] = slug;

  // اختصارات الأقسام الرئيسية
  switch (section) {
    case 'el':
      return NextResponse.redirect(new URL('/enha-lak', request.url), 307);
    case 'lib':
      return NextResponse.redirect(new URL('/enha-lak/library', request.url), 307);
    case 'custom':
      return NextResponse.redirect(new URL('/enha-lak/custom', request.url), 307);
    case 'cw':
      return NextResponse.redirect(new URL('/creative-writing', request.url), 307);
    case 'pkg':
    case 'packages':
      return NextResponse.redirect(new URL('/creative-writing/packages', request.url), 307);
    case 'services':
      return NextResponse.redirect(new URL('/creative-writing/services', request.url), 307);
    case 'blog':
      return NextResponse.redirect(new URL('/blog', request.url), 307);
    default:
      break;
  }

  const supabase = createPublicClient();

  // مقالات المدونة: /s/b/:idOrSlug
  if (section === 'b' && identifier) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    let postSlug: string | null = null;

    if (isUuid) {
      const { data } = await supabase
        .from('blog_posts')
        .select('slug')
        .eq('id', identifier)
        .maybeSingle();
      if (data?.slug) postSlug = data.slug;
    } else if (/^[0-9a-f]{6,12}$/i.test(identifier)) {
      // بحث بالبادئة الست عشرية لمعرف المقال
      const { data } = await supabase
        .from('blog_posts')
        .select('slug, id')
        .ilike('id', `${identifier}%`)
        .limit(1)
        .maybeSingle();
      if (data?.slug) postSlug = data.slug;
    }

    if (!postSlug) {
      const decoded = decodeURIComponent(identifier);
      const { data } = await supabase
        .from('blog_posts')
        .select('slug')
        .or(`slug.eq.${decoded},slug.eq.${identifier}`)
        .limit(1)
        .maybeSingle();
      if (data?.slug) postSlug = data.slug;
    }

    if (postSlug) {
      return NextResponse.redirect(
        new URL(`/blog/${encodeURIComponent(postSlug)}`, request.url),
        307
      );
    }

    return NextResponse.redirect(new URL('/blog', request.url), 307);
  }

  // المنتجات: /s/p/:idOrSlug
  if (section === 'p' && identifier) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    let productSlug: string | null = null;

    if (isUuid) {
      const { data } = await supabase
        .from('personalized_products')
        .select('slug')
        .eq('id', identifier)
        .maybeSingle();
      if (data?.slug) productSlug = data.slug;
    } else if (/^[0-9a-f]{6,12}$/i.test(identifier)) {
      const { data } = await supabase
        .from('personalized_products')
        .select('slug, id')
        .ilike('id', `${identifier}%`)
        .limit(1)
        .maybeSingle();
      if (data?.slug) productSlug = data.slug;
    }

    if (!productSlug) {
      const decoded = decodeURIComponent(identifier);
      const { data } = await supabase
        .from('personalized_products')
        .select('slug')
        .or(`slug.eq.${decoded},slug.eq.${identifier}`)
        .limit(1)
        .maybeSingle();
      if (data?.slug) productSlug = data.slug;
    }

    if (productSlug) {
      return NextResponse.redirect(
        new URL(`/enha-lak/product/${encodeURIComponent(productSlug)}`, request.url),
        307
      );
    }

    return NextResponse.redirect(new URL('/enha-lak', request.url), 307);
  }

  // الخدمات الإبداعية: /s/s/:id
  if (section === 's' && identifier) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    let serviceId = identifier;

    if (!isUuid && /^[0-9a-f]{6,12}$/i.test(identifier)) {
      const { data } = await supabase
        .from('standalone_services')
        .select('id')
        .ilike('id', `${identifier}%`)
        .limit(1)
        .maybeSingle();
      if (data?.id) serviceId = data.id;
    }

    return NextResponse.redirect(
      new URL(`/creative-writing/services/${encodeURIComponent(serviceId)}`, request.url),
      307
    );
  }

  return NextResponse.redirect(new URL('/', request.url), 307);
}
