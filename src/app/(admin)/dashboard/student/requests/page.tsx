import { getDependentRequests } from '@/data/domains/dependent-requests';
import { StatusBadge, type StatusBadgeType } from '@/components/StatusBadge';
import { formatCairo } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * طلبات الطالب المرسَلة لولي أمره.
 *
 * ── ليه الصفحة دي موجودة ────────────────────────────────────
 *
 * الطالب بيضغط «اطلب من ولي أمرك» في صفحة الخدمة أو الباقة، وبعدين
 * **مفيش أي مكان يتابع فيه اللي طلبه**. لوحته كانت خمس تبويبات
 * (نظرة عامة · جلساتي · موادي · معرض أعمالي · ملفي) ومفيش فيها الطلبات.
 *
 * وكان فيه مكان واحد بيعرضها: `/account/family/requests` — بس دي شاشة
 * **ولي الأمر**، عنوانها «طلبات الأبناء» ونصّها بيخاطب الأب. الطالب
 * كان بيوصلها لأن `/account` كانت مفتوحة لأي مسجَّل، فيشوف طلباته هو
 * تحت عنوان مش بتاعه. دلوقتي `/account` مقفولة عليه، فلازم يبقى ليه
 * مكانه.
 *
 * ⚠️ **الصفحة دي للقراءة بس.** الطالب ما يقدرش يوافق على طلب نفسه —
 *    وده مفروض في القاعدة كمان (سياسة `UPDATE` على `dependent_requests`
 *    لولي الأمر وحده، ملف 74)، مش في الواجهة بس.
 *
 * والاستعلام مش بيفلتر بالدور: `can_see_dependent_request` في القاعدة
 * بترجّع للطالب طلباته هو وبس.
 */
const STATUS: Record<string, { label: string; type: StatusBadgeType }> = {
  pending: { label: 'في انتظار ولي الأمر', type: 'warning' },
  approved: { label: 'تمت الموافقة', type: 'success' },
  rejected: { label: 'مرفوض', type: 'danger' },
  cancelled: { label: 'ملغي', type: 'neutral' },
};

export default async function StudentRequestsPage() {
  const requests = await getDependentRequests();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="mb-2 text-2xl font-black text-slate-800">طلباتي</h1>
      <p className="mb-8 text-sm font-medium text-slate-500">
        اللي طلبته من ولي أمرك بيظهر هنا. لما يوافق، هو اللي بيكمّل الطلب
        والدفع من حسابه.
      </p>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
          لسه ما طلبتش حاجة. تقدر تطلب باقة أو خدمة من صفحتها، والطلب
          هيروح لولي أمرك.
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-800">
                    {r.kind === 'name_change'
                      ? `يبقى اسمي: ${r.targetName}`
                      : r.targetName}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {r.kind === 'name_change'
                      ? 'تغيير الاسم'
                      : r.kind === 'package'
                        ? 'باقة تدريبية'
                        : 'خدمة إبداعية'}
                    {r.providerName ? ` · ${r.providerName}` : ''}
                  </p>
                </div>
                <StatusBadge
                  label={STATUS[r.status]?.label ?? r.status}
                  type={STATUS[r.status]?.type ?? 'neutral'}
                />
              </div>

              {r.note && (
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <span className="font-bold">ملاحظتك: </span>
                  {r.note}
                </p>
              )}

              {/* سبب الرفض بيوصل للطالب — الرفض من غير سبب بيسيبه مش
                  عارف يعمل إيه بعدها. */}
              {r.status === 'rejected' && r.guardianNote && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  <span className="font-bold">رد ولي الأمر: </span>
                  {r.guardianNote}
                </p>
              )}

              <p className="mt-3 text-xs font-medium text-slate-400">
                أُرسل في {formatCairo(r.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
