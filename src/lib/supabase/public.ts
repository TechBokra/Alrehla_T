import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseFetch } from './env';

/**
 * عميل للقراءة العامة — **من غير كوكيز**.
 *
 * ليه موجود؟
 * العميل العادي (`server.ts`) بيقرا الكوكيز عشان يعرف المستخدم. وقراءة
 * الكوكيز بتخلّي Next.js يعتبر الصفحة «ديناميكية»: تتبني من الصفر مع كل
 * زيارة، ومفيش تخزين مؤقت. ولأن الهيدر بيستخدمه، **كل صفحة في الموقع**
 * كانت ديناميكية — حتى صفحة الشروط والأحكام اللي ما بتتغيرش.
 *
 * العميل ده بيقرا بصلاحية الزائر المجهول بس، فمناسب تمامًا للبيانات
 * العامة: إعدادات الموقع، نصوص الصفحات، المنتجات، المقالات.
 *
 * ⚠️ متستخدمهوش لأي حاجة تخص مستخدمًا بعينه — مش هيشوف حاجة، ولو شاف
 * يبقى فيه قاعدة صلاحيات غلط. ولمّا تحتاج تكتب، استخدم العميل العادي.
 */
export function createPublicClient() {
  const customFetch = getSupabaseFetch();
  return createSupabaseClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: customFetch ? { fetch: customFetch } : undefined,
    },
  );
}
