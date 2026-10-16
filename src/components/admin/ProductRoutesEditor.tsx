import React from 'react';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, Select, SubmitButton } from '@/components/forms/Form';
import { resetStudioProductRoute, saveStudioProductRoute } from '@/actions/studio-flow';
import {
  GATE_LABELS,
  ROUTE_STATES,
  ROUTE_STATE_LABELS,
  routeBase,
  type ProductRoute,
  type StudioFlow,
} from '@/lib/studio-flow';

type Product = { id: string; name: string; isActive: boolean };

/**
 * تسلسل المراحل لكل نوع منتج (قصة مخصّصة). التسلسل العام (من «سير العمل») هو الأصل؛ هنا
 * بتحدد لكل منتج: المرحلة إلزامية ولا اختيارية ولا غير مستخدمة، وأنهي شروط دخول بتتلغي له.
 * القاعدة (`studio_route_set` + المحفّز) هي اللي بتفرض ده على مشاريع المنتج فعلًا.
 */
export function ProductRoutesEditor({
  products,
  routes,
  flow,
}: {
  products: Product[];
  routes: Record<string, ProductRoute>;
  flow: StudioFlow;
}) {
  const stages = flow.steps.filter((s) => s.kind === 'stage' && s.active);
  if (products.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">
        مفيش منتجات «قصة مخصّصة» لسه. أول ما تضيف واحد هتلاقيه هنا.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {products.map((p) => {
        const route = routes[p.id] ?? {};
        const custom = Object.keys(route).length;
        return (
          <li key={p.id} className="rounded-2xl border border-slate-200 bg-white">
            <details>
              <summary className="flex min-h-[48px] cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
                <span className="text-sm font-black text-slate-900">{p.name}</span>
                {!p.isActive && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">غير منشور</span>
                )}
                <span
                  className={
                    custom > 0
                      ? 'rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900'
                      : 'rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900'
                  }
                >
                  {custom > 0 ? `تسلسل مخصّص (${custom.toLocaleString('ar-EG')})` : 'على التسلسل العام'}
                </span>
              </summary>
              <div className="space-y-4 border-t border-slate-100 p-4">
                <ActionForm
                  action={saveStudioProductRoute}
                  successMessage="اتحفظ تسلسل المنتج."
                  className="space-y-3"
                >
                  <input type="hidden" name="productId" value={p.id} />
                  <ul className="space-y-2">
                    {stages.map((s) => {
                      const o = route[s.step];
                      const state = o?.state ?? routeBase(s);
                      const gates = s.gates;
                      return (
                        <li key={s.step} className="space-y-2 rounded-xl bg-slate-50 p-3">
                          <input type="hidden" name="step" value={s.step} />
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="min-w-[10rem] flex-1 text-sm font-black text-slate-800">{s.label}</span>
                            <div className="w-44">
                              <Select
                                name={`state:${s.step}`}
                                defaultValue={state}
                                aria-label={`حالة «${s.label}» في ${p.name}`}
                              >
                                {ROUTE_STATES.map((r) => (
                                  <option key={r} value={r}>
                                    {ROUTE_STATE_LABELS[r]}
                                    {r === routeBase(s) ? ' (العام)' : ''}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          </div>
                          {gates.length > 0 && (
                            <div className="grid grid-cols-1 gap-1.5 ps-1 md:grid-cols-2">
                              {gates.map((g) => (
                                <Checkbox
                                  key={g}
                                  name={`gatesOff:${s.step}`}
                                  value={g}
                                  defaultChecked={o?.gatesOff.includes(g) ?? false}
                                  label={`إلغاء شرط: ${GATE_LABELS[g]}`}
                                />
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs font-medium leading-6 text-slate-500">
                    «غير مستخدمة» = المشروع ماينفعش يدخل المرحلة دي خالص. «اختيارية» = بيظهر زر «تخطّي».
                    شروط المرحلة اللي بعدها بتفضل شغّالة؛ فلو اخترت مرحلة غير مستخدمة وكان فيه مرحلة تالية
                    بتشترط حاجة بتتسجّل فيها (زي موافقة العميل) الغي الشرط ده هنا.
                  </p>
                  <div className="flex justify-end">
                    <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ تسلسل المنتج</SubmitButton>
                  </div>
                </ActionForm>
                {custom > 0 && (
                  <ActionForm
                    action={resetStudioProductRoute}
                    successMessage="رجع المنتج للتسلسل العام."
                    className="flex justify-start"
                  >
                    <input type="hidden" name="productId" value={p.id} />
                    <SubmitButton pendingLabel="جارٍ الرجوع…">رجّع للتسلسل العام</SubmitButton>
                  </ActionForm>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
