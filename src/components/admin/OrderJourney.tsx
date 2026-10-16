import React from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { DeadlineChip } from '@/components/admin/DeadlineChip';
import { getOrderJourney } from '@/data/domains/(admin)/tasks/journey';

/**
 * «رحلة الطلب» — بديل لافتة «مين ماسك الطلب» في صفحة الطلب: كل مراحل الطلب من الدفع للتسليم في
 * مكان واحد، ومعاها مشروع/مشاريع الاستوديو لبنوده المخصّصة (مرحلته ومسؤوله وموعده).
 * الاستوديو هنا مرحلة من الرحلة، مش عالم منفصل. بيعرض حاجة بس لو فيه مهام أو مشاريع.
 */
export async function OrderJourney({
  orderId,
  orderStatus,
  canOpenStudio,
}: {
  orderId: string;
  orderStatus: string;
  canOpenStudio: boolean;
}) {
  const { steps, projects } = await getOrderJourney(orderId);
  if (steps.length === 0 && projects.length === 0) return null;
  // الطلب اتجهّز/اتشحن ولسه فيه قصة مخصّصة ماتسلّمتش — تنبيه (مش منع): قرار التجهيز بتاع الفريق.
  const unfinished = projects.filter((p) => !p.terminal).length;
  const fulfilmentStarted = ['preparing', 'shipped', 'delivered'].includes(orderStatus);

  return (
    <section aria-labelledby="journey-h" className="mb-6 space-y-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="journey-h" className="flex items-center gap-2 text-sm font-black text-blue-900">
          <ClipboardList className="h-5 w-5" aria-hidden="true" /> رحلة الطلب
        </h2>
        <Link href="/dashboard/admin/tasks" className="text-sm font-bold text-blue-800 underline underline-offset-4">
          «مهامي»
        </Link>
      </div>

      {fulfilmentStarted && unfinished > 0 && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-900">
          الطلب في مرحلة التجهيز/الشحن، ولسه {unfinished.toLocaleString('ar-EG')} من القصص المخصّصة فيه ماتسلّمتش.
          اتأكد إن الكتاب جاهز قبل ما الطلب يتشحن.
        </p>
      )}

      {steps.length > 0 && (
        <ol className="space-y-2" aria-label="مراحل الطلب">
          {steps.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white p-3 text-sm">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black ${
                  s.state === 'done' ? 'bg-emerald-100 text-emerald-900' : 'bg-blue-900 text-white'
                }`}
                aria-hidden="true"
              >
                {s.state === 'done' ? '✓' : '●'}
              </span>
              <Link href={s.href} className="font-bold text-slate-900 hover:underline">
                {s.label}
              </Link>
              <span className="text-xs font-medium text-slate-600">
                {s.state === 'done' ? 'خلصت' : 'جارية'}
                {' · '}
                {s.assignees.length > 0 ? s.assignees.join('، ') : 'من غير مسؤول'}
              </span>
              <DeadlineChip d={s.deadline} dueAt={s.dueAt} />
            </li>
          ))}
        </ol>
      )}

      {projects.map((p) => (
        <div key={p.id} className="space-y-3 rounded-xl bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-black text-slate-900">{p.title}</span>
            <StatusBadge label={p.stageLabel} type={p.tone} />
            {!p.terminal && !p.held && (
              <span className="text-xs font-medium text-slate-600">
                عند: {p.assignees.length > 0 ? p.assignees.join('، ') : p.owner}
              </span>
            )}
            {p.held && <span className="text-xs font-bold text-slate-600">موقوف مؤقتًا</span>}
            {p.deadline && !p.terminal && <DeadlineChip d={p.deadline} dueAt={p.dueAt} />}
            {canOpenStudio && (
              <Link href={`/dashboard/admin/studio/${p.id}`} className="ms-auto text-xs font-bold text-slate-700 underline">
                فتح المشروع في الاستوديو
              </Link>
            )}
          </div>
          {p.orderClosed && !p.terminal && (
            <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs font-bold text-rose-900">
              الطلب اتلغى أو اتردّ والمشروع لسه شغّال — محتاج قرار من مسؤول الإنتاج.
            </p>
          )}
          <ol className="flex flex-wrap gap-1.5" aria-label="مراحل إنتاج القصة">
            {p.pipeline.map((st) => (
              <li
                key={st.key}
                aria-current={st.state === 'current' ? 'step' : undefined}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  st.state === 'done'
                    ? 'bg-emerald-100 text-emerald-900'
                    : st.state === 'current'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {st.label}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
