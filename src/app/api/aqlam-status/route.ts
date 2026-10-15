import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { getSupabasePublicKey, getSupabaseUrl } from '@/lib/supabase/env';
import { normalizeAqlamSettings } from '@/lib/aqlam/settings';

/**
 * تشخيص مؤقت: النشر الحالي شايف أقلام الرحلة إزاي؟
 * بيقارن القراءة الطازجة من القاعدة بقراءة الموقع المعتادة (اللي ممكن تكون
 * مخزّنة). مفيش أسرار هنا — عنوان Supabase والـSHA معلومات غير سرية.
 * ⚠️ يتشال بعد ما نخلّص التشخيص.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const url = getSupabaseUrl();
  const fresh = createClient(url, getSupabasePublicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  const { data, error } = await fresh.from('site_settings').select('value').eq('key', 'general').single();
  const cached = await getSiteSettings();

  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      env: process.env.VERCEL_ENV ?? null,
      supabaseHost: new URL(url).host,
      freshMode: data ? normalizeAqlamSettings(data.value).mode : null,
      freshError: error?.message ?? null,
      siteSettingsMode: cached.aqlam.mode,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
