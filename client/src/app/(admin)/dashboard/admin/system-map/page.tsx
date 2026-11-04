import type { Metadata } from 'next';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { createClient } from '@/lib/supabase/server';
import { hasAdminPermission } from '@/lib/utils';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import Link from 'next/link';
import { LINE_LABELS, SEV_CHIP, SEV_LABELS, detectFindings, type OpsHealth } from '@/lib/data-map';
import { DataMap } from './DataMap';
import { RescanButton } from './RescanButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'خريطة البيانات', robots: { index: false } };

const ar = (n: number) => n.toLocaleString('ar-EG');
const card = 'rounded-3xl border border-slate-200 bg-white p-5';

/**
 * خريطة البيانات وصحة النظام — طلب تامر (٢٧ أكتوبر): «تبويب خاص في لوحة
 * التحكم يساعدنا في الرؤية والفهم». الخريطة من `lib/data-map`، والأرقام
 * من `ops_health()` لحظة فتح الصفحة.
 */
export default async function SystemMapPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canViewAuditLogs')) return <Unauthorized />;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('ops_health');
  const health = error ? null : (data as unknown as OpsHealth);
  if (error && error.code !== 'PGRST202') console.error('ops_health', error);
  // ⚠️ الفحص بيطلّع المشاكل الحالية بس — اللي اتصلح مابيظهرش (قرار تامر).
  const findings = detectFindings(health);

  const overdue = health?.tasks.reduce((s, t) => s + t.overdue, 0) ?? 0;
  const open = health?.tasks.reduce((s, t) => s + t.open, 0) ?? 0;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-10 sm:px-6">
      <DashboardPageHeader title="خريطة البيانات" />
      <div className="-mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-3xl font-medium leading-relaxed text-slate-600">
          فاحص حي: كل ما تفتح الصفحة أو تدوس «افحص تاني»، بيقرا أرقام القاعدة ويطلّع نقاط التكدّس الموجودة دلوقتي بس، ومعاها
          الإصلاح المقترح. اللي اتصلح بيختفي لوحده.
          {health
            ? ` آخر فحص: ${new Date(health.at).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' })}.`
            : ''}
        </p>
        <RescanButton />
      </div>

      {!health && (
        <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          الأرقام الحيّة محتاجة ترحيل 20261027120000_ops_health يتشغّل — الخريطة ظاهرة من غيرها.
        </p>
      )}

      {health && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['مهام مفتوحة', ar(open), overdue > 0 ? `${ar(overdue)} متأخرة` : 'مفيش متأخر', overdue > 0],
            ['مشاريع قصص شغّالة', ar(health.studio.open), `${ar(health.studio.no_owner)} من غير مسؤول`, health.studio.no_owner > 0],
            ['حجم القاعدة', `${ar(health.db_size_mb)} MB`, `${ar(health.tables)} جدول`, false],
            ['الاتصالات', `${ar(health.connections)} / ${ar(health.max_connections)}`, 'بعيد عن الحد', health.connections > health.max_connections * 0.7],
            ['إشعارات', ar(health.rows.notifications ?? 0), `${ar(health.rows.notifications_old_read ?? 0)} قديمة مقروءة`, false],
            ['طلبات مستنية دفع', ar(health.rows.orders_pending ?? 0), `من ${ar(health.rows.orders ?? 0)} طلب`, false],
          ].map(([k, v, sub, warn]) => (
            <div key={k as string} className={`rounded-2xl border p-4 ${warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
              <p className="text-xs font-bold text-slate-500">{k}</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{v}</p>
              <p className={`text-xs font-bold ${warn ? 'text-amber-800' : 'text-slate-500'}`}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      <DataMap findings={findings} />

      <section className="space-y-3" aria-labelledby="hots-h">
        <h2 id="hots-h" className="text-xl font-black text-slate-900">
          نتيجة الفحص
        </h2>
        {!health ? null : findings.length === 0 ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 font-bold text-emerald-900">
            مفيش تكدّس دلوقتي. افحص تاني بعد فترة، أو لما تحس إن حاجة بطيئة أو طلبات واقفة.
          </p>
        ) : (
          <ul className="space-y-2">
            {findings.map((f, i) => (
              <li
                key={f.id}
                className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.2fr)_7rem] sm:items-start"
              >
                <span className="font-black tabular-nums text-slate-400">{(i + 1).toLocaleString('ar-EG')}</span>
                <div>
                  <p className="font-black text-slate-900">{f.title}</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{f.evidence}</p>
                </div>
                <div className="text-sm font-medium leading-relaxed text-slate-600">
                  {f.fix}
                  {f.href && (
                    <Link href={f.href} className="ms-2 font-black text-emerald-800 hover:underline">
                      {f.hrefLabel ?? 'افتح'} ←
                    </Link>
                  )}
                </div>
                <span className={`h-fit w-fit rounded-full px-3 py-1 text-xs font-black ${SEV_CHIP[f.sev]}`}>{SEV_LABELS[f.sev]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {health && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className={card} aria-labelledby="tasks-h">
            <h2 id="tasks-h" className="mb-3 font-black text-slate-900">
              المهام المفتوحة
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-black text-slate-500">
                  <th className="pb-2 text-start">الخط</th>
                  <th className="pb-2 text-start">مفتوحة</th>
                  <th className="pb-2 text-start">متأخرة</th>
                  <th className="pb-2 text-start">قواعد التوزيع</th>
                </tr>
              </thead>
              <tbody>
                {health.tasks.map((t) => (
                  <tr key={t.line} className="border-t border-slate-100">
                    <td className="py-2 font-bold">{LINE_LABELS[t.line] ?? t.line}</td>
                    <td className="py-2 tabular-nums">{ar(t.open)}</td>
                    <td className={`py-2 tabular-nums ${t.overdue > 0 ? 'font-black text-rose-700' : ''}`}>{ar(t.overdue)}</td>
                    <td className={`py-2 tabular-nums ${(health.rules_by_line[t.line] ?? 0) === 0 ? 'font-bold text-amber-700' : ''}`}>
                      {ar(health.rules_by_line[t.line] ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs font-medium text-slate-500">
              «قواعد التوزيع» صفر = المهام بتروح لكل المشرفين. حدّد الناس من «توزيع المهام».
            </p>
          </section>

          <section className={card} aria-labelledby="slow-h">
            <h2 id="slow-h" className="mb-3 font-black text-slate-900">
              أبطأ العمليات في القاعدة
            </h2>
            <QueryList rows={health.slow.map((s) => ({ q: s.q, a: `${ar(s.mean_ms)} م.ث`, b: `${ar(s.calls)} مرة` }))} />
            <p className="mt-3 text-xs font-medium text-slate-500">متوسط الوقت للنداء. أقل من 100 م.ث مريح.</p>
          </section>

          <section className={card} aria-labelledby="hot-h">
            <h2 id="hot-h" className="mb-3 font-black text-slate-900">
              أكتر العمليات تكرارًا
            </h2>
            <QueryList rows={health.hot.map((s) => ({ q: s.q, a: `${ar(s.calls)} مرة`, b: `${ar(Math.round(s.total_ms / 1000))} ث إجمالي` }))} />
            <p className="mt-3 text-xs font-medium text-slate-500">من آخر تصفير لإحصائيات القاعدة.</p>
          </section>
        </div>
      )}
    </div>
  );
}

function QueryList({ rows }: { rows: { q: string; a: string; b: string }[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">مفيش إحصائيات.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r, i) => (
        <li key={i} className="flex items-start justify-between gap-3 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
          <span dir="ltr" className="min-w-0 break-all font-mono text-xs text-slate-700">
            {r.q}
          </span>
          <span className="shrink-0 text-end">
            <span className="block font-black tabular-nums text-slate-900">{r.a}</span>
            <span className="block text-xs text-slate-500">{r.b}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
