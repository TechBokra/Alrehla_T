import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/data/domains/auth';
import { getUnreadNotificationCount } from '@/data/domains/account';

/**
 * حالة المستخدم للهيدر.
 *
 * ليه مسار منفصل بدل ما الهيدر يقراها بنفسه؟
 * أي مكوّن على الخادم بيقرا الكوكيز بيخلي الصفحة اللي فيه «ديناميكية» —
 * تتبني من الصفر مع كل زيارة، ومفيش تخزين مؤقت. والهيدر موجود في كل
 * صفحة، فكان بيمنع تخزين الموقع كله.
 *
 * دلوقتي الهيدر بيتبني ثابتًا، والمتصفح بيسأل المسار ده عن حالة المستخدم
 * بعد ما الصفحة تظهر. الصفحة بتوصل أسرع، والفرق الوحيد إن زرار الحساب
 * بيظهر بعد جزء من الثانية.
 *
 * `no-store` مهمة: ده رد يخص مستخدمًا بعينه، وممنوع يتخزّن في أي وسيط.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const isVisitor = user.role === 'visitor';

    let dashboardLabel: string | undefined;
    if (user.role === 'student') {
      try {
        const { getDependentGuardian } = await import('@/lib/auth-guard');
        const dependent = await getDependentGuardian(user.id);
        dashboardLabel = dependent ? 'حساب الطالب' : 'حساب مستخدم';
      } catch {
        dashboardLabel = 'حساب مستخدم';
      }
    }

    return NextResponse.json(
      {
        role: user.role,
        fullName: isVisitor ? '' : user.fullName,
        unreadCount: isVisitor ? 0 : await getUnreadNotificationCount(),
        dashboardLabel,
      },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch {
    // فشل القراءة يعني «زائر» — الهيدر يعرض زرار الدخول، والموقع يكمل.
    return NextResponse.json(
      { role: 'visitor', fullName: '', unreadCount: 0 },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  }
}
