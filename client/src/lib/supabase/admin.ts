import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * عميل الإدارة — للعمليات اللي مستحيل تتم بصلاحيات مستخدم عادي.
 *
 * ⚠️ المفتاح ده بيتخطى كل قواعد الحماية (RLS) في قاعدة البيانات.
 *
 * القواعد اللي بتحميه:
 *   1. `import 'server-only'` فوق — لو أي ملف واجهة استورد الملف ده بالغلط،
 *      البناء بيفشل. يعني مستحيل المفتاح يوصل للمتصفح.
 *   2. اسم المتغير من غير NEXT_PUBLIC_ — Next.js ما بتحطّهوش في كود المتصفح.
 *   3. كل دالة بتستخدمه بتتأكد من صلاحية الإدارة **قبل** ما تلمسه.
 *
 * المتغير لازم يتحط في Vercel (Settings → Environment Variables) وفي
 * .env.local محليًا. قيمته من: Supabase → Project Settings → API →
 * service_role.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // رسالة واضحة بدل انهيار غامض: ده أكتر خطأ متوقع بعد النشر.
    throw new Error(
      'إنشاء الحسابات غير مفعّل: متغير SUPABASE_SERVICE_ROLE_KEY غير موجود على الخادم.',
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** هل إنشاء الحسابات مفعّل على الخادم؟ تُستخدم لإخفاء الزر بدل إظهار خطأ. */
export function isAdminApiConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
