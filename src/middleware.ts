import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { UserRole } from '@/types';
import { needsPasswordSetup, SET_PASSWORD_PATH } from '@/lib/first-login';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole = 'visitor';
  let isAuthenticated = !!user;

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role) {
      role = profile.role as UserRole;
    } else {
      role = 'customer';
    }
  }

  // كان هنا باب تطوير: كوكي اسمه mockRole بيدّي أي زائر أي دور ويعتبره
  // مسجّل دخوله. اتشال هو والشريط اللي كان بيكتبه ودالة المستخدم الوهمي.

  const pathname = request.nextUrl.pathname;

  // ── حاجز أول دخول ──────────────────────────────────────────
  //
  // الحساب اللي الإدارة عملته برمز مؤقت بيتوقف هنا: مايشوفش لوحته
  // ولا حسابه ولا يعمل أي حاجة قبل ما يحطّ كلمة مروره.
  //
  // ⚠️ **الترتيب قبل كل الفحوص التانية عن قصد.** لو اتحط بعدها، كان
  //    الحساب هيعدّي فحص الدور الأول ويوصل لصفحة بتقرا بياناته —
  //    وهو لسه داخل برمز مرّ على واتساب.
  //
  // ⚠️ **والعلامة من `app_metadata`**: مفتاح الخدمة وحده اللي يكتب
  //    فيها، فالمستخدم مايقدرش يشيلها من المتصفح ويعدّي الحاجز.
  if (isAuthenticated && needsPasswordSetup(user)) {
    if (pathname !== SET_PASSWORD_PATH) {
      return NextResponse.redirect(new URL(SET_PASSWORD_PATH, request.url));
    }
    return supabaseResponse;
  }

  // Route Protection Rules
  //
  // ⚠️ **الحالتين دول مش حاجة واحدة، وكانوا متعاملين كحاجة واحدة.**
  //
  //   «مش مسجّل دخول»      ← لازم يسجّل  → صفحة الدخول
  //   «مسجّل بس الدور غلط» ← دخوله سليم  → لوحته هو
  //
  // الكود القديم كان بيبعت الاتنين لـ`/sign-in`. فالمدرب اللي دخل
  // صح وفتح رابط لوحة الإدارة (من إشعار مثلًا) كان يلاقي نفسه في
  // صفحة تسجيل الدخول — والرسالة اللي بتوصله: «أنا مش داخل». فيحاول
  // يدخل تاني، ويتبعت لـ`/dashboard`، وأول ما يرجع للرابط يترمي
  // تاني. حلقة كاملة شكلها «الموقع مش بيقبل دخولي».
  //
  // ⚠️ ومفيش حلقة في الحل: `/dashboard` بتوزّع كل دور على لوحته،
  //    والدور اللي بيوصلها مسجَّل بالفعل.
  const requireAuth = (allowedRoles?: UserRole[]) => {
    if (!isAuthenticated) {
      // وبناخد معانا المكان اللي كان رايحه، عشان يرجع له بعد الدخول
      // بدل ما يتوه في لوحة عامة.
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('next', pathname + request.nextUrl.search);
      return NextResponse.redirect(signInUrl);
    }
    if (allowedRoles && !allowedRoles.includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return null;
  };

  if (pathname.startsWith('/dashboard/admin')) {
    const redirectResponse = requireAuth(['super_admin', 'general_supervisor']);
    if (redirectResponse) return redirectResponse;
  } else if (pathname.startsWith('/dashboard/instructor')) {
    const redirectResponse = requireAuth(['instructor']);
    if (redirectResponse) return redirectResponse;
  } else if (pathname.startsWith('/dashboard/provider')) {
    // مش بنحدد دور هنا: المدرب اللي بيقدّم خدمة دوره لسه «مدرب»، والصفحة
    // نفسها بتتأكد إن للمستخدم صف مقدّم خدمة وبتحوّله لو مالوش.
    const redirectResponse = requireAuth();
    if (redirectResponse) return redirectResponse;
  } else if (pathname.startsWith('/dashboard/publisher')) {
    const redirectResponse = requireAuth(['publisher']);
    if (redirectResponse) return redirectResponse;
  } else if (pathname.startsWith('/dashboard/student')) {
    const redirectResponse = requireAuth(['student']);
    if (redirectResponse) return redirectResponse;
  } else if (pathname.startsWith('/account')) {
    const redirectResponse = requireAuth();
    if (redirectResponse) return redirectResponse;
    if (role === 'visitor') {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // ⚠️ حساب الطالب التابع **مالوش مكان هنا.**
    //
    // `/account` هي منطقة العميل/ولي الأمر: المركز العائلي، وطلبات
    // الأبناء، والاشتراكات، والدفع. والحماية كانت `requireAuth()` بس —
    // يعني أي مسجَّل بما فيهم الطالب.
    //
    // والهيدر بيوجّه الطالب لـ`/dashboard/student` صح، بس ده مش حاجز:
    // أي رابط `/account/...` (من إشعار مثلًا) كان بيدخّله.
    //
    // وأوضح نتيجة كانت شاشة «طلبات الأبناء»: الاستعلام مبيفلترش بالدور
    // (القاعدة بتفلتر)، و`can_see_dependent_request` بتسمح للطفل يشوف
    // طلبه هو — فالطالب كان بيشوف **طلباته هو** تحت عنوان «طلبات
    // الأبناء» ونص بيخاطبه كأنه الأب: «لما ابنك يطلب…».
    if (role === 'student') {
      return NextResponse.redirect(new URL('/dashboard/student', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/dashboard/:path*', '/account/:path*', '/set-password'],
};
